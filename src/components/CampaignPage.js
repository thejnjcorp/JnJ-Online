import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getGoogleSheetCells } from "./googleSheetCellFunctions";
import campaignListLayout from '../CampaignListLayout.json';
import appData from './AppData.json';
import '../styles/CampaignPage.scss';

export function CampaignPage({setValidAccessToken, setErrorMessage, accessToken}) {
    const [campaignList, setCampaignListLayout] = useState(campaignListLayout);
    const [showSpecificCampaign, setShowSpecificCampaign] = useState(false);
    const [selectedCampaignName, setSelectedCampaignName] = useState("");
    const [characterList, setCharacterList] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        function getCampaignList() {
            getGoogleSheetCells(appData.spreadSheetKey, "Sheet1", "C1", "C1")
            .then(response => {
                setCampaignListLayout(JSON.parse(response.at(0)))
            })
            .catch(res => {
                if (typeof res.result != 'undefined') setErrorMessage(res.result.error);
                setValidAccessToken(false);
                })
        }
        setTimeout(() => {
            getCampaignList();
          }, 1000);
        getCampaignList();
        // eslint-disable-next-line
    },[]);

    function handleCampaignCardSelect(campaign) {
        setSelectedCampaignName(campaign.campaign_name);
        getGoogleSheetCells(appData.spreadSheetKey, "Sheet1", "A" + campaign.column, "A" + campaign.column)
        .then(response => {
            setCharacterList(JSON.parse(response));
            setShowSpecificCampaign(true);
        })
        .catch(res => {
            if (typeof res.result != 'undefined') setErrorMessage(res.result.error);
            setValidAccessToken(false);
            })
    }

    function handleCreateCampaign() {

    }

    function handleCharacterCardSelect(character) {
        navigate("/characters/" + character.column_number)
    }

    return <div>
        {window.location.hash.substring(window.location.hash.lastIndexOf('/') + 1) === "campaigns" && !showSpecificCampaign && <div className="CampaignPage">
            <div className="Campaigns-title">
                Campaigns
            </div>
            {campaignList.campaigns.map((campaign, index) =>
                <button className='CampaignCard' key={index} onClick={() => handleCampaignCardSelect(campaign)}>
                    {campaign.campaign_name}<br/>
                    <div className="CampaignCard-small-text">
                        Director: {campaign.director_name}
                    </div>
                </button>
            )}
            <button className='CampaignCard Campaign-shift-up' onClick={() => handleCreateCampaign()}>
                Create Campaign
            </button>
        </div>}
        {window.location.hash.substring(window.location.hash.lastIndexOf('/') + 1) === "campaigns" && showSpecificCampaign && <div className="CampaignPage">
            <div className="Campaigns-title">
                {selectedCampaignName}
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
    </div>
}