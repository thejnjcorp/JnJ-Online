import { Tooltip } from 'react-tooltip';
import '../styles/CharacterPage.scss'
import 'react-tooltip/dist/react-tooltip.css'
import { useState } from 'react';

export function CharacterPage() {
    const [disableTooltips, setDisableTooltips] = useState(false);

    return <div className="CharacterPage">
        <div className="CharacterPage-stats">
            <div className='CharacterPage-stats-horizontal'>
                <div className='CharacterPage-stats-block-hp'>
                    <div className='CharacterPage-hp-block'>
                        <div data-tooltip-id="current-hp">CURRENT</div>
                        <div className='CharaterPage-hp-divider'/>
                        <input key="CURRENT_HP" defaultValue={12} className='CharacterPage-hp-stat'/>
                        <div className='CharacterPage-xp-slash'>/</div>
                    </div>
                    <div className='CharacterPage-hp-block'>
                        <div data-tooltip-id="max-hp">MAX</div>
                        <div className='CharaterPage-hp-divider'/>
                        <input key="MAX_HP" defaultValue={20} className='CharacterPage-hp-stat'/>
                    </div>
                    <div className='CharacterPage-hp-block'>
                        <div data-tooltip-id="temp-hp">TEMP</div>
                        <div className='CharaterPage-hp-divider'/>
                        <input key="TEMP_HP" defaultValue={0} className='CharacterPage-hp-stat'/>
                    </div>
                </div>
                <div className='CharacterPage-stats-block-shield' data-tooltip-id='ac'>
                    AC<br/>
                    <img src="/shield.svg" className='CharacterPage-shield' alt='shield.svg'/>
                    <div className='CharacterPage-shield-text'>17</div>
                </div>
            </div>
            <div className='CharacterPage-stats-horizontal CharacterPage-justify-right'>
                <div className='CharacterPage-stats-xp' data-tooltip-id='xp'>
                    XP<input key="CURRENT_XP" defaultValue={0} className='CharacterPage-xp-and-hardness-stat'/>
                    / 1000
                </div>
                <div className='CharacterPage-stats-hardness'>
                    HARDNESS<input key="HARDNESS" defaultValue={0} className='CharacterPage-xp-and-hardness-stat'/>
                </div>
            </div>
        </div>
        {!disableTooltips && <>
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