// What the director needs of an NPC's stat block while running a scene: the numbers they
// answer to, and the way to roll a check for them. The stat block is the bestiary's
// (see enemies.js); a beat only says which one it is.

import { ABILITIES, signed } from './combatants';
import { damageText } from './attackDamage';

// The bestiary entry a beat (or an NPC attached to one) is tied to, if it is still there.
export const statBlockOf = (enemies, enemyId) => (enemyId ? (enemies || []).find(enemy => enemy.id === enemyId) || null : null);

// The bestiary sorted by name, for choosing from.
export const byName = enemies => [...(enemies || [])].sort((a, b) => (a.enemy_name || '').localeCompare(b.enemy_name || ''));

// "12 AC · 10 HP · 3 AP" - what to say of a stat block in a list.
export const statBlockLine = enemy => `AC ${enemy.base_armor_class ?? 0} · ${enemy.maximum_health ?? 0} HP · ${enemy.action_points ?? 0} AP`;

// The numbers an attack, a defence and a turn are made of.
export function npcVitals(enemy) {
    const vitals = [
        { label: 'AC', value: String(enemy.base_armor_class ?? 0) },
        { label: 'HP', value: String(enemy.maximum_health ?? 0) },
        { label: 'AP', value: String(enemy.action_points ?? 0) },
        { label: 'To hit', value: signed(enemy.base_hit_modifier) },
        { label: 'Damage', value: damageText(enemy.base_damage_dice, enemy.base_damage_dice_type, Number(enemy.base_damage_modifier) || 0, '') || '—' },
    ];
    if (Number(enemy.hardness) > 0) vitals.push({ label: 'Hardness', value: String(enemy.hardness) });
    return vitals;
}

// The four abilities, each with what is added to a roll of that ability.
export const npcAbilities = enemy => ABILITIES.map(ability => ({ key: ability.key, name: ability.name, modifier: Number(enemy[ability.stat]) || 0 }));

// Weaknesses, resistances and immunities, those the enemy has any of.
export const npcDefenses = enemy => [['Weak to', enemy.Weaknesses], ['Resists', enemy.Resistances], ['Immune to', enemy.Immunities]]
    .filter(([, entries]) => entries?.length > 0)
    .map(([label, entries]) => ({ label, entries }));

// A d20 and what is added to it. `random` is for tests.
export function rollCheck(modifier, random = Math.random) {
    const roll = 1 + Math.floor(random() * 20);
    const added = Number(modifier) || 0;
    return { roll, modifier: added, total: roll + added };
}

export const checkText = result => `d20 ${result.roll} ${signed(result.modifier)} = ${result.total}`;
