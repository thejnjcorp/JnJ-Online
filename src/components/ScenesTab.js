import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useScenes } from '../utils/useScenes';
import { useEncounters } from '../utils/useEncounters';
import { partyDoc, updateCombatTracker } from '../utils/party';
import { stageEncounter } from '../utils/enemies';
import {
    activeScene, branchLinkPatches, copyBeats, newId, orderAfter, pauseRun, settleDecision, startRun, unlinkScene,
} from '../utils/scenes';
import { ScenesCampaignView } from './ScenesCampaignView';
import { ScenesSessionView } from './ScenesSessionView';
import { SceneBuilder } from './SceneBuilder';
import { SceneRunner } from './SceneRunner';
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
    if (staged.trackerPosts.length > 0) await updateCombatTracker(campaignId, posts => [...posts, ...staged.trackerPosts]);
    return true;
}

// The builder or the runner for one scene - or, when there is no scene to show, what
// to do about it.
function SceneWorkspace({ view, scene, session, scenes, encounters, maps, renderCombat, actions }) {
    if (!scene || !session) {
        const hint = view === 'build'
            ? 'Pick a scene to build from the Scenes view.'
            : 'No scene is running. Pick one from the Scenes view and choose Run.';
        return <div className="Scenes-view"><div className="Scenes-empty">
            {hint} <button type="button" className="Scenes-link" onClick={actions.goCampaign}>Go to Scenes</button>
        </div></div>;
    }
    if (view === 'build') {
        return <SceneBuilder key={scene.id} scene={scene} scenes={scenes} session={session} encounters={encounters} maps={maps}
            onSave={actions.saveScene} onCreatePathScene={actions.createPathScene} onRun={actions.goRun} onBack={() => actions.goSession(session.id)} onOpenScene={actions.goBuild}/>;
    }
    return <SceneRunner key={scene.id} scene={scene} scenes={scenes} session={session}
        onUpdate={actions.updateScene} onStart={actions.startScene} onEnd={actions.endScene} onSwitch={actions.switchScene}
        onDecide={actions.decide} onStartCombat={actions.startCombat} renderCombat={renderCombat} onOpenBuilder={actions.goBuild}/>;
}

// Timeline / Build Scene / Run Scene. Build and Run open the scene you chose (or the
// live one); with none, they open to a hint on what to do.
function ScenesNav({ view, timelineSessionId, buildTarget, runTarget, live, go }) {
    const item = key => ({
        className: view === key ? 'Scenes-nav-item Scenes-nav-item-active' : 'Scenes-nav-item',
        'aria-current': view === key ? 'page' : undefined,
    });
    const open = (target, goTo, key) => (target ? goTo(target.id) : go.go({ view: key }));
    return <nav className="Scenes-nav" aria-label="Scenes sections">
        <button type="button" {...item('scenes')} onClick={() => (timelineSessionId ? go.goSession(timelineSessionId) : go.goCampaign())}>Timeline</button>
        <button type="button" {...item('build')} onClick={() => open(buildTarget, go.goBuild, 'build')}>Build Scene</button>
        <button type="button" {...item('run')} onClick={() => open(runTarget, go.goRun, 'run')}>
            Run Scene{live && <span className="Scenes-live-dot" aria-label="a scene is live"/>}
        </button>
    </nav>;
}

