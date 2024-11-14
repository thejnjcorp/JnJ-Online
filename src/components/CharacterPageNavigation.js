import { HexColorPicker } from "react-colorful";
import { Tooltip } from "react-tooltip";
import '../styles/CharacterPage.scss';
import colorpickerIcon from '../icons/colorpicker.svg';
import { useState } from "react";

export function CharacterPageNavigation({characterPageLayoutLive, setCharacterPageLayoutLive, refreshPageRender}) {
    const [showColorpicker, setShowColorPicker] = useState(false);
    const [selectedBackgroundColor, setSelectedBackgroundColor] = useState(characterPageLayoutLive.background_color);

    function changeBackgroundColor() {
        setShowColorPicker(false);
        var newCharacterPageLayoutLive = characterPageLayoutLive;
        newCharacterPageLayoutLive.background_color = selectedBackgroundColor;
        setCharacterPageLayoutLive(newCharacterPageLayoutLive);
        refreshPageRender();
    }

    return <div className="CharacterPage-navigation">
        <>
            <button className="CharacterPage-navigation-color-picker-button" data-tooltip-id="background-color-picker" onClick={() => setShowColorPicker(!showColorpicker)}>
                <img src={colorpickerIcon} className="CharacterPage-colorpicker" alt="colorpicker.svg"/> 
            </button>
            {showColorpicker && <div className="CharacterPage-colorpicker-panel">
                <HexColorPicker className="CharacterPage-colorpicker-actual" color={characterPageLayoutLive.background_color} onChange={setSelectedBackgroundColor}/>
                <button className="CharacterPage-colorpicker-select-button" onClick={() => changeBackgroundColor()}>select</button>
            </div>}
        </>
        
        

        {characterPageLayoutLive.tooltips && <>
            <Tooltip
                id="background-color-picker"
                place="right"
                content="background color picker"
                variant='info'
            />
        
        </>}
        
    </div>
}