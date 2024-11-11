import { Tooltip } from 'react-tooltip';
import '../styles/CharacterPage.scss'
import 'react-tooltip/dist/react-tooltip.css'
import shieldIcon from '../icons/shield.svg';
import strengthIcon from '../icons/strength.svg';
import loadingIcon from '../icons/loading.svg';
import dexterityIcon from '../icons/dexterity.svg'
import intelligenceIcon from '../icons/intelligence.svg'
import charismaIcon from '../icons/charisma.svg'
import characterPageLayout from '../CharacterPageLayout.json';
import { useEffect, useState } from 'react';
import { getGoogleSheetCells } from './googleSheetCellFunctions';
import appData from "./AppData.json";

function getNumber(number) {
    if (number >= 0) return "+" + number;
    if (number < 0) return "-" + number;
}

export function CharacterPage() {
    document.title="Character Page";
    const [characterPageLayoutLive, setCharacterPageLayoutLive] = useState(characterPageLayout);
    const [loadingScreen, setLoadingScreen] = useState(true);

    useEffect(() => {
        const cell = "B" + window.location.hash.split("/").at(2);
        setLoadingScreen(true);
        getGoogleSheetCells(appData.spreadSheetKey, "Sheet1", cell, cell).then(response => {
            setCharacterPageLayoutLive(JSON.parse(response));
            setLoadingScreen(false);
        })

        setTimeout(() => {
            getGoogleSheetCells(appData.spreadSheetKey, "Sheet1", cell, cell).then(response => {
                setCharacterPageLayoutLive(JSON.parse(response));
                setLoadingScreen(false);
            })
          }, 1000);
    }, [])

    return <>
        {!loadingScreen && <div className="CharacterPage">
        {/* Character Abilty score section begin */}
            <div className='CharacterPage-abiltyscore-horzontal'>
                {/* First ability score item (Strength) */}
                <div className='CharacterPage-abiltyscore-block'>
                    <img src={strengthIcon} className='CharacterPage-abilityscore-icon' alt='strength.svg'/>
                    <div data-tooltip-id="Strength-stat">STR</div>
                    <div className='CharacterPage-abilityscore-divider'/>
                    <input key="STRENGTH_STAT" defaultValue={getNumber(characterPageLayoutLive.strength_stat)} className='CharacterPage-abilityscore-stat'/>
                </div>
                {/* Second ability score item (Dexterity) */}
                <div className='CharacterPage-abiltyscore-block'>
                    <img src={dexterityIcon} className='CharacterPage-abilityscore-icon' alt='dexterity.svg'/>
                    <div data-tooltip-id="Dexterity-stat">DEX</div>
                    <div className='CharacterPage-abilityscore-divider'/>
                    <input key="DEXTERITY_STAT" defaultValue={getNumber(characterPageLayoutLive.dexterity_stat)} className='CharacterPage-abilityscore-stat'/>
                </div>
                {/* Third ability score item (Intelligence) */}
                <div className='CharacterPage-abiltyscore-block'>
                    <img src={intelligenceIcon} className='CharacterPage-abilityscore-icon' alt='intelligence.svg'/>
                    <div data-tooltip-id="Intelligence-stat">INT</div>
                    <div className='CharacterPage-abilityscore-divider'/>
                    <input key="INTELLIGENCE_STAT" defaultValue={getNumber(characterPageLayoutLive.intelligence_stat)} className='CharacterPage-abilityscore-stat'/>
                </div>
                {/* Fourth ability score item (Charisma) */}
                <div className='CharacterPage-abiltyscore-block'>
                    <img src={charismaIcon} className='CharacterPage-abilityscore-icon' alt='charisma.svg'/>
                    <div data-tooltip-id="Charisma-stat">CHA</div>
                    <div className='CharacterPage-abilityscore-divider'/>
                    <input key="CHARISMA_STAT" defaultValue={getNumber(characterPageLayoutLive.charisma_stat)} className='CharacterPage-abilityscore-stat'/>
                </div>
                {/* Character Abilty score section End */}
                
            </div>
        <div className={characterPageLayoutLive.temporary_health > 0 ? "CharacterPage-stats CharacterPage-stats-temp-hp-yellow" : "CharacterPage-stats"}>
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
                    <div className='CharacterPage-shield-text'>{characterPageLayoutLive.armor_class}</div>
                </div>
            </div>
            <div className='CharacterPage-stats-horizontal'>
                <div className='CharacterPage-stats-xp' data-tooltip-id='xp'>
                    XP<input key="CURRENT_XP" defaultValue={characterPageLayoutLive.experience_points} className='CharacterPage-xp-and-hardness-stat'/>
                    / 1000
                </div>
                <div className='CharacterPage-stats-divider'></div>
                <div className='CharacterPage-stats-hardness'>
                    HARDNESS<input key="HARDNESS" defaultValue={characterPageLayoutLive.hardness} className='CharacterPage-xp-and-hardness-stat'/>
                </div>
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
    </div>}
    {loadingScreen && <img src={loadingIcon} alt="loading" className='CharacterPage-loading-icon'/>}
    </>
}