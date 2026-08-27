import { useEffect, useMemo, useState } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import '../styles/CharacterPageStyles/DefaultCharacterPage.scss';
import '../styles/DirectorsPage.scss';
import '../styles/CharacterMainTab.scss';
import '../styles/CharacterPage.scss';
import { useLocation } from 'react-router-dom';
import { db, auth } from '../utils/firebase';
import { doc, query, collection, where, onSnapshot, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { SkillsAndFlaws } from './SkillsAndFlaws';
import Collapsible from 'react-collapsible';
import characterPageLayout from '../CharacterPageLayout.json';
import npcLayout from '../NPCLayout.json';
import { TabContainer } from './TabContainer';
import { CombatActionList } from './CombatActionList';
import { Statuses } from './Statuses';
import { uploadImageToImgur } from '../utils/imgurUploader';
import { onAuthStateChanged } from 'firebase/auth';
import circleIcon from '../icons/circle.svg';
import circleFilledIcon from '../icons/circle_filled.svg';
import shieldIcon from '../icons/shield.svg';
import { ReactComponent as PersonIcon } from '../icons/person.svg';
import { ReactComponent as ScrollIcon } from '../icons/scroll.svg';
import { ReactComponent as SwordsIcon } from '../icons/swords.svg';
import { ReactComponent as MapIcon } from '../icons/map.svg';
import { ReactComponent as ChevronDownIcon } from '../icons/chevron_down.svg';
import { PostListContentCombatMap } from '../utils/DraggableElements/PostListCombatMap.tsx';
import { PostListContentCombat } from '../utils/DraggableElements/PostListCombat.tsx';
import { MapRenderer } from './MapRenderer';
import { useCampaignMaps, useCombatEntities } from '../utils/useCampaignCombat';
import { advanceTurnStatuses, getEffectiveCharacterStats, getGrantedActions } from '../utils/statusEffects';
import { CharacterStatCalculator } from './CharacterStatCalculator';

// Matches the mockup's .zone-card/.zone-title/.entity-chip recipe (see
// design/directors-page/handoff/reference.html) rather than the generic
// PostDefaults.scss fallback classes - those were tuned for a much plainer
// context and read as unstyled next to the rest of this redesigned page.
const lineViewClassName = {
    postColumnBody: 'DirectorsPage-zone-card',
    postColumn: 'DirectorsPage-zone-chips',
    postColumnHeader: 'DirectorsPage-zone-title',
    postCardBox: 'DirectorsPage-entity-chip',
    postCardTitle: 'DirectorsPage-entity-chip-title',
    postCardContent: 'DirectorsPage-entity-chip-content',
};

// A custom PostCard for Line View zone chips:
// - a hover tooltip (native title attribute) with the full name, since the
//   whole point of the chip is to fit in a zone too narrow to always show it
// - a player's portrait (falls back to a person icon) next to their name,
//   so they're still recognizable once the name itself is ellipsis-truncated
// - a player's chosen navigation_color (see CharacterPageNavigationColorPickerButton.js)
//   tints the chip so players are distinguishable from each other at a glance,
//   not just by (truncated) name
// Enemies have neither a portrait_url nor a navigation_color, so they keep
// the plain accent-colored name-only card. Built as a factory (called via
// useMemo below, keyed on characterList) rather than a module-level constant
// like lineViewClassName, since it needs to close over the live per-player info.
function makeLineViewCard(playerInfoById) {
    return function LineViewEntityCard({ post, index, titleClassName, boxClassName }) {
        const info = playerInfoById[post.id];
        const chipStyle = info?.color ? { borderColor: info.color, background: info.color + '22' } : undefined;
        // The tooltip should only appear when the name is actually cut off -
        // showing it over an already-fully-visible name is just noise (and
        // in a narrow zone, covers up real content like the zone label).
        // Truncation depends on the title's rendered width vs. its content
        // width, which only exists after layout - a ResizeObserver (same
        // technique PostListContentAbstract.tsx uses for the map image)
        // re-checks it whenever the chip's actual size changes, including
        // from a column collapse/expand that doesn't re-render this
        // component at all.
        const [titleEl, setTitleEl] = useState(null);
        const [isTruncated, setIsTruncated] = useState(false);
        useEffect(() => {
            if (!titleEl) return;
            const checkTruncation = () => setIsTruncated(titleEl.scrollWidth > titleEl.clientWidth);
            checkTruncation();
            const observer = new ResizeObserver(checkTruncation);
            observer.observe(titleEl);
            return () => observer.disconnect();
        }, [titleEl]);

        return <Draggable draggableId={String(post.id)} index={index}>
            {(provided, snapshot) => (
                <div style={{ marginBottom: "1px" }} {...provided.dragHandleProps} {...provided.draggableProps} ref={provided.innerRef}>
                    <div
                        className={snapshot.isDragging ? `${boxClassName} isDragging` : boxClassName}
                        style={chipStyle}
                        data-tooltip-id={isTruncated ? "DirectorsPage-line-view-tooltip" : undefined}
                        data-tooltip-content={isTruncated ? post.title : undefined}
                    >
                        {info ? <div className="DirectorsPage-entity-chip-inner">
                            {info.portraitUrl
                                ? <img src={info.portraitUrl} alt="" className="DirectorsPage-entity-chip-portrait" style={info.color ? {borderColor: info.color} : undefined}/>
                                : <PersonIcon className="DirectorsPage-entity-chip-portrait-placeholder" style={info.color ? {borderColor: info.color, color: info.color} : undefined}/>}
                            <div className={titleClassName} ref={setTitleEl}>{post.title}</div>
                        </div> : <div className={titleClassName} ref={setTitleEl}>{post.title}</div>}
                    </div>
                </div>
            )}
        </Draggable>;
    };
}

// The shared vitals/status/actions card for both a player and an enemy - see
// design/directors-page/handoff/DIRECTORS_PAGE_HANDOFF.md point 2 (matching
// CharacterPageVitalsPanel's visual language, scaled down) and point 3a
// (collapsible, name+HP always visible). Every write (AP, statuses, use
// action) is handled by the caller via callbacks so this component doesn't
// need to know whether it's looking at a real `characters` doc or an NPC
// object embedded in the campaign doc.
function DirectorsEntityCard({
    kind, name, subtitle, hpNow, hpMax, tempHp, ac, ap, onSetAp,
    canAdvanceTurn, onNextTurn, weaknesses, resistances,
    statusEntity, onUpdateStatuses, hasStatusWrite, userId,
    actions, experiencePoints, baseHitModifier, baseDamageModifier,
    baseDamageDice, baseDamageDiceType, baseHealingDiceType,
    canUseActions, onUseAction,
}) {
    const [open, setOpen] = useState(true);
    const [actionsOpen, setActionsOpen] = useState(false);
    const hpPercent = hpMax > 0 ? Math.max(0, Math.min(100, (hpNow / hpMax) * 100)) : 0;
    const hasTempHp = tempHp > 0;
    const hasWeakRes = kind === 'enemy' && ((weaknesses?.length || 0) + (resistances?.length || 0) > 0);

    return <div className={`DirectorsPage-entity-card DirectorsPage-entity-card-${kind}`}>
        <button type="button" className="DirectorsPage-entity-header" onClick={() => setOpen(o => !o)}>
            <ChevronDownIcon className={open ? "DirectorsPage-chevron DirectorsPage-chevron-open" : "DirectorsPage-chevron"}/>
            <span className="DirectorsPage-entity-name">{name}</span>
            {subtitle && <span className="DirectorsPage-entity-subtitle">{subtitle}</span>}
            <span className="DirectorsPage-entity-hp-label">{hpNow}/{hpMax} HP</span>
        </button>
        {open && <div className="DirectorsPage-entity-body">
            <div className="DirectorsPage-vitals-strip">
                <div className="DirectorsPage-hp-track-wrap">
                    <div className="DirectorsPage-hp-track">
                        <div className={`DirectorsPage-hp-fill DirectorsPage-hp-fill-${kind}`} style={{width: hpPercent + '%'}}/>
                    </div>
                    {hasTempHp && <div className="DirectorsPage-temp-hp-label">+{tempHp} temp</div>}
                </div>
                <div className={`DirectorsPage-ac-shield DirectorsPage-ac-shield-${kind}`}>
                    <img src={shieldIcon} className="DirectorsPage-ac-shield-icon" alt=""/>
                    <span className="DirectorsPage-ac-value">{ac}</span>
                </div>
                <div className={`DirectorsPage-ap-circles DirectorsPage-ap-circles-${kind}`}>
                    {[1, 2, 3, 4].map(n =>
                        <button type="button" key={n} disabled={!onSetAp} onClick={() => onSetAp?.(n)}>
                            <img src={ap >= n ? circleFilledIcon : circleIcon} alt="" width={15}/>
                        </button>
                    )}
                </div>
                {canAdvanceTurn && <button type="button" className={`DirectorsPage-next-turn-button DirectorsPage-next-turn-button-${kind}`} onClick={onNextTurn}>Next Turn</button>}
            </div>

            {hasWeakRes && <div className="DirectorsPage-weakres-row">
                {weaknesses.map((w, i) => <span className="DirectorsPage-weak-chip" key={"w" + i}>{w}</span>)}
                {resistances.map((r, i) => <span className="DirectorsPage-res-chip" key={"r" + i}>{r}</span>)}
            </div>}

            <Statuses characterPage={statusEntity} userId={userId} onUpdateStatuses={onUpdateStatuses} hasWritePermissions={hasStatusWrite}/>

            <div>
                <button type="button" className="DirectorsPage-actions-toggle" onClick={() => setActionsOpen(a => !a)}>
                    <ChevronDownIcon className={actionsOpen ? "DirectorsPage-chevron-sm DirectorsPage-chevron-open" : "DirectorsPage-chevron-sm"}/>
                    Actions
                </button>
                {actionsOpen && <CombatActionList
                    actions={actions}
                    experience_points={experiencePoints}
                    baseArmorClass={ac}
                    baseHitModifier={baseHitModifier}
                    baseDamageModifier={baseDamageModifier}
                    baseDamageDice={baseDamageDice}
                    baseDamageDiceType={baseDamageDiceType}
                    baseHealingDiceType={baseHealingDiceType}
                    canUseActions={canUseActions}
                    characterPage={statusEntity}
                    userId={userId}
                    onUseAction={onUseAction}
                    hasWritePermissions={hasStatusWrite}
                />}
            </div>
        </div>}
    </div>;
}

export function DirectorsPage() {
    const location = useLocation();
    const campaignId = location.pathname.split("/").at(2);
    const pageTheme = 'DefaultCharacterPage';
    const [isLoaded, setIsLoaded] = useState(false);
    const [userId, setUserId] = useState("");
    const [trackerMode, setTrackerMode] = useState('line');
    const [mapOverlayOpen, setMapOverlayOpen] = useState(false);
    // Collapsing the Player Characters / Enemies columns hands their share
    // of the 1.3fr/1fr/1.3fr grid back to the Combat Tracker column - useful
    // when a wide map or a Line View with several zones needs more room than
    // a fixed three-way split leaves it.
    const [playersCollapsed, setPlayersCollapsed] = useState(false);
    const [enemiesCollapsed, setEnemiesCollapsed] = useState(false);
    const combatGridTemplateColumns = `${playersCollapsed ? '56px' : '1.3fr'} 1fr ${enemiesCollapsed ? '56px' : '1.3fr'}`;
    const [campaignInfo, setCampaignInfo] = useState({
        "campaign_name":"placeholder",
        "director_name":"placeholder",
        "enemy_list":[],
        "ally_combat_npc_list":[],
        "neutral_combat_npc_list":[],
        "combat_tracker": [],
        "active_map": null,
        "maps": [],
    });
    const [characterList, setCharacterList] = useState([]);
    // A stable reference (not a fresh doc()/query() call on every render) so
    // the effects below only re-subscribe when campaignId actually changes -
    // calling onSnapshot directly in the render body (the previous version
    // of this component) re-registers a brand new Firestore listener on
    // every single render, including the ones those listeners themselves
    // trigger, which snowballs into a render storm that starves out other
    // state updates (e.g. a card's own collapse/expand click) - see
    // CharacterPage.js for the same useMemo+useEffect+cleanup pattern.
    const campaignDoc = useMemo(() => doc(db, "campaigns", campaignId), [campaignId]);
    const charactersQuery = useMemo(() => query(collection(db, "characters"), where("campaign", "==", campaignId)), [campaignId]);

    useEffect(() => {
        const unsubscribe = onSnapshot(campaignDoc, { includeMetadataChanges: true }, (docSnap) => {
            if (docSnap.metadata.hasPendingWrites || !isLoaded) {
                setCampaignInfo(prevData => ({
                    ...prevData,
                    ...docSnap.data()
                }));
                setIsLoaded(true);
            }
        });
        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [campaignDoc]);

    useEffect(() => {
        const unsubscribe = onSnapshot(charactersQuery, { includeMetadataChanges: true }, (querySnapshot) => {
            if (querySnapshot.metadata.hasPendingWrites || !isLoaded) {
                setCharacterList(querySnapshot.docs.map(doc => ({character_id: doc.id, ...doc.data()})));
            }
        });
        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [charactersQuery]);

    const uploadNewMapToCampaign = async (mapFile) => {
        if (!mapFile) {
            alert("Please select an image to upload.");
            return;
        }
        try {
            const imageLink = await uploadImageToImgur(mapFile);
            const docRef = await addDoc(collection(db, "maps"), {
                canWrite: [userId],
                link: imageLink,
                zones: [],
            });
            console.log("Map uploaded successfully:", docRef.id);
            await updateDoc(campaignDoc, {
                maps: [...campaignInfo.maps, docRef.id]
            });
            alert("Map added to campaign successfully!");
        } catch (error) {
            console.error("Error uploading map:", error);
            alert("Failed to upload map. Please try again.");
        }
    }

    const [mapFile, setMapFile] = useState();
    const onMapFileChange = (event) => {
        setMapFile(event.target.files[0]);
    };

    const deleteMap = async (map) => {
        if (!window.confirm("Delete this map? This cannot be undone.")) return;
        try {
            await updateDoc(campaignDoc, {
                maps: campaignInfo.maps.filter((mapId) => mapId !== map.map_id),
                ...(campaignInfo.active_map === map.map_id ? { active_map: null } : {})
            });
            await deleteDoc(doc(db, "maps", map.map_id));
        } catch (error) {
            console.error("Error deleting map:", error);
            alert("Failed to delete map: " + error.message);
        }
    };

    const { maps, activeMap } = useCampaignMaps(campaignInfo);
    const combatEntities = useCombatEntities(characterList, campaignInfo);
    const zoneNames = activeMap?.zones?.map((zone) => zone.name) || [];
    // characterList gets a brand new array (and object) reference on every
    // Firestore snapshot echo, even ones that don't actually change any
    // character's data - keying the memo on that directly would rebuild
    // lineViewCard (a new function = a new component type as far as React's
    // reconciliation is concerned) on every echo, forcing every chip using
    // it to fully remount and lose the local truncation-detection state
    // below (see makeLineViewCard's ResizeObserver). This derives a plain
    // string that only changes when a character's id/portrait/color
    // actually does, so the memo - and each chip's remount-sensitive state
    // - stays stable across unrelated echoes.
    const playerInfoKey = characterList.map(c => `${c.character_id}:${c.portrait_url || ''}:${c.navigation_color || ''}`).join('|');
    const lineViewCard = useMemo(() => {
        const playerInfoById = {};
        characterList.forEach(character => {
            playerInfoById["character:" + character.character_id] = {
                portraitUrl: character.portrait_url,
                color: character.navigation_color,
            };
        });
        return makeLineViewCard(playerInfoById);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playerInfoKey]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) return;
            setUserId(user.uid);
            unsubscribe();
        });
    }, [location]);

    // Enemies are NPC objects embedded in campaignInfo.enemy_list, not
    // `characters` collection docs - every enemy write goes through this one
    // whole-array update on the campaign doc instead of updateDoc(doc(db,
    // "characters", ...)), which is what Statuses.js/CombatActionList.js's
    // default write paths assume. See DIRECTORS_PAGE_HANDOFF.md's "Statuses
    // on enemies - plumbing gap" section.
    function updateEnemy(enemyId, patch) {
        return updateDoc(campaignDoc, {
            enemy_list: campaignInfo.enemy_list.map(e => e.id === enemyId ? { ...e, ...patch } : e)
        });
    }

    return <div className="DirectorsPage">
        <div className={'DirectorsPage-sidebar ' + pageTheme}>
            {characterList.map((character) => {
                const actualCharacter = { ...characterPageLayout, ...character }
                return <Collapsible
                    key={character.character_id}
                    trigger={<>
                        <PersonIcon className="DirectorsPage-sidebar-char-icon"/>
                        <span className="DirectorsPage-sidebar-char-name">{character.character_name}</span>
                        <ChevronDownIcon className="DirectorsPage-chevron DirectorsPage-chevron-open DirectorsPage-sidebar-char-chevron"/>
                    </>}
                    className="DirectorsPage-sidebar-char"
                    openedClassName="DirectorsPage-sidebar-char DirectorsPage-sidebar-char-open"
                    contentInnerClassName='DirectorsPage-sidebar-char-inner'
                    triggerClassName='DirectorsPage-sidebar-char-trigger'
                    triggerOpenedClassName='DirectorsPage-sidebar-char-trigger'
                    transitionTime={100}
                    open={true}
                >
                    <SkillsAndFlaws isOpen={true} characterPage={actualCharacter}/>
                </Collapsible>
            })}
        </div>
        <div className='DirectorsPage-MainBody'>
            <TabContainer container_height={"90vh"} content_height={"90vh"} tabs={[
                {tabName: "Roleplay", icon: <ScrollIcon/>, content: <>
                    hi
                </>},
                {tabName: "Combat", icon: <SwordsIcon/>, content: <div className='DirectorsPage-combat-grid' style={{gridTemplateColumns: combatGridTemplateColumns}}>
                    <div className={playersCollapsed ? 'DirectorsPage-panel DirectorsPage-panel-collapsed' : 'DirectorsPage-panel'}>
                        <div className="DirectorsPage-panel-title">
                            <PersonIcon className="DirectorsPage-panel-title-icon"/>
                            {!playersCollapsed && <span className="DirectorsPage-panel-title-name">Player Characters</span>}
                            <button type="button"
                                className="DirectorsPage-panel-collapse-button"
                                onClick={() => setPlayersCollapsed(c => !c)}
                                aria-label={playersCollapsed ? "Expand Player Characters" : "Collapse Player Characters"}
                            >
                                <ChevronDownIcon className={playersCollapsed ? "DirectorsPage-chevron" : "DirectorsPage-chevron DirectorsPage-chevron-open"}/>
                            </button>
                        </div>
                        {!playersCollapsed && characterList.map((character) => {
                            const actualCharacter = { ...characterPageLayout, ...character }
                            // NOTE: gated the same way the pre-existing AP star buttons are
                            // - firestore.rules only grants a character's owner/canWrite
                            // list write access, not the campaign's director_uid, so a
                            // director who isn't also on a player's canWrite list can't
                            // spend their AP OR advance their turn yet (same limitation
                            // both controls already had; not changed here since granting
                            // directors write access to every player's character doc is a
                            // real security-rules decision, not a UI one).
                            const hasWritePermissions = userId ? (actualCharacter.userId === userId || actualCharacter.canWrite?.includes(userId)) : false;
                            function setActionPoints(actionPoints) {
                                try {
                                    updateDoc(doc(db, "characters", actualCharacter.character_id), {
                                        action_points: actionPoints
                                    });
                                } catch (e) {
                                    alert(e);
                                }
                            }
                            // The only turn-based automation this pass wires up: statuses
                            // with a turn_start effect (currently just action_points, e.g.
                            // Haste +1 / Slowed -1 - see statusEffects.js) apply once, then
                            // lose a stack; anything else (a passive condition like
                            // Exhaustion, or a purely descriptive one like Wounded) passes
                            // through untouched. Everything else about turn order is still
                            // the GM calling it verbally, per the ruleset - this just saves
                            // the manual math for the handful of statuses that have any.
                            function advanceTurn() {
                                try {
                                    updateDoc(doc(db, "characters", actualCharacter.character_id), advanceTurnStatuses(actualCharacter));
                                } catch (e) {
                                    alert(e);
                                }
                            }
                            const effectiveCharacter = getEffectiveCharacterStats(actualCharacter);
                            const grantedActions = getGrantedActions(actualCharacter);
                            const armorClass = CharacterStatCalculator(
                                actualCharacter.experience_points,
                                effectiveCharacter.base_armor_class,
                                effectiveCharacter.base_hit_modifier,
                                effectiveCharacter.base_damage_modifier,
                                actualCharacter.base_damage_dice,
                                actualCharacter.base_damage_dice_type,
                                actualCharacter.base_healing_dice_type
                            ).ArmorClass;
                            return <DirectorsEntityCard
                                key={character.character_id}
                                kind="player"
                                name={character.character_name}
                                subtitle={actualCharacter.class_name || actualCharacter.class}
                                hpNow={actualCharacter.current_health}
                                hpMax={actualCharacter.maximum_health}
                                tempHp={actualCharacter.temporary_health}
                                ac={armorClass}
                                ap={actualCharacter.action_points}
                                onSetAp={hasWritePermissions ? setActionPoints : undefined}
                                canAdvanceTurn={hasWritePermissions}
                                onNextTurn={advanceTurn}
                                statusEntity={actualCharacter}
                                userId={userId}
                                hasStatusWrite={hasWritePermissions}
                                actions={[...actualCharacter.actions, ...grantedActions]}
                                experiencePoints={actualCharacter.experience_points}
                                baseHitModifier={effectiveCharacter.base_hit_modifier}
                                baseDamageModifier={effectiveCharacter.base_damage_modifier}
                                baseDamageDice={actualCharacter.base_damage_dice}
                                baseDamageDiceType={actualCharacter.base_damage_dice_type}
                                baseHealingDiceType={actualCharacter.base_healing_dice_type}
                                canUseActions={true}
                            />
                        })}
                    </div>
                    <div className='DirectorsPage-panel DirectorsPage-panel-tracker'>
                        <div className="DirectorsPage-panel-title">
                            <MapIcon className="DirectorsPage-panel-title-icon"/>
                            <span className="DirectorsPage-panel-title-name">Combat Tracker</span>
                        </div>
                        <div className="DirectorsPage-tracker-mode-row-wrap">
                            <div className="DirectorsPage-tracker-mode-row">
                                <button type="button"
                                    className={trackerMode === 'line' ? "DirectorsPage-mode-btn DirectorsPage-mode-btn-active" : "DirectorsPage-mode-btn"}
                                    onClick={() => setTrackerMode('line')}
                                >Line View</button>
                                <button type="button"
                                    className={trackerMode === 'map' ? "DirectorsPage-mode-btn DirectorsPage-mode-btn-active" : "DirectorsPage-mode-btn"}
                                    onClick={() => setTrackerMode('map')}
                                >Map View</button>
                            </div>
                            {trackerMode === 'map' && <button type="button"
                                className="DirectorsPage-tracker-expand-button"
                                onClick={() => setMapOverlayOpen(true)}
                            >
                                <MapIcon/> Open Full Map
                            </button>}
                        </div>
                        {/* Both views stay mounted at once (toggled via CSS, not
                            unmounted) since PostListContentCombatMap owns the
                            effect that syncs combat_tracker with who's actually in
                            the fight - if Map View were never mounted, a Director
                            who only ever used Line View would never see new
                            combatants show up. */}
                        <div className={trackerMode === 'line' ? "DirectorsPage-tracker-view" : "DirectorsPage-tracker-view DirectorsPage-tracker-view-hidden"}>
                            <PostListContentCombat
                                key={activeMap?.map_id || "no-active-map"}
                                campaignId={campaignId}
                                inputStatuses={zoneNames}
                                className={lineViewClassName}
                                PostCardComponent={lineViewCard}
                            />
                            {zoneNames.length === 0 && <div className="DirectorsPage-tracker-empty">No active map selected. Set one from the Maps tab.</div>}
                            {/* One shared Tooltip, matched by data-tooltip-id on every
                                chip (see makeLineViewCard) - react-tooltip reads each
                                chip's own data-tooltip-content, so a single mount here
                                covers all of them regardless of how many render. */}
                            <Tooltip id="DirectorsPage-line-view-tooltip" place="top"/>
                        </div>
                        <div className={trackerMode === 'map' ? "DirectorsPage-tracker-view DirectorsPage-tracker-view-map" : "DirectorsPage-tracker-view DirectorsPage-tracker-view-map DirectorsPage-tracker-view-hidden"}>
                            <PostListContentCombatMap
                                key={activeMap?.map_id || "no-active-map"}
                                campaignId={campaignId}
                                activeMap={activeMap}
                                entities={combatEntities}
                            />
                        </div>
                    </div>
                    <div className={enemiesCollapsed ? 'DirectorsPage-panel DirectorsPage-panel-collapsed' : 'DirectorsPage-panel'}>
                        <div className="DirectorsPage-panel-title">
                            <SwordsIcon className="DirectorsPage-panel-title-icon"/>
                            {!enemiesCollapsed && <span className="DirectorsPage-panel-title-name">Enemies</span>}
                            <button type="button"
                                className="DirectorsPage-panel-collapse-button"
                                onClick={() => setEnemiesCollapsed(c => !c)}
                                aria-label={enemiesCollapsed ? "Expand Enemies" : "Collapse Enemies"}
                            >
                                <ChevronDownIcon className={enemiesCollapsed ? "DirectorsPage-chevron" : "DirectorsPage-chevron DirectorsPage-chevron-open"}/>
                            </button>
                        </div>
                        {!enemiesCollapsed && campaignInfo.enemy_list.map((enemy) => {
                            const actualEnemy = { ...npcLayout, ...enemy, campaign: campaignId }
                            function setActionPoints(actionPoints) {
                                updateEnemy(actualEnemy.id, { action_points: actionPoints }).catch(e => alert(e));
                            }
                            function advanceTurn() {
                                updateEnemy(actualEnemy.id, advanceTurnStatuses(actualEnemy)).catch(e => alert(e));
                            }
                            function updateEnemyStatuses(nextStatuses) {
                                return updateEnemy(actualEnemy.id, { statuses: nextStatuses });
                            }
                            function useAction(action) {
                                setActionPoints(actualEnemy.action_points - action.actionCost);
                            }
                            const effectiveEnemy = getEffectiveCharacterStats(actualEnemy);
                            const grantedActions = getGrantedActions(actualEnemy);
                            return <DirectorsEntityCard
                                key={enemy.id}
                                kind="enemy"
                                name={actualEnemy.enemy_name}
                                subtitle={"Lvl " + actualEnemy.level}
                                hpNow={actualEnemy.current_health}
                                hpMax={actualEnemy.maximum_health}
                                tempHp={actualEnemy.temporary_health}
                                ac={effectiveEnemy.base_armor_class}
                                ap={actualEnemy.action_points}
                                onSetAp={setActionPoints}
                                canAdvanceTurn={true}
                                onNextTurn={advanceTurn}
                                weaknesses={actualEnemy.Weaknesses}
                                resistances={actualEnemy.Resistances}
                                statusEntity={actualEnemy}
                                userId={userId}
                                onUpdateStatuses={updateEnemyStatuses}
                                hasStatusWrite={true}
                                actions={[...actualEnemy.actions, ...grantedActions]}
                                experiencePoints={0}
                                baseHitModifier={effectiveEnemy.base_hit_modifier}
                                baseDamageModifier={effectiveEnemy.base_damage_modifier}
                                baseDamageDice={actualEnemy.base_damage_dice}
                                baseDamageDiceType={actualEnemy.base_damage_dice_type}
                                baseHealingDiceType={actualEnemy.base_healing_dice_type}
                                canUseActions={true}
                                onUseAction={useAction}
                            />
                        })}
                    </div>
                </div>},
                {
                    tabName: "Maps",
                    icon: <MapIcon/>,
                    content: <div>
                        <input
                            name="file"
                            type="file"
                            onChange={onMapFileChange}
                        />
                        <button type="button" onClick={() => uploadNewMapToCampaign(mapFile)} disabled={mapFile === undefined}>Upload</button>
                        {mapFile && <div>
                            Preview:<br/>
                            <img src={URL.createObjectURL(mapFile)} alt="Map Preview" className='DirectorsPage-map-preview'/>
                        </div>}
                        <div className='DirectorsPage-maps-list'>
                            {maps.map((map) => {
                                const isActive = campaignInfo.active_map === map.map_id;
                                return <div key={map.map_id} className='DirectorsPage-map-item'>
                                    <MapRenderer map={map} userId={userId}/>
                                    <button type="button"
                                        className='DirectorsPage-set-active-map-button'
                                        disabled={isActive}
                                        onClick={() => updateDoc(campaignDoc, { active_map: map.map_id })}
                                    >
                                        {isActive ? "Active Map" : "Set as Active"}
                                    </button>
                                    <button type="button"
                                        className='DirectorsPage-delete-map-button'
                                        onClick={() => deleteMap(map)}
                                    >
                                        Delete Map
                                    </button>
                                </div>
                            })}
                        </div>
                    </div>
                }
            ]}/>
        </div>
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
                    key={activeMap?.map_id || "no-active-map"}
                    campaignId={campaignId}
                    activeMap={activeMap}
                    entities={combatEntities}
                />
            </div>
        </>}
    </div>
}
