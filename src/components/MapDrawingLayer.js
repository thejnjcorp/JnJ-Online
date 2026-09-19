import { useRef, useState } from 'react';
import { ERASER_RADIUS, MIN_POINT_GAP, round, strokeIsHit, strokePath } from '../utils/mapDrawing';
import '../styles/MapDrawing.scss';

// The drawing over a map image: an SVG exactly the map's size, in "map widths"
// (see utils/mapDrawing.js), so it lines up and scales with the map. It shows
// the saved strokes. When `tool` is given (a director drawing) it also takes the
// pointer: the pen adds a stroke, the eraser removes the strokes it passes over.
// Otherwise it lets clicks through to the tokens underneath.
export function MapDrawingLayer({ strokes, aspect, tool, color, size, blocked, onStroke, onErase }) {
    const svgRef = useRef(null);
    const [points, setPoints] = useState(null); // the stroke being drawn
    const [erasing, setErasing] = useState([]); // ids the eraser has touched so far, not yet removed
    const erasingRef = useRef([]);
    const pointsRef = useRef(null);

    const at = event => {
        const box = svgRef.current.getBoundingClientRect();
        return [round((event.clientX - box.left) / box.width), round((event.clientY - box.top) / box.width)];
    };

    function eraseAt(x, y) {
        const hit = strokes.filter(stroke => !erasingRef.current.includes(stroke.id) && strokeIsHit(stroke, x, y, ERASER_RADIUS)).map(stroke => stroke.id);
        if (hit.length === 0) return;
        erasingRef.current = [...erasingRef.current, ...hit];
        setErasing(erasingRef.current);
    }

    function handleDown(event) {
        if (!tool || (event.pointerType === 'mouse' && event.button !== 0)) return;
        if (tool === 'pen' && blocked) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        const [x, y] = at(event);
        if (tool === 'eraser') {
            erasingRef.current = [];
            eraseAt(x, y);
        } else {
            pointsRef.current = [x, y];
            setPoints([x, y]);
        }
    }

    function handleMove(event) {
        if (!tool) return;
        const [x, y] = at(event);
        if (tool === 'eraser') {
            if (event.buttons) eraseAt(x, y);
            return;
        }
        const current = pointsRef.current;
        if (!current) return;
        if (Math.hypot(x - current[current.length - 2], y - current[current.length - 1]) < MIN_POINT_GAP) return;
        pointsRef.current = [...current, x, y];
        setPoints(pointsRef.current);
    }

    function handleUp() {
        if (tool === 'eraser') {
            const ids = erasingRef.current;
            erasingRef.current = [];
            setErasing([]);
            if (ids.length > 0) onErase(ids);
            return;
        }
        const finished = pointsRef.current;
        pointsRef.current = null;
        setPoints(null);
        if (finished) onStroke({ id: crypto.randomUUID(), color, size, points: finished });
    }

    return <svg
        ref={svgRef}
        className={tool ? `MapDrawing MapDrawing-active MapDrawing-${tool}` : 'MapDrawing'}
        viewBox={`0 0 1 ${aspect}`}
        aria-label="Map drawing"
        role="img"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
    >
        {strokes.filter(stroke => !erasing.includes(stroke.id)).map(stroke =>
            <path key={stroke.id} className="MapDrawing-stroke" d={strokePath(stroke.points)} stroke={stroke.color} strokeWidth={stroke.size}/>
        )}
        {points && <path className="MapDrawing-stroke MapDrawing-stroke-live" d={strokePath(points)} stroke={color} strokeWidth={size}/>}
    </svg>;
}
