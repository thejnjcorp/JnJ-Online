import { useParty } from '../utils/useParty';
import { clearRollRequest } from '../utils/party';
import '../styles/Party.scss';

// "The director asks you to roll Dexterity": what a director has asked this character to roll (see
// Call a check on the director's page), until they say it is done.
export function RollRequests({ campaignId, characterId, canClear }) {
    const { party } = useParty(campaignId);
    const requests = (Array.isArray(party?.roll_requests) ? party.roll_requests : []).filter(request => request.characterId === characterId);
    if (requests.length === 0) return null;
    return <section className="RollRequests" aria-label="Rolls the director has asked for">
        {requests.map(request => <div className="RollRequests-item" key={request.id}>
            <span>{`The director asks you to roll ${request.skill}.`}</span>
            {canClear && <button type="button" className="Party-button" onClick={() => clearRollRequest(campaignId, request.id).catch(error => alert("Couldn't clear the request: " + error.message))}>Done</button>}
        </div>)}
    </section>;
}
