import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { CampaignPage } from "./CampaignPage";
import { collection, query, getDocs, or, where } from "firebase/firestore";
import { auth, db } from "../utils/firebase";
import '../styles/CampaignPage.scss';
import { NewCampaignPage } from "./NewCampaignPage";
import { NewCharacterPage } from "./NewCharacterPage";
import { onAuthStateChanged } from "firebase/auth";

export function Campaigns() {
    const [campaignList, setCampaignList] = useState([]);
    const navigate = useNavigate();
    const location = useLocation();
    document.title = "Campaigns";

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) return;
            getCampaigns(user);
            unsubscribe();
        });
    },[])

    async function getCampaigns(user) {
        const campaigns = query(collection(db, "campaigns"), or(where("canRead", "array-contains", user.uid), where("canWrite", "array-contains", user.uid)));
        const querySnapshot = await getDocs(campaigns);
        setCampaignList(querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
    }

    function handleCampaignCardSelect(campaign) {
        navigate("/campaigns/" + campaign.id);
    }

    function handleCreateCampaign() {
        navigate("/campaigns/new");
    }

    return <div>
        {location.pathname.endsWith('campaigns') && <div className="CampaignPage">
            <div className="Campaigns-title">
                Campaigns
            </div>
            {campaignList.map((campaign, index) =>
                <button className='CampaignCard' key={index} onClick={() => handleCampaignCardSelect(campaign)}>
                    {campaign.campaign_name}<br/>
                    <div className="CampaignCard-small-text">
                        Director: {campaign.director_name}
                    </div>
                </button>)}
            <button className='CampaignCard Campaign-shift-up' onClick={() => handleCreateCampaign()}>
                Create Campaign
            </button>
        </div>}
        {!location.pathname.endsWith('campaigns') && !location.pathname.endsWith('new') && !location.pathname.endsWith('newCharacter') &&
            <CampaignPage/>}
        {location.pathname.endsWith('new') && 
            <NewCampaignPage/>}
        {location.pathname.endsWith('newCharacter') &&
            <NewCharacterPage/>}
    </div>
}