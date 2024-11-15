import { HexColorPicker } from "react-colorful";
import { useState } from "react";
import { Tooltip } from "react-tooltip";
import colorpickerIcon from '../icons/colorpicker.svg';
import '../styles/CharacterPage.scss';

export function CharacterPageNavigationColorPickerButton({characterPageLayoutLive, setCharacterPageLayoutLive, refreshPageRender}) {
    const [showColorpicker, setShowColorPicker] = useState(false);
    const [selectedColor, setSelectedColor] = useState(characterPageLayoutLive.background_color);

    function changeColor(component) {
        setShowColorPicker(false);
        var newCharacterPageLayoutLive = characterPageLayoutLive;
        if (component === "background") newCharacterPageLayoutLive.background_color = selectedColor;
        if (component === "navigation") newCharacterPageLayoutLive.navigation_color = selectedColor;
        setCharacterPageLayoutLive(newCharacterPageLayoutLive);
        refreshPageRender();
    }

    return <>
        <button className="CharacterPage-navigation-color-picker-button" data-tooltip-id="background-color-picker" onClick={() => setShowColorPicker(!showColorpicker)}>
            <img src={colorpickerIcon} className="CharacterPage-colorpicker" alt="colorpicker.svg"/> 
        </button>
        {showColorpicker && <div className="CharacterPage-colorpicker-panel">
            <div>
                <button className="CharacterPage-colorpicker-quick-select-button" 
                style={{background: characterPageLayoutLive.background_color}} 
                onClick={() => setSelectedColor(characterPageLayoutLive.background_color)}/>
                <button className="CharacterPage-colorpicker-quick-select-button" 
                style={{background: characterPageLayoutLive.navigation_color}} 
                onClick={() => setSelectedColor(characterPageLayoutLive.navigation_color)}/>
            </div>
            <HexColorPicker className="CharacterPage-colorpicker-actual" color={selectedColor} onChange={setSelectedColor}/>
            <button className="CharacterPage-colorpicker-select-button" onClick={() => changeColor("navigation")}>set navigation color</button>
            <button className="CharacterPage-colorpicker-select-button" onClick={() => changeColor("background")}>set background color</button>
        </div>}

        {characterPageLayoutLive.tooltips && <>
            <Tooltip
                id="background-color-picker"
                place="right"
                content="color picker"
                variant='info'
            />
        
        </>}
    </>
}