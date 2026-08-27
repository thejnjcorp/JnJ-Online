// Mirrors isAdmin() in firebase/firestore.rules - only this account can
// create/promote a status to isDefault (an admin-curated status every
// campaign gets automatically, no subscription needed). Everything else a
// non-admin creates is a "pool" status: still public/browsable, but a
// campaign has to separately subscribe (campaigns.subscribedStatusIds)
// before it's offered as a preset for that campaign's characters - see
// AddStatusDialog.js. This constant only drives which options StatusPage.js
// shows; the actual enforcement lives in firestore.rules, which a client
// change here can't bypass.
export const ADMIN_UIDS = ["wmJQbIlzX9RydXFmh3DzSBpIqHa2"];

// Shared logic for what an active status actually DOES to a character -
// used by the character page (effective stat display, granted actions) and
// the Director's combat tracker (turn advancement). Kept out of any one
// component so both sides of the app compute this identically.
//
// A status can carry any number of `effects`, each `{ stat, trigger, mode,
// delta, table }`:
//   - trigger: "turn_start" - applied once per "Next Turn" click while the
//     status has stacks remaining, then the status loses a stack (see
//     advanceTurnStatuses). Only makes sense for a spendable resource -
//     currently just action_points (Haste/Slowed/Stunned-style).
//   - trigger: "passive" - not turn-based at all; continuously folded into
//     the stat everywhere it's displayed/used for as long as the status is
//     present (see getEffectiveCharacterStats). For AC/hit/damage/hardness/
//     ability scores (a temporary Strength buff, Frightened, Exhaustion).
//   - mode: "flat" (default) - `delta` applies as-is, regardless of stacks.
//   - mode: "scaled" - `delta` is ignored; `table` (an array of
//     `{level, delta}`, one row per stack count that changes the value) is
//     looked up by the status's current `stacks`, using the entry with the
//     largest `level` that's <= stacks (so a stacks value between two
//     defined levels, or above the highest one, still resolves sensibly).
//     This is what lets one non-stacking-in-name-only "Exhaustion" status
//     reproduce the ruleset's table (-1/-1/-2/-4/-6/-9 across its six
//     levels) instead of needing six separate discrete statuses.
// STATUS_STAT_DEFINITIONS below is the source of truth for which triggers a
// given stat supports - the admin form (StatusPage.js) drives its stat/
// trigger pickers from this list rather than allowing free combinations.
export const STATUS_STAT_DEFINITIONS = [
    { key: 'action_points', label: 'Action Points', triggers: ['turn_start'] },
    { key: 'base_armor_class', label: 'Armor Class', triggers: ['passive'] },
    { key: 'base_hit_modifier', label: 'Hit Modifier', triggers: ['passive'] },
    { key: 'base_damage_modifier', label: 'Damage Modifier', triggers: ['passive'] },
    { key: 'hardness', label: 'Hardness', triggers: ['passive'] },
    { key: 'strength_stat', label: 'Strength', triggers: ['passive'] },
    { key: 'dexterity_stat', label: 'Dexterity', triggers: ['passive'] },
    { key: 'intelligence_stat', label: 'Intelligence', triggers: ['passive'] },
    { key: 'charisma_stat', label: 'Charisma', triggers: ['passive'] },
];

// Statuses created before `effects` (an array) existed only had a single
// `effect` object - keeps those readable without a data migration.
export function getEffectsArray(status) {
    if (Array.isArray(status.effects)) return status.effects;
    if (status.effect) return [status.effect];
    return [];
}

function activeStatuses(characterPage) {
    return characterPage?.statuses || [];
}

// The scaled-by-stacks lookup described above: the defined level closest to
// (without exceeding) the current stack count, or 0 if stacks is below every
// defined level (e.g. a status added with stacks temporarily at 0).
function lookupScaledDelta(table, stacks) {
    const applicable = (table || []).filter(row => row.level <= stacks);
    if (applicable.length === 0) return 0;
    const closest = applicable.reduce((max, row) => row.level > max.level ? row : max);
    return Number(closest.delta) || 0;
}

function effectDelta(effect, stacks) {
    return effect.mode === 'scaled' ? lookupScaledDelta(effect.table, stacks) : (Number(effect.delta) || 0);
}

