import {
    DEFAULT_SETTINGS, READING_FONTS, STORAGE_KEY, TEXT_SCALES, TOGGLES,
    applyAccessibility, cacheSettings, ensureFontLoaded, isDefaultSettings, loadCachedSettings, normalizeSettings, prefersReducedMotion,
} from '../../src/utils/accessibility';


afterEach(() => {
    document.head.querySelectorAll('link[data-a11y-font]').forEach(link => link.remove());
    window.localStorage.clear();
});

describe('normalizeSettings', () => {
    test('nothing, or junk, means the defaults', () => {
        [undefined, null, 'x', 5, []].forEach(raw => expect(normalizeSettings(raw)).toEqual(DEFAULT_SETTINGS));
    });

    test('keeps every valid value', () => {
        const settings = { textScale: 1.5, font: 'lexend', spacing: true, plainText: true, contrast: true, reduceMotion: true };
        expect(normalizeSettings(settings)).toEqual(settings);
    });

    test('an unknown text size or font falls back to the default for just that setting', () => {
        expect(normalizeSettings({ textScale: 3, font: 'comic', spacing: true })).toEqual({ ...DEFAULT_SETTINGS, spacing: true });
    });

    test('a toggle only counts when it is literally true', () => {
        expect(normalizeSettings({ spacing: 'yes', contrast: 1, plainText: 'true' })).toEqual(DEFAULT_SETTINGS);
    });

    test('the default is 100% text, the default font, everything off', () => {
        expect(DEFAULT_SETTINGS).toEqual({ textScale: 1, font: 'default', spacing: false, plainText: false, contrast: false, reduceMotion: false });
        expect(TEXT_SCALES[0].value).toBe(1);
    });
});

describe('isDefaultSettings', () => {
    test('true only when nothing has been changed', () => {
        expect(isDefaultSettings(DEFAULT_SETTINGS)).toBe(true);
        expect(isDefaultSettings(undefined)).toBe(true);
        expect(isDefaultSettings({ ...DEFAULT_SETTINGS, contrast: true })).toBe(false);
        expect(isDefaultSettings({ ...DEFAULT_SETTINGS, textScale: 1.25 })).toBe(false);
    });
});

describe('applyAccessibility', () => {
    test('the defaults leave <html> completely untouched (a player who never opens the settings sees no change)', () => {
        const root = document.documentElement;
        applyAccessibility(DEFAULT_SETTINGS, root);
        expect(root.style.getPropertyValue('--jnj-text-scale')).toBe('');
        expect(root.style.getPropertyValue('--jnj-a11y-font')).toBe('');
        expect(root.hasAttribute('data-a11y-font')).toBe(false);
        TOGGLES.forEach(toggle => expect(root.classList.contains(toggle.className)).toBe(false));
        expect(root.classList.contains('A11y-text-adapt')).toBe(false);
        expect(document.head.querySelector('link[data-a11y-font]')).toBeNull();
    });

    test.each([
        ['a larger text size', { textScale: 1.25 }],
        ['a different font', { font: 'lexend' }],
        ['roomier spacing', { spacing: true }],
    ])('%s puts the page in text-adapt mode; the other settings do not', (_name, change) => {
        const root = document.documentElement;
        applyAccessibility({ ...DEFAULT_SETTINGS, ...change }, root);
        expect(root.classList.contains('A11y-text-adapt')).toBe(true);

        applyAccessibility({ ...DEFAULT_SETTINGS, contrast: true, plainText: true, reduceMotion: true }, root);
        expect(root.classList.contains('A11y-text-adapt')).toBe(false);
        applyAccessibility(DEFAULT_SETTINGS, root);
    });

    test('sets the text scale, the font, and a class for each toggle that is on', () => {
        const root = document.documentElement;
        applyAccessibility({ textScale: 1.5, font: 'atkinson', spacing: true, plainText: false, contrast: true, reduceMotion: false }, root);

        expect(root.style.getPropertyValue('--jnj-text-scale')).toBe('1.5');
        expect(root.getAttribute('data-a11y-font')).toBe('atkinson');
        expect(root.style.getPropertyValue('--jnj-a11y-font')).toContain('Atkinson Hyperlegible');
        expect(root.classList.contains('A11y-spacing')).toBe(true);
        expect(root.classList.contains('A11y-contrast')).toBe(true);
        expect(root.classList.contains('A11y-plain-text')).toBe(false);
        expect(root.classList.contains('A11y-reduce-motion')).toBe(false);

        applyAccessibility(DEFAULT_SETTINGS, root);
    });

    test('changing a setting back removes exactly what it added', () => {
        const root = document.documentElement;
        applyAccessibility({ ...DEFAULT_SETTINGS, textScale: 2, font: 'lexend', plainText: true }, root);

        applyAccessibility(DEFAULT_SETTINGS, root);

        expect(root.style.getPropertyValue('--jnj-text-scale')).toBe('');
        expect(root.hasAttribute('data-a11y-font')).toBe(false);
        expect(root.style.getPropertyValue('--jnj-a11y-font')).toBe('');
        expect(root.classList.contains('A11y-plain-text')).toBe(false);
    });

    test('garbage is applied as the defaults rather than throwing', () => {
        const root = document.documentElement;
        expect(() => applyAccessibility({ textScale: 'huge', font: 'nope' }, root)).not.toThrow();
        expect(root.style.getPropertyValue('--jnj-text-scale')).toBe('');
    });

    test('choosing a font loads its stylesheet, once', () => {
        const root = document.documentElement;
        applyAccessibility({ ...DEFAULT_SETTINGS, font: 'lexend' }, root);
        applyAccessibility({ ...DEFAULT_SETTINGS, font: 'lexend', spacing: true }, root);

        const links = document.head.querySelectorAll('link[data-a11y-font="lexend"]');
        expect(links).toHaveLength(1);
        expect(links[0].getAttribute('href')).toContain('family=Lexend');
        applyAccessibility(DEFAULT_SETTINGS, root);
    });
});

