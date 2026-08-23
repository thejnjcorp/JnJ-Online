import { CombatActionList } from "./CombatActionList";
// import Collapsible from "react-collapsible";
import { Link } from "react-router-dom";
import TextareaAutosize from "react-textarea-autosize";
import starIcon from '../icons/star.svg';
import starFilledIcon from '../icons/star_filled.svg';
import '../styles/CharacterMainTab.scss';
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import { useRef, useState, useEffect } from "react";
import { TabContainer } from "./TabContainer.js";
// import { PostListContentLocal } from "../utils/DraggableElements/PostListLocal.tsx";
import { PostListContentInventory } from "../utils/DraggableElements/PostListInventory.tsx";
import { PostListContentInventoryPocket } from "../utils/DraggableElements/PostListInventoryPocket.tsx";
import { PostListContentCombat } from "../utils/DraggableElements/PostListCombat.tsx";
import { PostListContentCombatMap } from "../utils/DraggableElements/PostListCombatMap.tsx";
import { useCampaignMaps, useCombatEntities } from "../utils/useCampaignCombat";
import { ReactComponent as ScrollIcon } from '../icons/scroll.svg';
import { ReactComponent as SwordsIcon } from '../icons/swords.svg';
import { ReactComponent as BagIcon } from '../icons/bag.svg';
import { ReactComponent as NoteIcon } from '../icons/note.svg';
import { ReactComponent as MapIcon } from '../icons/map.svg';

