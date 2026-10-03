import { useEffect, useState } from 'react';
import {
    BEAT_TYPES, advanceRun, beatState, beatTypeLabel, blockedBeatIds, completeBeat, formatClock, jumpRun, newBeat, optionLetter, optionState, pauseRun, runElapsedMs,
    sceneDateText, sessionTitle, splitParagraphs, startRun, timeGoalText,
} from '../utils/scenes';
import { CalendarSync, EndSceneCard, MoveCalendarOption, endAsksAboutCalendar } from './SceneCalendarParts';
import { Attachments, BeatRail, CallCheck, CheckCard, DueCues, NpcCard, PausedCombatNote, RulingCard, WaitingOn, usesStatBlock } from './SceneRunnerParts';
import { useBestiary } from '../utils/useBestiary';
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

function BeatView({ beat, scene, scenes, bestiary, onDecide, onStartCombat, onOpenMaps, combat, onAdvance, onWaiting }) {
    switch (beat.type) {
        case 'narration':
            return <><NarrationView beat={beat}/><Attachments beat={beat} bestiary={bestiary}/></>;
        case 'npc':
            return <><NpcCard id={beat.id} npcName={beat.npcName} behaviors={beat.behaviors} enemyId={beat.enemyId} bestiary={bestiary}/><Attachments beat={beat} bestiary={bestiary}/></>;
        case 'check':
            return <><CheckCard skill={beat.skill} dc={beat.dc} text={beat.text}/><Attachments beat={beat} bestiary={bestiary}/></>;
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
                    <button type="button" className="Scenes-button" onClick={onOpenMaps}>Browse maps</button>
                    <span className="Scenes-muted">Combat is tracked as usual. Moving to another beat pauses it without changing the tracker or the map.</span>
                </div>
                {combat?.main}
            </>;
        default:
            return <>
                <div className="Scenes-card Scenes-cue">
                    <div className="Scenes-run-npc"><span className="Scenes-chip">Cue</span><span className="Scenes-muted">Director only</span></div>
                    <p>{beat.text || 'Nothing written for this cue.'}</p>
                    <WaitingOn beat={beat} onChange={onWaiting}/>
                    <button type="button" className="Scenes-button" onClick={onAdvance}>Mark done</button>
                </div>
                <Attachments beat={beat} bestiary={bestiary}/>
            </>;
    }
}

// Before a scene is running: what it is, and the button that starts it.
function SceneStartCard({ scene, session, onStart, onOpenBuilder, calendar }) {
    const beats = scene.beats || [];
    const [moveCalendar, setMoveCalendar] = useState(true);
    return <div className="Scenes-view">
        <div className="Scenes-card Scenes-run-start">
            <span className="Scenes-eyebrow">{sessionTitle(session)}</span>
            <h2 className="Scenes-title">{scene.name || 'Untitled scene'}</h2>
            {scene.premise && <p className="Scenes-muted">{scene.premise}</p>}
            <p className="Scenes-muted">{`${beats.length} ${beats.length === 1 ? 'beat' : 'beats'} · time goal: ${timeGoalText(scene)}`}</p>
            {scene.status === 'completed' && <p className="Scenes-muted">This scene has been run. Starting it again picks up where you left off.</p>}
            <div className="Scenes-row-actions">
                <button type="button" className="Scenes-button Scenes-button-primary" disabled={beats.length === 0} onClick={() => onStart(scene, { moveCalendar })}>
                    {scene.run?.doneBeatIds?.length ? 'Resume scene' : 'Start scene'}
                </button>
                <button type="button" className="Scenes-button" onClick={() => onOpenBuilder(scene.id)}>Edit in Build Scene</button>
            </div>
            {calendar && <MoveCalendarOption scene={scene} calendar={calendar} checked={moveCalendar} onChange={setMoveCalendar}/>}
            {beats.length === 0 && <p className="Scenes-muted">This scene has no beats yet. Build it first.</p>}
        </div>
    </div>;
}

// The time, once a second for as long as there is something running to time.
function useNow(startedAt) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (!startedAt) return undefined;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [startedAt]);
    return now;
}

