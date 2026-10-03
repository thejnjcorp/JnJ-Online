import { useState } from 'react';
import { useAutosavedDoc } from '../utils/useAutosavedDoc';
import { AttachmentsEditor, BuilderSide, NewNpcDialog, OnlyIfSelect, StatBlockSelect, conditionKey, withStatBlock } from './SceneBuilderParts';
import { useBestiary } from '../utils/useBestiary';
import {
    BEAT_TYPES, DECISION_METHODS, beatMinutes, beatTypeLabel, conditionChoices, decisionBeatOf, estimateMinutes, newBeat, newId, optionLetter, sessionTitle,
    wordCount,
} from '../utils/scenes';

const SAVE_TEXT = {
    dirty: 'Unsaved changes…',
    saving: 'Saving…',
    saved: 'All changes saved',
    error: "Couldn't save - will keep trying",
};

function Field({ label, children }) {
    return <label className="Scenes-field"><span className="Scenes-field-label">{label}</span>{children}</label>;
}

function beatSummary(beat) {
    if (beat.type === 'narration') return beat.text;
    if (beat.type === 'npc') return [beat.npcName, beat.behaviors].filter(Boolean).join(' · ');
    if (beat.type === 'check') return [beat.skill, beat.dc && `DC ${beat.dc}`, beat.text].filter(Boolean).join(' · ');
    if (beat.type === 'combat') return beat.ruling;
    if (beat.type === 'decision') return `${(beat.options || []).length} paths`;
    return beat.text;
}

