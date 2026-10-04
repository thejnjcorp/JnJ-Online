import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useScenes } from '../utils/useScenes';
import { useParty } from '../utils/useParty';
import { calendarOf } from '../utils/calendar';
import { addPartyEvent } from '../utils/usePartyEvents';
import { useEncounters } from '../utils/useEncounters';
import { addTrackerPosts, changeMusic, partyDoc, setCalendarToday, updateCombatTracker } from '../utils/party';
import { musicForCue } from '../utils/music';
import { stageEncounter } from '../utils/enemies';
import {
    SCENE_TEMPLATES, activeScene, branchLinkPatches, calendarIsElsewhere, copyBeats, newId, orderAfter, pauseRun, sceneDate, sceneEventFields, sceneToOpen, settleDecision, startRun, unlinkScene,
} from '../utils/scenes';
import { ScenesCampaignView } from './ScenesCampaignView';
import { PartySpace } from './PartySpace';
import { ScenesSessionView } from './ScenesSessionView';
import { SceneBuilder } from './SceneBuilder';
import { SceneRunner } from './SceneRunner';
import { ScenesPanel } from './ScenesPanel';
import { EncountersPage } from './EncountersPage';
import { EncounterPage } from './EncounterPage';
import { NewSceneDialog } from './NewSceneDialog';
import { SceneDecisionDialog } from './SceneDecisionDialog';
import '../styles/Scenes.scss';

// Open a combat beat's map and put its encounter's enemies in the fight and on the
// tracker. Resolves false when nothing was staged (the director declined staging it
// twice, or the encounter is gone), true otherwise.
async function stageCombatBeat({ campaignId, campaignInfo, maps, beat }) {
    const campaignDoc = doc(db, 'campaigns', campaignId);
    const mapId = beat.mapId || campaignInfo.active_map;
    if (beat.mapId) await updateDoc(campaignDoc, { active_map: beat.mapId });
    if (!beat.encounterId) return true;
    if (beat.started && !window.confirm('This encounter was already staged. Stage another set of these enemies?')) return false;
    const snapshot = await getDoc(doc(db, 'campaigns', campaignId, 'encounters', beat.encounterId));
    if (!snapshot.exists()) {
        alert("That encounter doesn't exist any more.");
        return false;
    }
    const partySnapshot = await getDoc(partyDoc(campaignId));
    const tracker = partySnapshot.exists() ? (partySnapshot.data().combat_tracker || []) : [];
    const zoneNames = maps.find(candidate => candidate.map_id === mapId)?.zones?.map(zone => zone.name) || [];
    const staged = stageEncounter(snapshot.data(), campaignInfo, zoneNames, tracker);
    await updateDoc(campaignDoc, { enemy_list: staged.enemy_list });
    if (staged.trackerPosts.length > 0) await updateCombatTracker(campaignId, addTrackerPosts(staged.trackerPosts));
    return true;
}

// The builder or the runner for one scene - or, when there is no scene to show, what
// to do about it.
function SceneWorkspace({ view, scene, session, scenes, encounters, maps, renderCombat, actions, combatTurn, players, onAskRoll, calendar }) {
    if (!scene || !session) {
        return <div className="Scenes-view"><div className="Scenes-empty">
            There are no scenes to {view === 'build' ? 'build' : 'run'} yet.{' '}
            <button type="button" className="Scenes-link" onClick={() => actions.newScene()}>Make the first one</button>
        </div></div>;
    }
    if (view === 'build') {
        return <SceneBuilder key={scene.id} scene={scene} scenes={scenes} session={session} encounters={encounters} maps={maps}
            onSave={actions.saveScene} onCreatePathScene={actions.createPathScene} onRun={actions.goRun} onBack={() => actions.goSession(session.id)} onOpenScene={actions.goBuild} onOpenMaps={actions.openMaps}
            onOpenEncounter={actions.openEncounter} onCreateEncounter={actions.createEncounter} players={players} onSetCondition={actions.setCondition} calendar={calendar}/>;
    }
    return <SceneRunner key={scene.id} scene={scene} scenes={scenes} session={session} calendar={calendar} onSyncCalendar={actions.syncCalendar}
        onUpdate={actions.updateScene} onStart={actions.startScene} onEnd={actions.endScene} onSwitch={actions.switchScene}
        onDecide={actions.decide} onStartCombat={actions.startCombat} renderCombat={renderCombat} onOpenBuilder={actions.goBuild} onOpenMaps={actions.openMaps}
        combatTurn={combatTurn} players={players} onAskRoll={onAskRoll} onMusicCue={actions.playMusicCue}/>;
}

