import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Markdown from "markdown-to-jsx";
import { arrayRemove, collection, doc, getDocs, or, query, updateDoc, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../utils/firebase";
import { raceActionsOf } from "../utils/characterClass";
import { subscribeRaceToCampaign } from "../utils/campaignSubscriptions";
import '../styles/ClassListPage.scss';
import { withoutArchivedCampaigns } from '../utils/campaignArchive';

const VISIBILITY_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'default', label: 'Default' },
    { key: 'pool', label: 'Pool' },
    { key: 'private', label: 'Private' },
];

function visibilityOf(c) {
    if (c.isDefault) return 'default';
    if (c.public) return 'pool';
    return 'private';
}

// Shares ClassListPage's markup and styling wholesale - a race is a catalog
// entry with the same Default/Pool/Private visibility and campaign
// subscription, just without a class type.
export function RaceListPage() {
    const [raceList, setRaceList] = useState([]);
    const [myCampaigns, setMyCampaigns] = useState([]);
    const [userId, setUserId] = useState('');
    const [filterVisibility, setFilterVisibility] = useState('all');
    const [openAddId, setOpenAddId] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();
    document.title = "Races";

    useEffect(() => {
        // auth.currentUser can still be null right after a hard page load,
        // before Firebase has rehydrated the session - see the identical
        // note on StatusListPage.js.
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) return;
            setUserId(user.uid);
            // Public races, plus anything this user can read/write - three
            // plain equality/array-contains branches, not a bare collection
            // scan, since firestore.rules' read rule for this collection
            // can't prove an unconstrained query safe. See the comment on
            // the races match block there (mirrors statuses exactly).
            const racesQuery = query(collection(db, 'races'),
                or(where('public', '==', true), where('canRead', 'array-contains', user.uid), where('canWrite', 'array-contains', user.uid)));
            getDocs(racesQuery).then(snap => {
                setRaceList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            }).catch(error => console.log(error));
            // Same "campaigns I belong to" query StatusListPage.js's sibling
            // StatusPage.js uses - needed for the per-card "Add to Campaign"
            // popover below.
            getDocs(query(collection(db, 'campaigns'), or(where('canRead', 'array-contains', user.uid), where('canWrite', 'array-contains', user.uid))))
                .then(snap => setMyCampaigns(withoutArchivedCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() })))))
                .catch(error => console.log(error));
        });
        return () => unsubscribe();
    }, [location]);

    // Subscribing writes to the campaign doc, not the race - needs actual
    // write access there (director or canWrite), not just membership.
    const myWritableCampaigns = myCampaigns.filter(c => c.canWrite?.includes(userId) || c.director_uid === userId);

    const visibleRaces = raceList.filter(r => filterVisibility === 'all' || visibilityOf(r) === filterVisibility);

    async function toggleSubscription(raceDoc, campaign) {
        const subscribed = campaign.subscribedRaceIds?.includes(raceDoc.id);
        try {
            if (subscribed) {
                await updateDoc(doc(db, 'campaigns', campaign.id), {
                    subscribedRaceIds: arrayRemove(raceDoc.id)
                });
            } else {
                await subscribeRaceToCampaign(campaign.id, raceDoc);
            }
            setMyCampaigns(prev => prev.map(c => c.id !== campaign.id ? c : {
                ...c,
                subscribedRaceIds: subscribed
                    ? (c.subscribedRaceIds || []).filter(id => id !== raceDoc.id)
                    : [...(c.subscribedRaceIds || []), raceDoc.id],
            }));
        } catch (e) {
            alert(e);
        }
    }

    return <div className="ClassListPage">
        <div className="ClassListPage-inner">
            <div className="ClassListPage-header">
                <h1 className="ClassListPage-title">Races</h1>
                <p className="ClassListPage-subtitle">Browse every race available in JnJ Online, and add the ones you want to a campaign you direct.</p>
            </div>

            <div className="ClassListPage-filter-groups">
                <div className="ClassListPage-filters">
                    {VISIBILITY_FILTERS.map(v =>
                        <button type="button"
                            key={v.key}
                            className={filterVisibility === v.key ? 'ClassListPage-filter-button ClassListPage-filter-button-active' : 'ClassListPage-filter-button'}
                            onClick={() => setFilterVisibility(v.key)}
                        >
                            {v.label}
                        </button>
                    )}
                </div>
            </div>

            <div className="ClassListPage-grid">
                {visibleRaces.map(r => {
                    const visibility = visibilityOf(r);
                    const canSubscribe = visibility === 'default' || visibility === 'pool';
                    let visLabel = 'Private';
                    if (visibility === 'default') visLabel = 'Default';
                    else if (visibility === 'pool') visLabel = 'Pool';
                    const actionCount = raceActionsOf(r).length;
                    return <div key={r.id} className="ClassListPage-card">
                        <div className="ClassListPage-card-header">
                            <span className="ClassListPage-card-name">{r.name}</span>
                            <span className={`ClassListPage-card-vis-badge ClassListPage-card-vis-badge-${visibility}`}>
                                {visLabel}
                            </span>
                        </div>
                        <div className="ClassListPage-card-meta">{r.author ? `by ${r.author} \u00b7 ` : ''}{actionCount} racial {actionCount === 1 ? 'feat' : 'feats'}</div>
                        <div className="ClassListPage-card-description"><Markdown options={{ disableParsingRawHTML: true }}>{r.description || ""}</Markdown></div>
                        <div className="ClassListPage-card-actions">
                            <button type="button" className="ClassListPage-card-view-button" onClick={() => navigate('/races/' + r.id)}>View Race</button>
                            {canSubscribe && <button type="button"
                                className="ClassListPage-card-add-button"
                                onClick={() => setOpenAddId(openAddId === r.id ? null : r.id)}
                            >
                                Add to Campaign
                            </button>}
                        </div>
                        {openAddId === r.id && <div className="ClassListPage-add-popover">
                            <div className="ClassListPage-add-popover-label">Subscribe a campaign you direct</div>
                            {myWritableCampaigns.length === 0 && <div className="ClassListPage-hint">You don't direct (or have write access to) any campaigns yet.</div>}
                            {myWritableCampaigns.map(camp => {
                                const subscribed = camp.subscribedRaceIds?.includes(r.id);
                                return <button type="button"
                                    key={camp.id}
                                    className={subscribed ? 'ClassListPage-add-popover-chip ClassListPage-add-popover-chip-selected' : 'ClassListPage-add-popover-chip'}
                                    onClick={() => toggleSubscription(r, camp)}
                                >
                                    <span>{camp.campaign_name}</span>
                                    {subscribed && <span className="ClassListPage-add-popover-check">&#10003;</span>}
                                </button>;
                            })}
                            <button type="button" className="ClassListPage-add-popover-done" onClick={() => setOpenAddId(null)}>Done</button>
                        </div>}
                    </div>;
                })}
                {visibleRaces.length === 0 && <div className="ClassListPage-empty">No races match these filters.</div>}
            </div>

            <button type="button" className="ClassListPage-create-button" onClick={() => navigate('/races')}>
                + Create New Race
            </button>

            <p className="ClassListPage-footnote">
                <strong>Default</strong> races are admin-curated and available to every campaign automatically.{" "}
                <strong>Pool</strong> races are public submissions any campaign can opt into.{" "}
                <strong>Private</strong> races are visible only to their author until shared.
            </p>
        </div>
    </div>
}
