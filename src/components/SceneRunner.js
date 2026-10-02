import { useEffect, useState } from 'react';
import {
    advanceRun, beatState, beatTypeLabel, formatClock, jumpRun, newBeat, optionLetter, optionState, pauseRun, runElapsedMs,
    sessionTitle, splitParagraphs, startRun, timeGoalText,
} from '../utils/scenes';

const STATE_TEXT = { done: '✓ Done', now: 'Now', upcoming: 'Upcoming' };
const FONT_SIZES = [15, 17, 20, 24, 28];

// The narration beat: read-aloud text a paragraph at a time, as large as the
// narrator wants it.
function NarrationView({ beat }) {
    const paragraphs = splitParagraphs(beat.text);
    const [index, setIndex] = useState(0);
    const [size, setSize] = useState(2);
    useEffect(() => setIndex(0), [beat.id]);
    const last = Math.max(paragraphs.length - 1, 0);
    return <>
        <div className="Scenes-run-beat-tools">
            <span className="Scenes-muted">{beat.narrator ? `Narrator: ${beat.narrator}` : 'Read aloud'}</span>
            <button type="button" className="Scenes-icon-button" aria-label="Smaller text" disabled={size === 0} onClick={() => setSize(value => Math.max(0, value - 1))}>A&minus;</button>
            <button type="button" className="Scenes-icon-button" aria-label="Larger text" disabled={size === FONT_SIZES.length - 1} onClick={() => setSize(value => Math.min(FONT_SIZES.length - 1, value + 1))}>A+</button>
        </div>
        {paragraphs.length === 0
            ? <p className="Scenes-muted">There is nothing written for this narration. Add text in Build Scene.</p>
            : <div className="Scenes-read-aloud">
                <span className="Scenes-field-label">Read aloud</span>
                <p style={{ fontSize: FONT_SIZES[size] }}>{paragraphs[index]}</p>
                <div className="Scenes-read-aloud-foot">
                    <span className="Scenes-muted">{`paragraph ${index + 1} of ${paragraphs.length}`}</span>
                    <button type="button" className="Scenes-button" onClick={() => setIndex(value => Math.min(last, value + 1))} disabled={index >= last}>
                        {index >= last ? 'All read' : 'Mark read & show next paragraph'}
                    </button>
                </div>
            </div>}
    </>;
}

// An NPC's behaviors, one per line, each with a key of its own.
const behaviorLines = beat => (beat.behaviors || '').split('\n').map(line => line.trim()).filter(Boolean).map((line, position) => ({ id: `${beat.id}:${position}`, line }));

function BeatView({ beat, scene, scenes, onDecide, onStartCombat, renderCombat, onAdvance }) {
    switch (beat.type) {
        case 'narration':
            return <NarrationView beat={beat}/>;
        case 'npc':
            return <div className="Scenes-card">
                <div className="Scenes-run-npc"><span className="Scenes-chip">NPC</span><strong>{beat.npcName || 'Unnamed NPC'}</strong></div>
                <ul className="Scenes-list">{behaviorLines(beat).map(entry => <li key={entry.id}>{entry.line}</li>)}</ul>
            </div>;
        case 'check':
            return <div className="Scenes-card">
                <div className="Scenes-run-npc"><span className="Scenes-chip">Check</span><strong>{[beat.skill, beat.dc && `DC ${beat.dc}`].filter(Boolean).join(' · ') || 'Roll or ruling'}</strong></div>
                {beat.text && <p>{beat.text}</p>}
            </div>;
        case 'decision':
            return <div className="Scenes-card">
                <div className="Scenes-run-npc"><span className="Scenes-chip Scenes-chip-decision">Decision</span><strong>{beat.title || 'Where does the party go?'}</strong></div>
                <ul className="Scenes-list">
                    {(beat.options || []).map((option, index) => {
                        const optionScene = scenes.find(candidate => candidate.id === option.sceneId);
                        return <li key={option.id}>{`${optionLetter(index)} · ${option.label || optionScene?.name || 'Untitled path'}`}{{ taken: ' — taken', skipped: " — didn't happen", possible: '' }[optionState(beat, option)]}</li>;
                    })}
                </ul>
                <button type="button" className="Scenes-button Scenes-button-primary" onClick={() => onDecide(scene.id, beat.id)}>{beat.chosenOptionId ? 'Change decision' : 'Decide the path…'}</button>
            </div>;
        case 'combat':
            return <>
                <div className="Scenes-run-combat-bar">
                    {(beat.encounterId || beat.mapId) && <button type="button" className="Scenes-button" onClick={() => onStartCombat(beat)}>
                        {beat.started ? 'Stage the encounter again' : 'Start combat (set the map, stage the encounter)'}
                    </button>}
                    <span className="Scenes-muted">Combat is tracked as usual. Moving to another beat pauses it without changing the tracker or the map.</span>
                </div>
                {renderCombat()}
            </>;
        default:
            return <div className="Scenes-card Scenes-cue">
                <div className="Scenes-run-npc"><span className="Scenes-chip">Cue</span><span className="Scenes-muted">Director only</span></div>
                <p>{beat.text || 'Nothing written for this cue.'}</p>
                <button type="button" className="Scenes-button" onClick={onAdvance}>Mark done</button>
            </div>;
    }
}

