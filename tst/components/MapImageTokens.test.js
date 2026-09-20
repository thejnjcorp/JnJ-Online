import { render, screen, fireEvent } from '@testing-library/react';
import { MapImageTokens } from '../../src/components/MapImageTokens';
import { KEY_STEP } from '../../src/utils/mapImageTokens';

// a 1000px wide map, 500px tall (aspect 0.5): 1 map width = 1000px
const tokens = [
    { id: 'a', image: 'https://example.com/fire.png', label: 'Fire', x: 0.2, y: 0.1, size: 0.07 },
    { id: 'b', image: 'https://example.com/tree.png', label: '', x: 0.6, y: 0.2, size: 0.12 },
];

function setup(props = {}) {
    const handlers = { onSelect: jest.fn(), onMove: jest.fn(), onRemove: jest.fn() };
    const view = render(<MapImageTokens tokens={tokens} aspect={0.5} canEdit {...handlers} {...props} />);
    const layer = view.container.querySelector('.MapImageTokens');
    layer.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 500, right: 1000, bottom: 500, x: 0, y: 0 });
    const token = name => screen.getByRole('button', { name });
    const pointer = (element, type, x, y, extra = {}) => fireEvent(element, Object.assign(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, ...extra }), { pointerId: 1, pointerType: 'mouse' }));
    return { ...view, ...handlers, layer, token, pointer };
}