// baseValue + every passive delta targeting `statKey` from every status
// currently on the character (regardless of stacks for a flat effect - a
// passive condition like a Strength buff doesn't need stacks>0 to be "on",
// it's on because it's present. A scaled effect reads stacks as its
// severity level instead - see effectDelta/lookupScaledDelta above).
function applyPassive(baseValue, statKey, characterPage) {
    const delta = activeStatuses(characterPage).reduce((sum, status) => {
        const statusEffects = getEffectsArray(status).filter(e => e.stat === statKey && e.trigger === 'passive');
        return sum + statusEffects.reduce((s, e) => s + effectDelta(e, status.stacks), 0);
    }, 0);
    return baseValue + delta;
}

// Returns characterPage with every passive-effect-bearing field replaced by
// its effective (base + active statuses) value - a drop-in substitute
// everywhere those fields are currently read directly (CharacterStatCalculator
// inputs, ability score display, hardness display).
export function getEffectiveCharacterStats(characterPage) {
    return {
        ...characterPage,
        base_armor_class: applyPassive(characterPage.base_armor_class, 'base_armor_class', characterPage),
        base_hit_modifier: applyPassive(characterPage.base_hit_modifier, 'base_hit_modifier', characterPage),
        base_damage_modifier: applyPassive(characterPage.base_damage_modifier, 'base_damage_modifier', characterPage),
        hardness: applyPassive(characterPage.hardness, 'hardness', characterPage),
        strength_stat: applyPassive(characterPage.strength_stat, 'strength_stat', characterPage),
        dexterity_stat: applyPassive(characterPage.dexterity_stat, 'dexterity_stat', characterPage),
        intelligence_stat: applyPassive(characterPage.intelligence_stat, 'intelligence_stat', characterPage),
        charisma_stat: applyPassive(characterPage.charisma_stat, 'charisma_stat', characterPage),
    };
}

// How much a single stat is currently modified by active statuses - for
// showing "3 (+2)"-style annotations next to the raw editable base value,
// without silently swapping what the input itself is bound to.
export function getPassiveDelta(characterPage, statKey) {
    return applyPassive(0, statKey, characterPage);
}

// Actions a status grants while it's active (e.g. a "Identify" status
// granting a free Identify action) - merged into the character's normal
// actions list wherever those are rendered (CharacterMainTab.js). Tagged so
// they're visually distinguishable from the character's own class actions.
export function getGrantedActions(characterPage) {
    return activeStatuses(characterPage)
        .filter(status => status.grantedAction?.actionName)
        .map(status => ({
            ...status.grantedAction,
            tags: [
                { tagInfo: status.name, tagColor: 'var(--jnj-color-arcane)', textColor: '#fff' },
                ...(status.grantedAction.tags || []),
            ],
            grantedByStatusId: status.id,
        }));
}

// Whether a status counts down by a stack each "Next Turn". This is
// deliberately independent of whether it has a turn_start (mutating)
// effect - Haste/Slowed/Stunned both mutate action_points AND count down,
// but Frightened counts down too despite its -1 to hit rolls being a
// continuous passive effect the whole time it's active, not something that
// gets "applied" turn by turn. `decaysPerTurn` defaults from whether the
// status has a turn_start effect only for statuses saved before this field
// existed - StatusPage.js always sets it explicitly now.
function decaysPerTurn(status) {
    if (typeof status.decaysPerTurn === 'boolean') return status.decaysPerTurn;
    return getEffectsArray(status).some(e => e.trigger === 'turn_start');
}

// Applies every active status's turn_start effects (currently only
// action_points, per STATUS_STAT_DEFINITIONS) for statuses that decay per
// turn, and counts those statuses' stacks down by one, dropping each once
// stacks reach 0 - mirrors the ruleset's own Haste/Slowed examples ("Haste 2
// means you gain 1 action on turn 1... then you gain another action turn 2
// and remove haste"). A status that doesn't decay per turn (a passive
// condition like Exhaustion, or a purely descriptive one like Wounded) is
// left completely untouched here - it only goes away by being removed by
// hand or (for Wounded) an explicit rest, not by turns passing.
export function advanceTurnStatuses(characterPage) {
    let actionPoints = characterPage.action_points;
    const nextStatuses = [];

    activeStatuses(characterPage).forEach(status => {
        if (!decaysPerTurn(status) || (status.stacks ?? 0) <= 0) {
            nextStatuses.push(status);
            return;
        }
        getEffectsArray(status).filter(e => e.trigger === 'turn_start').forEach(effect => {
            if (effect.stat === 'action_points') {
                actionPoints = Math.max(0, Math.min(4, actionPoints + effectDelta(effect, status.stacks)));
            }
        });
        const remainingStacks = status.stacks - 1;
        if (remainingStacks > 0) nextStatuses.push({ ...status, stacks: remainingStacks });
    });

    return { action_points: actionPoints, statuses: nextStatuses };
}
