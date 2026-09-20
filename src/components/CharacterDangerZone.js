import { useState } from 'react';
import { archiveCharacter, cancelCharacterDeletion, canRetireCharacter, DELETION_GRACE_DAYS, deletionDate, formatDeletionDate, isArchived, scheduleCharacterDeletion, unarchiveCharacter } from '../utils/characterArchive';
import '../styles/CampaignPage.scss';

// Archiving and deleting a character, for its owner (see canRetireCharacter):
// nothing at all for anyone else. Laid out like a campaign's danger zone.
export function CharacterDangerZone({ character, userId }) {
    const [confirming, setConfirming] = useState(false);
    if (!canRetireCharacter(character, userId)) return null;

    const id = character.character_id;
    const archived = isArchived(character);
    const scheduled = deletionDate(character);
    const run = action => action(id).catch(error => alert(error));

    return <>
        <section className="CampaignPage-danger-zone">
            <h2>Danger Zone</h2>

            {!archived && <div className="CampaignPage-danger-row">
                <div>
                    <div className="CampaignPage-danger-title">Archive this character</div>
                    <p className="CampaignPage-danger-help">Takes it off your characters list and out of the combat tracker. Fully reversible.</p>
                </div>
                <button type="button" className="CampaignPage-danger-button" onClick={() => run(archiveCharacter)}>Archive</button>
            </div>}

            {archived && <div className="CampaignPage-danger-row">
                <div>
                    <div className="CampaignPage-danger-title">Unarchive</div>
                    <p className="CampaignPage-danger-help">Brings it back to your characters list and the combat tracker{scheduled ? ", and cancels the scheduled deletion." : "."}</p>
                </div>
                <button type="button" className="CampaignPage-danger-button" onClick={() => run(unarchiveCharacter)}>Unarchive</button>
            </div>}

            {archived && !scheduled && <div className="CampaignPage-danger-row">
                <div>
                    <div className="CampaignPage-danger-title">Schedule deletion</div>
                    <p className="CampaignPage-danger-help">Permanently deletes this character in {DELETION_GRACE_DAYS} days. You can cancel any time before then.</p>
                </div>
                <button type="button" className="CampaignPage-danger-button CampaignPage-danger-button-severe" onClick={() => setConfirming(true)}>Schedule Deletion</button>
            </div>}

            {archived && scheduled && <div className="CampaignPage-danger-row">
                <div>
                    <div className="CampaignPage-danger-title">Cancel deletion</div>
                    <p className="CampaignPage-danger-help">Keeps the character archived, but stops the countdown.</p>
                </div>
                <button type="button" className="CampaignPage-danger-button" onClick={() => run(cancelCharacterDeletion)}>Cancel Deletion</button>
            </div>}
        </section>

        {confirming && <>
            <button type="button" className="CampaignPage-scrim" style={{ border: 0, padding: 0 }} aria-label="Close" onClick={() => setConfirming(false)}/>
            <div className="CampaignPage-dialog" role="dialog" aria-modal="true" aria-label="Schedule deletion" onKeyDown={event => { if (event.key === 'Escape') setConfirming(false); }}>
                <h3>Schedule deletion?</h3>
                <p className="CampaignPage-dialog-help">
                    "{character.character_name}" will be permanently deleted in {DELETION_GRACE_DAYS} days, along with everything on its sheet. You can cancel any time before then.
                </p>
                <div className="CampaignPage-dialog-actions">
                    <button type="button" className="CampaignPage-dialog-button CampaignPage-dialog-button-danger" onClick={() => { setConfirming(false); run(scheduleCharacterDeletion); }}>Schedule Deletion</button>
                    <button type="button" className="CampaignPage-dialog-button" onClick={() => setConfirming(false)}>Cancel</button>
                </div>
            </div>
        </>}
    </>;
}

// A banner for the top of an archived character's page.
export function ArchivedCharacterBanner({ character }) {
    if (!isArchived(character)) return null;
    const scheduled = deletionDate(character);
    return <div className="CampaignPage-archived-banner" role="status">
        This character is archived - it is off the characters list and out of the combat tracker.
        {scheduled && <> It's scheduled for permanent deletion on {formatDeletionDate(scheduled)}.</>}
    </div>;
}
