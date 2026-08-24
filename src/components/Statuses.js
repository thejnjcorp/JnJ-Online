import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { AddStatusDialog } from './AddStatusDialog';

// onUpdateStatuses/hasWritePermissions let a caller point this at a
// non-character write path (Director's Page enemy cards - NPCs aren't
// documents in the `characters` collection, see DirectorsPage.js's
// updateEnemyStatuses). When omitted, this defaults to exactly the original
// character-doc behavior, so the character page is unaffected.
export function Statuses({characterPage, userId, onUpdateStatuses, hasWritePermissions: hasWritePermissionsProp}) {
    const [expandedIds, setExpandedIds] = useState([]);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const hasWritePermissions = hasWritePermissionsProp !== undefined
        ? hasWritePermissionsProp
        : (userId ? (characterPage.userId === userId || characterPage.canWrite?.includes(userId)) : false);
    const statuses = characterPage.statuses || [];

    function toggleExpanded(statusId) {
        setExpandedIds(prev => prev.includes(statusId) ? prev.filter(id => id !== statusId) : [...prev, statusId]);
    }

    async function writeStatuses(nextStatuses) {
        if (onUpdateStatuses) {
            await onUpdateStatuses(nextStatuses);
        } else {
            await updateDoc(doc(db, "characters", characterPage.character_id), { statuses: nextStatuses });
        }
    }

    async function handleRemove(status) {
        try {
            await writeStatuses(statuses.filter(s => s.id !== status.id));
        } catch (e) {
            alert(e);
        }
    }

    // A single whole-array write (rather than an arrayRemove+arrayUnion pair,
    // which Firestore can't apply as one atomic transform on the same field)
    // computed from the live characterPage.statuses this component already
    // has - the same "increase the Exhaustion/Wounded count" use case the
    // Add Status dialog's stepper covers at add-time, now usable after the
    // fact too.
    async function handleStacksChange(status, delta) {
        const newStacks = Math.max(0, Math.min(9, status.stacks + delta));
        if (newStacks === status.stacks) return;
        try {
            await writeStatuses(statuses.map(s => s.id === status.id ? { ...s, stacks: newStacks } : s));
        } catch (e) {
            alert(e);
        }
    }

    return <div className="CharacterPage-vitals-statuses">
        <div className="CharacterPage-vitals-statuses-header">
            <span className="CharacterPage-vitals-label">Statuses</span>
        </div>
        <div className="CharacterPage-status-list">
            {statuses.map(status =>
                <div className="CharacterPage-status-wrap" key={status.id}>
                    <button
                        className={`CharacterPage-status-chip CharacterPage-status-chip-${status.polarity || 'neutral'}`}
                        onClick={() => toggleExpanded(status.id)}
                    >
                        <span className="CharacterPage-status-chip-dot"/>
                        <span className="CharacterPage-status-chip-name">{status.name}</span>
                        {status.stacks > 0 && <span className="CharacterPage-status-chip-badge">{status.stacks}</span>}
                    </button>
                    {expandedIds.includes(status.id) && <div className="CharacterPage-status-detail">
                        <div className="CharacterPage-status-detail-description">{status.description}</div>
                        <div className="CharacterPage-status-detail-stacks">
                            <span className="CharacterPage-vitals-label">Stacks</span>
                            {hasWritePermissions
                                ? <div className="CharacterPage-status-detail-stepper">
                                    <button onClick={() => handleStacksChange(status, -1)} disabled={status.stacks <= 0}>&minus;</button>
                                    <span>{status.stacks}</span>
                                    <button onClick={() => handleStacksChange(status, 1)} disabled={status.stacks >= 9}>+</button>
                                </div>
                                : <span className="CharacterPage-status-detail-stacks-value">{status.stacks}</span>}
                        </div>
                        {hasWritePermissions && <button className="CharacterPage-status-detail-remove" onClick={() => handleRemove(status)}>Remove</button>}
                    </div>}
                </div>
            )}
            {hasWritePermissions && <button className="CharacterPage-status-add-button" onClick={() => setAddDialogOpen(true)}>
                + Add Status
            </button>}
        </div>
        {addDialogOpen && <AddStatusDialog characterPage={characterPage} userId={userId} onClose={() => setAddDialogOpen(false)} onUpdateStatuses={onUpdateStatuses}/>}
    </div>
}