// How long the scene has run, against the time the director hoped to spend on it.
function RunClock({ scene, run, now }) {
    const elapsed = runElapsedMs(run, now);
    const goalMax = scene.timeMax || scene.timeMin || 0;
    const percent = goalMax ? Math.min(100, (elapsed / 60000 / goalMax) * 100) : 0;
    return <div className="Scenes-run-clock">
        {goalMax > 0 && <div className="Scenes-meter" aria-hidden="true"><div style={{ width: `${percent}%` }}/></div>}
        <span className="Scenes-clock" aria-label="Time elapsed">{formatClock(elapsed)}</span>
        <span className="Scenes-muted">{goalMax > 0 ? `of ${timeGoalText(scene)}` : 'no time goal'}</span>
    </div>;
}

// Run Scene: one scene at a time, a beat at a time. The rail down the side is the
// scene's beats (what is done, what is now, what is next); the middle is whatever
// the current beat needs - read-aloud text, an NPC's behaviors, a cue, the combat
// tracker - and the director's own scratchpad for the beat sits to the right.
export function SceneRunner({ scene, scenes, session, calendar = null, onSyncCalendar = null, onUpdate, onStart, onEnd, onSwitch, onDecide, onStartCombat, renderCombat, onOpenBuilder, onOpenMaps, combatTurn = null, players = [], onAskRoll = null }) {
    const run = scene.run;
    const live = scene.status === 'active' && Boolean(run);
    const beats = scene.beats || [];
    const now = useNow(run?.startedAt);
    const [addOpen, setAddOpen] = useState(false);
    const [confirmingEnd, setConfirmingEnd] = useState(false);

    const current = beats.find(beat => beat.id === run?.currentBeatId) || null;
    const currentIndex = current ? beats.indexOf(current) : -1;
    // the bestiary is only fetched once a beat that has a stat block tied to it comes up
    const bestiary = useBestiary(usesStatBlock(current));
    const [notes, setNotes] = useState(current?.notes || '');
    useEffect(() => setNotes(current?.notes || ''), [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!live) return <SceneStartCard scene={scene} session={session} calendar={calendar} onStart={onStart} onOpenBuilder={onOpenBuilder}/>;

    // a combat beat brings the turn order and tracker, and the enemies for a column of their own
    const combat = current?.type === 'combat' ? renderCombat() : null;
    const update = patch => onUpdate(scene.id, patch);
    const paused = !run.startedAt;
    const pinned = beats.filter(beat => beat.type === 'combat' && beat.ruling && beat.rulingActive !== false && beat.id !== current?.id && beatState(scene, beat) !== 'upcoming');
    const skip = blockedBeatIds(scene, scenes);
    const changeBeat = (beat, patch) => update({ beats: beats.map(other => (other.id === beat.id ? { ...other, ...patch } : other)) });
    const scenePlayers = scene.playerIds ? players.filter(player => scene.playerIds.includes(player.id)) : players;

    // ending a scene that has a day, and is not on the calendar yet, asks whether to put it there
    const requestEnd = () => (calendar && endAsksAboutCalendar(scene, calendar) ? setConfirmingEnd(true) : onEnd(scene));
    const dateText = calendar ? sceneDateText(scene, calendar) : '';

    function addBeatOnTheFly(type) {
        const beat = { ...newBeat(type), title: `Improvised ${beatTypeLabel(type).toLowerCase()}` };
        const index = currentIndex < 0 ? beats.length : currentIndex + 1;
        update({ beats: [...beats.slice(0, index), beat, ...beats.slice(index)], run: jumpRun(scene, beat.id) });
    }

    return <div className="Scenes-run">
        <div className="Scenes-run-head">
            <div className="Scenes-run-title">
                <h2 className="Scenes-title">{scene.name || 'Untitled scene'}</h2>
                <span className={paused ? 'Scenes-chip' : 'Scenes-chip Scenes-chip-now'}>{`${paused ? 'Paused' : 'Live'} · Beat ${currentIndex >= 0 ? currentIndex + 1 : beats.length} of ${beats.length}`}</span>
                <span className="Scenes-muted">{`${sessionTitle(session)}${dateText ? ' · ' + dateText : ''}`}</span>
                <RunClock scene={scene} run={run} now={now}/>
            </div>
            <div className="Scenes-run-actions">
                <select aria-label="Switch scene" value="" onChange={event => event.target.value && onSwitch(scene, event.target.value)}>
                    <option value="">Switch Scene ▾</option>
                    {scenes.filter(other => other.id !== scene.id && other.sessionId === scene.sessionId && !other.benched && (other.beats || []).length > 0).map(other => <option key={other.id} value={other.id}>{other.name || 'Untitled scene'}</option>)}
                </select>
                {calendar && onSyncCalendar && <CalendarSync scene={scene} calendar={calendar} onSync={onSyncCalendar}/>}
                <button type="button" className="Scenes-button" onClick={() => update({ run: paused ? startRun(scene) : pauseRun(run) })}>{paused ? 'Resume clock' : 'Pause clock'}</button>
                <button type="button" className="Scenes-button Scenes-button-primary" disabled={!current} onClick={() => update({ run: advanceRun(scene, skip) })}>Next beat &rarr;</button>
                <button type="button" className="Scenes-button" onClick={requestEnd}>End Scene</button>
            </div>
        </div>
        {confirmingEnd && <EndSceneCard scene={scene} calendar={calendar} onEnd={options => onEnd(scene, options)} onCancel={() => setConfirmingEnd(false)}/>}

        <div className={current?.type === 'combat' ? 'Scenes-run-body Scenes-run-body-combat' : 'Scenes-run-body'}>
            <div className="Scenes-run-left">
            <BeatRail scene={scene} scenes={scenes} beats={beats} combatTurn={combatTurn} addOpen={addOpen} onToggleAdd={() => setAddOpen(open => !open)}
                onJump={id => update({ run: jumpRun(scene, id) })} addTypes={BEAT_TYPES} onAdd={type => { setAddOpen(false); addBeatOnTheFly(type); }}/>
            {onAskRoll && <CallCheck players={scenePlayers} onAsk={onAskRoll}/>}
            <aside className="Scenes-run-side">
                <section className="Scenes-card">
                    <div className="Scenes-card-head"><h3 className="Scenes-card-title">Scratchpad</h3><span className="Scenes-muted">Saved to this beat</span></div>
                    <textarea className="Scenes-textarea" aria-label="Director scratchpad" rows={6} disabled={!current} value={notes}
                        onChange={event => setNotes(event.target.value)}
                        onBlur={() => current && notes !== (current.notes || '') && update({ beats: beats.map(beat => beat.id === current.id ? { ...beat, notes } : beat) })}/>
                </section>
            </aside>
            </div>

            <div className="Scenes-run-center">
                {pinned.map(beat => <RulingCard key={beat.id} beat={beat} onToggle={(target, active) => changeBeat(target, { rulingActive: active })}/>)}
                <PausedCombatNote scene={scene} current={current} combatTurn={combatTurn} onReturn={id => update({ run: jumpRun(scene, id) })}/>
                {current
                    ? <>
                        <div className="Scenes-run-beat-head">
                            <span className={`Scenes-chip Scenes-chip-beat-${current.type}`}>{beatTypeLabel(current.type)}</span>
                            <h3 className="Scenes-run-beat-title">{current.title || 'Untitled beat'}</h3>
                        </div>
                        {current.type === 'combat' && current.ruling && <RulingCard beat={current} onToggle={(target, active) => changeBeat(target, { rulingActive: active })}/>}
                        {current.type === 'combat' && <DueCues scene={scene} scenes={scenes} current={current} combatTurn={combatTurn}
                            onOpen={id => update({ run: jumpRun(scene, id) })} onDone={id => update({ run: completeBeat(scene, id) })}/>}
                        <BeatView beat={current} scene={scene} scenes={scenes} bestiary={bestiary} onDecide={onDecide} onStartCombat={beat => onStartCombat(scene, beat)} onOpenMaps={onOpenMaps} combat={combat}
                            onAdvance={() => update({ run: advanceRun(scene, skip) })} onWaiting={(target, waiting) => changeBeat(target, { waiting })}/>
                    </>
                    : <div className="Scenes-card">
                        <strong>Every beat is done.</strong>
                        <p className="Scenes-muted">End the scene when you're ready to move on, or pick a beat from the list to go back to it.</p>
                        <button type="button" className="Scenes-button Scenes-button-primary" onClick={requestEnd}>End Scene</button>
                    </div>}
            </div>

            {combat?.aside && <aside className="Scenes-run-enemies" aria-label="Enemies">{combat.aside}</aside>}
        </div>
    </div>;
}
