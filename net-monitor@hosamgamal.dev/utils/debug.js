let debugEnabled = false;
const logHistory = [];
const MAX_LOG_HISTORY = 1000;

export function setDebugEnabled(enabled) {
    debugEnabled = enabled;
}

export function isDebugEnabled() {
    return debugEnabled;
}

export function log(level, ...args) {
    const timestamp = new Date().toISOString();
    const parts = args.map(a => {
        if (a instanceof Error || (a && a.message !== undefined && a.stack !== undefined)) {
            return `${a.name || 'Error'}: ${a.message}` + (a.stack ? `\n${a.stack}` : '');
        }
        if (typeof a === 'object' && a !== null) {
            try { return JSON.stringify(a); } catch { return String(a); }
        }
        return String(a);
    });
    const message = parts.join(' ');

    const entry = { timestamp, level, message };
    logHistory.push(entry);

    if (logHistory.length > MAX_LOG_HISTORY) {
        logHistory.shift();
    }

    if (debugEnabled || level === 'error') {
        const prefix = `[NetMonitor][${level.toUpperCase()}]`;
        if (level === 'error') {
            console.error(`${prefix} ${message}`);
        } else {
            console.log(`${prefix} ${message}`);
        }
    }
}

export function debug(...args) {
    log('debug', ...args);
}

export function info(...args) {
    log('info', ...args);
}

export function warn(...args) {
    log('warn', ...args);
}

export function error(...args) {
    log('error', ...args);
}

export function getLogHistory() {
    return logHistory.slice();
}

export function clearLogHistory() {
    logHistory.length = 0;
}

export function getDiagnostics(state) {
    return {
        extensionVersion: 1,
        shellVersion: '46',
        debugEnabled,
        activeInterfaces: state?.interfaces || [],
        sampleInterval: state?.interval || 1000,
        databaseStatus: state?.dbStatus || 'unknown',
        helperStatus: state?.helperStatus || 'none',
        lastMonitorError: state?.lastError || null,
        logCount: logHistory.length
    };
}
