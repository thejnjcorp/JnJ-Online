// Account-level reading and vision settings. They're applied as a CSS custom
// property, a data attribute and a few classes on <html> (the same place the
// site theme lives), so every page picks them up without knowing about them:
// see styles/Accessibility.scss for what each one does.
//
// The defaults leave the site exactly as it was designed - applying them
// removes everything, so a player who never opens these settings is unaffected.

export const STORAGE_KEY = 'jnj-accessibility';

// Multiplies the root font size. Every font size in the stylesheets is in rem
// (or a token that is), so this scales all the text and nothing else.
export const TEXT_SCALES = [
    { value: 1, label: '100%' },
    { value: 1.25, label: '125%' },
    { value: 1.5, label: '150%' },
    { value: 2, label: '200%' },
];

// Fonts other than the default are only downloaded once someone picks (or
// previews) one - see ensureFontLoaded.
export const READING_FONTS = [
    { key: 'default', label: 'Default', family: null, stylesheet: null },
    {
        key: 'lexend', label: 'Lexend',
        family: "'Lexend', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        stylesheet: 'https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap',
    },
    {
        key: 'atkinson', label: 'Atkinson Hyperlegible',
        family: "'Atkinson Hyperlegible', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        stylesheet: 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap',
    },
    {
        key: 'opendyslexic', label: 'OpenDyslexic',
        family: "'OpenDyslexic', 'Comic Sans MS', 'Inter', sans-serif",
        stylesheet: 'https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic@5/index.css',
    },
];

export const TOGGLES = [
    { key: 'spacing', className: 'A11y-spacing', label: 'Roomier spacing', hint: 'More space between lines, letters and words.' },
    { key: 'plainText', className: 'A11y-plain-text', label: 'Plain text', hint: 'No ALL-CAPS labels and no italics.' },
    { key: 'contrast', className: 'A11y-contrast', label: 'High contrast', hint: 'Brighter text, stronger borders and focus outlines.' },
    { key: 'reduceMotion', className: 'A11y-reduce-motion', label: 'Reduce motion', hint: 'Turn off animations and smooth scrolling.' },
];

export const DEFAULT_SETTINGS = Object.freeze({
    textScale: 1,
    font: 'default',
    spacing: false,
    plainText: false,
    contrast: false,
    reduceMotion: false,
});

// Anything that isn't a value we know how to apply (a stale or hand-edited
// stored value) falls back to the default for that setting.
export function normalizeSettings(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    return {
        textScale: TEXT_SCALES.some(scale => scale.value === source.textScale) ? source.textScale : DEFAULT_SETTINGS.textScale,
        font: READING_FONTS.some(font => font.key === source.font) ? source.font : DEFAULT_SETTINGS.font,
        spacing: source.spacing === true,
        plainText: source.plainText === true,
        contrast: source.contrast === true,
        reduceMotion: source.reduceMotion === true,
    };
}

export function isDefaultSettings(settings) {
    const normalized = normalizeSettings(settings);
    return Object.keys(DEFAULT_SETTINGS).every(key => normalized[key] === DEFAULT_SETTINGS[key]);
}

export function ensureFontLoaded(fontKey, doc = document) {
    const font = READING_FONTS.find(candidate => candidate.key === fontKey);
    if (!font?.stylesheet) return;
    if (doc.querySelector(`link[data-a11y-font="${font.key}"]`)) return;
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = font.stylesheet;
    link.setAttribute('data-a11y-font', font.key);
    doc.head.appendChild(link);
}

export function applyAccessibility(settings, root = document.documentElement) {
    const normalized = normalizeSettings(settings);

    if (normalized.textScale === 1) root.style.removeProperty('--jnj-text-scale');
    else root.style.setProperty('--jnj-text-scale', String(normalized.textScale));

    const font = READING_FONTS.find(candidate => candidate.key === normalized.font);
    if (font?.family) {
        root.setAttribute('data-a11y-font', font.key);
        root.style.setProperty('--jnj-a11y-font', font.family);
        ensureFontLoaded(font.key, root.ownerDocument);
    } else {
        root.removeAttribute('data-a11y-font');
        root.style.removeProperty('--jnj-a11y-font');
    }

    TOGGLES.forEach(toggle => root.classList.toggle(toggle.className, normalized[toggle.key]));

    // Anything that changes how big or how wide the text is - see Accessibility.scss.
    root.classList.toggle('A11y-text-adapt', normalized.textScale > 1 || normalized.font !== 'default' || normalized.spacing);
}

// The device-level copy, so the settings apply before the page has even
// finished loading (and before sign-in resolves) instead of flashing the
// default look first.
export function loadCachedSettings(storage = window.localStorage) {
    try {
        return normalizeSettings(JSON.parse(storage.getItem(STORAGE_KEY)));
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

export function cacheSettings(settings, storage = window.localStorage) {
    try {
        storage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
    } catch {
        // storage can be blocked (private mode); the account copy still applies.
    }
}

// Smooth scrolling is a courtesy that some people can't tolerate, so anything
// that scrolls programmatically asks this first.
export function prefersReducedMotion(root = document.documentElement) {
    return root.classList.contains('A11y-reduce-motion')
        || (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
