import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class NetMonitorPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        window.add(this._buildGeneralPage(settings));
        window.add(this._buildInterfacesPage(settings));
        window.add(this._buildAppPage(settings));
        window.add(this._buildHistoryPage(settings));
        window.add(this._buildAlertsPage(settings));
    }

    _makeRow(title, widget) {
        const row = new Adw.ActionRow();
        row.set_title(title);
        row.add_suffix(widget);
        row.set_activatable_widget(widget);
        return row;
    }

    _makeSwitch(settings, key, title) {
        const toggle = new Gtk.Switch();
        settings.bind(key, toggle, 'active', Gio.SettingsBindFlags.DEFAULT);
        return this._makeRow(title, toggle);
    }

    _buildGeneralPage(settings) {
        const page = new Adw.PreferencesPage();
        page.set_title('General');
        page.set_name('General');

        const sampling = new Adw.PreferencesGroup();
        sampling.add(this._makeSwitch(settings, 'start-paused', 'Start Paused'));

        const intervalSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 500, upper: 5000, step_increment: 100, page_increment: 500
            })
        });
        settings.bind('refresh-interval-ms', intervalSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        sampling.add(this._makeRow('Refresh Interval (ms)', intervalSpin));

        const precisionSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0, upper: 3, step_increment: 1, page_increment: 1
            })
        });
        settings.bind('decimal-precision', precisionSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        sampling.add(this._makeRow('Decimal Precision', precisionSpin));
        page.add(sampling);

        const display = new Adw.PreferencesGroup();
        display.set_title('Panel Display');

        const modeCombo = new Gtk.ComboBoxText();
        modeCombo.append('down-up', 'Down & Up');
        modeCombo.append('down-only', 'Down Only');
        modeCombo.append('up-only', 'Up Only');
        modeCombo.append('total-only', 'Total Only');
        modeCombo.append('compact', 'Compact');
        modeCombo.set_active_id(settings.get_string('panel-display-mode'));
        settings.bind('panel-display-mode', modeCombo, 'active-id', Gio.SettingsBindFlags.DEFAULT);
        display.add(this._makeRow('Panel Display Mode', modeCombo));

        display.add(this._makeSwitch(settings, 'show-compact', 'Compact Panel Mode'));
        page.add(display);

        const advanced = new Adw.PreferencesGroup();
        advanced.set_title('Advanced');
        advanced.add(this._makeSwitch(settings, 'debug-enabled', 'Debug Mode'));
        page.add(advanced);

        return page;
    }

    _buildInterfacesPage(settings) {
        const page = new Adw.PreferencesPage();
        page.set_title('Interfaces');
        page.set_name('Interfaces');

        const group = new Adw.PreferencesGroup();
        group.add(this._makeSwitch(settings, 'auto-detect-interfaces', 'Auto-detect Interfaces'));
        group.add(this._makeSwitch(settings, 'ignore-loopback', 'Ignore Loopback'));
        group.add(this._makeSwitch(settings, 'ignore-virtual', 'Ignore Virtual Interfaces'));
        page.add(group);

        return page;
    }

    _buildAppPage(settings) {
        const page = new Adw.PreferencesPage();
        page.set_title('Per-App');
        page.set_name('Per-App');

        const group = new Adw.PreferencesGroup();
        group.add(this._makeSwitch(settings, 'enable-process-monitor', 'Enable Per-App Monitoring'));

        const groupingCombo = new Gtk.ComboBoxText();
        groupingCombo.append('disabled', 'Disabled');
        groupingCombo.append('smart', 'Smart Grouping');
        groupingCombo.append('aggressive', 'Aggressive Grouping');
        groupingCombo.set_active_id(settings.get_string('process-grouping-mode'));
        settings.bind('process-grouping-mode', groupingCombo, 'active-id', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Grouping Mode', groupingCombo));

        const spin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 1, upper: 50, step_increment: 1, page_increment: 5
            })
        });
        spin.set_value(settings.get_int('top-process-count'));
        settings.bind('top-process-count', spin, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Top N Processes', spin));
        page.add(group);

        return page;
    }

    _buildHistoryPage(settings) {
        const page = new Adw.PreferencesPage();
        page.set_title('History');
        page.set_name('History');

        const group = new Adw.PreferencesGroup();
        group.add(this._makeSwitch(settings, 'persistence-enabled', 'Enable History Storage'));

        const retentionSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 1, upper: 365, step_increment: 1, page_increment: 30
            })
        });
        retentionSpin.set_value(settings.get_int('retention-days'));
        settings.bind('retention-days', retentionSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Retention (days)', retentionSpin));
        page.add(group);

        return page;
    }

    _buildAlertsPage(settings) {
        const page = new Adw.PreferencesPage();
        page.set_title('Alerts');
        page.set_name('Alerts');

        const group = new Adw.PreferencesGroup();

        const dailyCap = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0, upper: 1e15, step_increment: 1e9, page_increment: 1e10
            })
        });
        dailyCap.set_value(settings.get_uint64('daily-cap-bytes'));
        settings.bind('daily-cap-bytes', dailyCap, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Daily Cap (bytes, 0=off)', dailyCap));

        const monthlyCap = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0, upper: 1e15, step_increment: 1e9, page_increment: 1e10
            })
        });
        monthlyCap.set_value(settings.get_uint64('monthly-cap-bytes'));
        settings.bind('monthly-cap-bytes', monthlyCap, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Monthly Cap (bytes, 0=off)', monthlyCap));

        const spike = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0, upper: 1e12, step_increment: 1e6, page_increment: 1e7
            })
        });
        spike.set_value(settings.get_uint64('spike-threshold-bytes-per-sec'));
        settings.bind('spike-threshold-bytes-per-sec', spike, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Spike Threshold (B/s, 0=off)', spike));

        const cooldown = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0, upper: 86400, step_increment: 60, page_increment: 300
            })
        });
        cooldown.set_value(settings.get_int('notification-cooldown-sec'));
        settings.bind('notification-cooldown-sec', cooldown, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Cooldown (seconds)', cooldown));

        group.add(this._makeSwitch(settings, 'quiet-hours-enabled', 'Enable Quiet Hours'));
        page.add(group);

        return page;
    }
}