describe('MapImageTokens', () => {
    describe('showing them', () => {
        test('puts each at its spot as a share of the map, and as wide as its size', () => {
            const { token } = setup();
            expect(token('Fire').style.left).toBe('20%');
            expect(token('Fire').style.top).toBe('20%'); // y is in map widths: 0.1 of the width is 0.2 of a map half as tall
            expect(parseFloat(token('Fire').style.width)).toBeCloseTo(7);
            expect(parseFloat(token('Image token').style.width)).toBeCloseTo(12);
        });

        test('shows each picture, named for what the director called it', () => {
            const { token } = setup();
            expect(token('Fire').querySelector('img')).toHaveAttribute('src', 'https://example.com/fire.png');
            expect(token('Fire')).toHaveAttribute('title', 'Fire');
            expect(token('Image token')).not.toHaveAttribute('title');
        });

        test('shows nothing for a map with none', () => {
            const { layer } = setup({ tokens: [] });
            expect(layer).toBeEmptyDOMElement();
        });
    });

    describe('for everyone who is not editing', () => {
        test('are pictures only: nothing to press, and the name is its description', () => {
            setup({ canEdit: false });
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
            expect(screen.getByAltText('Fire')).toHaveAttribute('src', 'https://example.com/fire.png');
            expect(screen.getByAltText('Image token')).toBeInTheDocument();
        });

        test('one whose picture will not load is not shown at all', () => {
            setup({ canEdit: false });
            fireEvent.error(screen.getByAltText('Fire'));
            expect(screen.queryByAltText('Fire')).not.toBeInTheDocument();
            expect(screen.getByAltText('Image token')).toBeInTheDocument();
        });
    });

    describe('selecting', () => {
        test('pressing one selects it', () => {
            const { token, pointer, onSelect } = setup();
            pointer(token('Fire'), 'pointerdown', 200, 100, { button: 0 });
            expect(onSelect).toHaveBeenCalledWith('a');
        });

        test('the selected one is marked', () => {
            const { token } = setup({ selected: 'b' });
            expect(token('Image token')).toHaveAttribute('aria-pressed', 'true');
            expect(token('Image token')).toHaveClass('MapImageToken-selected');
            expect(token('Fire')).toHaveAttribute('aria-pressed', 'false');
        });

        test('a right click does not', () => {
            const { token, pointer, onSelect } = setup();
            pointer(token('Fire'), 'pointerdown', 200, 100, { button: 2 });
            expect(onSelect).not.toHaveBeenCalled();
        });
    });

    describe('dragging', () => {
        test('moves it as the pointer moves and saves the spot where it is let go', () => {
            const { token, pointer, onMove } = setup();
            pointer(token('Fire'), 'pointerdown', 200, 100, { button: 0 });
            pointer(token('Fire'), 'pointermove', 500, 200);
            expect(token('Fire').style.left).toBe('50%');
            expect(token('Fire')).toHaveClass('MapImageToken-dragging');
            expect(onMove).not.toHaveBeenCalled();

            pointer(token('Fire'), 'pointerup', 500, 200);
            expect(onMove).toHaveBeenCalledWith('a', { x: 0.5, y: 0.2 });
            expect(token('Fire')).not.toHaveClass('MapImageToken-dragging');
        });

        test('keeps the spot it was grabbed at, so it does not jump to the pointer', () => {
            const { token, pointer, onMove } = setup();
            pointer(token('Fire'), 'pointerdown', 220, 110, { button: 0 }); // 0.02 right and 0.01 below its centre
            pointer(token('Fire'), 'pointermove', 520, 210);
            pointer(token('Fire'), 'pointerup', 520, 210);
            expect(onMove).toHaveBeenCalledWith('a', { x: 0.5, y: 0.2 });
        });

        test('cannot be taken off the map', () => {
            const { token, pointer, onMove } = setup();
            pointer(token('Fire'), 'pointerdown', 200, 100, { button: 0 });
            pointer(token('Fire'), 'pointermove', 5000, 5000);
            pointer(token('Fire'), 'pointerup', 5000, 5000);
            expect(onMove).toHaveBeenCalledWith('a', { x: 1, y: 0.5 });
        });

        test('a click is not a move', () => {
            const { token, pointer, onMove } = setup();
            pointer(token('Fire'), 'pointerdown', 200, 100, { button: 0 });
            pointer(token('Fire'), 'pointermove', 201, 100);
            pointer(token('Fire'), 'pointerup', 201, 100);
            expect(onMove).not.toHaveBeenCalled();
        });

        test('a drag that is cancelled goes nowhere', () => {
            const { token, pointer, onMove } = setup();
            pointer(token('Fire'), 'pointerdown', 200, 100, { button: 0 });
            pointer(token('Fire'), 'pointermove', 500, 200);
            pointer(token('Fire'), 'pointercancel', 500, 200);
            pointer(token('Fire'), 'pointerup', 500, 200);
            expect(onMove).not.toHaveBeenCalled();
            expect(token('Fire').style.left).toBe('20%');
        });
    });

    describe('with the keyboard', () => {
        test('the arrow keys nudge the focused one', () => {
            const { token, onMove } = setup();
            fireEvent.keyDown(token('Fire'), { key: 'ArrowRight' });
            fireEvent.keyDown(token('Fire'), { key: 'ArrowDown' });
            expect(onMove).toHaveBeenNthCalledWith(1, 'a', { x: 0.22, y: 0.1 });
            expect(onMove).toHaveBeenNthCalledWith(2, 'a', { x: 0.2, y: 0.12 });
            expect(KEY_STEP).toBe(0.02);
        });

        test('a nudge cannot take it off the map', () => {
            const { token, onMove } = setup({ tokens: [{ ...tokens[0], x: 0, y: 0 }] });
            fireEvent.keyDown(token('Fire'), { key: 'ArrowLeft' });
            expect(onMove).toHaveBeenCalledWith('a', { x: 0, y: 0 });
        });

        test('Delete and Backspace remove it', () => {
            const { token, onRemove } = setup();
            fireEvent.keyDown(token('Fire'), { key: 'Delete' });
            fireEvent.keyDown(token('Image token'), { key: 'Backspace' });
            expect(onRemove).toHaveBeenNthCalledWith(1, 'a');
            expect(onRemove).toHaveBeenNthCalledWith(2, 'b');
        });

        test('other keys do nothing', () => {
            const { token, onMove, onRemove } = setup();
            fireEvent.keyDown(token('Fire'), { key: 'a' });
            expect(onMove).not.toHaveBeenCalled();
            expect(onRemove).not.toHaveBeenCalled();
        });
    });

    describe('a picture that will not load', () => {
        test('shows the director a marker they can still select, move and remove', () => {
            const { token } = setup();
            fireEvent.error(token('Fire').querySelector('img'));
            expect(token('Fire')).toHaveTextContent('Image not found');
        });
    });
});