// Timeline / Build Scene / Run Scene. Build and Run open the scene you chose (or the
// live one); with none, they open to a hint on what to do.
function ScenesNav({ view, timelineSessionId, buildTarget, runTarget, live, go, onOpenPanel }) {
    const item = key => ({
        className: view === key ? 'Scenes-nav-item Scenes-nav-item-active' : 'Scenes-nav-item',
        'aria-current': view === key ? 'page' : undefined,
    });
    const open = (target, goTo, key) => (target ? goTo(target.id) : go.go({ view: key }));
    return <nav className="Scenes-nav" aria-label="Scenes sections">
        <button type="button" {...item('scenes')} onClick={() => (timelineSessionId ? go.goSession(timelineSessionId) : go.goCampaign())}>Scenes</button>
        <button type="button" {...item('build')} onClick={() => open(buildTarget, go.goBuild, 'build')}>Build Scene</button>
        <button type="button" {...item('run')} onClick={() => open(runTarget, go.goRun, 'run')}>
            Run Scene{live && <span className="Scenes-live-dot" aria-label="a scene is live"/>}
        </button>
        <span className="Scenes-nav-spacer"/>
        <button type="button" className="Scenes-nav-item" onClick={() => onOpenPanel('encounters')}>Encounters</button>
        <button type="button" className="Scenes-nav-item" onClick={() => onOpenPanel('maps')}>Maps</button>
        <button type="button" className="Scenes-nav-item" onClick={() => onOpenPanel('notes')}>Notes</button>
        <button type="button" className="Scenes-nav-item" onClick={() => onOpenPanel('party')}>Party</button>
    </nav>;
}

