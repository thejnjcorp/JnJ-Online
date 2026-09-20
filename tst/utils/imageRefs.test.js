import { IMGUR_HOST, MAX_IMAGE_URL_LENGTH, imageRef, imageSrc, isImageRef, isImgurRef, isWebUrl } from '../../src/utils/imageRefs';

describe('isWebUrl', () => {
    test('accepts web links', () => {
        expect(isWebUrl('https://example.com/tree.jpg')).toBe(true);
        expect(isWebUrl('http://example.com/tree.jpg')).toBe(true);
    });

    test('nothing else can become an image source', () => {
        ['javascript:alert(1)', 'data:image/png;base64,AAAA', 'ftp://example.com/a.png', 'not a link', '', '   ', null, undefined, 42].forEach(value => {
            expect(isWebUrl(value)).toBe(false);
        });
    });

    test('a link that is too long is refused', () => {
        expect(isWebUrl(`https://example.com/${'a'.repeat(MAX_IMAGE_URL_LENGTH)}`)).toBe(false);
    });
});

describe('isImgurRef', () => {
    test('is a hash and an extension', () => {
        ['AbC1d2E.png', 'x9Yq3.gif', 'AbC1d2E.jpeg', 'AbC1d2E.webp'].forEach(value => expect(isImgurRef(value)).toBe(true));
    });

    test('is nothing else: no extension, a path, a link, or something too short or odd', () => {
        ['AbC1d2E', 'abc.png', 'AbC1d2E.', '../AbC1d2E.png', 'a/b.png', 'AbC 1d2E.png', 'AbC1d2E.png?x=1', 'https://i.imgur.com/AbC1d2E.png', '', null, 5].forEach(value => {
            expect(isImgurRef(value)).toBe(false);
        });
    });
});

describe('isImageRef', () => {
    test('is a hash or a web link', () => {
        expect(isImageRef('AbC1d2E.png')).toBe(true);
        expect(isImageRef('https://example.com/a.png')).toBe(true);
        expect(isImageRef('javascript:alert(1)')).toBe(false);
        expect(isImageRef('nothing')).toBe(false);
    });
});

describe('imageRef: what gets stored for whatever was typed, pasted or uploaded', () => {
    test('an Imgur link becomes just its hash and extension', () => {
        expect(imageRef('https://i.imgur.com/AbC1d2E.png')).toBe('AbC1d2E.png');
        expect(imageRef('http://i.imgur.com/AbC1d2E.gif')).toBe('AbC1d2E.gif');
        expect(imageRef('https://imgur.com/AbC1d2E.jpg')).toBe('AbC1d2E.jpg');
    });

    test('the extension is kept, since an animated fire is a gif and a png would be a still', () => {
        expect(imageRef('https://i.imgur.com/AbC1d2E.gif')).toMatch(/\.gif$/);
    });

    test('a bare hash is kept', () => {
        expect(imageRef('AbC1d2E.png')).toBe('AbC1d2E.png');
    });

    test('a link from anywhere else stays a link', () => {
        expect(imageRef('https://example.com/fire.png')).toBe('https://example.com/fire.png');
    });

    test('whitespace around it is dropped', () => {
        expect(imageRef('  https://i.imgur.com/AbC1d2E.png \n')).toBe('AbC1d2E.png');
        expect(imageRef(' https://example.com/fire.png ')).toBe('https://example.com/fire.png');
    });

    test('an Imgur page (with no picture extension) is not treated as a picture of its own', () => {
        expect(imageRef('https://imgur.com/gallery/AbC1d2E')).toBe('https://imgur.com/gallery/AbC1d2E'); // a web link, which will not load as an image
        expect(imageRef('https://i.imgur.com/AbC1d2E')).toBe('https://i.imgur.com/AbC1d2E');
    });

    test('anything that is not a picture is null', () => {
        ['', '   ', 'javascript:alert(1)', 'just some words', null, undefined, 3].forEach(value => expect(imageRef(value)).toBeNull());
    });
});

describe('imageSrc', () => {
    test('a hash is loaded from Imgur', () => {
        expect(imageSrc('AbC1d2E.png')).toBe('https://i.imgur.com/AbC1d2E.png');
        expect(IMGUR_HOST).toBe('https://i.imgur.com/');
    });

    test('a web link is loaded as it is', () => {
        expect(imageSrc('https://example.com/a.png')).toBe('https://example.com/a.png');
    });

    test('a ref and the link it came from load the same picture', () => {
        const link = 'https://i.imgur.com/AbC1d2E.png';
        expect(imageSrc(imageRef(link))).toBe(link);
    });
});