describe('ensureFontLoaded', () => {
    test('the default font has nothing to load, and an unknown key is ignored', () => {
        ensureFontLoaded('default');
        ensureFontLoaded('nope');
        expect(document.head.querySelector('link[data-a11y-font]')).toBeNull();
    });

    test('every non-default font has a stylesheet and a stack that ends in a generic family', () => {
        READING_FONTS.filter(font => font.key !== 'default').forEach(font => {
            expect(font.stylesheet).toMatch(/^https:\/\//);
            expect(font.family).toMatch(/sans-serif$/);
        });
    });
});

describe('device cache', () => {
    test('round-trips settings through localStorage', () => {
        cacheSettings({ ...DEFAULT_SETTINGS, textScale: 1.25, contrast: true });
        expect(loadCachedSettings()).toEqual({ ...DEFAULT_SETTINGS, textScale: 1.25, contrast: true });
        expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).textScale).toBe(1.25);
    });

    test('nothing stored, or something corrupt, loads as the defaults', () => {
        expect(loadCachedSettings()).toEqual(DEFAULT_SETTINGS);
        window.localStorage.setItem(STORAGE_KEY, '{not json');
        expect(loadCachedSettings()).toEqual(DEFAULT_SETTINGS);
    });

    test('blocked storage (private mode) never throws', () => {
        const blocked = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
        expect(loadCachedSettings(blocked)).toEqual(DEFAULT_SETTINGS);
        expect(() => cacheSettings(DEFAULT_SETTINGS, blocked)).not.toThrow();
    });
});

describe('prefersReducedMotion', () => {
    afterEach(() => { delete window.matchMedia; document.documentElement.classList.remove('A11y-reduce-motion'); });

    test('is on when the account setting is on', () => {
        window.matchMedia = () => ({ matches: false });
        document.documentElement.classList.add('A11y-reduce-motion');
        expect(prefersReducedMotion()).toBe(true);
    });

    test("is on when the operating system asks for it, even with the account setting off", () => {
        window.matchMedia = query => ({ matches: query === '(prefers-reduced-motion: reduce)' });
        expect(prefersReducedMotion()).toBe(true);
    });

    test('is off otherwise', () => {
        window.matchMedia = () => ({ matches: false });
        expect(prefersReducedMotion()).toBe(false);
    });
});
