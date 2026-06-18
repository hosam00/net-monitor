export function formatRate(bytesPerSec, mode = 'auto', precision = 1) {
    if (bytesPerSec === 0) {
        return mode === 'bits' ? '0 b/s' : '0 B/s';
    }

    let value = bytesPerSec;
    let suffix = 'B/s';

    if (mode === 'bits') {
        value = bytesPerSec * 8;
        suffix = 'b/s';
    }

    const units = mode === 'bits'
        ? ['b/s', 'Kb/s', 'Mb/s', 'Gb/s', 'Tb/s']
        : ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s'];

    const divisor = 1000;
    let unitIndex = 0;

    while (value >= divisor && unitIndex < units.length - 1) {
        value /= divisor;
        unitIndex++;
    }

    return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

export function formatBytes(bytes, precision = 1) {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const divisor = 1000;
    let value = bytes;
    let unitIndex = 0;

    while (value >= divisor && unitIndex < units.length - 1) {
        value /= divisor;
        unitIndex++;
    }

    return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

export function formatCompact(bytesPerSec) {
    if (bytesPerSec === 0) return '0';

    const units = ['', 'K', 'M', 'G', 'T'];
    const divisor = 1000;
    let value = bytesPerSec;
    let unitIndex = 0;

    while (value >= divisor && unitIndex < units.length - 1) {
        value /= divisor;
        unitIndex++;
    }

    return `${value.toFixed(1)}${units[unitIndex]}`;
}
