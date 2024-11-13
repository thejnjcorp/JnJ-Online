import { Tooltip } from 'react-tooltip';
import '../styles/CharacterPage.scss'
import 'react-tooltip/dist/react-tooltip.css'
import loadingIcon from '../icons/loading.svg';
import characterPageLayout from '../CharacterPageLayout.json';
import { useEffect, useState } from 'react';
import { getGoogleSheetCells } from './googleSheetCellFunctions';
import { CharacterPageAbilityScorePanel } from './CharacterPageAbilityScorePanel';
import { CharacterPageStatsPanel } from './CharacterPageStatsPanel';
import appData from "./AppData.json";

export function CharacterPage({setValidAccessToken, setErrorMessage, accessToken}) {
    document.title="Character Page";
    const [characterPageLayoutLive, setCharacterPageLayoutLive] = useState(characterPageLayout);
    const [loadingScreen, setLoadingScreen] = useState(true);

    useEffect(() => {
        function getCharacterData() {
            const cell = "B" + window.location.hash.split("/").at(2);
            getGoogleSheetCells(appData.spreadSheetKey, "Sheet1", cell, cell)
            .then(response => {
                setCharacterPageLayoutLive(prevData => ({
                    ...prevData,
                    ...JSON.parse(response),
            }));
                setLoadingScreen(false);
            })
            .catch(res => {
                if (typeof res.result === 'undefined') setErrorMessage(res.result.error);
                setValidAccessToken(false);
                })
        }
        setLoadingScreen(true);
        getCharacterData();

        if (loadingScreen) {
            setTimeout(() => {
                getCharacterData();
            }, 1000);
        }
        // eslint-disable-next-line
    }, [])

    return <>
        {!loadingScreen && <div className="CharacterPage">
        <CharacterPageAbilityScorePanel characterPageLayoutLive={characterPageLayoutLive}/>
        <CharacterPageStatsPanel characterPageLayoutLive={characterPageLayoutLive}/>
        
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