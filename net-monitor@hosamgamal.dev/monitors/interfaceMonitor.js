import { readNetDev } from '../utils/procfs.js';
import { parseNetDev, isLoopback, isVirtualInterface } from '../utils/parsing.js';
import { error } from '../utils/debug.js';

export class InterfaceMonitor {
    constructor(settings) {
        this._settings = settings;
        this._prevData = null;
        this._prevTime = null;
        this._interfaces = {};
        this._sessionTotals = {};
        this._enabled = true;
        this._rateHistory = {};
        this._historyLength = 5;
    }

    setEnabled(enabled) {
        this._enabled = enabled;
    }

    async sample() {
        if (!this._enabled) return null;

        try {
            const content = await readNetDev();
            const parsed = parseNetDev(content);
            const now = Date.now();

            const autoDetect = this._settings.get_boolean('auto-detect-interfaces');
            const included = this._settings.get_strv('included-interfaces');
            const excluded = this._settings.get_strv('excluded-interfaces');
            const ignoreLoopback = this._settings.get_boolean('ignore-loopback');
            const ignoreVirtual = this._settings.get_boolean('ignore-virtual');

            const result = {};
            let totalRxRate = 0;
            let totalTxRate = 0;
            let totalRxBytes = 0;
            let totalTxBytes = 0;

            for (const iface of parsed) {
                if (ignoreLoopback && isLoopback(iface.name)) continue;
                if (ignoreVirtual && isVirtualInterface(iface.name)) continue;
                if (excluded.includes(iface.name)) continue;
                if (!autoDetect && !included.includes(iface.name)) continue;

                const prev = this._prevData ? this._prevData[iface.name] : null;
                const prevTime = this._prevTime;

                let rxRate = 0;
                let txRate = 0;

                if (prev && prevTime) {
                    const dt = (now - prevTime) / 1000;
                    if (dt > 0) {
                        rxRate = Math.max(0, (iface.rxBytes - prev.rxBytes) / dt);
                        txRate = Math.max(0, (iface.txBytes - prev.txBytes) / dt);
                    }
                }

                if (!this._rateHistory[iface.name]) {
                    this._rateHistory[iface.name] = [];
                }
                this._rateHistory[iface.name].push({ rxRate, txRate });
                if (this._rateHistory[iface.name].length > this._historyLength) {
                    this._rateHistory[iface.name].shift();
                }

                const smoothRx = this._rateHistory[iface.name]
                    .reduce((sum, r) => sum + r.rxRate, 0) / this._rateHistory[iface.name].length;
                const smoothTx = this._rateHistory[iface.name]
                    .reduce((sum, r) => sum + r.txRate, 0) / this._rateHistory[iface.name].length;

                if (!this._sessionTotals[iface.name]) {
                    this._sessionTotals[iface.name] = { rxBytes: 0, txBytes: 0 };
                }

                if (prev) {
                    const rxDelta = Math.max(0, iface.rxBytes - prev.rxBytes);
                    const txDelta = Math.max(0, iface.txBytes - prev.txBytes);
                    this._sessionTotals[iface.name].rxBytes += rxDelta;
                    this._sessionTotals[iface.name].txBytes += txDelta;
                }

                const isActive = (smoothRx > 0 || smoothTx > 0 || iface.rxBytes > 0);

                result[iface.name] = {
                    name: iface.name,
                    rxBytes: iface.rxBytes,
                    txBytes: iface.txBytes,
                    rxRate: smoothRx,
                    txRate: smoothTx,
                    rxPackets: iface.rxPackets,
                    txPackets: iface.txPackets,
                    rxErrors: iface.rxErrors,
                    txErrors: iface.txErrors,
                    isActive
                };

                totalRxRate += smoothRx;
                totalTxRate += smoothTx;
                totalRxBytes += iface.rxBytes;
                totalTxBytes += iface.txBytes;
            }

            this._interfaces = result;
            this._prevData = parsed.reduce((acc, iface) => {
                acc[iface.name] = iface;
                return acc;
            }, {});
            this._prevTime = now;

            return {
                interfaces: result,
                totalRxRate,
                totalTxRate,
                totalRxBytes,
                totalTxBytes,
                timestamp: now
            };
        } catch (e) {
            error('Interface monitor sample failed', e);
            return null;
        }
    }

    destroy() {
        this._prevData = null;
        this._prevTime = null;
        this._interfaces = {};
        this._sessionTotals = {};
        this._rateHistory = {};
    }
}
