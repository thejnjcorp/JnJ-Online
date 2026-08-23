import { useState } from 'react';
import { arrayRemove, doc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { AddStatusDialog } from './AddStatusDialog';

export function Statuses({characterPage, userId}) {
    const [expandedIds, setExpandedIds] = useState([]);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const hasWritePermissions = userId ? (characterPage.userId === userId || characterPage.canWrite?.includes(userId)) : false;
    const statuses = characterPage.statuses || [];

    function toggleExpanded(statusId) {
        setExpandedIds(prev => prev.includes(statusId) ? prev.filter(id => id !== statusId) : [...prev, statusId]);
    }

    async function handleRemove(status) {
        try {
            await updateDoc(doc(db, "characters", characterPage.character_id), {
                statuses: arrayRemove(status)
            });
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
                        <span>{status.name}</span>
                        {status.stacks > 0 && <span className="CharacterPage-status-chip-badge">{status.stacks}</span>}
                    </button>
                    {expandedIds.includes(status.id) && <div className="CharacterPage-status-detail">
                        <div className="CharacterPage-status-detail-description">{status.description}</div>
                        {hasWritePermissions && <button className="CharacterPage-status-detail-remove" onClick={() => handleRemove(status)}>Remove</button>}
                    </div>}
                </div>
            )}
            {hasWritePermissions && <button className="CharacterPage-status-add-button" onClick={() => setAddDialogOpen(true)}>
                + Add Status
            </button>}
        </div>
        {addDialogOpen && <AddStatusDialog characterPage={characterPage} onClose={() => setAddDialogOpen(false)}/>}
    </div>
}
