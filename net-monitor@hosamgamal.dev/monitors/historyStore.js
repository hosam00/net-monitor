import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { formatDate } from '../utils/time.js';
import { decodeUtf8 } from '../utils/text.js';
import { debug, error, info, warn } from '../utils/debug.js';

export class HistoryStore {
    constructor(settings) {
        this._settings = settings;
        this._enabled = true;
        this._dataDir = null;
        this._dailyTotals = {};
        this._monthlyTotals = {};
        this._hourlySamples = [];
        this._lastRollupTime = 0;
        this._rollupIntervalMs = 30000;
        this._initDataDir();
        this._loadPersistedData();
    }

    _initDataDir() {
        this._dataDir = GLib.build_filenamev([
            GLib.get_user_data_dir(),
            'gnome-shell',
            'extensions',
            'net-monitor@hosamgamal.dev'
        ]);
        GLib.mkdir_with_parents(this._dataDir, parseInt('0755', 8));
    }

    _getFilePath(name) {
        return GLib.build_filenamev([this._dataDir, name]);
    }

    _loadPersistedData() {
        try {
            const dailyPath = this._getFilePath('daily-totals.json');
            const monthlyPath = this._getFilePath('monthly-totals.json');

            if (GLib.file_test(dailyPath, GLib.FileTest.EXISTS)) {
                const file = Gio.File.new_for_path(dailyPath);
                const [success, contents] = file.load_contents(null);
                if (success) {
                    this._dailyTotals = JSON.parse(decodeUtf8(contents));
                }
            }

            if (GLib.file_test(monthlyPath, GLib.FileTest.EXISTS)) {
                const file = Gio.File.new_for_path(monthlyPath);
                const [success, contents] = file.load_contents(null);
                if (success) {
                    this._monthlyTotals = JSON.parse(decodeUtf8(contents));
                }
            }

            debug('History data loaded from disk');
        } catch (e) {
            warn('Failed to load persisted history', e);
        }
    }

    _savePersistedData() {
        if (!this._enabled) return;

        try {
            const dailyPath = this._getFilePath('daily-totals.json');
            const monthlyPath = this._getFilePath('monthly-totals.json');

            const dailyFile = Gio.File.new_for_path(dailyPath);
            dailyFile.replace_contents(
                JSON.stringify(this._dailyTotals, null, 2),
                null,
                false,
                Gio.FileCreateFlags.NONE,
                null
            );

            const monthlyFile = Gio.File.new_for_path(monthlyPath);
            monthlyFile.replace_contents(
                JSON.stringify(this._monthlyTotals, null, 2),
                null,
                false,
                Gio.FileCreateFlags.NONE,
                null
            );

            debug('History data saved to disk');
        } catch (e) {
            error('Failed to save history data', e);
        }
    }

    setEnabled(enabled) {
        this._enabled = enabled;
    }

    recordSample(interfaceData, processData) {
        if (!this._enabled) return;

        const now = Date.now();
        const today = formatDate(new Date());
        const month = today.substring(0, 7);

        const totalRx = interfaceData?.totalRxBytes || 0;
        const totalTx = interfaceData?.totalTxBytes || 0;

        if (!this._dailyTotals[today]) {
            this._dailyTotals[today] = { rxBytes: 0, txBytes: 0, byInterface: {} };
        }
        if (!this._monthlyTotals[month]) {
            this._monthlyTotals[month] = { rxBytes: 0, txBytes: 0 };
        }

        this._hourlySamples.push({
            timestamp: now,
            rxBytes: totalRx,
            txBytes: totalTx,
            rxRate: interfaceData?.totalRxRate || 0,
            txRate: interfaceData?.totalTxRate || 0
        });

        const cutoff = now - 86400000;
        this._hourlySamples = this._hourlySamples.filter(s => s.timestamp > cutoff);

        if (now - this._lastRollupTime > this._rollupIntervalMs) {
            this._rollup(interfaceData);
            this._lastRollupTime = now;
        }
    }

    _rollup(interfaceData) {
        const now = new Date();
        const today = formatDate(now);
        const month = today.substring(0, 7);
        const totalRx = interfaceData?.totalRxBytes || 0;
        const totalTx = interfaceData?.totalTxBytes || 0;

        if (!this._dailyTotals[today]) {
            this._dailyTotals[today] = { rxBytes: 0, txBytes: 0, byInterface: {} };
        }

        this._dailyTotals[today].rxBytes = Math.max(this._dailyTotals[today].rxBytes, totalRx);
        this._dailyTotals[today].txBytes = Math.max(this._dailyTotals[today].txBytes, totalTx);

        if (!this._monthlyTotals[month]) {
            this._monthlyTotals[month] = { rxBytes: 0, txBytes: 0 };
        }
        this._monthlyTotals[month].rxBytes = Math.max(this._monthlyTotals[month].rxBytes, totalRx);
        this._monthlyTotals[month].txBytes = Math.max(this._monthlyTotals[month].txBytes, totalTx);

        this._pruneOldData();
        this._savePersistedData();
    }

    _pruneOldData() {
        const retentionDays = this._settings.get_int('retention-days');
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - retentionDays);
        const cutoffStr = formatDate(cutoff);

        for (const day of Object.keys(this._dailyTotals)) {
            if (day < cutoffStr) {
                delete this._dailyTotals[day];
            }
        }

        const cutoffMonth = cutoffStr.substring(0, 7);
        for (const month of Object.keys(this._monthlyTotals)) {
            if (month < cutoffMonth) {
                delete this._monthlyTotals[month];
            }
        }
    }

    getTodayTotal() {
        const today = formatDate(new Date());
        return this._dailyTotals[today] || { rxBytes: 0, txBytes: 0 };
    }

    getMonthTotal() {
        const month = formatDate(new Date()).substring(0, 7);
        return this._monthlyTotals[month] || { rxBytes: 0, txBytes: 0 };
    }

    getHourlyHistory() {
        return this._hourlySamples.slice();
    }

    getDailyTotals() {
        return { ...this._dailyTotals };
    }

    getMonthlyTotals() {
        return { ...this._monthlyTotals };
    }

    resetAll() {
        this._dailyTotals = {};
        this._monthlyTotals = {};
        this._hourlySamples = [];
        this._savePersistedData();
        info('All history data reset');
    }

    resetDay(day) {
        if (this._dailyTotals[day]) {
            delete this._dailyTotals[day];
            this._savePersistedData();
        }
    }

    resetMonth(month) {
        if (this._monthlyTotals[month]) {
            delete this._monthlyTotals[month];
            this._savePersistedData();
        }
    }

    get status() {
        const today = this.getTodayTotal();
        const month = this.getMonthTotal();
        return {
            enabled: this._enabled,
            dailyTotalsCount: Object.keys(this._dailyTotals).length,
            monthlyTotalsCount: Object.keys(this._monthlyTotals).length,
            hourlySamplesCount: this._hourlySamples.length,
            todayRx: today.rxBytes,
            todayTx: today.txBytes,
            monthRx: month.rxBytes,
            monthTx: month.txBytes,
            dataDir: this._dataDir
        };
    }

    destroy() {
        this._savePersistedData();
        this._dailyTotals = {};
        this._monthlyTotals = {};
        this._hourlySamples = [];
    }
}