// Before a scene is running: what it is, and the button that starts it.
function SceneStartCard({ scene, session, onStart, onOpenBuilder }) {
    const beats = scene.beats || [];
    return <div className="Scenes-view">
        <div className="Scenes-card Scenes-run-start">
            <span className="Scenes-eyebrow">{sessionTitle(session)}</span>
            <h2 className="Scenes-title">{scene.name || 'Untitled scene'}</h2>
            {scene.premise && <p className="Scenes-muted">{scene.premise}</p>}
            <p className="Scenes-muted">{`${beats.length} ${beats.length === 1 ? 'beat' : 'beats'} · time goal: ${timeGoalText(scene)}`}</p>
            {scene.status === 'completed' && <p className="Scenes-muted">This scene has been run. Starting it again picks up where you left off.</p>}
            <div className="Scenes-row-actions">
                <button type="button" className="Scenes-button Scenes-button-primary" disabled={beats.length === 0} onClick={() => onStart(scene)}>
                    {scene.run?.doneBeatIds?.length ? 'Resume scene' : 'Start scene'}
                </button>
                <button type="button" className="Scenes-button" onClick={() => onOpenBuilder(scene.id)}>Edit in Build Scene</button>
            </div>
            {beats.length === 0 && <p className="Scenes-muted">This scene has no beats yet. Build it first.</p>}
        </div>
    </div>;
}

