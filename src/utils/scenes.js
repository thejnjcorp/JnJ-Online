// Scenes: how a director plans and runs a campaign.
//
// A campaign is a list of sessions; a session is a list of scenes in the order
// they happen; a scene is a list of beats (narration, an NPC, a check, a fight,
// a cue to yourself, or a decision) that the director runs one after another.
// A decision beat is where the story can split: each option leads to a scene of
// its own, only one of them runs, and the rest are marked "didn't happen" so the
// director can keep them for later or throw them away.
//
// Sessions and scenes are plain documents (campaigns/{id}/sessions, .../scenes,
// see useScenes.js). Nothing here touches Firestore: this file is the shape of
// those documents and the pure functions the director's views are built from.

export const SCENE_TYPES = [
    { key: 'roleplay', label: 'Roleplay' },
    { key: 'combat', label: 'Combat' },
    { key: 'mixed', label: 'Mixed' },
];

export const SCENE_STATUSES = [
    { key: 'draft', label: 'Draft' },
    { key: 'ready', label: 'Ready' },
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
    // a path the party didn't take
    { key: 'skipped', label: "Didn't happen" },
];

export const BEAT_TYPES = [
    { key: 'narration', label: 'Narration', hint: 'Read-aloud text' },
    { key: 'npc', label: 'NPC', hint: 'Voice and behaviors' },
    { key: 'check', label: 'Check', hint: 'Roll or ruling' },
    { key: 'combat', label: 'Combat', hint: 'Map and encounter' },
    { key: 'cue', label: 'Cue', hint: 'Director-only note' },
    { key: 'decision', label: 'Decision', hint: 'Paths that may not happen' },
];

export const DECISION_METHODS = [
    { key: 'party', label: 'Party choice' },
    { key: 'random', label: 'Random table (d6)' },
    { key: 'check', label: 'Check result' },
];

export const typeLabel = key => SCENE_TYPES.find(type => type.key === key)?.label || 'Roleplay';
export const statusLabel = key => SCENE_STATUSES.find(status => status.key === key)?.label || 'Draft';
export const beatTypeLabel = key => BEAT_TYPES.find(type => type.key === key)?.label || 'Cue';

const READ_ALOUD_WORDS_PER_MINUTE = 150;

