import { useState } from 'react';
import { beatCount, optionLetter, readiness, typeLabel } from '../utils/scenes';

// "Which way did the party go?": pick the path that is actually happening, and say
// what becomes of the paths that aren't (kept on the bench for later, or thrown
// away). Or the party did something nobody planned for: name a new path on the fly.
export function SceneDecisionDialog({ owner, beat, scenes, onConfirm, onAddPath, onClose }) {
    const [chosen, setChosen] = useState(beat.chosenOptionId || beat.options?.[0]?.id || '');
    const [keep, setKeep] = useState(true);
    const [adding, setAdding] = useState(false);
    const [newPath, setNewPath] = useState('');
    const [busy, setBusy] = useState(false);

    const options = beat.options || [];
    const chosenIndex = options.findIndex(option => option.id === chosen);
    const chosenOption = options[chosenIndex];
    const others = options.filter(option => option.id !== chosen && option.sceneId);
    const sceneOf = option => scenes.find(scene => scene.id === option.sceneId);
    const nameOf = option => option.label || sceneOf(option)?.name || 'this path';

    async function confirm() {
        setBusy(true);
        try {
            await onConfirm(chosen, keep);
        } catch (error) {
            alert("Couldn't save the decision: " + error.message);
            setBusy(false);
        }
    }

    async function addPath() {
        if (!newPath.trim()) return;
        setBusy(true);
        try {
            const optionId = await onAddPath(newPath.trim());
            setChosen(optionId);
            setNewPath('');
            setAdding(false);
        } catch (error) {
            alert("Couldn't add the path: " + error.message);
        }
        setBusy(false);
    }

    return <>
        <button type="button" className="Scenes-scrim" aria-label="Close" onClick={onClose}/>
        <div className="Scenes-dialog Scenes-dialog-wide" role="dialog" aria-modal="true" aria-label="Which way did the party go?" onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
            <div className="Scenes-dialog-head">
                <div>
                    <span className="Scenes-chip Scenes-chip-decision">Decision</span>
                    <h2 className="Scenes-dialog-title">Which way did the party go?</h2>
                    <p className="Scenes-dialog-help">{beat.title || beat.question || `After ${owner.name || 'this scene'}`}</p>
                </div>
                <button type="button" className="Scenes-icon-button" aria-label="Close dialog" onClick={onClose}>&times;</button>
            </div>

            <div className="Scenes-decision-options">
                {options.map((option, index) => {
                    const scene = sceneOf(option);
                    return <button type="button" key={option.id} aria-pressed={chosen === option.id}
                        className={chosen === option.id ? 'Scenes-decision-option Scenes-decision-option-chosen' : 'Scenes-decision-option'}
                        onClick={() => setChosen(option.id)}>
                        <span className="Scenes-decision-option-head">
                            <strong>{`${optionLetter(index)} · ${option.label || scene?.name || 'Untitled path'}`}</strong>
                            {scene ? <span className="Scenes-chip">{readiness(scene)}</span> : <span className="Scenes-chip Scenes-chip-warn">No scene yet</span>}
                        </span>
                        {scene?.premise && <span className="Scenes-muted">{scene.premise}</span>}
                        {scene && <span className="Scenes-decision-option-meta">
                            <span className="Scenes-chip">{typeLabel(scene.type)}</span>
                            <span className="Scenes-muted">{beatCount(scene)}</span>
                        </span>}
                    </button>;
                })}

                {adding
                    ? <div className="Scenes-decision-add">
                        <input type="text" aria-label="Name the new path" value={newPath} placeholder="What did the party do?" autoFocus
                            onChange={event => setNewPath(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addPath(); }}/>
                        <button type="button" className="Scenes-button Scenes-button-primary" onClick={addPath} disabled={busy || !newPath.trim()}>Add path</button>
                        <button type="button" className="Scenes-button" onClick={() => { setAdding(false); setNewPath(''); }}>Cancel</button>
                    </div>
                    : <button type="button" className="Scenes-decision-add-button" onClick={() => setAdding(true)}>+ The party did something else. Add a new path on the fly</button>}
            </div>

            {chosenOption && <div className="Scenes-decision-summary">
                <span className="Scenes-field-label">What happens next</span>
                <p>
                    {`${sceneOf(chosenOption)?.name || nameOf(chosenOption)} is queued as the next scene.`}
                    {others.length > 0 && ` ${others.map(option => sceneOf(option)?.name || nameOf(option)).join(', ')} ${others.length === 1 ? 'is' : 'are'} marked "Didn't happen" on the timeline.`}
                </p>
                {others.length > 0 && <fieldset className="Scenes-decision-keep">
                    <legend>{`What should happen to ${others.map(option => sceneOf(option)?.name || nameOf(option)).join(', ')}?`}</legend>
                    <label><input type="radio" name="skipped-scenes" checked={keep} onChange={() => setKeep(true)}/>Keep for later (move it to the bench)</label>
                    <label><input type="radio" name="skipped-scenes" checked={!keep} onChange={() => setKeep(false)}/>Discard</label>
                </fieldset>}
            </div>}

            <div className="Scenes-dialog-actions">
                <button type="button" className="Scenes-button" onClick={onClose}>Not yet</button>
                <button type="button" className="Scenes-button Scenes-button-primary" onClick={confirm} disabled={busy || !chosenOption}>
                    {chosenOption ? `Confirm: ${nameOf(chosenOption)}` : 'Confirm'}
                </button>
            </div>
        </div>
    </>;
}
