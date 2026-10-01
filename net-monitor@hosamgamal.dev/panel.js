import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { formatRate, formatCompact } from './utils/format.js';

const PANEL_ICON_NAME = 'network-transmit-receive-symbolic';

export var PanelIndicator = GObject.registerClass({
    GTypeName: 'PanelIndicator',
}, class PanelIndicator extends PanelMenu.Button {
    constructor(settings) {
        super(0.0, 'Net Monitor', false);

        this._settings = settings;
        this._currentData = null;
        this._state = 'connected-idle';

        this._icon = new St.Icon({
            icon_name: PANEL_ICON_NAME,
            style_class: 'system-status-icon',
            icon_size: 16,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._label = new St.Label({
            text: '↓ 0 B/s ↑ 0 B/s',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'net-monitor-panel-label'
        });

        const box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
        box.add_child(this._icon);
        box.add_child(this._label);
        this.add_child(box);
        this._box = box;

        this._settings.connect('changed::panel-display-mode', () => this._updateDisplay());
        this._settings.connect('changed::show-compact', () => this._updateDisplay());
    }

    updateData(data) {
        this._currentData = data;
        this._updateDisplay();
    }

    setState(state) {
        this._state = state;
        this._updateDisplay();
    }

    _updateDisplay() {
        if (!this._currentData) {
            this._label.text = '↓ 0 B/s ↑ 0 B/s';
            return;
        }

        const mode = this._settings.get_string('panel-display-mode');
        const compact = this._settings.get_boolean('show-compact');
        const precision = this._settings.get_int('decimal-precision');

        const { totalRxRate, totalTxRate } = this._currentData;

        if (compact) {
            const down = formatCompact(totalRxRate);
            const up = formatCompact(totalTxRate);
            this._label.text = `↓${down} ↑${up}`;
            return;
        }

        switch (mode) {
            case 'down-only':
                this._label.text = `↓ ${formatRate(totalRxRate, 'auto', precision)}`;
                break;
            case 'up-only':
                this._label.text = `↑ ${formatRate(totalTxRate, 'auto', precision)}`;
                break;
            case 'total-only':
                this._label.text = formatRate(totalRxRate + totalTxRate, 'auto', precision);
                break;
            case 'compact':
                this._label.text = `↓${formatCompact(totalRxRate)} ↑${formatCompact(totalTxRate)}`;
                break;
            case 'down-up':
            default:
                this._label.text = `↓ ${formatRate(totalRxRate, 'auto', precision)}  ↑ ${formatRate(totalTxRate, 'auto', precision)}`;
                break;
        }

        if (this._state === 'disconnected') {
            this._icon.icon_name = 'network-offline-symbolic';
        } else if (this._state === 'alert') {
            this._icon.icon_name = 'dialog-warning-symbolic';
        } else if (this._state === 'paused') {
            this._icon.icon_name = 'media-playback-pause-symbolic';
        } else {
            this._icon.icon_name = PANEL_ICON_NAME;
        }
    }
});
