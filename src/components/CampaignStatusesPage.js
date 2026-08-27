import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { arrayRemove, arrayUnion, collection, doc, getDocs, onSnapshot, or, query, updateDoc, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import '../styles/CampaignClassesPage.scss';

const POLARITY_FILTERS = ['all', 'buff', 'debuff', 'neutral'];

// The director-facing counterpart to CampaignClassesPage.js, for statuses -
// same three sections (default/subscribed/browsable), same
// subscribedStatusIds arrayUnion/arrayRemove pattern StatusPage.js's inline
// "Subscribe your campaigns" chips already used, just as its own dedicated
// screen instead of a section buried in the status edit form. Reuses
// CampaignClassesPage.scss as-is (identical layout, only the field names
// inside each card differ) rather than duplicating the stylesheet.
export function CampaignStatusesPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const campaignId = location.pathname.split('/').at(2);
    const [campaignInfo, setCampaignInfo] = useState(null);
    const [statusList, setStatusList] = useState([]);
    const [userId, setUserId] = useState('');
    const [polarityFilter, setPolarityFilter] = useState('all');
    document.title = 'Manage Statuses';

    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, 'campaigns', campaignId), (docSnap) => {
            if (docSnap.exists()) {
                setCampaignInfo({ id: docSnap.id, ...docSnap.data() });
                document.title = 'Manage Statuses - ' + docSnap.data().campaign_name;
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
            // Same scoped read StatusListPage.js already uses - public
            // statuses plus anything this viewer can read/write.
            const statusesQuery = query(collection(db, 'statuses'),
                or(where('public', '==', true), where('canRead', 'array-contains', user.uid), where('canWrite', 'array-contains', user.uid)));
            getDocs(statusesQuery).then(snap => {
                setStatusList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            }).catch(error => console.log(error));
        });
        return () => unsubscribe();
    }, []);

    if (!campaignInfo) return <div className="CampaignClassesPage-loading">Loading&hellip;</div>;

    const hasWritePermissions = Boolean(userId) && (userId === campaignInfo.director_uid || campaignInfo.canWrite?.includes(userId));
    const subscribedStatusIds = campaignInfo.subscribedStatusIds || [];

    const defaultStatuses = statusList.filter(s => s.isDefault);
    const poolStatuses = statusList.filter(s => s.public && !s.isDefault);
    const subscribedStatuses = poolStatuses.filter(s => subscribedStatusIds.includes(s.id));
    const browseStatuses = poolStatuses
        .filter(s => !subscribedStatusIds.includes(s.id))
        .filter(s => polarityFilter === 'all' || s.polarity === polarityFilter);

    async function toggleSubscription(statusId, subscribe) {
        try {
            await updateDoc(doc(db, 'campaigns', campaignId), {
                subscribedStatusIds: subscribe ? arrayUnion(statusId) : arrayRemove(statusId)
            });
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
                <h1 className="CampaignClassesPage-title">Manage Statuses</h1>
                <p className="CampaignClassesPage-subtitle">Choose which pool statuses are offered as presets when adding a status to a character in this campaign. Default statuses are always available and can't be removed.</p>
            </div>

            {!hasWritePermissions && <div className="CampaignClassesPage-readonly-banner">
                You don't have write access to this campaign, so this view is read-only.
            </div>}

            <div className="CampaignClassesPage-section">
                <div className="CampaignClassesPage-section-header">
                    <span className="CampaignClassesPage-section-title">Default Statuses</span>
                    <span className="CampaignClassesPage-section-hint">Always available &middot; admin-curated</span>
                </div>
                <div className="CampaignClassesPage-grid CampaignClassesPage-grid-compact">
                    {defaultStatuses.map(s =>
                        <div key={s.id} className={`CampaignClassesPage-card CampaignClassesPage-card-default CampaignClassesPage-card-${s.polarity || 'neutral'}`}>
                            <div className="CampaignClassesPage-card-row">
                                <span className="CampaignClassesPage-card-name">{s.name}</span>
                                <span className="CampaignClassesPage-card-included-badge">Included</span>
                            </div>
                            <div className="CampaignClassesPage-card-type">{s.polarity || 'neutral'}</div>
                        </div>
                    )}
                    {defaultStatuses.length === 0 && <div className="CampaignClassesPage-hint">No default statuses yet.</div>}
                </div>
            </div>

            <div className="CampaignClassesPage-section">
                <div className="CampaignClassesPage-section-header">
                    <span className="CampaignClassesPage-section-title">Subscribed Pool Statuses</span>
                    <span className="CampaignClassesPage-section-hint">{subscribedStatuses.length} added to this campaign</span>
                </div>
                {subscribedStatuses.length > 0 ? <div className="CampaignClassesPage-grid">
                    {subscribedStatuses.map(s =>
                        <div key={s.id} className={`CampaignClassesPage-card CampaignClassesPage-card-subscribed CampaignClassesPage-card-${s.polarity || 'neutral'}`}>
                            <div className="CampaignClassesPage-card-row">
                                <span className="CampaignClassesPage-card-name">{s.name}</span>
                                <span className="CampaignClassesPage-card-type">{s.polarity || 'neutral'}</span>
                            </div>
                            <div className="CampaignClassesPage-card-description">{s.description}</div>
                            {hasWritePermissions && <button type="button"
                                className="CampaignClassesPage-remove-button"
                                onClick={() => toggleSubscription(s.id, false)}
                            >
                                Remove from campaign
                            </button>}
                        </div>
                    )}
                </div> : <div className="CampaignClassesPage-empty-card">No pool statuses subscribed yet &mdash; browse below and add a few.</div>}
            </div>

            <div className="CampaignClassesPage-section">
                <div className="CampaignClassesPage-section-header CampaignClassesPage-section-header-wrap">
                    <span className="CampaignClassesPage-section-title">Browse Pool Statuses</span>
                    <div className="CampaignClassesPage-filters">
                        {POLARITY_FILTERS.map(p =>
                            <button type="button"
                                key={p}
                                className={polarityFilter === p ? 'CampaignClassesPage-filter-button CampaignClassesPage-filter-button-active' : 'CampaignClassesPage-filter-button'}
                                onClick={() => setPolarityFilter(p)}
                            >
                                {p === 'all' ? 'All' : p[0].toUpperCase() + p.slice(1)}
                            </button>
                        )}
                    </div>
                </div>
                {browseStatuses.length > 0 ? <div className="CampaignClassesPage-grid">
                    {browseStatuses.map(s =>
                        <div key={s.id} className={`CampaignClassesPage-card CampaignClassesPage-card-${s.polarity || 'neutral'}`}>
                            <div className="CampaignClassesPage-card-row">
                                <span className="CampaignClassesPage-card-name">{s.name}</span>
                                <span className="CampaignClassesPage-card-type">{s.polarity || 'neutral'}</span>
                            </div>
                            <div className="CampaignClassesPage-card-description">{s.description}</div>
                            {hasWritePermissions && <button type="button"
                                className="CampaignClassesPage-add-button"
                                onClick={() => toggleSubscription(s.id, true)}
                            >
                                + Add to Campaign
                            </button>}
                        </div>
                    )}
                </div> : <div className="CampaignClassesPage-empty-card">Every pool status matching this filter is already subscribed.</div>}
            </div>
        </div>
    </div>
}
