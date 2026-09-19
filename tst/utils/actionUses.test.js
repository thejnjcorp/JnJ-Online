import { RESETS, hasSpentUses, isLimitedUse, resetUses, setUsesLeft, spendUse, usesLeft, usesTotal, frequencyName } from '../../src/utils/actionUses';

const perDay = { actionName: 'Fleetfoot', actionType: 'perDay', actionTypeCount: 2 };
const perShortRest = { actionName: 'Second Wind', actionType: 'perShortRest', actionTypeCount: 1 };
const perCombat = { actionName: 'Rage', actionType: 'perCombat', actionTypeCount: 3 };
const standard = { actionName: 'Stab', actionType: 'standard' };
const reset = key => RESETS.find(r => r.key === key);

describe('which actions are limited', () => {
    test('per day, per short rest and per combat are; standard (or nothing) is not', () => {
        expect([perDay, perShortRest, perCombat].every(isLimitedUse)).toBe(true);
        expect(isLimitedUse(standard)).toBe(false);
        expect(isLimitedUse({ actionName: 'Old action' })).toBe(false);
        expect(isLimitedUse(undefined)).toBe(false);
    });

    test('the frequency is named for how it is shown', () => {
        expect(frequencyName(perDay)).toBe('Day');
        expect(frequencyName(perShortRest)).toBe('Short Rest');
        expect(frequencyName(perCombat)).toBe('Combat');
    });

    test('the total is the times count, at least 1', () => {
        expect(usesTotal(perDay)).toBe(2);
        expect(usesTotal({ ...perDay, actionTypeCount: undefined })).toBe(1);
        expect(usesTotal({ ...perDay, actionTypeCount: 0 })).toBe(1);
        expect(usesTotal({ ...perDay, actionTypeCount: '3' })).toBe(3);
    });
});

describe('uses left', () => {
    test('an action never used has all of its uses', () => {
        expect(usesLeft(perDay, {})).toBe(2);
        expect(usesLeft(perDay, undefined)).toBe(2);
    });

    test('is the total minus what was spent, never below 0 or above the total', () => {
        expect(usesLeft(perDay, { Fleetfoot: 1 })).toBe(1);
        expect(usesLeft(perDay, { Fleetfoot: 2 })).toBe(0);
        expect(usesLeft(perDay, { Fleetfoot: 9 })).toBe(0);
        expect(usesLeft(perDay, { Fleetfoot: -3 })).toBe(2);
        expect(usesLeft(perDay, { Fleetfoot: 'lots' })).toBe(2);
    });

    test('is kept per action', () => {
        expect(usesLeft(perCombat, { Fleetfoot: 2 })).toBe(3);
    });
});

describe('changing uses', () => {
    test('spendUse uses one, without changing the map it was given', () => {
        const before = { Fleetfoot: 1 };
        expect(spendUse(before, perDay)).toEqual({ Fleetfoot: 2 });
        expect(before).toEqual({ Fleetfoot: 1 });
    });

    test('spending the last use leaves none, and a further spend changes nothing', () => {
        expect(spendUse({ Fleetfoot: 2 }, perDay)).toEqual({ Fleetfoot: 2 });
    });

    test('setUsesLeft to the full total removes the entry', () => {
        expect(setUsesLeft({ Fleetfoot: 1, Rage: 1 }, perDay, 2)).toEqual({ Rage: 1 });
    });

    test('setUsesLeft stays within 0 and the total', () => {
        expect(setUsesLeft({}, perDay, -4)).toEqual({ Fleetfoot: 2 });
        expect(setUsesLeft({ Fleetfoot: 1 }, perDay, 9)).toEqual({});
    });
});

describe('resting', () => {
    const actions = [perDay, perShortRest, perCombat, standard];
    const spent = { Fleetfoot: 1, 'Second Wind': 1, Rage: 2, Stab: 1 };

    test('a new combat only refreshes per-combat actions', () => {
        expect(resetUses(actions, spent, reset('combat'))).toEqual({ Fleetfoot: 1, 'Second Wind': 1, Stab: 1 });
    });

    test('a short rest refreshes per-combat and per-short-rest actions', () => {
        expect(resetUses(actions, spent, reset('short'))).toEqual({ Fleetfoot: 1, Stab: 1 });
    });

    test('a new day refreshes every limited action', () => {
        expect(resetUses(actions, spent, reset('day'))).toEqual({ Stab: 1 });
    });

    test('does not change the map it was given', () => {
        resetUses(actions, spent, reset('day'));
        expect(spent).toEqual({ Fleetfoot: 1, 'Second Wind': 1, Rage: 2, Stab: 1 });
    });

    test('hasSpentUses is true only when something that rest refreshes has been used', () => {
        expect(hasSpentUses(actions, {}, reset('day'))).toBe(false);
        expect(hasSpentUses(actions, { Fleetfoot: 1 }, reset('day'))).toBe(true);
        expect(hasSpentUses(actions, { Fleetfoot: 1 }, reset('short'))).toBe(false); // a per-day use survives a short rest
        expect(hasSpentUses(actions, { Rage: 1 }, reset('combat'))).toBe(true);
    });
});
