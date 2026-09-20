jest.mock('../../src/utils/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), doc: jest.fn(), addDoc: jest.fn(), deleteDoc: jest.fn(), onSnapshot: jest.fn(), serverTimestamp: jest.fn() }));

import { render, screen, fireEvent } from '@testing-library/react';
import { MapImageTokens } from '../../src/components/MapImageTokens';
import { KEY_STEP } from '../../src/utils/mapImageTokens';
import { DRAG_TYPE, dragPayload } from '../../src/utils/tokenLibrary';

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

    describe('a picture stored as an Imgur hash', () => {
        test('loads from Imgur', () => {
            const { token } = setup({ tokens: [{ ...tokens[0], image: 'AbC1d2E.gif' }] });
            expect(token('Fire').querySelector('img')).toHaveAttribute('src', 'https://i.imgur.com/AbC1d2E.gif');
        });
    });

    describe('dropping a token from the library', () => {
        const carried = { image: 'AbC1d2E.png', label: 'Fire', size: 0.12 };
        const payload = JSON.stringify(carried);
        // jsdom's drag events ignore coordinates, so the drop is a mouse event that carries the data
        const dropAt = (element, dataTransfer, x, y) => fireEvent(element, Object.assign(new MouseEvent('drop', { bubbles: true, cancelable: true, clientX: x, clientY: y }), { dataTransfer }));
        const transfer = (data = payload) => ({ types: [DRAG_TYPE], getData: type => (type === DRAG_TYPE ? data : ''), dropEffect: '' });

        test('is not possible until a drag has started: the layer lets clicks through', () => {
            const { layer } = setup();
            expect(layer).not.toHaveClass('MapImageTokens-droppable');
            const onDropToken = jest.fn();
            const view = setup({ onDropToken });
            fireEvent.drop(view.layer, { dataTransfer: transfer(), clientX: 500, clientY: 100 });
            expect(onDropToken).not.toHaveBeenCalled();
        });

        test('while one is being dragged the layer takes the drop', () => {
            const { layer } = setup({ droppable: true });
            expect(layer).toHaveClass('MapImageTokens-droppable');
        });

        test('over the map it says a copy can be dropped', () => {
            const { layer } = setup({ droppable: true });
            const dataTransfer = transfer();
            const notPrevented = fireEvent.dragOver(layer, { dataTransfer });
            expect(notPrevented).toBe(false); // preventDefault was called
            expect(dataTransfer.dropEffect).toBe('copy');
        });

        test('gives what was dropped and where, in map widths', () => {
            const onDropToken = jest.fn();
            const { layer } = setup({ droppable: true, onDropToken });
            dropAt(layer, transfer(), 500, 100);
            expect(onDropToken).toHaveBeenCalledWith(carried, { x: 0.5, y: 0.1 });
        });

        test('a drop off the edge is kept on the map', () => {
            const onDropToken = jest.fn();
            const { layer } = setup({ droppable: true, onDropToken });
            dropAt(layer, transfer(), 5000, 5000);
            expect(onDropToken).toHaveBeenCalledWith(carried, { x: 1, y: 0.5 });
        });

        test('works when dropped on a token that is already there', () => {
            const onDropToken = jest.fn();
            const { token } = setup({ droppable: true, onDropToken });
            dropAt(token('Fire'), transfer(), 200, 100);
            expect(onDropToken).toHaveBeenCalledWith(carried, { x: 0.2, y: 0.1 });
        });

        test('something else dragged over the map (a file, some text) is not accepted', () => {
            const onDropToken = jest.fn();
            const { layer } = setup({ droppable: true, onDropToken });
            const other = { types: ['text/plain', 'Files'], getData: () => 'hello', dropEffect: '' };
            expect(fireEvent.dragOver(layer, { dataTransfer: other })).toBe(true); // not prevented
            fireEvent.drop(layer, { dataTransfer: other, clientX: 500, clientY: 100 });
            expect(onDropToken).not.toHaveBeenCalled();
        });

        test('what claims to be a token but is not a usable one is refused', () => {
            const onDropToken = jest.fn();
            const { layer } = setup({ droppable: true, onDropToken });
            fireEvent.drop(layer, { dataTransfer: transfer(JSON.stringify({ image: 'javascript:alert(1)', size: 0.1 })), clientX: 500, clientY: 100 });
            dropAt(layer, transfer('not json'), 500, 100);
            expect(onDropToken).not.toHaveBeenCalled();
        });

        test('takes what the palette really carries', () => {
            const onDropToken = jest.fn();
            const { layer } = setup({ droppable: true, onDropToken });
            dropAt(layer, transfer(dragPayload({ image: 'AbC1d2E.png', label: 'Fire', size: 0.12 })), 500, 100);
            expect(onDropToken).toHaveBeenCalledWith(carried, { x: 0.5, y: 0.1 });
        });
    });

    describe('a picture that will not load', () => {
        test('shows the director a marker they can still select, move and remove', () => {
            const { token } = setup();
            fireEvent.error(token('Fire').querySelector('img'));
            expect(token('Fire')).toHaveTextContent('Image not found');
        });
    });
    describe('dropping a token on the trash can', () => {
        const fakeTrash = (over = false) => ({ carry: jest.fn(), hot: jest.fn(), hit: jest.fn(() => over) });

        test('shows the can as soon as one is picked up, and lights it as the pointer goes over', () => {
            const trash = fakeTrash(true);
            const { token, pointer } = setup({ trash });
            pointer(token('Fire'), 'pointerdown', 200, 100, { button: 0 });
            expect(trash.carry).toHaveBeenCalledWith(true);
            pointer(token('Fire'), 'pointermove', 950, 480);
            expect(trash.hit).toHaveBeenCalledWith(950, 480);
            expect(trash.hot).toHaveBeenLastCalledWith(true);
        });

        test('let go over the can it is removed, and does not move', () => {
            const trash = fakeTrash(true);
            const { token, pointer, onRemove, onMove } = setup({ trash });
            pointer(token('Fire'), 'pointerdown', 200, 100, { button: 0 });
            pointer(token('Fire'), 'pointermove', 500, 200);
            pointer(token('Fire'), 'pointerup', 950, 480);
            expect(onRemove).toHaveBeenCalledWith('a');
            expect(onMove).not.toHaveBeenCalled();
            expect(trash.carry).toHaveBeenLastCalledWith(false);
            expect(trash.hot).toHaveBeenLastCalledWith(false);
        });

        test('let go anywhere else it moves as usual, and the can goes away', () => {
            const trash = fakeTrash(false);
            const { token, pointer, onRemove, onMove } = setup({ trash });
            pointer(token('Fire'), 'pointerdown', 200, 100, { button: 0 });
            pointer(token('Fire'), 'pointermove', 500, 200);
            pointer(token('Fire'), 'pointerup', 500, 200);
            expect(onRemove).not.toHaveBeenCalled();
            expect(onMove).toHaveBeenCalledWith('a', { x: 0.5, y: 0.2 });
            expect(trash.carry).toHaveBeenLastCalledWith(false);
        });

        test('a plain click on the can\'s spot without a drag still counts as a drop only if the pointer is there', () => {
            const trash = fakeTrash(false);
            const { token, pointer, onRemove } = setup({ trash });
            pointer(token('Fire'), 'pointerdown', 200, 100, { button: 0 });
            pointer(token('Fire'), 'pointerup', 200, 100);
            expect(onRemove).not.toHaveBeenCalled();
        });

        test('a cancelled drag puts the can away', () => {
            const trash = fakeTrash();
            const { token, pointer } = setup({ trash });
            pointer(token('Fire'), 'pointerdown', 200, 100, { button: 0 });
            pointer(token('Fire'), 'pointercancel', 200, 100);
            expect(trash.carry).toHaveBeenLastCalledWith(false);
        });

        test('without a trash can it moves as before', () => {
            const { token, pointer, onMove, onRemove } = setup();
            pointer(token('Fire'), 'pointerdown', 200, 100, { button: 0 });
            pointer(token('Fire'), 'pointermove', 500, 200);
            pointer(token('Fire'), 'pointerup', 500, 200);
            expect(onMove).toHaveBeenCalled();
            expect(onRemove).not.toHaveBeenCalled();
        });
    });
});
