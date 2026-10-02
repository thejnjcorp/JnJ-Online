import { useState } from 'react';
import { PipLegend } from './ScenesCampaignView';
import {
    activeScene, beatCount, beatMinutes, buildTimeline, readiness, sessionState, sessionTitle, statusLabel, timeGoalText, typeLabel,
} from '../utils/scenes';

const DOT = { completed: 'done', active: 'now', skipped: 'skipped' };
const dotOf = scene => DOT[scene.status] || 'planned';

function SceneActions({ scene, onEdit, onRun, onMenu }) {
    return <div className="Scenes-row-actions">
        <button type="button" className="Scenes-button Scenes-button-small" onClick={() => onEdit(scene.id)}>Edit</button>
        {(scene.status === 'active' || scene.status === 'ready' || scene.status === 'draft') && (scene.beats || []).length > 0 &&
            <button type="button" className="Scenes-button Scenes-button-small Scenes-button-primary" onClick={() => onRun(scene.id)}>{scene.status === 'active' ? 'Resume' : 'Run'}</button>}
        {onMenu && <button type="button" className="Scenes-icon-button" aria-label={`More options for ${scene.name || 'this scene'}`} onClick={() => onMenu(scene)}>&bull;&bull;&bull;</button>}
    </div>;
}

// "Zoomed in": one session's scenes in the order they happen. Where the story can
// split, a decision shows its paths side by side until the party picks one.
export function ScenesSessionView({
    sessions, scenes, session, onBack, onOpenSession, onNewScene, onEdit, onRun, onDecide,
    onDuplicate, onBench, onDelete, onBringBack, onKeepForLater, onUpdateSession,
}) {
    const [menuFor, setMenuFor] = useState(null);
    const [editing, setEditing] = useState(false);
    const timeline = buildTimeline(scenes, session.id);
    const active = activeScene(scenes.filter(scene => scene.sessionId === session.id));
    const bench = scenes.filter(scene => scene.benched);
    const sorted = [...sessions].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
    let lastEpisode = '';

    function sceneRow(scene) {
        const heading = scene.episode && scene.episode !== lastEpisode ? <div className="Scenes-episode" key={`episode:${scene.id}`}>{scene.episode}</div> : null;
        if (scene.episode) lastEpisode = scene.episode;
        return <div key={scene.id}>
            {heading}
            <div className={`Scenes-timeline-item Scenes-timeline-item-${dotOf(scene)}`}>
                <span className={`Scenes-pip Scenes-pip-${dotOf(scene)} Scenes-timeline-dot`} aria-hidden="true"/>
                <div className="Scenes-scene-row">
                    <div className="Scenes-scene-main">
                        <strong className="Scenes-scene-name">{scene.name || 'Untitled scene'}</strong>
                        {scene.premise && <span className="Scenes-muted Scenes-scene-premise">{scene.premise}</span>}
                    </div>
                    <span className="Scenes-chip">{typeLabel(scene.type)}</span>
                    <span className="Scenes-muted">{timeGoalText(scene)}</span>
                    <span className="Scenes-muted">{beatCount(scene)}</span>
                    <span className={`Scenes-chip Scenes-chip-${scene.status}`}>{readiness(scene)}</span>
                    <SceneActions scene={scene} onEdit={onEdit} onRun={onRun} onMenu={onScene => setMenuFor(menuFor === onScene.id ? null : onScene.id)}/>
                </div>
                {menuFor === scene.id && <div className="Scenes-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => { setMenuFor(null); onDuplicate(scene); }}>Duplicate</button>
                    <button type="button" role="menuitem" onClick={() => { setMenuFor(null); onBench(scene); }}>Move to the bench</button>
                    <button type="button" role="menuitem" className="Scenes-menu-danger" onClick={() => { setMenuFor(null); onDelete(scene); }}>Delete</button>
                </div>}
            </div>
        </div>;
    }

    function decisionRow(item) {
        const { scene, beat, paths, rejoin } = item;
        const decided = Boolean(beat.chosenOptionId);
        const chosen = paths.find(path => path.state === 'taken');
        return <div key={`${scene.id}:decision`} className="Scenes-timeline-item Scenes-timeline-item-decision">
            <span className="Scenes-pip Scenes-pip-decision Scenes-timeline-dot" aria-hidden="true"/>
            <div className="Scenes-decision">
                <div className="Scenes-decision-head">
                    <div>
                        <span className="Scenes-chip Scenes-chip-decision">Decision</span>
                        <strong className="Scenes-scene-name">{beat.title || beat.question || `After ${scene.name || 'this scene'}`}</strong>
                        <span className="Scenes-muted">{decided ? `Decided: ${chosen?.option.label || chosen?.scene?.name || 'path taken'}` : 'Not decided yet · only one path will run'}</span>
                    </div>
                    <button type="button" className="Scenes-button Scenes-button-small" onClick={() => onDecide(scene.id, beat.id)}>{decided ? 'Change decision' : 'Decide…'}</button>
                </div>
                <div className="Scenes-paths">
                    {paths.map(path => <div key={path.option.id} className={`Scenes-path Scenes-path-${path.state}`}>
                        <div className="Scenes-path-head">
                            <span>{`${path.letter} · ${path.option.label || path.scene?.name || 'Untitled path'}`}</span>
                            <span className="Scenes-path-state">{{ taken: 'Taken', skipped: "Didn't happen", possible: 'Possible' }[path.state]}</span>
                        </div>
                        {path.scene
                            ? <div className="Scenes-path-body">
                                <strong className="Scenes-scene-name">{path.scene.name || 'Untitled scene'}</strong>
                                {path.scene.premise && <span className="Scenes-muted">{path.scene.premise}</span>}
                                <span className="Scenes-path-meta">
                                    <span className="Scenes-chip">{typeLabel(path.scene.type)}</span>
                                    <span className="Scenes-muted">{`${timeGoalText(path.scene)} · ${beatCount(path.scene)} · ${readiness(path.scene)}`}</span>
                                </span>
                                {path.state === 'skipped'
                                    ? <div className="Scenes-row-actions">
                                        {path.scene.benched
                                            ? <span className="Scenes-muted">On the bench</span>
                                            : <button type="button" className="Scenes-button Scenes-button-small" onClick={() => onKeepForLater(path.scene)}>Keep for later</button>}
                                        <button type="button" className="Scenes-button Scenes-button-small" onClick={() => onDelete(path.scene)}>Discard</button>
                                    </div>
                                    : <SceneActions scene={path.scene} onEdit={onEdit} onRun={onRun}/>}
                            </div>
                            : <div className="Scenes-path-body">
                                <span className="Scenes-muted">No scene built for this path yet.</span>
                            </div>}
                    </div>)}
                </div>
                <span className="Scenes-muted Scenes-decision-foot">
                    {rejoin ? `Both paths rejoin at ${rejoin.name || 'a later scene'}.` : 'Paths rejoin at the next scene.'}
                    {' '}Whichever path isn't taken is marked "Didn't happen" and you choose to keep or discard it.
                </span>
            </div>
        </div>;
    }

    return <div className="Scenes-view">
        <div className="Scenes-view-head">
            <div>
                <div className="Scenes-breadcrumb">
                    <button type="button" className="Scenes-link" onClick={onBack}>All sessions</button>
                    <span aria-hidden="true">&rsaquo;</span>
                    <span>{sessionTitle(session)}</span>
                </div>
                <h2 className="Scenes-title">{sessionTitle(session)}</h2>
                <p className="Scenes-muted">Scenes in the order they happen. Where the story can split, both paths are shown until the party picks one.</p>
            </div>
            <div className="Scenes-view-actions">
                <button type="button" className="Scenes-button" onClick={() => setEditing(open => !open)} aria-expanded={editing}>Session settings</button>
                <button type="button" className="Scenes-button" onClick={onBack}>&minus; Campaign</button>
                <button type="button" className="Scenes-button Scenes-button-primary" onClick={() => onNewScene(undefined, session.id)}>+ New Scene</button>
            </div>
        </div>

        {editing && <div className="Scenes-card Scenes-session-settings">
            <label className="Scenes-field"><span className="Scenes-field-label">Name</span>
                <input type="text" defaultValue={session.name || ''} placeholder="Optional" onBlur={event => event.target.value !== (session.name || '') && onUpdateSession(session.id, { name: event.target.value.trim() })}/></label>
            <label className="Scenes-field"><span className="Scenes-field-label">Arc</span>
                <input type="text" defaultValue={session.arc || ''} placeholder="e.g. Arc 1" onBlur={event => event.target.value !== (session.arc || '') && onUpdateSession(session.id, { arc: event.target.value.trim() })}/></label>
            <label className="Scenes-field"><span className="Scenes-field-label">In-world date</span>
                <input type="text" defaultValue={session.inWorldDate || ''} placeholder="e.g. Dec 21" onBlur={event => event.target.value !== (session.inWorldDate || '') && onUpdateSession(session.id, { inWorldDate: event.target.value.trim() })}/></label>
        </div>}

        <nav className="Scenes-session-strip" aria-label="Sessions">
            {sorted.map(other => other.id === session.id
                ? <span key={other.id} className="Scenes-session-strip-current" aria-current="page">{`${other.number} · ${{ now: 'Now', played: 'Played', planned: 'Planned' }[sessionState(scenes, other.id)]}`}</span>
                : <button type="button" key={other.id} className="Scenes-session-strip-item" onClick={() => onOpenSession(other.id)} aria-label={sessionTitle(other)}>
                    <span className={`Scenes-pip Scenes-pip-${{ now: 'now', played: 'done', planned: 'planned' }[sessionState(scenes, other.id)]}`}/>{other.number}
                </button>)}
        </nav>

        {active && <div className="Scenes-resume">
            <div>
                <span className="Scenes-pip Scenes-pip-now"/>
                <strong>{active.name}</strong>
                <span className="Scenes-muted">{`${active.inWorldDate ? active.inWorldDate + ' · ' : ''}Live · beat ${Math.max(1, (active.beats || []).findIndex(beat => beat.id === active.run?.currentBeatId) + 1)} of ${(active.beats || []).length}`}</span>
            </div>
            <button type="button" className="Scenes-button Scenes-button-primary" onClick={() => onRun(active.id)}>Resume &rarr;</button>
        </div>}

        <PipLegend upcomingLabel="Upcoming" skippedLabel="Didn't happen (path not taken)"/>

        <div className="Scenes-timeline">
            {timeline.length === 0 && <div className="Scenes-empty">No scenes in this session yet. Add one to start building it.</div>}
            {timeline.map(item => item.kind === 'scene' ? sceneRow(item.scene) : decisionRow(item))}
            {timeline.length > 0 && <div className="Scenes-timeline-end">
                <span className="Scenes-muted">{`End of ${sessionTitle(session)}.`}</span>
                <div className="Scenes-row-actions">
                    <button type="button" className="Scenes-button Scenes-button-small" onClick={() => onNewScene(undefined, session.id)}>+ Add scene</button>
                </div>
            </div>}
        </div>

        {bench.length > 0 && <section className="Scenes-bench">
            <h3 className="Scenes-arc-title">The bench</h3>
            <p className="Scenes-muted">Scenes you're keeping for later. Bring one back to put it at the end of this session.</p>
            {bench.map(scene => <div className="Scenes-scene-row Scenes-bench-row" key={scene.id}>
                <div className="Scenes-scene-main">
                    <strong className="Scenes-scene-name">{scene.name || 'Untitled scene'}</strong>
                    {scene.premise && <span className="Scenes-muted Scenes-scene-premise">{scene.premise}</span>}
                </div>
                <span className="Scenes-chip">{typeLabel(scene.type)}</span>
                <span className="Scenes-muted">{`${Math.round((scene.beats || []).reduce((sum, beat) => sum + beatMinutes(beat), 0))} min · ${statusLabel(scene.status)}`}</span>
                <div className="Scenes-row-actions">
                    <button type="button" className="Scenes-button Scenes-button-small" onClick={() => onBringBack(scene, session.id)}>Bring back</button>
                    <button type="button" className="Scenes-button Scenes-button-small" onClick={() => onDelete(scene)}>Discard</button>
                </div>
            </div>)}
        </section>}
    </div>;
}
