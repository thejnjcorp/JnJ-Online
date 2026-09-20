jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockOnSnapshot = jest.fn();
const mockAddDoc = jest.fn();
const mockDeleteDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    collection: (_db, ...path) => ({ __collection: path }),
    doc: (_db, ...path) => ({ __doc: path }),
    onSnapshot: (...args) => mockOnSnapshot(...args),
    addDoc: (...args) => mockAddDoc(...args),
    deleteDoc: (...args) => mockDeleteDoc(...args),
    serverTimestamp: () => '__serverTimestamp__',
}));

// eslint-disable-next-line import/first
import { renderHook, act } from '@testing-library/react';
// eslint-disable-next-line import/first
import { useTokenLibrary } from '../../src/utils/useTokenLibrary';
// eslint-disable-next-line import/first
import { MAX_LIBRARY_TOKENS } from '../../src/utils/tokenLibrary';

const stop = jest.fn();
let deliver;
let fail;
const snapshot = items => ({ docs: items.map(({ id, ...data }) => ({ id, data: () => data })) });
const token = (id, extra = {}) => ({ id, image: 'AbC1d2E.png', label: id, size: 0.07, ...extra });

beforeEach(() => {
    stop.mockReset();
    mockAddDoc.mockResolvedValue({ id: 'new' });
    mockDeleteDoc.mockResolvedValue(undefined);
    mockOnSnapshot.mockImplementation((_ref, onNext, onError) => {
        deliver = onNext;
        fail = onError;
        return stop;
    });
    window.alert = jest.fn();
});

afterEach(() => {
    delete window.alert;
});

describe('useTokenLibrary', () => {
    test('listens to the user\'s own tokens, and has none until they arrive', () => {
        const { result } = renderHook(() => useTokenLibrary('user-1'));
        expect(mockOnSnapshot).toHaveBeenCalledWith({ __collection: ['players', 'user-1', 'tokens'] }, expect.any(Function), expect.any(Function));
        expect(result.current).toMatchObject({ tokens: [], loaded: false, full: false });
    });

    test('gives the tokens as they arrive, and follows changes', () => {
        const { result } = renderHook(() => useTokenLibrary('user-1'));
        act(() => deliver(snapshot([token('a')])));
        expect(result.current.tokens.map(t => t.id)).toEqual(['a']);
        expect(result.current.loaded).toBe(true);
        act(() => deliver(snapshot([token('a'), token('b')])));
        expect(result.current.tokens).toHaveLength(2);
    });

    test('leaves out a token whose picture is not usable', () => {
        const { result } = renderHook(() => useTokenLibrary('user-1'));
        act(() => deliver(snapshot([token('a'), token('bad', { image: 'javascript:1' })])));
        expect(result.current.tokens.map(t => t.id)).toEqual(['a']);
    });

    test('is full at the limit', () => {
        const { result } = renderHook(() => useTokenLibrary('user-1'));
        act(() => deliver(snapshot(Array.from({ length: MAX_LIBRARY_TOKENS }, (_, i) => token(`t${i}`)))));
        expect(result.current.full).toBe(true);
    });

    test('does not listen while disabled, or with nobody signed in', () => {
        renderHook(() => useTokenLibrary('user-1', false));
        renderHook(() => useTokenLibrary(undefined));
        expect(mockOnSnapshot).not.toHaveBeenCalled();
    });

    test('starts listening once enabled, and stops when disabled again or when it goes', () => {
        const { rerender, unmount } = renderHook(({ on }) => useTokenLibrary('user-1', on), { initialProps: { on: false } });
        expect(mockOnSnapshot).not.toHaveBeenCalled();
        rerender({ on: true });
        expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
        rerender({ on: false });
        expect(stop).toHaveBeenCalledTimes(1);
        rerender({ on: true });
        unmount();
        expect(stop).toHaveBeenCalledTimes(2);
    });

    test('a library that cannot be read is logged, and counts as loaded (empty) rather than loading for ever', () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        const { result } = renderHook(() => useTokenLibrary('user-1'));
        act(() => fail(new Error('permission-denied')));
        expect(result.current.loaded).toBe(true);
        expect(log).toHaveBeenCalledWith("Couldn't load the token library: Error: permission-denied");
        log.mockRestore();
    });

    test('saving and removing write to the user\'s library', () => {
        const { result } = renderHook(() => useTokenLibrary('user-1'));
        act(() => { result.current.save({ image: 'AbC1d2E.png', label: 'Fire', size: 0.1 }); });
        act(() => { result.current.remove('tok-1'); });
        expect(mockAddDoc).toHaveBeenCalledWith({ __collection: ['players', 'user-1', 'tokens'] }, expect.objectContaining({ image: 'AbC1d2E.png', label: 'Fire' }));
        expect(mockDeleteDoc).toHaveBeenCalledWith({ __doc: ['players', 'user-1', 'tokens', 'tok-1'] });
    });

    test('says so when either cannot be done', async () => {
        mockAddDoc.mockRejectedValue(new Error('offline'));
        mockDeleteDoc.mockRejectedValue(new Error('offline'));
        const { result } = renderHook(() => useTokenLibrary('user-1'));
        await act(async () => { await result.current.save({ image: 'AbC1d2E.png' }); });
        await act(async () => { await result.current.remove('tok-1'); });
        expect(window.alert).toHaveBeenCalledWith("Couldn't save to your token library: offline");
        expect(window.alert).toHaveBeenCalledWith("Couldn't remove it from your token library: offline");
    });
});
