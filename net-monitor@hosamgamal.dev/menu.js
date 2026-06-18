import St from 'gi://St';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { formatRate, formatBytes } from './utils/format.js';

export class MonitorMenu {
    constructor(panelMenu, settings) {
        this._menu = panelMenu;
        this._settings = settings;
        this._currentData = null;
        this._currentProcessData = null;
        this._historyData = null;
        this._alerts = [];
        this._visible = false;

        panelMenu.connect('open-state-changed', (menu, open) => {
            this._visible = open;
            if (open) {
                this._rebuild();
            }
        });

        // Ensure menu has content so it opens on first click
        const initItem = new PopupMenu.PopupMenuItem('Net Monitor — loading...');
        initItem.setSensitive(false);
        this._menu.addMenuItem(initItem);
    }

    updateData(interfaceData, processData, historyData, alerts) {
        this._currentData = interfaceData;
        this._currentProcessData = processData;
        this._historyData = historyData;
        this._alerts = alerts;

        if (this._visible) {
            this._rebuild();
        }
    }

    forceRebuild() {
        this._rebuild();
    }

    _rebuild() {
        this._menu.removeAll();

        if (!this._currentData) {
            this._addNoDataSection();
            this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this._addQuickActionsSection();
            return;
        }

        this._addHeaderSection();
        this._addInterfaceSection();
        this._addHistorySection();
        this._addTopAppsSection();
        this._addAlertsSection();
        this._addQuickActionsSection();
    }

    _addNoDataSection() {
        const item = new PopupMenu.PopupMenuItem('Waiting for data...');
        item.setSensitive(false);
        this._menu.addMenuItem(item);
    }

    _addHeaderSection() {
        const data = this._currentData;
        const totalRx = formatRate(data.totalRxRate || 0);
        const totalTx = formatRate(data.totalTxRate || 0);
        const activeCount = Object.values(data.interfaces || {}).filter(i => i.isActive).length;

        const header = new PopupMenu.PopupMenuItem('', { reactive: false });
        const label = new St.Label({
            text: `Total: ↓ ${totalRx}  ↑ ${totalTx}\nActive interfaces: ${activeCount}`,
            style_class: 'net-monitor-menu-header'
        });
        header.actor.add_child(label);
        this._menu.addMenuItem(header);

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    _addInterfaceSection() {
        const data = this._currentData;
        if (!data.interfaces || Object.keys(data.interfaces).length === 0) return;

        for (const [name, iface] of Object.entries(data.interfaces)) {
            if (!iface.isActive) continue;

            const rx = formatRate(iface.rxRate || 0);
            const tx = formatRate(iface.txRate || 0);
            const rxTotal = formatBytes(iface.rxBytes || 0);
            const txTotal = formatBytes(iface.txBytes || 0);

            const item = new PopupMenu.PopupMenuItem('', { reactive: false });
            const label = new St.Label({
                text: `${name}  ↓ ${rx}  ↑ ${tx}\n  Total: ${rxTotal} / ${txTotal}`,
                style_class: 'net-monitor-interface-row'
            });
            item.actor.add_child(label);
            this._menu.addMenuItem(item);
        }

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    _addHistorySection() {
        if (!this._historyData) return;

        const today = this._historyData.today || { rxBytes: 0, txBytes: 0 };
        const month = this._historyData.month || { rxBytes: 0, txBytes: 0 };

        const todayRx = formatBytes(today.rxBytes || 0);
        const todayTx = formatBytes(today.txBytes || 0);
        const monthRx = formatBytes(month.rxBytes || 0);
        const monthTx = formatBytes(month.txBytes || 0);

        const item = new PopupMenu.PopupMenuItem('', { reactive: false });
        const label = new St.Label({
            text: `Today: ↓ ${todayRx}  ↑ ${todayTx}\nMonth: ↓ ${monthRx}  ↑ ${monthTx}`,
            style_class: 'net-monitor-history-row'
        });
        item.actor.add_child(label);
        this._menu.addMenuItem(item);

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    _addTopAppsSection() {
        const processData = this._currentProcessData;
        if (!processData) return;

        const groupingMode = this._settings.get_string('process-grouping-mode');
        const topList = processData.topProcesses || [];

        if (groupingMode !== 'disabled' && processData.appGroups) {
            const groups = Object.values(processData.appGroups)
                .sort((a, b) => (b.rxRate + b.txRate) - (a.rxRate + a.txRate))
                .slice(0, this._settings.get_int('top-process-count'));

            for (const group of groups) {
                const rx = formatRate(group.rxRate);
                const tx = formatRate(group.txRate);
                const count = group.count > 1 ? ` (${group.count} procs)` : '';

                const item = new PopupMenu.PopupMenuItem('', { reactive: false });
                const label = new St.Label({
                    text: `${group.name}${count}\n  ↓ ${rx}  ↑ ${tx}`,
                    style_class: 'net-monitor-app-row'
                });
                item.actor.add_child(label);
                this._menu.addMenuItem(item);
            }
        } else {
            for (const proc of topList.slice(0, this._settings.get_int('top-process-count'))) {
                const rx = formatRate(proc.rxRate || 0);
                const tx = formatRate(proc.txRate || 0);
                const pid = proc.pid ? ` [${proc.pid}]` : '';

                const item = new PopupMenu.PopupMenuItem('', { reactive: false });
                const label = new St.Label({
                    text: `${proc.comm}${pid}\n  ↓ ${rx}  ↑ ${tx}`,
                    style_class: 'net-monitor-app-row'
                });
                item.actor.add_child(label);
                this._menu.addMenuItem(item);
            }
        }

        if (topList.length === 0) {
            const item = new PopupMenu.PopupMenuItem('No active applications', { reactive: false });
            item.setSensitive(false);
            this._menu.addMenuItem(item);
        }

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    _addAlertsSection() {
        if (!this._alerts || this._alerts.length === 0) return;

        for (const alert of this._alerts) {
            const item = new PopupMenu.PopupMenuItem('', { reactive: false });
            const icon = alert.severity === 'critical' ? '⚠' :
                         alert.severity === 'warning' ? '⚡' : 'ℹ';
            const label = new St.Label({
                text: `${icon} ${alert.message}`,
                style_class: `net-monitor-alert-${alert.severity}`
            });
            item.actor.add_child(label);
            this._menu.addMenuItem(item);
        }

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    _addQuickActionsSection() {
        const prefsItem = new PopupMenu.PopupMenuItem('Preferences');
        prefsItem.connect('activate', () => {
            this._openPreferences();
        });
        this._menu.addMenuItem(prefsItem);

        const refreshItem = new PopupMenu.PopupMenuItem('Refresh Now');
        refreshItem.connect('activate', () => {
            if (this._onRefresh) this._onRefresh();
        });
        this._menu.addMenuItem(refreshItem);
    }

    set onRefresh(callback) {
        this._onRefresh = callback;
    }

    set onOpenPreferences(callback) {
        this._openPreferences = callback;
    }

    destroy() {
        this._menu.removeAll();
    }
}
