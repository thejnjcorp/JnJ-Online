import '../styles/CombatActionList.scss';
import Markdown from './ColoredMarkdown';
import { ReactComponent as LockIcon } from '../icons/lock.svg';
import { CharacterStatCalculator } from './CharacterStatCalculator';
import { getActionCategory, isReactionAction } from '../utils/classActions';
import { namedTags } from '../utils/tags';
import { isLimitedUse, spendUse, usesLeft } from '../utils/actionUses';
import { ActionUsesTracker } from './ActionUses';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { keyed } from '../utils/keyed';

const OUTCOME_TABLE_ROWS = [
    { key: 'criticalSuccess', label: 'Critical Success' },
    { key: 'success', label: 'Success' },
    { key: 'failure', label: 'Failure' },
    { key: 'criticalFailure', label: 'Critical Failure' },
];

// locked is distinct from canUseActions=false: CharacterMainTab.js renders
// three groups (Passives, Available, Unavailable) and both Passives and
// Unavailable pass canUseActions=false (neither shows a Use button) - but
// only Unavailable (cost > current action points) should get the
// faded/locked treatment. Passives are just always-on, not something you're
// being blocked from using.
// onUseAction/hasWritePermissions let a caller point "Use Action" at a
// non-character write path (Director's Page enemy cards - NPCs have no
// `character_id`/`characters` doc to write to, see DirectorsPage.js's
// setEnemyActionPoints). Omitted, this defaults to exactly the original
// character-doc behavior.
// actionUses/onActionUsesChange turn on tracking of limited-use actions ("1/Day"):
// how many uses each has left, shown with the Use button, which stops working at
// none. Without onActionUsesChange (the Director's enemy cards, the new-character
// preview) they are just a label.
// A reaction can only be used once per turn: with the character's (or enemy's)
// reaction already spent (`reaction_used`), a reaction card's button is off, and
// using one spends it along with its action points.
// roleplay shows the cards as the Roleplay tab does: no action point cost, and the
// Use button (only for an action with limited uses) just spends one of them.
const FREQUENCY_SUFFIX = { perDay: 'Day', perShortRest: 'Short Rest', perCombat: 'Combat' };

// "1/Day, 1 Action" style line under the name (frequency, then cost). A roleplay
// card has no cost: action points are for fights.
function subtitleParts(action, roleplay) {
    const parts = [];
    const suffix = FREQUENCY_SUFFIX[action.actionType];
    if (suffix) parts.push(`${action.actionTypeCount || 1}/${suffix}`);
    if (roleplay) return parts;
    if (getActionCategory(action) === 'reaction') parts.push('Reaction');
    else if (action.actionCost > 0) parts.push(`${action.actionCost} ${action.actionCost === 1 ? 'Action' : 'Actions'}`);
    return parts;
}

function containsReaction(action){
    return getActionCategory(action) === 'reaction';
}

// A trigger and/or requirement, when the action has them.
function TriggerLines({ action }) {
    if (!action.trigger && !action.requirement) return null;
    return <div className='CombatActionListCard-meta-lines'>
        {action.trigger && <div className='CombatActionListCard-trigger'><strong>Trigger:</strong> {action.trigger}</div>}
        {action.requirement && <div className='CombatActionListCard-requirement'><strong>Requirement:</strong> {action.requirement}</div>}
    </div>;
}

// What a roll lands on, for an action with an outcome table.
function OutcomeTable({ action }) {
    const rows = OUTCOME_TABLE_ROWS.filter(row => action.outcomeTable?.[row.key]);
    if (rows.length === 0) return null;
    return <table className='CombatActionListCard-outcome-table'>
        <tbody>
            {rows.map(row => <tr key={row.key}>
                <th>{row.label}</th>
                <td>{action.outcomeTable[row.key]}</td>
            </tr>)}
        </tbody>
    </table>;
}

// Using an action: in the Roleplay tab only its uses are spent; where the page runs the
// action itself (the director's cards) it does; otherwise the character's own doc is updated.
function spendAction({ action, roleplay, tracked, reaction, actionUses, onActionUsesChange, onUseAction, characterPage }) {
    try {
        if (roleplay) {
            onActionUsesChange(spendUse(actionUses, action));
        } else if (onUseAction) {
            onUseAction(action);
            if (tracked) onActionUsesChange(spendUse(actionUses, action));
        } else {
            updateDoc(doc(db, "characters", characterPage.character_id), {
                // A reaction spends the reaction, not an action point - it's
                // usable on someone else's turn precisely because it doesn't
                // touch this turn's action economy.
                ...(reaction ? { reaction_used: true } : { action_points: characterPage.action_points - action.actionCost }),
                ...(tracked ? { action_uses: spendUse(actionUses, action) } : {}),
            });
        }
    } catch (e) {
        alert(e);
    }
}

