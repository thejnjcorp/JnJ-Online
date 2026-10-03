import { useEffect, useMemo, useRef, useState } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import '../styles/CharacterPageStyles/DefaultCharacterPage.scss';
import '../styles/DirectorsPage.scss';
import '../styles/CharacterMainTab.scss';
import '../styles/CharacterPage.scss';
import { useLocation, useNavigate } from 'react-router-dom';
import { db, auth } from '../utils/firebase';
import { doc, query, collection, where, onSnapshot, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { useResolvedCharacters } from '../utils/useClassVersion';
import characterPageLayout from '../CharacterPageLayout.json';
import { PictureField } from './PictureField';
import { onAuthStateChanged } from 'firebase/auth';
import { ReactComponent as PersonIcon } from '../icons/person.svg';
import { DirectorNotes } from './DirectorNotes';
import { CombatProvider } from './CombatContext';
import { EnemyTiles, PartyTiles, TurnOrder } from './CombatBoard';
import '../styles/Combat.scss';
import { ScenesTab } from './ScenesTab';
import { PostListContentCombatMap } from '../utils/DraggableElements/PostListCombatMap.tsx';
import { PostListContentCombat } from '../utils/DraggableElements/PostListCombat.tsx';
import { MapRenderer } from './MapRenderer';
import { DocAdminManager } from './DocAdminManager';
import { useCampaignMaps, useCombatEntities } from '../utils/useCampaignCombat';
import { withoutArchived } from '../utils/characterArchive';
import { AddEnemyDialog } from './AddEnemyDialog';
import { npcIdOf, removeEnemies } from '../utils/enemies';
import { chosenColor, colorTint } from '../utils/entityColor';
import { removeFromTracker, requestRoll, updateCombatTracker } from '../utils/party';
import { NO_MAP_ZONE, combatantMover } from '../utils/combatTracker';
import { zoneRects } from '../utils/mapTokens';
import { isDirectorOf } from '../utils/campaignRoles';

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
function makeLineViewCard(playerInfoById, defeatedIds = [], colorById = {}) {
    return function LineViewEntityCard({ post, index, titleClassName, boxClassName: baseBoxClassName, readOnly = false }) {
        const info = playerInfoById[post.id];
        // an enemy the director has marked defeated is dimmed and struck through
        const defeated = defeatedIds.includes(post.id);
        const boxClassName = defeated ? `${baseBoxClassName} DirectorsPage-entity-chip-defeated` : baseBoxClassName;
        // the colour picked for a player or an enemy outlines and tints its chip
        const color = chosenColor(info?.color) || colorById[post.id] || '';
        const chipStyle = color ? { borderColor: color, background: colorTint(color) } : undefined;
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

        return <Draggable draggableId={String(post.id)} index={index} isDragDisabled={readOnly}>
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

// The strip across the top of the page: which campaign this is and who directs it, with a way
// to its settings (the campaign page) and out of it.
function CampaignBar({ campaignInfo, onSettings, onExit }) {
    return <div className="Scenes-campaign-bar">
        <div className="Scenes-campaign-title">
            <span className="Scenes-campaign-name">{campaignInfo.campaign_name}</span>
            <span className="Scenes-campaign-dot"/>
            <span className="Scenes-campaign-directors">{`Directors: ${campaignInfo.director_name}`}</span>
        </div>
        <div className="Scenes-campaign-actions">
            <button type="button" className="Scenes-square-button" aria-label="Campaign settings" onClick={onSettings}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
            <button type="button" className="Scenes-square-button" aria-label="Exit campaign" onClick={onExit}>&times;</button>
        </div>
    </div>;
}

// Zones / Map, which map the fight is on (for a director), and the way to open it full screen.
function TrackerBar({ mode, onModeChange, maps, activeMapId, canChooseMap, onSelectMap, canOpenFullMap, onOpenFullMap }) {
    return <div className="Combat-main-bar">
        <fieldset className="Combat-mode" aria-label="Tracker view">
            <button type="button" aria-pressed={mode === 'line'} onClick={() => onModeChange('line')}>Zones</button>
            <button type="button" aria-pressed={mode === 'map'} onClick={() => onModeChange('map')}>Map</button>
        </fieldset>
        <div className="Combat-tools">
            {canChooseMap && maps.length > 0 && <label className="Combat-map-select">
                <span>Map</span>
                <select className="Entity-select" aria-label="Combat map" value={activeMapId || ''} onChange={event => onSelectMap(event.target.value)}>
                    <option value="">No map</option>
                    {maps.map((map, index) => <option key={map.map_id} value={map.map_id}>{`Map ${index + 1}`}</option>)}
                </select>
            </label>}
            {mode === 'map' && canOpenFullMap && <button type="button" className="Entity-button" onClick={onOpenFullMap}>Open Full Map &#10530;</button>}
        </div>
    </div>;
}

// One map in the Maps tab's gallery: its picture, whether it is the one on the combat
// tracker, and (opened up) its zone editor and who may change it.
function MapCard({ map, isActive, isExpanded, userId, onToggleExpanded, onSelect, onDelete }) {
    const cardClass = ['DirectorsPage-map-card', isActive && 'DirectorsPage-map-card-active', isExpanded && 'DirectorsPage-map-card-expanded'].filter(Boolean).join(' ');
    return <div className={cardClass}>
        <button
            type="button"
            className="DirectorsPage-map-thumb-button"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Close this map's zone editor" : "Open this map's zone editor"}
            onClick={onToggleExpanded}
        >
            <img src={map.link} alt="" className="DirectorsPage-map-thumb"/>
            {isActive && <span className='DirectorsPage-active-map-badge'>Active in combat</span>}
        </button>
        <div className="DirectorsPage-map-card-actions">
            <button type="button" className='Scenes-button Scenes-button-small DirectorsPage-set-active-map-button' onClick={onSelect}>
                {isActive ? "Unselect Map" : "Set as Active"}
            </button>
            <button type="button" className='Scenes-button Scenes-button-small DirectorsPage-delete-map-button' onClick={onDelete}>
                Delete Map
            </button>
        </div>
        {isExpanded && <div className="DirectorsPage-map-expanded">
            <MapRenderer map={map} userId={userId}/>
            <DocAdminManager docRef={doc(db, "maps", map.map_id)} admins={map.admins} userId={userId}/>
            <button type="button" className="Scenes-button Scenes-button-small DirectorsPage-map-collapse-button" onClick={onToggleExpanded}>Close zone editor</button>
        </div>}
    </div>;
}

export function DirectorsPage() {
    const location = useLocation();
    const campaignId = location.pathname.split("/").at(2);
    const pageTheme = 'DefaultCharacterPage';
    const [isLoaded, setIsLoaded] = useState(false);
    const [charactersLoaded, setCharactersLoaded] = useState(false);
    const [userId, setUserId] = useState("");
    const [trackerMode, setTrackerMode] = useState('line');
    const [mapOverlayOpen, setMapOverlayOpen] = useState(false);
    const [addEnemyOpen, setAddEnemyOpen] = useState(false);
    // the combat view's own actions (end a scene, ...), once it is up
    const [combatApi, setCombatApi] = useState(null);
    // the round of the fight and whose turn it is, from the combat provider (cues come due by round)
    const [combatTurn, setCombatTurn] = useState(null);
    const navigate = useNavigate();
    const [campaignInfo, setCampaignInfo] = useState({
        "campaign_name":"placeholder",
        "director_name":"placeholder",
        "enemy_list":[],
        "ally_combat_npc_list":[],
        "neutral_combat_npc_list":[],
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
                setCharacterList(withoutArchived(querySnapshot.docs.map(doc => ({character_id: doc.id, ...doc.data()}))));
                setCharactersLoaded(true);
            }
        });
        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [charactersQuery]);

    // `mapLink` is already whatever PictureField below resolved it to - a
    // pasted web link, or (once its own upload finishes) an Imgur link - so
    // there is nothing left to upload here, just a new map doc to create.
    const addNewMapToCampaign = async () => {
        if (!mapLink) {
            alert("Please paste an image link, or upload a picture.");
            return;
        }
        try {
            const docRef = await addDoc(collection(db, "maps"), {
                canWrite: [userId],
                admins: [userId],
                link: mapLink,
                zones: [],
            });
            console.log("Map uploaded successfully:", docRef.id);
            await updateDoc(campaignDoc, {
                maps: [...campaignInfo.maps, docRef.id]
            });
            setMapLink('');
            alert("Map added to campaign successfully!");
        } catch (error) {
            console.error("Error uploading map:", error);
            alert("Failed to upload map. Please try again.");
        }
    }

    const [mapLink, setMapLink] = useState('');
    // Which map's full zone editor (MapRenderer) is open, in the gallery below -
    // at most one at a time, collapsed by default. Rendering every map's full
    // editor (draggable zone handles and all) at once, always, for every map in
    // the campaign, was the clunky, space-wasting list this replaces.
    const [expandedMapId, setExpandedMapId] = useState(null);

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
    // The director has chosen no map (as opposed to a campaign that hasn't loaded yet,
    // whose placeholder also has none): the tracker then keeps everyone in one column.
    // It waits for the characters too, so it never works from half the fight.
    const noMap = isLoaded && charactersLoaded && !campaignInfo.active_map;
    const selectMap = mapId => updateDoc(campaignDoc, { active_map: mapId || null }).catch(e => alert(e));
    const combatEntities = useCombatEntities(characterList, campaignInfo);
    // Each player's class data (actions, base AC/hit, class name) comes from the
    // class version they're pinned to - see useClassVersion.js. The raw list
    // above stays what combat entities/chips key off.
    const resolvedCharacterList = useResolvedCharacters(characterList);
    // each player as the combat view reads them: their sheet over the layout's defaults
    // who the director can call on (for a check) or leave out of a scene
    const partyPlayers = useMemo(() => resolvedCharacterList.map(character => ({ id: character.character_id, name: character.character_name || 'Unnamed' })), [resolvedCharacterList]);
    const combatCharacters = useMemo(() => resolvedCharacterList.map(character => ({ ...characterPageLayout, ...character })), [resolvedCharacterList]);
    const zoneNames = activeMap?.zones?.map((zone) => zone.name) || [];
    const noZoneFallback = noMap ? [NO_MAP_ZONE] : [];
    const lineViewZones = zoneNames.length > 0 ? zoneNames : noZoneFallback;
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
    const playerInfoKey = characterList.map(c => `${c.character_id}:${c.combat_portrait_url || c.portrait_url || ''}:${c.navigation_color || ''}`).join('|');
    const defeatedIds = (campaignInfo.enemy_list ?? []).filter(enemy => enemy.defeated).map(enemy => 'npc:' + enemy.id);
    const defeatedKey = defeatedIds.join(',');
    const enemyColorKey = (campaignInfo.enemy_list ?? []).map(enemy => `${enemy.id}:${enemy.color || ''}`).join('|');
    const lineViewCard = useMemo(() => {
        const playerInfoById = {};
        characterList.forEach(character => {
            playerInfoById["character:" + character.character_id] = {
                portraitUrl: character.combat_portrait_url || character.portrait_url,
                color: character.navigation_color,
            };
        });
        const colorById = {};
        (campaignInfo.enemy_list ?? []).forEach(enemy => {
            const color = chosenColor(enemy.color);
            if (color) colorById['npc:' + enemy.id] = color;
        });
        return makeLineViewCard(playerInfoById, defeatedIds, colorById);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playerInfoKey, defeatedKey, enemyColorKey]);

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
    // Each change is made to the list as the last change left it (not as this render saw it), so
    // changing several enemies at once - everyone in a group of minions - changes every one of
    // them rather than only the last.
    const enemyListRef = useRef(campaignInfo.enemy_list);
    useEffect(() => { enemyListRef.current = campaignInfo.enemy_list; }, [campaignInfo.enemy_list]);
    function updateEnemy(enemyId, patch) {
        const next = enemyListRef.current.map(e => (e.id === enemyId ? { ...e, ...patch } : e));
        enemyListRef.current = next;
        return updateDoc(campaignDoc, { enemy_list: next });
    }

    // Enemies come and go on the campaign doc. Taking one out also takes its token
    // off the combat tracker (on the party doc), straight away.
    function addEnemyToFight(enemy) {
        return updateDoc(campaignDoc, { enemy_list: [...campaignInfo.enemy_list, enemy] }).catch(e => alert(e));
    }

    function removeEnemyFromFight(enemy) {
        if (!window.confirm(`Remove ${enemy.enemy_name} from the fight?`)) return;
        updateDoc(campaignDoc, removeEnemies(campaignInfo, [enemy.id])).catch(e => alert(e));
        updateCombatTracker(campaignId, removeFromTracker([enemy.id])).catch(e => console.log(e));
    }

    // From the map: marking an enemy's token defeated, or dropping it on the trash can.
    function setEnemyDefeated(entityId, defeated) {
        const id = npcIdOf(entityId);
        if (id && campaignInfo.enemy_list.some(enemy => enemy.id === id)) updateEnemy(id, { defeated }).catch(e => alert(e));
    }

    function removeEntityFromFight(entity) {
        const enemy = campaignInfo.enemy_list.find(candidate => candidate.id === npcIdOf(entity.id));
        if (enemy) removeEnemyFromFight(enemy);
    }

    function clearEnemies() {
        if (!window.confirm('Remove every enemy from the fight?')) return;
        const ids = campaignInfo.enemy_list.map(enemy => enemy.id);
        updateDoc(campaignDoc, removeEnemies(campaignInfo, ids)).catch(e => alert(e));
        updateCombatTracker(campaignId, removeFromTracker(ids)).catch(e => console.log(e));
    }

    // The notebook is for directors only (the Firestore rule enforces it; this
    // just doesn't offer players a tab that could never load).
    const isDirector = isDirectorOf(campaignInfo, userId);
    // In the line view a director drags anyone between zones, and a player their own
    // characters; the map's zones say where a token lands on the map after a move.
    const canMoveCombatant = combatantMover(combatEntities, userId, isDirector);
    const activeMapRects = activeMap ? zoneRects(activeMap.zones) : null;

    // Director Mode is for planning: hiding enemies and prepping a fight before
    // the party ever sees them is the whole point, so this can't be reached by
    // anyone who isn't the director, a co-director, or a doc admin - not shown
    // as "Loading…" forever for a genuine non-director, but not flashing the
    // denial at a real director either while their own campaign doc is still
    // on its way in.
    if (!isDirector) {
        if (!isLoaded || !userId) return <div className="DirectorsPage DirectorsPage-message">Loading…</div>;
        return <div className="DirectorsPage DirectorsPage-message" role="alert">
            Director Mode is for the campaign's director and co-directors only.
        </div>;
    }

    // The Maps panel (opened from the Scenes tab's Maps button and from a combat beat): add a
    // map, pick which one is on the combat tracker, edit its zones, and delete it.
    const mapsHeading = maps.length > 0 ? `Your maps (${maps.length})` : 'Your maps';
    const mapsContent = <div className="DirectorsPage-maps">
        <section className="DirectorsPage-maps-add">
            <h3 className="DirectorsPage-maps-heading">Add a map</h3>
            <p className="Scenes-muted">Paste a link to an image, or upload one. Draw its zones afterwards, from the map's own card.</p>
            <PictureField name="New map" value={mapLink} onChange={setMapLink} square/>
            <div><button type="button" className="Scenes-button Scenes-button-primary" onClick={addNewMapToCampaign} disabled={!mapLink}>Add Map</button></div>
        </section>
        <section>
            <h3 className="DirectorsPage-maps-heading">{mapsHeading}</h3>
            {maps.length === 0 && <p className="Scenes-muted">No maps yet. A map is what a combat beat fights on.</p>}
            <div className='DirectorsPage-maps-gallery'>
                {maps.map(map => <MapCard key={map.map_id} map={map} isActive={campaignInfo.active_map === map.map_id} isExpanded={expandedMapId === map.map_id}
                    userId={userId} onToggleExpanded={() => setExpandedMapId(expandedMapId === map.map_id ? null : map.map_id)}
                    onSelect={() => selectMap(campaignInfo.active_map === map.map_id ? null : map.map_id)} onDelete={() => deleteMap(map)}/>)}
            </div>
        </section>
    </div>;

    // The combat beat: the turn order and the tracker in the middle (zones, or the map), the enemies
    // down the right. The party is down the left of every scene while it is being run.
    // `openPanel` is the scenes framework's: Encounters opens in a popup over it.
    const combatMain = openPanel => <div className="Combat-main">
        <TurnOrder/>
        <TrackerBar mode={trackerMode} onModeChange={setTrackerMode} maps={maps} activeMapId={campaignInfo.active_map} canChooseMap={isDirector}
            onSelectMap={selectMap} canOpenFullMap={Boolean(activeMap)} onOpenFullMap={() => setMapOverlayOpen(true)}/>
        {/* Both views stay mounted at once (toggled via CSS, not unmounted) since
            PostListContentCombatMap owns the effect that syncs combat_tracker with who's
            actually in the fight - if the map were never mounted, a Director who only ever
            used the zones would never see new combatants show up. */}
        <div className={trackerMode === 'line' ? "DirectorsPage-tracker-view" : "DirectorsPage-tracker-view DirectorsPage-tracker-view-hidden"}>
            <PostListContentCombat
                key={activeMap?.map_id || "no-active-map"}
                campaignId={campaignId}
                inputStatuses={lineViewZones}
                className={lineViewClassName}
                PostCardComponent={lineViewCard}
                canMovePost={canMoveCombatant}
                rects={activeMapRects}
            />
            {activeMap && zoneNames.length === 0 && <div className="DirectorsPage-tracker-empty">This map has no zones yet. Add some from the Maps popup.</div>}
            {/* One shared Tooltip, matched by data-tooltip-id on every chip (see makeLineViewCard). */}
            <Tooltip id="DirectorsPage-line-view-tooltip" place="top"/>
        </div>
        <div className={trackerMode === 'map' ? "DirectorsPage-tracker-view DirectorsPage-tracker-view-map" : "DirectorsPage-tracker-view DirectorsPage-tracker-view-map DirectorsPage-tracker-view-hidden"}>
            <PostListContentCombatMap
                key={activeMap?.map_id || "no-active-map"}
                campaignId={campaignId}
                activeMap={activeMap}
                entities={combatEntities}
                userId={userId}
                canEdit={isDirector}
                noMap={noMap}
                onSetDefeated={isDirector ? setEnemyDefeated : undefined}
                onRemoveEntity={isDirector ? removeEntityFromFight : undefined}
            />
        </div>
    </div>;

    return <div className="DirectorsPage">
        <CombatProvider campaignId={campaignId} campaignInfo={campaignInfo} characters={combatCharacters} userId={userId}
            updateEnemy={updateEnemy} removeEnemy={removeEnemyFromFight} onApi={setCombatApi} onTurn={setCombatTurn}>
            <ScenesTab campaignId={campaignId} campaignInfo={campaignInfo} maps={maps} combatTurn={combatTurn} players={partyPlayers}
                onAskRoll={(characterIds, skill) => requestRoll(campaignId, characterIds, skill)}
                header={<CampaignBar campaignInfo={campaignInfo} onSettings={() => navigate('/campaigns/' + campaignId)} onExit={() => navigate('/campaigns')}/>}
                renderSidebar={() => <div className={pageTheme + ' Scenes-party'}><PartyTiles/></div>}
                renderCombat={api => ({
                    main: combatMain(api.openPanel),
                    aside: <EnemyTiles onAdd={() => setAddEnemyOpen(true)} onEncounters={() => api.openPanel('encounters')} onClear={clearEnemies}/>,
                })}
                renderMaps={() => mapsContent} renderNotes={() => <DirectorNotes campaignId={campaignId}/>}
                onSceneEnded={() => combatApi?.endScene()}/>
        </CombatProvider>
        {addEnemyOpen && <AddEnemyDialog existing={campaignInfo.enemy_list} onAdd={addEnemyToFight} onClose={() => setAddEnemyOpen(false)}/>}
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
                    userId={userId}
                    canEdit={isDirector}
                    noMap={noMap}
                    onSetDefeated={isDirector ? setEnemyDefeated : undefined}
                    onRemoveEntity={isDirector ? removeEntityFromFight : undefined}
                    toolbarsBeside
                />
            </div>
        </>}
    </div>
}
