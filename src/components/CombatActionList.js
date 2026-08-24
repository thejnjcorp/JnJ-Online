import '../styles/CombatActionList.scss';
import starFilledIcon from '../icons/star_filled.svg';
import { ReactComponent as LockIcon } from '../icons/lock.svg';
import { CharacterStatCalculator } from './CharacterStatCalculator';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../utils/firebase';

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
export function CombatActionList({actions, experience_points, baseArmorClass, baseHitModifier, baseDamageModifier, baseDamageDice, baseDamageDiceType, baseHealingDiceType, canUseActions = false, locked = false, characterPage, userId, onUseAction, hasWritePermissions: hasWritePermissionsProp}) {
    const hasWritePermissions = hasWritePermissionsProp !== undefined
        ? hasWritePermissionsProp
        : (userId ? (characterPage.userId === userId || characterPage.canWrite?.includes(userId)) : false);

    function containsReaction(action){
        return action.tags !== undefined && action.tags.some(tag => tag.tagInfo === "Reaction");
    }

    function toHitInterperlator(toHit) {
        const characterStats = CharacterStatCalculator(experience_points, baseArmorClass, baseHitModifier, baseDamageModifier, baseDamageDice, baseDamageDiceType, baseHealingDiceType);
        const num = Number(toHit) + characterStats.HitModifier;
        return num;
    }

    function DifficultyClassInterperlator(difficultyClass) {
        const array = difficultyClass.split(",");
        const characterStats = CharacterStatCalculator(experience_points, baseArmorClass, baseHitModifier, baseDamageModifier, baseDamageDice, baseDamageDiceType, baseHealingDiceType);
        const num = Number(array[1]) + characterStats.ClassDifficultyClass;
        return "DC" + num + " check";
    }

    function metaText(action) {
        const rollPart = action.toHitBool ? "+" + toHitInterperlator(action.toHit) + " to hit" : DifficultyClassInterperlator(action.difficultyClass);
        const parts = [rollPart, action.range];
        if (locked) parts.push(`${action.actionCost} AP`);
        return parts.filter(Boolean).join(" · ");
    }

    return <div className='CombatActionList'>
        {actions.map((action, index) =>
            <div className={locked ? 'CombatActionListCard CombatActionListCard-locked' : 'CombatActionListCard'} key={index}>
                <div className='CombatActionListCard-header'>
                    {locked && <LockIcon className="CombatActionListCard-lock"/>}
                    <span className='CombatActionListCard-name'>{action.actionName}</span>
                    {!locked && action.actionCost > 0 && Array.from({ length: action.actionCost }, (_, i) => (
                        <img key={i} src={starFilledIcon} alt='star' className='CombatActionList-star' width={13}/>
                    ))}
                    {!locked && action.tags?.map((tag, i) =>
                        <span
                            className='CombatActionList-tag'
                            style={{backgroundColor: tag.tagColor, color: tag.textColor}}
                            key={i}
                        >
                            {tag.tagInfo}
                            {tag.tagDescription !== undefined && tag.tagDescription !== "" && <div className='CombatActionList-tag-description'>
                                {tag.tagDescription}
                            </div>}
                        </span>
                    )}
                    <span className='CombatActionListCard-meta'>{metaText(action)}</span>
                </div>

                {!locked && <div className='CombatActionListCard-description'>{action.description}</div>}

                {!locked && canUseActions && hasWritePermissions && <button className='CombatActionList-use-action-button' onClick={() => {
                    try {
                        if (onUseAction) {
                            onUseAction(action);
                        } else {
                            updateDoc(doc(db, "characters", characterPage.character_id), {
                                action_points: characterPage.action_points - action.actionCost
                            })
                        }
                    } catch (e) {
                        alert(e);
                    }
                }}>Use { containsReaction(action) ? "Reaction" : "Action"}</button>}
            </div>
        )}
    </div>
}
