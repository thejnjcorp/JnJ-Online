import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import '../styles/ClassVersionControl.scss';
import Markdown from 'markdown-to-jsx';

function formatDate(timestamp) {
    if (!timestamp?.toDate) return '';
    return timestamp.toDate().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Shows which version of a class or race a character is pinned to, and lets
// people who can write to the character move it to any other version - up to
// a newer one, or back down to an older one. ClassVersionControl and
// RaceVersionControl fill in what differs between the two: the label, the
// character field holding the pinned version, and how versions are listed.
export function VersionControl({ kind, name, docId, pinned, versionField, listVersions, characterPage, userId, status, latestVersion }) {
    const [open, setOpen] = useState(false);
    const [versions, setVersions] = useState(null);
    const [error, setError] = useState('');
    const [switching, setSwitching] = useState(false);

    const canSwitch = Boolean(userId && characterPage.canWrite?.includes(userId));
    const hasUpdate = latestVersion !== null && latestVersion !== undefined && latestVersion > pinned;

    async function openDialog() {
        setOpen(true);
        setError('');
        try {
            setVersions(await listVersions(docId));
        } catch {
            setVersions([]);
            setError(`Couldn't load this ${kind.toLowerCase()}'s versions.`);
        }
    }

    async function switchToVersion(version) {
        setSwitching(true);
        try {
            await updateDoc(doc(db, 'characters', characterPage.character_id), { [versionField]: version });
            setOpen(false);
        } catch (e) {
            setError(String(e.message || e));
        }
        setSwitching(false);
    }

    if (status === 'fallback') {
        return <div className="ClassVersionControl-fallback">{kind} not available - showing this character's saved copy</div>;
    }

    return <>
        <button type="button" className="ClassVersionControl-button" onClick={openDialog}>
            <span>{kind} v{pinned}</span>
            {hasUpdate && <span className="ClassVersionControl-badge">v{latestVersion} available</span>}
        </button>

        {open && <>
            <button type="button" className="ClassVersionControl-scrim" aria-label="Close" onClick={() => setOpen(false)}/>
            <div className="ClassVersionControl-dialog" role="dialog" aria-label={`${kind} versions`}>
                <h3>{name} versions</h3>
                {!canSwitch && <p className="ClassVersionControl-hint">Only people who can edit this character can change its {kind.toLowerCase()} version.</p>}
                {error && <p className="ClassVersionControl-error">{error}</p>}
                {versions === null && <p className="ClassVersionControl-hint">Loading&hellip;</p>}
                <ul className="ClassVersionControl-list">
                    {(versions || []).map(entry => <li key={entry.version} className={entry.version === pinned ? 'ClassVersionControl-row ClassVersionControl-row-pinned' : 'ClassVersionControl-row'}>
                        <div className="ClassVersionControl-row-main">
                            <span className="ClassVersionControl-row-title">
                                v{entry.version}
                                {entry.version === latestVersion && <em> latest</em>}
                                {entry.version === pinned && <em> current</em>}
                            </span>
                            {entry.notes && <div className="ClassVersionControl-row-notes"><Markdown options={{ disableParsingRawHTML: true }}>{entry.notes}</Markdown></div>}
                            {formatDate(entry.publishedAt) && <span className="ClassVersionControl-row-date">{formatDate(entry.publishedAt)}</span>}
                        </div>
                        {canSwitch && entry.version !== pinned && <button
                            type="button"
                            className="ClassVersionControl-use-button"
                            disabled={switching}
                            onClick={() => switchToVersion(entry.version)}
                        >{entry.version > pinned ? 'Upgrade to this' : 'Switch back to this'}</button>}
                    </li>)}
                </ul>
                <button type="button" className="ClassVersionControl-close-button" onClick={() => setOpen(false)}>Close</button>
            </div>
        </>}
    </>;
}
