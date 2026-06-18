import { pidList, pidComm, pidCmdline, pidFds, readNetTcp, readNetTcp6 } from '../utils/procfs.js';
import { parseTcpTable } from '../utils/parsing.js';
import { debug, error, warn } from '../utils/debug.js';

export class ProcessMonitor {
    constructor(settings) {
        this._settings = settings;
        this._enabled = true;
        this._processes = {};
        this._appGroups = {};
        this._decayMs = 5000;
        this._lastHeavyScan = 0;
        this._heavyScanIntervalMs = 5000;
        this._popupVisible = false;
        this._lastSampleTime = null;
    }

    setPopupVisible(visible) {
        this._popupVisible = visible;
    }

    setEnabled(enabled) {
        this._enabled = enabled;
    }

    get processes() {
        return this._processes;
    }

    get appGroups() {
        return this._appGroups;
    }

    sample(interfaceData) {
        if (!this._enabled) return null;

        try {
            const now = Date.now();
            const topCount = this._settings.get_int('top-process-count');

            const shouldHeavyScan = (now - this._lastHeavyScan) > this._heavyScanIntervalMs;

            if (shouldHeavyScan) {
                this._doHeavyScan(now);
                this._lastHeavyScan = now;
            }

            for (const [pid, data] of Object.entries(this._processes)) {
                if (now - data.lastSeen > this._decayMs) {
                    delete this._processes[pid];
                }
            }

            this._distributeBandwidth(interfaceData, now);

            const sorted = Object.values(this._processes)
                .sort((a, b) => (b.rxRate + b.txRate) - (a.rxRate + a.txRate));

            const groupingMode = this._settings.get_string('process-grouping-mode');
            if (groupingMode !== 'disabled') {
                this._buildAppGroups(groupingMode);
            }

            return {
                processes: this._processes,
                topProcesses: sorted.slice(0, topCount),
                totalProcesses: Object.keys(this._processes).length,
                timestamp: now
            };
        } catch (e) {
            error('Process monitor sample failed', e);
            return null;
        }
    }

    _doHeavyScan(now) {
        const ignored = this._settings.get_strv('ignored-processes');
        const allPids = pidList();

        // Only check a limited number of PIDs (skip kernel threads and short-lived)
        let checked = 0;
        const MAX_CHECK = 200;

        for (const pid of allPids) {
            if (checked >= MAX_CHECK) break;

            const comm = pidComm(pid);
            if (!comm) continue;
            if (ignored.includes(comm)) continue;
            if (comm.startsWith('k') && comm.endsWith('d')) continue;

            checked++;

            let cmdline = [];
            try { cmdline = pidCmdline(pid); } catch { }

            const existing = this._processes[pid];
            this._processes[pid] = {
                pid,
                comm,
                cmdline: cmdline.length > 0 ? cmdline[0] : comm,
                rxRate: existing?.rxRate || 0,
                txRate: existing?.txRate || 0,
                sessionRx: existing?.sessionRx || 0,
                sessionTx: existing?.sessionTx || 0,
                lastSeen: now,
                confidence: 'estimated'
            };
        }

        debug(`Heavy scan: checked ${checked} processes, total tracked: ${Object.keys(this._processes).length}`);
    }

    _distributeBandwidth(interfaceData, now) {
        const totalRx = interfaceData?.totalRxRate || 0;
        const totalTx = interfaceData?.totalTxRate || 0;
        const processCount = Object.keys(this._processes).length;

        if (processCount === 0) return;

        const perProcessRx = totalRx / processCount;
        const perProcessTx = totalTx / processCount;

        const dt = this._lastSampleTime ? (now - this._lastSampleTime) / 1000 : 1;

        for (const proc of Object.values(this._processes)) {
            proc.rxRate = perProcessRx;
            proc.txRate = perProcessTx;
            proc.sessionRx += perProcessRx * dt;
            proc.sessionTx += perProcessTx * dt;
        }

        this._lastSampleTime = now;
    }

    _buildAppGroups(mode) {
        const groups = {};

        for (const [pid, proc] of Object.entries(this._processes)) {
            let groupKey = proc.comm;

            if (mode === 'smart') {
                groupKey = this._smartGroupKey(proc);
            } else if (mode === 'aggressive') {
                groupKey = this._aggressiveGroupKey(proc);
            }

            if (!groups[groupKey]) {
                groups[groupKey] = {
                    name: groupKey,
                    processes: [],
                    rxRate: 0,
                    txRate: 0,
                    sessionRx: 0,
                    sessionTx: 0,
                    count: 0
                };
            }

            const g = groups[groupKey];
            g.processes.push(proc.pid);
            g.rxRate += proc.rxRate;
            g.txRate += proc.txRate;
            g.sessionRx += proc.sessionRx;
            g.sessionTx += proc.sessionTx;
            g.count++;
        }

        this._appGroups = groups;
    }

    _smartGroupKey(proc) {
        const comm = proc.comm.toLowerCase();
        const cmdline = proc.cmdline.toLowerCase();

        if (comm === 'firefox' || comm === 'geckoprocess' || comm === 'webcontent' ||
            comm === 'web' || comm === 'privilegedabout' || comm === 'socketprocess' ||
            comm === 'rddprocess' || comm === 'gpuprocess' || comm === 'utilityprocess') {
            return 'Firefox';
        }

        if (comm === 'chrome' || comm === 'chromium' || comm === 'chromium-browser' ||
            comm === 'chrome-child' || comm === 'chrome-typ' || cmdline.includes('chrome') ||
            cmdline.includes('chromium')) {
            return 'Chrome/Chromium';
        }

        if (cmdline.includes('electron') || comm.endsWith('electron')) {
            return 'Electron App';
        }

        if (comm.startsWith('flatpak-') || comm.startsWith('snap-')) {
            return comm.replace(/^(flatpak-|snap-)/, '');
        }

        return comm;
    }

    _aggressiveGroupKey(proc) {
        const key = this._smartGroupKey(proc);
        const comm = proc.comm.toLowerCase();
        if (key === 'Electron App' || ['node', 'npm', 'yarn', 'npx'].includes(comm)) {
            return 'Development Tools';
        }
        if (['apt', 'apt-get', 'dpkg', 'snapd', 'flatpak'].includes(comm)) {
            return 'Package Manager';
        }
        if (['sshd', 'ssh', 'mosh', 'telnet'].includes(comm)) {
            return 'SSH/Remote';
        }
        return key;
    }

    destroy() {
        this._processes = {};
        this._appGroups = {};
    }
}
