import '../styles/MapDrawing.scss';

// What a director can do with the enemy or other NPC whose token they have selected
// on the combat map: mark it defeated (and bring it back), or take it out of the
// fight. `combatant` is { id, title, defeated }; nothing is shown for none.
export function MapCombatantToolbar({ combatant, onSetDefeated, onRemove }) {
    if (!combatant) return null;
    const name = combatant.title || 'Combatant';
    return <div className="MapImageTokenToolbar" role="toolbar" aria-label="Selected combatant">
        <div className="MapDrawingToolbar-group">
            <span className="MapDrawingToolbar-label">{name}{combatant.defeated ? ' - defeated' : ''}</span>
            {onSetDefeated && <button type="button" className="MapDrawingToolbar-button" onClick={() => onSetDefeated(combatant.id, !combatant.defeated)}>
                {combatant.defeated ? 'Revive' : 'Mark defeated'}
            </button>}
            {onRemove && <button type="button" className="MapDrawingToolbar-button" onClick={() => onRemove(combatant)}>Remove from fight</button>}
        </div>
    </div>;
}
