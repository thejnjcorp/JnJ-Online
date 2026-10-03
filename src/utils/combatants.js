// Who is in a fight, as the combat view shows them. A player (a `characters` doc) and an enemy
// (an object in the campaign's enemy_list) are stored differently; this turns either into the
// same shape - name, armor class, hit points, ability modifiers, action points, reaction,
// statuses - so one tile and one drawer can show anybody, and keeps the arithmetic of the
// quick edits (damage, healing, modifiers) out of the components.

import { getEffectiveCharacterStats, statusDeltaFor } from './statusEffects';
import { parseModifier } from './enemies';
import { chosenColor } from './entityColor';

export const ABILITIES = [
    { key: 'STR', stat: 'strength_stat', name: 'Strength' },
    { key: 'DEX', stat: 'dexterity_stat', name: 'Dexterity' },
    { key: 'INT', stat: 'intelligence_stat', name: 'Intelligence' },
    { key: 'CHR', stat: 'charisma_stat', name: 'Charisma' },
];

export const AC_STAT = 'base_armor_class';
export const PLAYER_MAX_AP = 4;
const DEFAULT_ENEMY_MAX_AP = 3;
// enemies of these tiers are fought as a group: one tile, a pip of hit points for each
export const MINION_TIERS = ['Goon', 'Regular'];

export const DURATIONS = [
    { key: 'turn', label: 'Until end of next turn' },
    { key: 'round', label: 'End of this round' },
    { key: 'scene', label: 'Rest of scene' },
    { key: 'removed', label: 'Until removed' },
];
export const durationLabel = key => DURATIONS.find(duration => duration.key === key)?.label || 'Until removed';

// +3, −2 (a real minus sign), +0
export function signed(value) {
    const number = Number(value) || 0;
    return number < 0 ? `−${Math.abs(number)}` : `+${number}`;
}

const numberOr = (value, fallback) => (Number.isFinite(Number(value)) && value !== null && value !== '' ? Number(value) : fallback);

function abilityEntries(raw, effective) {
    return ABILITIES.map(ability => {
        const base = numberOr(raw[ability.stat], 0);
        const value = numberOr(effective[ability.stat], base);
        return { ...ability, base, value, delta: value - base };
    });
}

// A player's character doc, as a combatant.
export function playerCombatant(character) {
    const effective = getEffectiveCharacterStats(character);
    const max = numberOr(character.maximum_health, 0);
    const now = numberOr(character.current_health, 0);
    return {
        id: `character:${character.character_id}`,
        key: character.character_id,
        kind: 'player',
        name: character.character_name || 'Unnamed',
        subtitle: [character.class_name, character.race_name].filter(Boolean).join(' · '),
        tier: '',
        portrait: character.combat_portrait_url || character.portrait_url || '',
        color: chosenColor(character.navigation_color),
        hp: { now, max, temp: numberOr(character.temporary_health, 0), tracked: true },
        ac: numberOr(effective[AC_STAT], 0),
        acBase: numberOr(character[AC_STAT], 0),
        abilities: abilityEntries(character, effective),
        ap: { now: numberOr(character.action_points, 0), max: PLAYER_MAX_AP, refresh: PLAYER_MAX_AP },
        reactionReady: !character.reaction_used,
        hero: numberOr(character.hero_points, 1),
        statuses: character.statuses || [],
        defeated: false,
        down: now <= 0 && max > 0,
        raw: character,
    };
}