let idCounter = 0;
export function newId() {
    idCounter += 1;
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}${idCounter.toString(36)}`; // NOSONAR - a label for a row in a list, not a secret
}

// A letter for a decision option: A, B, C ...
export const optionLetter = index => String.fromCodePoint(65 + (index % 26));

export function newBeat(type = 'cue') {
    const base = { id: newId(), type, title: '', minutes: 0, notes: '' };
    switch (type) {
        case 'narration': return { ...base, narrator: '', text: '' };
        case 'npc': return { ...base, npcName: '', behaviors: '' };
        case 'check': return { ...base, skill: '', dc: '', text: '' };
        case 'combat': return { ...base, encounterId: '', mapId: '', ruling: '', minutes: 20 };
        case 'decision': return {
            ...base, method: 'party',
            options: [{ id: newId(), label: '', sceneId: '' }, { id: newId(), label: '', sceneId: '' }],
            rejoinSceneId: '', chosenOptionId: '',
        };
        default: return { ...base, text: '', trigger: '' };
    }
}

export function newScene(fields = {}) {
    return {
        sessionId: '', name: '', premise: '', type: 'roleplay', status: 'draft', inWorldDate: '',
        timeMin: null, timeMax: null, episode: '', order: Date.now(), branch: null, benched: false,
        beats: [], run: null,
        ...fields,
    };
}

export const newSession = (number, fields = {}) => ({
    number, name: '', arc: '', inWorldDate: '', order: number,
    ...fields,
});

export const sessionTitle = session => session.name ? `Session ${session.number} · ${session.name}` : `Session ${session.number}`;

// ---- Beats ---------------------------------------------------------------

export const wordCount = text => (String(text || '').trim().match(/\S+/g) || []).length;

// Narration is timed by its length (at a read-aloud pace, at least a minute); every
// other beat by the minutes the director gave it.
export function beatMinutes(beat) {
    if (beat.type === 'narration') return wordCount(beat.text) === 0 ? 0 : Math.max(1, Math.round(wordCount(beat.text) / READ_ALOUD_WORDS_PER_MINUTE));
    return Math.max(Number(beat.minutes) || 0, 0);
}

export const estimateMinutes = scene => (scene.beats || []).reduce((total, beat) => total + beatMinutes(beat), 0);

export const splitParagraphs = text => String(text || '').split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);

export const decisionBeatOf = scene => [...(scene.beats || [])].reverse().find(beat => beat.type === 'decision') || null;

export function beatCount(scene) {
    const count = (scene.beats || []).length;
    return `${count} ${count === 1 ? 'beat' : 'beats'}`;
}

// "30–50 min", "8 min", or "No goal set".
export function timeGoalText(scene) {
    const { timeMin, timeMax } = scene;
    if (timeMin && timeMax && timeMin !== timeMax) return `${timeMin}–${timeMax} min`;
    if (timeMin || timeMax) return `${timeMin || timeMax} min`;
    return 'No goal set';
}

// A scene with nothing in it to run yet is a draft whatever its status says.
export const hasBeats = scene => (scene.beats || []).length > 0;

// ---- A session's timeline ------------------------------------------------

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.name || '').localeCompare(String(b.name || ''));

// The scenes of one session that sit on the main line: not a branch of a decision
// and not put on the bench, in the order they happen.
export const mainScenes = (scenes, sessionId) =>
    scenes.filter(scene => scene.sessionId === sessionId && !scene.branch && !scene.benched).sort(byOrder);

export function optionState(beat, option) {
    if (!beat.chosenOptionId) return 'possible';
    return beat.chosenOptionId === option.id ? 'taken' : 'skipped';
}

// What the session view draws, top to bottom: each main-line scene, and straight
// after a scene that ends in a decision, that decision with its paths side by side.
export function buildTimeline(scenes, sessionId) {
    const byId = new Map(scenes.map(scene => [scene.id, scene]));
    const items = [];
    mainScenes(scenes, sessionId).forEach(scene => {
        items.push({ kind: 'scene', scene });
        const beat = decisionBeatOf(scene);
        if (!beat) return;
        items.push({
            kind: 'decision', scene, beat,
            paths: (beat.options || []).map((option, index) => ({
                option, letter: optionLetter(index), state: optionState(beat, option), scene: byId.get(option.sceneId) || null,
            })),
            rejoin: byId.get(beat.rejoinSceneId) || null,
        });
    });
    return items;
}

// The main-line scenes with the one a decision actually took in place of the
// decision's paths, i.e. what the session really played out as: the scenes that
// count toward "Played" and the pips on the campaign view.
export function playedScenes(scenes, sessionId) {
    const byId = new Map(scenes.map(scene => [scene.id, scene]));
    const result = [];
    mainScenes(scenes, sessionId).forEach(scene => {
        result.push(scene);
        const beat = decisionBeatOf(scene);
        if (!beat) return;
        (beat.options || []).forEach(option => {
            const optionScene = byId.get(option.sceneId);
            if (optionScene && optionState(beat, option) !== 'skipped') result.push(optionScene);
        });
    });
    return result;
}

// 'now' while any of its scenes is being run, 'played' once everything that was
// going to happen has, otherwise 'planned'.
export function sessionState(scenes, sessionId) {
    const scenesOf = playedScenes(scenes, sessionId);
    if (scenesOf.some(scene => scene.status === 'active')) return 'now';
    if (scenesOf.length > 0 && scenesOf.every(scene => scene.status === 'completed' || scene.status === 'skipped')) return 'played';
    return 'planned';
}

export function sessionStats(scenes, sessionId) {
    const main = mainScenes(scenes, sessionId);
    const decisions = main.filter(decisionBeatOf);
    const didntHappen = scenes.filter(scene => scene.sessionId === sessionId && scene.status === 'skipped').length;
    return { scenes: main.length, decisions: decisions.length, didntHappen };
}

// The order value that puts a scene straight after `afterSceneId` (or first, with
// null) without renumbering anything: half-way between it and the next one.
export function orderAfter(scenes, sessionId, afterSceneId) {
    const main = mainScenes(scenes, sessionId);
    if (afterSceneId === null) return main.length ? (main[0].order ?? 0) - 1000 : Date.now();
    const index = main.findIndex(scene => scene.id === afterSceneId);
    if (index < 0) return (main.length ? main[main.length - 1].order : 0) + 1000;
    const current = main[index].order ?? 0;
    const next = main[index + 1];
    return next ? (current + (next.order ?? current + 2000)) / 2 : current + 1000;
}

// The sessions grouped into arcs, in order; sessions with no arc share one group.
export function groupArcs(sessions) {
    const sorted = [...sessions].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
    const groups = [];
    sorted.forEach(session => {
        const arc = (session.arc || '').trim();
        const last = groups.at(-1);
        if (last && last.arc === arc) last.sessions.push(session);
        else groups.push({ arc, sessions: [session] });
    });
    return groups;
}

// The scene the director is in the middle of, if any.
export const activeScene = scenes => scenes.find(scene => scene.status === 'active') || null;

// ---- Deciding ------------------------------------------------------------

// The changes that settle a decision beat on `optionId`: the beat records what was
// chosen and every other path's scene is marked "didn't happen". Returns the beat
// list for the deciding scene and a patch per scene that was not taken.
export function settleDecision(scene, beatId, optionId, scenes, { keepSkipped = true } = {}) {
    const beat = (scene.beats || []).find(candidate => candidate.id === beatId);
    if (!beat) return null;
    const skippedIds = (beat.options || []).filter(option => option.id !== optionId && option.sceneId).map(option => option.sceneId);
    const beats = scene.beats.map(candidate => candidate.id === beatId ? { ...candidate, chosenOptionId: optionId } : candidate);
    const taken = (beat.options || []).find(option => option.id === optionId);
    const patches = {};
    skippedIds.forEach(id => {
        if (scenes.some(other => other.id === id)) patches[id] = { status: 'skipped', ...(keepSkipped ? { benched: true } : {}) };
    });
    return { beats, patches, takenSceneId: taken?.sceneId || '', discardIds: keepSkipped ? [] : Object.keys(patches) };
}

// ---- Running a scene -----------------------------------------------------

export function startRun(scene, now = Date.now()) {
    const beats = scene.beats || [];
    const run = scene.run || {};
    return {
        startedAt: now,
        accumulatedMs: run.accumulatedMs || 0,
        currentBeatId: run.currentBeatId || beats.find(beat => !(run.doneBeatIds || []).includes(beat.id))?.id || beats[0]?.id || '',
        doneBeatIds: run.doneBeatIds || [],
    };
}

export function pauseRun(run, now = Date.now()) {
    if (!run?.startedAt) return run;
    return { ...run, startedAt: null, accumulatedMs: (run.accumulatedMs || 0) + (now - run.startedAt) };
}

export function runElapsedMs(run, now = Date.now()) {
    if (!run) return 0;
    const running = run.startedAt ? Math.max(0, now - run.startedAt) : 0;
    return (run.accumulatedMs || 0) + running;
}

export function formatClock(ms) {
    const total = Math.floor(ms / 1000);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// A beat as the runner's rail shows it: done, the one being run, or still to come.
export function beatState(scene, beat) {
    const run = scene.run || {};
    if ((run.doneBeatIds || []).includes(beat.id)) return 'done';
    if (run.currentBeatId === beat.id) return 'now';
    return 'upcoming';
}

// Mark the current beat done and move on to the next one that is not (null once
// there is nothing left to run).
export function advanceRun(scene) {
    const beats = scene.beats || [];
    const run = scene.run || {};
    const done = new Set(run.doneBeatIds || []);
    if (run.currentBeatId) done.add(run.currentBeatId);
    const currentIndex = beats.findIndex(beat => beat.id === run.currentBeatId);
    const next = [...beats.slice(currentIndex + 1), ...beats.slice(0, Math.max(currentIndex, 0))].find(beat => !done.has(beat.id));
    return { ...run, doneBeatIds: [...done], currentBeatId: next?.id || '' };
}

export const jumpRun = (scene, beatId) => ({ ...scene.run, currentBeatId: beatId });

// Firestore refuses `undefined` anywhere in a document; drop it from a patch.
export function withoutUndefined(value) {
    if (Array.isArray(value)) return value.map(withoutUndefined);
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
        return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).map(([key, entry]) => [key, withoutUndefined(entry)]));
    }
    return value;
}

// ---- Branch links --------------------------------------------------------

// When a scene's beats change, the scenes its decision options lead to have to
// follow: a scene an option points at becomes a path of that decision (so it leaves
// the main line), and one that no option points at any more goes back onto it.
// Returns a `branch` patch per scene that needs one.
export function branchLinkPatches(scene, nextBeats, scenes) {
    const wanted = new Map();
    (nextBeats || []).filter(beat => beat.type === 'decision').forEach(beat => {
        (beat.options || []).forEach(option => {
            if (option.sceneId && option.sceneId !== scene.id) wanted.set(option.sceneId, { fromSceneId: scene.id, optionId: option.id });
        });
    });
    const patches = {};
    scenes.forEach(other => {
        const current = other.branch || null;
        const target = wanted.get(other.id) || null;
        if (target) {
            if (!current || current.fromSceneId !== target.fromSceneId || current.optionId !== target.optionId) {
                patches[other.id] = { branch: target, sessionId: scene.sessionId };
            }
        } else if (current && current.fromSceneId === scene.id) {
            patches[other.id] = { branch: null };
        }
    });
    return patches;
}

// ---- The campaign view's pips --------------------------------------------

const pipOfScene = scene => ({ completed: 'done', active: 'now', skipped: 'skipped' }[scene.status] || 'planned');

// One small mark per scene (and per decision) of a session, in order, for the
// overview of every session: done, now, planned, didn't happen, decision.
export function timelinePips(scenes, sessionId) {
    const pips = [];
    buildTimeline(scenes, sessionId).forEach(item => {
        if (item.kind === 'scene') pips.push({ key: item.scene.id, state: pipOfScene(item.scene), label: item.scene.name });
        else {
            pips.push({ key: `${item.scene.id}:decision`, state: 'decision', label: 'Decision' });
            item.paths.forEach(path => path.scene && pips.push({ key: path.scene.id, state: pipOfScene(path.scene), label: path.scene.name }));
        }
    });
    return pips;
}

// The beats of the scene that decides, with every option leading to `sceneId`
// pointing nowhere instead - for when that scene is thrown away or taken off the
// decision. Null when nothing pointed at it.
export function unlinkScene(owner, sceneId) {
    let changed = false;
    const beats = (owner.beats || []).map(beat => {
        if (beat.type !== 'decision') return beat;
        const options = (beat.options || []).map(option => {
            if (option.sceneId !== sceneId) return option;
            changed = true;
            return { ...option, sceneId: '' };
        });
        return { ...beat, options };
    });
    return changed ? beats : null;
}

// A copy of a scene's beats for a new scene: every beat gets its own id, and a
// decision starts with no scenes linked and nothing chosen (those belong to the
// original).
export function copyBeats(beats = []) {
    return beats.map(beat => {
        const copy = { ...beat, id: newId() };
        if (beat.type === 'decision') {
            copy.options = (beat.options || []).map(option => ({ ...option, id: newId(), sceneId: '' }));
            copy.chosenOptionId = '';
            copy.rejoinSceneId = '';
        }
        return copy;
    });
}

// How ready a scene is to run, in words: whether it has anything in it yet.
export function readiness(scene) {
    if (scene.status === 'completed' || scene.status === 'active') return statusLabel(scene.status);
    if (!hasBeats(scene)) return 'Draft · no beats yet';
    return scene.status === 'ready' ? 'Ready' : 'Draft';
}
