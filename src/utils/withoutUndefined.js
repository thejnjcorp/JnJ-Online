// Firestore refuses `undefined` anywhere in a document - at any depth, in an object or an array
// - and says so only when the write is attempted. This returns the value with every undefined
// dropped (null, empty strings and other values stay), leaving anything that isn't a plain
// object or array - a Date, a server timestamp - exactly as it is.
export function withoutUndefined(value) {
    if (Array.isArray(value)) return value.map(withoutUndefined);
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
        return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).map(([key, entry]) => [key, withoutUndefined(entry)]));
    }
    return value;
}