// The text on an action's Use button.
function actionButtonLabel({ spentOut, reactionSpent, roleplay, action }) {
    if (spentOut) return "No uses left";
    if (reactionSpent) return "Reaction used";
    if (roleplay) return "Use";
    return containsReaction(action) ? "Use Reaction" : "Use Action";
}

export function CombatActionList({actions, experience_points, baseArmorClass, baseHitModifier, baseDamageModifier, baseDamageDice, baseDamageDiceType, baseHealingDiceType, canUseActions = false, locked = false, characterPage, userId, onUseAction, hasWritePermissions: hasWritePermissionsProp, actionUses = {}, onActionUsesChange, roleplay = false}) {
    let hasWritePermissions = false;
    if (hasWritePermissionsProp !== undefined) hasWritePermissions = hasWritePermissionsProp;
    else if (userId) hasWritePermissions = characterPage.userId === userId || characterPage.canWrite?.includes(userId);

    function toHitInterperlator(toHit) {
        const characterStats = CharacterStatCalculator(experience_points, baseArmorClass, baseHitModifier, baseDamageModifier, baseDamageDice, baseDamageDiceType, baseHealingDiceType);
        const num = Number(toHit) + characterStats.HitModifier;
        return num;
    }

    function DifficultyClassInterperlator(difficultyClass) {
        const array = difficultyClass.split(",");
        const characterStats = CharacterStatCalculator(experience_points, baseArmorClass, baseHitModifier, baseDamageModifier, baseDamageDice, baseDamageDiceType, baseHealingDiceType);
        const num = (Number(array[1]) || 0) + characterStats.ClassDifficultyClass;
        // "Dex,0" is a Dexterity check: "DC 14 Dex check"
        const stat = (array[0] || '').trim();
        return ["DC", num, stat, "check"].filter(part => part !== '').join(" ");
    }

    function metaText(action) {
        const rollPart = action.toHitBool ? "+" + toHitInterperlator(action.toHit) + " to hit" : DifficultyClassInterperlator(action.difficultyClass);
        const parts = [rollPart, action.range];
        if (locked && !roleplay) parts.push(`${action.actionCost} AP`);
        return parts.filter(Boolean).join(" · ");
    }

    return <div className='CombatActionList'>
        {keyed(actions, 'action').map(({ item: action, index, key }) => {
            // A feat gets a synthetic "Feat" chip at render time rather
            // than a persisted tag, so authoring a feat via the Category
            // dropdown is enough to get the visual label - no redundant
            // manual tag required.
            const displayTags = getActionCategory(action) === 'feat'
                ? [{ tagInfo: 'Feat' }, ...namedTags(action)]
                : namedTags(action);
            const tracked = !locked && Boolean(onActionUsesChange) && isLimitedUse(action);
            const spentOut = tracked && usesLeft(action, actionUses) === 0;
            const reaction = !roleplay && isReactionAction(action);
            const reactionSpent = reaction && Boolean(characterPage?.reaction_used);
            const showUse = !locked && canUseActions && hasWritePermissions && (!roleplay || tracked);
            const cardClass = ['CombatActionListCard', locked && 'CombatActionListCard-locked', (spentOut || reactionSpent) && 'CombatActionListCard-spent'].filter(Boolean).join(' ');
            return <div className={cardClass} key={key}>
                <div className='CombatActionListCard-header'>
                    {locked && <LockIcon className="CombatActionListCard-lock"/>}
                    <span className='CombatActionListCard-name'>{action.actionName}</span>
                    {!locked && displayTags?.map((tag, i) =>
                        <span
                            className='CombatActionList-tag'
                            style={{backgroundColor: tag.tagColor, color: tag.textColor}}
                            key={tag.id || i}
                        >
                            {tag.tagInfo}
                            {tag.tagDescription !== undefined && tag.tagDescription !== "" && <div className='CombatActionList-tag-description'>
                                {tag.tagDescription}
                            </div>}
                        </span>
                    )}
                </div>
                <div className='CombatActionListCard-subtitle'>{[...subtitleParts(action, roleplay), metaText(action)].join(' · ')}</div>

                {!locked && <TriggerLines action={action}/>}

                {!locked && <div className='CombatActionListCard-description'><Markdown options={{ disableParsingRawHTML: true }}>{action.description || ""}</Markdown></div>}

                {!locked && <OutcomeTable action={action}/>}

                {(tracked || showUse) && <div className='CombatActionListCard-footer'>
                    {tracked && <ActionUsesTracker action={action} uses={actionUses} canEdit={hasWritePermissions} onChange={onActionUsesChange}/>}
                    {showUse && <button type="button" className='CombatActionList-use-action-button' disabled={spentOut || reactionSpent} onClick={() => spendAction({ action, roleplay, tracked, reaction, actionUses, onActionUsesChange, onUseAction, characterPage })}>{actionButtonLabel({ spentOut, reactionSpent, roleplay, action })}</button>}
                </div>}
            </div>;
        })}
    </div>
}
