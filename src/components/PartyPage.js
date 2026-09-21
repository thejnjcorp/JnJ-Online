import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { ensureParty } from '../utils/party';
import { useParty } from '../utils/useParty';
import { withoutArchived } from '../utils/characterArchive';
import { membersOf } from '../utils/itemAccess';
import { usePartyNotes, PARTY_NOTES_TEXT } from '../utils/usePartyNotes';
import { DirectorNotes } from './DirectorNotes';
import { PartyInventoryTab } from './PartyInventoryTab';
import { PartyTradesTab } from './PartyTradesTab';
import { PartyCalendarTab } from './PartyCalendarTab';
import '../styles/Party.scss';

const TABS = [
    { key: 'inventory', label: 'Inventory' },
    { key: 'trades', label: 'Trades' },
    { key: 'notes', label: 'Notes' },
    { key: 'calendar', label: 'Calendar' },
];

// The party's shared space, for everyone in a campaign - players and directors alike:
// the party inventory, trades between characters, a notebook, and a calendar of what
// has happened. Lives at /party/:campaignId. It all sits on the campaign's party doc
// (see party.js) and the collections under the campaign, which every member can read
// and write (see firestore.rules).
export function PartyPage() {
    const location = useLocation();
    const campaignId = location.pathname.split('/').at(2);
    const [searchParams, setSearchParams] = useSearchParams();
    const [userId, setUserId] = useState(null);
    const [campaign, setCampaign] = useState(undefined); // undefined: loading, null: not there or not allowed
    const [characters, setCharacters] = useState([]);
    const [actingAs, setActingAs] = useState('');
    const { party, loaded: partyLoaded, error: partyError } = useParty(campaignId);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => setUserId(user ? user.uid : ''));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!campaignId) return undefined;
        const unsubscribe = onSnapshot(
            doc(db, 'campaigns', campaignId),
            snapshot => {
                setCampaign(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
                document.title = snapshot.exists() ? `Party - ${snapshot.data().campaign_name}` : 'Party';
            },
            () => setCampaign(null),
        );
        return () => unsubscribe();
    }, [campaignId]);

    // A campaign that predates the party doc gets its one the first time anyone opens it.
    useEffect(() => {
        if (campaign && userId) ensureParty(campaignId).catch(error => console.log("Couldn't create the party doc: " + error));
    }, [campaignId, campaign, userId]);

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
    const isDirector = Boolean(userId) && (campaign?.director_uid === userId || Boolean(campaign?.canWrite?.includes(userId)) || Boolean(campaign?.admins?.includes(userId)));
    const myCharacters = useMemo(() => characters.filter(character => userId && (character.playerId === userId || character.userId === userId)), [characters, userId]);
    const acting = myCharacters.find(character => character.character_id === actingAs) ?? myCharacters[0] ?? null;

    const tab = TABS.some(option => option.key === searchParams.get('tab')) ? searchParams.get('tab') : 'inventory';

    if (userId === '') return <div className="Party Party-message">Sign in to see the party.</div>;
    if (userId === null || campaign === undefined) return <div className="Party Party-message">Loading…</div>;
    if (campaign === null) return <div className="Party Party-message" role="alert">This campaign doesn't exist, or you're not part of it.</div>;

    return <div className="Party">
        <div className="Party-inner">
            <div className="Party-header">
                <Link className="Party-back" to={`/campaigns/${campaignId}`}>&larr; {campaign.campaign_name}</Link>
                <h1 className="Party-title">The Party</h1>
                {myCharacters.length > 0 && <label className="Party-acting">
                    <span>Playing as</span>
                    <select className="Party-input" value={acting?.character_id || ''} onChange={event => setActingAs(event.target.value)}>
                        {myCharacters.map(character => <option key={character.character_id} value={character.character_id}>{character.character_name}</option>)}
                    </select>
                </label>}
            </div>

            <div className="Party-tabs" role="tablist" aria-label="Party sections">
                {TABS.map(option => <button
                    type="button"
                    role="tab"
                    key={option.key}
                    id={`party-tab-${option.key}`}
                    aria-selected={tab === option.key}
                    aria-controls="party-panel"
                    className={tab === option.key ? 'Party-tab Party-tab-active' : 'Party-tab'}
                    onClick={() => setSearchParams({ tab: option.key })}
                >{option.label}</button>)}
            </div>

            {partyError && <div className="Party-error" role="alert">Couldn't load the party. Check your connection, and that you're in this campaign.</div>}

            <div className="Party-panel" id="party-panel" role="tabpanel" aria-labelledby={`party-tab-${tab}`}>
                {tab === 'inventory' && <PartyInventoryTab campaignId={campaignId} party={party} loaded={partyLoaded} acting={acting} userId={userId} members={members}/>}
                {tab === 'trades' && <PartyTradesTab campaignId={campaignId} party={party} characters={characters} myCharacters={myCharacters} isDirector={isDirector}/>}
                {tab === 'notes' && <DirectorNotes campaignId={campaignId} useNotes={usePartyNotes} {...PARTY_NOTES_TEXT}/>}
                {tab === 'calendar' && <PartyCalendarTab campaignId={campaignId} party={party} isDirector={isDirector}/>}
            </div>
        </div>
    </div>;
}
