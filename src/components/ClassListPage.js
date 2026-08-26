import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { arrayRemove, collection, doc, getDocs, or, query, updateDoc, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../utils/firebase";
import { subscribeClassToCampaign } from "../utils/campaignSubscriptions";
import '../styles/ClassListPage.scss';

const TYPE_FILTERS = ['all', 'Attrionist', 'Crit Hunter', 'Manipulator', 'Snowballer'];
// Cycles the same four accent tokens the rest of the app already uses
// (arcane/ember/success/danger), one per real class_type value - purely a
// visual grouping cue, not tied to any mechanical meaning of the type.
const TYPE_ACCENT_CLASS = {
    'Attrionist': 'ClassListPage-card-arcane',
    'Crit Hunter': 'ClassListPage-card-ember',
    'Manipulator': 'ClassListPage-card-success',
    'Snowballer': 'ClassListPage-card-danger',
};
const VISIBILITY_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'default', label: 'Default' },
    { key: 'pool', label: 'Pool' },
    { key: 'private', label: 'Private' },
];

function visibilityOf(c) {
    return c.isDefault ? 'default' : c.public ? 'pool' : 'private';
}

export function ClassListPage() {
    const [classList, setClassList] = useState([]);
    const [myCampaigns, setMyCampaigns] = useState([]);
    const [userId, setUserId] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterVisibility, setFilterVisibility] = useState('all');
    const [openAddId, setOpenAddId] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();
    document.title = "Classes";

    useEffect(() => {
        // auth.currentUser can still be null right after a hard page load,
        // before Firebase has rehydrated the session - see the identical
        // note on StatusListPage.js.
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) return;
            setUserId(user.uid);
            // Public classes, plus anything this user can read/write - three
            // plain equality/array-contains branches, not a bare collection
            // scan, since firestore.rules' read rule for this collection
            // can't prove an unconstrained query safe. See the comment on
            // the classes match block there (mirrors statuses exactly).
            const classesQuery = query(collection(db, 'classes'),
                or(where('public', '==', true), where('canRead', 'array-contains', user.uid), where('canWrite', 'array-contains', user.uid)));
            getDocs(classesQuery).then(snap => {
                setClassList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            }).catch(error => console.log(error));
            // Same "campaigns I belong to" query StatusListPage.js's sibling
            // StatusPage.js uses - needed for the per-card "Add to Campaign"
            // popover below.
            getDocs(query(collection(db, 'campaigns'), or(where('canRead', 'array-contains', user.uid), where('canWrite', 'array-contains', user.uid))))
                .then(snap => setMyCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
                .catch(error => console.log(error));
        });
        return () => unsubscribe();
    }, [location]);

    // Subscribing writes to the campaign doc, not the class - needs actual
    // write access there (director or canWrite), not just membership.
    const myWritableCampaigns = myCampaigns.filter(c => c.canWrite?.includes(userId) || c.director_uid === userId);

    const visibleClasses = classList.filter(c =>
        (filterType === 'all' || c.class_type === filterType) &&
        (filterVisibility === 'all' || visibilityOf(c) === filterVisibility)
    );

    async function toggleSubscription(classDoc, campaign) {
        const subscribed = campaign.subscribedClassIds?.includes(classDoc.id);
        try {
            let subscribedStatusIds = campaign.subscribedStatusIds || [];
            if (subscribed) {
                await updateDoc(doc(db, 'campaigns', campaign.id), {
                    subscribedClassIds: arrayRemove(classDoc.id)
                });
            } else {
                // Also auto-subscribes any public status scoped to this
                // class - see campaignSubscriptions.js.
                const newStatusIds = await subscribeClassToCampaign(campaign.id, classDoc);
                subscribedStatusIds = Array.from(new Set([...subscribedStatusIds, ...newStatusIds]));
            }
            setMyCampaigns(prev => prev.map(c => c.id !== campaign.id ? c : {
                ...c,
                subscribedClassIds: subscribed
                    ? (c.subscribedClassIds || []).filter(id => id !== classDoc.id)
                    : [...(c.subscribedClassIds || []), classDoc.id],
                subscribedStatusIds,
            }));
        } catch (e) {
            alert(e);
        }
    }

    return <div className="ClassListPage">
        <div className="ClassListPage-inner">
            <div className="ClassListPage-header">
                <h1 className="ClassListPage-title">Classes</h1>
                <p className="ClassListPage-subtitle">Browse every class available in JnJ Online, and add the ones you want to a campaign you direct.</p>
            </div>

            <div className="ClassListPage-filter-groups">
                <div className="ClassListPage-filters">
                    {TYPE_FILTERS.map(t =>
                        <button
                            key={t}
                            className={filterType === t ? 'ClassListPage-filter-button ClassListPage-filter-button-active' : 'ClassListPage-filter-button'}
                            onClick={() => setFilterType(t)}
                        >
                            {t === 'all' ? 'All Types' : t}
                        </button>
                    )}
                </div>
                <div className="ClassListPage-filters">
                    {VISIBILITY_FILTERS.map(v =>
                        <button
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
                {visibleClasses.map(c => {
                    const visibility = visibilityOf(c);
                    const canSubscribe = visibility === 'default' || visibility === 'pool';
                    return <div key={c.id} className={`ClassListPage-card ${TYPE_ACCENT_CLASS[c.class_type] || ''}`}>
                        <div className="ClassListPage-card-header">
                            <span className="ClassListPage-card-name">{c.class_name}</span>
                            <span className={`ClassListPage-card-vis-badge ClassListPage-card-vis-badge-${visibility}`}>
                                {visibility === 'default' ? 'Default' : visibility === 'pool' ? 'Pool' : 'Private'}
                            </span>
                        </div>
                        <div className="ClassListPage-card-meta">by {c.author} &middot; {c.class_type}</div>
                        <div className="ClassListPage-card-description">{c.description}</div>
                        <div className="ClassListPage-card-actions">
                            <button className="ClassListPage-card-view-button" onClick={() => navigate('/classes/' + c.id)}>View Class</button>
                            {canSubscribe && <button
                                className="ClassListPage-card-add-button"
                                onClick={() => setOpenAddId(openAddId === c.id ? null : c.id)}
                            >
                                Add to Campaign
                            </button>}
                        </div>
                        {openAddId === c.id && <div className="ClassListPage-add-popover">
                            <div className="ClassListPage-add-popover-label">Subscribe a campaign you direct</div>
                            {myWritableCampaigns.length === 0 && <div className="ClassListPage-hint">You don't direct (or have write access to) any campaigns yet.</div>}
                            {myWritableCampaigns.map(camp => {
                                const subscribed = camp.subscribedClassIds?.includes(c.id);
                                return <button
                                    key={camp.id}
                                    className={subscribed ? 'ClassListPage-add-popover-chip ClassListPage-add-popover-chip-selected' : 'ClassListPage-add-popover-chip'}
                                    onClick={() => toggleSubscription(c, camp)}
                                >
                                    <span>{camp.campaign_name}</span>
                                    {subscribed && <span className="ClassListPage-add-popover-check">&#10003;</span>}
                                </button>;
                            })}
                            <button className="ClassListPage-add-popover-done" onClick={() => setOpenAddId(null)}>Done</button>
                        </div>}
                    </div>;
                })}
                {visibleClasses.length === 0 && <div className="ClassListPage-empty">No classes match these filters.</div>}
            </div>

            <button className="ClassListPage-create-button" onClick={() => navigate('/classes')}>
                + Create New Class
            </button>

            <p className="ClassListPage-footnote">
                <strong>Default</strong> classes are admin-curated and available to every campaign automatically.{" "}
                <strong>Pool</strong> classes are public submissions any campaign can opt into.{" "}
                <strong>Private</strong> classes are visible only to their author until shared.
            </p>
        </div>
    </div>
}
