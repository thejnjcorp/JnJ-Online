import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../utils/firebase';
import { useBestiary } from '../utils/useBestiary';
import { ENEMY_TIERS } from '../utils/enemies';
import { EnemyTierBadge } from './EnemyTierBadge';
import '../styles/StatusListPage.scss';
import '../styles/BestiaryPage.scss';

const OWNERSHIP_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'mine', label: 'Mine' },
    { key: 'public', label: 'Public' },
];

const tierRank = key => ENEMY_TIERS.findIndex(tier => tier.key === key);

// Your library of enemy stat blocks - filter by tier, or search by name - and
// where you make new ones. An enemy is copied into an encounter (or straight
// into a fight) when you use it.
export function BestiaryPage() {
    const { enemies, status } = useBestiary();
    const [userId, setUserId] = useState('');
    const [tier, setTier] = useState('all');
    const [ownership, setOwnership] = useState('all');
    const [search, setSearch] = useState('');
    const navigate = useNavigate();
    document.title = 'Bestiary';

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => { if (user) setUserId(user.uid); });
        return () => unsubscribe();
    }, []);

    const needle = search.trim().toLowerCase();
    const shown = enemies
        .filter(enemy => tier === 'all' || enemy.enemy_type === tier)
        .filter(enemy => ownership === 'all' || (ownership === 'mine' && enemy.canWrite?.includes(userId)) || (ownership === 'public' && enemy.public))
        .filter(enemy => !needle || (enemy.enemy_name || '').toLowerCase().includes(needle))
        .sort((a, b) => tierRank(a.enemy_type) - tierRank(b.enemy_type) || (a.enemy_name || '').localeCompare(b.enemy_name || ''));

    return <div className="StatusListPage">
        <div className="StatusListPage-inner">
            <div className="StatusListPage-header">
                <h1 className="StatusListPage-title">Bestiary</h1>
                <p className="StatusListPage-subtitle">Your library of enemies. Build them once, then drop them into any encounter - each fight gets its own copy.</p>
            </div>

            <div className="StatusListPage-filter-groups">
                <div className="StatusListPage-filters" role="group" aria-label="Whose">
                    {OWNERSHIP_FILTERS.map(option => <button type="button" key={option.key}
                        className={ownership === option.key ? 'StatusListPage-filter-button StatusListPage-filter-button-active' : 'StatusListPage-filter-button'}
                        aria-pressed={ownership === option.key}
                        onClick={() => setOwnership(option.key)}
                    >{option.label}</button>)}
                </div>
                <div className="StatusListPage-filters" role="group" aria-label="Tier">
                    {[{ key: 'all', label: 'All' }, ...ENEMY_TIERS.map(item => ({ key: item.key, label: item.plural }))].map(option => <button type="button" key={option.key}
                        className={tier === option.key ? 'StatusListPage-filter-button StatusListPage-filter-button-active' : 'StatusListPage-filter-button'}
                        aria-pressed={tier === option.key}
                        onClick={() => setTier(option.key)}
                    >{option.label}</button>)}
                </div>
                <input className="BestiaryPage-search" type="search" placeholder="Search enemies" aria-label="Search enemies" value={search} onChange={event => setSearch(event.target.value)}/>
            </div>

            <div className="StatusListPage-grid">
                {shown.map(enemy => <button type="button" key={enemy.id} className="StatusListPage-card StatusListPage-card-neutral" onClick={() => navigate('/enemies/' + enemy.id)}>
                    <div className="StatusListPage-card-header">
                        <span className="StatusListPage-card-name">{enemy.enemy_name || 'Unnamed'}</span>
                        <EnemyTierBadge tier={enemy.enemy_type}/>
                    </div>
                    <div className="BestiaryPage-stats">
                        <span>Lvl {enemy.level ?? 1}</span>
                        <span>{enemy.maximum_health ?? '?'} HP</span>
                        <span>AC {enemy.base_armor_class ?? '?'}</span>
                        <span>{enemy.actions?.length || 0} {enemy.actions?.length === 1 ? 'action' : 'actions'}</span>
                    </div>
                    <div className="StatusListPage-card-visibility">{enemy.public ? 'Public' : 'Private'}</div>
                </button>)}
                {shown.length === 0 && <div className="StatusListPage-empty">
                    {status === 'error' ? "Couldn't load the bestiary." : status === 'loading' ? 'Loading…' : enemies.length === 0 ? 'No enemies yet - create your first.' : 'No enemies match these filters.'}
                </div>}
            </div>

            <button type="button" className="StatusListPage-create-button" onClick={() => navigate('/enemies')}>+ Create New Enemy</button>
        </div>
    </div>;
}
