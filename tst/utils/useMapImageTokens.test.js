jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockArrayUnion = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
    arrayUnion: (...args) => mockArrayUnion(...args),
}));

// eslint-disable-next-line import/first
import { renderHook, act, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { useMapImageTokens } from '../../src/utils/useMapImageTokens';
// eslint-disable-next-line import/first
import { MAX_IMAGE_TOKENS } from '../../src/utils/mapImageTokens';

const token = (id, extra = {}) => ({ id, image: 'https://example.com/fire.png', label: 'Fire', x: 0.3, y: 0.2, size: 0.07, ...extra });
const map = (tokens, extra = {}) => ({ map_id: 'map-1', canWrite: ['director-1'], image_tokens: tokens, ...extra });
const setup = (tokens = [], userId = 'director-1', extra = {}) => renderHook(({ current }) => useMapImageTokens(current, userId), { initialProps: { current: map(tokens, extra) } });

beforeEach(() => {
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockUpdateDoc.mockResolvedValue(undefined);
    mockArrayUnion.mockImplementation(value => ({ __arrayUnion: value }));
    window.alert = jest.fn();
});

afterEach(() => {
    delete window.alert;
});

describe('useMapImageTokens', () => {
    describe('who can edit', () => {
        test('someone on the map\'s canWrite list can, like drawing', () => {
            expect(setup().result.current.canEdit).toBe(true);
        });

        test('nobody else can; they just see the tokens', () => {
            const { result } = setup([token('a')], 'player-1');
            expect(result.current.canEdit).toBe(false);
            expect(result.current.tokens).toHaveLength(1);
        });

        test('nor can anyone with no map or no signed-in user', () => {
            expect(renderHook(() => useMapImageTokens(undefined, 'director-1')).result.current.canEdit).toBe(false);
            expect(renderHook(() => useMapImageTokens(map([]), undefined)).result.current.canEdit).toBe(false);
        });

        test('someone who cannot edit cannot add', () => {
            const { result } = setup([], 'player-1');
            act(() => { result.current.add({ image: 'https://example.com/a.png' }, 0.5); });
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });
    });

    describe('the tokens', () => {
        test('are what is saved on the map, leaving out anything malformed', () => {
            const { result } = setup([token('a'), { id: 'bad' }, token('b', { image: 'javascript:1' })]);
            expect(result.current.tokens.map(t => t.id)).toEqual(['a']);
        });

        test('are none when the map has none', () => {
            expect(setup(undefined).result.current.tokens).toEqual([]);
        });

        test('keep the same list while the map doc is unchanged, so nothing re-renders for nothing', () => {
            const tokens = [token('a')];
            const { result, rerender } = setup(tokens);
            const first = result.current.tokens;
            rerender({ current: map(tokens, { link: 'other.png' }) });
            expect(result.current.tokens).toBe(first);
        });
    });

    describe('adding', () => {
        test('adds one in the middle of the map and selects it, ready to be dragged', () => {
            const { result } = setup();
            let id;
            act(() => { id = result.current.add({ image: 'https://example.com/a.png', label: 'Tree', size: 0.12 }, 0.5); });

            expect(mockDoc).toHaveBeenCalledWith({}, 'maps', 'map-1');
            const added = mockUpdateDoc.mock.calls[0][1].image_tokens.__arrayUnion;
            expect(added).toMatchObject({ id, image: 'https://example.com/a.png', label: 'Tree', size: 0.12, x: 0.5, y: 0.25 });
            expect(result.current.selected).toBeNull(); // not in the map doc yet: nothing to select until it arrives
        });

        test('is selected once the map doc has it', () => {
            const { result, rerender } = setup();
            let id;
            act(() => { id = result.current.add({ image: 'https://example.com/a.png' }, 0.5); });
            rerender({ current: map([token(id)]) });
            expect(result.current.selected).toBe(id);
        });

        test('does nothing when the map is full', () => {
            const many = Array.from({ length: MAX_IMAGE_TOKENS }, (_, index) => token(`t${index}`));
            const { result } = setup(many);
            expect(result.current.full).toBe(true);
            act(() => { result.current.add({ image: 'https://example.com/a.png' }, 0.5); });
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        test('says so when it cannot be saved', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            const { result } = setup();
            act(() => { result.current.add({ image: 'https://example.com/a.png' }, 0.5); });
            await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Couldn't save the image token: offline"));
        });
    });

    describe('changing one', () => {
        test('moving writes the list with just that token moved, kept on the map', () => {
            const { result } = setup([token('a'), token('b')]);
            act(() => { result.current.move('a', { x: 0.9, y: 9 }, 0.5); });
            const saved = mockUpdateDoc.mock.calls[0][1].image_tokens;
            expect(saved[0]).toMatchObject({ id: 'a', x: 0.9, y: 0.5 });
            expect(saved[1]).toEqual(token('b'));
        });

        test('resizing writes the new size', () => {
            const { result } = setup([token('a')]);
            act(() => { result.current.resize('a', 0.2); });
            expect(mockUpdateDoc.mock.calls[0][1].image_tokens[0].size).toBe(0.2);
        });

        test('removing writes the list without it, and it is no longer selected', () => {
            const { result } = setup([token('a'), token('b')]);
            act(() => result.current.select('a'));
            expect(result.current.selected).toBe('a');
            act(() => { result.current.remove('a'); });
            expect(mockUpdateDoc.mock.calls[0][1].image_tokens.map(t => t.id)).toEqual(['b']);
            expect(result.current.selected).toBeNull();
        });

        test('copying writes the list with a copy at the end, and selects the copy', () => {
            const { result, rerender } = setup([token('a')]);
            act(() => { result.current.copy('a', 0.5); });
            const saved = mockUpdateDoc.mock.calls[0][1].image_tokens;
            expect(saved).toHaveLength(2);
            expect(saved[1].id).not.toBe('a');
            rerender({ current: map(saved) });
            expect(result.current.selected).toBe(saved[1].id);
        });

        test('copying does nothing when the map is full, or for a token that is not there', () => {
            const many = Array.from({ length: MAX_IMAGE_TOKENS }, (_, index) => token(`t${index}`));
            const full = setup(many).result;
            const one = setup([token('a')]).result;
            act(() => { full.current.copy('t0', 0.5); });
            act(() => { one.current.copy('zzz', 0.5); });
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });
    });

    describe('selection', () => {
        test('a token that someone else removed is no longer selected', () => {
            const { result, rerender } = setup([token('a'), token('b')]);
            act(() => result.current.select('b'));
            expect(result.current.selected).toBe('b');
            rerender({ current: map([token('a')]) });
            expect(result.current.selected).toBeNull();
        });
    });
});
