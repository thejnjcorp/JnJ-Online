import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { StatusChip } from './StatusChip';
import { MAX_STACKS, NO_STACK_COUNT, stacksLabel } from '../utils/statusEffects';
import Markdown from './ColoredMarkdown';
import '../styles/CharacterPage.scss';

// A status's details (description, stacks, and - for someone who may change
// them - the stepper and Remove) as a popup over the page, the same way an
// inventory card's details are. Rendered into document.body so a sticky or
// overflow-clipped parent (the combat tab's action bar) can't trap or cut it.
export function StatusPopup({ status, canWrite, onClose, onStacksChange, onRemove }) {
    useEffect(() => {
        const onKeyDown = event => { if (event.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    return createPortal(
        <>
            <button type="button" className="CharacterPage-status-popup-scrim" aria-label="Close" onClick={onClose}/>
            <div className="CharacterPage-status-popup" role="dialog" aria-label={`${status.name} details`}>
                <div className="CharacterPage-status-popup-header">
                    <StatusChip status={status}/>
                    <button type="button" className="CharacterPage-status-popup-close" aria-label="Close details" onClick={onClose}>×</button>
                </div>
                <div className="CharacterPage-status-detail-description"><Markdown options={{ disableParsingRawHTML: true }}>{status.description || ""}</Markdown></div>
                <div className="CharacterPage-status-detail-stacks">
                    <span className="CharacterPage-vitals-label">Stacks</span>
                    {canWrite
                        ? <div className="CharacterPage-status-detail-stepper">
                            <button type="button" onClick={() => onStacksChange(status, -1)} disabled={status.stacks <= NO_STACK_COUNT}>&minus;</button>
                            <span>{stacksLabel(status.stacks)}</span>
                            <button type="button" onClick={() => onStacksChange(status, 1)} disabled={status.stacks >= MAX_STACKS}>+</button>
                        </div>
                        : <span className="CharacterPage-status-detail-stacks-value">{stacksLabel(status.stacks)}</span>}
                </div>
                {canWrite && <button type="button" className="CharacterPage-status-detail-remove" onClick={() => onRemove(status)}>Remove</button>}
            </div>
        </>,
        document.body
    );
}
