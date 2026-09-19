// The text of the JnJ Level 1 Encounter Balance Guide, arranged for the cheat sheet
// in the encounter builder (BalanceGuide.js). The numbers that the builder also
// checks against come from encounterGuide.js, so the two can't disagree.
//
// A section is a list of blocks: a table, a callout box, or plain text.

import { ENCOUNTER_TIERS, OBJECTIVE_LOADS, ROLE_BENCHMARKS, rangeText } from './encounterGuide';

const table = (title, columns, rows, extra = {}) => ({ type: 'table', title, columns, rows, ...extra });
const callout = (title, text, tone = 'note') => ({ type: 'callout', title, text, tone });
const text = (title, ...paragraphs) => ({ type: 'text', title, paragraphs });

const roleRows = Object.entries(ROLE_BENCHMARKS).map(([, role]) => [role.role.toUpperCase(), rangeText(role.hp), rangeText(role.ac), role.attack, role.abilities, role.damage]);

export const GUIDE_SECTIONS = [
    {
        key: 'stats',
        label: 'Enemy stats',
        blocks: [
            callout('Calibration', 'Designed as a starting benchmark for the current five-character Level 1 party. Treat these numbers as a bank to build from, then adjust for special abilities, action economy, positioning, reinforcements, and objectives.', 'warm'),
            table('1. Quick Enemy Benchmark Bank', ['Role', 'HP', 'AC', 'Attack', 'Suggested Ability Array', 'Typical 1A Damage'], roleRows, {
                intro: 'Choose a role first, then modify it rather than inventing every number from scratch. Higher AC should usually come with lower HP or weaker offense. Attack modifiers are listed separately from Ability Stats.',
            }),
            callout('JnJ Ability Stats', 'The Level 1 player baseline is approximately 4, 3, 2, 2 across Strength (STR), Dexterity (DEX), Intelligence (INT), and Charisma (CHA), with no proficiency bonus added. A standard Level 1 enemy should use about the same array. Enemy rank should usually increase HP, AC, attack modifiers, actions, and special abilities rather than inflating every Ability Stat. Assign the array in whatever order fits the creature. +5 represents exceptional specialization; +6 should be rare and defining; +7 or higher should be used very cautiously at Level 1. Attack modifiers remain separate from Ability Stats.'),
        ],
    },
    {
        key: 'damage',
        label: 'Damage & AC',
        blocks: [
            table('2. Damage Bank', ['Ability Type', 'Level 1 Starting Range', 'Design Note'], [
                ['Ordinary 1-Action single target', '3.5-6.5 average', 'Repeatable bread-and-butter attack.'],
                ['Strong 1-Action single target', '6-7 average', 'Use selectively; avoid stacking several on one enemy.'],
                ['2-Action single target', '7-10 average', 'Appropriate for signature attacks or stronger commitments.'],
                ['2-Action AoE', '4-7 average per target', 'Danger grows quickly with the number of targets hit.'],
                ['Once/combat or heavily telegraphed', '9-12 average', 'Save the biggest spikes for obvious, expensive moments.'],
            ]),
            callout('Damage Principle', 'At Level 1, most PCs only have about 10-16 HP. Repeated 12+ average damage attacks are usually not "hard" - they are simply binary. Make danger come from combinations, control, positioning, and multiple enemies rather than one roll deleting a character.', 'danger'),
            table('3. AC Bank', ['AC', 'Meaning', 'Use'], [
                ['13', 'Easy target', 'Fragile creature, exposed target, or intentionally easy-to-hit threat.'],
                ['14', 'Light enemy', 'Goons and mobile minor threats.'],
                ['15', 'Standard', 'Default defense for many Level 1 enemies.'],
                ['16', 'Tough', 'Veterans, elites, armored enemies.'],
                ['17', 'Boss-level defense', 'Use carefully; already suppresses crit frequency significantly.'],
                ['18+', 'Special / temporary', 'Prefer buffs, cover, phases, or short windows rather than permanent baseline AC.'],
            ]),
            callout('Durability Rule', "If you want an enemy to live longer, raise HP before pushing AC past the party's reliable hit range. High AC suppresses not only damage, but also class mechanics that require successful attacks or critical hits.", 'good'),
        ],
    },
    {
        key: 'budgets',
        label: 'HP & actions',
        blocks: [
            table('4. Effective HP (EHP) Bank', ['Encounter Tier', 'Total Enemy EHP', 'Expected Duration'], ENCOUNTER_TIERS.map(tier => [tier.label, rangeText(tier.ehp), tier.rounds]), {
                intro: 'Printed HP is not the whole durability budget. Resistance, interception, healing, resurrection, temporary HP, and defensive reactions all increase Effective HP.',
            }),
            callout('Wave Budgeting', 'For a 150 EHP set piece, do not place all 150 EHP on the field in Round 1. A healthier structure might be 80 EHP initially + 35 EHP reinforcement + 20 EHP summons + 15 EHP from shields/healing.'),
            table('5. Enemy Action Economy Bank', ['Encounter Tier', 'Meaningful Enemy Actions at Start'], ENCOUNTER_TIERS.map(tier => [tier.label, tier.actionsNote ? `${rangeText(tier.actions)}, ${tier.actionsNote}` : rangeText(tier.actions)]), {
                intro: 'The five PCs normally have 15 Actions per round. Enemy actions are often a stronger difficulty dial than HP.',
            }),
            callout('Meaningful Action', 'Count actions that attack, control, heal, summon, reposition, or advance an enemy objective. A 1-HP summon may barely affect the HP budget but can still add a recurring hostile action every round.', 'purple'),
            table(null, ['Enemy Role', 'Typical Actions'], [
                ['Boss / Captain', '3'],
                ['Elite / Veteran', '2-3'],
                ['Regular', '2'],
                ['Goon', '1-2, with only one meaningful offensive action'],
            ]),
            callout('Summon Warning', 'A summon ability should be priced by the recurring actions it creates, not only by the summoned creature\'s HP. Two 1-HP goons can still add two hostile actions every round until removed.', 'purple'),
        ],
    },
    {
        key: 'steps',
        label: 'Build steps',
        blocks: [
            table('6. The Encounter-Building Algorithm', ['Step', 'Decision', 'Example / Rule'], [
                ['1', 'Choose difficulty and target length', 'Example: Standard fight, 4-5 rounds.'],
                ['2', 'Choose an EHP budget', 'Example: 75-90 EHP for a standard Level 1 encounter.'],
                ['3', 'Choose an enemy action budget', 'Example: about 7 meaningful enemy actions on Round 1.'],
                ['4', 'Split the budget into enemy roles', 'Example: 1 Elite + 2 Regulars + 1-2 Goons.'],
                ['5', 'Add special mechanics and pay for them', 'Strong control, reactions, summons, resistances, healing, and AoE should cost HP, damage, or actions elsewhere.'],
                ['6', 'Add battlefield structure', 'Usually 3-4 Zones for normal fights; 4-5 for set pieces. Spread threats so movement matters without becoming a tax.'],
                ['7', 'Add the secondary objective', 'Estimate how many player Actions it will consume and reduce enemy pressure accordingly.'],
                ['8', 'Add pacing changes', 'Use reinforcements, phase changes, hazards, or a Round 3 twist instead of front-loading everything.'],
            ]),
            table('11. The "What Am I Paying For?" Rule', ['Enemy Strength', 'Possible Cost Elsewhere'], [
                ['High AC', 'Lower HP or weaker offense'],
                ['Huge damage', '2 Actions, recharge, telegraph, or lower accuracy'],
                ['Strong summons', 'Consumes most/all of boss turn; lower base action pressure'],
                ['Powerful Reaction', 'Reduce ordinary offense or durability'],
                ['Strong control', 'Reduce raw damage'],
                ['Large Resistance', 'Give a meaningful Weakness or reduce HP'],
                ['High healing / resurrection', 'Reduce base HP or offensive pressure'],
            ], {
                intro: 'Every powerful feature needs a cost. Do not stack high HP + high AC + high accuracy + high damage + AoE + summons + reactions + resistance for free. If a boss gains a major strength, pay for it somewhere else.',
            }),
            text('12. Quick Build Card'),
            callout('Normal Level 1 Fight', '1 durable enemy (30-45 HP) + 2 regular enemies (10-20 HP) + 0-2 goons. Use 3-4 Zones. Most 1-Action attacks average 4-7 damage. Add one modest objective or one reinforcement beat.', 'good'),
            callout('Major Level 1 Set Piece', '1 boss (45-70 HP) + 1 elite (25-40 HP) + 2-3 regular enemies + staggered weak goons. Use 4-5 Zones. Add a Round 2 reinforcement/event, a Round 3 twist, and a Round 4+ resolution mechanic.'),
            callout('Core Philosophy', 'Make the battlefield complicated, not the damage numbers enormous. Threaten the party through movement, Engagement, conditions, teamwork, reinforcements, objectives, and changing battlefield states.', 'warm'),
        ],
    },
    {
        key: 'objectives',
        label: 'Objectives',
        blocks: [
            table('7. Secondary Objective Action Tax', ['Objective Load', 'Expected Party Actions', 'Suggested Encounter Adjustment'], OBJECTIVE_LOADS.map(load => [load.label, load.partyActions, load.adjustment]), {
                intro: "A non-damage objective reduces the party's available combat actions. Budget for that tax intentionally.",
            }),
            callout('Preferred Adjustment', "When objectives are action-heavy, it is often cleaner to remove an enemy or delay reinforcements instead of shrinking every enemy's HP. Their individual identities stay intact.", 'danger'),
            table('8. Secondary Objective Toolkit', ['Objective', 'Player Activity', 'Combat Consequence'], [
                ['Stop a Ritual', 'Spend Actions/checks to build progress', 'Failure summons enemies or buffs the boss'],
                ['Rescue Civilians', 'Move, intercept, escort, defend', 'Forces the party to spread across Zones'],
                ['Hold Ground', 'Control one or more Zones', 'Creates positional conflict and Engagement decisions'],
                ['Seal Portals', 'Interact with several locations', 'Stops or weakens reinforcement waves'],
                ['Destroy Anchors', 'Analyze, disable, manipulate, or attack objects', 'Weakens boss mechanics'],
                ['Retrieve an Artifact', 'Reach it, take it, extract with it', 'Movement matters more than DPR'],
                ['Protect an NPC', 'Intercept, heal, reposition, defend', 'Changes enemy targeting priorities'],
                ['Interrupt Artillery', 'Reach a device/enemy before a countdown', 'Creates urgency and long-range pressure'],
                ['Identify the Real Enemy', 'Analysis/investigation during combat', 'Attacking blindly may waste actions or trigger consequences'],
                ['Escape / Evacuate', 'Advance through Zones while pursued', 'Killing everything becomes optional'],
            ], {
                intro: 'Good objectives create choices between fighting and accomplishing something else. They should change the battlefield or future enemy pressure.',
            }),
            text('9. Progress Track Framework'),
            callout('Simple Progress Rule', 'Give the objective a visible track such as 0/4 Progress. A successful appropriate 1-Action interaction gives +1 Progress; a critical success or especially clever solution can give +2. When the track fills, the objective resolves.', 'warm'),
            text(null, 'The same objective should support multiple approaches. Avoid writing an objective that only one specific class can solve.', 'Example - Soul Anchor: A character might Analyze its weakness, physically break it, manipulate the mechanism, use an appropriate element, apply religious/occult knowledge, or attempt another reasonable solution.'),
            table('10. Example: Cemetery Necromantic Anchors', ['Anchors Remaining at Round 3', 'Result'], [
                ['0', 'No Spirit reinforcements'],
                ['1', '1 Spirit arrives'],
                ['2', '2 Spirits arrive'],
                ['3', '2 Spirits arrive and Yunagi gains a temporary bonus'],
            ], {
                intro: 'Add three Necromantic Anchors in separate Zones. Each active Anchor empowers the ritual. Each Anchor requires 2 Progress to disable.',
            }),
            text(null, 'This creates a clean tactical arc: Round 1 reveals the ritual, Round 2 forces a split between defense and progress, Round 3 resolves the consequence, and Round 4+ can accelerate toward the wrap-up.'),
        ],
    },
];