export function CharacterMainTab({ characterPage, userId, characterList = [], campaignInfo = {} }) {
    const hasWritePermissions = userId ? (characterPage.userId === userId || characterPage.canWrite?.includes(userId)) : false;
    // The Combat Map tab operates on the character's campaign (the combat
    // tracker, the active map) - a character with no campaign field has none
    // of that to show, and campaignId="" collapsing to "no campaign" makes
    // that a resolvable state now rather than a crash (see CharacterPage.js).
    const hasCampaign = Boolean(characterPage.campaign);
    const { activeMap } = useCampaignMaps(campaignInfo);
    const combatEntities = useCombatEntities(characterList, campaignInfo);
    // The actual map render felt cramped embedded at tab-content size, so it
    // now opens full-screen on demand instead of living inline - see the
    // overlay rendered after the TabContainer below.
    const [mapOverlayOpen, setMapOverlayOpen] = useState(false);

    const debounceRef = useRef({});
    const [localValues, setLocalValues] = useState({
        description: characterPage.description ? characterPage.description : characterPage.class_description,
        notes: characterPage.notes ? characterPage.notes : ""
    });

    useEffect(() => {
        setLocalValues({
            description: characterPage.description ? characterPage.description : characterPage.class_description,
            notes: characterPage.notes ? characterPage.notes : ""
        });
    }, [
        characterPage.description,
        characterPage.class_description,
        characterPage.notes
    ]);

    const handleChange = event => {
        const { name, type, value } = event.target;
        const parsedValue = type === 'number' && value !== '' ? Number(value) : value;

        setLocalValues(prev => ({
            ...prev,
            [name]: value
        }));

        if (debounceRef.current[name]) {
            clearTimeout(debounceRef.current[name]);
        }
        debounceRef.current[name] = setTimeout(() => {
            if (value !== '') {
                updateDoc(doc(db, "characters", characterPage.character_id), {
                    [name]: parsedValue
                }).catch(e => {
                    alert(e);
                });
            }
        }, 1000);
    };

    function isPassive(action) {
        return action.tags !== undefined && action.tags.some(tag => tag.tagInfo === "Passive")
    }

    function setActionPoints(actionPoints) {
        try {
            updateDoc(doc(db, "characters", characterPage.character_id), {
                action_points: actionPoints
            });
        } catch (e) {
            alert(e);
        }
    }
    
    const tabs = [
        {
            tabName: "Roleplay",
            icon: <ScrollIcon/>,
            content: <div className="CharacterMainTab-roleplay">
            <div className="CharacterMainTab-background CharacterMainTab-roleplay-card CharacterMainTab-roleplay-card-background">
                <div className="CharacterMainTab-roleplay-card-header">
                    <ScrollIcon/>
                    <h2>Background</h2>
                    <span className="CharacterMainTab-roleplay-card-caption">Autosaves as you type</span>
                </div>
                <TextareaAutosize
                    className="CharacterMainTab-background-description"
                    minRows={3}
                    value={localValues.description}
                    name="description"
                    disabled={!hasWritePermissions}
                    onChange={handleChange}
                />
            </div>
            <div className="CharacterMainTab-notes CharacterMainTab-roleplay-card CharacterMainTab-roleplay-card-notes">
                <div className="CharacterMainTab-roleplay-card-header">
                    <NoteIcon/>
                    <h2>Notes</h2>
                    <span className="CharacterMainTab-roleplay-card-caption">Autosaves as you type</span>
                </div>
                <TextareaAutosize
                    className="CharacterMainTab-notes-description"
                    minRows={3}
                    value={localValues.notes}
                    name="notes"
                    disabled={!hasWritePermissions}
                    onChange={handleChange}
                />
            </div>
            </div>
        },
        {
            tabName: "Combat",
            icon: <SwordsIcon/>,
            content: <>
                
                <div className="CharacterMainTab-action-points">
                    <span className="CharacterMainTab-caps-label">Action Points</span>{"\xa0\xa0"}
                    {characterPage.action_points > 0 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(1) : undefined}/> :
                    <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(1) : undefined}/>}
                    {characterPage.action_points > 1 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(2) : undefined}/> :
                    <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(2) : undefined}/>}
                    {characterPage.action_points > 2 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(3) : undefined}/> :
                    <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(3) : undefined}/>}
                    {characterPage.action_points > 3 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(4) : undefined}/> :
                    <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(4) : undefined}/>}
                    <span className="CharacterMainTab-action-points-label">
                        {characterPage.action_points} / 4 available{hasWritePermissions ? " · click a star to spend" : ""}
                    </span>
                </div>
                <div className="CharacterMainTab-action-body">
                    <span className="CharacterMainTab-caps-label CharacterMainTab-section-label">Passives</span>
                    <CombatActionList 
                        actions={characterPage.actions.filter(action => isPassive(action))}
                        experience_points={characterPage.experience_points}
                        baseArmorClass={characterPage.base_armor_class}
                        baseHitModifier={characterPage.base_hit_modifier}
                        baseDamageModifier={characterPage.base_damage_modifier}
                        baseDamageDice={characterPage.base_damage_dice}
                        baseDamageDiceType={characterPage.base_damage_dice_type}
                        baseHealingDiceType={characterPage.base_healing_dice_type}
                        canUseActions={false}
                        characterPage={characterPage}
                    />
                    <span className="CharacterMainTab-caps-label CharacterMainTab-section-label">Available Actions</span>
                    <CombatActionList 
                        actions={characterPage.actions.filter(action => action.actionCost <= characterPage.action_points).filter(action => !isPassive(action))}
                        experience_points={characterPage.experience_points}
                        baseArmorClass={characterPage.base_armor_class}
                        baseHitModifier={characterPage.base_hit_modifier}
                        baseDamageModifier={characterPage.base_damage_modifier}
                        baseDamageDice={characterPage.base_damage_dice}
                        baseDamageDiceType={characterPage.base_damage_dice_type}
                        baseHealingDiceType={characterPage.base_healing_dice_type}
                        canUseActions={true}
                        characterPage={characterPage}
                        userId={userId}
                    />
                    <span className="CharacterMainTab-caps-label CharacterMainTab-section-label">Unavailable — not enough Action Points</span>
                    <CombatActionList
                        actions={characterPage.actions.filter(action => action.actionCost > characterPage.action_points)}
                        experience_points={characterPage.experience_points}
                        baseArmorClass={characterPage.base_armor_class}
                        baseHitModifier={characterPage.base_hit_modifier}
                        baseDamageModifier={characterPage.base_damage_modifier}
                        baseDamageDice={characterPage.base_damage_dice}
                        baseDamageDiceType={characterPage.base_damage_dice_type}
                        baseHealingDiceType={characterPage.base_healing_dice_type}
                        locked={true}
                    />
                </div>
            </>
        },
        {
            tabName: "Inventory",
            icon: <BagIcon/>,
            content: <div className="CharacterMainTab-inventory">
                <div style={{ width: "50%" }}>
                    <PostListContentInventory 
                        inputStatuses={[["Relic 1", "Relic 2", "Relic 3", "Relic 4"], 
                                        ["1", "2", "3", "4"], 
                                        ["5", "6", "7", "8"]]}
                        characterId={characterPage.character_id}
                        className={{
                            postColumn: "CharacterMainTab-PostColumn-inventory",
                            postColumnHeader: "CharacterMainTab-PostColumn-header-inventory",
                            postColumnBody: "CharacterMainTab-PostColumn-body-inventory",
                            postCardTitle: "CharacterMainTab-PostCardTitle-inventory",
                            postCardContent: "CharacterMainTab-PostCardContent-inventory",
                            postCardBox: "CharacterMainTab-PostCardBox-inventory"
                        }}
                        campaignCharacterList={characterList || []}
                    />
                </div>
                <div style={{ width: "50%" }}>
                    <PostListContentInventoryPocket
                        inputStatuses={["Pocket"]}
                        characterId={characterPage.character_id}
                        className={{
                            postColumn: "CharacterMainTab-PostColumn-inventory-pocket",
                            postColumnHeader: "CharacterMainTab-PostColumn-header-inventory-pocket",
                            postColumnBody: "CharacterMainTab-PostColumn-body-inventory-pocket",
                            postCardTitle: "CharacterMainTab-PostCardTitle-inventory-pocket",
                            postCardContent: "CharacterMainTab-PostCardContent-inventory-pocket",
                            postCardBox: "CharacterMainTab-PostCardBox-inventory-pocket"
                        }}
                    />
                </div>
            </div>
        },
        {
            tabName: "Combat Map",
            icon: <MapIcon/>,
            content: !hasCampaign ? <div className="CharacterMainTab-no-campaign">
                <p>This character isn't part of a campaign yet.</p>
                <Link to="/campaigns" className="CharacterMainTab-no-campaign-link">Join or create a campaign</Link>
            </div> : <div className="CharacterMainTab-combat-map">
                <div className="CharacterMainTab-combat-map-header">
                    <button className="CharacterMainTab-open-map-button" onClick={() => setMapOverlayOpen(true)}>
                        <MapIcon/> Open Combat Map
                    </button>
                </div>
                <PostListContentCombat
                    inputStatuses={["Zone 0", "Zone 1", "Zone 2", "Zone 3", "Zone 4"]}
                    campaignId={characterPage.campaign}
                />
            </div>
        }
    ];

    return <>
        <TabContainer tabs={tabs}/>
        {mapOverlayOpen && <>
            <div className="CharacterMainTab-map-overlay-scrim" onClick={() => setMapOverlayOpen(false)}/>
            <div className="CharacterMainTab-map-overlay">
                <button className="CharacterMainTab-map-overlay-close" onClick={() => setMapOverlayOpen(false)} aria-label="Close">×</button>
                <PostListContentCombatMap
                    campaignId={characterPage.campaign}
                    activeMap={activeMap}
                    entities={combatEntities}
                    noActiveMapMessage="The director hasn't set an active combat map yet."
                />
            </div>
        </>}
    </>
}