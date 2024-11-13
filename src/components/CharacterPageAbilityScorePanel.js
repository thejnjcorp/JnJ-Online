import strengthIcon from '../icons/strength.svg';
import dexterityIcon from '../icons/dexterity.svg';
import intelligenceIcon from '../icons/intelligence.svg';
import charismaIcon from '../icons/charisma.svg';
import '../styles/CharacterPage.scss';

function getNumber(number) {
    if (number >= 0) return "+" + number;
    if (number < 0) return "-" + number;
}

export function CharacterPageAbilityScorePanel({characterPageLayoutLive}) {
    return <div className='CharacterPage-abiltyscore-horzontal'>
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
    </div>
}