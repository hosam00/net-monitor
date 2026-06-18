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
        window.add(this._buildAppearancePage(settings));
        window.add(this._buildAdvancedPage(settings));
    }

    _makeRow(title, widget) {
        const row = new Adw.ActionRow();
        row.set_title(title);
        row.add_suffix(widget);
        row.set_activatable_widget(widget);
        return row;
    }

    _buildGeneralPage(settings) {
        const page = new Adw.PreferencesPage();
        page.set_title('General');
        page.set_name('General');

        const group = new Adw.PreferencesGroup();

        const enabledSwitch = new Gtk.Switch({ active: settings.get_boolean('enabled') });
        settings.bind('enabled', enabledSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Enable Monitoring', enabledSwitch));

        const pausedSwitch = new Gtk.Switch({ active: settings.get_boolean('start-paused') });
        settings.bind('start-paused', pausedSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Start Paused', pausedSwitch));

        const intervalSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 500, upper: 5000, step_increment: 100, page_increment: 500
            })
        });
        intervalSpin.set_value(settings.get_int('refresh-interval-ms'));
        settings.bind('refresh-interval-ms', intervalSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Refresh Interval (ms)', intervalSpin));

        const precisionSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 0, upper: 3, step_increment: 1, page_increment: 1
            })
        });
        precisionSpin.set_value(settings.get_int('decimal-precision'));
        settings.bind('decimal-precision', precisionSpin, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Decimal Precision', precisionSpin));

        const compactSwitch = new Gtk.Switch({ active: settings.get_boolean('show-compact') });
        settings.bind('show-compact', compactSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Compact Panel Mode', compactSwitch));

        page.add(group);
        return page;
    }

    _buildInterfacesPage(settings) {
        const page = new Adw.PreferencesPage();
        page.set_title('Interfaces');
        page.set_name('Interfaces');

        const group = new Adw.PreferencesGroup();

        const autoSwitch = new Gtk.Switch({ active: settings.get_boolean('auto-detect-interfaces') });
        settings.bind('auto-detect-interfaces', autoSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Auto-detect Interfaces', autoSwitch));

        const loopbackSwitch = new Gtk.Switch({ active: settings.get_boolean('ignore-loopback') });
        settings.bind('ignore-loopback', loopbackSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Ignore Loopback', loopbackSwitch));

        const virtualSwitch = new Gtk.Switch({ active: settings.get_boolean('ignore-virtual') });
        settings.bind('ignore-virtual', virtualSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Ignore Virtual Interfaces', virtualSwitch));

        const vpnSwitch = new Gtk.Switch({ active: settings.get_boolean('separate-vpn') });
        settings.bind('separate-vpn', vpnSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Separate VPN Traffic', vpnSwitch));

        page.add(group);
        return page;
    }

    _buildAppPage(settings) {
        const page = new Adw.PreferencesPage();
        page.set_title('Per-App');
        page.set_name('Per-App');

        const group = new Adw.PreferencesGroup();

        const enableSwitch = new Gtk.Switch({ active: settings.get_boolean('enable-process-monitor') });
        settings.bind('enable-process-monitor', enableSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Enable Per-App Monitoring', enableSwitch));

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

        const iconsSwitch = new Gtk.Switch({ active: settings.get_boolean('show-app-icons') });
        settings.bind('show-app-icons', iconsSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Show App Icons', iconsSwitch));

        page.add(group);
        return page;
    }

    _buildHistoryPage(settings) {
        const page = new Adw.PreferencesPage();
        page.set_title('History');
        page.set_name('History');

        const group = new Adw.PreferencesGroup();

        const enableSwitch = new Gtk.Switch({ active: settings.get_boolean('persistence-enabled') });
        settings.bind('persistence-enabled', enableSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Enable History Storage', enableSwitch));

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

        const quietSwitch = new Gtk.Switch({ active: settings.get_boolean('quiet-hours-enabled') });
        settings.bind('quiet-hours-enabled', quietSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Enable Quiet Hours', quietSwitch));

        page.add(group);
        return page;
    }

    _buildAppearancePage(settings) {
        const page = new Adw.PreferencesPage();
        page.set_title('Appearance');
        page.set_name('Appearance');

        const group = new Adw.PreferencesGroup();

        const modeCombo = new Gtk.ComboBoxText();
        modeCombo.append('down-up', 'Down & Up');
        modeCombo.append('down-only', 'Down Only');
        modeCombo.append('up-only', 'Up Only');
        modeCombo.append('total-only', 'Total Only');
        modeCombo.append('compact', 'Compact');
        modeCombo.set_active_id(settings.get_string('panel-display-mode'));
        settings.bind('panel-display-mode', modeCombo, 'active-id', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Panel Display Mode', modeCombo));

        const iconsSwitch = new Gtk.Switch({ active: settings.get_boolean('show-app-icons') });
        settings.bind('show-app-icons', iconsSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Show App Icons in Popup', iconsSwitch));

        page.add(group);
        return page;
    }

    _buildAdvancedPage(settings) {
        const page = new Adw.PreferencesPage();
        page.set_title('Advanced');
        page.set_name('Advanced');

        const group = new Adw.PreferencesGroup();

        const debugSwitch = new Gtk.Switch({ active: settings.get_boolean('debug-enabled') });
        settings.bind('debug-enabled', debugSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Debug Mode', debugSwitch));

        const unitCombo = new Gtk.ComboBoxText();
        unitCombo.append('auto', 'Auto');
        unitCombo.append('bytes', 'Bytes (B/s)');
        unitCombo.append('bits', 'Bits (b/s)');
        unitCombo.set_active_id(settings.get_string('rate-unit-mode'));
        settings.bind('rate-unit-mode', unitCombo, 'active-id', Gio.SettingsBindFlags.DEFAULT);
        group.add(this._makeRow('Rate Unit Mode', unitCombo));

        page.add(group);
        return page;
    }
}
