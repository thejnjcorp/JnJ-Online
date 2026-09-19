// Class content transcribed from the design write-ups (Monk v1.3, Gunslinger
// v1.2, Overqualified v1.3, The Seer v1.4, Magus v1.2). Loaded by
// firebase/scripts/publish-class-updates.js.
//
// Each entry's `content` holds only the fields the write-up states, so anything
// else already on the class (class_type, healing dice, visibility, admins...)
// is left alone when it's updated. `create` (Magus only) supplies the rest for
// a class that doesn't exist yet.

const DICE = { d4: 1, d6: 2, d8: 3, d10: 4, d12: 5, d20: 6 };

function action({ name, category, cost = 0, range = '', dc = 'Dex', toHit, per, count, trigger, requirement, description, outcomeTable }) {
    const result = {
        actionName: name,
        category,
        actionCost: cost,
        range,
        actionLevel: 1,
        actionType: per || 'standard',
        description: description.trim(),
    };
    if (toHit !== undefined) {
        result.toHitBool = true;
        result.toHit = toHit;
    } else {
        result.toHitBool = false;
        result.difficultyClass = `${dc},0`;
    }
    if (per) result.actionTypeCount = count;
    if (trigger) result.trigger = trigger;
    if (requirement) result.requirement = requirement;
    if (outcomeTable) result.outcomeTable = outcomeTable;
    return result;
}

const monk = {
    class_name: 'Monk',
    versionNotes: 'Design v1.3: two Stance Trials can be active at once, Waverider reworked, Unbroken Momentum split out with an easier crit threshold, Perfect Slash renamed Venomous Slash, Fleetfoot gains an out-of-combat use.',
    content: {
        class_name: 'Monk',
        base_armor_class: 16,
        base_health_dice: DICE.d10,
        base_hit_modifier: 7,
        base_class_damage_class: 14,
        base_melee_damage_dice: 1,
        base_melee_damage_dice_type: DICE.d4,
        base_melee_damage_modifier: 1,
        base_melee_damage_type: 'Physical',
        base_ranged_damage_dice: 1,
        base_ranged_damage_dice_type: DICE.d4,
        base_ranged_damage_modifier: 1,
        base_ranged_damage_type: 'Physical',
        description: 'Made By Jonah for Andrew. Used in Clocks Of Loren.',
        class_weapons: 'Claws, Pocket Sand, Venom, Random objects lying around',
        actions: [
            action({
                name: 'A Sergio in the Cards', category: 'feat',
                description: `
*"Sergio is malleable."*

*Playing to one's strength is important, both to fighters and oracles. Thus, being able to think fast and adapt to any situation is crucial in high tide and high stakes scenarios.*

Grants the feat [Adaptability]`,
            }),
            action({
                name: 'Ignatious Shift', category: 'passive',
                description: `
**Threaded** (On Trial Completion)

*An old sparring partner once told him that you must light the fire inside to find the fighting style that fits him the most. No clue what he meant, but it inspired a multitude of new styles.*

Whenever you fulfill a Stance's listed condition, gain its corresponding Token.

You may have up to two active Stance Trials at a time. When you have enough Tokens, you may freely consume them to enter a Stance and begin its Trial. If you would enter a Stance while already having two active Trials, choose one unfinished Trial to abandon.

When you complete a Stance's Trial, you immediately gain its Unlock for the rest of combat. Once gained, an Unlock remains active even after you leave that Stance. Once you complete a Stance's Trial and gain its Unlock, that Stance cannot be entered again for the remainder of combat.

Completing a Trial ends that Stance, allowing you to begin another Stance Trial.

Unspent Tokens remain when entering or completing another Stance. All Tokens are lost at the end of combat.

**Stance — Heartstealer:**

Critical Token: Whenever you land a critical hit against a creature.

Trigger: Consume 1 Critical Tokens. Immediately regain one charge of **Claw Arts: Venomous Slash**. (Once per combat)

Trial: Successfully land two consecutive melee attacks against a creature.

Unlock — **Heartstealer**: Gain +1 to hit for the rest of combat.

**Stance — Waverider:**

Flair Token: Gain 1 Flair Token for each Zone you enter through movement.

Trigger: Consume 2 Flair Tokens. Immediately regain one charge of **Fleetfoot**. (Once per combat)

Trial: Successfully perform the following sequence **twice** after entering this Stance: Move into another Zone, then land a melee attack before the end of that turn.

Unlock — **Waverider**: Gain +1 melee Damage and +1 to all movement-related checks for the rest of combat.

**Stance — Philosopher:**

Analyze Token: Whenever a party member performs an analysis check.

Trigger: Consume 2 Analyze Tokens. Immediately regain one charge of **Look Into the Evergreen**. (Once per combat)

Trial: After a creature is Analyzed, successfully perform an action that exploits information learned from that Analysis.

Unlock — **Philosopher**: Once per turn, when you critically hit a creature, you may immediately perform a free Analysis check against that creature.

**Stance — Scalebearer:**

Defender Token: Whenever you get hit and take damage.

Trigger: Consume 2 Defender Tokens. Immediately regain one charge of **Unpoachable**. (Once per combat)

Trial: Have an enemy miss an attack against you.

Unlock — **Scalebearer**: Gain Hardness = ⌈Level / 2, rounded up⌉ for the rest of combat.`,
            }),
            action({
                name: 'Unbroken Momentum', category: 'passive',
                description: `
Once per turn, after you deliberately move into another Zone, your next melee attack before the end of your turn critically succeeds if the result is 8 or more above the target's AC instead of 10 or more.

Whenever you critically succeed on a melee attack:

- That attack does not increase your Multiple Attack Penalty (MAP).
- You may immediately move up to 1 Zone for free.
- This movement automatically disengages you from the target.`,
            }),
            action({
                name: 'Locally Sourced', category: 'action', cost: 1, dc: 'Str', per: 'perDay', count: 2,
                description: `
*With enough willpower and loss of tastebuds, anything can be eaten as a delicacy…even if it's dead and rotting.*

Cook a lovely meal from locally sourced herbs and spices, drizzled with homemade sauce over something you found. It's delicious.

Force feed an enemy some of your scrumptious food. The target makes a Strength Save against your Class DC to see if they can handle it.`,
                outcomeTable: {
                    criticalSuccess: 'They like it?? The target becomes immune to Sickened from Locally Sourced for the rest of combat.',
                    success: 'They stomach it. Nothing happens.',
                    failure: 'The target gains Sickened 1.',
                    criticalFailure: 'The target gains Sickened 2.',
                },
            }),
            action({
                name: 'Claw Arts: Venomous Slash', category: 'action', cost: 1, per: 'perDay', count: 1,
                description: `
*With years of perfecting your fighting style, you master your claw attacks, imbuing it with poison without poisoning yourself.*

Until the end of your next turn, all of your melee attacks deal 1 additional Poison Damage. This additional damage is included when calculating critical damage.`,
            }),
            action({
                name: 'Fleetfoot', category: 'action', cost: 1, per: 'perDay', count: 1,
                description: `
*Fast of mind, body and spirit, or at least one of those things.*

You focus your mind and move quickly on your feet. Spend 1 action to move up to 2 Zones away. You move twice as fast or pass hard-to-traverse terrain with no trouble. This still triggers Reactions.

**Outside Combat:** When you use Fleetfoot to overcome a physical obstacle through speed, balance, climbing, jumping, or similar movement, make any required movement-related Check normally. Treat the result as one degree of success higher.`,
            }),
            action({
                name: 'Look Into the Evergreen', category: 'action', cost: 1, dc: 'Int', per: 'perDay', count: 1,
                description: `
*With the eye of a fighter, you're trained in noticing the finer details in hidden or unfair tactics.*

You notice the surroundings, posture, and equipment your enemies have. From this, you interpret how best to approach or defend against the scenario.

Instead of making a generic Analysis check, you make a stronger class-specific ability called **Look Into the Evergreen**. After successfully Analyzing an opponent, identify one elemental damage type they are capable of dealing. You gain the **Quick Thinking** Reaction against that opponent.`,
            }),
            action({
                name: 'Quick Thinking', category: 'reaction',
                trigger: 'The identified opponent uses an attack or ability that deals elemental damage.',
                requirement: 'You have used Look Into the Evergreen on the triggering opponent.',
                description: 'Grant yourself and all party members within your Zone Resistance equal to your Level + 1 against the identified element. This Resistance applies to the triggering attack and lasts until the end of your next turn.',
            }),
            action({
                name: 'Unpoachable', category: 'reaction', per: 'perDay', count: 1,
                trigger: 'A Physical ranged attack targeting you, or passing through your Zone.',
                requirement: 'You are not Engaged.',
                description: `
*Even the best hunters can't lay a finger on these tough scales of mine.*

You are naturally hydrodynamic from your gleaming scales. With these hardened scales, you attempt to masterfully swat a ranged attack out of the air.

Make a Dexterity Check against the attacker's DC.`,
                outcomeTable: {
                    criticalSuccess: 'Catch the projectile and immediately throw it back at the attacker, dealing your Ranged Damage.',
                    success: 'Swat the projectile out of the air. The triggering attack deals no damage.',
                    failure: 'The triggering attack resolves normally.',
                    criticalFailure: "You intercept the attack and take its damage instead, even if you weren't its original target.",
                },
            }),
        ],
    },
};

