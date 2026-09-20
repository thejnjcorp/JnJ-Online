import { forwardRef } from 'react';
import '../styles/MapTrash.scss';

// A trash can in the corner of the combat map, for a director to drop a token on to
// take it away: an image token is deleted, an enemy or other NPC is taken out of the
// fight. It only shows while such a token is being carried (`carrying`) and lights up
// when the pointer is over it (`hot`). It is not itself a control - dropping is
// worked out from where the pointer is (see useMapTrash.js) - so it is hidden from
// assistive tech; the same things can be done from the toolbar.
export const MapTrashCan = forwardRef(function MapTrashCan({ carrying, hot }, ref) {
    const className = ['MapTrash', carrying && 'MapTrash-visible', hot && 'MapTrash-hot'].filter(Boolean).join(' ');
    return <div ref={ref} className={className} aria-hidden="true">
        <svg className="MapTrash-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16"/>
            <path d="M9 7V4.5h6V7"/>
            <path d="M6 7l1 13h10l1-13"/>
            <path d="M10 11v6M14 11v6"/>
        </svg>
        <span className="MapTrash-label">{hot ? 'Let go to remove' : 'Drop here to remove'}</span>
    </div>;
});
