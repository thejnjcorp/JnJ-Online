import { resetSharedListeners, subscribeShared } from '../../src/utils/sharedSnapshot';

const stop = jest.fn();
let publishToAll;
const start = jest.fn();

beforeEach(() => {
    jest.useFakeTimers();
    resetSharedListeners();
    stop.mockReset();
    start.mockReset();
    start.mockImplementation(publish => { publishToAll = publish; return stop; });
});

afterEach(() => {
    jest.useRealTimers();
});

describe('subscribeShared', () => {
    test('starts the real listener for the first one to ask, and tells it what is published', () => {
        const listener = jest.fn();
        subscribeShared('k', start, listener);
        expect(start).toHaveBeenCalledTimes(1);
        expect(listener).not.toHaveBeenCalled(); // nothing known yet
        publishToAll({ status: 'ready' });
        expect(listener).toHaveBeenCalledWith({ status: 'ready' });
    });

    test('everyone asking for the same thing shares one listener, and a late one is told what is already known', () => {
        const first = jest.fn();
        subscribeShared('k', start, first);
        publishToAll({ status: 'ready', n: 1 });
        const second = jest.fn();
        subscribeShared('k', start, second);
        expect(start).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledWith({ status: 'ready', n: 1 });
        publishToAll({ status: 'ready', n: 2 });
        expect(first).toHaveBeenLastCalledWith({ status: 'ready', n: 2 });
        expect(second).toHaveBeenLastCalledWith({ status: 'ready', n: 2 });
    });

    test('different things each get their own', () => {
        subscribeShared('a', start, jest.fn());
        subscribeShared('b', start, jest.fn());
        expect(start).toHaveBeenCalledTimes(2);
    });

    test('stops the real listener a few seconds after the last has gone, not straight away', () => {
        const unsubscribe = subscribeShared('k', start, jest.fn());
        unsubscribe();
        expect(stop).not.toHaveBeenCalled();
        jest.advanceTimersByTime(2900);
        expect(stop).not.toHaveBeenCalled();
        jest.advanceTimersByTime(200);
        expect(stop).toHaveBeenCalledTimes(1);
    });

    test('one that comes back straight away - a component remounting - finds it still going, with what it knew', () => {
        const unsubscribe = subscribeShared('k', start, jest.fn());
        publishToAll({ status: 'error' });
        unsubscribe();
        const again = jest.fn();
        subscribeShared('k', start, again);
        jest.advanceTimersByTime(60000);
        expect(start).toHaveBeenCalledTimes(1);
        expect(stop).not.toHaveBeenCalled();
        expect(again).toHaveBeenCalledWith({ status: 'error' });
    });

    test('once stopped, the next to ask starts a new one', () => {
        const unsubscribe = subscribeShared('k', start, jest.fn());
        unsubscribe();
        jest.advanceTimersByTime(5000);
        subscribeShared('k', start, jest.fn());
        expect(start).toHaveBeenCalledTimes(2);
    });

    test('while others remain it keeps going, and stopping twice does not stop it early or twice', () => {
        const a = subscribeShared('k', start, jest.fn());
        subscribeShared('k', start, jest.fn());
        a();
        a();
        jest.advanceTimersByTime(60000);
        expect(stop).not.toHaveBeenCalled();
    });

    test('resetSharedListeners stops everything and forgets it', () => {
        subscribeShared('a', start, jest.fn());
        subscribeShared('b', start, jest.fn());
        resetSharedListeners();
        expect(stop).toHaveBeenCalledTimes(2);
        subscribeShared('a', start, jest.fn());
        expect(start).toHaveBeenCalledTimes(3);
    });
});
