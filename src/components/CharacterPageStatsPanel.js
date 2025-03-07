import { Tooltip } from "react-tooltip";
import { CharacterStatCalculator } from "./CharacterStatCalculator";
import shieldIcon from '../icons/shield.svg';

export function CharacterPageStatsPanel({characterPageLayoutLive}) {
    const characterStats = CharacterStatCalculator(
        characterPageLayoutLive.experience_points, 
        characterPageLayoutLive.base_armor_class, 
        characterPageLayoutLive.base_hit_modifier, 
        characterPageLayoutLive.base_damage_modifier, 
        characterPageLayoutLive.base_damage_dice, 
        characterPageLayoutLive.base_damage_dice_type, 
        characterPageLayoutLive.base_healing_dice_type);

    return <div className={characterPageLayoutLive.temporary_health > 0 ? "CharacterPage-stats CharacterPage-stats-temp-hp-yellow" : "CharacterPage-stats"}>
        <div className='CharacterPage-stats-horizontal'>
            <div className='CharacterPage-stats-block-hp'>
                <div className='CharacterPage-hp-block'>
                    <div data-tooltip-id="current-hp">CURRENT</div>
                    <div className='CharaterPage-hp-divider'/>
                    <input key="CURRENT_HP" defaultValue={characterPageLayoutLive.current_health} className='CharacterPage-hp-stat'/>
                    <div className='CharacterPage-xp-slash'>/</div>
                </div>
                <div className='CharacterPage-hp-block'>
                    <div data-tooltip-id="max-hp">MAX</div>
                    <div className='CharaterPage-hp-divider'/>
                    <input key="MAX_HP" defaultValue={characterPageLayoutLive.maximum_health} className='CharacterPage-hp-stat'/>
                </div>
                <div className='CharacterPage-hp-block'>
                    <div data-tooltip-id="temp-hp">TEMP</div>
                    <div className='CharaterPage-hp-divider'/>
                    <input key="TEMP_HP" defaultValue={characterPageLayoutLive.temporary_health} className='CharacterPage-hp-stat'/>
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
                XP<input key="CURRENT_XP" defaultValue={characterPageLayoutLive.experience_points} className='CharacterPage-xp-and-hardness-stat'/>
            </div>
            <div className='CharacterPage-stats-divider'></div>
            <div className='CharacterPage-stats-hardness'>
                HARDNESS<input key="HARDNESS" defaultValue={characterPageLayoutLive.hardness} className='CharacterPage-xp-and-hardness-stat' style={{width: 30}}/>
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