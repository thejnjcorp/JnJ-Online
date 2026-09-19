jest.mock('../../src/utils/firebase', () => ({ db: { __db: true } }));

const mockDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    getDoc: (...args) => mockGetDoc(...args),
    setDoc: (...args) => mockSetDoc(...args),
}));

// eslint-disable-next-line import/first
import { act, render, screen, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { AccessibilityProvider, useAccessibility } from '../../src/utils/AccessibilityContext';
// eslint-disable-next-line import/first
import { DEFAULT_SETTINGS, STORAGE_KEY, applyAccessibility } from '../../src/utils/accessibility';

let latest;
function Probe() {
    latest = useAccessibility();
    return <div>scale:{latest.settings.textScale} font:{latest.settings.font} save:{latest.saveState}</div>;
}
const mount = (userId) => render(<AccessibilityProvider userId={userId}><Probe/></AccessibilityProvider>);

beforeEach(() => {
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path.join('/') }));
    mockGetDoc.mockResolvedValue({ data: () => undefined });
    mockSetDoc.mockResolvedValue(undefined);
    window.localStorage.clear();
});

afterEach(() => {
    applyAccessibility(DEFAULT_SETTINGS);
    window.localStorage.clear();
});

describe('AccessibilityProvider', () => {
    test('starts from the defaults, and applies nothing, for someone who has never changed a setting', () => {
        mount(undefined);
        expect(screen.getByText('scale:1 font:default save:idle')).toBeInTheDocument();
        expect(document.documentElement.style.getPropertyValue('--jnj-text-scale')).toBe('');
        expect(mockGetDoc).not.toHaveBeenCalled(); // signed out: nothing to load
    });

    test("starts from this device's cached settings, applied to <html> straight away", () => {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, textScale: 1.5, contrast: true }));

        mount(undefined);

        expect(screen.getByText(/scale:1.5/)).toBeInTheDocument();
        expect(document.documentElement.style.getPropertyValue('--jnj-text-scale')).toBe('1.5');
        expect(document.documentElement.classList.contains('A11y-contrast')).toBe(true);
    });

    test("signing in loads the player's saved settings from players/{uid}, applies and caches them", async () => {
        mockGetDoc.mockResolvedValue({ data: () => ({ name: 'Sam', accessibility: { ...DEFAULT_SETTINGS, textScale: 2, font: 'lexend' } }) });

        mount('user-1');

        await waitFor(() => expect(screen.getByText('scale:2 font:lexend save:idle')).toBeInTheDocument());
        expect(mockDoc).toHaveBeenCalledWith({ __db: true }, 'players', 'user-1');
        await waitFor(() => expect(document.documentElement.getAttribute('data-a11y-font')).toBe('lexend'));
        expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).textScale).toBe(2);
    });

    test('a player with nothing saved keeps whatever this device already had', async () => {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, textScale: 1.25 }));
        mockGetDoc.mockResolvedValue({ data: () => ({ name: 'Sam' }) });

        mount('user-1');

        await waitFor(() => expect(mockGetDoc).toHaveBeenCalled());
        expect(screen.getByText(/scale:1.25/)).toBeInTheDocument();
    });

    test('a failed load leaves the device settings in place and does not crash', async () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, textScale: 1.25 }));
        mockGetDoc.mockRejectedValue(new Error('offline'));

        mount('user-1');

        await waitFor(() => expect(log).toHaveBeenCalled());
        expect(screen.getByText(/scale:1.25/)).toBeInTheDocument();
        log.mockRestore();
    });

    describe('changing a setting', () => {
        test('applies it at once, caches it, and merges it into the player doc (never overwriting their name)', async () => {
            mount('user-1');

            await act(async () => { await latest.update({ textScale: 1.5, spacing: true }); });

            expect(screen.getByText(/scale:1.5/)).toBeInTheDocument();
            expect(document.documentElement.style.getPropertyValue('--jnj-text-scale')).toBe('1.5');
            expect(document.documentElement.classList.contains('A11y-spacing')).toBe(true);
            expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).spacing).toBe(true);
            expect(mockSetDoc).toHaveBeenCalledWith(
                { __doc: 'players/user-1' },
                { accessibility: { ...DEFAULT_SETTINGS, textScale: 1.5, spacing: true } },
                { merge: true },
            );
            expect(latest.saveState).toBe('saved');
        });

        test('successive changes build on each other', async () => {
            mount('user-1');
            await act(async () => { await latest.update({ textScale: 1.25 }); });
            await act(async () => { await latest.update({ font: 'atkinson' }); });
            expect(screen.getByText('scale:1.25 font:atkinson save:saved')).toBeInTheDocument();
        });

        test('a value that is not allowed is ignored rather than saved', async () => {
            mount('user-1');
            await act(async () => { await latest.update({ textScale: 99 }); });
            expect(screen.getByText(/scale:1 /)).toBeInTheDocument();
        });

        test('signed out, it applies and caches on this device without touching Firestore', async () => {
            mount(undefined);

            await act(async () => { await latest.update({ contrast: true }); });

            expect(document.documentElement.classList.contains('A11y-contrast')).toBe(true);
            expect(mockSetDoc).not.toHaveBeenCalled();
            expect(latest.saveState).toBe('idle');
        });

        test('a failed save still applies the change on this device, and says it did not save', async () => {
            const log = jest.spyOn(console, 'log').mockImplementation(() => {});
            mockSetDoc.mockRejectedValue(new Error('permission-denied'));
            mount('user-1');

            await act(async () => { await latest.update({ textScale: 1.5 }); });

            expect(screen.getByText(/scale:1.5 font:default save:error/)).toBeInTheDocument();
            expect(document.documentElement.style.getPropertyValue('--jnj-text-scale')).toBe('1.5');
            log.mockRestore();
        });
    });

    test('reset puts every setting back to the default, and removes it from the page', async () => {
        mount('user-1');
        await act(async () => { await latest.update({ textScale: 2, font: 'opendyslexic', plainText: true }); });

        await act(async () => { await latest.reset(); });

        expect(screen.getByText('scale:1 font:default save:saved')).toBeInTheDocument();
        expect(document.documentElement.style.getPropertyValue('--jnj-text-scale')).toBe('');
        expect(document.documentElement.classList.contains('A11y-plain-text')).toBe(false);
        expect(mockSetDoc).toHaveBeenLastCalledWith({ __doc: 'players/user-1' }, { accessibility: DEFAULT_SETTINGS }, { merge: true });
    });
});

describe('useAccessibility without a provider', () => {
    test('is a harmless default, so a component can be rendered on its own', async () => {
        render(<Probe/>);
        expect(screen.getByText('scale:1 font:default save:idle')).toBeInTheDocument();
        await expect(latest.update({ textScale: 2 })).resolves.toBeUndefined();
    });
});
