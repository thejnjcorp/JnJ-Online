import { COLORS, ERASER_RADIUS, MAX_STROKE_BYTES, SIZES, drawingFullness, round, strokeBytes, strokeIsHit, strokePath, strokesBytes, validStrokes } from '../../src/utils/mapDrawing';

const stroke = (points, extra = {}) => ({ id: 's', color: '#e53935', size: 0.006, points, ...extra });

describe('the palette', () => {
    test('offers named colors as #rrggbb, and three line widths from thin to thick', () => {
        COLORS.forEach(color => expect(color.value).toMatch(/^#[0-9a-f]{6}$/i));
        expect(new Set(COLORS.map(color => color.key)).size).toBe(COLORS.length);
        expect(SIZES.map(size => size.key)).toEqual(['thin', 'medium', 'thick']);
        expect(SIZES[0].value).toBeLessThan(SIZES[1].value);
        expect(SIZES[1].value).toBeLessThan(SIZES[2].value);
    });
});

describe('round', () => {
    test('keeps four decimal places', () => {
        expect(round(0.123456)).toBe(0.1235);
        expect(round(1)).toBe(1);
    });
});

describe('strokePath', () => {
    test('a stroke with too few points has no path', () => {
        expect(strokePath([])).toBe('');
        expect(strokePath([0.1])).toBe('');
        expect(strokePath(undefined)).toBe('');
    });

    test('one tap is a dot: a tiny line for the round cap to draw', () => {
        expect(strokePath([0.5, 0.25])).toBe('M 0.5 0.25 l 0.0001 0');
    });

    test('two points are a straight line', () => {
        expect(strokePath([0.1, 0.1, 0.3, 0.2])).toBe('M 0.1 0.1 L 0.3 0.2');
    });

    test('more points are a smooth curve through the midpoints, ending on the last point', () => {
        expect(strokePath([0, 0, 0.2, 0.2, 0.4, 0])).toBe('M 0 0 Q 0.2 0.2 0.3 0.1 L 0.4 0');
    });
});

describe('strokeIsHit', () => {
    const line = stroke([0.1, 0.1, 0.5, 0.1]);

    test('is hit within the eraser radius of any part of the line', () => {
        expect(strokeIsHit(line, 0.3, 0.1)).toBe(true);
        expect(strokeIsHit(line, 0.3, 0.1 + ERASER_RADIUS)).toBe(true);
        expect(strokeIsHit(line, 0.1, 0.1)).toBe(true);
    });

    test('is not hit further away, or beyond the ends of the line', () => {
        expect(strokeIsHit(line, 0.3, 0.2)).toBe(false);
        expect(strokeIsHit(line, 0.7, 0.1)).toBe(false);
    });

    test('a thicker line is easier to hit', () => {
        const thick = stroke([0.1, 0.1, 0.5, 0.1], { size: 0.1 });
        expect(strokeIsHit(thick, 0.3, 0.1 + ERASER_RADIUS + 0.03)).toBe(true);
    });

    test('a dot is hit near its one point', () => {
        const dot = stroke([0.4, 0.4]);
        expect(strokeIsHit(dot, 0.405, 0.4)).toBe(true);
        expect(strokeIsHit(dot, 0.6, 0.4)).toBe(false);
    });

    test('follows each segment of a bent line', () => {
        const bent = stroke([0.1, 0.1, 0.3, 0.1, 0.3, 0.4]);
        expect(strokeIsHit(bent, 0.3, 0.3)).toBe(true);
        expect(strokeIsHit(bent, 0.1, 0.3)).toBe(false);
    });

    test('a stroke with no points is never hit', () => {
        expect(strokeIsHit(stroke([]), 0.1, 0.1)).toBe(false);
    });
});

describe('drawing space', () => {
    test('a stroke costs 8 bytes per number plus a little for its other fields', () => {
        expect(strokeBytes(stroke([0, 0, 1, 1]))).toBe(100 + 32);
        expect(strokesBytes([stroke([0, 0]), stroke([0, 0, 1, 1])])).toBe(100 + 16 + 100 + 32);
        expect(strokesBytes([])).toBe(0);
    });

    test('fullness is the share of the allowance used, capped at 1', () => {
        expect(drawingFullness([])).toBe(0);
        const half = stroke(new Array(Math.round((MAX_STROKE_BYTES / 2 - 100) / 8)).fill(0.1));
        expect(drawingFullness([half])).toBeCloseTo(0.5, 2);
        expect(drawingFullness([half, half, half])).toBe(1);
    });
});

describe('validStrokes', () => {
    test('keeps well-formed strokes and drops anything else', () => {
        const good = stroke([0, 0, 1, 1]);
        expect(validStrokes([good, null, 'x', { id: 'a' }, stroke([0.5]), stroke([0, 0, 1, 1], { color: 'red' }), stroke([0, 0, 1, 1], { id: 5 })])).toEqual([good]);
    });

    test('a missing or wrong-shaped list is no strokes', () => {
        expect(validStrokes(undefined)).toEqual([]);
        expect(validStrokes({ 0: 'x' })).toEqual([]);
    });
});
