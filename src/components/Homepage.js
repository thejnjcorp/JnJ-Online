import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { collection, getDocs, or, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../utils/firebase";
import '../styles/Homepage.scss';
import shieldIcon from '../icons/shield.svg';
import strengthIcon from '../icons/strength.svg';
import dexterityIcon from '../icons/dexterity.svg';
import intelligenceIcon from '../icons/intelligence.svg';
import charismaIcon from '../icons/charisma.svg';

// These icons are flat SVGs baked with a hardcoded fill/stroke of #000000
// (see src/icons/*.svg), so an <img> render of them is invisible against a
// dark theme - no CSS can recolor pixels inside an external image. Masking
// instead turns the SVG into a silhouette painted by background-color, so it
// picks up whatever token or currentColor the caller sets.
function MaskIcon({src, className}) {
    return <span
        aria-hidden="true"
        className={className}
        style={{ WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` }}
    />
}

const FEATURES = [
    {
        icon: shieldIcon,
        title: "Tempo Combat",
        body: "Run fast theater-of-the-mind skirmishes or drop into a full tactical map the moment a fight calls for it.",
    },
    {
        icon: strengthIcon,
        title: "Built-in Class Builder",
        body: "Design and publish your own classes with the same tools the core roster was built with, then share them with the community.",
    },
    {
        icon: dexterityIcon,
        title: "Skills & Flaws",
        body: "A personality-driven system that replaces the traditional skill list, so who your character is shapes what they can do.",
    },
    {
        icon: intelligenceIcon,
        title: "Live Character Sheets",
        body: "Every stat, action, and inventory slot updates in real time for your whole table, no refreshing required.",
    },
];

export function Homepage() {
    const [userInfo, setUserInfo] = useState(undefined);
    const [characterList, setCharacterList] = useState([]);
    const [campaignList, setCampaignList] = useState([]);
    document.title = "JnJ Online";

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUserInfo(user || null);
            if (user) loadDashboard(user);
        });
        return () => unsubscribe();
    }, []);

    async function loadDashboard(user) {
        try {
            const characters = query(collection(db, "characters"), or(
                where("playerId", "==", user.uid),
                where("canRead", "array-contains", user.uid),
                where("canWrite", "array-contains", user.uid)
            ));
            const campaigns = query(collection(db, "campaigns"), or(
                where("canRead", "array-contains", user.uid),
                where("canWrite", "array-contains", user.uid)
            ));
            const [characterSnap, campaignSnap] = await Promise.all([getDocs(characters), getDocs(campaigns)]);
            setCharacterList(characterSnap.docs.map(doc => ({id: doc.id, ...doc.data()})));
            setCampaignList(campaignSnap.docs.map(doc => ({id: doc.id, ...doc.data()})));
        } catch (error) {
            console.log(error);
        }
    }

    // userInfo starts undefined until the auth listener resolves once, so a
    // guest doesn't flash a dashboard shell before settling on the landing page.
    if (userInfo === undefined) return <div className="Homepage"/>;

    return <div className="Homepage">
        {userInfo ? <SignedInHome userInfo={userInfo} characterList={characterList} campaignList={campaignList}/>
            : <SignedOutHome/>}
    </div>
}

function SignedOutHome() {
    return <>
        <section className="Homepage-hero">
            <div className="Homepage-hero-content">
                <span className="Homepage-eyebrow">A tabletop RPG system</span>
                <h1 className="Homepage-hero-title">Play JnJ, together, anywhere.</h1>
                <p className="Homepage-hero-subtitle">
                    Build characters, run campaigns, and fight tempo-based combat with a group,
                    all from live sheets that update the moment your table changes them.
                </p>
                <div className="Homepage-hero-actions">
                    <Link to="/class-list" className="Homepage-button Homepage-button-primary">Browse Classes</Link>
                    <Link to="/blog/JnJ_Ruleset" className="Homepage-button Homepage-button-secondary">Read the Rules</Link>
                </div>
            </div>
        </section>

        <section className="Homepage-features">
            {FEATURES.map((feature) =>
                <div className="Homepage-feature-card" key={feature.title}>
                    <div className="Homepage-feature-icon">
                        <MaskIcon src={feature.icon} className="Homepage-feature-icon-glyph"/>
                    </div>
                    <h3 className="Homepage-feature-title">{feature.title}</h3>
                    <p className="Homepage-feature-body">{feature.body}</p>
                </div>
            )}
        </section>

        <section className="Homepage-cta">
            <h2>Ready to roll?</h2>
            <p>Sign in with Google to create a character, start a campaign, or join one already in progress.</p>
        </section>
    </>
}

function SignedInHome({userInfo, characterList, campaignList}) {
    return <>
        <section className="Homepage-dashboard-header">
            <h1>Welcome back{userInfo.displayName ? `, ${userInfo.displayName.split(" ")[0]}` : ""}</h1>
            <p>Jump back into a character or campaign, or start something new.</p>
        </section>

        <section className="Homepage-dashboard-grid">
            <DashboardSection
                title="Your Characters"
                emptyText="No characters yet."
                viewAllTo="/characters"
                createTo="/campaigns"
                createLabel="Create one from a campaign"
            >
                {characterList.slice(0, 4).map((character) =>
                    <Link to={`/characters/${character.id}`} className="Homepage-entity-card" key={character.id}>
                        <div className="Homepage-entity-card-title">{character.character_name}</div>
                        <div className="Homepage-entity-card-meta">
                            {character.class}{character.campaign ? ` · ${character.campaign}` : ""}
                        </div>
                    </Link>
                )}
            </DashboardSection>

            <DashboardSection
                title="Your Campaigns"
                emptyText="No campaigns yet."
                viewAllTo="/campaigns"
                createTo="/campaigns/new"
                createLabel="Create a Campaign"
            >
                {campaignList.slice(0, 4).map((campaign) =>
                    <Link to={`/campaigns/${campaign.id}`} className="Homepage-entity-card" key={campaign.id}>
                        <div className="Homepage-entity-card-title">{campaign.campaign_name}</div>
                        <div className="Homepage-entity-card-meta">Director: {campaign.director_name}</div>
                    </Link>
                )}
            </DashboardSection>
        </section>

        <section className="Homepage-quick-links">
            <Link to="/class-list" className="Homepage-quick-link">
                <MaskIcon src={charismaIcon} className="Homepage-quick-link-icon"/>
                Browse Classes
            </Link>
            <Link to="/blog/JnJ_Ruleset" className="Homepage-quick-link">
                <MaskIcon src={dexterityIcon} className="Homepage-quick-link-icon"/>
                Read the Rules
            </Link>
            <Link to="/account" className="Homepage-quick-link">
                <MaskIcon src={intelligenceIcon} className="Homepage-quick-link-icon"/>
                Your Account
            </Link>
        </section>
    </>
}

function DashboardSection({title, emptyText, viewAllTo, createTo, createLabel, children}) {
    const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
    return <div className="Homepage-dashboard-section">
        <div className="Homepage-dashboard-section-header">
            <h2>{title}</h2>
            <Link to={viewAllTo} className="Homepage-dashboard-section-viewall">View All</Link>
        </div>
        <div className="Homepage-dashboard-section-list">
            {hasChildren ? children : <p className="Homepage-dashboard-empty">{emptyText}</p>}
        </div>
        <Link to={createTo} className="Homepage-dashboard-section-create">+ {createLabel}</Link>
    </div>
}
