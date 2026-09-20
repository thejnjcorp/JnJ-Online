import { Timestamp, deleteField, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

// Retiring a character works like retiring a campaign: archive it (it leaves the
// lists and the combat tracker, and can be restored at any time), then - if it is
// really not wanted - schedule its deletion, which the daily purge carries out
// once the grace period has passed (firebase/scripts/purge-campaigns.js). Until
// then the sheet is untouched and everything can be undone.
export const DELETION_GRACE_DAYS = 30;

export const isArchived = character => Boolean(character?.archived);

// Old characters predate the `archived` field, so this is filtered on the client
// rather than with a Firestore `where`, which would leave those out.
export const withoutArchived = characters => characters.filter(character => !isArchived(character));

// Whoever owns a character: the player it was made for, and anyone the document
// names an admin. Deliberately narrower than who can edit the sheet - a director
// can change a character, but only its owner can retire it (see firestore.rules).
export const canRetireCharacter = (character, userId) => Boolean(userId)
    && (character?.playerId === userId || Boolean(character?.admins?.includes(userId)));

export const deletionDate = character => {
    const at = character?.scheduledDeletionAt;
    return at && typeof at.toDate === 'function' ? at.toDate() : null;
};

export const formatDeletionDate = date => date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

const characterDoc = characterId => doc(db, 'characters', characterId);

export const archiveCharacter = characterId => updateDoc(characterDoc(characterId), { archived: true, archivedAt: serverTimestamp() });

// Restoring is a full reset to active: a countdown must not quietly keep running
// toward deleting a character that has been brought back.
export const unarchiveCharacter = characterId => updateDoc(characterDoc(characterId), {
    archived: false,
    archivedAt: deleteField(),
    scheduledDeletionAt: deleteField(),
});

export const scheduleCharacterDeletion = characterId => updateDoc(characterDoc(characterId), {
    scheduledDeletionAt: Timestamp.fromMillis(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000),
});

export const cancelCharacterDeletion = characterId => updateDoc(characterDoc(characterId), { scheduledDeletionAt: deleteField() });
