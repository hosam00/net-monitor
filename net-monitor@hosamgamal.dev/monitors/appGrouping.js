const BROWSER_PATTERNS = {
    firefox: [
        'firefox', 'geckoprocess', 'webcontent', 'web', 'privilegedabout',
        'socketprocess', 'rddprocess', 'gpuprocess', 'utilityprocess',
        'plugin-container'
    ],
    chromium: [
        'chrome', 'chromium', 'chromium-browser', 'chrome-child',
        'chrome-typ', 'nacl_helper', 'nacl_loader'
    ]
};

export function guessAppName(comm, cmdline) {
    const browser = detectBrowserFamily(comm, cmdline);
    if (browser) {
        return browser === 'firefox' ? 'Firefox' : 'Chrome/Chromium';
    }

    if (cmdline && cmdline.length > 0) {
        const parts = cmdline[0].split('/');
        return parts[parts.length - 1];
    }

    return comm;
}

function detectBrowserFamily(comm, cmdline) {
    const lower = (comm + ' ' + cmdline).toLowerCase();

    for (const [family, patterns] of Object.entries(BROWSER_PATTERNS)) {
        for (const pattern of patterns) {
            if (lower.includes(pattern)) {
                return family;
            }
        }
    }

    return null;
}

export function groupProcesses(processMap, mode) {
    const groups = {};

    for (const [pid, proc] of Object.entries(processMap)) {
        let groupKey;

        if (mode === 'disabled') {
            groupKey = proc.comm;
        } else if (mode === 'smart') {
            groupKey = guessAppName(proc.comm, proc.cmdline);
        } else {
            groupKey = guessAppName(proc.comm, proc.cmdline);
            const lower = proc.comm.toLowerCase();
            if (['node', 'npm', 'yarn', 'npx', 'electron'].includes(lower)) {
                groupKey = 'Development Tools';
            } else if (['apt', 'apt-get', 'dpkg', 'snapd', 'flatpak', 'packagekitd'].includes(lower)) {
                groupKey = 'Package Manager';
            }
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
        g.processes.push(parseInt(pid, 10));
        g.rxRate += proc.rxRate || 0;
        g.txRate += proc.txRate || 0;
        g.sessionRx += proc.sessionRx || 0;
        g.sessionTx += proc.sessionTx || 0;
        g.count++;
    }

    return groups;
}

export function findTopGroups(groups, topN = 8) {
    return Object.values(groups)
        .sort((a, b) => (b.rxRate + b.txRate) - (a.rxRate + a.txRate))
        .slice(0, topN);
}
