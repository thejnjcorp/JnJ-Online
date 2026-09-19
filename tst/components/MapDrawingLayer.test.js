import { render, screen, fireEvent } from '@testing-library/react';
import { MapDrawingLayer } from '../../src/components/MapDrawingLayer';

const line = (id, points, color = '#1e88e5') => ({ id, color, size: 0.006, points });

// jsdom has no layout: a 1000 x 500 box at (0, 0) makes 1 map width = 1000px
const BOX = { left: 0, top: 0, width: 1000, height: 500, right: 1000, bottom: 500, x: 0, y: 0 };

function setup(props = {}) {
    const onStroke = jest.fn();
    const onErase = jest.fn();
    const view = render(<MapDrawingLayer strokes={[]} aspect={0.5} tool={null} color="#e53935" size={0.006} onStroke={onStroke} onErase={onErase} {...props} />);
    const svg = screen.getByRole('img', { name: 'Map drawing' });
    svg.getBoundingClientRect = () => BOX;
    const pointer = (type, x, y, extra = {}) => fireEvent(svg, Object.assign(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, ...extra }), { pointerId: 1, pointerType: 'mouse' }));
    return { ...view, svg, onStroke, onErase, pointer };
}

beforeEach(() => {
    window.crypto.randomUUID = jest.fn(() => 'new-stroke');
});

