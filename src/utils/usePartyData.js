import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { useParty } from './useParty';
import { withoutArchived } from './characterArchive';
import { membersOf } from './itemAccess';
import { isDirectorOf } from './campaignRoles';

// Everything the party's shared space needs about a campaign: who is signed in, the campaign, its
// characters (and which are theirs) and the party doc. `campaign` is undefined while loading, null
// when it isn't there or the signed-in user isn't in it; `userId` is null while loading, '' signed out.
export function usePartyData(campaignId) {
    const [userId, setUserId] = useState(null);
    const [campaign, setCampaign] = useState(undefined);
    const [characters, setCharacters] = useState([]);
    const { party, loaded: partyLoaded, error: partyError } = useParty(campaignId);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => setUserId(user ? user.uid : ''));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!campaignId) return undefined;
        const unsubscribe = onSnapshot(
            doc(db, 'campaigns', campaignId),
            snapshot => setCampaign(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
            () => setCampaign(null),
        );
        return () => unsubscribe();
    }, [campaignId]);

    useEffect(() => {
        if (!campaignId || !campaign) return undefined;
        const unsubscribe = onSnapshot(
            query(collection(db, 'characters'), where('campaign', '==', campaignId)),
            snapshot => setCharacters(withoutArchived(snapshot.docs.map(item => ({ character_id: item.id, ...item.data() })))),
            error => console.log("Couldn't load the campaign's characters: " + error),
        );
        return () => unsubscribe();
    }, [campaignId, campaign]);

    const members = useMemo(() => membersOf(campaign), [campaign]);
    const isDirector = isDirectorOf(campaign, userId);
    const myCharacters = useMemo(() => characters.filter(character => userId && (character.playerId === userId || character.userId === userId)), [characters, userId]);

    return { userId, campaign, characters, party, partyLoaded, partyError, members, isDirector, myCharacters };
}
