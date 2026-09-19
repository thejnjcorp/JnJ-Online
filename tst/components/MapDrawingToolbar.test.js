import { render, screen, fireEvent } from '@testing-library/react';
import { MapDrawingToolbar } from '../../src/components/MapDrawingToolbar';
import { COLORS, SIZES } from '../../src/utils/mapDrawing';

function setup(overrides = {}) {
    const drawing = {
        active: false, setActive: jest.fn(), tool: 'pen', setTool: jest.fn(), color: COLORS[0].value, setColor: jest.fn(),
        size: SIZES[1].value, setSize: jest.fn(), strokes: [], fullness: 0, full: false, undo: jest.fn(), clear: jest.fn(),
        ...overrides,
    };
    render(<MapDrawingToolbar drawing={drawing} />);
    return drawing;
}

describe('MapDrawingToolbar', () => {
    test('starts as one button that turns drawing on', () => {
        const drawing = setup();
        expect(screen.getByRole('button', { name: 'Draw on map' })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.queryByRole('button', { name: 'Pen' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Draw on map' }));
        expect(drawing.setActive).toHaveBeenCalledWith(true);
    });

    test('when drawing shows the tools, and the button turns it off', () => {
        const drawing = setup({ active: true });
        expect(screen.getByRole('button', { name: 'Stop drawing' })).toHaveAttribute('aria-pressed', 'true');
        ['Pen', 'Eraser', 'Thin', 'Medium', 'Thick', 'Undo', 'Clear all'].forEach(name => expect(screen.getByRole('button', { name })).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: 'Stop drawing' }));
        expect(drawing.setActive).toHaveBeenCalledWith(false);
    });

    test('the tool, color and width in use are marked, and each can be changed', () => {
        const drawing = setup({ active: true });
        expect(screen.getByRole('button', { name: 'Pen' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Eraser' })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', { name: 'Red' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Medium' })).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(screen.getByRole('button', { name: 'Eraser' }));
        fireEvent.click(screen.getByRole('button', { name: 'Blue' }));
        fireEvent.click(screen.getByRole('button', { name: 'Thick' }));
        fireEvent.change(screen.getByLabelText('Custom color'), { target: { value: '#123456' } });

        expect(drawing.setTool).toHaveBeenCalledWith('eraser');
        expect(drawing.setColor).toHaveBeenCalledWith(COLORS.find(c => c.key === 'blue').value);
        expect(drawing.setSize).toHaveBeenCalledWith(SIZES.find(s => s.key === 'thick').value);
        expect(drawing.setColor).toHaveBeenCalledWith('#123456');
    });

    test('the eraser has no colors or widths to pick', () => {
        setup({ active: true, tool: 'eraser' });
        expect(screen.queryByRole('button', { name: 'Red' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Thin' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    });

    test('Undo and Clear all work on the drawing, and are off when there is nothing drawn', () => {
        const drawing = setup({ active: true, strokes: [{ id: 'a' }] });
        fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
        fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
        expect(drawing.undo).toHaveBeenCalled();
        expect(drawing.clear).toHaveBeenCalled();
    });

    test('with nothing drawn, Undo and Clear all are disabled', () => {
        setup({ active: true });
        expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Clear all' })).toBeDisabled();
    });

    test('says nothing about drawing space until it is getting full', () => {
        setup({ active: true, fullness: 0.4 });
        expect(screen.queryByText(/of the drawing space/)).not.toBeInTheDocument();
    });

    test('a nearly full drawing shows how much is used', () => {
        setup({ active: true, fullness: 0.85, strokes: [{ id: 'a' }] });
        expect(screen.getByText('85% of the drawing space used.')).toBeInTheDocument();
    });

    test('a full drawing says so, as an alert', () => {
        setup({ active: true, fullness: 1, full: true, strokes: [{ id: 'a' }] });
        expect(screen.getByRole('alert')).toHaveTextContent('The drawing is full');
    });
});