const gunslinger = {
    class_name: 'Gunslinger',
    versionNotes: 'Design v1.2: Blazing Tundra range is now 1 Zone, Reload wording clarified.',
    content: {
        class_name: 'Gunslinger',
        base_armor_class: 15,
        base_health_dice: DICE.d8,
        base_hit_modifier: 9,
        base_class_damage_class: 14,
        base_melee_damage_dice: 1,
        base_melee_damage_dice_type: DICE.d6,
        base_melee_damage_modifier: 1,
        base_melee_damage_type: 'Physical',
        base_ranged_damage_dice: 1,
        base_ranged_damage_dice_type: DICE.d4,
        base_ranged_damage_modifier: 1,
        base_ranged_damage_type: 'Physical',
        description: 'Made By Jonah for Will. Used in Clocks Of Loren.\n\nRanged Damage Die: D4+1, Fatal D6 - on a critical hit, the damage die becomes a D6 instead of doubling the D4 (AVG 3.5 | Crit AVG 12.5).',
        class_weapons: 'Blazing Tundra, Pocket Knife, Lasso',
        actions: [
            action({
                name: 'Dead Eye', category: 'feat',
                description: `
*A high end scavenger must always keep an eye out for potential threats, as well as people in need. From the beginning, you've always been known for seeing things differently than most.*

Grants the Feat: [Perceptive]`,
            }),
            action({
                name: 'Blazing Tundra (Gun Mode)', category: 'action', cost: 1, range: '1 Zone', toHit: 0,
                description: `
*An interesting find. A revolver that seems to be able to switch between two different states: one, a normal gun; the other, a steam powered hand cannon. Something you've never heard of before, simply lying around in a random pawn shop, practically begging to be "bought."*

Holds four shots. The cylinder seems to be able to expand and warp around different bullets, almost as if the gun itself can sense my intentions.

Whenever you score a critical hit with Blazing Tundra while in **Gun Mode**, it transforms into **Cannon Mode** after the attack resolves. Blazing Tundra remains in Cannon Mode until Cannon Mode is fired or another ability causes it to revert.

Whenever Blazing Tundra is fired, it consumes the round in its current chamber unless an ability specifically states otherwise.`,
            }),
            action({
                name: 'Cannon Mode', category: 'action', cost: 2, range: '1 Zone', toHit: -1,
                requirement: 'Blazing Tundra is in Cannon Mode.',
                description: `
*A blast of powder and highly pressurized steam, powerful enough to blow a hole through just about anything.*

**Heavy:** Attacks with this weapon take a –1 penalty to hit.

Deals D8+3 Physical Damage (AVG 7.5 | Crit AVG 15).

When used in Engagement Range, the target receives a –1 AC penalty for the rest of combat on a hit (Does not stack).

Regardless of whether the attack hits, the target must also make a Strength Save against your Class DC. On a failure, the target is knocked Prone (Unengaged). On a critical failure, the target is knocked Prone and pushed 1 Zone away.

After firing, Blazing Tundra reverts to **Gun Mode**.`,
            }),
            action({
                name: 'Lasso', category: 'action', cost: 1, range: '1 Zone', dc: 'Str',
                description: `
*Some rope has always been found handy.*

Lasso a target within range and make a contested Strength Check against them.

On a Critical Success, the lasso wraps around the target's torso. While Tethered this way, the target cannot willingly move farther away from you. At the start of each of your turns, you must spend 1 Action to maintain the Lasso or immediately release the target.

A Tethered target may spend 1 Action to attempt a Strength or Dexterity Save against your Class DC. On a success, they escape the Lasso.`,
                outcomeTable: {
                    criticalSuccess: 'Drag the target into your Engagement Range; Tethered.',
                    success: 'Drag the target into your Engagement Range.',
                    failure: 'Nothing.',
                    criticalFailure: "Get dragged into the target's Engagement Range (Causes Zipper).",
                },
            }),
            action({
                name: 'One In the Chamber', category: 'action', cost: 1,
                description: `
*Be prepared to adapt to any situation you may face. Every morning, you make sure you're prepared by modifying a few bullets to give them a little extra spark.*

Load one of your prepared specialty rounds into Blazing Tundra. If the cylinder has an empty chamber, the specialty round fills an empty chamber, increasing the gun's current ammunition by 1, up to its maximum of 4 rounds. If the cylinder is already full, replace the next loaded round with the specialty round instead. The specialty round is loaded into the next chamber to be fired.

Choose from: **Hot Shot**, **Frost Bite**, **Steaming Barrel**, or (Cannon Mode only) **Chain Shot**.`,
            }),
            action({
                name: 'Hot Shot', category: 'action', cost: 1, toHit: 0, per: 'perDay', count: 1,
                requirement: 'Loaded via One In the Chamber.',
                description: '**Hot Shot** burns extremely brightly and may be fired as a flare, providing bright light and acting as a visible signal. When fired directly at a target, the damage type changes to Fire Damage. On a hit, the target then takes 1d4 + 1 Burning Damage (Persistent Damage).',
            }),
            action({
                name: 'Frost Bite', category: 'action', cost: 1, toHit: 0, per: 'perDay', count: 1,
                requirement: 'Loaded via One In the Chamber.',
                description: '**Frost Bite** is an extremely cold bullet, kept within the liquid cooling system of the gun itself. When fired directly at a target, the damage type changes to Cold Damage. On a hit, the target then takes 1d4 + 1 Freezing Damage (Persistent Damage). While suffering this Freezing Damage, the target takes a –1 penalty to movement-related checks.',
            }),
            action({
                name: 'Steaming Barrel', category: 'reaction', cost: 1, per: 'perDay', count: 1,
                trigger: 'A creature within range makes an attack roll.',
                requirement: 'Steaming Barrel is the currently loaded round in Blazing Tundra.',
                description: `
*All that excess high pressure steam has to go somewhere. Blast it out of the barrel toward an area.*

While Steaming Barrel is the currently loaded round, it may be fired in one of the following ways:

**Steam Cloud:** Fire the round normally to fill one Zone with thick steam. Until the start of your next turn, all creatures within that Zone are **Concealed**.

**Steam Blast (Reaction):** Fire Steaming Barrel as a Reaction, blasting steam directly into the triggering creature's face. The target must make a Dexterity Save against your Class DC. On a failure, they become **Dazzled** until the end of their turn.

Either use fires and consumes the Steaming Barrel round.`,
            }),
            action({
                name: 'Chain Shot', category: 'action', cost: 1, range: '2 Zones', per: 'perDay', count: 1,
                requirement: 'Blazing Tundra is in Cannon Mode; Chain Shot is loaded.',
                description: `
*Somehow, sticking a large nail into your lasso and feeding it into the cylinder makes for a surprisingly decent grappling hook. The nail is far lighter than your usual ammunition, letting the cannon launch it much farther than a normal shot. Just fire it wherever you want the anchor to be.*

Fire the modified lasso at a solid surface within 2 Zones, anchoring the nail into it. You can use the attached lasso to climb, swing, or pull yourself toward the anchor. Using Chain Shot consumes the Chain Shot round but does not cause Blazing Tundra to leave Cannon Mode.`,
            }),
            action({
                name: 'Reload: Threaded', category: 'action', cost: 3,
                description: `
*Pop the cylinder open and reload. Simple as that. But why waste a perfectly good opportunity to reflect?*

Reload all bullets into the gun, then pick an option to focus on while reloading:

**Overload:** Force the gun to enter Cannon Mode for free. If already in Cannon Mode, overpressurize it instead: the next target forced to make a Strength Save by Cannon Mode treats its result as one degree of success worse.

**Bounty:** Select a target and perform an Analysis check on them. Instantly craft a specialized bullet based on any known weaknesses or information gathered from the Analysis, within reason. The bullet is placed first in the chamber and gains +1 to hit against that target.

**Inspire:** Belt out a few encouraging words to your allies, but not yourself. All allies within your Zone gain +1 to hit on their next attack. An ally who lands that attack gains +1 Damage on the same attack.`,
            }),
        ],
    },
};

