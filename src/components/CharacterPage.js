import '../styles/CharacterPage.scss'
import 'react-tooltip/dist/react-tooltip.css'
import loadingIcon from '../icons/loading.svg';
import characterPageLayout from '../CharacterPageLayout.json';
import { useEffect, useState } from 'react';
import { getGoogleSheetCells, updateGoogleSheetCells } from './googleSheetCellFunctions';
import { CharacterPageAbilityScorePanel } from './CharacterPageAbilityScorePanel';
import { CharacterPageStatsPanel } from './CharacterPageStatsPanel';
import { CharacterPageNavigation } from './CharacterPageNavigation';
import appData from "./AppData.json";

const delay = ms => new Promise(res => setTimeout(res, ms));

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

    function saveCharacterPageLayout() {
        const cell = "B" + window.location.hash.split("/").at(2);
        updateGoogleSheetCells(appData.spreadSheetKey, "Sheet1", cell, cell, [[JSON.stringify(characterPageLayoutLive)]], accessToken)
        .catch(res => {
            if (typeof res.result === 'undefined') setErrorMessage(res.result.error);
            setValidAccessToken(false);
        });
    }

    async function refreshPageRender() {
        saveCharacterPageLayout();
        setLoadingScreen(true);
        await delay(1);
        setLoadingScreen(false);
    }

    return <>
        {!loadingScreen && <div className="CharacterPage" style={{background: characterPageLayoutLive.background_color}}>
        <CharacterPageNavigation 
            characterPageLayoutLive={characterPageLayoutLive} 
            setCharacterPageLayoutLive={setCharacterPageLayoutLive} 
            refreshPageRender={refreshPageRender}
        />    
        <CharacterPageAbilityScorePanel characterPageLayoutLive={characterPageLayoutLive}/>
        <CharacterPageStatsPanel characterPageLayoutLive={characterPageLayoutLive}/>
        
        
    </div>}
    {loadingScreen && <img src={loadingIcon} alt="loading" className='CharacterPage-loading-icon'/>}
    </>
}