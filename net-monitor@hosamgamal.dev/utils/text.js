const decoder = new TextDecoder();

/**
 * Decode the bytes returned by a Gio async file read into a string.
 *
 * Those bytes arrive as a Uint8Array, and Uint8Array.prototype.toString()
 * ignores encoding arguments entirely -- the `'utf-8'` argument is silently
 * discarded. GJS currently compensates by overriding that method to decode as
 * UTF-8, but it warns on every call that the override is going away, after
 * which the call returns comma-separated byte values ("123,34,...") and any
 * JSON.parse() of the result fails. Use TextDecoder instead.
 */
export function decodeUtf8(bytes) {
    return decoder.decode(bytes);
}