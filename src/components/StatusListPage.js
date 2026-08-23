import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../utils/firebase';
import '../styles/StatusListPage.scss';

const POLARITY_FILTERS = ['all', 'buff', 'debuff', 'neutral'];

export function StatusListPage() {
    const [statusList, setStatusList] = useState([]);
    const [filterPolarity, setFilterPolarity] = useState('all');
    const navigate = useNavigate();
    const location = useLocation();
    document.title = 'Statuses';

    useEffect(() => {
        getDocs(query(collection(db, 'statuses'))).then(querySnapshot => {
            setStatusList(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }).catch(error => console.log(error));
    }, [location]);

    const visibleStatuses = statusList.filter(status =>
        filterPolarity === 'all' || status.polarity === filterPolarity
    );

    return <div className="StatusListPage">
        <div className="StatusListPage-header">
            <h1 className="StatusListPage-title">Statuses</h1>
            <p className="StatusListPage-subtitle">The shared catalog of conditions players and directors can apply to characters.</p>
        </div>

        <div className="StatusListPage-filters">
            {POLARITY_FILTERS.map(polarity =>
                <button
                    key={polarity}
                    className={filterPolarity === polarity ? 'StatusListPage-filter-button StatusListPage-filter-button-active' : 'StatusListPage-filter-button'}
                    onClick={() => setFilterPolarity(polarity)}
                >
                    {polarity === 'all' ? 'All' : polarity[0].toUpperCase() + polarity.slice(1)}
                </button>
            )}
        </div>

        <div className="StatusListPage-grid">
            {visibleStatuses.map(status =>
                <button
                    key={status.id}
                    className={`StatusListPage-card StatusListPage-card-${status.polarity || 'neutral'}`}
                    onClick={() => navigate('/statuses/' + status.id)}
                >
                    <div className="StatusListPage-card-header">
                        <span className="StatusListPage-card-name">{status.name}</span>
                        {status.effect && <span className="StatusListPage-card-effect-badge">
                            {status.effect.delta > 0 ? '+' : ''}{status.effect.delta} AP / turn
                        </span>}
                    </div>
                    {status.classes?.length > 0 && <div className="StatusListPage-card-classes">{status.classes.join(', ')}</div>}
                    <div className="StatusListPage-card-description">{status.description}</div>
                </button>
            )}
            {visibleStatuses.length === 0 && <div className="StatusListPage-empty">No statuses yet.</div>}
        </div>

        <button className="StatusListPage-create-button" onClick={() => navigate('/statuses')}>
            + Create New Status
        </button>
    </div>
}
