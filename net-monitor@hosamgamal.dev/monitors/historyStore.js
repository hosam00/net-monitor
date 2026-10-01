import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { formatDate } from '../utils/time.js';
import { decodeUtf8 } from '../utils/text.js';
import { loadContentsAsync, replaceContentsAsync, encodeBytes } from '../utils/gio.js';
import { debug, error, warn } from '../utils/debug.js';

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
    }

    // Persisted data is read asynchronously, so enable() must await this
    // before the first sample records against the loaded totals.
    async init() {
        await this._loadPersistedData();
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

    async _loadPersistedData() {
        try {
            this._dailyTotals = await this._readJson('daily-totals.json', this._dailyTotals);
            this._monthlyTotals = await this._readJson('monthly-totals.json', this._monthlyTotals);
            debug('History data loaded from disk');
        } catch (e) {
            warn('Failed to load persisted history', e);
        }
    }

    async _readJson(name, fallback) {
        const path = this._getFilePath(name);
        if (!GLib.file_test(path, GLib.FileTest.EXISTS)) {
            return fallback;
        }
        const [, contents] = await loadContentsAsync(Gio.File.new_for_path(path));
        return JSON.parse(decodeUtf8(contents));
    }

    async _writeJson(name, data) {
        const path = this._getFilePath(name);
        await replaceContentsAsync(
            Gio.File.new_for_path(path),
            encodeBytes(JSON.stringify(data, null, 2))
        );
    }

    async _savePersistedData() {
        if (!this._enabled) return;

        try {
            await this._writeJson('daily-totals.json', this._dailyTotals);
            await this._writeJson('monthly-totals.json', this._monthlyTotals);
            debug('History data saved to disk');
        } catch (e) {
            error('Failed to save history data', e);
        }
    }

    setEnabled(enabled) {
        this._enabled = enabled;
    }

    async recordSample(interfaceData, processData) {
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
            await this._rollup(interfaceData);
            this._lastRollupTime = now;
        }
    }

    async _rollup(interfaceData) {
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
        await this._savePersistedData();
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
