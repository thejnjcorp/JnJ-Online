import { useRef, useState } from 'react';
import { KEY_STEP, clampToMap } from '../utils/mapImageTokens';
import '../styles/MapImageTokens.scss';

// A press that moves less than this (in map widths) was a click, not a drag.
const DRAG_THRESHOLD = 0.004;

// The director's image tokens on the combat map: a picture each, centred on its
// spot, at its size, in the order they were added (later ones on top). Everyone sees
// them; someone who can edit the map (`canEdit`) also drags one to move it, selects
// it (click or Enter) to resize, copy or remove it from the toolbar, nudges the
// focused one with the arrow keys and removes it with Delete. They sit under the
// drawing and under the combatants' tokens, and are tied to no zone.
//
// `tokens` are { id, image, label, x, y, size } in map widths (see
// utils/mapImageTokens.js); `aspect` is the map's height over its width. `onMove(id,
// { x, y })`, `onSelect(id)` and `onRemove(id)` are called for the edits.
export function MapImageTokens({ tokens, aspect, canEdit = false, selected = null, onSelect, onMove, onRemove }) {
    const layerRef = useRef(null);
    const grab = useRef(null);
    const [drag, setDrag] = useState(null); // { id, x, y } while one is being dragged
    const [broken, setBroken] = useState([]); // ids of pictures that would not load

    const pointer = event => {
        const box = layerRef.current.getBoundingClientRect();
        return { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.width };
    };

    function handleDown(event, token) {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        const at = pointer(event);
        grab.current = { dx: token.x - at.x, dy: token.y - at.y, x: token.x, y: token.y };
        setDrag({ id: token.id, x: token.x, y: token.y });
        onSelect(token.id);
    }

    function handleMove(event) {
        if (!drag || !grab.current) return;
        const at = pointer(event);
        setDrag({ id: drag.id, ...clampToMap({ x: at.x + grab.current.dx, y: at.y + grab.current.dy }, aspect) });
    }

    function handleUp() {
        const finished = drag;
        const start = grab.current;
        grab.current = null;
        setDrag(null);
        if (!finished || !start) return;
        if (Math.hypot(finished.x - start.x, finished.y - start.y) < DRAG_THRESHOLD) return;
        onMove(finished.id, { x: finished.x, y: finished.y });
    }

    function handleKey(event, token) {
        if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            onRemove(token.id);
            return;
        }
        const step = { ArrowLeft: [-KEY_STEP, 0], ArrowRight: [KEY_STEP, 0], ArrowUp: [0, -KEY_STEP], ArrowDown: [0, KEY_STEP] }[event.key];
        if (!step) return;
        event.preventDefault();
        onMove(token.id, clampToMap({ x: token.x + step[0], y: token.y + step[1] }, aspect));
    }

    return <div ref={layerRef} className="MapImageTokens">
        {tokens.map(token => {
            const dragging = drag?.id === token.id;
            const x = dragging ? drag.x : token.x;
            const y = dragging ? drag.y : token.y;
            const style = { left: `${x * 100}%`, top: `${(y / aspect) * 100}%`, width: `${token.size * 100}%` };
            const name = token.label || 'Image token';
            const isBroken = broken.includes(token.id);
            const picture = isBroken
                ? <span className="MapImageToken-broken">Image not found</span>
                : <img
                    className="MapImageToken-image"
                    src={token.image}
                    alt={canEdit ? '' : name}
                    draggable={false}
                    onError={() => setBroken(current => [...current, token.id])}
                />;

            if (!canEdit) {
                // nothing to do for a picture nobody can see
                return isBroken ? null : <div key={token.id} className="MapImageToken" style={style} title={token.label || undefined}>{picture}</div>;
            }
            const className = ['MapImageToken', 'MapImageToken-editable', selected === token.id && 'MapImageToken-selected', dragging && 'MapImageToken-dragging'].filter(Boolean).join(' ');
            return <button
                key={token.id}
                type="button"
                className={className}
                style={style}
                title={token.label || undefined}
                aria-label={name}
                aria-pressed={selected === token.id}
                onPointerDown={event => handleDown(event, token)}
                onPointerMove={handleMove}
                onPointerUp={handleUp}
                onPointerCancel={() => { grab.current = null; setDrag(null); }}
                onKeyDown={event => handleKey(event, token)}
            >{picture}</button>;
        })}
    </div>;
}
