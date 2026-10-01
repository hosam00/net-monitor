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
        this._prevRx = null;
        this._prevTx = null;
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
            this._stripLegacyFields();

            // Last observed kernel counters. Persisting them means a
            // disable/enable cycle resumes counting instead of restarting from
            // the current counter, which would silently drop everything
            // transferred while the extension was off.
            const counters = await this._readJson('counter-state.json', null);
            if (counters && typeof counters.rx === 'number' && typeof counters.tx === 'number') {
                this._prevRx = counters.rx;
                this._prevTx = counters.tx;
            }

            debug('History data loaded from disk');
        } catch (e) {
            warn('Failed to load persisted history', e);
        }
    }

    // byInterface was never populated or read; drop it so the persisted
    // document stops implying a per-interface breakdown that does not exist.
    _stripLegacyFields() {
        for (const day of Object.keys(this._dailyTotals)) {
            delete this._dailyTotals[day].byInterface;
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
            if (this._prevRx !== null) {
                await this._writeJson('counter-state.json', { rx: this._prevRx, tx: this._prevTx });
            }
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

        this._ensureBucket(this._dailyTotals, today);
        this._ensureBucket(this._monthlyTotals, month);

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
            this._lastRollupTime = now;
            this._accumulate(totalRx, totalTx, today, month);
            this._pruneOldData();
            await this._savePersistedData();
        }
    }

    _ensureBucket(store, key) {
        if (!store[key]) {
            store[key] = { rxBytes: 0, txBytes: 0 };
        }
    }

    // Totals accumulate the delta between rollups instead of tracking the raw
    // counter from /proc/net/dev. That counter is cumulative since boot and
    // resets on reboot, so reading it directly made a day report only its
    // largest single boot session rather than everything transferred that day.
    _accumulate(totalRx, totalTx, today, month) {
        // /proc/net/dev reports loopback frames, so a live system never reads
        // zero on both directions. Zero means the read failed; consuming the
        // baseline here would make the next real sample look like one enormous
        // delta.
        if (totalRx === 0 && totalTx === 0) return;

        if (this._prevRx === null) {
            // First observation: the counter already includes everything
            // transferred before the extension started, so counting it would
            // over-report the day.
            this._prevRx = totalRx;
            this._prevTx = totalTx;
            return;
        }

        // A counter that moved backwards means a reboot or an interface reset.
        // Whatever happened in the gap cannot be recovered, so restart the
        // delta from the new value rather than subtracting.
        const rxDelta = totalRx >= this._prevRx ? totalRx - this._prevRx : 0;
        const txDelta = totalTx >= this._prevTx ? totalTx - this._prevTx : 0;

        this._prevRx = totalRx;
        this._prevTx = totalTx;

        this._dailyTotals[today].rxBytes += rxDelta;
        this._dailyTotals[today].txBytes += txDelta;
        this._monthlyTotals[month].rxBytes += rxDelta;
        this._monthlyTotals[month].txBytes += txDelta;
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
