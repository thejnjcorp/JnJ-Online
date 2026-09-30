import { useState } from 'react';
import { AddStatusDialog } from './AddStatusDialog';
import { StatusChip } from './StatusChip';
import { StatusPopup } from './StatusPopup';
import { useStatusEditing } from '../utils/useStatusEditing';

// onUpdateStatuses/hasWritePermissions let a caller point this at a
// non-character write path (Director's Page enemy cards - NPCs aren't
// documents in the `characters` collection, see DirectorsPage.js's
// updateEnemyStatuses). When omitted, this defaults to exactly the original
// character-doc behavior, so the character page is unaffected.
export function Statuses({characterPage, userId, onUpdateStatuses, hasWritePermissions}) {
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const { statuses, canWrite, openStatus, toggleOpen, close, removeStatus, clearAll, changeStacks } =
        useStatusEditing({ characterPage, userId, onUpdateStatuses, hasWritePermissions });

    return <div className="CharacterPage-vitals-statuses">
        <div className="CharacterPage-vitals-statuses-header">
            <span className="CharacterPage-vitals-label">Statuses</span>
            {canWrite && statuses.length > 0 &&
                <button type="button" className="CharacterPage-status-clear-all" onClick={clearAll}>Clear All</button>}
        </div>
        <div className="CharacterPage-status-list">
            {statuses.map(status =>
                <div className="CharacterPage-status-wrap" key={status.id}>
                    <StatusChip status={status} onClick={() => toggleOpen(status.id)}/>
                </div>
            )}
            {canWrite && <button type="button" className="CharacterPage-status-add-button" onClick={() => setAddDialogOpen(true)}>
                + Add Status
            </button>}
        </div>
        {openStatus && <StatusPopup status={openStatus} canWrite={canWrite} onClose={close} onStacksChange={changeStacks} onRemove={removeStatus}/>}
        {addDialogOpen && <AddStatusDialog characterPage={characterPage} userId={userId} onClose={() => setAddDialogOpen(false)} onUpdateStatuses={onUpdateStatuses}/>}
    </div>
}
