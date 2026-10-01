import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { decodeUtf8 } from './text.js';

export class ProcfsError extends Error {
    constructor(message, cause = null) {
        super(message);
        this.name = 'ProcfsError';
        this.cause = cause;
    }
}

export function readFile(path) {
    try {
        const file = Gio.File.new_for_path(path);
        const [success, contents] = file.load_contents(null);
        if (!success) {
            throw new ProcfsError(`Failed to read ${path}`);
        }
        return decodeUtf8(contents);
    } catch (e) {
        throw new ProcfsError(`Failed to read ${path}`, e);
    }
}

export function readDir(path) {
    try {
        const file = Gio.File.new_for_path(path);
        const enumerator = file.enumerate_children(
            'standard::name',
            Gio.FileQueryInfoFlags.NONE,
            null
        );
        const entries = [];
        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            entries.push(info.get_name());
        }
        enumerator.close(null);
        return entries;
    } catch (e) {
        throw new ProcfsError(`Failed to read directory ${path}`, e);
    }
}

export function fileExists(path) {
    return GLib.file_test(path, GLib.FileTest.EXISTS);
}

export function pidList() {
    const entries = readDir('/proc');
    return entries
        .filter(e => /^\d+$/.test(e))
        .map(e => parseInt(e, 10));
}

export function pidCmdline(pid) {
    try {
        const content = readFile(`/proc/${pid}/cmdline`);
        return content.split('\0').filter(s => s.length > 0);
    } catch (e) {
        return [];
    }
}

export function pidComm(pid) {
    try {
        return readFile(`/proc/${pid}/comm`).trim();
    } catch (e) {
        return null;
    }
}

export function pidStatus(pid) {
    try {
        const content = readFile(`/proc/${pid}/status`);
        const result = {};
        for (const line of content.split('\n')) {
            const colon = line.indexOf(':');
            if (colon > 0) {
                const key = line.substring(0, colon).trim();
                const value = line.substring(colon + 1).trim();
                result[key] = value;
            }
        }
        return result;
    } catch (e) {
        return null;
    }
}

export function pidFds(pid) {
    try {
        return readDir(`/proc/${pid}/fd`);
    } catch (e) {
        return [];
    }
}

export function readNetDev() {
    return readFile('/proc/net/dev');
}

export function readNetTcp() {
    return readFile('/proc/net/tcp');
}

export function readNetTcp6() {
    try {
        return readFile('/proc/net/tcp6');
    } catch (e) {
        return null;
    }
}
