import { useState, useEffect } from "react";
import { getGoogleSheetCells } from "./googleSheetCellFunctions";
import appData from './AppData.json';
import '../styles/Characters.scss';
import characterListLayout from '../CharacterListLayout.json';
import { useNavigate } from "react-router-dom";
import { CharacterPage } from "./CharacterPage";

export function Characters({setValidAccessToken, setErrorMessage, accessToken}) {
    const [characterList, setCharacterList] = useState(characterListLayout);
    const navigate = useNavigate();
    document.title = "Characters";

    useEffect(() => {
        function getCharacterList() {
            getGoogleSheetCells(appData.spreadSheetKey, "Sheet1", "A", "A")
            .then(response => {
                const actualList = [...new Set(response.map(value => JSON.parse(value)))];
                const temp = {
                    "characters": actualList.map(charList => charList.characters).flat(2)
                }
                setCharacterList(temp);
                setValidAccessToken(true);
            })
            .catch(res => {
                if (typeof res.result != 'undefined') setErrorMessage(res.result.error);
                setValidAccessToken(false);
                })
        }
        setTimeout(() => {
            getCharacterList();
          }, 1000);
        getCharacterList();
        // eslint-disable-next-line
    },[]);

    function handleCharacterCardSelect(character) {
        navigate("/characters/" + character.column_number)
    }

    return <div>
        {window.location.hash.substring(window.location.hash.lastIndexOf('/') + 1) === "characters" && <div className="Character-page">
            <div className="Characters-title">
                Characters
            </div>
            {characterList.characters.map((character, index) =>
            <button className='CharacterCard' key={index} onClick={() => handleCharacterCardSelect(character)}>
                    {character.character_name}<br/>
                    <div className="CharacterCard-small-text">
                        {character.class}<br/>
                        Player: {character.player_name}<br/>
                        Campaign: {character.campaign}
                    </div>
                </button>
            )}
        </div>}
        {window.location.hash.substring(window.location.hash.lastIndexOf('/') + 1) !== "characters" && 
            <CharacterPage setValidAccessToken={setValidAccessToken} setErrorMessage={setErrorMessage} accessToken={accessToken} />}
    </div>
}