// Run Scene: one scene at a time, a beat at a time. The rail down the side is the
// scene's beats (what is done, what is now, what is next); the middle is whatever
// the current beat needs - read-aloud text, an NPC's behaviors, a cue, the combat
// tracker - and the director's own scratchpad for the beat sits to the right.
export function SceneRunner({ scene, scenes, session, onUpdate, onStart, onEnd, onSwitch, onDecide, onStartCombat, renderCombat, onOpenBuilder }) {
    const run = scene.run;
    const live = scene.status === 'active' && Boolean(run);
    const beats = scene.beats || [];
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (!run?.startedAt) return undefined;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [run?.startedAt]);

    const current = beats.find(beat => beat.id === run?.currentBeatId) || null;
    const currentIndex = current ? beats.indexOf(current) : -1;
    const [notes, setNotes] = useState(current?.notes || '');
    useEffect(() => setNotes(current?.notes || ''), [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!live) return <SceneStartCard scene={scene} session={session} onStart={onStart} onOpenBuilder={onOpenBuilder}/>;

    const elapsed = runElapsedMs(run, now);
    const goalMax = scene.timeMax || scene.timeMin || 0;
    const percent = goalMax ? Math.min(100, (elapsed / 60000 / goalMax) * 100) : 0;
    const next = beats.slice(currentIndex + 1).find(beat => beatState(scene, beat) !== 'done');
    const update = patch => onUpdate(scene.id, patch);
    const paused = !run.startedAt;
    const pinned = beats.filter(beat => beat.type === 'combat' && beat.ruling && beat.id !== current?.id && beatState(scene, beat) !== 'upcoming');

    function addBeatOnTheFly() {
        const beat = { ...newBeat('cue'), title: 'Improvised beat' };
        const index = currentIndex < 0 ? beats.length : currentIndex + 1;
        update({ beats: [...beats.slice(0, index), beat, ...beats.slice(index)], run: jumpRun(scene, beat.id) });
    }

    return <div className="Scenes-run">
        <div className="Scenes-run-head">
            <div className="Scenes-run-title">
                <h2 className="Scenes-title">{scene.name || 'Untitled scene'}</h2>
                <span className={paused ? 'Scenes-chip' : 'Scenes-chip Scenes-chip-now'}>{`${paused ? 'Paused' : 'Live'} · Beat ${currentIndex >= 0 ? currentIndex + 1 : beats.length} of ${beats.length}`}</span>
                <span className="Scenes-muted">{`${sessionTitle(session)}${scene.inWorldDate ? ' · ' + scene.inWorldDate : ''}`}</span>
                <div className="Scenes-run-clock">
                    {goalMax > 0 && <div className="Scenes-meter" aria-hidden="true"><div style={{ width: `${percent}%` }}/></div>}
                    <span className="Scenes-clock" aria-label="Time elapsed">{formatClock(elapsed)}</span>
                    <span className="Scenes-muted">{goalMax > 0 ? `of ${timeGoalText(scene)}` : 'no time goal'}</span>
                </div>
            </div>
            <div className="Scenes-run-actions">
                <select aria-label="Switch scene" value="" onChange={event => event.target.value && onSwitch(scene, event.target.value)}>
                    <option value="">Switch Scene ▾</option>
                    {scenes.filter(other => other.id !== scene.id && other.sessionId === scene.sessionId && !other.benched && (other.beats || []).length > 0).map(other => <option key={other.id} value={other.id}>{other.name || 'Untitled scene'}</option>)}
                </select>
                <button type="button" className="Scenes-button" onClick={() => update({ run: paused ? startRun(scene) : pauseRun(run) })}>{paused ? 'Resume clock' : 'Pause clock'}</button>
                <button type="button" className="Scenes-button Scenes-button-primary" disabled={!current} onClick={() => update({ run: advanceRun(scene) })}>Next beat &rarr;</button>
                <button type="button" className="Scenes-button" onClick={() => onEnd(scene)}>End Scene</button>
            </div>
        </div>

        <div className="Scenes-run-body">
            <nav className="Scenes-rail" aria-label="Beats">
                <span className="Scenes-field-label">Beats</span>
                {beats.map((beat, index) => {
                    const state = beatState(scene, beat);
                    return <button type="button" key={beat.id} className={`Scenes-rail-item Scenes-rail-item-${state}`} aria-current={state === 'now' ? 'step' : undefined}
                        onClick={() => update({ run: jumpRun(scene, beat.id) })}>
                        <span className="Scenes-rail-state">{`${STATE_TEXT[state]} · ${beatTypeLabel(beat.type)}`}</span>
                        <span className="Scenes-rail-title">{`${index + 1} · ${beat.title || 'Untitled beat'}`}</span>
                    </button>;
                })}
                <button type="button" className="Scenes-rail-add" onClick={addBeatOnTheFly}>+ Add beat on the fly</button>
            </nav>

            <div className="Scenes-run-center">
                {pinned.map(beat => <div className="Scenes-pinned" key={beat.id}><span className="Scenes-field-label">Ruling</span><span>{beat.ruling}</span></div>)}
                {current
                    ? <>
                        <div className="Scenes-run-beat-head">
                            <span className={`Scenes-chip Scenes-chip-beat-${current.type}`}>{beatTypeLabel(current.type)}</span>
                            <h3 className="Scenes-run-beat-title">{current.title || 'Untitled beat'}</h3>
                        </div>
                        {current.type === 'combat' && current.ruling && <div className="Scenes-pinned"><span className="Scenes-field-label">Ruling</span><span>{current.ruling}</span></div>}
                        <BeatView beat={current} scene={scene} scenes={scenes} onDecide={onDecide} onStartCombat={beat => onStartCombat(scene, beat)} renderCombat={renderCombat}
                            onAdvance={() => update({ run: advanceRun(scene) })}/>
                    </>
                    : <div className="Scenes-card">
                        <strong>Every beat is done.</strong>
                        <p className="Scenes-muted">End the scene when you're ready to move on, or pick a beat from the list to go back to it.</p>
                        <button type="button" className="Scenes-button Scenes-button-primary" onClick={() => onEnd(scene)}>End Scene</button>
                    </div>}
            </div>

            <aside className="Scenes-run-side">
                <section className="Scenes-card">
                    <div className="Scenes-card-head"><h3 className="Scenes-card-title">Scratchpad</h3><span className="Scenes-muted">Saved to this beat</span></div>
                    <textarea className="Scenes-textarea" aria-label="Director scratchpad" rows={6} disabled={!current} value={notes}
                        onChange={event => setNotes(event.target.value)}
                        onBlur={() => current && notes !== (current.notes || '') && update({ beats: beats.map(beat => beat.id === current.id ? { ...beat, notes } : beat) })}/>
                </section>
                <section className="Scenes-card">
                    <h3 className="Scenes-card-title">Up next</h3>
                    {next
                        ? <>
                            <strong>{`${beats.indexOf(next) + 1} · ${next.title || 'Untitled beat'}`}</strong>
                            <span className="Scenes-muted">{next.type === 'decision' ? 'Decide the path.' : (next.text || next.ruling || beatTypeLabel(next.type))}</span>
                        </>
                        : <span className="Scenes-muted">That's the last beat.</span>}
                </section>
            </aside>
        </div>
    </div>;
}
