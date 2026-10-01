import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// Promise wrappers for Gio async calls whose GJS signatures do not match the
// introspection defaults. Verified against GJS on GNOME 50:
//
//   file.load_contents_async(cancellable, callback)              -> 2 args
//   file.replace_contents_async(bytes, etag, make_backup, flags,
//                                cancellable, callback)           -> 6 args, GBytes
//
// Both *_finish calls throw on failure, so the promise rejects from there.

export function loadContentsAsync(file) {
    return new Promise((resolve, reject) => {
        file.load_contents_async(null, (source, result) => {
            try {
                resolve(source.load_contents_finish(result));
            } catch (e) {
                reject(e);
            }
        });
    });
}

// replace_contents_async rejects a JS string outright, so callers must pass
// real GBytes (see encodeBytes below).
export function replaceContentsAsync(file, bytes) {
    return new Promise((resolve, reject) => {
        file.replace_contents_async(
            bytes,
            null,
            false,
            Gio.FileCreateFlags.NONE,
            null,
            (source, result) => {
                try {
                    resolve(source.replace_contents_finish(result));
                } catch (e) {
                    reject(e);
                }
            }
        );
    });
}

const encoder = new TextEncoder();

export function encodeBytes(text) {
    return new GLib.Bytes(encoder.encode(text));
}