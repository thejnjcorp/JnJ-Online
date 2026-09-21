jest.mock('../../src/utils/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'user-1', displayName: 'Sam' } } }));

const mockOnSnapshot = jest.fn();
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    collection: (_db, ...path) => ({ __collection: path }),
    doc: (_db, ...path) => ({ __doc: path }),
    onSnapshot: (...args) => mockOnSnapshot(...args),
    addDoc: (...args) => mockAddDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
    deleteDoc: (...args) => mockDeleteDoc(...args),
    serverTimestamp: () => '__now__',
}));

// eslint-disable-next-line import/first
import { renderHook, act } from '@testing-library/react';
// eslint-disable-next-line import/first
import { resetSharedListeners } from '../../src/utils/sharedSnapshot';
// eslint-disable-next-line import/first
import { usePartyEvents } from '../../src/utils/usePartyEvents';
// eslint-disable-next-line import/first
import { defaultCalendar } from '../../src/utils/calendar';

const calendar = defaultCalendar();
let deliver;
let fail;
const stop = jest.fn();
const event = (id, year, month, day) => ({ id, data: () => ({ title: id, year, month, day }) });

beforeEach(() => {
    resetSharedListeners();
    stop.mockReset();
    mockAddDoc.mockResolvedValue({ id: 'new-event' });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    mockOnSnapshot.mockImplementation((_ref, onNext, onError) => { deliver = onNext; fail = onError; return stop; });
});

describe('usePartyEvents', () => {
    test('listens to the campaign\'s events, loading until they arrive', () => {
        const { result } = renderHook(() => usePartyEvents('camp-1', calendar));
        expect(mockOnSnapshot).toHaveBeenCalledWith({ __collection: ['campaigns', 'camp-1', 'party_events'] }, expect.any(Function), expect.any(Function));
        expect(result.current.status).toBe('loading');
        expect(result.current.events).toEqual([]);
    });

    test('gives the events in the order they happened', () => {
        const { result } = renderHook(() => usePartyEvents('camp-1', calendar));
        act(() => deliver({ docs: [event('late', 2, 5, 1), event('early', 1, 0, 1), event('middle', 1, 6, 15)] }));
        expect(result.current.status).toBe('ready');
        expect(result.current.events.map(e => e.id)).toEqual(['early', 'middle', 'late']);
    });

    test('says so when they cannot be read', () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        const { result } = renderHook(() => usePartyEvents('camp-1', calendar));
        act(() => fail(new Error('permission-denied')));
        expect(result.current.status).toBe('error');
        log.mockRestore();
    });

    test('stops listening a moment after it goes', () => {
        jest.useFakeTimers();
        const { unmount } = renderHook(() => usePartyEvents('camp-1', calendar));
        unmount();
        expect(stop).not.toHaveBeenCalled();
        act(() => { jest.advanceTimersByTime(4000); });
        expect(stop).toHaveBeenCalled();
        jest.useRealTimers();
    });

    test('two views of the calendar share one listener, and one remounting straight away does not start another', () => {
        jest.useFakeTimers();
        const first = renderHook(() => usePartyEvents('camp-1', calendar));
        renderHook(() => usePartyEvents('camp-1', calendar));
        expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
        first.unmount();
        renderHook(() => usePartyEvents('camp-1', calendar));
        expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
        jest.useRealTimers();
    });

    test('a refused listener is not started again by every component that asks - the pile-up that crashes the Firestore SDK', () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        renderHook(() => usePartyEvents('camp-1', calendar));
        act(() => fail(new Error('permission-denied')));
        const { result } = renderHook(() => usePartyEvents('camp-1', calendar));
        expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
        expect(result.current.status).toBe('error');
        log.mockRestore();
    });

    test('a new event notes who added it', async () => {
        const { result } = renderHook(() => usePartyEvents('camp-1', calendar));
        await act(async () => { await result.current.addEvent({ title: 'Reached the gate', description: '', category: 'travel', year: 1, month: 0, day: 5 }); });
        expect(mockAddDoc).toHaveBeenCalledWith({ __collection: ['campaigns', 'camp-1', 'party_events'] }, expect.objectContaining({
            title: 'Reached the gate', category: 'travel', created_by_uid: 'user-1', created_by_name: 'Sam', createdAt: '__now__', updatedAt: '__now__',
        }));
    });

    test('changing an event, and deleting one', async () => {
        const { result } = renderHook(() => usePartyEvents('camp-1', calendar));
        await act(async () => { await result.current.saveEvent('e1', { title: 'Renamed' }); });
        expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1', 'party_events', 'e1'] }, { title: 'Renamed', updatedAt: '__now__' });
        await act(async () => { await result.current.deleteEvent('e1'); });
        expect(mockDeleteDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1', 'party_events', 'e1'] });
    });
});
