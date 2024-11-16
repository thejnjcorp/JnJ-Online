import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getGoogleSheetCells } from "./googleSheetCellFunctions";
import { CampaignPage } from "./CampaignPage";
import campaignListLayout from '../CampaignListLayout.json';
import appData from './AppData.json';
import '../styles/CampaignPage.scss';

export function Campaigns({setValidAccessToken, setErrorMessage, accessToken}) {
    const [campaignList, setCampaignListLayout] = useState(campaignListLayout);
    const navigate = useNavigate();
    document.title = "Campaigns";

    useEffect(() => {
        function getCampaignList() {
            getGoogleSheetCells(appData.spreadSheetKey, "Sheet1", "C1", "C1")
            .then(response => {
                setCampaignListLayout(JSON.parse(response.at(0)));
                setValidAccessToken(true);
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
        navigate("/campaigns/" + campaign.column)
    }

    function handleCreateCampaign() {

    }

    return <div>
        {window.location.hash.substring(window.location.hash.lastIndexOf('/') + 1) === "campaigns" && <div className="CampaignPage">
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
        {window.location.hash.substring(window.location.hash.lastIndexOf('/') + 1) !== "campaigns" &&
            <CampaignPage setValidAccessToken={setValidAccessToken} setErrorMessage={setErrorMessage} accessToken={accessToken} />}
    </div>
}