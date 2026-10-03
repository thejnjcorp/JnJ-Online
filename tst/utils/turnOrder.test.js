import { NO_TURN, moveInOrder, nextTurn, reconcileOrder, setActive, turnOf } from '../../src/utils/turnOrder';

const turn = (fields = {}) => ({ ...NO_TURN, order: ['a', 'b', 'c'], ...fields });

describe('turnOf', () => {
    test('is a fresh turn with no party doc, or none stored', () => {
        expect(turnOf(undefined)).toEqual(NO_TURN);
        expect(turnOf({})).toEqual(NO_TURN);
        expect(turnOf({ combat_turn: { order: ['a'], active: 'a', round: 3 } })).toEqual({ order: ['a'], active: 'a', round: 3 });
    });
});

describe('reconcileOrder', () => {
    test('keeps the order, drops who left the fight and adds anyone new at the end', () => {
        expect(reconcileOrder(turn({ active: 'b' }), ['c', 'a', 'd'])).toEqual({ order: ['a', 'c', 'd'], active: null, round: 1 });
        expect(reconcileOrder(turn({ active: 'a' }), ['a', 'b', 'c', 'd'])).toEqual({ order: ['a', 'b', 'c', 'd'], active: 'a', round: 1 });
    });

    test('is the very same turn when nothing changed, so nothing is written', () => {
        const same = turn({ active: 'b' });
        expect(reconcileOrder(same, ['a', 'b', 'c'])).toBe(same);
    });

    test('an empty turn takes everyone in the order given', () => {
        expect(reconcileOrder(NO_TURN, ['x', 'y']).order).toEqual(['x', 'y']);
    });
});

describe('setActive', () => {
    test('makes someone in the order the active turn, and ignores anyone who is not', () => {
        expect(setActive(turn(), 'b').active).toBe('b');
        expect(setActive(turn({ active: 'a' }), 'zzz').active).toBe('a');
    });
});

describe('nextTurn', () => {
    test('goes to the next in the order, and starts a new round when it comes back to the top', () => {
        expect(nextTurn(turn({ active: 'a' }))).toMatchObject({ active: 'b', round: 1 });
        expect(nextTurn(turn({ active: 'c', round: 2 }))).toMatchObject({ active: 'a', round: 3 });
    });

    test('with no one active it starts at the top, still in the first round', () => {
        expect(nextTurn(turn())).toMatchObject({ active: 'a', round: 1 });
    });

    test('with no one in the order there is nowhere to go', () => {
        expect(nextTurn(NO_TURN)).toBe(NO_TURN);
    });
});

describe('moveInOrder', () => {
    test('swaps someone with their neighbour, and stops at either end', () => {
        expect(moveInOrder(turn(), 'b', -1).order).toEqual(['b', 'a', 'c']);
        expect(moveInOrder(turn(), 'b', 1).order).toEqual(['a', 'c', 'b']);
        expect(moveInOrder(turn(), 'a', -1).order).toEqual(['a', 'b', 'c']);
        expect(moveInOrder(turn(), 'c', 1).order).toEqual(['a', 'b', 'c']);
        expect(moveInOrder(turn(), 'zzz', 1).order).toEqual(['a', 'b', 'c']);
    });
});
