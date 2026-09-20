import { useRef, useState } from 'react';
import { TOKEN_SIZE, tokenInitials, zoneAt } from '../utils/mapTokens';
import '../styles/MapTokens.scss';

// How far (in map widths) a keyboard arrow moves a token.
const KEY_STEP = 0.02;
// A press that moves less than this (in map widths) was a click, not a drag.
const DRAG_THRESHOLD = 0.004;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// The combatants on the map as tokens: a circle each (their portrait, or their
// initials) coloured by side, with their name under it, at the spot they sit.
// Whoever may move a token (`movable`, else `canMove` for all of them) drags one to another spot - the zone they are in
// follows from where they are dropped - or nudges the focused one with the arrow
// keys. A token dropped outside every zone goes back where it was.
//
// `tokens` are { id, title, kind, image, x, y } in map widths (see
// utils/mapTokens.js); `rects` the zones in the same units; `aspect` the map's
// height over its width; a token can say for itself whether it is `movable` (a
// player moves their own, a director everyone's). `onMove(id, { x, y }, zoneName)` is
// given each move.
export function MapTokens({ tokens, rects, aspect, canMove = false, onMove }) {
    const canMoveToken = token => token.movable ?? canMove;
    const layerRef = useRef(null);
    const grab = useRef(null);
    const [drag, setDrag] = useState(null); // { id, x, y, zone } while one is being dragged

    const pointer = event => {
        const box = layerRef.current.getBoundingClientRect();
        return { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.width };
    };
    const within = (x, y) => ({ x: clamp(x, 0, 1), y: clamp(y, 0, aspect) });

    function handleDown(event, token) {
        if (!canMoveToken(token) || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        const at = pointer(event);
        grab.current = { dx: token.x - at.x, dy: token.y - at.y, x: token.x, y: token.y };
        setDrag({ id: token.id, x: token.x, y: token.y, zone: zoneAt(token, rects) });
    }

    function handleMove(event) {
        if (!drag || !grab.current) return;
        const at = pointer(event);
        const spot = within(at.x + grab.current.dx, at.y + grab.current.dy);
        setDrag({ id: drag.id, ...spot, zone: zoneAt(spot, rects) });
    }

    function handleUp() {
        const finished = drag;
        const start = grab.current;
        grab.current = null;
        setDrag(null);
        if (!finished || !start || !finished.zone) return;
        if (Math.hypot(finished.x - start.x, finished.y - start.y) < DRAG_THRESHOLD) return;
        onMove(finished.id, { x: finished.x, y: finished.y }, finished.zone);
    }

    function handleKey(event, token) {
        const step = { ArrowLeft: [-KEY_STEP, 0], ArrowRight: [KEY_STEP, 0], ArrowUp: [0, -KEY_STEP], ArrowDown: [0, KEY_STEP] }[event.key];
        if (!canMoveToken(token) || !step) return;
        event.preventDefault();
        const spot = within(token.x + step[0], token.y + step[1]);
        const zone = zoneAt(spot, rects);
        if (zone) onMove(token.id, spot, zone);
    }

    const overZone = drag && rects.find(rect => rect.name === drag.zone);

    return <div ref={layerRef} className="MapTokens">
        {overZone && <div
            className="MapTokens-zone-highlight"
            style={{ left: `${overZone.x * 100}%`, top: `${(overZone.y / aspect) * 100}%`, width: `${overZone.w * 100}%`, height: `${(overZone.h / aspect) * 100}%` }}
        />}
        {tokens.map(token => {
            const dragging = drag?.id === token.id;
            const x = dragging ? drag.x : token.x;
            const y = dragging ? drag.y : token.y;
            const zone = dragging ? drag.zone : zoneAt(token, rects);
            const className = ['MapToken', `MapToken-${token.kind || 'neutral'}`, canMoveToken(token) && 'MapToken-movable', dragging && 'MapToken-dragging', dragging && !zone && 'MapToken-outside'].filter(Boolean).join(' ');
            return <button
                key={token.id}
                type="button"
                className={className}
                style={{ left: `${x * 100}%`, top: `${(y / aspect) * 100}%`, width: `${TOKEN_SIZE * 100}%` }}
                aria-label={`${token.title || 'Combatant'}${zone ? `, ${zone}` : ''}`}
                tabIndex={canMoveToken(token) ? 0 : -1}
                onPointerDown={event => handleDown(event, token)}
                onPointerMove={handleMove}
                onPointerUp={handleUp}
                onPointerCancel={() => { grab.current = null; setDrag(null); }}
                onKeyDown={event => handleKey(event, token)}
            >
                {token.image
                    ? <img className="MapToken-image" src={token.image} alt="" draggable={false}/>
                    : <span className="MapToken-initials">{tokenInitials(token.title)}</span>}
                <span className="MapToken-name">{token.title}</span>
            </button>;
        })}
    </div>;
}
