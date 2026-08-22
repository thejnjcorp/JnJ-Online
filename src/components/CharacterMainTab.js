import { CombatActionList } from "./CombatActionList";
// import Collapsible from "react-collapsible";
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

// .CharacterPage is capped at 90vh (see CharacterPage.scss), and everything
// above the Combat Map tab eats into that budget before the map ever gets a
// chance at it. These mirror the actual fixed-px values from CharacterPage.scss
// (not vh-relative, so they don't scale with viewport height the way 90vh
// does - subtracting them out is what makes this work across screen sizes,
// rather than a flat px offset tuned to one screen).
const CHARACTER_PAGE_NAV_HEIGHT = 100; // .CharacterPage-navigation { height: 100px }
const ABILITY_STATS_ROW_HEIGHT = 190 + 2 * 10; // .CharacterPage-abiltyscore-horzontal/.CharacterPage-stats { height: 190px; margin: 10px }
const TAB_CONTAINER_MARGIN = 2 * 10; // .TabContainer { margin: 10px }
// Not given an explicit height in TabContainer.scss (sized intrinsically from
// its 24px-font buttons), plus a little slack for anything else unaccounted
// for here.
const TAB_BUTTON_ROW_AND_SLACK = 65;
const COMBAT_MAP_HEIGHT_OFFSET =
    `${CHARACTER_PAGE_NAV_HEIGHT + ABILITY_STATS_ROW_HEIGHT + TAB_CONTAINER_MARGIN + TAB_BUTTON_ROW_AND_SLACK}px`;

export function CharacterMainTab({ characterPage, userId, characterList = [], campaignInfo = {} }) {
    const hasWritePermissions = userId ? (characterPage.userId === userId || characterPage.canWrite.includes(userId)) : false;
    const { activeMap } = useCampaignMaps(campaignInfo);
    const combatEntities = useCombatEntities(characterList, campaignInfo);
    const combatView = characterPage.combat_view ?? "line";

    function setCombatView(view) {
        try {
            updateDoc(doc(db, "characters", characterPage.character_id), {
                combat_view: view
            });
        } catch (e) {
            alert(e);
        }
    }
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
            tabName: "Roleplay Mode",
            content: <>
            <div className="CharacterMainTab-background">
                <h2>Background:</h2>
                <TextareaAutosize
                    className="CharacterMainTab-background-description"
                    minRows={3}
                    value={localValues.description}
                    name="description"
                    disabled={!hasWritePermissions}
                    onChange={handleChange}
                />
            </div>
            <div className="CharacterMainTab-notes">
                <h2>Notes:</h2>
                <TextareaAutosize
                    className="CharacterMainTab-notes-description"
                    minRows={3}
                    value={localValues.notes}
                    name="notes"
                    disabled={!hasWritePermissions}
                    onChange={handleChange}
                />
            </div>
            </>
        },
        {
            tabName: "Combat Mode",
            content: <>
                
                <div className="CharacterMainTab-action-points">
                    Action Points:{"\xa0\xa0\xa0"}
                    {characterPage.action_points > 0 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(1) : undefined}/> :
                    <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(1) : undefined}/>}
                    {characterPage.action_points > 1 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(2) : undefined}/> :
                    <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(2) : undefined}/>}
                    {characterPage.action_points > 2 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(3) : undefined}/> :
                    <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(3) : undefined}/>}
                    {characterPage.action_points > 3 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(4) : undefined}/> :
                    <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(4) : undefined}/>}
                </div>
                <div className="CharacterMainTab-action-body">
                    <span className="CharacterMainTab-header-left-align">Passives:</span>
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
                    <span className="CharacterMainTab-header-left-align">Available Actions:</span>
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
                    <span className="CharacterMainTab-header-left-align">Unavailable Actions:</span>
                    <CombatActionList 
                        actions={characterPage.actions.filter(action => action.actionCost > characterPage.action_points)}
                        experience_points={characterPage.experience_points}
                        baseArmorClass={characterPage.base_armor_class}
                        baseHitModifier={characterPage.base_hit_modifier}
                        baseDamageModifier={characterPage.base_damage_modifier}
                        baseDamageDice={characterPage.base_damage_dice}
                        baseDamageDiceType={characterPage.base_damage_dice_type}
                        baseHealingDiceType={characterPage.base_healing_dice_type}
                    />
                </div>
            </>
        },
        {
            tabName: "Inventory",
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
            // Only .TabContainer-content needs an explicit height here - see the
            // comment in TabContainer.js on why .TabContainer itself doesn't.
            contentHeight: combatView === "map" ? `calc(90vh - ${COMBAT_MAP_HEIGHT_OFFSET})` : undefined,
            content: <div className="CharacterMainTab-combat-map">
                <div className="CharacterMainTab-view-toggle">
                    <button
                        className={combatView === "line" ? "CharacterMainTab-view-toggle-active" : ""}
                        disabled={!hasWritePermissions || combatView === "line"}
                        onClick={() => setCombatView("line")}
                    >
                        Line View
                    </button>
                    <button
                        className={combatView === "map" ? "CharacterMainTab-view-toggle-active" : ""}
                        disabled={!hasWritePermissions || combatView === "map"}
                        onClick={() => setCombatView("map")}
                    >
                        Map View
                    </button>
                </div>
                {combatView === "map" ? <PostListContentCombatMap
                    campaignId={characterPage.campaign}
                    activeMap={activeMap}
                    entities={combatEntities}
                    noActiveMapMessage="The director hasn't set an active combat map yet."
                /> : <PostListContentCombat
                    inputStatuses={["Zone 0", "Zone 1", "Zone 2", "Zone 3", "Zone 4"]}
                    campaignId={characterPage.campaign}
                />}
            </div>
        }
    ];

    return <TabContainer tabs={tabs}/>
}