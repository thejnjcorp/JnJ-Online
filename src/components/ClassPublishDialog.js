import { useState } from 'react';
import '../styles/ClassPublishDialog.scss';
import MarkdownEditor from './MarkdownEditor';

// Asks for a short changelog note before publishing a new class or race
// version (see versionedDocs.js). Rendered inside ClassPage / RacePage, so it
// reuses that page's field styling.
export function ClassPublishDialog({ nextVersion, busy, onPublish, onClose, kind = 'class' }) {
    const [notes, setNotes] = useState('');

    return <>
        <button type="button" className="ClassPublishDialog-scrim" aria-label="Close" onClick={onClose}/>
        <div className="ClassPublishDialog" role="dialog" aria-label="Publish new version">
            <div className="ClassPublishDialog-title">Publish as v{nextVersion}</div>
            <p className="ClassPage-hint">
                The {kind} as it is currently saved is frozen as v{nextVersion - 1} - characters pinned to it keep it
                until someone switches them. What you have here becomes the new latest version.
            </p>
            <div>
                <span className="ClassPage-field-label">What changed?</span>
                <MarkdownEditor
                    variant="compact"
                    label="What changed?"
                    placeholder="e.g. Rebalanced Ignatious Shift, added Fleetfoot"
                    value={notes}
                    onChange={setNotes}
                    maxLength={300}
                />
            </div>
            <div className="ClassPublishDialog-actions">
                <button type="button" className="ClassPublishDialog-cancel-button" onClick={onClose} disabled={busy}>Cancel</button>
                <button type="button" className="ClassPublishDialog-publish-button" onClick={() => onPublish(notes.trim())} disabled={busy}>
                    {busy ? 'Publishing…' : `Publish v${nextVersion}`}
                </button>
            </div>
        </div>
    </>;
}
