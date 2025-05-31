import '../styles/CombatActionList.scss';
import starFilledIcon from '../icons/star_filled.svg';
import { useState } from 'react';
import { CharacterStatCalculator } from './CharacterStatCalculator';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../utils/firebase';

export function CombatActionList({actions, experience_points, baseArmorClass, baseHitModifier, baseDamageModifier, baseDamageDice, baseDamageDiceType, baseHealingDiceType, canUseActions = false, characterPage, userId, lowerUseActionButton=false}) {
    const [visibleActions, setVisibleActions] = useState(Array(actions.length).fill(false))

    const hasWritePermissions = userId ? (characterPage.userId === userId || characterPage.canWrite.includes(userId)) : false;

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

    return <div className='CombatActionList'>
        {actions.map((action, index) => 
        <div 
            key={index}
            className='CombatActionListButton'
            onClick={() => {
                var tempVisibleActions = visibleActions;
                tempVisibleActions[index] = !tempVisibleActions[index];
                setVisibleActions([...visibleActions, tempVisibleActions]);
            }}
        >
            <div className='CombatActionListButton-inner'>
                {action.actionName + " "}
                {Array.from({ length: action.actionCost }, (_, index) => (
                    <img key={index} src={starFilledIcon} alt='star' className='CombatActionList-star' width={20}/>
                ))}
                {"\xa0\xa0\xa0\xa0"}
                {action.toHitBool ? "+" + toHitInterperlator(action.toHit) + " to hit" : DifficultyClassInterperlator(action.difficultyClass)}
                {"\xa0\xa0\xa0\xa0" + action.range}
                {canUseActions && hasWritePermissions && lowerUseActionButton && <br/>}
                {canUseActions && hasWritePermissions && <button className='CombatActionList-use-action-button' onClick={(e) => {
                    e.stopPropagation();
                    try {
                        updateDoc(doc(db, "characters", characterPage.character_id), {
                            action_points: characterPage.action_points - action.actionCost
                        })
                    } catch (e) {
                        alert(e);
                    }
                }}>Use { containsReaction(action) ? "Reaction" : "Action"}</button>}
                <br/>
                {visibleActions[index] && <div className='CombatActionListDescription' onClick={(e) => e.stopPropagation()}>
                    {action.tags !== undefined && <>{action.tags.map((tag, index) => {
                        return <span 
                            className='CombatActionList-tag' 
                            style={{backgroundColor: tag.tagColor, color: tag.textColor}} 
                            key={index}
                            data-tooltip-id="something"
                        >
                            {tag.tagInfo}
                            {tag.tagDescription !== undefined && tag.tagDescription !== "" && <div className='CombatActionList-tag-description'>
                                {tag.tagDescription}
                            </div>}
                        </span>
                    })}<br/>
                    </>}
                    {action.description}
                </div>}
            </div>
        </div>)}
            
    </div>
}