// An enemy from the campaign's enemy_list, as a combatant.
export function enemyCombatant(enemy) {
    const effective = getEffectiveCharacterStats(enemy);
    const max = numberOr(enemy.maximum_health, 0);
    const now = numberOr(enemy.current_health, max);
    const apNow = numberOr(enemy.action_points, DEFAULT_ENEMY_MAX_AP);
    return {
        id: `npc:${enemy.id}`,
        key: enemy.id,
        kind: 'enemy',
        name: enemy.enemy_name || 'Enemy',
        subtitle: '',
        tier: enemy.enemy_type || '',
        portrait: '',
        color: chosenColor(enemy.color),
        hp: { now, max, temp: numberOr(enemy.temporary_health, 0), tracked: max > 0 },
        ac: numberOr(effective[AC_STAT], 0),
        acBase: numberOr(enemy[AC_STAT], 0),
        abilities: abilityEntries(enemy, effective),
        // four circles, like a player: an enemy with haste has the fourth, and gets back what it starts a turn with
        ap: { now: apNow, max: Math.max(PLAYER_MAX_AP, apNow), refresh: numberOr(enemy.max_action_points, DEFAULT_ENEMY_MAX_AP) },
        reactionReady: !enemy.reaction_used,
        hero: null,
        statuses: enemy.statuses || [],
        defeated: Boolean(enemy.defeated),
        down: Boolean(enemy.defeated) || (now <= 0 && max > 0),
        weaknesses: enemy.Weaknesses || [],
        resistances: enemy.Resistances || [],
        immunities: enemy.Immunities || [],
        raw: enemy,
    };
}

// What a screen reader hears for an ability button: the modified value, and the base when it differs
export function abilityLabel(ability) {
    const detail = ability.delta === 0 ? '' : ` (base ${signed(ability.base)})`;
    return `${ability.name} ${signed(ability.value)}${detail}, edit`;
}

// "Grinch Goober 3" is "Grinch Goober": the name without the number that tells copies apart
export function withoutCount(name) {
    const text = String(name ?? '');
    let end = text.length;
    while (end > 0 && text[end - 1] >= '0' && text[end - 1] <= '9') end--;
    if (end === text.length || end === 0 || text[end - 1].trim() !== '') return text;
    return text.slice(0, end).trimEnd();
}

// "Grinch Goober 3" and "Grinch Goober 1" are the same kind of enemy
export const enemyKind = enemy => enemy.templateId || withoutCount(enemy.enemy_name || '');

// The enemy tiles: each enemy on its own, except that three Goons of one kind (or two, or
// four) are one group tile - the fight shows "Grinch Goober x4", not four near-identical cards.
export function enemyTiles(enemies) {
    const combatants = enemies.map(enemyCombatant);
    const groups = new Map();
    combatants.forEach(member => {
        if (!MINION_TIERS.includes(member.tier)) return;
        const groupKey = `${member.tier}:${enemyKind(member.raw)}`;
        groups.set(groupKey, [...(groups.get(groupKey) || []), member]);
    });
    const tiles = [];
    const placed = new Set();
    combatants.forEach(member => {
        const groupKey = `${member.tier}:${enemyKind(member.raw)}`;
        const members = groups.get(groupKey);
        if (!members || members.length < 2) { tiles.push({ kind: 'single', key: member.id, member }); return; }
        if (placed.has(groupKey)) return;
        placed.add(groupKey);
        tiles.push({ kind: 'group', key: `group:${groupKey}`, base: members[0], members });
    });
    return tiles;
}

// The group's shared face: how many are still standing in its name, the first one's stats.
export function groupName(members) {
    const standing = members.filter(member => !member.down).length;
    const stem = withoutCount(members[0].raw.enemy_name || 'Enemy');
    return `${stem} ×${standing}`;
}

// ---- Hit points ----------------------------------------------------------

export const hpRatio = hp => (hp.max > 0 ? Math.max(0, Math.min(1, hp.now / hp.max)) : 0);

export function hpTone(hp) {
    const ratio = hpRatio(hp);
    if (ratio <= 0.25) return 'low';
    return ratio <= 0.6 ? 'hurt' : 'good';
}

