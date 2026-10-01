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

// All procfs access is asynchronous on purpose. Shell code runs on the main
// loop, and a heavy scan reads /proc/<pid>/comm and /proc/<pid>/cmdline for
// every tracked pid -- doing that synchronously freezes the whole desktop for
// the duration of the scan.

export function readFile(path) {
    return new Promise((resolve, reject) => {
        const file = Gio.File.new_for_path(path);
        // GJS overloads load_contents_async as (cancellable, callback).
        file.load_contents_async(null, (source, result) => {
            try {
                const [, contents] = source.load_contents_finish(result);
                resolve(decodeUtf8(contents));
            } catch (e) {
                reject(new ProcfsError(`Failed to read ${path}`, e));
            }
        });
    });
}

export function readDir(path) {
    return new Promise((resolve, reject) => {
        const file = Gio.File.new_for_path(path);
        const fail = cause => reject(new ProcfsError(`Failed to read directory ${path}`, cause));

        file.enumerate_children_async(
            'standard::name',
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            (source, result) => {
                let enumerator;
                try {
                    enumerator = source.enumerate_children_finish(result);
                } catch (e) {
                    fail(e);
                    return;
                }

                const entries = [];
                // GJS has no next_file_async; enumeration is batched through
                // next_files_async, which returns an empty array at the end.
                const step = () => {
                    enumerator.next_files_async(64, GLib.PRIORITY_DEFAULT, null, (en, res) => {
                        let infos;
                        try {
                            infos = en.next_files_finish(res);
                        } catch (e) {
                            fail(e);
                            return;
                        }

                        if (infos.length === 0) {
                            enumerator.close_async(GLib.PRIORITY_DEFAULT, null, (ce, cr) => {
                                try {
                                    ce.close_finish(cr);
                                } catch {
                                    // Nothing actionable; the entries are already collected.
                                }
                                resolve(entries);
                            });
                            return;
                        }

                        for (const info of infos) {
                            entries.push(info.get_name());
                        }
                        step();
                    });
                };
                step();
            }
        );
    });
}

export async function pidList() {
    const entries = await readDir('/proc');
    return entries
        .filter(e => /^\d+$/.test(e))
        .map(e => parseInt(e, 10));
}

export async function pidCmdline(pid) {
    try {
        const content = await readFile(`/proc/${pid}/cmdline`);
        return content.split('\0').filter(s => s.length > 0);
    } catch {
        return [];
    }
}

export async function pidComm(pid) {
    try {
        const content = await readFile(`/proc/${pid}/comm`);
        return content.trim();
    } catch {
        return null;
    }
}

export function readNetDev() {
    return readFile('/proc/net/dev');
}