import { withoutUndefined } from '../../src/utils/withoutUndefined';

describe('withoutUndefined', () => {
    test('drops undefined at every depth, in objects and in arrays, but keeps null, empty strings, zero and false', () => {
        expect(withoutUndefined({ a: undefined, b: null, c: '', d: 0, e: false, f: [{ g: undefined, h: 1 }, undefined] }))
            .toEqual({ b: null, c: '', d: 0, e: false, f: [{ h: 1 }, undefined] });
    });

    test('leaves a Date, or any other object that is not plain, exactly as it is', () => {
        const date = new Date(5);
        class Sentinel { constructor() { this.value = undefined; } }
        const sentinel = new Sentinel();
        const result = withoutUndefined({ when: date, marker: sentinel });
        expect(result.when).toBe(date);
        expect(result.marker).toBe(sentinel);
    });

    test('returns primitives as they are', () => {
        expect(withoutUndefined(5)).toBe(5);
        expect(withoutUndefined(null)).toBeNull();
        expect(withoutUndefined(undefined)).toBeUndefined();
    });
});
