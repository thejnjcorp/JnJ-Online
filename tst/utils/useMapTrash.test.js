import { renderHook, act } from '@testing-library/react';
import { useMapTrash } from '../../src/utils/useMapTrash';

const at = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });

function setup(box = at(900, 400, 80, 60)) {
    const view = renderHook(() => useMapTrash());
    view.result.current.ref.current = { getBoundingClientRect: () => box };
    return view;
}

describe('useMapTrash', () => {
    test('starts with the can hidden and not lit', () => {
        const { result } = renderHook(() => useMapTrash());
        expect(result.current).toMatchObject({ carrying: false, hot: false });
    });

    test('a token being carried shows the can, and putting it down hides it again', () => {
        const { result } = setup();
        act(() => result.current.trash.carry(true));
        expect(result.current.carrying).toBe(true);
        act(() => result.current.trash.carry(false));
        expect(result.current.carrying).toBe(false);
    });

    test('the can lights up while the token is over it', () => {
        const { result } = setup();
        act(() => result.current.trash.carry(true));
        act(() => result.current.trash.hot(true));
        expect(result.current.hot).toBe(true);
        act(() => result.current.trash.hot(false));
        expect(result.current.hot).toBe(false);
    });

    test('putting the token down puts the light out too', () => {
        const { result } = setup();
        act(() => result.current.trash.carry(true));
        act(() => result.current.trash.hot(true));
        act(() => result.current.trash.carry(false));
        expect(result.current).toMatchObject({ carrying: false, hot: false });
    });

    test('says a point is over the can only when it is within it, edges included', () => {
        const { result } = setup();
        const { hit } = result.current.trash;
        expect(hit(940, 430)).toBe(true);
        expect(hit(900, 400)).toBe(true);
        expect(hit(980, 460)).toBe(true);
        expect(hit(899, 430)).toBe(false);
        expect(hit(981, 430)).toBe(false);
        expect(hit(940, 399)).toBe(false);
        expect(hit(940, 461)).toBe(false);
    });

    test('a can with no size - it is hidden - or none at all is never hit', () => {
        expect(setup(at(0, 0, 0, 0)).result.current.trash.hit(0, 0)).toBe(false);
        expect(renderHook(() => useMapTrash()).result.current.trash.hit(10, 10)).toBe(false);
    });

    test('keeps the same trash object across renders, so the layers are not re-rendered for nothing', () => {
        const { result, rerender } = renderHook(() => useMapTrash());
        const first = result.current.trash;
        rerender();
        act(() => result.current.trash.carry(true));
        expect(result.current.trash).toBe(first);
    });

    test('setting what it already is changes nothing', () => {
        let renders = 0;
        const { result } = renderHook(() => { renders += 1; return useMapTrash(); });
        const before = renders;
        act(() => result.current.trash.carry(false));
        act(() => result.current.trash.hot(false));
        expect(renders).toBe(before);
    });
});
