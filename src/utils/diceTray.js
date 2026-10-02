// The dice tray's own bookkeeping - what's in it, what it adds up to, and
// where its dice colour is saved. Deliberately free of @3d-dice/dice-box
// itself (and of any DOM/WebGL/Firestore) so it can be unit tested in plain
// jsdom; DiceTray.js is the only thing that talks to those.

// Where a dice colour choice belongs, from the current route: a character's
// own sheet (not the bare /characters list), or a director's view of a
// campaign - the same two places the tray itself is offered at all (see
// DiceTray.js). Anywhere else this is null.
export function diceColorContext(pathname) {
    const character = /^\/characters\/([^/]+)/.exec(pathname);
    if (character) return { collection: 'characters', id: character[1] };
    const director = /^\/directors\/([^/]+)/.exec(pathname);
    if (director) return { collection: 'campaigns', id: director[1] };
    return null;
}

// The polyhedral dice this app's classes are built from (see
// CharacterDiceConverter, CharacterStatCalculator.js) - the same six sides,
// in the same order, as the tray's quick-pick buttons.
export const DIE_SIDES = [4, 6, 8, 10, 12, 20];

export const emptyPool = () => Object.fromEntries(DIE_SIDES.map(sides => [sides, 0]));

export const poolCount = pool => DIE_SIDES.reduce((sum, sides) => sum + (pool[sides] || 0), 0);

// What's in the tray, as a plain dice-notation summary - "2d6, 1d20" - not
// what gets sent to dice-box (that's one call per die added, see DiceTray.js).
export function poolSummary(pool) {
    return DIE_SIDES.filter(sides => pool[sides] > 0).map(sides => `${pool[sides]}d${sides}`).join(', ');
}

// dice-box's roll/add promises resolve to results that, depending on version
// and call, come back either as a flat array of individual dice (each having
// its own `value`) or as an array of roll groups (each with a `rolls` array
// and its own group `value`) - this copes with either shape rather than
// betting on one.
const valuesOf = results => (results || []).flatMap(item => (
    Array.isArray(item?.rolls) ? item.rolls.map(r => Number(r.value) || 0) : [Number(item?.value) || 0]
));

export const individualValues = valuesOf;

export const diceTotal = results => valuesOf(results).reduce((sum, value) => sum + value, 0);

export const grandTotal = (results, modifier) => diceTotal(results) + (Number(modifier) || 0);

// "+3", "-2", or "" for no modifier at all.
export function formatModifier(modifier) {
    if (modifier > 0) return `+${modifier}`;
    return modifier < 0 ? `${modifier}` : '';
}

// The breakdown line under the total - "4 + 6 + 2 +3", or just the dice sum
// when there is no modifier.
export function breakdownText(results, modifier) {
    const values = valuesOf(results);
    if (values.length === 0) return '';
    const sign = formatModifier(modifier);
    return sign ? `${values.join(' + ')} ${sign}` : values.join(' + ');
}