// The director's plan and the way to run it - the whole of the Director's page. Three zoom levels:
//   Scenes       every session, or - zoomed in - one session's scenes and decisions
//   Build Scene  one scene's premise and beats
//   Run Scene    one scene, a beat at a time
// Where you are is kept in the address (?view=&session=&scene=) so reloading, or
// going back, lands where you were.
export function ScenesTab({ campaignId, campaignInfo, maps, renderCombat, renderMaps, renderNotes, header, renderSidebar, onSceneEnded, combatTurn = null, players = [], onAskRoll = null }) {
    const { sessions, scenes, status, createSession, updateSession, createScene, updateScene, deleteScene } = useScenes(campaignId);
    const { encounters } = useEncounters(campaignId);
    // the party's calendar: scenes are set on its days, and it can be moved to a scene's day
    const { party } = useParty(campaignId);
    const calendar = useMemo(() => calendarOf(party), [party]);
    const [params, setParams] = useSearchParams();
    const [newScene, setNewScene] = useState(null);
    const [deciding, setDeciding] = useState(null);
    // the Maps or Notes popup, if one is open
    const [panel, setPanel] = useState(null);
    // which of the party's tabs (inventory, trades, notes, calendar) the Party popup is on
    const [partyTab, setPartyTab] = useState('inventory');
    // which encounter the Encounters popup has open (none: the list)
    const [encounterId, setEncounterId] = useState(null);

    const view = ['build', 'run'].includes(params.get('view')) ? params.get('view') : 'scenes';
    const session = sessions.find(candidate => candidate.id === params.get('session')) || null;
    const selected = scenes.find(candidate => candidate.id === params.get('scene')) || null;
    const active = useMemo(() => activeScene(scenes), [scenes]);
    // Build and Run always have a scene to show once there is one: the one in the address, else
    // the one you were last in, the one being run, or the next one to do (see sceneToOpen).
    const [lastSceneId, setLastSceneId] = useState(null);
    const toOpen = sceneToOpen(scenes, { sessionId: session?.id, lastId: lastSceneId, view });
    const sceneForView = selected || (view === 'scenes' ? null : toOpen);
    const sceneSession = sceneForView ? sessions.find(candidate => candidate.id === sceneForView.sessionId) || null : null;

    const go = next => {
        const search = new URLSearchParams();
        Object.entries(next).forEach(([key, value]) => value && search.set(key, value));
        setParams(search);
    };
    const goCampaign = () => go({});
    const goSession = id => go({ session: id });
    const goBuild = id => { setLastSceneId(id); go({ view: 'build', scene: id }); };
    const goRun = id => { setLastSceneId(id); go({ view: 'run', scene: id }); };

    const openPanel = name => { setEncounterId(null); setPanel(name); };
    const openEncounter = id => { setEncounterId(id); setPanel('encounters'); };

    const fail = prefix => error => alert(prefix + error.message);

    // ---- Writes ----------------------------------------------------------

    // Saving a scene's beats also keeps the scenes its decisions lead to in step.
    async function saveScene(scene, patch) {
        await updateScene(scene.id, patch);
        if (patch.beats) {
            const links = branchLinkPatches(scene, patch.beats, scenes);
            await Promise.all(Object.entries(links).map(([id, linkPatch]) => updateScene(id, linkPatch)));
        }
    }

    async function createNewSession() {
        try {
            const id = await createSession({});
            goSession(id);
        } catch (error) { fail("Couldn't create the session: ")(error); }
    }

    async function handleCreateScene({ name, type, sessionId, date, timeMin, timeMax, afterSceneId, duplicateOf, templateKey }) {
        const original = duplicateOf ? scenes.find(candidate => candidate.id === duplicateOf) : null;
        const template = templateKey ? SCENE_TEMPLATES.find(candidate => candidate.key === templateKey) : null;
        const id = await createScene({
            sessionId, name, type, date: date || null, timeMin, timeMax,
            order: orderAfter(scenes, sessionId, afterSceneId === undefined ? mainEndId(sessionId) : afterSceneId),
            ...(original ? { premise: original.premise || '', beats: copyBeats(original.beats), episode: original.episode || '' } : {}),
            ...(template ? { beats: template.beats() } : {}),
        });
        setNewScene(null);
        goBuild(id);
    }
    const mainEndId = sessionId => {
        const main = scenes.filter(scene => scene.sessionId === sessionId && !scene.branch && !scene.benched).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        return main.length ? main[main.length - 1].id : null;
    };

    async function openNewScene(afterSceneId, sessionId) {
        let target = sessionId || session?.id || sessions[sessions.length - 1]?.id;
        if (!target) {
            try { target = await createSession({}); } catch (error) { return fail("Couldn't create the session: ")(error); }
        }
        setNewScene({ afterSceneId, sessionId: target });
    }

    // a scene made for one path of a decision, from the builder or the decision popup
    // It is made as a path of that option from the start (rather than left for the
    // next save of the deciding scene to link up), so it never shows on the main line.
    function createPathScene(owner, label, optionId) {
        return createScene({
            sessionId: owner.sessionId, name: label, type: 'roleplay', order: orderAfter(scenes, owner.sessionId, owner.id),
            branch: optionId ? { fromSceneId: owner.id, optionId } : null,
        });
    }

    function duplicateScene(scene) {
        createScene({
            sessionId: scene.sessionId, name: `${scene.name || 'Untitled scene'} (copy)`, premise: scene.premise, type: scene.type, episode: scene.episode,
            date: scene.date ?? null, timeMin: scene.timeMin, timeMax: scene.timeMax, beats: copyBeats(scene.beats),
            order: orderAfter(scenes, scene.sessionId, scene.id),
        }).catch(fail("Couldn't duplicate the scene: "));
    }

    // "Only runs if": the scene becomes the path of a decision's option (or, with no choice, goes back on the
    // main line). The decision it was a path of, if any, lets go of it first.
    async function setCondition(scene, choice) {
        const previous = scene.branch ? scenes.find(candidate => candidate.id === scene.branch.fromSceneId) : null;
        const owner = choice ? scenes.find(candidate => candidate.id === choice.sceneId) : null;
        const released = previous ? unlinkScene(previous, scene.id) : null;
        let ownerBeats = owner?.beats;
        if (released) {
            if (previous.id === owner?.id) ownerBeats = released;
            else await updateScene(previous.id, { beats: released });
        }
        if (!owner) {
            await updateScene(scene.id, { branch: null });
            return;
        }
        const beats = ownerBeats.map(beat => (beat.id === choice.beatId
            ? { ...beat, options: (beat.options || []).map(option => (option.id === choice.optionId ? { ...option, sceneId: scene.id } : option)) }
            : beat));
        await saveScene(owner, { beats });
    }

    // a scene that is a path of a decision, taken off it: the decision forgets it
    async function detach(scene) {
        const owner = scenes.find(candidate => candidate.id === scene.branch?.fromSceneId);
        const beats = owner && unlinkScene(owner, scene.id);
        if (beats) await updateScene(owner.id, { beats });
    }

    function deleteSceneWithConfirm(scene) {
        if (!window.confirm(`Delete "${scene.name || 'Untitled scene'}"? This can't be undone.`)) return;
        detach(scene).then(() => deleteScene(scene.id)).catch(fail("Couldn't delete the scene: "));
    }

    const benchScene = scene => detach(scene).then(() => updateScene(scene.id, { benched: true, branch: null })).catch(fail("Couldn't move the scene: "));
    const keepForLater = scene => updateScene(scene.id, { benched: true }).catch(fail("Couldn't move the scene: "));
    function bringBack(scene, sessionId) {
        detach(scene)
            .then(() => updateScene(scene.id, { benched: false, branch: null, status: 'draft', sessionId, order: orderAfter(scenes, sessionId, mainEndId(sessionId)) }))
            .catch(fail("Couldn't bring the scene back: "));
    }

    async function confirmDecision(optionId, keepSkipped) {
        const owner = scenes.find(candidate => candidate.id === deciding.sceneId);
        const result = settleDecision(owner, deciding.beatId, optionId, scenes, { keepSkipped });
        if (!result) return;
        await updateScene(owner.id, { beats: result.beats });
        await Promise.all(Object.entries(result.patches).map(([id, patch]) => result.discardIds.includes(id) ? deleteDoc(doc(db, 'campaigns', campaignId, 'scenes', id)) : updateScene(id, patch)));
        setDeciding(null);
    }

    async function addPathOnTheFly(name) {
        const owner = scenes.find(candidate => candidate.id === deciding.sceneId);
        const beat = owner.beats.find(candidate => candidate.id === deciding.beatId);
        const optionId = newId();
        const sceneId = await createPathScene(owner, name, optionId);
        const option = { id: optionId, label: name, sceneId };
        await saveScene(owner, { beats: owner.beats.map(candidate => candidate.id === beat.id ? { ...candidate, options: [...(candidate.options || []), option] } : candidate) });
        return option.id;
    }

    // A new, empty encounter for a combat beat; its roster is filled in from the Encounters popup.
    async function createEncounter(name) {
        const created = await addDoc(collection(db, 'campaigns', campaignId, 'encounters'), {
            name: name || 'New encounter', notes: '', roster: [], stagedIds: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        return created.id;
    }

    // ---- Running ---------------------------------------------------------

    async function startScene(scene, { moveCalendar = false } = {}) {
        const others = scenes.filter(other => other.status === 'active' && other.id !== scene.id);
        await Promise.all(others.map(other => updateScene(other.id, { status: 'ready', run: pauseRun(other.run || {}) })));
        await updateScene(scene.id, { status: 'active', run: startRun(scene) });
        // the scene is on a different day to the calendar's today: if asked to, the calendar moves to it
        if (moveCalendar && calendarIsElsewhere(scene, calendar)) await setCalendarToday(campaignId, sceneDate(scene, calendar));
    }

    async function endScene(scene, { logOnCalendar = false } = {}) {
        // the scene goes on the party's calendar, on its day, once (it remembers the event it made)
        const fields = logOnCalendar && !scene.calendarEventId ? sceneEventFields(scene, calendar) : null;
        const logged = fields ? await addPartyEvent(campaignId, fields) : null;
        await updateScene(scene.id, { status: 'completed', run: pauseRun(scene.run || {}), ...(logged ? { calendarEventId: logged.id } : {}) });
        // what was only for the scene (a status that lasts "the rest of the scene") ends with it
        onSceneEnded?.();
        goSession(scene.sessionId);
    }

    async function switchScene(from, toId) {
        const to = scenes.find(candidate => candidate.id === toId);
        if (!to) return;
        await updateScene(from.id, { status: 'ready', run: pauseRun(from.run || {}) });
        await startScene(to);
        goRun(to.id);
    }

    async function startCombat(scene, beat) {
        try {
            if (!(await stageCombatBeat({ campaignId, campaignInfo, maps, beat }))) return;
            await updateScene(scene.id, { beats: scene.beats.map(candidate => candidate.id === beat.id ? { ...candidate, started: true } : candidate) });
        } catch (error) {
            alert("Couldn't start the combat: " + error.message);
        }
    }

    // ---- Render ----------------------------------------------------------

    let body;
    if (status === 'loading') body = <div className="Scenes-view"><output className="Scenes-muted">Loading scenes…</output></div>;
    else if (status === 'error') body = <div className="Scenes-view"><p role="alert">{"Couldn't load the scenes. Only the campaign's directors can see them."}</p></div>;
    else if (view === 'build' || view === 'run') {
        body = <SceneWorkspace view={view} scene={sceneForView} session={sceneSession} scenes={scenes} encounters={encounters} maps={maps}
            renderCombat={() => renderCombat({ openPanel })} combatTurn={combatTurn} players={players} onAskRoll={onAskRoll} calendar={calendar} actions={{
                saveScene, createPathScene, setCondition: (scene, choice) => setCondition(scene, choice).catch(fail("Couldn't change the path: ")), goRun, goBuild, goCampaign, goSession, newScene: () => openNewScene(),
                updateScene: (id, patch) => updateScene(id, patch).catch(fail("Couldn't save: ")),
                startScene: (scene, options) => startScene(scene, options).catch(fail("Couldn't start the scene: ")),
                endScene: (scene, options) => endScene(scene, options).catch(fail("Couldn't end the scene: ")),
                syncCalendar: date => setCalendarToday(campaignId, date).catch(fail("Couldn't change the calendar: ")),
                switchScene: (from, toId) => switchScene(from, toId).catch(fail("Couldn't switch scenes: ")),
                decide: (sceneId, beatId) => setDeciding({ sceneId, beatId }),
                startCombat, openMaps: () => openPanel('maps'), openEncounter, createEncounter,
                playMusicCue: cue => changeMusic(campaignId, current => musicForCue(cue, current)).catch(fail("Couldn't change the music: ")),
            }}/>;
    } else if (session) {
        body = <ScenesSessionView sessions={sessions} scenes={scenes} session={session} calendar={calendar} onBack={goCampaign} onOpenSession={goSession}
            onNewScene={openNewScene} onEdit={goBuild} onRun={goRun} onDecide={(sceneId, beatId) => setDeciding({ sceneId, beatId })}
            onDuplicate={duplicateScene} onBench={benchScene} onDelete={deleteSceneWithConfirm} onBringBack={bringBack} onKeepForLater={keepForLater}
            onUpdateSession={(id, patch) => updateSession(id, patch).catch(fail("Couldn't save: "))}/>;
    } else {
        body = <ScenesCampaignView sessions={sessions} scenes={scenes} calendar={calendar} onOpenSession={goSession} onNewSession={createNewSession} onNewScene={openNewScene}/>;
    }

    // from Build or Run, Timeline goes back to that scene's session
    const timelineSessionId = view === 'scenes' ? null : (session || sceneSession)?.id;
    const decidingOwner = deciding ? scenes.find(candidate => candidate.id === deciding.sceneId) : null;
    const decidingBeat = decidingOwner?.beats?.find(candidate => candidate.id === deciding.beatId);

    return <div className="Scenes">
        {header}
        <ScenesNav view={view} timelineSessionId={timelineSessionId} buildTarget={selected || toOpen} runTarget={active || selected || toOpen} live={Boolean(active)}
            go={{ go, goCampaign, goSession, goBuild, goRun }} onOpenPanel={openPanel}/>
        <div className="Scenes-frame">
            {renderSidebar && <aside className="Scenes-sidebar" aria-label="The party">{renderSidebar(view)}</aside>}
            <div className="Scenes-body">{body}</div>
        </div>
        {panel === 'encounters' && <ScenesPanel title="Encounters" onClose={() => setPanel(null)}>
            {encounterId
                ? <EncounterPage key={encounterId} campaignId={campaignId} encounterId={encounterId} onBack={() => setEncounterId(null)}/>
                : <EncountersPage campaignId={campaignId} onOpen={setEncounterId}/>}
        </ScenesPanel>}
        {panel === 'maps' && <ScenesPanel title="Maps" onClose={() => setPanel(null)}>{renderMaps()}</ScenesPanel>}
        {panel === 'notes' && <ScenesPanel title="Notes" onClose={() => setPanel(null)}>{renderNotes()}</ScenesPanel>}
        {panel === 'party' && <ScenesPanel title="Party" onClose={() => setPanel(null)}>
            <PartySpace campaignId={campaignId} tab={partyTab} onTab={setPartyTab}/>
        </ScenesPanel>}
        {newScene && <NewSceneDialog sessions={sessions} scenes={scenes} calendar={calendar} defaultSessionId={newScene.sessionId} afterSceneId={newScene.afterSceneId}
            onCreate={handleCreateScene} onClose={() => setNewScene(null)}/>}
        {decidingOwner && decidingBeat && <SceneDecisionDialog owner={decidingOwner} beat={decidingBeat} scenes={scenes}
            onConfirm={confirmDecision} onAddPath={addPathOnTheFly} onClose={() => setDeciding(null)}/>}
    </div>;
}

