import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../utils/firebase';
import { useEncounters } from '../utils/useEncounters';
import { rosterSummary, summaryText } from '../utils/enemies';
import '../styles/StatusListPage.scss';
import '../styles/EncounterPage.scss';

// A campaign's encounters: the fights a director has prepared, each with a
// roster of enemies. Open one to build it and stage it into the fight.
// What the list says when there is nothing to show.
function emptyMessage(status) {
    if (status === 'error') return "Couldn't load the encounters. Only this campaign's directors can see them.";
    return status === 'loading' ? 'Loading…' : 'No encounters yet.';
}

// On its own page (/campaigns/:id/encounters) it works out the campaign from the address and
// navigates between pages. Hosted in the Director's page (the Encounters popup of the scenes
// framework) it is given the campaign, what to do to open an encounter, and how to go back.
export function EncountersPage({ campaignId: hostCampaignId, onOpen, onBack }) {
    const location = useLocation();
    const navigate = useNavigate();
    const campaignId = hostCampaignId || location.pathname.split('/').at(2);
    const { encounters, status } = useEncounters(campaignId);
    const open = id => (onOpen ? onOpen(id) : navigate(`/campaigns/${campaignId}/encounters/${id}`));
    if (!hostCampaignId) document.title = 'Encounters';

    async function createEncounter() {
        try {
            const created = await addDoc(collection(db, 'campaigns', campaignId, 'encounters'), {
                name: 'New encounter', notes: '', roster: [], stagedIds: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
            });
            open(created.id);
        } catch (error) {
            alert("Couldn't create the encounter: " + error.message);
        }
    }

    async function removeEncounter(encounter) {
        if (!window.confirm(`Delete "${encounter.name}"? Enemies already staged from it stay in the fight.`)) return;
        try {
            await deleteDoc(doc(db, 'campaigns', campaignId, 'encounters', encounter.id));
        } catch (error) {
            alert("Couldn't delete the encounter: " + error.message);
        }
    }

    return <div className="StatusListPage">
        <div className="StatusListPage-inner">
            {(!hostCampaignId || onBack) && <button type="button" className="EncounterPage-breadcrumb" onClick={() => (onBack ? onBack() : navigate('/campaigns/' + campaignId))}>&larr; {onBack ? 'Back' : 'Campaign'}</button>}
            <div className="StatusListPage-header">
                <h1 className="StatusListPage-title">Encounters</h1>
                <p className="StatusListPage-subtitle">Prepare a fight ahead of time: pick the enemies, where they start, and your notes - then stage it onto the Director's page when the party arrives.</p>
            </div>

            <div className="StatusListPage-grid">
                {encounters.map(encounter => {
                    const staged = encounter.stagedIds?.length > 0;
                    return <div key={encounter.id} className="StatusListPage-card StatusListPage-card-neutral EncountersPage-card">
                        <button type="button" className="EncountersPage-card-main" onClick={() => open(encounter.id)}>
                            <span className="StatusListPage-card-name">{encounter.name || 'Untitled encounter'}</span>
                            <span className="StatusListPage-card-description">{summaryText(rosterSummary(encounter.roster))}</span>
                            {staged && <span className="EncounterPage-staged-badge">Staged</span>}
                        </button>
                        <button type="button" className="EncountersPage-delete" aria-label={`Delete ${encounter.name}`} onClick={() => removeEncounter(encounter)}>Delete</button>
                    </div>;
                })}
                {encounters.length === 0 && <div className="StatusListPage-empty">
                    {emptyMessage(status)}
                </div>}
            </div>

            <button type="button" className="StatusListPage-create-button" onClick={createEncounter}>+ New Encounter</button>
        </div>
    </div>;
}
