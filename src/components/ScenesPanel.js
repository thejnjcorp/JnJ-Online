import { useEscapeKey } from '../utils/useEscapeKey';

// A big popup over the scenes for the things that belong to the scene framework but aren't
// a scene themselves - the campaign's maps, the director's notes - so they are one click
// away from the timeline, the builder and the runner without leaving where you were.
export function ScenesPanel({ title, onClose, children }) {
    useEscapeKey(onClose);
    return <>
        <button type="button" className="Scenes-scrim" aria-label="Close" onClick={onClose}/>
        <dialog open className="Scenes-panel" aria-modal="true" aria-label={title}>
            <div className="Scenes-panel-head">
                <h2 className="Scenes-dialog-title">{title}</h2>
                <button type="button" className="Scenes-icon-button" aria-label={`Close ${title}`} onClick={onClose}>&times;</button>
            </div>
            <div className="Scenes-panel-body">{children}</div>
        </dialog>
    </>;
}
