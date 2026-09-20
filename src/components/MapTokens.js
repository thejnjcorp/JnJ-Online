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
//
// A token that is `defeated` is shown greyed out and crossed through. One the
// director may `select` (an NPC) is selected by pressing it (`selected` is the id,
// `onSelect(id)` is told). One that is `trashable` can be dragged onto the map's
// trash can (see MapTrashCan.js) to take it out of the fight: `trash` says where
// the can is and lights it up (see utils/mapTrash.js), and `onTrash(id)` is told
// when a token is let go over it.
export function MapTokens({ tokens, rects, aspect, canMove = false, onMove, selected = null, onSelect, trash, onTrash }) {
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
        setDrag({ id: token.id, x: token.x, y: token.y, zone: zoneAt(token, rects), trashable: Boolean(token.trashable) });
        if (token.selectable) onSelect?.(token.id);
        if (token.trashable) trash?.carry(true);
    }

    function handleMove(event) {
        if (!drag || !grab.current) return;
        const at = pointer(event);
        const spot = within(at.x + grab.current.dx, at.y + grab.current.dy);
        setDrag({ id: drag.id, ...spot, zone: zoneAt(spot, rects), trashable: drag.trashable });
        if (drag.trashable) trash?.hot(trash.hit(event.clientX, event.clientY));
    }

    function endCarry() {
        trash?.carry(false);
        trash?.hot(false);
    }

    function handleUp(event) {
        const finished = drag;
        const start = grab.current;
        grab.current = null;
        setDrag(null);
        if (finished?.trashable) {
            const overTrash = trash?.hit(event.clientX, event.clientY);
            endCarry();
            if (overTrash) {
                onTrash?.(finished.id);
                return;
            }
        }
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
            const className = ['MapToken', `MapToken-${token.kind || 'neutral'}`, canMoveToken(token) && 'MapToken-movable', token.defeated && 'MapToken-defeated', selected === token.id && 'MapToken-selected', dragging && 'MapToken-dragging', dragging && !zone && !drag.trashable && 'MapToken-outside'].filter(Boolean).join(' ');
            return <button
                key={token.id}
                type="button"
                className={className}
                style={{ left: `${x * 100}%`, top: `${(y / aspect) * 100}%`, width: `${TOKEN_SIZE * 100}%` }}
                aria-label={`${token.title || 'Combatant'}${zone ? `, ${zone}` : ''}${token.defeated ? ', defeated' : ''}`}
                aria-pressed={token.selectable ? selected === token.id : undefined}
                tabIndex={canMoveToken(token) ? 0 : -1}
                onPointerDown={event => handleDown(event, token)}
                onPointerMove={handleMove}
                onPointerUp={handleUp}
                onPointerCancel={() => { grab.current = null; setDrag(null); endCarry(); }}
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
