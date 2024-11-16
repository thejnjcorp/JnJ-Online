import { useState, useEffect } from "react";
import { getGoogleSheetCells } from "./googleSheetCellFunctions";
import { useNavigate } from "react-router-dom";
import appData from './AppData.json';
import '../styles/CampaignPage.scss';
import characterListLayout from '../CharacterListLayout.json';

export function CampaignPage({setValidAccessToken, setErrorMessage, accessToken}) {
    const [characterListLive, setCharacterListLive] = useState(characterListLayout);
    const navigate = useNavigate();
    document.title = characterListLive.campaign_name;

    useEffect(() => {
        function getCharacterList() {
            const cell = "A" + window.location.hash.split("/").at(2);
            getGoogleSheetCells(appData.spreadSheetKey, "Sheet1", cell, cell)
            .then(response => {
                setCharacterListLive(JSON.parse(response.at(0)));
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

    return <div className="CampaignPage">
        <div className="Campaigns-title">
            {characterListLive.campaign_name}
        </div>
        {characterListLive.characters.map((character, index) =>
        <button className='CharacterCard' key={index} onClick={() => handleCharacterCardSelect(character)}>
                {character.character_name}<br/>
                <div className="CharacterCard-small-text">
                    {character.class}<br/>
                    Player: {character.player_name}<br/>
                    Campaign: {character.campaign}
                </div>
            </button>
        )}
    </div>
}