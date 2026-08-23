import { HexColorPicker } from "react-colorful";
import { useState } from "react";
import { Tooltip } from "react-tooltip";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import '../styles/CharacterPage.scss';
import { ReactComponent as PaletteIcon } from '../icons/palette.svg';

// background_color exists on the schema but nothing in the app actually
// renders it anywhere - the only color with a real visual effect is
// navigation_color (the masthead gradient below), so that's the only one
// this control offers. Writes straight through updateDoc rather than local
// state - CharacterPage.js's onSnapshot listener already picks up the change
// live, the same way every other editable field on this page persists.
export function CharacterPageNavigationColorPickerButton({characterPageLayoutLive}) {
    const [showColorpicker, setShowColorPicker] = useState(false);
    const [selectedColor, setSelectedColor] = useState(characterPageLayoutLive.navigation_color);

    function handleSetColor() {
        setShowColorPicker(false);
        updateDoc(doc(db, "characters", characterPageLayoutLive.character_id), {
            navigation_color: selectedColor
        }).catch(e => alert(e));
    }

    return <>
        <button className="CharacterPage-masthead-color-button" data-tooltip-id="navigation-color-picker" onClick={() => setShowColorPicker(!showColorpicker)}>
            <PaletteIcon/>
        </button>
        {showColorpicker && <div className="CharacterPage-colorpicker-panel">
            <HexColorPicker className="CharacterPage-colorpicker-actual" color={selectedColor} onChange={setSelectedColor}/>
            <button className="CharacterPage-colorpicker-select-button" onClick={handleSetColor}>Set Color</button>
            <button className="CharacterPage-colorpicker-cancel-button" onClick={() => setShowColorPicker(false)}>Cancel</button>
        </div>}

        {characterPageLayoutLive.tooltips && <Tooltip id="navigation-color-picker" place="left" content="Customize color" variant='info'/>}
    </>
}
