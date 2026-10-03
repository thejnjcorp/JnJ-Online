import { CharacterDiceConverter } from '../components/CharacterStatCalculator';
import { namedTags } from './tags';

const KIND_LABEL = { melee: 'Melee', ranged: 'Ranged' };

// Whether an attack is melee or ranged: the Melee or Ranged tag on it. Null for an action that has
// neither (or, oddly, both), where there is no telling which damage it deals.
export function attackKind(action) {
    const labels = new Set(namedTags(action).map(tag => tag.tagInfo.trim().toLowerCase()));
    const melee = labels.has('melee');
    const ranged = labels.has('ranged');
    if (melee === ranged) return null;
    return melee ? 'melee' : 'ranged';
}

export const attackKindLabel = kind => KIND_LABEL[kind] || '';

// "1d6+3 Physical": a roll with its modifier (and, if it has one, what kind of damage).
export function damageText(dice, dieCode, modifier, type) {
    const die = CharacterDiceConverter(dieCode);
    if (!dice || die === 'N/A') return '';
    let mod = '';
    if (modifier > 0) mod = `+${modifier}`;
    else if (modifier < 0) mod = `-${Math.abs(modifier)}`;
    return [`${dice}${die}${mod}`, type].filter(Boolean).join(' ');
}

// The damage of a melee or ranged attack for this character: what their class gives for it, plus what
// their level and anything on them (a status that raises damage) adds to every attack. `stats` is the
// character's stat sheet for their level (CharacterStatCalculator) and `base` what it was worked out from -
// the sheet's own damage dice and modifier, as they stand with statuses applied - so the difference between
// the two is exactly what level and statuses add. Empty when the class gives no damage for that kind.
export function attackDamage(kind, character, stats, base) {
    const prefix = `base_${kind}_damage`;
    const dice = Number(character?.[`${prefix}_dice`]);
    const dieCode = Number(character?.[`${prefix}_dice_type`]);
    if (!dice || !dieCode) return '';
    const extraDice = (Number(stats.DamageDice) || 0) - (Number(base.dice) || 0);
    const rawModifier = Number(character.base_damage_modifier ?? base.modifier) || 0;
    const extraModifier = (Number(stats.DamageModifier) || 0) - rawModifier;
    return damageText(dice + extraDice, dieCode, (Number(character[`${prefix}_modifier`]) || 0) + extraModifier, character[`${prefix}_type`]);
}
