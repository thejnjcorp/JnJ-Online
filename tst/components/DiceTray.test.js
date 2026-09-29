// @3d-dice/dice-box needs a real WebGL canvas and web workers, neither of
// which jsdom has, so it's mocked here rather than loaded for real. The mock
// tracks every call so tests can assert what DiceTray actually asks it to do
// (roll vs add, notation strings, clear) without caring how the 3D library
// itself renders.
const mockInit = jest.fn();
const mockRoll = jest.fn();
const mockAdd = jest.fn();
const mockClear = jest.fn();
const mockUpdateConfig = jest.fn();
const mockConstructor = jest.fn();
class MockDiceBox {
    constructor(...args) { mockConstructor(...args); }
    init(...args) { return mockInit(...args); }
    roll(...args) { return mockRoll(...args); }
    add(...args) { return mockAdd(...args); }
    clear(...args) { return mockClear(...args); }
    updateConfig(...args) { return mockUpdateConfig(...args); }
}
jest.mock('@3d-dice/dice-box', () => ({ __esModule: true, default: MockDiceBox }));

jest.mock('../../src/utils/firebase', () => ({ db: {} }));
const mockDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    getDoc: (...args) => mockGetDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
}));

// react-colorful's real picker needs pointer-drag gestures on a gradient
// canvas to pick a color, which isn't practical to simulate in jsdom -
// stubbed as a plain text input, same as CharacterPageNavigationColorPickerButton.test.js.
jest.mock('react-colorful', () => ({
    HexColorPicker: ({ color, onChange, className }) => (
        <input aria-label="dice colour" className={className} value={color} onChange={e => onChange(e.target.value)}/>
    ),
}));

/* eslint-disable testing-library/no-node-access --
   the total and its breakdown can show the same digits (a single d6 rolling
   a 4 renders "4" in both), so they're read by class rather than by text. */

// eslint-disable-next-line import/first
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
// eslint-disable-next-line import/first
import { DiceTray } from '../../src/components/DiceTray';

const toggle = () => fireEvent.click(screen.getByRole('button', { name: 'Dice tray' }));
const dieButton = sides => screen.getByRole('button', { name: new RegExp(`^d${sides}`) });
const total = () => document.querySelector('.DiceTray-total')?.textContent;
const breakdown = () => document.querySelector('.DiceTray-breakdown')?.textContent;
const swatch = () => document.querySelector('.DiceTray-color-button')?.style.getPropertyValue('--dice-tray-swatch');

// Renders it as it's actually mounted - once, outside any particular route -
// on a character sheet path by default, since that's what most of these
// tests care about; route-scoping itself gets its own describe block below.
function renderTray(path = '/characters/char-1') {
    return render(<MemoryRouter initialEntries={[path]}><DiceTray/></MemoryRouter>);
}

beforeEach(() => {
    mockInit.mockResolvedValue(undefined);
    mockRoll.mockResolvedValue([{ sides: 6, value: 4 }]);
    mockAdd.mockResolvedValue([{ sides: 6, value: 2 }]);
    mockClear.mockReturnValue(undefined);
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockGetDoc.mockResolvedValue({ data: () => undefined }); // nothing saved, by default
    mockUpdateDoc.mockResolvedValue(undefined);
});

