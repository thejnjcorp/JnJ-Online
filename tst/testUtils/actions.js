// An action as the editors save it: everything the sheet needs to render it
// (cost, level, frequency, and a DC or to-hit), so it passes validateAction.
export function validAction(overrides = {}) {
    return {
        id: 'a1', actionName: 'Stab', category: 'action',
        actionCost: 1, range: '', actionLevel: 1, actionType: 'standard',
        toHitBool: false, difficultyClass: 'Dex,0',
        ...overrides,
    };
}