const overqualified = {
    class_name: 'Overqualified',
    versionNotes: 'Design v1.3: Exposed/Marked now key off your Weapon, Cover Up requirement reworded, Noisemaker deals Sonic damage, Absolute Deduction SOLVED options written out in full.',
    content: {
        class_name: 'Overqualified',
        base_armor_class: 15,
        base_health_dice: DICE.d8,
        base_hit_modifier: 5,
        base_class_damage_class: 14,
        base_melee_damage_dice: 1,
        base_melee_damage_dice_type: DICE.d6,
        base_melee_damage_modifier: 1,
        base_melee_damage_type: 'Physical',
        base_ranged_damage_dice: 1,
        base_ranged_damage_dice_type: DICE.d6,
        base_ranged_damage_modifier: 1,
        base_ranged_damage_type: 'Physical',
        description: 'Made By Jonah for Adam. Used in Clocks Of Loren.',
        class_weapons: 'Bow',
        actions: [
            action({
                name: 'Treasure Seeker', category: 'feat',
                description: `
*Since the age of 20, you have immersed yourself in the study of archaeology under your father's guidance. Along the way, you developed a passion for uncovering forgotten treasures and piecing together fragments of the past.*

Grants the Feat: [Archaeologist]`,
            }),
            action({
                name: 'Expose a Weakness', category: 'passive', dc: 'Int',
                description: `
*By carefully observing the smallest details—body language, physical evidence, structural flaws, and patterns others might overlook—you can identify weaknesses and determine how best to exploit them.*

Instead of making a generic Analysis check, you make a stronger, class-specific version called **Expose a Weakness**.

On a success, the target gains **Exposed 1**, or increases its existing **Exposed X** by 1. The value of all current weaknesses the target possesses increases by its **Exposed** value.

You can also use Expose a Weakness to identify vulnerabilities in objects, structures, buildings, and other subjects you can reasonably analyze.`,
            }),
            action({
                name: 'Exploit a Weakness', category: 'passive',
                description: `
*It doesn't matter if there's a chip in their sword or a dent in their plate; it's all about how you exploit it.*

When you successfully hit an **Exposed** target with your **Weapon**, apply **Marked 1**, or increase its existing **Marked X** value by 1.

The next ally to successfully attack that target consumes 1 **Marked** and adds 1D4 Physical Damage before critical modifiers. Each ally can consume **Marked** only once per combat round. When **Marked** reaches 0, the status ends.

Only successful attacks with your **Weapon** apply **Marked** unless specifically stated otherwise.`,
            }),
            action({
                name: 'Active Investigation', category: 'action', range: 'At least 1 Minute', dc: 'Int',
                description: `
*Every detail tells a story. You just need to know which ones are worth listening to.*

Spend at least 1 minute examining evidence and choose the subject connected to it as your **Active Investigation**. You do not need to know the subject's identity or nature—only enough evidence to establish that it exists.

*A footprint could lead to whoever left it, an unusual wound to whatever caused it, or an artifact fragment to the object it came from.*

While investigating, successful Analysis Checks involving the subject may apply or increase **Exposed**, even while the subject is absent.

Evidence that confirms one of your deductions counts as **Marked** being consumed for **Absolute Deduction** (ability described further down). The GM determines what evidence is relevant and significant enough to increase **Exposed**.`,
            }),
            action({
                name: 'Cause of Death: Pending (Optional)', category: 'action', cost: 1, range: '1 Zone', per: 'perDay', count: 3,
                description: `
*"I'd prefer not to determine your cause of death today."*

Quickly assess the target's injuries and determine which wound poses the greatest immediate threat. Using your knowledge of anatomy, trauma, and forensic science, you select the appropriate treatment from your medical supplies and administer it to the target. This treatment can, of course, be administered to a patient up to **1 Zone** away *(through proper technique, obviously, and not magic).*

The target regains **1D8 + 2 HP (AVG 6.5)**.`,
            }),
            action({
                name: 'Verify a Lead', category: 'action', cost: 1, dc: 'Int',
                requirement: 'An ally has shared information they gained from an Analysis Check (or any enhanced Analysis Check) about a subject you can reasonably analyze.',
                description: `
*Trust, but verify*

Use the information provided by your ally as the basis for an **Expose a Weakness** check. Before the GM makes the check, choose whether you **Trust** or **Deny** the Lead.

**Trust:** You believe the information is accurate.

**Deny:** You believe the information is inaccurate or misleading.

The GM secretly determines whether your judgment is correct. If you correctly **Trust** accurate information or **Deny** inaccurate information, you gain a hidden **+2 bonus** to the **Expose a Weakness** check. The GM does not reveal whether this bonus was applied.

If the subject already has an **Exposed** value equal to or greater than the value **Verify a Lead** would grant, its Exposed value does not decrease.

Each Lead can only be used for **Verify a Lead** once. New information about the same subject may be treated as a new Lead at the GM's discretion.`,
                outcomeTable: {
                    criticalSuccess: 'The subject becomes Exposed 2, regardless of whether your judgment was correct. You discover particularly useful information about the subject.',
                    success: 'You discover useful information. If your judgment was correct, the subject becomes Exposed 2. Otherwise, they become Exposed 1.',
                    failure: "You fail to discover any new useful information. The subject's Exposed value does not increase.",
                    criticalFailure: 'The subject becomes Exposed 1 and you reach an incorrect or misleading conclusion that appears credible.',
                },
            }),
            action({
                name: 'Cover Up', category: 'reaction', cost: 1, range: '1 Zone', per: 'perDay', count: 2,
                requirement: 'An Ally is about to take damage.',
                description: `
*The moment a target commits to a strike is the very moment they are at their most vulnerable.*

Apply your knowledge of combat to protect your allies. After an ally is confirmed to take damage, but before the damage roll is revealed, roll 1D6 + 1 (AVG 4.5) and grant them that much temporary Hardness against the damage.

If the source of the damage is already **Exposed**, the ally gains an additional **+2 Hardness** (AVG 6.5).`,
            }),
            action({
                name: 'Absolute Deduction: Threaded', category: 'action', cost: 1, dc: 'Int', per: 'perDay', count: 1,
                requirement: 'The subject is Exposed 2+, and your understanding of it has been confirmed (in combat: at least one Marked charge you applied to the target has been consumed by an ally; during an Active Investigation: discovering evidence that confirms a theory/deduction about the subject).',
                description: `
*After acquiring the pieces to the puzzle, it's only a matter of perspective left.*

You have gathered enough information to reach a definitive conclusion about your subject. The target's **Exposed X** status becomes **SOLVED X+1**.

*For example, **Exposed 2** becomes **SOLVED 3**.*

**SOLVED** functions as **Exposed** for the purposes of your abilities and continues to increase the target's existing weaknesses by its value.

How **SOLVED** functions depends on whether **Absolute Deduction** is being used during an investigation or in combat.

When you **SOLVED** a creature in combat, choose **Offense**, **Defense**, or **Behavior**.

**SOLVED — Investigation:**

*The pieces finally fit together.*

When you **SOLVE** the subject of an Active Investigation, you may ask the GM one specific question about the subject.

If the answer can reasonably be determined from the evidence and information available to you, the GM reveals the most accurate conclusion you are capable of reaching.

**Absolute Deduction** does not grant supernatural knowledge. It allows you to connect information you already possess, notice relationships between pieces of evidence, and reach conclusions that may otherwise have been overlooked.

If the available evidence cannot completely answer your question, the GM instead provides the strongest conclusion that can reasonably be drawn from what you have discovered.

**SOLVED — Offense:**

*I know exactly what you're going to do.*

You have deciphered the target's offensive patterns and can anticipate how they fight.

- The target takes a –2 penalty to all attack rolls made against you or your allies for the rest of combat.
- You regain 1 expended use of **Cover Up**.
- **Cover Up** grants an additional **+1 Hardness** against damage caused by the SOLVED target.

**SOLVED — Defense:**

*There. That's the opening.*

You have identified the flaws in the target's defenses and know exactly where your allies should strike.

- The target takes a –2 penalty to all Save Checks made against effects caused by you or your allies for the rest of combat.
- When **Marked** is consumed against the **SOLVED** target, its additional damage increases from 1D4 to 1D6.

**SOLVED — Behavior:**

*How predictable.*

You have learned the target's habits well enough to anticipate their next move.

At the start of the target's turn, before they take any Actions, predict what they intend to do with their first Action.

If your prediction is correct, you or one ally of your choice may immediately take 1 free Action/Reaction before the predicted action resolves. These Actions must be used in direct response to the predicted action.

*If the target's first Action is part of a 2- or 3-Action activity, correctly predicting the entire activity counts as a successful prediction.*

This free Actions/Reactions must reasonably interfere with, defend against, capitalize on, or otherwise directly respond to the predicted action. They cannot be used for unrelated actions.`,
            }),
            action({
                name: 'Excavating Tools', category: 'action', cost: 1,
                description: `
*Throughout your time as an archaeologist, you have learned the importance of keeping a trusty set of tools close at hand. You never know when the right piece of equipment might save the day.*

Choose from **Noisemaker**, **Dynamite**, or **Tripwire**.`,
            }),
            action({
                name: 'Noisemaker', category: 'action', cost: 1, range: 'Close', toHit: 0, per: 'perDay', count: 1,
                description: `
A very loud mechanism that snaps open after a short delay, alerting everyone nearby to its location.

It deals 1D6 + 1 Sonic Damage to a Close target and reveals them to everyone within a 3 Zone radius, causing them to lose their **Hidden** status, if applicable. The target gains **Exposed 1**, or increases its existing **Exposed X** by 1.

It also makes for an excellent wake-up alarm or improvised security system.`,
            }),
            action({
                name: 'Dynamite', category: 'action', cost: 1, range: '1-2 Zones', toHit: 0, per: 'perDay', count: 1,
                description: `
*You know what this is.*

Makes a great light source for a few seconds. It is quite loud, so it also works as an excellent signal. Great for picking locks, removing walls, fixing wobbly tables, creating momentum, and making a persuasive argument.

You can either throw the stick whole (1 Zone Range) or attach it to the end of an arrow (2 Zones Range).

On a direct hit, the dynamite deals 2D6 + 1 Fire Damage (AVG 8) to the target and 1D4 Physical AOE Damage (AVG 2.5) to everything else in the Zone.

On a missed direct attack, Dynamite still detonates in the target's Zone but does not deal its direct-hit damage. Other creatures in the Zone still take the AoE damage.

**Kaboom!**`,
            }),
            action({
                name: 'Tripwire', category: 'action', cost: 1, dc: 'Int', per: 'perDay', count: 2,
                description: `
*After spending years watching out for these damn things, it's about time someone else experienced the annoyance.*

By itself, Tripwire can be used to trip up unsuspecting targets. It can be placed within your Zone to catch creatures entering it, or set up near you to trigger when a creature enters your Engagement Range.

The triggering creature must make an Intelligence Check against your Class DC to notice the Tripwire before it is too late.

On a failure, they fall Prone, destroying the Tripwire in the process.

On a success, they notice and destroy the Tripwire before it can trip them.

Tripwire can also be set up in tandem with Dynamite or a Noisemaker to create an independent trap without costing an additional Action. If the triggering creature fails the check, they fall Prone and immediately trigger the attached tool.`,
            }),
        ],
    },
};

