import { useRef } from 'react';
import { sessionState, sessionTitle } from '../utils/scenes';

// What a session's block on the strip looks like: played, now, planned with scenes in it, or nothing
// planned for it yet.
function blockKind(scenes, session) {
    const state = sessionState(scenes, session.id);
    if (state === 'planned' && !scenes.some(scene => scene.sessionId === session.id)) return 'empty';
    return state;
}

// "Whole campaign": every session as a block, with a frame around the ones the row of cards above
// is showing. Drag the frame (or press a block) to move the row.
export function ScenesMinimap({ sorted, scenes, range, onMoveTo }) {
    const bar = useRef(null);
    const count = sorted.length;

    // the session under the pointer becomes the middle of what is shown
    function moveTo(event) {
        const box = bar.current?.getBoundingClientRect();
        if (!box || box.width === 0) return;
        const shown = range.last - range.first + 1;
        const middle = ((event.clientX - box.left) / box.width) * count;
        const first = Math.min(Math.max(Math.round(middle - shown / 2), 0), Math.max(count - shown, 0));
        onMoveTo(sorted[first].id, 'auto');
    }

    const onPointerDown = event => {
        if (event.button > 0) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        moveTo(event);
    };
    const onPointerMove = event => {
        if (event.buttons === 1) moveTo(event);
    };

    const shownText = range.first === range.last ? `session ${sorted[range.first].number}` : `sessions ${sorted[range.first].number}–${sorted[range.last].number}`;
    return <section className="Scenes-minimap" aria-label="Whole campaign">
        <div className="Scenes-minimap-head">
            <span className="Scenes-arc-title">Whole campaign</span>
            <span className="Scenes-muted">{`Showing ${shownText} of ${count}. Drag the frame to move.`}</span>
        </div>
        <div className="Scenes-minimap-bar" ref={bar} onPointerDown={onPointerDown} onPointerMove={onPointerMove}>
            {sorted.map(session => <button type="button" key={session.id} className={`Scenes-minimap-block Scenes-minimap-block-${blockKind(scenes, session)}`}
                aria-label={`Show ${sessionTitle(session)}`} // a press with the mouse is the bar's own (it moves with the pointer); this is the keyboard's way
                onClick={event => event.detail === 0 && onMoveTo(session.id)}/>)}
            <div className="Scenes-minimap-frame" aria-hidden="true" style={{ left: `${(range.first / count) * 100}%`, width: `${((range.last - range.first + 1) / count) * 100}%` }}/>
        </div>
        <div className="Scenes-minimap-numbers" aria-hidden="true">
            {sorted.map(session => <span key={session.id} className={sessionState(scenes, session.id) === 'now' ? 'Scenes-minimap-now' : undefined}>{session.number}</span>)}
        </div>
    </section>;
}
