import { useEffect, useRef } from 'react';
import { useCharacterNotes } from '../utils/useCharacterNotes';
import { DirectorNotes } from './DirectorNotes';

// A player's own private notebook for their character: pages you name and
// flip between, saved as you type - the same OneNote-like notebook as the
// Director's Page's and the party's (see DirectorNotes.js), just scoped to
// one character and private to its owner/co-writers (see the rule in
// firestore.rules).
//
// The character sheet used to have just one plain markdown field
// (characterPage.notes). The first time this notebook is opened for a
// character that has some of that old text and no pages of its own yet, it
// is copied into a first page automatically - once, guarded so it can't
// re-trigger after that page is deleted - so nothing already written is
// lost. The old field itself is left alone (not cleared), just no longer
// shown once migrated.
export function CharacterNotes({ characterId, legacyNotes, canEdit }) {
    const { pages, status, createPage } = useCharacterNotes(characterId);
    const migrated = useRef(false);

    useEffect(() => {
        if (migrated.current || status !== 'ready' || pages.length > 0 || !legacyNotes?.trim() || !canEdit) return;
        migrated.current = true;
        createPage('Notes', legacyNotes).catch(error => console.log('Failed to import existing notes: ' + error));
    }, [status, pages.length, legacyNotes, canEdit, createPage]);

    return <DirectorNotes
        campaignId={characterId}
        useNotes={useCharacterNotes}
        heading="Notes"
        intro="A notebook for this character - private to you and anyone who can write the sheet. Make a page for each thing you want to remember, like a session, a person or a place."
        errorText="Couldn't load your notes. Check your connection and that you can write this sheet."
        storagePrefix="jnj-character-notes-page"
    />;
}
