import { useState } from 'react';
import { ABILITIES } from '../utils/combatants';
import { LinkedStatBlock } from './NpcStatBlock';
import { beatState, beatTypeLabel, conditionState, isCombatPaused, isCueDue } from '../utils/scenes';

// An NPC's behaviors, one per line, each with a key of its own.
const behaviorLines = (id, behaviors) => (behaviors || '').split('\n').map(line => line.trim()).filter(Boolean).map((line, position) => ({ key: `${id}:${position}`, line }));

// `bestiary` is the loaded bestiary (see useBestiary), for the stat block an NPC may be tied to.
export function NpcCard({ id, npcName, behaviors, enemyId = '', bestiary = null }) {
    return <>
        <div className="Scenes-card">
            <div className="Scenes-run-npc"><span className="Scenes-chip">NPC</span><strong>{npcName || 'Unnamed NPC'}</strong></div>
            <ul className="Scenes-list">{behaviorLines(id, behaviors).map(entry => <li key={entry.key}>{entry.line}</li>)}</ul>
        </div>
        <LinkedStatBlock enemyId={enemyId} bestiary={bestiary}/>
    </>;
}

export function CheckCard({ skill, dc, text }) {
    return <div className="Scenes-card">
        <div className="Scenes-run-npc"><span className="Scenes-chip">Check</span><strong>{[skill, dc && `DC ${dc}`].filter(Boolean).join(' · ') || 'Roll or ruling'}</strong></div>
        {text && <p>{text}</p>}
    </div>;
}

// What was attached to a beat - an NPC to voice, a check to call - shown with it.
export function Attachments({ beat, bestiary = null }) {
    return <>{(beat.attachments || []).map(item => (item.kind === 'check'
        ? <CheckCard key={item.id} skill={item.skill} dc={item.dc} text={item.text}/>
        : <NpcCard key={item.id} id={item.id} npcName={item.npcName} behaviors={item.behaviors} enemyId={item.enemyId} bestiary={bestiary}/>))}</>;
}

// Whether a beat has a stat block tied to it - its own, or on an NPC attached to it.
export const usesStatBlock = beat => Boolean(beat?.enemyId || (beat?.attachments || []).some(item => item.enemyId));

// How a beat shows on the rail: done, now, upcoming - or one of the ways an upcoming beat can be
// more than that: a fight that is paused, a cue that has come due, a beat on a path not taken.
export function railState(scene, scenes, beat, round) {
    const state = beatState(scene, beat);
    if (state !== 'upcoming') return state;
    if (conditionState(beat.onlyIf, scenes) === 'unmet') return 'skipped';
    if (isCombatPaused(scene, beat)) return 'paused';
    // a cue comes due by the round of a fight that has been started
    const fighting = (scene.beats || []).some(other => other.type === 'combat' && other.started);
    return fighting && isCueDue(beat, round) ? 'due' : 'upcoming';
}

const STATE_TEXT = { done: '✓ Done', now: 'Now', upcoming: 'Upcoming', paused: 'Paused', due: 'Due now', skipped: 'Not taken' };

export function BeatRail({ scene, scenes, beats, combatTurn, addOpen, onToggleAdd, onJump, onAdd, addTypes }) {
    return <nav className="Scenes-rail" aria-label="Beats">
        <span className="Scenes-field-label">Beats</span>
        {beats.map((beat, index) => {
            const state = railState(scene, scenes, beat, combatTurn?.round);
            const running = beat.type === 'combat' && combatTurn && (state === 'now' || state === 'paused');
            const turn = combatTurn?.activeName ? `, ${combatTurn.activeName}'s turn` : '';
            return <button type="button" key={beat.id} className={`Scenes-rail-item Scenes-rail-item-${state}`} aria-current={state === 'now' ? 'step' : undefined} onClick={() => onJump(beat.id)}>
                <span className="Scenes-rail-state">{`${STATE_TEXT[state]} · ${beatTypeLabel(beat.type)}`}</span>
                <span className="Scenes-rail-title">{`${index + 1} · ${beat.title || 'Untitled beat'}`}</span>
                {running && <span className="Scenes-rail-state">{`Round ${combatTurn.round}${turn}`}</span>}
            </button>;
        })}
        <button type="button" className="Scenes-rail-add" aria-expanded={addOpen} onClick={onToggleAdd}>+ Add beat on the fly</button>
        {addOpen && <div className="Scenes-rail-add-menu" role="menu">
            {addTypes.map(type => <button type="button" role="menuitem" key={type.key} onClick={() => onAdd(type.key)}>{type.label}</button>)}
        </div>}
    </nav>;
}

