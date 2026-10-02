import { useState } from 'react';
import { SCENE_TYPES, mainScenes, sessionTitle } from '../utils/scenes';
import { useEscapeKey } from '../utils/useEscapeKey';

// What the "place on timeline" choice means to the timeline: nothing (the end), null
// (the start), or the scene to follow.
function afterSceneIdOf(choice) {
    if (choice === 'last') return undefined;
    return choice === 'first' ? null : choice;
}

// The "New Scene" popup: a name, a type, where it goes on the timeline, an optional
// in-world date and time goal, and whether to start from nothing or copy another
// scene. Creating hands everything to `onCreate`, which makes the scene and opens it
// in the builder.
export function NewSceneDialog({ sessions, scenes, defaultSessionId, afterSceneId, onCreate, onClose }) {
    useEscapeKey(onClose);
    const firstSession = defaultSessionId || sessions[sessions.length - 1]?.id || '';
    const [name, setName] = useState('');
    const [type, setType] = useState('roleplay');
    const [sessionId, setSessionId] = useState(firstSession);
    const [after, setAfter] = useState(afterSceneId === undefined ? 'last' : (afterSceneId || 'first'));
    const [inWorldDate, setInWorldDate] = useState('');
    const [timeMin, setTimeMin] = useState('');
    const [timeMax, setTimeMax] = useState('');
    const [startFrom, setStartFrom] = useState('blank');
    const [duplicateOf, setDuplicateOf] = useState('');
    const [busy, setBusy] = useState(false);

    const sceneOptions = sessionId ? mainScenes(scenes, sessionId) : [];
    const canCreate = name.trim() !== '' && !busy && (startFrom !== 'duplicate' || duplicateOf !== '');

    async function create() {
        if (!canCreate) return;
        setBusy(true);
        try {
            await onCreate({
                name: name.trim(), type, sessionId, inWorldDate: inWorldDate.trim(),
                timeMin: Number(timeMin) > 0 ? Number(timeMin) : null,
                timeMax: Number(timeMax) > 0 ? Number(timeMax) : null,
                afterSceneId: afterSceneIdOf(after),
                duplicateOf: startFrom === 'duplicate' ? duplicateOf : '',
            });
        } catch (error) {
            alert("Couldn't create the scene: " + error.message);
            setBusy(false);
        }
    }

    return <>
        <button type="button" className="Scenes-scrim" aria-label="Close" onClick={onClose}/>
        <dialog open className="Scenes-dialog" aria-modal="true" aria-label="New Scene">
            <div className="Scenes-dialog-head">
                <h2 className="Scenes-dialog-title">New Scene</h2>
                <button type="button" className="Scenes-icon-button" aria-label="Close dialog" onClick={onClose}>&times;</button>
            </div>

            <label className="Scenes-field">
                <span className="Scenes-field-label">Scene name</span>
                <input type="text" value={name} placeholder="e.g. Aftermath" autoFocus onChange={event => setName(event.target.value)}
                    onKeyDown={event => { if (event.key === 'Enter') create(); }}/>
            </label>

            <div className="Scenes-field">
                <span className="Scenes-field-label" id="new-scene-type">Scene type</span>
                <fieldset className="Scenes-segmented" aria-labelledby="new-scene-type">
                    {SCENE_TYPES.map(option => <button type="button" key={option.key} aria-pressed={type === option.key} onClick={() => setType(option.key)}>{option.label}</button>)}
                </fieldset>
            </div>

            <div className="Scenes-field-row">
                <label className="Scenes-field">
                    <span className="Scenes-field-label">Session</span>
                    <select value={sessionId} onChange={event => { setSessionId(event.target.value); setAfter('last'); }}>
                        {sessions.map(session => <option key={session.id} value={session.id}>{sessionTitle(session)}</option>)}
                    </select>
                </label>
                <label className="Scenes-field">
                    <span className="Scenes-field-label">Place on timeline</span>
                    <select value={after} onChange={event => setAfter(event.target.value)}>
                        <option value="last">At the end</option>
                        <option value="first">At the start</option>
                        {sceneOptions.map(scene => <option key={scene.id} value={scene.id}>{`After: ${scene.name || 'Untitled scene'}`}</option>)}
                    </select>
                </label>
            </div>

            <div className="Scenes-field-row">
                <label className="Scenes-field">
                    <span className="Scenes-field-label">In-world date</span>
                    <input type="text" value={inWorldDate} placeholder="e.g. Dec 21" onChange={event => setInWorldDate(event.target.value)}/>
                </label>
                <div className="Scenes-field-row Scenes-field-row-tight">
                    <label className="Scenes-field">
                        <span className="Scenes-field-label">Time goal (min)</span>
                        <input type="number" min="0" value={timeMin} placeholder="e.g. 8" onChange={event => setTimeMin(event.target.value)}/>
                    </label>
                    <label className="Scenes-field">
                        <span className="Scenes-field-label">to (min)</span>
                        <input type="number" min="0" value={timeMax} placeholder="e.g. 12" onChange={event => setTimeMax(event.target.value)}/>
                    </label>
                </div>
            </div>

            <div className="Scenes-field">
                <span className="Scenes-field-label" id="new-scene-start">Start from</span>
                <fieldset className="Scenes-segmented" aria-labelledby="new-scene-start">
                    <button type="button" aria-pressed={startFrom === 'blank'} onClick={() => setStartFrom('blank')}>Blank</button>
                    <button type="button" aria-pressed={startFrom === 'duplicate'} onClick={() => setStartFrom('duplicate')} disabled={scenes.length === 0}>Duplicate scene</button>
                </fieldset>
                {startFrom === 'duplicate' && <select aria-label="Scene to duplicate" value={duplicateOf} onChange={event => setDuplicateOf(event.target.value)}>
                    <option value="">Choose a scene…</option>
                    {scenes.filter(scene => !scene.benched).map(scene => <option key={scene.id} value={scene.id}>{scene.name || 'Untitled scene'}</option>)}
                </select>}
            </div>

            <div className="Scenes-dialog-actions">
                <button type="button" className="Scenes-button" onClick={onClose}>Cancel</button>
                <button type="button" className="Scenes-button Scenes-button-primary" onClick={create} disabled={!canCreate}>Create &amp; Build &rarr;</button>
            </div>
        </dialog>
    </>;
}
