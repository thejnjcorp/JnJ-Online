import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { CampaignPage } from "./CampaignPage";
import { collection, query, getDocs, or, where } from "firebase/firestore";
import { auth, db } from "../utils/firebase";
import '../styles/Campaigns.scss';
import { NewCampaignPage } from "./NewCampaignPage";
import { NewCharacterPage } from "./NewCharacterPage";
import { CampaignClassesPage } from "./CampaignClassesPage";
import { onAuthStateChanged } from "firebase/auth";
import loadingIcon from '../icons/loading.svg';

export function Campaigns() {
    const [campaignList, setCampaignList] = useState([]);
    // "loading" | "signed-out" | "ready" - see the same pattern in
    // Characters.js for why this beats a bare boolean here.
    const [status, setStatus] = useState("loading");
    const [showArchived, setShowArchived] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    document.title = "Campaigns";

    // Old campaigns predate the `archived` field entirely, so this filters
    // client-side rather than via a Firestore `where("archived","==",false)`
    // query - that query would silently exclude every doc where the field is
    // simply absent, not just the ones explicitly archived.
    const activeCampaigns = campaignList.filter(c => !c.archived);
    const archivedCampaigns = campaignList.filter(c => c.archived);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) {
                setStatus("signed-out");
                return;
            }
            getCampaigns(user);
        });
        return () => unsubscribe();
        // eslint-disable-next-line
    },[])

    async function getCampaigns(user) {
        const campaigns = query(collection(db, "campaigns"), or(where("canRead", "array-contains", user.uid), where("canWrite", "array-contains", user.uid)));
        const querySnapshot = await getDocs(campaigns);
        setCampaignList(querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
        setStatus("ready");
    }

    function handleCampaignCardSelect(campaign) {
        navigate("/campaigns/" + campaign.id);
    }

    function handleCreateCampaign() {
        navigate("/campaigns/new");
    }

    return <div>
        {location.pathname.endsWith('campaigns') && <div className="Campaigns-page">
            <div className="Campaigns-title">
                Campaigns
            </div>

            {status === "signed-out" && <div className="Campaigns-empty-state">
                Sign in to see your campaigns.
            </div>}

            {status === "loading" && <img src={loadingIcon} alt="Loading" className="Campaigns-loading-icon"/>}

            {status === "ready" && <div className="Campaigns-grid">
                {activeCampaigns.map((campaign, index) =>
                    <button className='CampaignCard' key={index} onClick={() => handleCampaignCardSelect(campaign)}>
                        <div className="CampaignCard-name">{campaign.campaign_name}</div>
                        <div className="CampaignCard-small-text">
                            Director: {campaign.director_name}
                            {campaign.players?.length > 0 && <> · {campaign.players.length} player{campaign.players.length === 1 ? "" : "s"}</>}
                        </div>
                    </button>)}
                <button className='CampaignCard CampaignCard-create' onClick={() => handleCreateCampaign()}>
                    + Create Campaign
                </button>
                {activeCampaigns.length === 0 && <div className="Campaigns-empty-state Campaigns-empty-state-grid">
                    No campaigns yet.
                </div>}
            </div>}

            {status === "ready" && archivedCampaigns.length > 0 && <div className="Campaigns-archived-section">
                <button className="Campaigns-archived-toggle" onClick={() => setShowArchived(v => !v)}>
                    {showArchived ? "Hide" : "Show"} Archived ({archivedCampaigns.length})
                </button>
                {showArchived && <div className="Campaigns-grid Campaigns-archived-grid">
                    {archivedCampaigns.map((campaign, index) =>
                        <button className='CampaignCard CampaignCard-archived' key={index} onClick={() => handleCampaignCardSelect(campaign)}>
                            <div className="CampaignCard-name">{campaign.campaign_name}</div>
                            <div className="CampaignCard-small-text">
                                Director: {campaign.director_name}
                                {campaign.scheduledDeletionAt && <><br/>Deletes {campaign.scheduledDeletionAt.toDate().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</>}
                            </div>
                        </button>)}
                </div>}
            </div>}
        </div>}
        {!location.pathname.endsWith('campaigns') && !location.pathname.endsWith('new') && !location.pathname.endsWith('newCharacter') && !location.pathname.endsWith('classes') &&
            <CampaignPage/>}
        {location.pathname.endsWith('new') &&
            <NewCampaignPage/>}
        {location.pathname.endsWith('newCharacter') &&
            <NewCharacterPage/>}
        {location.pathname.endsWith('classes') &&
            <CampaignClassesPage/>}
    </div>
}