function BeatEditor({ beat, scene, scenes, encounters, maps, bestiary, onChange, onCreatePathScene, onOpenMaps, onOpenEncounter, onCreateEncounter }) {
    const update = patch => onChange({ ...beat, ...patch });
    switch (beat.type) {
        case 'narration':
            return <>
                <div className="Scenes-beat-row">
                    <Field label="Narrator"><input type="text" value={beat.narrator || ''} placeholder="Who reads this aloud" onChange={event => update({ narrator: event.target.value })}/></Field>
                    <span className="Scenes-muted">Shown to the narrator as large read-aloud text while running. Leave a blank line between paragraphs to read them one at a time.</span>
                </div>
                <textarea className="Scenes-textarea Scenes-textarea-prose" aria-label="Narration text" rows={5} value={beat.text || ''} onChange={event => update({ text: event.target.value })}/>
                <span className="Scenes-muted">{wordCount(beat.text) === 0 ? 'Nothing written yet' : `~${beatMinutes(beat)} min read aloud`} · saves as you type</span>
            </>;
        case 'npc':
            return <>
                <Field label="NPC name"><input type="text" value={beat.npcName || ''} placeholder="e.g. Snotty Bully" onChange={event => update({ npcName: event.target.value })}/></Field>
                <Field label="Voice and behaviors (one per line)">
                    <textarea className="Scenes-textarea" rows={4} value={beat.behaviors || ''} onChange={event => update({ behaviors: event.target.value })}/>
                </Field>
                {bestiary && <div className="Scenes-field">
                    <span className="Scenes-field-label">Stat block (from the bestiary), for the checks they may make</span>
                    <StatBlockSelect bestiary={bestiary} value={beat.enemyId} label="NPC stat block" onPick={enemy => onChange(withStatBlock(beat, enemy))}/>
                </div>}
            </>;
        case 'check':
            return <>
                <div className="Scenes-beat-row">
                    <Field label="Skill or stat"><input type="text" value={beat.skill || ''} placeholder="e.g. Dexterity" onChange={event => update({ skill: event.target.value })}/></Field>
                    <Field label="DC"><input type="text" inputMode="numeric" value={beat.dc ?? ''} onChange={event => update({ dc: event.target.value })}/></Field>
                </div>
                <Field label="What happens on a success or a failure">
                    <textarea className="Scenes-textarea" rows={3} value={beat.text || ''} onChange={event => update({ text: event.target.value })}/>
                </Field>
            </>;
        case 'combat': {
            const map = maps.find(candidate => candidate.map_id === beat.mapId);
            const encounter = encounters.find(candidate => candidate.id === beat.encounterId);
            return <>
                <div className="Scenes-beat-row">
                    <Field label="Map">
                        <select value={beat.mapId || ''} onChange={event => update({ mapId: event.target.value })}>
                            <option value="">No map</option>
                            {maps.map((candidate, index) => <option key={candidate.map_id} value={candidate.map_id}>{`Map ${index + 1}`}</option>)}
                        </select>
                    </Field>
                    <Field label="Encounter">
                        <select value={beat.encounterId || ''} onChange={event => update({ encounterId: event.target.value })}>
                            <option value="">No encounter</option>
                            {encounters.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name || 'Untitled encounter'}</option>)}
                        </select>
                    </Field>
                    <Field label="Time (min)"><input type="number" min="0" value={beat.minutes ?? ''} onChange={event => update({ minutes: Number(event.target.value) })}/></Field>
                    <button type="button" className="Scenes-button Scenes-button-small" onClick={onOpenMaps}>Browse maps &amp; edit zones</button>
                    <button type="button" className="Scenes-button Scenes-button-small"
                        onClick={async () => { if (encounter) onOpenEncounter(encounter.id); else { const id = await onCreateEncounter(beat.title); update({ encounterId: id }); onOpenEncounter(id); } }}>
                        {encounter ? 'Edit roster' : '+ New encounter'}
                    </button>
                </div>
                <div className="Scenes-beat-row Scenes-beat-columns">
                    <div>
                        <span className="Scenes-field-label">Zones</span>
                        {map?.zones?.length
                            ? <ol className="Scenes-list">{map.zones.map((zone, index) => <li key={`${zone.name}:${index}`}>{zone.name}</li>)}</ol>
                            : <span className="Scenes-muted">{map ? 'This map has no zones yet. Add some from the Maps tab.' : 'Pick a map to see its zones.'}</span>}
                    </div>
                    <div>
                        <span className="Scenes-field-label">Roster</span>
                        {encounter?.roster?.length
                            ? <ul className="Scenes-list">{encounter.roster.map((entry, index) => <li key={`${entry.enemy?.enemy_name}:${index}`}>{`${entry.enemy?.enemy_name || 'Enemy'} ×${entry.count || 1}`}</li>)}</ul>
                            : <span className="Scenes-muted">{encounter ? 'This encounter has no enemies yet.' : 'Pick an encounter to stage when this beat starts, or add enemies by hand while running.'}</span>}
                    </div>
                </div>
                <Field label="Ruling (pinned while running)">
                    <textarea className="Scenes-textarea" rows={2} value={beat.ruling || ''} placeholder="e.g. While the sound system is active, the party has -1 to all stats." onChange={event => update({ ruling: event.target.value })}/>
                </Field>
            </>;
        }
        case 'decision': {
            const linkable = scenes.filter(candidate => candidate.id !== scene.id && !candidate.benched);
            const setOption = (optionId, patch) => update({ options: beat.options.map(option => option.id === optionId ? { ...option, ...patch } : option) });
            const main = scenes.filter(candidate => candidate.sessionId === scene.sessionId && !candidate.branch && candidate.id !== scene.id);
            return <>
                <div className="Scenes-field">
                    <span className="Scenes-field-label">How it is decided</span>
                    <fieldset className="Scenes-segmented" aria-label="How it is decided">
                        {DECISION_METHODS.map(method => <button type="button" key={method.key} aria-pressed={(beat.method || 'party') === method.key} onClick={() => update({ method: method.key })}>{method.label}</button>)}
                    </fieldset>
                </div>
                <div className="Scenes-decision-editor">
                    {(beat.options || []).map((option, index) => <div className="Scenes-option-row" key={option.id}>
                        <span className="Scenes-option-letter">{optionLetter(index)}</span>
                        <input type="text" aria-label={`Option ${optionLetter(index)} label`} value={option.label || ''} placeholder="What the party does" onChange={event => setOption(option.id, { label: event.target.value })}/>
                        <span className="Scenes-muted">leads to</span>
                        <select aria-label={`Option ${optionLetter(index)} leads to`} value={option.sceneId || ''} onChange={event => setOption(option.id, { sceneId: event.target.value })}>
                            <option value="">No scene yet</option>
                            {linkable.map(candidate => <option key={candidate.id} value={candidate.id}>{`Scene: ${candidate.name || 'Untitled scene'}`}</option>)}
                        </select>
                        {!option.sceneId && <button type="button" className="Scenes-button Scenes-button-small"
                            onClick={async () => { const sceneId = await onCreatePathScene(option.label || `Path ${optionLetter(index)}`, option.id); setOption(option.id, { sceneId }); }}>
                            Build it now
                        </button>}
                        {(beat.options || []).length > 2 && <button type="button" className="Scenes-icon-button" aria-label={`Remove option ${optionLetter(index)}`}
                            onClick={() => update({ options: beat.options.filter(other => other.id !== option.id), chosenOptionId: beat.chosenOptionId === option.id ? '' : beat.chosenOptionId })}>&times;</button>}
                    </div>)}
                    <button type="button" className="Scenes-button Scenes-button-small" onClick={() => update({ options: [...(beat.options || []), { id: newId(), label: '', sceneId: '' }] })}>+ Add option</button>
                </div>
                <div className="Scenes-beat-row">
                    <Field label="Paths rejoin at">
                        <select value={beat.rejoinSceneId || ''} onChange={event => update({ rejoinSceneId: event.target.value })}>
                            <option value="">The next scene</option>
                            {main.map(candidate => <option key={candidate.id} value={candidate.id}>{`Scene: ${candidate.name || 'Untitled scene'}`}</option>)}
                        </select>
                    </Field>
                    <span className="Scenes-muted">Only one option runs. The rest are marked "Didn't happen" and you choose to keep or discard them.</span>
                </div>
            </>;
        }
        default:
            return <>
                <Field label="Note to yourself">
                    <textarea className="Scenes-textarea" rows={3} value={beat.text || ''} onChange={event => update({ text: event.target.value })}/>
                </Field>
                <Field label="Waiting on (optional)"><input type="text" value={beat.waitingOn || ''} placeholder="e.g. Leon's roleplay" onChange={event => update({ waitingOn: event.target.value })}/></Field>
                <Field label="Comes due (optional)"><input type="text" value={beat.trigger || ''} placeholder="e.g. Round 2" onChange={event => update({ trigger: event.target.value })}/></Field>
            </>;
    }
}