describe('MapDrawingLayer', () => {
    describe('showing the drawing', () => {
        test('is an SVG in map widths, as tall as the map is relative to its width', () => {
            const { svg } = setup({ aspect: 0.625 });
            expect(svg).toHaveAttribute('viewBox', '0 0 1 0.625');
        });

        test('draws each saved stroke in its own color and width', () => {
            const { container } = setup({ strokes: [line('a', [0.1, 0.1, 0.4, 0.2], '#43a047'), line('b', [0.2, 0.2, 0.5, 0.5], '#fdd835')] });
            const paths = container.querySelectorAll('path');
            expect(paths).toHaveLength(2);
            expect(paths[0]).toHaveAttribute('stroke', '#43a047');
            expect(paths[0]).toHaveAttribute('stroke-width', '0.006');
            expect(paths[0]).toHaveAttribute('d', 'M 0.1 0.1 L 0.4 0.2');
            expect(paths[1]).toHaveAttribute('stroke', '#fdd835');
        });

        test('lets clicks through to the tokens underneath when not drawing', () => {
            const { svg } = setup();
            expect(svg).not.toHaveClass('MapDrawing-active');
        });

        test('nothing happens when it is pressed and dragged while not drawing', () => {
            const { pointer, onStroke, onErase, container } = setup();
            pointer('pointerdown', 100, 100, { buttons: 1, button: 0 });
            pointer('pointermove', 300, 200, { buttons: 1 });
            pointer('pointerup', 300, 200);
            expect(onStroke).not.toHaveBeenCalled();
            expect(onErase).not.toHaveBeenCalled();
            expect(container.querySelectorAll('path')).toHaveLength(0);
        });
    });

    describe('the pen', () => {
        const draw = (pointer, xs) => {
            pointer('pointerdown', xs[0][0], xs[0][1], { buttons: 1, button: 0 });
            xs.slice(1).forEach(([x, y]) => pointer('pointermove', x, y, { buttons: 1 }));
            pointer('pointerup', xs[xs.length - 1][0], xs[xs.length - 1][1]);
        };

        test('takes the pointer while drawing', () => {
            const { svg } = setup({ tool: 'pen' });
            expect(svg).toHaveClass('MapDrawing-active', 'MapDrawing-pen');
        });

        test('saves a stroke when the pen is lifted, in map widths (y too, by width)', () => {
            const { pointer, onStroke } = setup({ tool: 'pen', color: '#8e24aa', size: 0.012 });
            draw(pointer, [[100, 100], [300, 200], [500, 250]]);
            expect(onStroke).toHaveBeenCalledTimes(1);
            expect(onStroke).toHaveBeenCalledWith({ id: 'new-stroke', color: '#8e24aa', size: 0.012, points: [0.1, 0.1, 0.3, 0.2, 0.5, 0.25] });
        });

        test('shows the line as it is drawn, before anything is saved', () => {
            const { pointer, onStroke, container } = setup({ tool: 'pen' });
            pointer('pointerdown', 100, 100, { buttons: 1, button: 0 });
            pointer('pointermove', 300, 200, { buttons: 1 });
            expect(container.querySelector('.MapDrawing-stroke-live')).toHaveAttribute('d', 'M 0.1 0.1 L 0.3 0.2');
            expect(onStroke).not.toHaveBeenCalled();

            pointer('pointerup', 300, 200);
            expect(container.querySelector('.MapDrawing-stroke-live')).not.toBeInTheDocument();
        });

        test('a tap is a dot', () => {
            const { pointer, onStroke } = setup({ tool: 'pen' });
            pointer('pointerdown', 400, 100, { buttons: 1, button: 0 });
            pointer('pointerup', 400, 100);
            expect(onStroke).toHaveBeenCalledWith(expect.objectContaining({ points: [0.4, 0.1] }));
        });

        test('leaves out points that are barely a move from the last one', () => {
            const { pointer, onStroke } = setup({ tool: 'pen' });
            draw(pointer, [[100, 100], [100.5, 100.5], [101, 101], [300, 100]]);
            expect(onStroke.mock.calls[0][0].points).toEqual([0.1, 0.1, 0.3, 0.1]);
        });

        test('a move with no pen down draws nothing', () => {
            const { pointer, onStroke, container } = setup({ tool: 'pen' });
            pointer('pointermove', 300, 200, { buttons: 0 });
            expect(container.querySelector('.MapDrawing-stroke-live')).not.toBeInTheDocument();
            pointer('pointerup', 300, 200);
            expect(onStroke).not.toHaveBeenCalled();
        });

        test('a mouse button other than the main one does not draw', () => {
            const { pointer, onStroke } = setup({ tool: 'pen' });
            pointer('pointerdown', 100, 100, { buttons: 2, button: 2 });
            pointer('pointerup', 100, 100);
            expect(onStroke).not.toHaveBeenCalled();
        });

        test('a cancelled touch still saves what was drawn', () => {
            const { pointer, onStroke } = setup({ tool: 'pen' });
            pointer('pointerdown', 100, 100, { buttons: 1, button: 0 });
            pointer('pointermove', 300, 100, { buttons: 1 });
            pointer('pointercancel', 300, 100);
            expect(onStroke).toHaveBeenCalledTimes(1);
        });

        test('cannot draw when the drawing is full', () => {
            const { pointer, onStroke } = setup({ tool: 'pen', blocked: true });
            draw(pointer, [[100, 100], [300, 200]]);
            expect(onStroke).not.toHaveBeenCalled();
        });
    });

    describe('the eraser', () => {
        const strokes = [line('a', [0.1, 0.1, 0.5, 0.1]), line('b', [0.1, 0.4, 0.5, 0.4])];

        test('removes the strokes it is dragged across when released', () => {
            const { pointer, onErase } = setup({ tool: 'eraser', strokes });
            pointer('pointerdown', 300, 100, { buttons: 1, button: 0 });
            pointer('pointermove', 320, 100, { buttons: 1 });
            expect(onErase).not.toHaveBeenCalled();
            pointer('pointerup', 320, 100);
            expect(onErase).toHaveBeenCalledWith(['a']);
        });

        test('hides a stroke as soon as it is touched', () => {
            const { pointer, container } = setup({ tool: 'eraser', strokes });
            expect(container.querySelectorAll('path')).toHaveLength(2);
            pointer('pointerdown', 300, 100, { buttons: 1, button: 0 });
            expect(container.querySelectorAll('path')).toHaveLength(1);
        });

        test('can take several strokes in one drag', () => {
            const { pointer, onErase } = setup({ tool: 'eraser', strokes });
            pointer('pointerdown', 300, 100, { buttons: 1, button: 0 });
            pointer('pointermove', 300, 400, { buttons: 1 });
            pointer('pointerup', 300, 400);
            expect(onErase).toHaveBeenCalledWith(['a', 'b']);
        });

        test('touching nothing erases nothing', () => {
            const { pointer, onErase } = setup({ tool: 'eraser', strokes });
            pointer('pointerdown', 300, 250, { buttons: 1, button: 0 });
            pointer('pointerup', 300, 250);
            expect(onErase).not.toHaveBeenCalled();
        });

        test('moving over a stroke without pressing does not erase it', () => {
            const { pointer, onErase, container } = setup({ tool: 'eraser', strokes });
            pointer('pointermove', 300, 100, { buttons: 0 });
            expect(container.querySelectorAll('path')).toHaveLength(2);
            expect(onErase).not.toHaveBeenCalled();
        });

        test('can still erase when the drawing is full', () => {
            const { pointer, onErase } = setup({ tool: 'eraser', strokes, blocked: true });
            pointer('pointerdown', 300, 100, { buttons: 1, button: 0 });
            pointer('pointerup', 300, 100);
            expect(onErase).toHaveBeenCalledWith(['a']);
        });
    });
});
