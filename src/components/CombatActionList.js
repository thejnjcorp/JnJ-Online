import '../styles/CombatActionList.scss';
import starIcon from '../icons/star.svg';
import { useState } from 'react';
import { CharacterStatCalculator } from './CharacterStatCalculator';

export function CombatActionList({characterPageLayout}) {
    const [visibleActions, setVisibleActions] = useState(Array(characterPageLayout.actions.length).fill(false))
    const [rerender, setRerender] = useState(false);
    const delay = ms => new Promise(res => setTimeout(res, ms));

    async function doRerender() {
        setRerender(true);
        await delay(1);
        setRerender(false);
    }

    function toHitInterperlator(toHit) {
        const characterStats = CharacterStatCalculator(characterPageLayout.experience_points, 14, 5, 5, 1, 1, 1);
        const num = Number(toHit) + characterStats.HitModifier;
        return num;
    }

    function DifficultyClassInterperlator(difficultyClass) {
        const array = difficultyClass.split(",");
        const characterStats = CharacterStatCalculator(characterPageLayout.experience_points, 14, 5, 5, 1, 1, 1);
        const num = Number(array[1]) + characterStats.ClassDifficultyClass;
        return "DC" + num + " check";
    }

    return <div className='CombatActionList'>
        {!rerender && characterPageLayout.actions.map((action, index) => 
        <button 
            key={index}
            className='CombatActionListButton'
            onClick={() => {
                var tempVisibleActions = visibleActions;
                tempVisibleActions[index] = !tempVisibleActions[index];
                setVisibleActions(tempVisibleActions);
                doRerender();
            }}
        >
            {action.actionName + " "}
            {Array.from({ length: action.actionCost }, (_, index) => (
                <img key={index} src={starIcon} alt='star' className='CombatActionList-star' width={20}/>
            ))}
            {"\xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0"}
            {action.toHitBool ? "+" + toHitInterperlator(action.toHit) + " to hit" : DifficultyClassInterperlator(action.difficultyClass)}
            {"\xa0\xa0\xa0\xa0\xa0\xa0\xa0\xa0" + action.range}
            <br/>
            {visibleActions[index] && <div className='CombatActionListDescription'>
                {action.description}
            </div>}

        </button>)}
    </div>
}