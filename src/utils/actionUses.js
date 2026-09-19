// Limited-use actions: "Per Day", "Per Short Rest" or "Per Combat", a number of
// times (`actionTypeCount`). A character keeps how many uses it has SPENT, by
// action name, in `action_uses` ({ "Fleetfoot": 1 }); what is left is the
// action's total minus that. An action never used has no entry.

export const LIMITED_FREQUENCIES = {
    perDay: 'Day',
    perShortRest: 'Short Rest',
    perCombat: 'Combat',
};

export const isLimitedUse = action => Boolean(LIMITED_FREQUENCIES[action?.actionType]);

export const frequencyName = action => LIMITED_FREQUENCIES[action?.actionType] || '';

export const usesTotal = action => Math.max(1, Math.trunc(Number(action?.actionTypeCount)) || 1);

const spentOf = (action, uses) => Math.min(usesTotal(action), Math.max(0, Math.trunc(Number(uses?.[action.actionName])) || 0));

export const usesLeft = (action, uses) => usesTotal(action) - spentOf(action, uses);

// A copy of `uses` with `left` uses remaining on this action (kept within 0 to its total).
export function setUsesLeft(uses, action, left) {
    const spent = usesTotal(action) - Math.min(usesTotal(action), Math.max(0, left));
    const next = { ...uses };
    if (spent === 0) delete next[action.actionName];
    else next[action.actionName] = spent;
    return next;
}

export const spendUse = (uses, action) => setUsesLeft(uses, action, usesLeft(action, uses) - 1);

// What a rest gives back. A new combat refreshes per-combat actions; a short
// rest also refreshes per-short-rest ones; a new day refreshes all of them.
export const RESETS = [
    { key: 'combat', label: 'New combat', frequencies: ['perCombat'] },
    { key: 'short', label: 'Short rest', frequencies: ['perCombat', 'perShortRest'] },
    { key: 'day', label: 'New day', frequencies: ['perCombat', 'perShortRest', 'perDay'] },
];

const refreshedBy = (reset, action) => reset.frequencies.includes(action.actionType);

export const hasSpentUses = (actions, uses, reset) => actions.some(action => refreshedBy(reset, action) && usesLeft(action, uses) < usesTotal(action));

export function resetUses(actions, uses, reset) {
    const next = { ...uses };
    actions.filter(action => refreshedBy(reset, action)).forEach(action => { delete next[action.actionName]; });
    return next;
}
