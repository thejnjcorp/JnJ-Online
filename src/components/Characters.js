import { useState, useEffect } from "react";
import { getGoogleSheetCells } from "./googleSheetCellFunctions";
import appData from './AppData.json';
import '../styles/Characters.scss';
import playerListLayout from '../PlayerListLayout.json';
import { useNavigate } from "react-router-dom";
import { CharacterPage } from "./CharacterPage";

export function Characters({setValidAccessToken, setErrorMessage, accessToken}) {
    const [playerList, setPlayerList] = useState(playerListLayout);
    const navigate = useNavigate();

    useEffect(() => {
        function getCharacterList() {
            getGoogleSheetCells(appData.spreadSheetKey, "Sheet1", "A1", "A1")
            .then(response => {
                setPlayerList(JSON.parse(response.at(0)))
            })
            .catch(res => {
                if (typeof res.result === 'undefined') setErrorMessage(res.result.error);
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
        {window.location.hash.substring(window.location.hash.lastIndexOf('/') + 1) === "characters" && <>
            {playerList.characters.map((character, index) =>
            <div className='CharacterCard' key={index} onClick={() => handleCharacterCardSelect(character)}>
                    {character.character_name}<br/>
                    <div className="CharacterCard-small-text">
                        {character.class}<br/>
                        Player: {character.player_name}
                    </div>
                </div>
            )}
        </>}
        {window.location.hash.substring(window.location.hash.lastIndexOf('/') + 1) !== "characters" && 
            <CharacterPage setValidAccessToken={setValidAccessToken} setErrorMessage={setErrorMessage} accessToken={accessToken} />}
    </div>
}