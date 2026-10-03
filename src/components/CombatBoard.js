import { EntityTile } from './EntityTile';
import { useCombat } from './CombatContext';
import { groupName } from '../utils/combatants';
import '../styles/Combat.scss';

const tileName = tile => (tile.kind === 'group' ? groupName(tile.members) : (tile.member || tile).name);

// The party, a tile for each player - down the left of a scene while it is being run.
export function PartyTiles() {
    const { players, turn, api } = useCombat();
    if (players.length === 0) return null;
    return <div className="Combat-column">
        <span className="Combat-column-title">Player Characters</span>
        {players.map(player => <EntityTile key={player.id} tile={player} active={turn.active === player.id} api={api}/>)}
    </div>;
}

// The enemies in the fight, a tile for each (minions of a kind share one) - down the right of a
// combat beat - with the ways to put more of them in and to clear them out.
export function EnemyTiles({ onAdd, onEncounters, onClear }) {
    const { tiles, turn, api } = useCombat();
    return <div className="Combat-column Combat-column-enemies">
        <div className="Combat-column-head">
            <span className="Combat-column-title">Enemies</span>
            <span className="Combat-column-tools">
                <button type="button" className="Entity-button" onClick={onAdd}>+ Add Enemy</button>
                <button type="button" className="Entity-button" onClick={onEncounters}>Encounters</button>
                {tiles.length > 0 && <button type="button" className="Entity-button" onClick={onClear}>Clear all</button>}
            </span>
        </div>
        {tiles.length === 0 && <span className="Entity-muted">No enemies in the fight. Add one from your bestiary, or stage an encounter.</span>}
        {tiles.map(tile => <EntityTile key={tile.key} tile={tile} active={turn.active === tile.key} api={api}/>)}
    </div>;
}

// Whose turn it is: everyone in the order they act, the one acting highlighted, the round, and the
// way to hand the turn on. Click anyone to give them the turn; the arrows move the acting one up
// or down the order.
export function TurnOrder() {
    const { players, tiles, turn, api } = useCombat();
    const names = new Map([...players.map(player => [player.id, player.name]), ...tiles.map(tile => [tile.key, tileName(tile)])]);
    return <div className="Turn-order" role="group" aria-label="Turn order">
        <span className="Turn-order-title">Turn order</span>
        {turn.order.length === 0 && <span className="Entity-muted">No one in the fight yet.</span>}
        {turn.order.map(key => <button type="button" key={key} aria-pressed={turn.active === key}
            className={turn.active === key ? 'Turn-chip Turn-chip-active' : 'Turn-chip'} onClick={() => api.setActiveKey(key)}>{names.get(key)}</button>)}
        {turn.active && <span className="Turn-order-move">
            <button type="button" aria-label="Move earlier in the order" onClick={() => api.moveInOrder(turn.active, -1)}>&lsaquo;</button>
            <button type="button" aria-label="Move later in the order" onClick={() => api.moveInOrder(turn.active, 1)}>&rsaquo;</button>
        </span>}
        <span className="Turn-order-round">{`Round ${turn.round}`}</span>
        <button type="button" className="Entity-button Entity-button-primary" disabled={turn.order.length === 0} onClick={() => api.endTurn()}>{turn.active ? 'End turn →' : 'Start combat →'}</button>
    </div>;
}