describe('DiceTray', () => {
    describe('only where it belongs', () => {
        test.each([
            ['/characters/char-1', true],
            ['/directors/camp-1', true],
            ['/directors/camp-1/encounters', true],
            ['/characters', false],
            ['/home', false],
            ['/classes/class-1', false],
            ['/campaigns/camp-1', false],
        ])('on %s, shown = %p', (path, shown) => {
            renderTray(path);
            const toggleButton = screen.getByRole('button', { name: 'Dice tray' });
            if (shown) expect(toggleButton).not.toHaveClass('DiceTray-toggle-hidden');
            else expect(toggleButton).toHaveClass('DiceTray-toggle-hidden');
        });

        test('navigating off a character sheet closes the tray, not just hides the toggle', async () => {
            render(<MemoryRouter initialEntries={['/characters/char-1']}>
                <Link to="/home">Home</Link>
                <DiceTray/>
            </MemoryRouter>);
            toggle();
            expect(screen.getByRole('region', { name: 'Dice tray' })).not.toHaveClass('DiceTray-closed');

            fireEvent.click(screen.getByRole('link', { name: 'Home' }));

            expect(screen.getByRole('region', { name: 'Dice tray' })).toHaveClass('DiceTray-closed');
            expect(screen.getByRole('button', { name: 'Dice tray' })).toHaveClass('DiceTray-toggle-hidden');
        });

        test('returning to a relevant page needs a fresh click - it does not reopen already open', async () => {
            function Harness() {
                return <Routes>
                    <Route path="/characters/:id" element={<><Link to="/home">Home</Link><DiceTray/></>}/>
                    <Route path="/home" element={<><Link to="/characters/char-1">Back</Link><DiceTray/></>}/>
                </Routes>;
            }
            render(<MemoryRouter initialEntries={['/characters/char-1']}><Harness/></MemoryRouter>);
            toggle();
            expect(screen.getByRole('region', { name: 'Dice tray' })).not.toHaveClass('DiceTray-closed');

            fireEvent.click(screen.getByRole('link', { name: 'Home' }));
            fireEvent.click(screen.getByRole('link', { name: 'Back' }));

            expect(screen.getByRole('region', { name: 'Dice tray' })).toHaveClass('DiceTray-closed');
        });
    });

    test('opening it loads the 3D library and shows a die for each side this app uses', async () => {
        renderTray();
        toggle();
        expect(screen.getByRole('region', { name: 'Dice tray' })).not.toHaveClass('DiceTray-closed');
        expect(screen.getByText('Loading dice…')).toBeInTheDocument();

        await waitFor(() => expect(mockInit).toHaveBeenCalled());
        expect(mockConstructor).toHaveBeenCalledWith('#DiceTray-stage', expect.objectContaining({ assetPath: expect.stringContaining('/dice-box-assets/'), scale: 8 }));
        [4, 6, 8, 10, 12, 20].forEach(sides => expect(dieButton(sides)).toBeInTheDocument());
        await waitFor(() => expect(screen.queryByText('Loading dice…')).not.toBeInTheDocument());
    });

    test('the library is only loaded once, even if the tray is closed and reopened', async () => {
        renderTray();
        toggle();
        await waitFor(() => expect(mockInit).toHaveBeenCalledTimes(1));

        toggle(); // close
        expect(screen.getByRole('region', { name: 'Dice tray' })).toHaveClass('DiceTray-closed');

        toggle(); // reopen
        expect(mockConstructor).toHaveBeenCalledTimes(1);
        expect(mockInit).toHaveBeenCalledTimes(1);
    });

    test('a failure to load is shown as an error, not a silent blank tray', async () => {
        mockInit.mockRejectedValue(new Error('offline'));
        renderTray();
        toggle();
        expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the dice tray");
    });

    describe('dice colour', () => {
        test('with nothing saved, falls back to the theme\'s accent colour', async () => {
            document.documentElement.style.setProperty('--jnj-color-accent', '#c8a24a');
            renderTray();
            await waitFor(() => expect(mockGetDoc).toHaveBeenCalled());
            expect(swatch()).toBe('#c8a24a');
        });

        test('a theme colour that only becomes available after mount is still picked up, not frozen at whatever the very first render read', async () => {
            document.documentElement.style.removeProperty('--jnj-color-accent'); // nothing yet - the un-themed fallback
            let resolveGetDoc;
            mockGetDoc.mockReturnValue(new Promise(resolve => { resolveGetDoc = resolve; }));

            renderTray();
            expect(swatch()).toBe('#7c4dff'); // the hardcoded fallback, since even --jnj-color-accent's own fallback isn't set yet

            document.documentElement.style.setProperty('--jnj-color-accent', '#c8a24a'); // the theme "arrives" late
            resolveGetDoc({ data: () => undefined }); // nothing saved for this character - the read that forces a re-render
            await waitFor(() => expect(swatch()).toBe('#c8a24a'));
        });

        test('a character sheet reads and writes the colour on that character', async () => {
            mockGetDoc.mockResolvedValue({ data: () => ({ dice_color: '#112233' }) });
            renderTray('/characters/char-9');
            await waitFor(() => expect(swatch()).toBe('#112233'));
            expect(mockDoc).toHaveBeenCalledWith({}, 'characters', 'char-9');
        });

        test('a director view reads and writes the colour on that campaign, not a character', async () => {
            mockGetDoc.mockResolvedValue({ data: () => ({ dice_color: '#445566' }) });
            renderTray('/directors/camp-9');
            await waitFor(() => expect(swatch()).toBe('#445566'));
            expect(mockDoc).toHaveBeenCalledWith({}, 'campaigns', 'camp-9');
        });

        test('opening the picker starts on the current colour; Set colour saves it and updates the swatch', async () => {
            mockGetDoc.mockResolvedValue({ data: () => ({ dice_color: '#112233' }) });
            renderTray('/characters/char-9');
            await waitFor(() => expect(swatch()).toBe('#112233'));

            fireEvent.click(screen.getByRole('button', { name: 'Change dice colour' }));
            expect(screen.getByLabelText('dice colour')).toHaveValue('#112233');

            fireEvent.change(screen.getByLabelText('dice colour'), { target: { value: '#abcdef' } });
            fireEvent.click(screen.getByRole('button', { name: 'Set colour' }));

            await waitFor(() => expect(swatch()).toBe('#abcdef'));
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-9'] }, { dice_color: '#abcdef' });
            expect(screen.queryByLabelText('dice colour')).not.toBeInTheDocument(); // the picker closes too
        });

        test('a colour changed while the tray is already open applies to the dice immediately', async () => {
            renderTray();
            toggle();
            await waitFor(() => expect(mockInit).toHaveBeenCalled());

            fireEvent.click(screen.getByRole('button', { name: 'Change dice colour' }));
            fireEvent.change(screen.getByLabelText('dice colour'), { target: { value: '#abcdef' } });
            fireEvent.click(screen.getByRole('button', { name: 'Set colour' }));

            await waitFor(() => expect(mockUpdateConfig).toHaveBeenCalledWith({ themeColor: '#abcdef' }));
        });

        test('Cancel discards the change without saving', async () => {
            mockGetDoc.mockResolvedValue({ data: () => ({ dice_color: '#112233' }) });
            renderTray('/characters/char-9');
            await waitFor(() => expect(swatch()).toBe('#112233'));

            fireEvent.click(screen.getByRole('button', { name: 'Change dice colour' }));
            fireEvent.change(screen.getByLabelText('dice colour'), { target: { value: '#abcdef' } });
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

            expect(mockUpdateDoc).not.toHaveBeenCalled();
            expect(swatch()).toBe('#112233');
            expect(screen.queryByLabelText('dice colour')).not.toBeInTheDocument();
        });

        test('a failed save is shown, and the picker stays open with neither the swatch nor the tray\'s dice changed', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('permission-denied'));
            renderTray('/characters/char-9');
            await waitFor(() => expect(mockGetDoc).toHaveBeenCalled());
            const before = swatch();

            fireEvent.click(screen.getByRole('button', { name: 'Change dice colour' }));
            fireEvent.change(screen.getByLabelText('dice colour'), { target: { value: '#abcdef' } });
            fireEvent.click(screen.getByRole('button', { name: 'Set colour' }));

            expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save the dice colour");
            expect(swatch()).toBe(before);
            expect(screen.getByLabelText('dice colour')).toBeInTheDocument(); // the picker is still open, not silently closed
            expect(mockUpdateConfig).not.toHaveBeenCalled();
        });
    });

    describe('once ready', () => {
        async function openAndWait() {
            renderTray();
            toggle();
            await waitFor(() => expect(mockInit).toHaveBeenCalled());
            await screen.findByRole('button', { name: /^d6/ });
        }

        test('clicking a die for the first time rolls it (the tray started empty)', async () => {
            await openAndWait();
            fireEvent.click(dieButton(6));
            await waitFor(() => expect(mockRoll).toHaveBeenCalledWith('1d6'));
            expect(mockAdd).not.toHaveBeenCalled();
            await waitFor(() => expect(total()).toBe('4'));
            expect(breakdown()).toBe('4');
            expect(screen.getByText('×1', { exact: false })).toBeInTheDocument();
        });

        test('clicking another die once the tray has one already adds it instead of re-rolling', async () => {
            await openAndWait();
            fireEvent.click(dieButton(6));
            await waitFor(() => expect(total()).toBe('4')); // waits out the roll fully, including the button re-enabling

            fireEvent.click(dieButton(6));
            await waitFor(() => expect(mockAdd).toHaveBeenCalledWith('1d6'));
            expect(mockRoll).toHaveBeenCalledTimes(1);

            await waitFor(() => expect(total()).toBe('6')); // 4 + 2
            expect(breakdown()).toBe('4 + 2');
        });

        test('the modifier adjusts the total without involving the 3D library at all', async () => {
            await openAndWait();
            fireEvent.click(dieButton(6));
            await waitFor(() => expect(total()).toBe('4'));

            fireEvent.click(screen.getByRole('button', { name: 'Increase modifier' }));
            fireEvent.click(screen.getByRole('button', { name: 'Increase modifier' }));
            expect(screen.getByText('+2')).toBeInTheDocument();
            expect(total()).toBe('6'); // 4 + 2
            expect(breakdown()).toBe('4 +2');
            expect(mockRoll).toHaveBeenCalledTimes(1);
            expect(mockAdd).not.toHaveBeenCalled();
        });

        test('the modifier can go negative', async () => {
            await openAndWait();
            fireEvent.click(dieButton(6));
            await waitFor(() => expect(total()).toBe('4'));

            fireEvent.click(screen.getByRole('button', { name: 'Decrease modifier' }));
            expect(screen.getByText('-1')).toBeInTheDocument();
            expect(total()).toBe('3');
        });

        test('Clear empties the tray, resets the modifier, and tells the 3D library to clear its scene too', async () => {
            await openAndWait();
            fireEvent.click(dieButton(6));
            await waitFor(() => expect(total()).toBe('4'));
            fireEvent.click(screen.getByRole('button', { name: 'Increase modifier' }));

            fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

            expect(mockClear).toHaveBeenCalled();
            expect(screen.getByText('Click a die below to roll it.')).toBeInTheDocument();
            expect(screen.getByText('0')).toBeInTheDocument(); // the modifier stepper, reset
            expect(screen.queryByText('×1', { exact: false })).not.toBeInTheDocument();
        });

        test('Clear is disabled while the tray is empty', async () => {
            await openAndWait();
            expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
        });

        // .DiceTray-hint is `position: absolute; inset: 0`, correct for the
        // stage's own loading/error text (which needs to cover its canvas -
        // .DiceTray-stage is that positioned ancestor). The "click a die"
        // hint below the stage used to share that same class with nothing
        // positioned between it and the whole floating tray panel, so it
        // escaped to cover THAT instead - an invisible layer sitting in front
        // of every button below it (the die picker, modifier, Clear),
        // silently eating every real click. This is what "none of the
        // buttons on it work" was - a real click and jsdom's fireEvent.click
        // can't be told apart here (dom-testing-library doesn't hit-test), so
        // this just pins the class rename apart instead of reproducing the
        // overlap itself; see DiceTray.scss's own comment for the layout fix.
        test('the "click a die" hint is its own class, not the stage-only absolute-fill one', async () => {
            await openAndWait();
            const hint = screen.getByText('Click a die below to roll it.');
            expect(hint).toHaveClass('DiceTray-result-hint');
            expect(hint).not.toHaveClass('DiceTray-hint');
        });
    });
});