// Cues that have come due while a fight is being run (a "Round 2" cue once it is round 2), where
// the director will see them without leaving the fight.
export function DueCues({ scene, scenes, current, combatTurn, onOpen, onDone }) {
    const due = (scene.beats || []).filter(beat => beat.id !== current?.id && railState(scene, scenes, beat, combatTurn?.round) === 'due');
    return <>{due.map(beat => <div className="Scenes-card Scenes-due" key={beat.id}>
        <div className="Scenes-card-head"><strong>{beat.title || 'Cue'}</strong><span className="Scenes-chip Scenes-chip-now">due now</span></div>
        {beat.text && <p>{beat.text}</p>}
        <div className="Scenes-row-actions">
            <button type="button" className="Scenes-button" onClick={() => onOpen(beat.id)}>Open cue</button>
            <button type="button" className="Scenes-button" onClick={() => onDone(beat.id)}>Mark done</button>
        </div>
    </div>)}</>;
}

// Away from the fight in the middle of it (a flashback, some roleplay): where it was left, and the
// way back. Nothing in the tracker or on the map changes.
export function PausedCombatNote({ scene, current, combatTurn, onReturn }) {
    const paused = (scene.beats || []).find(beat => beat.id !== current?.id && isCombatPaused(scene, beat));
    if (!paused || current?.type === 'combat') return null;
    const where = combatTurn ? ' at Round ' + combatTurn.round : '';
    return <div className="Scenes-card Scenes-paused">
        <span>{`Combat is paused${where}. Nothing in the tracker or on the map has changed.`}</span>
        <button type="button" className="Scenes-button" onClick={() => onReturn(paused.id)}>Return to combat</button>
    </div>;
}

// A ruling that holds while a fight runs ("the sound system gives the party -1 to all stats"), that
// can be switched off for when it stops applying.
export function RulingCard({ beat, onToggle }) {
    const active = beat.rulingActive !== false;
    return <div className={active ? 'Scenes-pinned' : 'Scenes-pinned Scenes-pinned-off'}>
        <span className="Scenes-field-label">Ruling</span>
        <span>{beat.ruling}</span>
        <button type="button" className="Scenes-button Scenes-button-small" aria-pressed={active} onClick={() => onToggle(beat, !active)}>{active ? 'Active' : 'Off'}</button>
    </div>;
}

// A cue that waits on someone ("Waiting on Leon's roleplay"): ticked while it still does.
export function WaitingOn({ beat, onChange }) {
    if (!beat.waitingOn) return null;
    return <label className="Scenes-waiting">
        <input type="checkbox" checked={beat.waiting !== false} onChange={event => onChange(beat, event.target.checked)}/>
        {`Waiting on ${beat.waitingOn}`}
    </label>;
}

// Ask a player (or a few) to make a roll: who, what for, and the button that sends it.
export function CallCheck({ players, onAsk }) {
    const [chosen, setChosen] = useState(() => new Set());
    const [custom, setCustom] = useState('');
    const [sent, setSent] = useState('');
    const names = players.filter(player => chosen.has(player.id)).map(player => player.name);
    const toggle = id => setChosen(previous => {
        const next = new Set(previous);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
    async function ask(skill) {
        const ids = players.filter(player => chosen.has(player.id)).map(player => player.id);
        if (ids.length === 0 || !skill.trim()) return;
        try {
            await onAsk(ids, skill.trim());
            setSent(`Asked ${names.join(', ')} for a ${skill.trim()} roll.`);
            setCustom('');
        } catch (error) {
            alert("Couldn't ask for the roll: " + error.message);
        }
    }
    if (players.length === 0) return null;
    return <section className="Scenes-card" aria-label="Call a check">
        <h3 className="Scenes-card-title">Call a check</h3>
        <fieldset className="Scenes-chips" aria-label="Who rolls">
            {players.map(player => <button type="button" key={player.id} className="Scenes-button Scenes-button-small" aria-pressed={chosen.has(player.id)} onClick={() => toggle(player.id)}>{player.name}</button>)}
        </fieldset>
        <fieldset className="Scenes-chips" aria-label="What they roll">
            {ABILITIES.map(ability => <button type="button" key={ability.key} className="Scenes-button Scenes-button-small" disabled={chosen.size === 0} onClick={() => ask(ability.name)}>{ability.name}</button>)}
        </fieldset>
        <div className="Scenes-option-row">
            <input type="text" aria-label="Another skill" placeholder="Another skill, e.g. Attention to detail" value={custom} onChange={event => setCustom(event.target.value)}/>
            <button type="button" className="Scenes-button Scenes-button-small" disabled={chosen.size === 0 || custom.trim() === ''} onClick={() => ask(custom)}>{names.length ? `Ask ${names.join(', ')} for a roll` : 'Ask for a roll'}</button>
        </div>
        {sent && <output className="Scenes-muted">{sent}</output>}
    </section>;
}
