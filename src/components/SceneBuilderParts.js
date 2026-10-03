import { useState } from 'react';
import { SCENE_TYPES, conditionChoices, newId, sceneDate, timeGoalText } from '../utils/scenes';
import { CalendarDatePicker } from './SceneCalendarParts';
import { useEscapeKey } from '../utils/useEscapeKey';
import { byName, statBlockLine, statBlockOf } from '../utils/npcStatBlock';

// Which of the bestiary's stat blocks an NPC is: the runner shows it with the NPC, ready for the
// checks they may have to make. `bestiary` is the loaded bestiary (see useBestiary); `onPick` is
// given the entry chosen, or null for none. Without a bestiary there is nothing to pick from.
export function StatBlockSelect({ bestiary, value, label = 'Stat block', onPick }) {
    if (!bestiary) return null;
    const enemy = statBlockOf(bestiary.enemies, value);
    const gone = value && !enemy && bestiary.status === 'ready';
    return <>
        <select aria-label={label} value={value || ''} onChange={event => onPick(statBlockOf(bestiary.enemies, event.target.value))}>
            <option value="">{bestiary.status === 'loading' && !value ? 'Loading the bestiary…' : 'No stat block'}</option>
            {gone && <option value={value}>A stat block that is no longer in the bestiary</option>}
            {value && !enemy && !gone && <option value={value}>Loading…</option>}
            {byName(bestiary.enemies).map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.enemy_name || 'Unnamed enemy'}</option>)}
        </select>
        {enemy && <span className="Scenes-muted">{statBlockLine(enemy)}</span>}
        {bestiary.status === 'error' && <span className="Scenes-muted" role="alert">Couldn't load the bestiary.</span>}
        {bestiary.status === 'ready' && bestiary.enemies.length === 0 && <span className="Scenes-muted">Your bestiary is empty. Make some enemies there first.</span>}
    </>;
}

// What picking a stat block does to an NPC (a beat, or one attached to one): it is tied to that
// one, and takes its name if it had none yet.
export const withStatBlock = (npc, enemy, nameField = 'npcName') => ({
    ...npc,
    enemyId: enemy ? enemy.id : '',
    ...(enemy && !npc[nameField] ? { [nameField]: enemy.enemy_name || '' } : {}),
});

// The NPCs and checks attached to a beat: voiced or called along with it (a flashback with a bully
// to play, a narration with a roll to ask for), each one editable where it is.
export function AttachmentsEditor({ beat, onChange, bestiary = null }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const attachments = beat.attachments || [];
    const set = next => onChange({ ...beat, attachments: next });
    const change = (id, patch) => set(attachments.map(item => (item.id === id ? { ...item, ...patch } : item)));
    const add = kind => { set([...attachments, kind === 'npc' ? { id: newId(), kind, npcName: '', behaviors: '' } : { id: newId(), kind, skill: '', dc: '', text: '' }]); setMenuOpen(false); };
    return <div className="Scenes-attachments">
        {attachments.map(item => <div className="Scenes-attachment" key={item.id}>
            <span className="Scenes-chip">{item.kind === 'check' ? 'Check' : 'NPC'}</span>
            {item.kind === 'check'
                ? <>
                    <input type="text" aria-label="Attached check skill" placeholder="Skill or stat" value={item.skill || ''} onChange={event => change(item.id, { skill: event.target.value })}/>
                    <input type="text" inputMode="numeric" aria-label="Attached check DC" placeholder="DC" value={item.dc ?? ''} onChange={event => change(item.id, { dc: event.target.value })}/>
                    <input type="text" aria-label="Attached check ruling" placeholder="What happens" value={item.text || ''} onChange={event => change(item.id, { text: event.target.value })}/>
                </>
                : <>
                    <input type="text" aria-label="Attached NPC name" placeholder="NPC name" value={item.npcName || ''} onChange={event => change(item.id, { npcName: event.target.value })}/>
                    <input type="text" aria-label="Attached NPC behaviors" placeholder="Behaviors, separated by a new line" value={item.behaviors || ''} onChange={event => change(item.id, { behaviors: event.target.value })}/>
                    <StatBlockSelect bestiary={bestiary} value={item.enemyId} label="Attached NPC stat block" onPick={enemy => change(item.id, withStatBlock(item, enemy))}/>
                </>}
            <button type="button" className="Scenes-icon-button" aria-label={`Remove attached ${item.kind === 'check' ? 'check' : 'NPC'}`} onClick={() => set(attachments.filter(other => other.id !== item.id))}>&times;</button>
        </div>)}
        <div className="Scenes-add-beat">
            <button type="button" className="Scenes-button Scenes-button-small" aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}>+ Attach NPC or check to this beat</button>
            {menuOpen && <div className="Scenes-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => add('npc')}>NPC</button>
                <button type="button" role="menuitem" onClick={() => add('check')}>Check</button>
            </div>}
        </div>
    </div>;
}

