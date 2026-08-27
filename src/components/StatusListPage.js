import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, getDocs, or, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { STATUS_STAT_DEFINITIONS, getEffectsArray } from '../utils/statusEffects';
import '../styles/StatusListPage.scss';

function effectLabel(effect) {
    const definition = STATUS_STAT_DEFINITIONS.find(s => s.key === effect.stat);
    const label = definition?.label || effect.stat;
    if (effect.mode === 'scaled') {
        const deltas = (effect.table || []).map(row => row.delta);
        if (deltas.length === 0) return `${label} (scaled, unset)`;
        const min = Math.min(...deltas), max = Math.max(...deltas);
        const range = min === max ? `${min}` : `${min} to ${max}`;
        return `${label} ${range} by stacks`;
    }
    const sign = effect.delta > 0 ? '+' : '';
    return `${sign}${effect.delta} ${label}`;
}

function visibilityLabel(status) {
    if (status.isDefault) return 'Admin Default';
    if (status.public) return 'Pool (subscribe to use)';
    if (status.campaignId) return 'Campaign-locked';
    return 'Creator-locked';
}

const POLARITY_FILTERS = ['all', 'buff', 'debuff', 'neutral'];
const OWNERSHIP_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'mine', label: 'Mine' },
    { key: 'public', label: 'Public' },
];

export function StatusListPage() {
    const [statusList, setStatusList] = useState([]);
    const [filterPolarity, setFilterPolarity] = useState('all');
    const [filterOwnership, setFilterOwnership] = useState('all');
    const [userId, setUserId] = useState('');
    const navigate = useNavigate();
    const location = useLocation();
    document.title = 'Statuses';

    useEffect(() => {
        // auth.currentUser can still be null right after a hard page load
        // (a fresh navigation/refresh lands here before Firebase finishes
        // rehydrating the session) - a one-off auth.currentUser?.uid check
        // on mount would silently give up and never retry once auth is
        // actually ready, leaving the list permanently empty.
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) return;
            setUserId(user.uid);
            // Public statuses, plus anything this user can read/write -
            // three plain equality/array-contains branches, deliberately not
            // a bare collection scan, since firestore.rules' read rule for
            // this collection can't prove an unconstrained query safe. See
            // the comment on the statuses match block there.
            const statusesQuery = query(collection(db, 'statuses'),
                or(where('public', '==', true), where('canRead', 'array-contains', user.uid), where('canWrite', 'array-contains', user.uid)));
            getDocs(statusesQuery).then(querySnapshot => {
                setStatusList(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            }).catch(error => console.log(error));
        });
        return () => unsubscribe();
    }, [location]);

    const visibleStatuses = statusList.filter(status =>
        (filterPolarity === 'all' || status.polarity === filterPolarity) &&
        (filterOwnership === 'all'
            || (filterOwnership === 'mine' && status.canWrite?.includes(userId))
            || (filterOwnership === 'public' && status.public))
    );

    return <div className="StatusListPage">
        <div className="StatusListPage-inner">
        <div className="StatusListPage-header">
            <h1 className="StatusListPage-title">Statuses</h1>
            <p className="StatusListPage-subtitle">The shared catalog of conditions players and directors can apply to characters.</p>
        </div>

        <div className="StatusListPage-filter-groups">
            <div className="StatusListPage-filters">
                {OWNERSHIP_FILTERS.map(o =>
                    <button type="button"
                        key={o.key}
                        className={filterOwnership === o.key ? 'StatusListPage-filter-button StatusListPage-filter-button-active' : 'StatusListPage-filter-button'}
                        onClick={() => setFilterOwnership(o.key)}
                    >
                        {o.label}
                    </button>
                )}
            </div>
            <div className="StatusListPage-filters">
                {POLARITY_FILTERS.map(polarity =>
                    <button type="button"
                        key={polarity}
                        className={filterPolarity === polarity ? 'StatusListPage-filter-button StatusListPage-filter-button-active' : 'StatusListPage-filter-button'}
                        onClick={() => setFilterPolarity(polarity)}
                    >
                        {polarity === 'all' ? 'All' : polarity[0].toUpperCase() + polarity.slice(1)}
                    </button>
                )}
            </div>
        </div>

        <div className="StatusListPage-grid">
            {visibleStatuses.map(status =>
                <button type="button"
                    key={status.id}
                    className={`StatusListPage-card StatusListPage-card-${status.polarity || 'neutral'}`}
                    onClick={() => navigate('/statuses/' + status.id)}
                >
                    <div className="StatusListPage-card-header">
                        <span className="StatusListPage-card-name">{status.name}</span>
                    </div>
                    {(getEffectsArray(status).length > 0 || status.grantedAction) && <div className="StatusListPage-card-badge-row">
                        {getEffectsArray(status).map((effect, i) => <span className="StatusListPage-card-effect-badge" key={effect.id || i}>{effectLabel(effect)}</span>)}
                        {status.grantedAction && <span className="StatusListPage-card-effect-badge StatusListPage-card-effect-badge-action">Grants: {status.grantedAction.actionName}</span>}
                    </div>}
                    <div className="StatusListPage-card-visibility">
                        {visibilityLabel(status)}
                    </div>
                    {status.classes?.length > 0 && <div className="StatusListPage-card-classes">{status.classes.join(', ')}</div>}
                    <div className="StatusListPage-card-description">{status.description}</div>
                </button>
            )}
            {visibleStatuses.length === 0 && <div className="StatusListPage-empty">No statuses match these filters.</div>}
        </div>

        <button type="button" className="StatusListPage-create-button" onClick={() => navigate('/statuses')}>
            + Create New Status
        </button>
        </div>
    </div>
}