// Build Scene: the premise and the beats you will run, in order, plus the scene's
// settings alongside. Everything saves as you type; the buttons underneath just
// say what state the scene is in.
export function SceneBuilder({ scene, scenes, session, encounters, maps, onSave, onCreatePathScene, onRun, onBack, onOpenScene, onOpenMaps, onOpenEncounter, onCreateEncounter, players = [], onSetCondition = () => {}, calendar }) {
    const { draft, edit, flush, state } = useAutosavedDoc(scene, patch => onSave(scene, patch));
    const [addOpen, setAddOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(() => new Set((scene.beats || []).filter(beat => beat.type === 'cue').map(beat => beat.id)));
    const [menuFor, setMenuFor] = useState(null);
    // beats whose "only if" choice is open to set, and the New NPC popup
    const [conditionOpen, setConditionOpen] = useState(() => new Set());
    const [newNpc, setNewNpc] = useState(false);
    const current = draft || scene;
    const beats = current.beats || [];
    // the bestiary is only fetched once there is an NPC to tie a stat block to
    const bestiary = useBestiary(beats.some(beat => beat.type === 'npc' || (beat.attachments || []).some(item => item.kind !== 'check')));
    const estimate = estimateMinutes(current);
    const owner = current.branch ? scenes.find(candidate => candidate.id === current.branch.fromSceneId) : null;
    const ownerBeat = owner ? (owner.beats || []).find(beat => beat.type === 'decision') : null;
    const endsWith = decisionBeatOf(current);

    const setBeats = next => edit({ beats: next });
    const changeBeat = next => setBeats(beats.map(beat => beat.id === next.id ? next : beat));
    const toggle = id => setCollapsed(previous => {
        const next = new Set(previous);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        return next;
    });
    function move(index, delta) {
        const target = index + delta;
        if (target < 0 || target >= beats.length) return;
        const next = [...beats];
        [next[index], next[target]] = [next[target], next[index]];
        setBeats(next);
    }
    function addBeat(type) {
        const beat = newBeat(type);
        setBeats([...beats, beat]);
        setAddOpen(false);
    }
    const setStatus = async status => { edit({ status }); await flush(); };
    const closeCondition = id => setConditionOpen(previous => {
        const next = new Set(previous);
        next.delete(id);
        return next;
    });

    return <div className="Scenes-builder">
        <div className="Scenes-builder-main">
            <div className="Scenes-builder-head">
                <div className="Scenes-breadcrumb">
                    <button type="button" className="Scenes-link" onClick={onBack}>{sessionTitle(session)}</button>
                    {current.episode && <><span aria-hidden="true">&middot;</span><span>{current.episode}</span></>}
                </div>
                <div className="Scenes-builder-title-row">
                    <input type="text" className="Scenes-title-input" aria-label="Scene name" value={current.name || ''} placeholder="Untitled scene" onChange={event => edit({ name: event.target.value })}/>
                    <fieldset className="Scenes-segmented" aria-label="Scene status">
                        {[['draft', 'Draft'], ['ready', 'Ready'], ['active', 'Active'], ['completed', 'Completed']].map(([key, label]) =>
                            <button type="button" key={key} aria-pressed={current.status === key} onClick={() => setStatus(key)}>{label}</button>)}
                    </fieldset>
                </div>
            </div>

            <label className="Scenes-field">
                <span className="Scenes-field-label">Premise</span>
                <textarea className="Scenes-textarea" rows={2} value={current.premise || ''} placeholder="What is going on when this scene starts?" onChange={event => edit({ premise: event.target.value })}/>
            </label>

            <div className="Scenes-beats-head">
                <div>
                    <h3 className="Scenes-arc-title">Beats</h3>
                    <span className="Scenes-muted">{`${beats.length} ${beats.length === 1 ? 'beat' : 'beats'} · the order you will run them`}</span>
                </div>
                <div className="Scenes-add-beat">
                    <button type="button" className="Scenes-button Scenes-button-primary" aria-expanded={addOpen} onClick={() => setAddOpen(open => !open)}>+ Add beat &#9662;</button>
                    {addOpen && <div className="Scenes-menu Scenes-add-beat-menu" role="menu">
                        {BEAT_TYPES.map(type => <button type="button" role="menuitem" key={type.key} onClick={() => addBeat(type.key)}>
                            <strong>{type.label}</strong><span className="Scenes-muted">{type.hint}</span>
                        </button>)}
                    </div>}
                </div>
            </div>

            {beats.length === 0 && <div className="Scenes-empty">No beats yet. Add a narration, a fight, a cue or a decision to start.</div>}

            <ol className="Scenes-beats">
                {beats.map((beat, index) => {
                    const isCollapsed = collapsed.has(beat.id);
                    const label = `beat ${index + 1}`;
                    return <li key={beat.id} className={`Scenes-beat Scenes-beat-${beat.type}`}>
                        <div className="Scenes-beat-head">
                            <span className="Scenes-beat-number">{index + 1}</span>
                            <span className={`Scenes-chip Scenes-chip-beat-${beat.type}`}>{beatTypeLabel(beat.type)}</span>
                            {isCollapsed
                                ? <span className="Scenes-beat-collapsed-title">
                                    <strong>{beat.title || 'Untitled beat'}</strong>
                                    {beatSummary(beat) && <span className="Scenes-muted">{beatSummary(beat)}</span>}
                                </span>
                                : <input type="text" className="Scenes-beat-title" aria-label={beat.type === 'decision' ? 'Decision question' : 'Beat title'} value={beat.title || ''}
                                    placeholder={beat.type === 'decision' ? 'After the fight, where does the party go?' : 'Title'} onChange={event => changeBeat({ ...beat, title: event.target.value })}/>}
                            {beat.trigger && <span className="Scenes-chip">{beat.trigger}</span>}
                            {beat.onlyIf && <span className="Scenes-chip">Only if</span>}
                            {beat.type !== 'narration' && beat.type !== 'decision' && !isCollapsed && beat.type !== 'combat' &&
                                <input type="number" min="0" className="Scenes-beat-minutes" aria-label={`Minutes for ${label}`} value={beat.minutes || ''} placeholder="min" onChange={event => changeBeat({ ...beat, minutes: Number(event.target.value) })}/>}
                            <button type="button" className="Scenes-icon-button" aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${label}`} onClick={() => toggle(beat.id)}>{isCollapsed ? '▾' : '▴'}</button>
                            <button type="button" className="Scenes-icon-button" aria-label={`More options for ${label}`} onClick={() => setMenuFor(menuFor === beat.id ? null : beat.id)}>&bull;&bull;&bull;</button>
                            {menuFor === beat.id && <div className="Scenes-menu" role="menu">
                                <button type="button" role="menuitem" onClick={() => { setMenuFor(null); setConditionOpen(previous => new Set(previous).add(beat.id)); }}>Only if…</button>
                                <button type="button" role="menuitem" disabled={index === 0} onClick={() => { setMenuFor(null); move(index, -1); }}>Move up</button>
                                <button type="button" role="menuitem" disabled={index === beats.length - 1} onClick={() => { setMenuFor(null); move(index, 1); }}>Move down</button>
                                <button type="button" role="menuitem" onClick={() => { setMenuFor(null); const copy = { ...beat, id: newId() }; setBeats([...beats.slice(0, index + 1), copy, ...beats.slice(index + 1)]); }} disabled={beat.type === 'decision'}>Duplicate</button>
                                <button type="button" role="menuitem" className="Scenes-menu-danger" onClick={() => { setMenuFor(null); setBeats(beats.filter(other => other.id !== beat.id)); }}>Delete</button>
                            </div>}
                        </div>
                        {!isCollapsed && <div className="Scenes-beat-body">
                            <BeatEditor beat={beat} scene={current} scenes={scenes} encounters={encounters} maps={maps} bestiary={bestiary} onChange={changeBeat} onOpenMaps={onOpenMaps} onOpenEncounter={onOpenEncounter} onCreateEncounter={onCreateEncounter}
                                onCreatePathScene={(label, optionId) => onCreatePathScene(current, label, optionId)}/>
                            {!['combat', 'decision'].includes(beat.type) && <AttachmentsEditor beat={beat} onChange={changeBeat} bestiary={bestiary}/>}
                            {(beat.onlyIf || conditionOpen.has(beat.id)) && <OnlyIfSelect label="Only runs if" choices={conditionChoices(scenes, current, beat)} value={conditionKey(beat.onlyIf)}
                                onChange={choice => changeBeat({ ...beat, onlyIf: choice ? { sceneId: choice.sceneId, beatId: choice.beatId, optionId: choice.optionId } : null })}
                                onRemove={() => { closeCondition(beat.id); changeBeat({ ...beat, onlyIf: null }); }}/>}
                        </div>}
                    </li>;
                })}
            </ol>

            <div className="Scenes-builder-footer">
                <output className="Scenes-save-state">{SAVE_TEXT[state] || ''}</output>
                <button type="button" className="Scenes-button" onClick={() => setStatus('draft')}>Save Draft</button>
                <button type="button" className="Scenes-button" onClick={() => setStatus('ready')} disabled={beats.length === 0}>Mark Ready</button>
                <button type="button" className="Scenes-button Scenes-button-primary" disabled={beats.length === 0}
                    onClick={async () => { if (await flush()) onRun(scene.id); }}>Run This Scene &rarr;</button>
            </div>
        </div>

        <BuilderSide calendar={calendar} current={current} edit={edit} estimate={estimate} beats={beats} scenes={scenes} players={players} owner={owner} ownerBeat={ownerBeat} endsWith={endsWith}
            onOpenScene={onOpenScene} onSetCondition={onSetCondition} onAddNpc={() => setNewNpc(true)}/>
        {newNpc && <NewNpcDialog onClose={() => setNewNpc(false)}
            onAdd={(name, behaviors) => { setBeats([...beats, { ...newBeat('npc'), title: name, npcName: name, behaviors }]); setNewNpc(false); }}/>}
    </div>;
}
