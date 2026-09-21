jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockOnSnapshot = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (_db, ...path) => ({ __doc: path }),
    onSnapshot: (...args) => mockOnSnapshot(...args),
}));

// eslint-disable-next-line import/first
import { resetItemStore, subscribeItem } from '../../src/utils/itemStore';

let deliver;
let fail;
const stop = jest.fn();

beforeEach(() => {
    jest.useFakeTimers();
    resetItemStore();
    stop.mockReset();
    mockOnSnapshot.mockReset();
    mockOnSnapshot.mockImplementation((_ref, onNext, onError) => {
        deliver = onNext;
        fail = onError;
        return stop;
    });
});

afterEach(() => {
    jest.useRealTimers();
});

const snapshot = (id, data) => ({ exists: () => data !== null, id, data: () => data });

describe('subscribeItem', () => {
    test('listens to that item, and starts as loading', () => {
        const listener = jest.fn();
        subscribeItem('torch', listener);
        expect(mockOnSnapshot).toHaveBeenCalledWith({ __doc: ['items', 'torch'] }, expect.any(Function), expect.any(Function));
        expect(listener).toHaveBeenCalledWith({ item: null, status: 'loading' });
    });

    test('gives the item once it arrives, with its id, and follows changes', () => {
        const listener = jest.fn();
        subscribeItem('torch', listener);
        deliver(snapshot('torch', { item_name: 'Torch' }));
        expect(listener).toHaveBeenLastCalledWith({ item: { id: 'torch', item_name: 'Torch' }, status: 'ready' });
        deliver(snapshot('torch', { item_name: 'Bright Torch' }));
        expect(listener).toHaveBeenLastCalledWith({ item: { id: 'torch', item_name: 'Bright Torch' }, status: 'ready' });
    });

    test('says an item is missing when there is no such document', () => {
        const listener = jest.fn();
        subscribeItem('gone', listener);
        deliver(snapshot('gone', null));
        expect(listener).toHaveBeenLastCalledWith({ item: null, status: 'missing' });
    });

    test('says so when the item cannot be read', () => {
        const listener = jest.fn();
        subscribeItem('secret', listener);
        fail(new Error('permission-denied'));
        expect(listener).toHaveBeenLastCalledWith({ item: null, status: 'error' });
    });

    test('everything showing an item shares one listener, and a late one is told what is already known', () => {
        const first = jest.fn();
        subscribeItem('torch', first);
        deliver(snapshot('torch', { item_name: 'Torch' }));
        const second = jest.fn();
        subscribeItem('torch', second);
        expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledWith({ item: { id: 'torch', item_name: 'Torch' }, status: 'ready' });
        deliver(snapshot('torch', { item_name: 'Changed' }));
        expect(first).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ready' }));
        expect(second).toHaveBeenLastCalledWith({ item: { id: 'torch', item_name: 'Changed' }, status: 'ready' });
    });

    test('different items each get their own listener', () => {
        subscribeItem('torch', jest.fn());
        subscribeItem('rope', jest.fn());
        expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
    });

    test('stops listening a while after the last one has gone, not straight away', () => {
        const unsubscribe = subscribeItem('torch', jest.fn());
        unsubscribe();
        expect(stop).not.toHaveBeenCalled();
        jest.advanceTimersByTime(29000);
        expect(stop).not.toHaveBeenCalled();
        jest.advanceTimersByTime(2000);
        expect(stop).toHaveBeenCalledTimes(1);
    });

    test('something that shows up again straight away finds the listener still there', () => {
        const unsubscribe = subscribeItem('torch', jest.fn());
        deliver(snapshot('torch', { item_name: 'Torch' }));
        unsubscribe();
        const again = jest.fn();
        subscribeItem('torch', again);
        jest.advanceTimersByTime(60000);
        expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
        expect(stop).not.toHaveBeenCalled();
        expect(again).toHaveBeenCalledWith({ item: { id: 'torch', item_name: 'Torch' }, status: 'ready' });
    });

    test('stopping twice does not start two teardowns', () => {
        const unsubscribe = subscribeItem('torch', jest.fn());
        unsubscribe();
        unsubscribe();
        jest.advanceTimersByTime(60000);
        expect(stop).toHaveBeenCalledTimes(1);
    });

    test('one going while others remain keeps listening', () => {
        const a = subscribeItem('torch', jest.fn());
        subscribeItem('torch', jest.fn());
        a();
        jest.advanceTimersByTime(60000);
        expect(stop).not.toHaveBeenCalled();
    });
});
