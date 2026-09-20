import {
    COPY_OFFSET, DEFAULT_IMAGE_TOKEN_SIZE, IMAGE_TOKEN_SIZES, MAX_IMAGE_URL_LENGTH, MAX_LABEL_LENGTH,
    clampToMap, copyImageToken, isImageUrl, moveImageToken, newImageToken, removeImageToken, resizeImageToken, validImageTokens,
} from '../../src/utils/mapImageTokens';

const token = (id, extra = {}) => ({ id, image: 'https://example.com/fire.png', label: 'Fire', x: 0.3, y: 0.2, size: 0.07, ...extra });

describe('isImageUrl', () => {
    test('accepts web links', () => {
        expect(isImageUrl('https://i.imgur.com/abc.png')).toBe(true);
        expect(isImageUrl('http://example.com/tree.jpg')).toBe(true);
    });

    test('nothing else can become an image source', () => {
        ['javascript:alert(1)', 'data:image/png;base64,AAAA', 'ftp://example.com/a.png', 'not a link', '', '   ', null, undefined, 42].forEach(value => {
            expect(isImageUrl(value)).toBe(false);
        });
    });

    test('a link that is too long is refused', () => {
        expect(isImageUrl(`https://example.com/${'a'.repeat(MAX_IMAGE_URL_LENGTH)}`)).toBe(false);
    });
});

describe('validImageTokens', () => {
    test('keeps well-formed tokens', () => {
        const tokens = [token('a'), token('b')];
        expect(validImageTokens(tokens)).toEqual(tokens);
    });

    test('leaves out anything not shaped like one, rather than breaking the map', () => {
        const good = token('a');
        const result = validImageTokens([
            good, null, 'x', {}, token(1), token('b', { image: 'javascript:alert(1)' }), token('c', { x: 'left' }), token('d', { y: NaN }),
            token('e', { size: 0 }), token('f', { size: -1 }), token('g', { size: undefined }),
        ]);
        expect(result).toEqual([good]);
    });

    test('is empty when the map has none, or the field is not a list', () => {
        expect(validImageTokens(undefined)).toEqual([]);
        expect(validImageTokens(null)).toEqual([]);
        expect(validImageTokens({ a: 1 })).toEqual([]);
    });
});

describe('clampToMap', () => {
    test('keeps a point on the map, its centre allowed to reach the edge', () => {
        expect(clampToMap({ x: 0.4, y: 0.2 }, 0.5)).toEqual({ x: 0.4, y: 0.2 });
        expect(clampToMap({ x: -1, y: -1 }, 0.5)).toEqual({ x: 0, y: 0 });
        expect(clampToMap({ x: 2, y: 2 }, 0.5)).toEqual({ x: 1, y: 0.5 });
    });

    test('rounds to the four places that are saved', () => {
        expect(clampToMap({ x: 0.123456, y: 0.234567 }, 0.5)).toEqual({ x: 0.1235, y: 0.2346 });
    });
});

describe('newImageToken', () => {
    test('is given an id of its own, and is put where it is asked', () => {
        const a = newImageToken({ image: 'https://example.com/a.png' }, { x: 0.5, y: 0.25 });
        const b = newImageToken({ image: 'https://example.com/a.png' }, { x: 0.5, y: 0.25 });
        expect(a).toMatchObject({ image: 'https://example.com/a.png', x: 0.5, y: 0.25 });
        expect(a.id).toEqual(expect.any(String));
        expect(a.id).not.toBe(b.id);
    });

    test('is medium and unnamed unless told otherwise', () => {
        expect(newImageToken({ image: 'https://example.com/a.png' }, { x: 0, y: 0 })).toMatchObject({ size: DEFAULT_IMAGE_TOKEN_SIZE, label: '' });
        expect(DEFAULT_IMAGE_TOKEN_SIZE).toBe(IMAGE_TOKEN_SIZES.find(size => size.key === 'medium').value);
    });

    test('trims the link and the name, and keeps the name short', () => {
        const made = newImageToken({ image: '  https://example.com/a.png ', label: `  ${'x'.repeat(MAX_LABEL_LENGTH + 20)} `, size: 0.2 }, { x: 0, y: 0 });
        expect(made.image).toBe('https://example.com/a.png');
        expect(made.label).toBe('x'.repeat(MAX_LABEL_LENGTH));
        expect(made.size).toBe(0.2);
    });
});

describe('editing the list', () => {
    const list = () => [token('a'), token('b', { x: 0.6 })];

    test('moving changes only that token, and keeps it on the map', () => {
        const moved = moveImageToken(list(), 'a', { x: 0.9, y: 0.4 }, 0.5);
        expect(moved[0]).toMatchObject({ id: 'a', x: 0.9, y: 0.4, size: 0.07, label: 'Fire' });
        expect(moved[1]).toEqual(list()[1]);
        expect(moveImageToken(list(), 'a', { x: 5, y: 5 }, 0.5)[0]).toMatchObject({ x: 1, y: 0.5 });
    });

    test('resizing changes only that token\'s size', () => {
        const resized = resizeImageToken(list(), 'b', 0.2);
        expect(resized[1]).toEqual({ ...list()[1], size: 0.2 });
        expect(resized[0]).toEqual(list()[0]);
    });

    test('removing takes it out and leaves the rest in order', () => {
        expect(removeImageToken([token('a'), token('b'), token('c')], 'b').map(t => t.id)).toEqual(['a', 'c']);
    });

    test('none of them change what they are given', () => {
        const original = list();
        moveImageToken(original, 'a', { x: 0.9, y: 0.4 }, 0.5);
        resizeImageToken(original, 'a', 0.2);
        removeImageToken(original, 'a');
        copyImageToken(original, 'a', 0.5);
        expect(original).toEqual(list());
    });

    test('an id that is not there changes nothing', () => {
        expect(moveImageToken(list(), 'zzz', { x: 0.1, y: 0.1 }, 0.5)).toEqual(list());
        expect(removeImageToken(list(), 'zzz')).toEqual(list());
    });
});

describe('copyImageToken', () => {
    test('adds a copy a little way from the original, on top, with an id of its own', () => {
        const { tokens, id } = copyImageToken([token('a'), token('b', { x: 0.6 })], 'a', 0.5);
        expect(tokens).toHaveLength(3);
        expect(tokens[2]).toMatchObject({ id, image: 'https://example.com/fire.png', label: 'Fire', size: 0.07, x: 0.33, y: 0.23 });
        expect(COPY_OFFSET).toBe(0.03);
        expect(id).not.toBe('a');
        expect(tokens[0]).toEqual(token('a'));
    });

    test('a copy of one at the map\'s edge stays on the map', () => {
        const { tokens } = copyImageToken([token('a', { x: 1, y: 0.5 })], 'a', 0.5);
        expect(tokens[1]).toMatchObject({ x: 1, y: 0.5 });
    });

    test('there is nothing to copy for an id that is not there', () => {
        const before = [token('a')];
        expect(copyImageToken(before, 'zzz', 0.5)).toEqual({ tokens: before, id: null });
    });
});
