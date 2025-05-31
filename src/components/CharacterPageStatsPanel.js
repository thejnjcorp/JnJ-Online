import { Tooltip } from "react-tooltip";
import { CharacterStatCalculator } from "./CharacterStatCalculator";
import { useRef, useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import shieldIcon from '../icons/shield.svg';

export function CharacterPageStatsPanel({characterPageLayoutLive, userId}) {
    const characterStats = CharacterStatCalculator(
        characterPageLayoutLive.experience_points, 
        characterPageLayoutLive.base_armor_class, 
        characterPageLayoutLive.base_hit_modifier, 
        characterPageLayoutLive.base_damage_modifier, 
        characterPageLayoutLive.base_damage_dice, 
        characterPageLayoutLive.base_damage_dice_type, 
        characterPageLayoutLive.base_healing_dice_type);

    const hasWritePermissions = userId ? (characterPageLayoutLive.userId === userId || characterPageLayoutLive.canWrite.includes(userId)) : false;
    const debounceRef = useRef({});
    const [localScores, setLocalScores] = useState({
        current_health: characterPageLayoutLive.current_health,
        maximum_health: characterPageLayoutLive.maximum_health,
        temporary_health: characterPageLayoutLive.temporary_health,
        experience_points: characterPageLayoutLive.experience_points,
        hardness: characterPageLayoutLive.hardness
    });

    useEffect(() => {
        setLocalScores({
            current_health: characterPageLayoutLive.current_health,
            maximum_health: characterPageLayoutLive.maximum_health,
            temporary_health: characterPageLayoutLive.temporary_health,
            experience_points: characterPageLayoutLive.experience_points,
            hardness: characterPageLayoutLive.hardness
        });
    }, [
        characterPageLayoutLive.current_health,
        characterPageLayoutLive.maximum_health,
        characterPageLayoutLive.temporary_health,
        characterPageLayoutLive.experience_points,
        characterPageLayoutLive.hardness
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

    return <div className={characterPageLayoutLive.temporary_health > 0 ? "CharacterPage-stats CharacterPage-stats-temp-hp-yellow" : "CharacterPage-stats"}>
        <div className='CharacterPage-stats-horizontal'>
            <div className='CharacterPage-stats-block-hp'>
                <div className='CharacterPage-hp-block'>
                    <div data-tooltip-id="current-hp">CURRENT</div>
                    <div className='CharaterPage-hp-divider'/>
                    <input key="CURRENT_HP" 
                        value={localScores.current_health} 
                        className='CharacterPage-hp-stat'
                        disabled={!hasWritePermissions}
                        name='current_health'
                        type='number'
                        onChange={handleChange}/>
                    <div className='CharacterPage-xp-slash'>/</div>
                </div>
                <div className='CharacterPage-hp-block'>
                    <div data-tooltip-id="max-hp">MAX</div>
                    <div className='CharaterPage-hp-divider'/>
                    <input key="MAX_HP" 
                        value={localScores.maximum_health} 
                        className='CharacterPage-hp-stat'
                        disabled={!hasWritePermissions}
                        name='maximum_health'
                        type='number'
                        onChange={handleChange}/>
                </div>
                <div className='CharacterPage-hp-block'>
                    <div data-tooltip-id="temp-hp">TEMP</div>
                    <div className='CharaterPage-hp-divider'/>
                    <input key="TEMP_HP" 
                        value={localScores.temporary_health} 
                        className='CharacterPage-hp-stat'
                        disabled={!hasWritePermissions}
                        name='temporary_health'
                        type='number'
                        onChange={handleChange}/>
                </div>
            </div>
            <div className='CharacterPage-stats-block-shield' data-tooltip-id='ac'>
                AC<br/>
                <img src={shieldIcon} className='CharacterPage-shield' alt='shield.svg'/>
                <div className='CharacterPage-shield-text'>{characterStats.ArmorClass}</div>
            </div>
        </div>
        <div className='CharacterPage-stats-horizontal'>
            <div className='CharacterPage-stats-xp' data-tooltip-id='xp'>
                XP<input key="CURRENT_XP" 
                    value={localScores.experience_points} 
                    className='CharacterPage-xp-and-hardness-stat'
                    disabled={!hasWritePermissions}
                    name='current_xp'
                    type='number'
                    onChange={handleChange}/>
            </div>
            <div className='CharacterPage-stats-divider'></div>
            <div className='CharacterPage-stats-hardness'>
                HARDNESS<input key="HARDNESS" 
                    value={localScores.hardness} 
                    className='CharacterPage-xp-and-hardness-stat' 
                    style={{width: 30}}
                    disabled={!hasWritePermissions}
                    name='hardness'
                    type='number'
                    onChange={handleChange}/>
            </div>
        </div>
        {characterPageLayoutLive.tooltips && <>
            <Tooltip 
                id="current-hp"
                place="top"
                content="current health points"
                variant='info'
            />
            <Tooltip 
                id="max-hp"
                place="top"
                content="maximum health points"
                variant='info'
            />
            <Tooltip 
                id="temp-hp"
                place="top"
                content="temporary health points"
                variant='info'
            />
            <Tooltip 
                id="ac"
                place="top"
                content="armor class"
                variant='info'
            />
            <Tooltip 
                id="xp"
                place="top"
                content="experience points"
                variant='info'
            />
        </>}
    </div>
}