// "Only runs if": which path of which decision has to be taken for a scene (or a beat) to run.
// Empty is always. A condition whose decision has since gone (or whose option was deleted) is still
// shown, so it can be seen and changed, and with nothing to pick from it says what makes something
// pickable. `onRemove`, when given, adds a button that takes the condition away altogether.
export function OnlyIfSelect({ label, choices, value, onChange, onRemove = null }) {
    const missing = value && !choices.some(choice => choice.key === value);
    return <div className="Scenes-field">
        <label className="Scenes-only-if">
            <span className="Scenes-field-label">{label}</span>
            <select value={value || ''} onChange={event => onChange(choices.find(choice => choice.key === event.target.value) || null)}>
                <option value="">Always</option>
                {missing && <option value={value}>A decision that is no longer there</option>}
                {choices.map(choice => <option key={choice.key} value={choice.key}>{choice.label}</option>)}
            </select>
        </label>
        {choices.length === 0 && <span className="Scenes-muted">There is nothing to depend on yet. Add a Decision beat (to this scene, or to another scene in this session) and it will be listed here.</span>}
        {onRemove && <button type="button" className="Scenes-link" onClick={onRemove}>Remove this condition</button>}
    </div>;
}

export const conditionKey = condition => (condition ? `${condition.sceneId}:${condition.beatId}:${condition.optionId}` : '');

// The players in a scene: all of them by default, or the ones switched on here.
export function PlayersInScene({ players, scene, onChange }) {
    const chosen = scene.playerIds || players.map(player => player.id);
    const toggle = id => {
        const next = chosen.includes(id) ? chosen.filter(other => other !== id) : [...chosen, id];
        onChange(next.length === players.length ? null : next);
    };
    if (players.length === 0) return <span className="Scenes-muted">No players in this campaign yet.</span>;
    return <fieldset className="Scenes-chips" aria-label="Players in this scene">
        {players.map(player => <button type="button" key={player.id} className="Scenes-button Scenes-button-small" aria-pressed={chosen.includes(player.id)} onClick={() => toggle(player.id)}>{player.name}</button>)}
    </fieldset>;
}

// "+ New NPC": a name and how they behave, which becomes an NPC beat at the end of the scene.
export function NewNpcDialog({ onAdd, onClose }) {
    useEscapeKey(onClose);
    const [name, setName] = useState('');
    const [behaviors, setBehaviors] = useState('');
    return <>
        <button type="button" className="Scenes-scrim" aria-label="Close" onClick={onClose}/>
        <dialog open className="Scenes-dialog" aria-modal="true" aria-label="New NPC">
            <div className="Scenes-dialog-head">
                <h2 className="Scenes-dialog-title">New NPC</h2>
                <button type="button" className="Scenes-icon-button" aria-label="Close dialog" onClick={onClose}>&times;</button>
            </div>
            <label className="Scenes-field"><span className="Scenes-field-label">Name</span>
                <input type="text" value={name} placeholder="e.g. Snotty Bully" autoFocus onChange={event => setName(event.target.value)}/></label>
            <label className="Scenes-field"><span className="Scenes-field-label">Voice and behaviors (one per line)</span>
                <textarea className="Scenes-textarea" rows={4} value={behaviors} onChange={event => setBehaviors(event.target.value)}/></label>
            <div className="Scenes-dialog-actions">
                <button type="button" className="Scenes-button" onClick={onClose}>Cancel</button>
                <button type="button" className="Scenes-button Scenes-button-primary" disabled={name.trim() === ''} onClick={() => onAdd(name.trim(), behaviors)}>Add NPC beat</button>
            </div>
        </dialog>
    </>;
}

// The beats' estimate against the time the director hoped for: a bar with the goal range shaded
// and a mark where the beats add up to.
export function TimeGoalBar({ scene, estimate }) {
    const low = Number(scene.timeMin) || 0;
    const high = Number(scene.timeMax) || low;
    if (!low && !high) return null;
    const scale = Math.max(high * 1.25, estimate * 1.1, 1);
    const percent = value => `${Math.min(100, (value / scale) * 100)}%`;
    return <div className="Scenes-goal-bar" role="img" aria-label={`Beats add up to about ${estimate} minutes against a goal of ${low || high} to ${high} minutes`}>
        <span className="Scenes-goal-range" style={{ left: percent(low || high), width: `${((high - (low || high)) / scale) * 100 || 1}%` }}/>
        <span className="Scenes-goal-mark" style={{ left: percent(estimate) }}/>
    </div>;
}

