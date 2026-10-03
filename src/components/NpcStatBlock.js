import { useState } from 'react';
import { checkText, npcAbilities, npcDefenses, npcVitals, rollCheck } from '../utils/npcStatBlock';
import { signed } from '../utils/combatants';
import { EnemyTierBadge } from './EnemyTierBadge';

function actionLine(action) {
    const cost = Number(action.actionCost);
    const parts = [];
    if (action.category === 'reaction') parts.push('Reaction');
    if (cost > 0) parts.push(`${cost} ${cost === 1 ? 'action' : 'actions'}`);
    return parts.join(' · ');
}

// An NPC's stat block, as the director needs it mid-scene: the numbers, a button to roll a
// check for each ability, what it is weak to, and its actions (open one to read it).
export function NpcStatBlock({ enemy }) {
    const [results, setResults] = useState({});
    const roll = ability => setResults(previous => ({ ...previous, [ability.key]: rollCheck(ability.modifier) }));
    const defenses = npcDefenses(enemy);
    const actions = (enemy.actions || []).filter(action => action.actionName);

    return <section className="Scenes-card Scenes-statblock" aria-label={`${enemy.enemy_name || 'Enemy'} stat block`}>
        <div className="Scenes-run-npc">
            <strong>{enemy.enemy_name || 'Unnamed enemy'}</strong>
            <EnemyTierBadge tier={enemy.enemy_type}/>
            <span className="Scenes-muted">{`Level ${enemy.level ?? 1}`}</span>
        </div>
        <dl className="Scenes-statblock-vitals">
            {npcVitals(enemy).map(vital => <div key={vital.label}><dt>{vital.label}</dt><dd>{vital.value}</dd></div>)}
        </dl>
        <ul className="Scenes-statblock-abilities">
            {npcAbilities(enemy).map(ability => <li key={ability.key}>
                <span className="Scenes-statblock-ability" title={ability.name}><strong>{ability.key}</strong>{` ${signed(ability.modifier)}`}</span>
                <button type="button" className="Scenes-button Scenes-button-small" aria-label={`Roll ${ability.name} check`} onClick={() => roll(ability)}>Roll</button>
                {results[ability.key] && <output className="Scenes-statblock-result" aria-label={`${ability.name} check`}>{checkText(results[ability.key])}</output>}
            </li>)}
        </ul>
        {defenses.length > 0 && <div className="Scenes-chips">
            {defenses.map(defense => <span key={defense.label} className="Scenes-chip">{`${defense.label} ${defense.entries.join(', ')}`}</span>)}
        </div>}
        {enemy.description && <p className="Scenes-statblock-notes">{enemy.description}</p>}
        {actions.length > 0 && <div className="Scenes-statblock-actions">
            <span className="Scenes-field-label">Actions</span>
            {actions.map((action, index) => <details key={action.id || `${action.actionName}:${index}`}>
                <summary><strong>{action.actionName}</strong>{actionLine(action) && <span className="Scenes-muted">{` · ${actionLine(action)}`}</span>}</summary>
                {action.description ? <p>{action.description}</p> : <p className="Scenes-muted">No description.</p>}
            </details>)}
        </div>}
    </section>;
}

// The stat block a beat is tied to, looked up in the bestiary that was loaded for it.
export function LinkedStatBlock({ enemyId, bestiary }) {
    if (!enemyId) return null;
    const enemy = (bestiary?.enemies || []).find(candidate => candidate.id === enemyId);
    if (enemy) return <NpcStatBlock enemy={enemy}/>;
    if (!bestiary || bestiary.status === 'loading') return <span className="Scenes-muted">Loading the stat block…</span>;
    if (bestiary.status === 'error') return <span className="Scenes-muted" role="alert">Couldn't load the stat block.</span>;
    return <span className="Scenes-muted">This NPC's stat block is no longer in the bestiary.</span>;
}
