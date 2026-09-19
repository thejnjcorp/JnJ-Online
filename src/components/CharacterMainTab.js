import { CombatActionList } from "./CombatActionList";
// import Collapsible from "react-collapsible";
import { Link } from "react-router-dom";
import MarkdownEditor from "./MarkdownEditor";
import circleIcon from '../icons/circle.svg';
import circleFilledIcon from '../icons/circle_filled.svg';
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
import { useIsMobile } from "../utils/useIsMobile";
import { getEffectiveCharacterStats, getGrantedActions } from "../utils/statusEffects";
import { getActionCategory } from "../utils/classActions";
import { filterActions, filterOptions, isFilterActive, sortActions } from "../utils/tags";
import { ActionViewControls } from "./ActionViewControls";
import { StatusChip } from "./StatusChip";
import { ActionUsesReset } from "./ActionUses";
import { isLimitedUse } from "../utils/actionUses";

function isPassive(action) {
    const category = getActionCategory(action);
    return category === 'passive' || category === 'feat';
}

export function CharacterMainTab({ characterPage, userId, characterList = [], campaignInfo = {} }) {
    const hasWritePermissions = userId ? (characterPage.userId === userId || characterPage.canWrite?.includes(userId)) : false;
    const isMobile = useIsMobile();
    // Status-adjusted AC/hit/damage for the combat math below (CombatActionList's
    // to-hit/DC previews), and any actions a status grants while active (e.g. an
    // "Identify" status adding a free Identify action) folded in alongside the
    // character's own class actions - see utils/statusEffects.js.
    const effectiveStats = getEffectiveCharacterStats(characterPage);
    const allActions = [...characterPage.actions, ...getGrantedActions(characterPage)];
    const statuses = characterPage.statuses || [];
    // How the Combat tab's lists are narrowed and ordered. A filter for something
    // the actions no longer have (a class change, say) is dropped rather than
    // silently hiding everything.
    const [combatFilter, setCombatFilter] = useState({ categories: [], tags: [] });
    const [combatSort, setCombatSort] = useState('default');
    const viewOptions = filterOptions(allActions);
    const activeFilter = {
        categories: combatFilter.categories.filter(key => viewOptions.categories.some(category => category.key === key)),
        tags: combatFilter.tags.filter(key => viewOptions.tags.some(tag => tag.key === key)),
    };
    const inView = list => sortActions(filterActions(list, activeFilter), combatSort);
    const passiveActions = inView(allActions.filter(action => isPassive(action)));
    const availableActions = inView(allActions.filter(action => action.actionCost <= characterPage.action_points).filter(action => !isPassive(action)));
    const unavailableActions = inView(allActions.filter(action => action.actionCost > characterPage.action_points));
    const noMatch = list => isFilterActive(activeFilter) && list.length === 0 && <p className="ActionViewControls-empty">No actions match.</p>;
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
            // Notes can be emptied out. A blank background isn't saved here - see
            // restoreLoreIfEmpty.
            if (value !== '' || name === 'notes') {
                updateDoc(doc(db, "characters", characterPage.character_id), {
                    [name]: parsedValue
                }).catch(e => {
                    alert(e);
                });
            }
        }, 1000);
    };

    // An emptied background isn't saved as you type - it would snap back to the
    // class's lore in the middle of rewriting it. Once you've left it empty, the
    // lore returns, and the character's own (now blank) background is cleared.
    function restoreLoreIfEmpty() {
        if (localValues.description !== '') return;
        clearTimeout(debounceRef.current.description);
        setLocalValues(prev => ({ ...prev, description: characterPage.class_description || '' }));
        if (characterPage.description) {
            updateDoc(doc(db, "characters", characterPage.character_id), { description: '' }).catch(e => {
                alert(e);
            });
        }
    }

    // Clicking the last filled circle spends it, which is how a character gets to
    // 0 (clicking circle 1 alone would only ever set 1).
    const clickCircle = n => setActionPoints(characterPage.action_points === n ? n - 1 : n);

    const actionUses = characterPage.action_uses || {};
    const setActionUses = next => updateDoc(doc(db, "characters", characterPage.character_id), { action_uses: next }).catch(e => alert(e));
    const limitedActions = allActions.filter(isLimitedUse);

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
                {/* Leaving it empty puts the class's lore back (see restoreLoreIfEmpty). Focus
                    moving to the toolbar doesn't count as leaving. */}
                <div onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) restoreLoreIfEmpty(); }}>
                    <MarkdownEditor
                        className="CharacterMainTab-background-editor"
                        label="Background"
                        placeholder="Who is this character? Leave it empty to use the class's lore."
                        value={localValues.description}
                        readOnly={!hasWritePermissions}
                        onChange={value => handleChange({ target: { name: 'description', type: 'text', value } })}
                    />
                </div>
            </div>
            <div className="CharacterMainTab-notes CharacterMainTab-roleplay-card CharacterMainTab-roleplay-card-notes">
                <div className="CharacterMainTab-roleplay-card-header">
                    <NoteIcon/>
                    <h2>Notes</h2>
                    <span className="CharacterMainTab-roleplay-card-caption">Autosaves as you type</span>
                </div>
                <MarkdownEditor
                    className="CharacterMainTab-notes-editor"
                    label="Notes"
                    placeholder="Start writing - it saves as you type."
                    value={localValues.notes}
                    readOnly={!hasWritePermissions}
                    onChange={value => handleChange({ target: { name: 'notes', type: 'text', value } })}
                />
            </div>
            </div>
        },
        {
            tabName: "Combat",
            icon: <SwordsIcon/>,
            contentClassName: "TabContainer-content-unclipped",
            content: <>
                
                <div className="CharacterMainTab-action-points">
                    <div className="CharacterMainTab-ap-row">
                        <span className="CharacterMainTab-caps-label">
                            <span className="CharacterMainTab-ap-full">Action Points</span>
                            <span className="CharacterMainTab-ap-short" aria-hidden="true">AP</span>
                        </span>{"\xa0\xa0"}
                        {/* Wrapped in a real <button> (rather than just an onClick on the
                            <img>) so mobile gets an actual 44x44 tap target - see
                            .CharacterMainTab-circle-button in CharacterMainTab.scss. */}
                        {[1, 2, 3, 4].map(n =>
                            <button
                                key={n}
                                type="button"
                                className="CharacterMainTab-circle-button"
                                disabled={!hasWritePermissions}
                                title={hasWritePermissions ? (characterPage.action_points === n ? `Spend this point (leaves ${n - 1})` : `Set to ${n}`) : undefined}
                                onClick={hasWritePermissions ? () => clickCircle(n) : undefined}
                            >
                                <img
                                    src={characterPage.action_points >= n ? circleFilledIcon : circleIcon}
                                    alt={characterPage.action_points >= n ? 'circleFilled' : 'circle'}
                                    className="CharacterMainTab-circle"
                                    width={30}
                                />
                            </button>
                        )}
                        <span className="CharacterMainTab-action-points-label">
                            {characterPage.action_points} / 4 available<span className="CharacterMainTab-ap-hint">{hasWritePermissions ? " · click a circle to spend" : ""}</span>
                        </span>
                    </div>
                    {/* Riding along with the action points, so the statuses in play stay in
                        view while the actions scroll (their details are on the vitals card). */}
                    {statuses.length > 0 && <div className="CharacterMainTab-status-strip" role="group" aria-label="Active statuses">
                        {statuses.map(status => <StatusChip key={status.id} status={status}/>)}
                    </div>}
                </div>
                <div className="CharacterMainTab-action-body">
                    {hasWritePermissions && limitedActions.length > 0 && <ActionUsesReset actions={limitedActions} uses={actionUses} onChange={setActionUses}/>}
                    <ActionViewControls actions={allActions} filter={activeFilter} onFilter={setCombatFilter} sort={combatSort} onSort={setCombatSort}/>
                    <span className="CharacterMainTab-caps-label CharacterMainTab-section-label">Passives</span>
                    {noMatch(passiveActions)}
                    <CombatActionList
                        actions={passiveActions}
                        experience_points={characterPage.experience_points}
                        baseArmorClass={effectiveStats.base_armor_class}
                        baseHitModifier={effectiveStats.base_hit_modifier}
                        baseDamageModifier={effectiveStats.base_damage_modifier}
                        baseDamageDice={characterPage.base_damage_dice}
                        baseDamageDiceType={characterPage.base_damage_dice_type}
                        baseHealingDiceType={characterPage.base_healing_dice_type}
                        canUseActions={false}
                        characterPage={characterPage}
                        userId={userId}
                        actionUses={actionUses}
                        onActionUsesChange={setActionUses}
                    />
                    <span className="CharacterMainTab-caps-label CharacterMainTab-section-label">Available Actions</span>
                    {noMatch(availableActions)}
                    <CombatActionList
                        actions={availableActions}
                        experience_points={characterPage.experience_points}
                        baseArmorClass={effectiveStats.base_armor_class}
                        baseHitModifier={effectiveStats.base_hit_modifier}
                        baseDamageModifier={effectiveStats.base_damage_modifier}
                        baseDamageDice={characterPage.base_damage_dice}
                        baseDamageDiceType={characterPage.base_damage_dice_type}
                        baseHealingDiceType={characterPage.base_healing_dice_type}
                        canUseActions={true}
                        characterPage={characterPage}
                        userId={userId}
                        actionUses={actionUses}
                        onActionUsesChange={setActionUses}
                    />
                    <span className="CharacterMainTab-caps-label CharacterMainTab-section-label">Unavailable — not enough Action Points</span>
                    {noMatch(unavailableActions)}
                    <CombatActionList
                        actions={unavailableActions}
                        experience_points={characterPage.experience_points}
                        baseArmorClass={effectiveStats.base_armor_class}
                        baseHitModifier={effectiveStats.base_hit_modifier}
                        baseDamageModifier={effectiveStats.base_damage_modifier}
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
            // Mobile drops the side-by-side DnD columns for three stacked
            // sections (Relics as a 2x2 grid, Backpack as a vertical list of
            // slots, Pocket as its own card) - see design/character-page-v2
            // section 11. Drag-and-drop is preserved by reusing the exact
            // same PostListContentInventory/Pocket + @hello-pangea/dnd
            // machinery as desktop, just with a different inputStatuses
            // shape (which rows/columns of slots get rendered) and
            // className overrides (which also hide each card's content,
            // matching the mockup's title-only slot cards - full item
            // descriptions stay a desktop-only affordance for now).
            content: isMobile
                ? <div className="CharacterMainTab-inventory-mobile">
                    <span className="CharacterMainTab-caps-label CharacterMainTab-section-label">Relics</span>
                    <PostListContentInventory
                        inputStatuses={[["Relic 1", "Relic 2"], ["Relic 3", "Relic 4"]]}
                        characterId={characterPage.character_id}
                        className={{
                            postColumn: "CharacterMainTab-PostColumn-inventory-mobile-relic",
                            postColumnHeader: "CharacterMainTab-PostColumn-header-inventory-mobile",
                            postColumnBody: "CharacterMainTab-PostColumn-body-inventory-mobile-relic",
                            postCardTitle: "CharacterMainTab-PostCardTitle-inventory-mobile",
                            postCardContent: "CharacterMainTab-PostCardContent-inventory-mobile",
                            postCardBox: "CharacterMainTab-PostCardBox-inventory-mobile"
                        }}
                        campaignCharacterList={characterList || []}
                    />
                    <span className="CharacterMainTab-caps-label CharacterMainTab-section-label">Backpack</span>
                    <PostListContentInventory
                        inputStatuses={[["1"], ["2"], ["3"], ["4"], ["5"], ["6"], ["7"], ["8"]]}
                        characterId={characterPage.character_id}
                        className={{
                            postColumn: "CharacterMainTab-PostColumn-inventory-mobile-backpack",
                            postColumnHeader: "CharacterMainTab-PostColumn-header-inventory-mobile",
                            postColumnBody: "CharacterMainTab-PostColumn-body-inventory-mobile-backpack",
                            postCardTitle: "CharacterMainTab-PostCardTitle-inventory-mobile",
                            postCardContent: "CharacterMainTab-PostCardContent-inventory-mobile",
                            postCardBox: "CharacterMainTab-PostCardBox-inventory-mobile"
                        }}
                        campaignCharacterList={characterList || []}
                    />
                    <span className="CharacterMainTab-caps-label CharacterMainTab-section-label">Pocket</span>
                    <PostListContentInventoryPocket
                        inputStatuses={["Pocket"]}
                        characterId={characterPage.character_id}
                        className={{
                            postColumn: "CharacterMainTab-PostColumn-inventory-pocket-mobile",
                            postColumnHeader: "CharacterMainTab-PostColumn-header-inventory-mobile",
                            postColumnBody: "CharacterMainTab-PostColumn-body-inventory-pocket-mobile",
                            postCardTitle: "CharacterMainTab-PostCardTitle-inventory-mobile",
                            postCardContent: "CharacterMainTab-PostCardContent-inventory-mobile",
                            postCardBox: "CharacterMainTab-PostCardBox-inventory-mobile"
                        }}
                    />
                </div>
                : <div className="CharacterMainTab-inventory">
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
                    <button type="button" className="CharacterMainTab-open-map-button" onClick={() => setMapOverlayOpen(true)}>
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
            <button
                type="button"
                className="CharacterMainTab-map-overlay-scrim"
                aria-label="Close"
                onClick={() => setMapOverlayOpen(false)}
            />
            <div className="CharacterMainTab-map-overlay">
                <button type="button" className="CharacterMainTab-map-overlay-close" onClick={() => setMapOverlayOpen(false)} aria-label="Close">×</button>
                <PostListContentCombatMap
                    campaignId={characterPage.campaign}
                    activeMap={activeMap}
                    entities={combatEntities}
                    userId={userId}
                    noActiveMapMessage="The director hasn't set an active combat map yet."
                />
            </div>
        </>}
    </>
}