import { useEffect, useState } from 'react';
import { usePartyData } from '../utils/usePartyData';
import { usePartyNotes, PARTY_NOTES_TEXT } from '../utils/usePartyNotes';
import { DirectorNotes } from './DirectorNotes';
import { PartyInventoryTab } from './PartyInventoryTab';
import { PartyTradesTab } from './PartyTradesTab';
import { PartyCalendarTab } from './PartyCalendarTab';
import '../styles/Party.scss';

export const PARTY_TABS = [
    { key: 'inventory', label: 'Inventory' },
    { key: 'trades', label: 'Trades' },
    { key: 'notes', label: 'Notes' },
    { key: 'calendar', label: 'Calendar' },
];

// The party's shared space: the party inventory, trades between characters, a notebook and a
// calendar of what has happened - for the party page, and for the director's page, where it
// opens over whatever the director is doing. `renderHeading` goes at the start of the header row (the
// page's back link and title, given the campaign); `onLoaded` hears of the campaign once it is
// there; `actingCharacterId` is who the signed-in player is acting as to begin with (a character's own page); `tab` and `onTab` are whichever tab is showing, and the way to
// change it, so each can keep that where it likes (the page in its address, the popup in state).
export function PartySpace({ campaignId, tab, onTab, renderHeading = null, onLoaded = null, actingCharacterId = '' }) {
    const { userId, campaign, characters, party, partyLoaded, partyError, members, isDirector, myCharacters } = usePartyData(campaignId);
    const [actingAs, setActingAs] = useState('');
    const acting = myCharacters.find(character => character.character_id === (actingAs || actingCharacterId)) ?? myCharacters[0] ?? null;
    useEffect(() => {
        if (campaign && onLoaded) onLoaded(campaign);
    }, [campaign]); // eslint-disable-line react-hooks/exhaustive-deps

    if (userId === '') return <div className="Party-message">Sign in to see the party.</div>;
    if (userId === null || campaign === undefined) return <div className="Party-message">Loading…</div>;
    if (campaign === null) return <div className="Party-message" role="alert">This campaign doesn't exist, or you're not part of it.</div>;

    return <>
        <div className="Party-header">
            {renderHeading ? renderHeading(campaign) : null}
            {myCharacters.length > 0 && <label className="Party-acting">
                <span>Playing as</span>
                <select className="Party-input" value={acting?.character_id || ''} onChange={event => setActingAs(event.target.value)}>
                    {myCharacters.map(character => <option key={character.character_id} value={character.character_id}>{character.character_name}</option>)}
                </select>
            </label>}
        </div>

        <div className="Party-tabs" role="tablist" aria-label="Party sections">
            {PARTY_TABS.map(option => <button
                type="button"
                role="tab"
                key={option.key}
                id={`party-tab-${option.key}`}
                aria-selected={tab === option.key}
                aria-controls="party-panel"
                className={tab === option.key ? 'Party-tab Party-tab-active' : 'Party-tab'}
                onClick={() => onTab(option.key)}
            >{option.label}</button>)}
        </div>

        {partyError && <div className="Party-error" role="alert">Couldn't load the party. Check your connection, and that you're in this campaign.</div>}

        <div className="Party-panel" id="party-panel" role="tabpanel" aria-labelledby={`party-tab-${tab}`}>
            {tab === 'inventory' && <PartyInventoryTab campaignId={campaignId} party={party} loaded={partyLoaded} acting={acting} userId={userId} members={members}/>}
            {tab === 'trades' && <PartyTradesTab campaignId={campaignId} party={party} characters={characters} myCharacters={myCharacters} isDirector={isDirector}/>}
            {tab === 'notes' && <DirectorNotes campaignId={campaignId} useNotes={usePartyNotes} {...PARTY_NOTES_TEXT}/>}
            {tab === 'calendar' && <PartyCalendarTab campaignId={campaignId} party={party} isDirector={isDirector}/>}
        </div>
    </>;
}