const FORTUNES = `
**The Fool:** Flip a coin. On Heads, the recipient gains Haste until the end of their next turn. On Tails, they gain Slowed 1 until the end of their next turn.

**The Magician:** The recipient manifests a d12 of any damage type of their choosing and adds it to their next attack.

**The High Priestess:** The recipient learns or realizes something important, such as an enemy's weakness, background, or other useful information.

**The Empress:** The recipient and each of their allies in their Zone regain HP equal to their HP Die's maximum value × one-third their level, rounded up.

**Healing = HP Die Maximum × ⌈Level ÷ 3⌉**

*Example: A Level 5 character with a d10 HP Die regains 20 HP (10 × 2). A Level 5 character with a d6 HP Die regains 12 HP (6 × 2).*

The recipient then taunts all enemies in their Zone, compelling each affected enemy to target the recipient with their next attack, provided the recipient is a valid target.

**The Emperor:** The recipient gains +1 AC until the end of combat, then taunts all enemies in their Zone, compelling each affected enemy to target the recipient with their next attack, provided the recipient is a valid target.

**The Hierophant:** Redraw. You never drew it in the first place.

**The Lovers:** The recipient gains a single-use free Reaction. Whenever one of the recipient's allies fails an attack roll, check, or save, the recipient may use this Reaction to grant them a +2 bonus to the roll.

**The Chariot:** The recipient must move to an adjacent Zone. This movement does not trigger Reactions.

**Strength:** The recipient gains Temp HP equal to their HP Die's maximum value × one-third their level, rounded up. The recipient also gains +1 Strength and Bravery 1 until the end of combat.

**Temp HP = HP Die Maximum × ⌈Level ÷ 3⌉**

**The Hermit:** The recipient chooses to gain 1–3 stacks of Self-Reflection, becoming Stunned for an equal number of Actions. Once all Actions lost to Self-Reflection have been resolved, the recipient gains the corresponding benefit based on the number of stacks chosen:

- 1 Stack: +1 Damage
- 2 Stacks: +1 Damage, +1 AC
- 3 Stacks: +1 Damage, +1 AC, +1 to hit

Regardless of the number of stacks chosen, the recipient may also immediately perform one free Analysis Check.

These bonuses last until the end of combat.

**Wheel of Fortune:** The recipient gains one reroll that they may use on any of their die rolls at any point before the end of combat.

**Justice:** The recipient takes a look within and questions whether their actions still reflect the values they have carried with them. The recipient makes a Strength Check against their Justice DC. The Justice DC begins at their normal Class DC but may increase or decrease depending on how closely the recipient's actions and beliefs have remained aligned with their established values over the course of their journey. Significant changes, contradictions, or abandonment of those values make the check more difficult, regardless of whether that change was for better or worse.

**Failure:** Halve the recipient's current HP, rounded up.

**Success:** The recipient regains HP equal to half their missing HP, rounded up.

*"Are you still the person you claimed to be?"*

**The Hanged Man:** The recipient takes a –2 penalty to AC for the rest of combat and cannot willingly move until the end of their next turn. While suspended in this state, they gain a new perspective and immediately gain 1 Hero Point.

**Death:** The recipient must let go of something dear to them, and the recipient chooses one currently functional, non-optional Class Mechanic, and has it disabled until the end of combat. An expended or already disabled mechanic cannot be chosen.

**Temperance:** The recipient loses all status effects currently affecting them, both positive and negative.

**The Devil:** The recipient immediately has one of their fears triggered and gains Fear 3.

**The Tower:** Redraw. You never drew it in the first place. Chase with The Star.

**The Star:** Redraw. You never drew it in the first place.

**The Moon:** The recipient is considered Blind and Deaf beyond Zone 0. They also gain +3 Intelligence until the end of combat.

**The Sun:** The recipient is cleansed of all negative effects and becomes immune to negative effects until the end of their turn. This includes Acquired Dice Modifiers.

**Judgement:** [If the recipient is currently dying, immediately resurrect them with 1 HP.] The recipient awakens to their true potential. They immediately regain one expended use of a limited-use ability and gain +1 to all Ability Scores until the end of combat.

**The World:** Draw and immediately resolve 3 additional Fortunes on the recipient. Do not reshuffle between these draws. Set The World aside; it cannot be drawn again for the rest of combat. After all three additional Fortunes have resolved, reshuffle the Deck of Un as normal.

*"You have grabbed the world. Do not let go."*`;

