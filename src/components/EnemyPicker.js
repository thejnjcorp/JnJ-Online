import { useState } from 'react';
import { useBestiary } from '../utils/useBestiary';
import { ENEMY_TIERS } from '../utils/enemies';
import { EnemyTierBadge } from './EnemyTierBadge';
import '../styles/ClassPage.scss';
import '../styles/EncounterPage.scss';

// A searchable list of the bestiary. Choosing an enemy calls onPick with it and
// leaves the list open, so several can be added in a row.
export function EnemyPicker({ onPick, onClose }) {
    const { enemies, status } = useBestiary();
    const [tier, setTier] = useState('all');
    const [search, setSearch] = useState('');
    const needle = search.trim().toLowerCase();
    const options = enemies
        .filter(enemy => tier === 'all' || enemy.enemy_type === tier)
        .filter(enemy => !needle || (enemy.enemy_name || '').toLowerCase().includes(needle))
        .sort((a, b) => (a.enemy_name || '').localeCompare(b.enemy_name || ''));

    return <div className="EncounterPage-picker">
        <div className="EncounterPage-picker-controls">
            <input className="ClassPage-field-input" type="search" placeholder="Search the bestiary" aria-label="Search the bestiary" value={search} onChange={event => setSearch(event.target.value)}/>
            <select className="ClassPage-field-input" aria-label="Tier" value={tier} onChange={event => setTier(event.target.value)}>
                <option value="all">All tiers</option>
                {ENEMY_TIERS.map(item => <option key={item.key} value={item.key}>{item.plural}</option>)}
            </select>
        </div>
        {status === 'loading' && <div className="ClassPage-hint">Loading the bestiary…</div>}
        {status === 'error' && <div className="ClassPage-hint" role="alert">Couldn't load the bestiary.</div>}
        {status === 'ready' && options.length === 0 && <div className="ClassPage-hint">{enemies.length === 0 ? 'Your bestiary is empty - create some enemies first.' : 'No enemies match.'}</div>}
        <div className="EncounterPage-picker-options">
            {options.map(enemy => <button type="button" key={enemy.id} className="EncounterPage-picker-option" onClick={() => onPick(enemy)}>
                <span>{enemy.enemy_name || 'Unnamed'}</span>
                <EnemyTierBadge tier={enemy.enemy_type}/>
                <span className="EncounterPage-picker-stats">{enemy.maximum_health} HP · AC {enemy.base_armor_class}</span>
            </button>)}
        </div>
        <button type="button" className="ClassPage-add-tag-button" onClick={onClose}>Done</button>
    </div>;
}
