import GLib from 'gi://GLib';

export function now() {
    return GLib.DateTime.new_now_local();
}

export function nowUnix() {
    return GLib.get_real_time() / 1000000;
}

export function nowMillis() {
    return GLib.get_real_time() / 1000;
}

export function formatTimestamp(dt, format = '%Y-%m-%d %H:%M:%S') {
    if (typeof dt === 'object' && dt.format) {
        return dt.format(format);
    }
    const d = new Date(dt);
    const pad = n => String(n).padStart(2, '0');
    const map = {
        '%Y': d.getFullYear(),
        '%m': pad(d.getMonth() + 1),
        '%d': pad(d.getDate()),
        '%H': pad(d.getHours()),
        '%M': pad(d.getMinutes()),
        '%S': pad(d.getSeconds()),
    };
    let result = format;
    for (const [key, val] of Object.entries(map)) {
        result = result.replace(key, val);
    }
    return result;
}

export function formatDate(dt) {
    return formatTimestamp(dt, '%Y-%m-%d');
}

export function formatTime(dt) {
    return formatTimestamp(dt, '%H:%M:%S');
}

export function isInQuietHours(startStr, endStr) {
    const dt = now();
    const currentMinutes = dt.get_hour() * 60 + dt.get_minute();

    const startParts = startStr.split(':').map(Number);
    const endParts = endStr.split(':').map(Number);

    const startMinutes = startParts[0] * 60 + startParts[1];
    const endMinutes = endParts[0] * 60 + endParts[1];

    if (startMinutes <= endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
}
