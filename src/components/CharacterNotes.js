import { useCharacterNotes } from '../utils/useCharacterNotes';
import { DirectorNotes } from './DirectorNotes';

// A player's own private notebook for their character: pages you name and
// flip between, saved as you type - the same OneNote-like notebook as the
// Director's Page's and the party's (see DirectorNotes.js), just scoped to
// one character and private to its owner/co-writers (see the rule in
// firestore.rules).
export function CharacterNotes({ characterId }) {
    return <DirectorNotes
        campaignId={characterId}
        useNotes={useCharacterNotes}
        heading="Notes"
        intro="A notebook for this character - private to you and anyone who can write the sheet. Make a page for each thing you want to remember, like a session, a person or a place."
        errorText="Couldn't load your notes. Check your connection and that you can write this sheet."
        storagePrefix="jnj-character-notes-page"
    />;
}
