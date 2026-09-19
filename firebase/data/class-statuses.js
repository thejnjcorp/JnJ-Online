// Class-specific statuses for firebase/scripts/publish-class-statuses.js.
//
// `classes` matches by class name (see AddStatusDialog.js), so these only show
// up as presets on Monk sheets. Descriptions render as plain text on the sheet.

const MONK = ['Monk'];

function status({ name, polarity, defaultStacks = 0, description, effects = [] }) {
    return { name, polarity, defaultStacks, classes: MONK, effects, decaysPerTurn: false, grantedAction: null, description };
}

// Tokens and Stances have no mechanics of their own - the Monk's actions refer
// to them - so they use the Token status type.
const token = (name, gained, consumedBy, cost) => status({
    name,
    polarity: 'token',
    defaultStacks: 1,
    description: `Ignatious Shift resource. ${gained} ${consumedBy} consumes ${cost}. Unspent Tokens remain when you enter or complete a Stance; all Tokens are lost at the end of combat.`,
});

const TRIAL_RULES = 'You may have up to two active Trials at a time; entering a third means abandoning one (remove its status). Completing the Trial ends the Stance: remove this status and add the matching Unlock.';

const stance = (heartName, cost, token, refund, trial) => status({
    name: `Stance: ${heartName}`,
    polarity: 'token',
    description: `Ignatious Shift Trial in progress. Entered by consuming ${cost} ${token}; on entering, immediately regain one charge of ${refund} (once per combat). Trial: ${trial} ${TRIAL_RULES}`,
});

const unlock = (heartName, description, effects) => status({
    name: `Unlock: ${heartName}`,
    polarity: 'buff',
    description: `${description} Lasts for the rest of combat, and this Stance cannot be entered again this combat.`,
    effects,
});

module.exports = [
    token('Critical Token', 'Gained whenever you land a critical hit against a creature.', 'Heartstealer', '1 Critical Token'),
    token('Flair Token', 'Gained 1 for each Zone you enter through movement.', 'Waverider', '2 Flair Tokens'),
    token('Analyze Token', 'Gained whenever a party member performs an analysis check.', 'Philosopher', '2 Analyze Tokens'),
    token('Defender Token', 'Gained whenever you get hit and take damage.', 'Scalebearer', '2 Defender Tokens'),

    stance('Heartstealer', '1', 'Critical Token', 'Claw Arts: Venomous Slash',
        'successfully land two consecutive melee attacks against a creature.'),
    stance('Waverider', '2', 'Flair Tokens', 'Fleetfoot',
        'successfully perform the following sequence twice after entering this Stance: move into another Zone, then land a melee attack before the end of that turn.'),
    stance('Philosopher', '2', 'Analyze Tokens', 'Look Into the Evergreen',
        'after a creature is Analyzed, successfully perform an action that exploits information learned from that Analysis.'),
    stance('Scalebearer', '2', 'Defender Tokens', 'Unpoachable',
        'have an enemy miss an attack against you.'),

    unlock('Heartstealer', 'Gain +1 to hit.', [{ stat: 'base_hit_modifier', trigger: 'passive', mode: 'flat', delta: 1 }]),
    unlock('Waverider', 'Gain +1 melee Damage and +1 to all movement-related checks.', []),
    unlock('Philosopher', 'Once per turn, when you critically hit a creature, you may immediately perform a free Analysis check against that creature.', []),
    unlock('Scalebearer', 'Gain Hardness = ⌈Level / 2, rounded up⌉.', []),
];
