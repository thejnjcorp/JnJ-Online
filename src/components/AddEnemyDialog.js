import { enemyInstance, uniqueEnemyName } from '../utils/enemies';
import { EnemyPicker } from './EnemyPicker';
import '../styles/EncounterPage.scss';

// Adds enemies from the bestiary straight into the fight, without an encounter.
// Each pick is one more enemy, named so it doesn't repeat one already there;
// the list stays open to add several. `existing` is the fight's enemies so far,
// `onAdd` is given the new enemy to write.
export function AddEnemyDialog({ existing, onAdd, onClose }) {
    return <>
        <button type="button" className="EncounterPage-scrim" aria-label="Close" onClick={onClose}/>
        <div className="EncounterPage-dialog" role="dialog" aria-modal="true" aria-label="Add enemy" onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
            <h2 className="EncounterPage-dialog-title">Add enemy</h2>
            <p className="EncounterPage-dialog-help">Pick an enemy from your bestiary to add it to the fight at full health. Pick it again for more.</p>
            <EnemyPicker
                onClose={onClose}
                onPick={enemy => onAdd(enemyInstance(enemy, uniqueEnemyName(existing.map(other => other.enemy_name), enemy.enemy_name)))}
            />
        </div>
    </>;
}
