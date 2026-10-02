import { fireEvent, renderHook } from '@testing-library/react';
import { useEscapeKey } from '../../src/utils/useEscapeKey';

describe('useEscapeKey', () => {
    test('calls the handler when Escape is pressed anywhere, and ignores other keys', () => {
        const onEscape = jest.fn();
        renderHook(() => useEscapeKey(onEscape));

        fireEvent.keyDown(document.body, { key: 'Enter' });
        expect(onEscape).not.toHaveBeenCalled();
        fireEvent.keyDown(document.body, { key: 'Escape' });
        expect(onEscape).toHaveBeenCalledTimes(1);
    });

    test('stops listening once the component is gone', () => {
        const onEscape = jest.fn();
        const { unmount } = renderHook(() => useEscapeKey(onEscape));
        unmount();
        fireEvent.keyDown(document.body, { key: 'Escape' });
        expect(onEscape).not.toHaveBeenCalled();
    });

    test('uses the latest handler', () => {
        const first = jest.fn();
        const second = jest.fn();
        const { rerender } = renderHook(({ handler }) => useEscapeKey(handler), { initialProps: { handler: first } });
        rerender({ handler: second });
        fireEvent.keyDown(document.body, { key: 'Escape' });
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });
});
