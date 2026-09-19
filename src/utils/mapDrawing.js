// Drawing on the combat map: a director's pen strokes, shown to everyone.
//
// A stroke is { id, color, size, points } saved in the map doc's `strokes` array.
// `points` is a flat list [x1, y1, x2, y2, ...] (Firestore can't nest an array in
// an array). Both coordinates are in "map widths": x runs 0 to 1 across the map
// and y 0 to height/width down it, so a drawing lines up at any size the map is
// shown at, and `size` (the line's width) scales with it.

export const COLORS = [
    { key: 'red', label: 'Red', value: '#e53935' },
    { key: 'orange', label: 'Orange', value: '#fb8c00' },
    { key: 'yellow', label: 'Yellow', value: '#fdd835' },
    { key: 'green', label: 'Green', value: '#43a047' },
    { key: 'blue', label: 'Blue', value: '#1e88e5' },
    { key: 'purple', label: 'Purple', value: '#8e24aa' },
    { key: 'white', label: 'White', value: '#ffffff' },
    { key: 'black', label: 'Black', value: '#111111' },
];

export const SIZES = [
    { key: 'thin', label: 'Thin', value: 0.003 },
    { key: 'medium', label: 'Medium', value: 0.006 },
    { key: 'thick', label: 'Thick', value: 0.012 },
];

// A point is kept only once it is this far (in map widths) from the last one, so a
// slow drag doesn't save hundreds of near-identical points.
export const MIN_POINT_GAP = 0.002;

// How near (in map widths) the eraser has to get to a stroke to remove it.
export const ERASER_RADIUS = 0.012;

// The map doc also holds the image link and zones, and Firestore caps a document
// at 1 MiB, so drawing stops well short of that. Firestore stores each number as
// 8 bytes; the rest is an allowance for the stroke's other fields.
export const MAX_STROKE_BYTES = 600000;

const STROKE_OVERHEAD_BYTES = 100;

export const strokeBytes = stroke => STROKE_OVERHEAD_BYTES + (stroke.points?.length || 0) * 8;

export const strokesBytes = strokes => strokes.reduce((total, stroke) => total + strokeBytes(stroke), 0);

export const drawingFullness = strokes => Math.min(1, strokesBytes(strokes) / MAX_STROKE_BYTES);

export const isHexColor = value => /^#[0-9a-f]{6}$/i.test(value || '');

export const round = value => Math.round(value * 10000) / 10000;

// The path of a stroke as a smooth line through its points (each point is a
// control point, with the curve passing through the midpoints between them).
export function strokePath(points) {
    if (!points || points.length < 2) return '';
    const pair = index => `${points[index * 2]} ${points[index * 2 + 1]}`;
    const count = Math.floor(points.length / 2);
    // one tap is a dot: a zero-length line, drawn round by the line cap
    if (count === 1) return `M ${pair(0)} l 0.0001 0`;
    if (count === 2) return `M ${pair(0)} L ${pair(1)}`;
    let path = `M ${pair(0)}`;
    for (let i = 1; i < count - 1; i++) {
        const midX = round((points[i * 2] + points[i * 2 + 2]) / 2);
        const midY = round((points[i * 2 + 1] + points[i * 2 + 3]) / 2);
        path += ` Q ${pair(i)} ${midX} ${midY}`;
    }
    return `${path} L ${pair(count - 1)}`;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Whether the eraser at (x, y) touches the stroke.
export function strokeIsHit(stroke, x, y, radius = ERASER_RADIUS) {
    const points = stroke.points || [];
    const reach = radius + (stroke.size || 0) / 2;
    if (points.length === 2) return Math.hypot(x - points[0], y - points[1]) <= reach;
    for (let i = 0; i + 3 < points.length; i += 2) {
        if (distanceToSegment(x, y, points[i], points[i + 1], points[i + 2], points[i + 3]) <= reach) return true;
    }
    return false;
}

// The saved strokes, as far as the doc can be trusted: anything not shaped like
// a stroke is left out rather than breaking the map.
export function validStrokes(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(stroke => stroke && typeof stroke.id === 'string' && Array.isArray(stroke.points) && stroke.points.length >= 2 && isHexColor(stroke.color));
}
