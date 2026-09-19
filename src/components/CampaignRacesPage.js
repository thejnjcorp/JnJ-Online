import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { arrayRemove, collection, doc, getDocs, onSnapshot, or, query, updateDoc, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { subscribeRaceToCampaign } from '../utils/campaignSubscriptions';
import '../styles/CampaignClassesPage.scss';

// The race counterpart to CampaignClassesPage.js (same markup and styling):
// one screen for managing a campaign's whole race roster at once.
export function CampaignRacesPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const campaignId = location.pathname.split('/').at(2);
    const [campaignInfo, setCampaignInfo] = useState(null);
    const [raceList, setRaceList] = useState([]);
    const [userId, setUserId] = useState('');
    document.title = 'Manage Races';

    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, 'campaigns', campaignId), (docSnap) => {
            if (docSnap.exists()) {
                setCampaignInfo({ id: docSnap.id, ...docSnap.data() });
                document.title = 'Manage Races - ' + docSnap.data().campaign_name;
            }
        });
        return () => unsubscribe();
    }, [campaignId]);

    useEffect(() => {
        // auth.currentUser can still be null right after a hard page load,
        // before Firebase has rehydrated the session - see the identical
        // note on StatusListPage.js/ClassListPage.js.
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) return;
            setUserId(user.uid);
            // Same scoped read RaceListPage.js uses - public races plus
            // anything this viewer can read/write.
            const racesQuery = query(collection(db, 'races'),
                or(where('public', '==', true), where('canRead', 'array-contains', user.uid), where('canWrite', 'array-contains', user.uid)));
            getDocs(racesQuery).then(snap => {
                setRaceList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            }).catch(error => console.log(error));
        });
        return () => unsubscribe();
    }, []);

    if (!campaignInfo) return <div className="CampaignClassesPage-loading">Loading&hellip;</div>;

    const hasWritePermissions = Boolean(userId) && (userId === campaignInfo.director_uid || campaignInfo.canWrite?.includes(userId));
    const subscribedRaceIds = campaignInfo.subscribedRaceIds || [];

    const defaultRaces = raceList.filter(r => r.isDefault);
    const poolRaces = raceList.filter(r => r.public && !r.isDefault);
    const subscribedRaces = poolRaces.filter(r => subscribedRaceIds.includes(r.id));
    const browseRaces = poolRaces.filter(r => !subscribedRaceIds.includes(r.id));

    async function toggleSubscription(raceDoc, subscribe) {
        try {
            // The onSnapshot listener above picks the change up once this
            // resolves, no local state to patch here.
            if (subscribe) {
                await subscribeRaceToCampaign(campaignId, raceDoc);
            } else {
                await updateDoc(doc(db, 'campaigns', campaignId), {
                    subscribedRaceIds: arrayRemove(raceDoc.id)
                });
            }
        } catch (e) {
            alert(e);
        }
    }

    return <div className="CampaignClassesPage">
        <div className="CampaignClassesPage-inner">
            <div className="CampaignClassesPage-breadcrumb">
                <button type="button" onClick={() => navigate('/campaigns/' + campaignId)}>&larr; {campaignInfo.campaign_name}</button>
            </div>
            <div className="CampaignClassesPage-header">
                <h1 className="CampaignClassesPage-title">Manage Races</h1>
                <p className="CampaignClassesPage-subtitle">Choose which pool races players in this campaign can pick from. Default races are always available and can't be removed.</p>
            </div>

            {!hasWritePermissions && <div className="CampaignClassesPage-readonly-banner">
                You don't have write access to this campaign, so this view is read-only.
            </div>}

            <div className="CampaignClassesPage-section">
                <div className="CampaignClassesPage-section-header">
                    <span className="CampaignClassesPage-section-title">Default Races</span>
                    <span className="CampaignClassesPage-section-hint">Always available &middot; admin-curated</span>
                </div>
                <div className="CampaignClassesPage-grid CampaignClassesPage-grid-compact">
                    {defaultRaces.map(r =>
                        <div key={r.id} className="CampaignClassesPage-card CampaignClassesPage-card-default">
                            <div className="CampaignClassesPage-card-row">
                                <span className="CampaignClassesPage-card-name">{r.name}</span>
                                <span className="CampaignClassesPage-card-included-badge">Included</span>
                            </div>
                        </div>
                    )}
                    {defaultRaces.length === 0 && <div className="CampaignClassesPage-hint">No default races yet.</div>}
                </div>
            </div>

            <div className="CampaignClassesPage-section">
                <div className="CampaignClassesPage-section-header">
                    <span className="CampaignClassesPage-section-title">Subscribed Pool Races</span>
                    <span className="CampaignClassesPage-section-hint">{subscribedRaces.length} added to this campaign</span>
                </div>
                {subscribedRaces.length > 0 ? <div className="CampaignClassesPage-grid">
                    {subscribedRaces.map(r =>
                        <div key={r.id} className="CampaignClassesPage-card CampaignClassesPage-card-subscribed">
                            <div className="CampaignClassesPage-card-row">
                                <span className="CampaignClassesPage-card-name">{r.name}</span>
                            </div>
                            <div className="CampaignClassesPage-card-description">{r.description}</div>
                            {hasWritePermissions && <button type="button"
                                className="CampaignClassesPage-remove-button"
                                onClick={() => toggleSubscription(r, false)}
                            >
                                Remove from campaign
                            </button>}
                        </div>
                    )}
                </div> : <div className="CampaignClassesPage-empty-card">No pool races subscribed yet &mdash; browse below and add a few.</div>}
            </div>

            <div className="CampaignClassesPage-section">
                <div className="CampaignClassesPage-section-header">
                    <span className="CampaignClassesPage-section-title">Browse Pool Races</span>
                </div>
                {browseRaces.length > 0 ? <div className="CampaignClassesPage-grid">
                    {browseRaces.map(r =>
                        <div key={r.id} className="CampaignClassesPage-card">
                            <div className="CampaignClassesPage-card-row">
                                <span className="CampaignClassesPage-card-name">{r.name}</span>
                                <span className="CampaignClassesPage-card-author">by {r.author}</span>
                            </div>
                            <div className="CampaignClassesPage-card-description">{r.description}</div>
                            {hasWritePermissions && <button type="button"
                                className="CampaignClassesPage-add-button"
                                onClick={() => toggleSubscription(r, true)}
                            >
                                + Add to Campaign
                            </button>}
                        </div>
                    )}
                </div> : <div className="CampaignClassesPage-empty-card">Every pool race is already subscribed.</div>}
            </div>
        </div>
    </div>
}
