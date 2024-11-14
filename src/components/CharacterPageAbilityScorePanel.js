import { Tooltip } from 'react-tooltip';
import strengthIcon from '../icons/strength.svg';
import dexterityIcon from '../icons/dexterity.svg';
import intelligenceIcon from '../icons/intelligence.svg';
import charismaIcon from '../icons/charisma.svg';
import '../styles/CharacterPage.scss';

export function CharacterPageAbilityScorePanel({characterPageLayoutLive}) {
    return <div className='CharacterPage-abiltyscore-horzontal'>
        {/* First ability score item (Strength) */}
        <div className='CharacterPage-abiltyscore-block'>
            <img src={strengthIcon} className='CharacterPage-abilityscore-icon' alt='strength.svg'/>
            <div data-tooltip-id="Strength-stat">STR</div>
            <div className='CharacterPage-abilityscore-divider'/>
            <input key="STRENGTH_STAT" defaultValue={characterPageLayoutLive.strength_stat} className='CharacterPage-abilityscore-stat'/>
        </div>
        {/* Second ability score item (Dexterity) */}
        <div className='CharacterPage-abiltyscore-block'>
            <img src={dexterityIcon} className='CharacterPage-abilityscore-icon' alt='dexterity.svg'/>
            <div data-tooltip-id="Dexterity-stat">DEX</div>
            <div className='CharacterPage-abilityscore-divider'/>
            <input key="DEXTERITY_STAT" defaultValue={characterPageLayoutLive.dexterity_stat} className='CharacterPage-abilityscore-stat'/>
        </div>
        {/* Third ability score item (Intelligence) */}
        <div className='CharacterPage-abiltyscore-block'>
            <img src={intelligenceIcon} className='CharacterPage-abilityscore-icon' alt='intelligence.svg'/>
            <div data-tooltip-id="Intelligence-stat">INT</div>
            <div className='CharacterPage-abilityscore-divider'/>
            <input key="INTELLIGENCE_STAT" defaultValue={characterPageLayoutLive.intelligence_stat} className='CharacterPage-abilityscore-stat'/>
        </div>
        {/* Fourth ability score item (Charisma) */}
        <div className='CharacterPage-abiltyscore-block'>
            <img src={charismaIcon} className='CharacterPage-abilityscore-icon' alt='charisma.svg'/>
            <div data-tooltip-id="Charisma-stat">CHA</div>
            <div className='CharacterPage-abilityscore-divider'/>
            <input key="CHARISMA_STAT" defaultValue={characterPageLayoutLive.charisma_stat} className='CharacterPage-abilityscore-stat'/>
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