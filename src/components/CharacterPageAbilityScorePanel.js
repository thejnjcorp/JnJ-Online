import { Tooltip } from 'react-tooltip';
import { useRef, useState, useEffect } from 'react';
import strengthIcon from '../icons/strength.svg';
import dexterityIcon from '../icons/dexterity.svg';
import intelligenceIcon from '../icons/intelligence.svg';
import charismaIcon from '../icons/charisma.svg';
import '../styles/CharacterPage.scss';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';

export function CharacterPageAbilityScorePanel({characterPageLayoutLive, userId}) {
    const hasWritePermissions = userId ? (characterPageLayoutLive.userId === userId || characterPageLayoutLive.canWrite.includes(userId)) : false;
    const debounceRef = useRef({});
    const [localScores, setLocalScores] = useState({
        strength_stat: characterPageLayoutLive.strength_stat,
        dexterity_stat: characterPageLayoutLive.dexterity_stat,
        intelligence_stat: characterPageLayoutLive.intelligence_stat,
        charisma_stat: characterPageLayoutLive.charisma_stat,
    });

    useEffect(() => {
        setLocalScores({
            strength_stat: characterPageLayoutLive.strength_stat,
            dexterity_stat: characterPageLayoutLive.dexterity_stat,
            intelligence_stat: characterPageLayoutLive.intelligence_stat,
            charisma_stat: characterPageLayoutLive.charisma_stat,
        });
    }, [
        characterPageLayoutLive.strength_stat,
        characterPageLayoutLive.dexterity_stat,
        characterPageLayoutLive.intelligence_stat,
        characterPageLayoutLive.charisma_stat,
    ]);

    const handleChange = event => {
        const { name, type, value } = event.target;
        const parsedValue = type === 'number' && value !== '' ? Number(value) : value;

        setLocalScores(prev => ({
            ...prev,
            [name]: value
        }));

        if (debounceRef.current[name]) {
            clearTimeout(debounceRef.current[name]);
        }
        debounceRef.current[name] = setTimeout(() => {
            if (value !== '') {
                updateDoc(doc(db, "characters", characterPageLayoutLive.character_id), {
                    [name]: parsedValue
                }).catch(e => {
                    alert(e);
                });
            }
        }, 500);
    };

    return <div className='CharacterPage-abiltyscore-horzontal'>
        {/* First ability score item (Strength) */}
        <div className='CharacterPage-abiltyscore-block'>
            <img src={strengthIcon} className='CharacterPage-abilityscore-icon' alt='strength.svg'/>
            <div data-tooltip-id="Strength-stat">STR</div>
            <div className='CharacterPage-abilityscore-divider'/>
            <input key="STRENGTH_STAT"
                value={localScores.strength_stat}
                className='CharacterPage-abilityscore-stat'
                disabled={!hasWritePermissions}
                name='strength_stat'
                type='number'
                onChange={handleChange}/>
        </div>
        {/* Second ability score item (Dexterity) */}
        <div className='CharacterPage-abiltyscore-block'>
            <img src={dexterityIcon} className='CharacterPage-abilityscore-icon' alt='dexterity.svg'/>
            <div data-tooltip-id="Dexterity-stat">DEX</div>
            <div className='CharacterPage-abilityscore-divider'/>
            <input key="DEXTERITY_STAT"
                value={localScores.dexterity_stat}
                className='CharacterPage-abilityscore-stat'
                disabled={!hasWritePermissions}
                name='dexterity_stat'
                type='number'
                onChange={handleChange}/>
        </div>
        {/* Third ability score item (Intelligence) */}
        <div className='CharacterPage-abiltyscore-block'>
            <img src={intelligenceIcon} className='CharacterPage-abilityscore-icon' alt='intelligence.svg'/>
            <div data-tooltip-id="Intelligence-stat">INT</div>
            <div className='CharacterPage-abilityscore-divider'/>
            <input key="INTELLIGENCE_STAT"
                value={localScores.intelligence_stat}
                className='CharacterPage-abilityscore-stat'
                disabled={!hasWritePermissions}
                name='intelligence_stat'
                type='number'
                onChange={handleChange}/>
        </div>
        {/* Fourth ability score item (Charisma) */}
        <div className='CharacterPage-abiltyscore-block'>
            <img src={charismaIcon} className='CharacterPage-abilityscore-icon' alt='charisma.svg'/>
            <div data-tooltip-id="Charisma-stat">CHA</div>
            <div className='CharacterPage-abilityscore-divider'/>
            <input key="CHARISMA_STAT"
                value={localScores.charisma_stat}
                className='CharacterPage-abilityscore-stat'
                disabled={!hasWritePermissions}
                name='charisma_stat'
                type='number'
                onChange={handleChange}/>
        </div>

        {characterPageLayoutLive.tooltips && <>
            <Tooltip 
                id="Strength-stat"
                place="top"
                content="Strength"
                variant='info'
            />
            <Tooltip 
                id="Dexterity-stat"
                place="top"
                content="Dexterity"
                variant='info'
            />
            <Tooltip 
                id="Intelligence-stat"
                place="top"
                content="Intelligence"
                variant='info'
            />
            <Tooltip 
                id="Charisma-stat"
                place="top"
                content="Charisma"
                variant='info'
            />
        </>}
    </div>
}