// Hit points after damage, healing or temporary hit points. Damage takes temporary hit points
// first; healing stops at the maximum; temporary hit points don't add up, the larger stands.
export function applyHp(hp, amount, mode) {
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    if (mode === 'heal') return { ...hp, now: Math.min(hp.max, hp.now + value) };
    if (mode === 'temp') return { ...hp, temp: Math.max(hp.temp, value) };
    const absorbed = Math.min(hp.temp, value);
    return { ...hp, temp: hp.temp - absorbed, now: Math.max(0, hp.now - (value - absorbed)) };
}

export const DAMAGE_TYPES = ['Physical', 'Fire', 'Cold', 'Poison', 'Any'];

// What a weakness, resistance or immunity does to a hit of this type: a weakness adds its
// amount, a resistance takes its amount off (never below nothing), an immunity stops it.
// Returns the damage dealt and what was applied, if anything.
export function adjustDamage(combatant, type, amount) {
    const base = Math.max(0, Math.floor(Number(amount) || 0));
    const same = text => String(text || '').trim().toLowerCase() === String(type || '').trim().toLowerCase();
    if (!type || type === 'Any') return { amount: base, note: null };
    if ((combatant.immunities || []).some(same)) return { amount: 0, note: { kind: 'immunity', text: `Immune: ${type}` } };
    const weak = (combatant.weaknesses || []).map(parseModifier).find(entry => same(entry.type) && Number.isFinite(entry.amount));
    if (weak) return { amount: base + weak.amount, note: { kind: 'weakness', text: `Weakness: ${weak.type} ${weak.amount}` } };
    const resist = (combatant.resistances || []).map(parseModifier).find(entry => same(entry.type) && Number.isFinite(entry.amount));
    if (resist) return { amount: Math.max(0, base - resist.amount), note: { kind: 'resistance', text: `Resistance: ${resist.type} ${resist.amount}` } };
    return { amount: base, note: null };
}

// ---- Modifiers (as statuses) ---------------------------------------------

export const modifierId = stat => `mod:${stat}`;
export const modifierOf = (statuses, stat) => (statuses || []).find(status => status.id === modifierId(stat)) || null;

const STAT_NAMES = { [AC_STAT]: 'AC', ...Object.fromEntries(ABILITIES.map(ability => [ability.stat, ability.key])) };
export const statName = stat => STAT_NAMES[stat] || stat;

// The statuses with one stat's hand-set modifier replaced (a delta of 0 takes it away). It is an
// ordinary status with one passive effect on that stat, so everything that already adds up
// statuses (the character page, the combat math) counts it without knowing it is special.
export function withModifier(statuses, stat, { delta, duration = 'scene', reason = '' }) {
    const others = (statuses || []).filter(status => status.id !== modifierId(stat));
    const amount = Math.trunc(Number(delta) || 0);
    if (amount === 0) return others;
    const label = String(reason || '').trim();
    return [...others, {
        id: modifierId(stat),
        name: label ? `${label} ${signed(amount)}` : `${statName(stat)} ${signed(amount)}`,
        stacks: 1,
        polarity: amount > 0 ? 'buff' : 'debuff',
        color: '',
        description: '',
        effects: [{ stat, trigger: 'passive', mode: 'flat', delta: amount }],
        duration,
        modifier: true,
        reason: label,
        delta: amount,
    }];
}

// What the statuses (other than a hand-set modifier) are doing to a stat, one line each.
export function statusContributions(statuses, stat) {
    return (statuses || [])
        .filter(status => status.id !== modifierId(stat))
        .map(status => ({ name: status.name, delta: statusDeltaFor(status, stat) }))
        .filter(entry => entry.delta !== 0);
}

// Statuses that end with the scene, with a turn, or with a round (see DURATIONS).
export const withoutEnded = (statuses, ending) => (statuses || []).filter(status => !ending.includes(status.duration));

// A status chip's text: its name, with a stack count where it has one.
export function chipLabel(status) {
    if (status.modifier) return status.name;
    return status.stacks > 0 ? `${status.name} ${status.stacks}` : status.name;
}
