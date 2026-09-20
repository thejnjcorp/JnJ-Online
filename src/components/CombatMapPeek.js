import { useEffect, useRef, useState } from 'react';
import { PostListContentCombatMap } from '../utils/DraggableElements/PostListCombatMap.tsx';
import { ReactComponent as MapIcon } from '../icons/map.svg';
import '../styles/CombatMapPeek.scss';

// A quick look at the combat map without leaving the Combat tab: hover the map
// icon and the map slides out from the side; move away and it tucks back. Click
// (or Enter) pins it open - for a touch screen, a keyboard, or to move a token
// without the map going away - and Escape, the close button or the icon again
// closes it. It is the same map as the Combat Map tab's.
const OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 250;

export function CombatMapPeek({ campaignId, activeMap, entities, userId }) {
    const [hovering, setHovering] = useState(false);
    const [pinned, setPinned] = useState(false);
    const timer = useRef(null);
    const open = hovering || pinned;

    const later = (fn, ms) => {
        clearTimeout(timer.current);
        timer.current = setTimeout(fn, ms);
    };
    useEffect(() => () => clearTimeout(timer.current), []);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = event => {
            if (event.key === 'Escape') { setHovering(false); setPinned(false); }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    return <span
        className="CombatMapPeek"
        onMouseEnter={() => later(() => setHovering(true), OPEN_DELAY_MS)}
        // still holding the mouse button (dragging a token) is not leaving
        onMouseLeave={event => { if (event.buttons === 0) later(() => setHovering(false), CLOSE_DELAY_MS); else clearTimeout(timer.current); }}
    >
        <button
            type="button"
            className={open ? 'CombatMapPeek-button CombatMapPeek-button-open' : 'CombatMapPeek-button'}
            aria-label="Combat map"
            aria-expanded={open}
            aria-controls="combat-map-peek-panel"
            title="Hover to peek at the combat map - click to keep it open"
            onClick={() => { clearTimeout(timer.current); if (pinned) { setPinned(false); setHovering(false); } else setPinned(true); }}
        >
            <MapIcon/>
        </button>
        {open && <div id="combat-map-peek-panel" className="CombatMapPeek-panel" role="region" aria-label="Combat map">
            <div className="CombatMapPeek-header">
                <span className="CombatMapPeek-title">Combat map</span>
                {pinned && <button type="button" className="CombatMapPeek-close" aria-label="Close the combat map" onClick={() => { setPinned(false); setHovering(false); }}>×</button>}
            </div>
            <div className="CombatMapPeek-body">
                <PostListContentCombatMap
                    campaignId={campaignId}
                    activeMap={activeMap}
                    entities={entities}
                    userId={userId}
                    noActiveMapMessage="The director hasn't set an active combat map yet."
                />
            </div>
        </div>}
    </span>;
}