// The director's plan and the way to run it. Three zoom levels share one tab:
//   Timeline     every session, or - zoomed in - one session's scenes and decisions
//   Build Scene  one scene's premise and beats
//   Run Scene    one scene, a beat at a time
// Where you are is kept in the address (?view=&session=&scene=) so reloading, or
// going back, lands where you were.
export function ScenesTab({ campaignId, campaignInfo, maps, renderCombat }) {
    const { sessions, scenes, status, createSession, updateSession, createScene, updateScene, deleteScene } = useScenes(campaignId);
    const { encounters } = useEncounters(campaignId);
    const [params, setParams] = useSearchParams();
    const [newScene, setNewScene] = useState(null);
    const [deciding, setDeciding] = useState(null);

    const view = ['build', 'run'].includes(params.get('view')) ? params.get('view') : 'scenes';
    const session = sessions.find(candidate => candidate.id === params.get('session')) || null;
    const selected = scenes.find(candidate => candidate.id === params.get('scene')) || null;
    const active = useMemo(() => activeScene(scenes), [scenes]);
    const sceneForView = selected || (view === 'run' ? active : null);
    const sceneSession = sceneForView ? sessions.find(candidate => candidate.id === sceneForView.sessionId) || null : null;

    const go = next => {
        const search = new URLSearchParams();
        Object.entries(next).forEach(([key, value]) => value && search.set(key, value));
        setParams(search);
    };
    const goCampaign = () => go({});
    const goSession = id => go({ session: id });
    const goBuild = id => go({ view: 'build', scene: id });
    const goRun = id => go({ view: 'run', scene: id });

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

    async function handleCreateScene({ name, type, sessionId, inWorldDate, timeMin, timeMax, afterSceneId, duplicateOf }) {
        const original = duplicateOf ? scenes.find(candidate => candidate.id === duplicateOf) : null;
        const id = await createScene({
            sessionId, name, type, inWorldDate, timeMin, timeMax,
            order: orderAfter(scenes, sessionId, afterSceneId === undefined ? mainEndId(sessionId) : afterSceneId),
            ...(original ? { premise: original.premise || '', beats: copyBeats(original.beats), episode: original.episode || '' } : {}),
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
            inWorldDate: scene.inWorldDate, timeMin: scene.timeMin, timeMax: scene.timeMax, beats: copyBeats(scene.beats),
            order: orderAfter(scenes, scene.sessionId, scene.id),
        }).catch(fail("Couldn't duplicate the scene: "));
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

    // ---- Running ---------------------------------------------------------

    async function startScene(scene) {
        const others = scenes.filter(other => other.status === 'active' && other.id !== scene.id);
        await Promise.all(others.map(other => updateScene(other.id, { status: 'ready', run: pauseRun(other.run || {}) })));
        await updateScene(scene.id, { status: 'active', run: startRun(scene) });
    }

    async function endScene(scene) {
        await updateScene(scene.id, { status: 'completed', run: pauseRun(scene.run || {}) });
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
    if (status === 'loading') body = <div className="Scenes-view"><p className="Scenes-muted" role="status">Loading scenes…</p></div>;
    else if (status === 'error') body = <div className="Scenes-view"><p role="alert">{"Couldn't load the scenes. Only the campaign's directors can see them."}</p></div>;
    else if (view === 'build' || view === 'run') {
        body = <SceneWorkspace view={view} scene={sceneForView} session={sceneSession} scenes={scenes} encounters={encounters} maps={maps}
            renderCombat={renderCombat} actions={{
                saveScene, createPathScene, goRun, goBuild, goCampaign, goSession,
                updateScene: (id, patch) => updateScene(id, patch).catch(fail("Couldn't save: ")),
                startScene: scene => startScene(scene).catch(fail("Couldn't start the scene: ")),
                endScene: scene => endScene(scene).catch(fail("Couldn't end the scene: ")),
                switchScene: (from, toId) => switchScene(from, toId).catch(fail("Couldn't switch scenes: ")),
                decide: (sceneId, beatId) => setDeciding({ sceneId, beatId }),
                startCombat,
            }}/>;
    } else if (session) {
        body = <ScenesSessionView sessions={sessions} scenes={scenes} session={session} onBack={goCampaign} onOpenSession={goSession}
            onNewScene={openNewScene} onEdit={goBuild} onRun={goRun} onDecide={(sceneId, beatId) => setDeciding({ sceneId, beatId })}
            onDuplicate={duplicateScene} onBench={benchScene} onDelete={deleteSceneWithConfirm} onBringBack={bringBack} onKeepForLater={keepForLater}
            onUpdateSession={(id, patch) => updateSession(id, patch).catch(fail("Couldn't save: "))}/>;
    } else {
        body = <ScenesCampaignView sessions={sessions} scenes={scenes} onOpenSession={goSession} onNewSession={createNewSession} onNewScene={openNewScene}/>;
    }

    // from Build or Run, Timeline goes back to that scene's session
    const timelineSessionId = view === 'scenes' ? null : (session || sceneSession)?.id;
    const decidingOwner = deciding ? scenes.find(candidate => candidate.id === deciding.sceneId) : null;
    const decidingBeat = decidingOwner?.beats?.find(candidate => candidate.id === deciding.beatId);

    return <div className="Scenes">
        <ScenesNav view={view} timelineSessionId={timelineSessionId} buildTarget={selected || active} runTarget={active || selected} live={Boolean(active)}
            go={{ go, goCampaign, goSession, goBuild, goRun }}/>
        <div className="Scenes-body">{body}</div>
        {newScene && <NewSceneDialog sessions={sessions} scenes={scenes} defaultSessionId={newScene.sessionId} afterSceneId={newScene.afterSceneId}
            onCreate={handleCreateScene} onClose={() => setNewScene(null)}/>}
        {decidingOwner && decidingBeat && <SceneDecisionDialog owner={decidingOwner} beat={decidingBeat} scenes={scenes}
            onConfirm={confirmDecision} onAddPath={addPathOnTheFly} onClose={() => setDeciding(null)}/>}
    </div>;
}