const seer = {
    class_name: 'The Seer',
    versionNotes: "Design v1.4: full Fortune list written out (Empress and Strength scale with level), Foresight's Fear is 1d4, new Fate's High Wire, Green Cat's Eye range is Zone 1.",
    content: {
        class_name: 'The Seer',
        base_armor_class: 14,
        base_health_dice: DICE.d6,
        base_hit_modifier: 5,
        base_class_damage_class: 14,
        base_melee_damage_dice: 1,
        base_melee_damage_dice_type: DICE.d4,
        base_melee_damage_modifier: 1,
        base_melee_damage_type: 'Physical',
        base_ranged_damage_dice: 1,
        base_ranged_damage_dice_type: DICE.d6,
        base_ranged_damage_modifier: 1,
        base_ranged_damage_type: 'Physical',
        description: 'Made By Jonah for Jade. Used in Clocks Of Loren.',
        class_weapons: 'Scavenger Knife, Deck of Un, "Fuzzy" Book',
        actions: [
            action({
                name: 'Fortune Telling', category: 'feat', dc: 'Cha',
                description: `
*"Fate is malleable."*

*Your mother's deck always had this weird feeling from it. Corners sharpened, faced with the men and women of our ancestors. You have been trained to read people's fate. They are not always right, but you believe that just means their fate changed.*

Grants the feat [Fortune Telling]`,
            }),
            action({
                name: 'A Glance', category: 'passive', dc: 'Cha',
                description: `
*"Changing fate comes with consequences."*

*Quite a special set of cards, made of metal and holding what you think is a piece of our ancestors in each card. No matter how much you shuffle the cards, they seem to order themselves.*

At the beginning of combat, shuffle the Deck of Un, then draw and immediately resolve a Fortune on yourself.

Once per round, at the start of your turn, you may read the Fortune of one creature you can reasonably see.

1. Choose the recipient first. Once chosen, the recipient cannot be changed.
2. Draw the top card of the Deck of Un without shuffling.
3. Immediately resolve the drawn Fortune on the chosen recipient.
4. After the Fortune is fully resolved, reshuffle the entire Deck of Un.

A creature may only have their Fortune read once per combat. Effects such as Foresight that reveal the top card do not cause the deck to be reshuffled.
${FORTUNES}`,
            }),
            action({
                name: 'Foresight: Threaded', category: 'action', cost: 1, dc: 'Int', per: 'perDay', count: 1,
                description: `
*Taking a peek at someone else's destiny seems wrong, for if you know what it is, you may change it.*

**Refills when you keep a Nat 1 roll during combat.**

Peek at the top card of the Deck of Un without revealing or removing it. Foresight does not shuffle the deck. Doing so causes you to feel an immense sense of dread. Roll 1d4 (AVG 2.5) and gain that amount of **Fear**.`,
            }),
            action({
                name: "Fate's High Wire", category: 'action', cost: 1, range: '2 Zones', dc: 'Cha',
                description: `
**Once per Round**

Choose one ally you can see within range. Until the start of your next turn, the next attack they make requires **2** less above the target's AC to critically succeed.

If that attack fails to hit, you gain **Fear 1**. The effect then ends.

After choosing an ally, you must choose two different allies with Fate's High Wire before choosing that ally again.

**Outside Combat — 1/Day:** Before an ally you can see attempts a meaningful Ability Check, you may place them on Fate's High Wire. For that check, they critically succeed at **DC +8 instead of DC +10**.

The ability must be declared before the check is rolled.

If they fail the check, you gain **Fear 1**.`,
            }),
            action({
                name: "Green Cat's Eye (Optional)", category: 'action', cost: 2, range: 'Zone 1', dc: 'Cha', per: 'perDay', count: 1,
                description: `
Provide your companion or yourself with this soothing Green Cat's Eye, which relaxes the muscles, brings good energy, and lifts away negative vibes. Heal the target for 2D10+3 HP (AVG 14) and cleanse one stack of a negative effect.

**Cleanse does not remove Wounded/Exhausted.**`,
            }),
            action({
                name: 'Aura of Suffering', category: 'action', cost: 2, dc: 'Str',
                description: `
*A wretched book filled with lies and secrets. Let the world discover the truth.*

Open the book and let the curses free. Take 1 damage. All enemies within Engagement Range must make a Strength Check against your Class DC. Aura of Suffering deals 1d6+1 Dark Damage (AVG 4.5 | Crit AVG 9).`,
                outcomeTable: {
                    criticalSuccess: 'Nothing happens',
                    success: 'Half Damage',
                    failure: 'Full Damage + Fear 1 + Flee 1',
                    criticalFailure: 'Double Damage + Fear 2 + Flee 1',
                },
            }),
            action({
                name: 'Spiritual Conduit', category: 'action', cost: 1, range: '1 Zone', dc: 'Cha', per: 'perDay', count: 2,
                description: `
Remove a negative condition from an ally up to 1 Zone away. You gain that negative condition instead. Whenever you transfer a negative condition this way, gain Bravery 1 (the opposite of Fear; counteracts Fear). If done by touch, gain Bravery 2 instead.

**Does not remove Wounded/Dying.**

Some higher-level or more powerful negative conditions may require a roll to actually remove.`,
            }),
            action({
                name: "Oscar's Black Orlov Ring", category: 'action', cost: 1, range: '1 Zone', dc: 'Cha', per: 'perDay', count: 1,
                description: `
**Bag of Cursed Trinkets of Fun** · Roleplay / Combat · Does not work at night · 1 Reaction/Action

*Cured Oscar's chronic blindness by removing this cursed ring.*

Choose someone up to 1 Zone away and blind them with light. This always hits the target but also blinds the user. Both are considered Confused, requiring the target to make a Save Check to maintain their current target. Both conditions last until the start of your next turn, ending after A Glance resolves.`,
            }),
            action({
                name: "Taylor's Fumbling Teddy Bear", category: 'action', cost: 1, per: 'perDay', count: 1,
                description: `
**Bag of Cursed Trinkets of Fun** · Roleplay / Combat · 1 Reaction/Action

*Cured Taylor's insomnia by removing this bear from them.*

When squeezed, it makes a demented "I love you" sound before its eyes pop out of their sockets. The eyes are surprisingly slippery and blend into the environment. (Might knock someone Prone, MAYBE.)`,
            }),
            action({
                name: "Gavin's Glorious Goo", category: 'action', cost: 1, per: 'perDay', count: 1,
                description: `
**Bag of Cursed Trinkets of Fun** · Roleplay / Combat · Does not work in extreme climates · 1 Reaction/Action

*Gavin gave it to me for 50% off.*

It's an extra-viscous green goo stored in a jar. When opened and rubbed on someone, it can cure any rash (or cause any rash). It can also leave you smelling great (or horrible).`,
            }),
        ],
    },
};

