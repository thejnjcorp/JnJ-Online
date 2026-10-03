// Whose turn it is. The order is a list of tile keys (a player, an enemy, or a group of
// minions), the active one is who is acting now, and the round counts up each time the order
// comes back round to the top. It lives on the campaign's party doc (`combat_turn`), so everyone
// at the table sees the same turn.

export const NO_TURN = Object.freeze({ order: [], active: null, round: 1 });

export const turnOf = party => ({ ...NO_TURN, ...party?.combat_turn });

// The stored order kept as it is, with anyone who has left the fight taken out and anyone new
// put at the end. Returns the same object when nothing needed to change.
export function reconcileOrder(turn, keys) {
    const known = new Set(keys);
    const kept = (turn.order || []).filter(key => known.has(key));
    const added = keys.filter(key => !kept.includes(key));
    const order = [...kept, ...added];
    const active = known.has(turn.active) ? turn.active : null;
    if (order.length === (turn.order || []).length && order.every((key, i) => key === turn.order[i]) && active === turn.active) return turn;
    return { ...turn, order, active };
}

export const setActive = (turn, key) => ({ ...turn, active: turn.order.includes(key) ? key : turn.active });

// Move to the next turn: the one after the active (the first, when none is), and a new round
// when that comes back to the top of the order.
export function nextTurn(turn) {
    if (turn.order.length === 0) return turn;
    const index = turn.order.indexOf(turn.active);
    const next = (index + 1) % turn.order.length;
    return { ...turn, active: turn.order[next], round: index >= 0 && next === 0 ? turn.round + 1 : turn.round };
}

export function moveInOrder(turn, key, delta) {
    const from = turn.order.indexOf(key);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= turn.order.length) return turn;
    const order = [...turn.order];
    [order[from], order[to]] = [order[to], order[from]];
    return { ...turn, order };
}
