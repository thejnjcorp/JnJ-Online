import {
    MAX_ITEM_DESCRIPTION, MAX_ITEM_NAME, MAX_ITEM_TAGS, MAX_TAG_LENGTH,
    itemDocFields, itemMatches, newItem, normalizeTags, sortItems, tagsOf, validateItem,
} from '../../src/utils/items';

describe('newItem', () => {
    test('is a private, empty item with no picture and no tags', () => {
        expect(newItem()).toEqual({ item_name: '', item_description: '', item_image: '', tags: [], isPublic: false });
    });
});

describe('normalizeTags', () => {
    test('trims, single-spaces and lower-cases each tag, so "Weapon" and " weapon " are one', () => {
        expect(normalizeTags(['Weapon', ' weapon ', 'Two   Handed'])).toEqual(['weapon', 'two handed']);
    });

    test('drops blanks and things that are not text', () => {
        expect(normalizeTags(['', '   ', null, 5, {}, 'rope'])).toEqual(['rope']);
    });

    test('keeps each tag short and an item to a few', () => {
        const long = 'x'.repeat(MAX_TAG_LENGTH + 10);
        expect(normalizeTags([long])[0]).toHaveLength(MAX_TAG_LENGTH);
        const many = Array.from({ length: MAX_ITEM_TAGS + 5 }, (_, i) => `tag${i}`);
        expect(normalizeTags(many)).toHaveLength(MAX_ITEM_TAGS);
    });

    test('is empty for anything that is not a list', () => {
        expect(normalizeTags(undefined)).toEqual([]);
        expect(normalizeTags('weapon')).toEqual([]);
    });
});

describe('validateItem', () => {
    const good = { ...newItem(), item_name: 'Torch' };

    test('an item with a name is fine', () => {
        expect(validateItem(good)).toEqual({ fields: {}, problems: [], valid: true });
    });

    test('a name is required, and kept short', () => {
        expect(validateItem({ ...good, item_name: '   ' }).fields.item_name).toBe('Give the item a name.');
        expect(validateItem({ ...good, item_name: undefined }).valid).toBe(false);
        expect(validateItem({ ...good, item_name: 'x'.repeat(MAX_ITEM_NAME + 1) }).fields.item_name).toMatch(/60 characters/);
    });

    test('the description has a limit, so an item stays a sensible size', () => {
        expect(validateItem({ ...good, item_description: 'x'.repeat(MAX_ITEM_DESCRIPTION + 1) }).fields.item_description).toMatch(/4000/);
        expect(validateItem({ ...good, item_description: 'x'.repeat(MAX_ITEM_DESCRIPTION) }).valid).toBe(true);
    });

    test('a picture is nothing, a web link or an Imgur hash - and nothing else', () => {
        ['', 'https://example.com/a.png', 'AbC1d2E.png'].forEach(item_image => expect(validateItem({ ...good, item_image }).valid).toBe(true));
        const bad = validateItem({ ...good, item_image: 'javascript:alert(1)' });
        expect(bad.fields.item_image).toMatch(/web link to a picture/);
        expect(bad.problems).toEqual([{ id: 'field-item_image', label: 'Picture', message: bad.fields.item_image }]);
    });

    test('a tag that is too long is explained', () => {
        expect(validateItem({ ...good, tags: ['x'.repeat(MAX_TAG_LENGTH + 1)] }).fields.tags).toMatch(/24 characters/);
    });

    test('lists every problem, in page order', () => {
        const result = validateItem({ ...good, item_name: '', item_image: 'nope' });
        expect(result.problems.map(p => p.id)).toEqual(['field-item_name', 'field-item_image']);
        expect(result.valid).toBe(false);
    });
});

describe('itemDocFields', () => {
    test('saves the trimmed name, the description, a normalized picture and tidy tags', () => {
        expect(itemDocFields({ item_name: '  Torch ', item_description: 'Burns.', item_image: 'https://i.imgur.com/AbC1d2E.png', tags: ['Light', 'light', ' Fire '], isPublic: true }))
            .toEqual({ item_name: 'Torch', item_description: 'Burns.', item_image: 'AbC1d2E.png', tags: ['light', 'fire'], isPublic: true });
    });

    test('never saves undefined, which Firestore refuses', () => {
        const saved = itemDocFields({});
        expect(saved).toEqual({ item_name: '', item_description: '', item_image: '', tags: [], isPublic: false });
        Object.values(saved).forEach(value => expect(value).not.toBeUndefined());
    });

    test('does not carry the permission fields, which the page sets', () => {
        expect(itemDocFields({ item_name: 'X', canWrite: ['a'], admins: ['a'], canRead: ['a'] })).not.toHaveProperty('canWrite');
    });
});

describe('searching', () => {
    const torch = { item_name: 'Torch', item_description: 'Burns for an hour.', tags: ['light', 'tool'] };
    const rope = { item_name: 'Rope', item_description: '50 feet of hemp.', tags: ['tool'] };

    test('matches the name or the description, ignoring case', () => {
        expect(itemMatches(torch, 'TORCH')).toBe(true);
        expect(itemMatches(torch, 'an hour')).toBe(true);
        expect(itemMatches(rope, 'torch')).toBe(false);
    });

    test('with nothing typed, everything matches', () => {
        expect(itemMatches(torch, '')).toBe(true);
        expect(itemMatches(torch, '   ')).toBe(true);
    });

    test('a tag filter needs the tag, and combines with the search', () => {
        expect(itemMatches(torch, '', 'light')).toBe(true);
        expect(itemMatches(rope, '', 'light')).toBe(false);
        expect(itemMatches(torch, 'rope', 'light')).toBe(false);
    });

    test('copes with an item with no tags or description', () => {
        expect(itemMatches({ item_name: 'Bare' }, 'bare')).toBe(true);
        expect(itemMatches({ item_name: 'Bare' }, '', 'x')).toBe(false);
    });

    test('tagsOf lists every tag once, alphabetically', () => {
        expect(tagsOf([torch, rope, { item_name: 'X' }])).toEqual(['light', 'tool']);
    });

    test('sortItems orders by name and leaves the list alone', () => {
        const list = [rope, torch];
        expect(sortItems(list).map(i => i.item_name)).toEqual(['Rope', 'Torch']);
        expect(list[0]).toBe(rope);
    });
});