const magus = {
    class_name: 'Magus',
    versionNotes: 'Initial release, design v1.2.',
    // Written when the class doesn't exist yet. An admin-curated Default, like
    // the other Clocks of Loren classes; the Magus is listed under Attrionists
    // in the ruleset.
    create: {
        author: 'Jonah',
        class_type: 'Attrionist',
        base_healing_dice_type: DICE.d6,
        base_hardness: 0,
    },
    content: {
        class_name: 'Magus',
        base_armor_class: 16,
        base_health_dice: DICE.d10,
        base_hit_modifier: 6,
        base_class_damage_class: 14,
        base_melee_damage_dice: 1,
        base_melee_damage_dice_type: DICE.d10,
        base_melee_damage_modifier: 2,
        base_melee_damage_type: 'Physical',
        base_ranged_damage_dice: 1,
        base_ranged_damage_dice_type: DICE.d6,
        base_ranged_damage_modifier: 1,
        base_ranged_damage_type: 'Physical',
        description: 'Made By Jonah for James. Used in Clocks Of Loren.',
        class_weapons: 'Standard Issue Magus Wakizashi (Clover), Standard Issue Kunai',
        actions: [
            action({
                name: 'Meditation', category: 'feat',
                description: `
*An ancient practice of the Magus and the very first lesson for a novitiate. Meditation is key to harnessing the potential of the blade, to clear the mind and become one with the sword.*

Grants the feat [Meditation]`,
            }),
            action({
                name: 'Passing the Lesson', category: 'passive',
                description: `
*Knowledge hoarded is knowledge wasted. A Magus is expected not only to learn, but to leave others more capable than they found them.*

When you spend meaningful time teaching, demonstrating, or helping another creature with a practical task you are knowledgeable about, you may give them a **Lesson** relevant to what you taught.

When the Lesson is used, that creature gains +1 to one appropriate noncombat Check directly related to your instruction.

A creature can only benefit from one of your Lessons at a time.

Examples:

- Teaching an NPC how to properly hold and maintain a sword.
- Showing someone how to defend themselves.
- Helping a guard recognize dangerous fighting posture.
- Teaching someone how to safely handle an electrical device.
- Showing someone how to preserve food using Frostbane.
- Helping a craftsman understand why a material keeps cracking.
- Teaching a child how to properly cook something using Flaming Slash, which is obviously the highest application of Magus philosophy`,
            }),
            action({
                name: 'Sword Arts', category: 'passive',
                description: `
*A state of being, a state of mind. True mastery requires a focus, and Sword Arts is the pinnacle of steel meets steel within the School of Magus. Scholars have studied millennia and still are finding new things to hone in each Sword Art.*

Your dedication to training both body and mind has earned you the title of Magus. Magus tradition condemns flimsy slashes and careless strikes, instead demanding a refined discipline of studying one's opponent and striking precisely at their weakest point.

You cannot make a basic Melee attack. Instead, you may attack using Sword Slash.

Channelable Elements:

**Flaming Slash: Fire**

Control the blade's temperature. It surprisingly makes a great stove for cooking delicious meals. It can also dry wet materials, cauterize or sterilize tools, and generally do anything reasonable with a very hot, very sharp piece of metal. Flaming Slash does not produce light.

**Caustic Slash: Acid**

Produce a tiny, controlled corrosive film along the blade. It can clean rust or tarnish, etch markings, test how materials react to corrosion, and slowly corrode appropriate materials. Significant objects or structures generally require extended time to meaningfully weaken.

**Frostbane Slash: Cold**

Leave some drinks on this bad boy and you've got chilled, refreshing beverages. It can also cool overheated objects, preserve small samples, and create a thin layer of frost on objects touching the blade.

**Resonate Slash: Sonic**

Make the blade vibrate at controlled frequencies. It can produce tones, act as a tuning reference, detect hollowness or cracks through resonance, make nearby small objects visibly vibrate, and test the acoustics of rooms.

**Joltstrike Slash: Lightning**

Generate controlled electricity. It can power simple, low demand devices for a couple of minutes, such as a small radio; test whether something conducts electricity; magnetize or demagnetize appropriate small objects; and even give someone a harmless shock for fun.`,
            }),
            action({
                name: 'Sword Slash', category: 'action', cost: 2, range: 'Melee', toHit: 0,
                description: `
*The implement of the blade, a scalpel to a body. The application of Sword Arts in its rawest form, a basic yet versatile slash capable of cutting down any foe.*

Choose an **Elemental** damage type available to your Sword Arts, then make a Melee Attack against a creature within range. The chosen element replaces the Physical damage your blade would normally deal.

On a successful hit, the target gains an **Elemental Fracture** matching the damage type chosen for this sword slash.

Sword slash counts as one attack for the purposes of MAP

**Elemental Fracture:**

When a creature gains an **Elemental Fracture**, it is tied with the elemental damage type that created it.

An **Elemental Fracture** Bursts when either:

- The creature takes damage matching the Fracture's Element from another party member
- The fracture remains until the start of your next turn, at which point it Bursts automatically

When an Elemental Fracture bursts, the creature takes 1d4 damage matching the Fracture's Element. After this damage resolves, remove the Fracture and apply an **Elemental Scar** of the same type.

Elemental fracture replaces itself and does not stack.

Replacing an Elemental Fracture does **not** cause the previous Fracture to Burst.

**Elemental Scar:**

An **Elemental Scar** corresponds to the Element that created it and lasts for the rest of combat.

When an Elemental Scar is applied:

- If the creature has **Weakness** to the Scar's Element, increase that Weakness by **1** while the Scar remains.
- If the creature has **Resistance** to the Scar's Element, reduce that Resistance by **1** while the Scar remains, to a minimum of 0.
- If the creature has neither Weakness nor Resistance to the Scar's Element, it gains **Weakness 1** to that Element while the Scar remains.
- If the creature has **Immunity** to the Scar's Element, the Elemental Scar fails to apply.

A creature can only have one Elemental Fracture and one Elemental Scar created by you at a time. Applying a new one replaces the previous one.

Elemental Scar does not stack.`,
            }),
            action({
                name: 'Recenter', category: 'passive',
                description: `
**Once per Round**

When you fail to hit with Sword Slash, gain 1 additional Action that must be used before the end of your current turn.

This Action cannot be used to make an Attack or activate an ability that deals damage.

If the missed Sword Slash triggers Zipper, you retain this Action while Zipper resolves. For the purposes of determining whether control returns to you after Zipper, this additional Action counts as an Action you still have available.

**Outside Combat — 1/Day:** When you fail a meaningful Ability Check, you may immediately Recenter. You may attempt a **different approach** toward the same goal, using a different action or Ability Check as appropriate.

You cannot simply repeat the failed check, and Recenter does not undo consequences that have already occurred.

The new approach must be meaningfully different from the failed approach. The GM determines whether an alternate approach is valid.`,
            }),
            action({
                name: "Magus's Analysis", category: 'action', cost: 1, dc: 'Int',
                description: `
*Every scar is a lesson. Every stance is a confession. A trained Magus needs only to observe.*

Make a normal **Analysis Check** against a creature.

On a successful Analysis, in addition to the information normally gained, you gain **+1** to your next Sword Slash against that creature. You can gain this +1 bonus only once per creature each combat.

This bonus remains until you successfully hit that creature with Sword Slash or use Magus's Analysis against another creature.

When your Analysis concerns a creature's martial training, weapon skill, fighting style, or intent to commit violence, the GM may provide greater detail than would normally be apparent.`,
            }),
            action({
                name: 'Convergent Step', category: 'action', cost: 1, range: '2 Zones', per: 'perDay', count: 2,
                description: `
Choose a creature within 2 Zones that is currently Engaged with one of your party members. Move into Engagement Range with that creature.

This is normal movement: you must have a valid path to the target and this movement triggers Reactions as normal.`,
            }),
            action({
                name: 'Perfect Slash: Threaded', category: 'action', cost: 2, toHit: 1, per: 'perDay', count: 1,
                requirement: 'The Target has an Elemental Scar created by you.',
                description: `
Make a Melee Attack against the target with a **+1** bonus to hit. This bonus does not stack with the bonus from **Magus's Analysis**.

The attack's damage type becomes Magical Physical.

On a successful hit, Perfect Slash does not trigger Weaknesses normally. After its damage resolves, trigger each Weakness currently affecting the target once, regardless of whether Perfect Slash's damage would normally trigger that Weakness.`,
            }),
            action({
                name: 'Dominant Line', category: 'reaction', cost: 1, per: 'perDay', count: 2,
                requirement: 'An Ally is making a Ranged Attack against a creature currently Engaged with you.',
                description: `
Through pressure, footwork, and the constant threat of your blade, you monopolize the target's attention long enough for your ally to find an opening.

The triggering ally gains **+1** to the attack roll against that creature.

This ability must be used before the ally makes the attack roll.`,
            }),
        ],
    },
};

module.exports = [monk, gunslinger, overqualified, seer, magus];
