import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {InterfaceMonitor} from './monitors/interfaceMonitor.js';
import {ProcessMonitor} from './monitors/processMonitor.js';
import {HistoryStore} from './monitors/historyStore.js';
import {Alerts} from './monitors/alerts.js';
import {PanelIndicator} from './panel.js';
import {MonitorMenu} from './menu.js';
import {setDebugEnabled, error, info} from './utils/debug.js';

export default class NetMonitorExtension extends Extension {
    async enable() {
        this._settings = this.getSettings();
        this._signalHandlers = [];
        this._destroyed = false;
        this._sampling = false;

        setDebugEnabled(this._settings.get_boolean('debug-enabled'));

        this._connect(this._settings, 'changed::debug-enabled', () => {
            setDebugEnabled(this._settings.get_boolean('debug-enabled'));
        });

        this._paused = this._settings.get_boolean('start-paused');

        this._interfaceMonitor = new InterfaceMonitor(this._settings);
        this._processMonitor = new ProcessMonitor(this._settings);
        this._historyStore = new HistoryStore(this._settings);
        await this._historyStore.init();
        this._alerts = new Alerts(this._settings);

        this._indicator = new PanelIndicator(this._settings);
        Main.panel.addToStatusArea('net-monitor', this._indicator);

        this._menu = new MonitorMenu(this._indicator.menu, this._settings);

        this._menu.onRefresh = () => {
            this._doSample();
        };
        this._menu.onOpenPreferences = () => {
            this.openPreferences();
        };

        // Heavy per-process scans only run while the popup is open. Resample
        // on open so the app list is populated the moment it becomes visible.
        this._connect(this._indicator.menu, 'open-state-changed', (menu, open) => {
            this._processMonitor.setPopupVisible(open);
            if (open) this._doSample();
        });

        this._connect(this._settings, 'changed::refresh-interval-ms', () => {
            this._restartTimer();
        });
        this._connect(this._settings, 'changed::enable-process-monitor', () => {
            this._processMonitor.setEnabled(this._settings.get_boolean('enable-process-monitor'));
        });
        this._connect(this._settings, 'changed::persistence-enabled', () => {
            this._historyStore.setEnabled(this._settings.get_boolean('persistence-enabled'));
        });

        if (!this._paused) {
            this._startTimer();
            this._doSample();
        } else {
            this._indicator.setState('paused');
        }

        info('Extension enabled');
    }

    // Every signal opened in enable() is recorded here so disable() can close
    // it again; the EGO linter (EGO-L-003) requires explicit disconnection.
    _connect(source, signal, callback) {
        this._signalHandlers.push([source, source.connect(signal, callback)]);
    }

    _disconnectAll() {
        for (const [source, id] of this._signalHandlers) {
            try {
                source.disconnect(id);
            } catch {
                // Already destroyed along with its owner.
            }
        }
        this._signalHandlers = [];
    }

    disable() {
        this._destroyed = true;

        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = null;
        }

        this._disconnectAll();

        if (this._menu) {
            this._menu.destroy();
            this._menu = null;
        }

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        if (this._interfaceMonitor) {
            this._interfaceMonitor.destroy();
            this._interfaceMonitor = null;
        }

        if (this._processMonitor) {
            this._processMonitor.destroy();
            this._processMonitor = null;
        }

        if (this._historyStore) {
            this._historyStore.destroy();
            this._historyStore = null;
        }

        if (this._alerts) {
            this._alerts.destroy();
            this._alerts = null;
        }

        this._settings = null;
        info('Extension disabled');
    }

    _startTimer() {
        const interval = this._settings.get_int('refresh-interval-ms');
        this._timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
            this._doSample();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _restartTimer() {
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = null;
        }
        if (!this._paused) {
            this._startTimer();
        }
    }

    async _doSample() {
        if (this._paused || this._destroyed) return;
        // The timer can fire while an async scan is still in flight; without
        // this the two cycles would interleave and corrupt the rate deltas.
        if (this._sampling) return;
        this._sampling = true;

        try {
            const interfaceData = await this._interfaceMonitor.sample();
            if (this._destroyed) return;
            if (!interfaceData) {
                this._indicator.setState('disconnected');
                return;
            }

            let processData = null;
            if (this._settings.get_boolean('enable-process-monitor')) {
                processData = await this._processMonitor.sample(interfaceData);
                if (this._destroyed) return;
            }

            await this._historyStore.recordSample(interfaceData, processData);
            if (this._destroyed) return;

            const historyTotals = {
                today: this._historyStore.getTodayTotal(),
                month: this._historyStore.getMonthTotal(),
                status: this._historyStore.status
            };

            const alerts = this._alerts.evaluate(interfaceData, historyTotals);

            for (const alert of alerts) {
                this._alerts.showAlert(alert);
            }

            if (alerts.some(a => a.severity === 'critical')) {
                this._indicator.setState('alert');
            } else if (interfaceData.totalRxRate > 0 || interfaceData.totalTxRate > 0) {
                this._indicator.setState('active');
            } else {
                this._indicator.setState('connected-idle');
            }

            this._indicator.updateData(interfaceData);

            const menuProcessData = processData ? {
                ...processData,
                appGroups: this._processMonitor?.appGroups || null
            } : null;

            this._menu.updateData(interfaceData, menuProcessData, historyTotals, alerts);

        } catch (e) {
            const msg = (e && e.message) ? e.message : String(e);
            const stack = (e && e.stack) ? '\n' + e.stack : '';
            error('Sample cycle failed: ' + msg + stack);
        } finally {
            this._sampling = false;
        }
    }
}
