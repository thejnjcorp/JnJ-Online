import { keyed } from '../../src/utils/keyed';

describe('keyed', () => {
    test('pairs each item with its position and a key made from the prefix and the position', () => {
        expect(keyed(['a', 'b'], 'row')).toEqual([{ item: 'a', index: 0, key: 'row-0' }, { item: 'b', index: 1, key: 'row-1' }]);
    });

    test('uses a default prefix, and an empty list stays empty', () => {
        expect(keyed(['x'])[0].key).toBe('item-0');
        expect(keyed([])).toEqual([]);
    });
});
