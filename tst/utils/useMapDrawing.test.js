jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockArrayUnion = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
    arrayUnion: (...args) => mockArrayUnion(...args),
}));

// eslint-disable-next-line import/first
import { renderHook, act } from '@testing-library/react';
// eslint-disable-next-line import/first
import { useMapDrawing } from '../../src/utils/useMapDrawing';
// eslint-disable-next-line import/first
import { COLORS, MAX_STROKE_BYTES, SIZES } from '../../src/utils/mapDrawing';

const stroke = id => ({ id, color: '#e53935', size: 0.006, points: [0.1, 0.1, 0.4, 0.2] });
const map = (strokes, extra = {}) => ({ map_id: 'map-1', canWrite: ['director-1'], strokes, ...extra });

beforeEach(() => {
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockUpdateDoc.mockResolvedValue(undefined);
    mockArrayUnion.mockImplementation(value => ({ __arrayUnion: value }));
    window.alert = jest.fn();
    window.confirm = jest.fn(() => true);
});

afterEach(() => {
    delete window.alert;
    delete window.confirm;
});

describe('useMapDrawing', () => {
    describe('who can draw', () => {
        test('someone on the map\'s canWrite list can', () => {
            const { result } = renderHook(() => useMapDrawing(map([]), 'director-1'));
            expect(result.current.canDraw).toBe(true);
        });

        test('nobody else can, and their drawing tools stay off even if turned on', () => {
            const { result } = renderHook(() => useMapDrawing(map([]), 'player-1'));
            expect(result.current.canDraw).toBe(false);
            act(() => result.current.setActive(true));
            expect(result.current.drawing).toBe(false);
        });

        test('nor can anyone when there is no map or no signed-in user', () => {
            expect(renderHook(() => useMapDrawing(undefined, 'director-1')).result.current.canDraw).toBe(false);
            expect(renderHook(() => useMapDrawing(map([]), undefined)).result.current.canDraw).toBe(false);
        });
    });

    describe('the strokes', () => {
        test('are the map\'s saved strokes, for everyone', () => {
            const { result } = renderHook(() => useMapDrawing(map([stroke('a'), stroke('b')]), 'player-1'));
            expect(result.current.strokes.map(s => s.id)).toEqual(['a', 'b']);
        });

        test('are none when the map has none, or something that is not a list', () => {
            expect(renderHook(() => useMapDrawing(map(undefined), 'player-1')).result.current.strokes).toEqual([]);
            expect(renderHook(() => useMapDrawing(map('nope'), 'player-1')).result.current.strokes).toEqual([]);
        });

        test('report how full the drawing is', () => {
            const big = { ...stroke('big'), points: new Array(MAX_STROKE_BYTES / 8).fill(0.5) };
            const { result } = renderHook(() => useMapDrawing(map([big]), 'director-1'));
            expect(result.current.full).toBe(true);
            expect(renderHook(() => useMapDrawing(map([stroke('a')]), 'director-1')).result.current.full).toBe(false);
        });
    });

    describe('the tools', () => {
        test('start with the pen, the first color and a medium line, off until turned on', () => {
            const { result } = renderHook(() => useMapDrawing(map([]), 'director-1'));
            expect(result.current.active).toBe(false);
            expect(result.current.drawing).toBe(false);
            expect(result.current.tool).toBe('pen');
            expect(result.current.color).toBe(COLORS[0].value);
            expect(result.current.size).toBe(SIZES[1].value);
        });

        test('can be switched', () => {
            const { result } = renderHook(() => useMapDrawing(map([]), 'director-1'));
            act(() => { result.current.setActive(true); result.current.setTool('eraser'); result.current.setColor('#123456'); result.current.setSize(0.012); });
            expect(result.current).toMatchObject({ active: true, drawing: true, tool: 'eraser', color: '#123456', size: 0.012 });
        });
    });

    describe('saving', () => {
        test('a finished stroke is added to the map\'s list with one small write', () => {
            const { result } = renderHook(() => useMapDrawing(map([stroke('a')]), 'director-1'));
            act(() => { result.current.addStroke(stroke('b')); });
            expect(mockDoc).toHaveBeenCalledWith({}, 'maps', 'map-1');
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['maps', 'map-1'] }, { strokes: { __arrayUnion: stroke('b') } });
        });

        test('erasing rewrites the list without those strokes', () => {
            const { result } = renderHook(() => useMapDrawing(map([stroke('a'), stroke('b'), stroke('c')]), 'director-1'));
            act(() => { result.current.eraseStrokes(['a', 'c']); });
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['maps', 'map-1'] }, { strokes: [stroke('b')] });
        });

        test('undo takes off the last stroke', () => {
            const { result } = renderHook(() => useMapDrawing(map([stroke('a'), stroke('b')]), 'director-1'));
            act(() => { result.current.undo(); });
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['maps', 'map-1'] }, { strokes: [stroke('a')] });
        });

        test('undo with nothing drawn does nothing', () => {
            const { result } = renderHook(() => useMapDrawing(map([]), 'director-1'));
            act(() => { result.current.undo(); });
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        test('clear asks first, then empties the list', () => {
            const { result } = renderHook(() => useMapDrawing(map([stroke('a')]), 'director-1'));
            act(() => { result.current.clear(); });
            expect(window.confirm).toHaveBeenCalled();
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['maps', 'map-1'] }, { strokes: [] });
        });

        test('clear does nothing if not confirmed, or if there is nothing to clear', () => {
            window.confirm = jest.fn(() => false);
            const { result } = renderHook(() => useMapDrawing(map([stroke('a')]), 'director-1'));
            act(() => { result.current.clear(); });
            expect(mockUpdateDoc).not.toHaveBeenCalled();

            window.confirm = jest.fn(() => true);
            const empty = renderHook(() => useMapDrawing(map([]), 'director-1'));
            act(() => { empty.result.current.clear(); });
            expect(window.confirm).not.toHaveBeenCalled();
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        test('a failed write is reported', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            const { result } = renderHook(() => useMapDrawing(map([]), 'director-1'));
            await act(async () => { result.current.addStroke(stroke('a')); });
            expect(window.alert).toHaveBeenCalledWith("Couldn't save the drawing: offline");
        });
    });
});
