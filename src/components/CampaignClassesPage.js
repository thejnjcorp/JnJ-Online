import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { arrayRemove, collection, doc, getDocs, onSnapshot, or, query, updateDoc, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { subscribeClassToCampaign } from '../utils/campaignSubscriptions';
import '../styles/CampaignClassesPage.scss';

const TYPE_FILTERS = ['all', 'Attrionist', 'Crit Hunter', 'Manipulator', 'Snowballer'];

// The director-facing counterpart to ClassListPage.js's "Add to Campaign"
// quick-subscribe - a dedicated screen for managing one campaign's whole
// class roster at once (default/subscribed/browsable), rather than hunting
// down each pool class individually from the catalog. Mirrors
// campaigns.subscribedStatusIds's existing subscribe/unsubscribe pattern
// (see StatusPage.js's toggleSubscription), new field name.
export function CampaignClassesPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const campaignId = location.pathname.split('/').at(2);
    const [campaignInfo, setCampaignInfo] = useState(null);
    const [classList, setClassList] = useState([]);
    const [userId, setUserId] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    document.title = 'Manage Classes';

    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, 'campaigns', campaignId), (docSnap) => {
            if (docSnap.exists()) {
                setCampaignInfo({ id: docSnap.id, ...docSnap.data() });
                document.title = 'Manage Classes - ' + docSnap.data().campaign_name;
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
            // Same scoped read ClassListPage.js already uses - public
            // classes plus anything this viewer can read/write.
            const classesQuery = query(collection(db, 'classes'),
                or(where('public', '==', true), where('canRead', 'array-contains', user.uid), where('canWrite', 'array-contains', user.uid)));
            getDocs(classesQuery).then(snap => {
                setClassList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            }).catch(error => console.log(error));
        });
        return () => unsubscribe();
    }, []);

    if (!campaignInfo) return <div className="CampaignClassesPage-loading">Loading&hellip;</div>;

    const hasWritePermissions = Boolean(userId) && (userId === campaignInfo.director_uid || campaignInfo.canWrite?.includes(userId));
    const subscribedClassIds = campaignInfo.subscribedClassIds || [];

    const defaultClasses = classList.filter(c => c.isDefault);
    const poolClasses = classList.filter(c => c.public && !c.isDefault);
    const subscribedClasses = poolClasses.filter(c => subscribedClassIds.includes(c.id));
    const browseClasses = poolClasses
        .filter(c => !subscribedClassIds.includes(c.id))
        .filter(c => typeFilter === 'all' || c.class_type === typeFilter);

    async function toggleSubscription(classDoc, subscribe) {
        try {
            if (subscribe) {
                // Also auto-subscribes any public status scoped to this
                // class - see campaignSubscriptions.js. The onSnapshot
                // listener above picks up both fields once this resolves,
                // no local state to patch here.
                await subscribeClassToCampaign(campaignId, classDoc);
            } else {
                await updateDoc(doc(db, 'campaigns', campaignId), {
                    subscribedClassIds: arrayRemove(classDoc.id)
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
                <h1 className="CampaignClassesPage-title">Manage Classes</h1>
                <p className="CampaignClassesPage-subtitle">Choose which pool classes players in this campaign can pick from. Default classes are always available and can't be removed.</p>
            </div>

            {!hasWritePermissions && <div className="CampaignClassesPage-readonly-banner">
                You don't have write access to this campaign, so this view is read-only.
            </div>}

            <div className="CampaignClassesPage-section">
                <div className="CampaignClassesPage-section-header">
                    <span className="CampaignClassesPage-section-title">Default Classes</span>
                    <span className="CampaignClassesPage-section-hint">Always available &middot; admin-curated</span>
                </div>
                <div className="CampaignClassesPage-grid CampaignClassesPage-grid-compact">
                    {defaultClasses.map(c =>
                        <div key={c.id} className="CampaignClassesPage-card CampaignClassesPage-card-default">
                            <div className="CampaignClassesPage-card-row">
                                <span className="CampaignClassesPage-card-name">{c.class_name}</span>
                                <span className="CampaignClassesPage-card-included-badge">Included</span>
                            </div>
                            <div className="CampaignClassesPage-card-type">{c.class_type}</div>
                        </div>
                    )}
                    {defaultClasses.length === 0 && <div className="CampaignClassesPage-hint">No default classes yet.</div>}
                </div>
            </div>

            <div className="CampaignClassesPage-section">
                <div className="CampaignClassesPage-section-header">
                    <span className="CampaignClassesPage-section-title">Subscribed Pool Classes</span>
                    <span className="CampaignClassesPage-section-hint">{subscribedClasses.length} added to this campaign</span>
                </div>
                {subscribedClasses.length > 0 ? <div className="CampaignClassesPage-grid">
                    {subscribedClasses.map(c =>
                        <div key={c.id} className="CampaignClassesPage-card CampaignClassesPage-card-subscribed">
                            <div className="CampaignClassesPage-card-row">
                                <span className="CampaignClassesPage-card-name">{c.class_name}</span>
                                <span className="CampaignClassesPage-card-type">{c.class_type}</span>
                            </div>
                            <div className="CampaignClassesPage-card-description">{c.description}</div>
                            {hasWritePermissions && <button type="button"
                                className="CampaignClassesPage-remove-button"
                                onClick={() => toggleSubscription(c, false)}
                            >
                                Remove from campaign
                            </button>}
                        </div>
                    )}
                </div> : <div className="CampaignClassesPage-empty-card">No pool classes subscribed yet &mdash; browse below and add a few.</div>}
            </div>

            <div className="CampaignClassesPage-section">
                <div className="CampaignClassesPage-section-header CampaignClassesPage-section-header-wrap">
                    <span className="CampaignClassesPage-section-title">Browse Pool Classes</span>
                    <div className="CampaignClassesPage-filters">
                        {TYPE_FILTERS.map(t =>
                            <button type="button"
                                key={t}
                                className={typeFilter === t ? 'CampaignClassesPage-filter-button CampaignClassesPage-filter-button-active' : 'CampaignClassesPage-filter-button'}
                                onClick={() => setTypeFilter(t)}
                            >
                                {t === 'all' ? 'All Types' : t}
                            </button>
                        )}
                    </div>
                </div>
                {browseClasses.length > 0 ? <div className="CampaignClassesPage-grid">
                    {browseClasses.map(c =>
                        <div key={c.id} className="CampaignClassesPage-card">
                            <div className="CampaignClassesPage-card-row">
                                <span className="CampaignClassesPage-card-name">{c.class_name}</span>
                                <span className="CampaignClassesPage-card-author">by {c.author}</span>
                            </div>
                            <div className="CampaignClassesPage-card-type">{c.class_type}</div>
                            <div className="CampaignClassesPage-card-description">{c.description}</div>
                            {hasWritePermissions && <button type="button"
                                className="CampaignClassesPage-add-button"
                                onClick={() => toggleSubscription(c, true)}
                            >
                                + Add to Campaign
                            </button>}
                        </div>
                    )}
                </div> : <div className="CampaignClassesPage-empty-card">Every pool class matching this filter is already subscribed.</div>}
            </div>
        </div>
    </div>
}