function Field({ label, children }) {
    return <label className="Scenes-field"><span className="Scenes-field-label">{label}</span>{children}</label>;
}

// Every NPC the beats (and what is attached to them) bring in, with the beat each is in.
function npcsUsed(beats) {
    const used = [];
    beats.forEach((beat, index) => {
        if (beat.type === 'npc' && beat.npcName) used.push({ key: beat.id, name: beat.npcName, beat: index + 1 });
        (beat.attachments || []).filter(item => item.kind !== 'check' && item.npcName).forEach(item => used.push({ key: item.id, name: item.npcName, beat: index + 1 }));
    });
    return used;
}

// Beside the beats: the scene's type, date, episode and time goal; who and what is in it; and where it sits
// among the decisions (what it only runs if, and what it ends with).
export function BuilderSide({ calendar, current, edit, estimate, beats, scenes, players, owner, ownerBeat, endsWith, onOpenScene, onSetCondition, onAddNpc }) {
    const npcs = npcsUsed(beats);
    const choices = conditionChoices(scenes, current);
    const branch = current.branch;
    const taken = branch ? choices.find(choice => choice.sceneId === branch.fromSceneId && choice.optionId === branch.optionId) : null;
    return <aside className="Scenes-builder-side">
        <section className="Scenes-card">
            <h3 className="Scenes-card-title">Scene settings</h3>
            <div className="Scenes-field">
                <span className="Scenes-field-label">Type</span>
                <fieldset className="Scenes-segmented" aria-label="Scene type">
                    {SCENE_TYPES.map(type => <button type="button" key={type.key} aria-pressed={current.type === type.key} onClick={() => edit({ type: type.key })}>{type.label}</button>)}
                </fieldset>
            </div>
            <CalendarDatePicker calendar={calendar} value={sceneDate(current, calendar)} onChange={date => edit({ date })}/>
            <Field label="Episode"><input type="text" value={current.episode || ''} placeholder="Groups scenes on the timeline" onChange={event => edit({ episode: event.target.value })}/></Field>
            <div className="Scenes-beat-row">
                <Field label="Goal from (min)"><input type="number" min="0" value={current.timeMin ?? ''} onChange={event => edit({ timeMin: Number(event.target.value) || null })}/></Field>
                <Field label="to (min)"><input type="number" min="0" value={current.timeMax ?? ''} onChange={event => edit({ timeMax: Number(event.target.value) || null })}/></Field>
            </div>
            <div className="Scenes-time-goal">
                <span className="Scenes-muted">{`Time goal: ${timeGoalText(current)}`}</span>
                <TimeGoalBar scene={current} estimate={estimate}/>
                <span className="Scenes-muted">{`Beats add up to about ${estimate} min.${current.timeMin || current.timeMax ? ' Goal range is shaded green.' : ''}`}</span>
            </div>
        </section>

        <section className="Scenes-card">
            <h3 className="Scenes-card-title">In this scene</h3>
            <span className="Scenes-field-label">Players</span>
            <PlayersInScene players={players} scene={current} onChange={playerIds => edit({ playerIds })}/>
            <span className="Scenes-field-label">NPCs used in beats</span>
            {npcs.length > 0
                ? <ul className="Scenes-list">{npcs.map(npc => <li key={npc.key}>{`${npc.name} · beat ${npc.beat}`}</li>)}</ul>
                : <span className="Scenes-muted">None yet. Add an NPC beat.</span>}
            <button type="button" className="Scenes-button Scenes-button-small" onClick={onAddNpc}>+ New NPC</button>
        </section>

        <section className="Scenes-card">
            <h3 className="Scenes-card-title">Path</h3>
            {owner
                ? <>
                    <span className="Scenes-muted">This scene is a path of a decision in</span>
                    <button type="button" className="Scenes-link" onClick={() => onOpenScene(owner.id)}>{owner.name || 'Untitled scene'}</button>
                    {ownerBeat && <span className="Scenes-muted">{ownerBeat.title || ownerBeat.question || ''}</span>}
                </>
                : <span className="Scenes-muted">This scene is on the main line of the session.</span>}
            <OnlyIfSelect label="Only runs if" choices={choices} value={taken?.key} onChange={choice => onSetCondition(current, choice)}/>
            <span className="Scenes-muted">If the party picks a different path, this scene is marked "Didn't happen" automatically. Any single beat can also be set to "Only if…" from its menu.</span>
            <span className="Scenes-field-label">Ends with</span>
            <span className="Scenes-muted">{endsWith ? `Decision: ${endsWith.title || 'where does the party go?'}` : 'No decision. The next scene follows.'}</span>
        </section>
    </aside>;
}
