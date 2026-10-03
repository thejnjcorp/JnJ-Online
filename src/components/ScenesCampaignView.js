import { groupArcs, playedScenes, sessionStats, sessionState, sessionTitle, timelinePips } from '../utils/scenes';

const STATE_LABEL = { played: 'Played', now: 'Now', planned: 'Planned' };

function summaryText(sessionCount, arcCount) {
    if (sessionCount === 0) return 'Nothing planned yet. Start with a session, then add its scenes.';
    const sessionsText = `${sessionCount} ${sessionCount === 1 ? 'session' : 'sessions'}`;
    const arcsText = arcCount > 1 ? ' in ' + arcCount + ' arcs' : '';
    return `${sessionsText}${arcsText}. Click a session to zoom in on its scenes.`;
}

export function PipLegend({ upcomingLabel = 'Planned', skippedLabel = "Didn't happen" }) {
    return <div className="Scenes-legend" aria-hidden="true">
        {[['done', 'Done'], ['now', 'Now'], ['planned', upcomingLabel], ['skipped', skippedLabel], ['decision', 'Decision point']].map(([state, label]) =>
            <span key={state}><span className={`Scenes-pip Scenes-pip-${state}`}/>{label}</span>)}
    </div>;
}

// "Zoomed out": every session of the campaign, grouped into arcs, each as a card
// showing its scenes as a row of small marks. Click one to zoom in on its scenes.
export function ScenesCampaignView({ sessions, scenes, onOpenSession, onNewSession, onNewScene }) {
    const arcs = groupArcs(sessions);
    const current = sessions.find(session => sessionState(scenes, session.id) === 'now');

    return <div className="Scenes-view">
        <div className="Scenes-view-head">
            <div>
                <div className="Scenes-eyebrow">All sessions</div>
                <h2 className="Scenes-title">Scenes</h2>
                <p className="Scenes-muted">
                    {summaryText(sessions.length, arcs.length)}
                </p>
            </div>
            <div className="Scenes-view-actions">
                {current && <button type="button" className="Scenes-button" onClick={() => onOpenSession(current.id)}>Jump to now</button>}
                <button type="button" className="Scenes-button" onClick={onNewSession}>+ New Session</button>
                <button type="button" className="Scenes-button Scenes-button-primary" onClick={() => onNewScene()} disabled={sessions.length === 0}>+ New Scene</button>
            </div>
        </div>

        <PipLegend/>

        {arcs.map(arc => {
            const first = arc.sessions[0].number;
            const last = arc.sessions.at(-1).number;
            return <section className="Scenes-arc" key={`${arc.arc}:${first}`}>
                <h3 className="Scenes-arc-title">
                    {arc.arc ? `${arc.arc} · ` : ''}{first === last ? `Session ${first}` : `Sessions ${first}–${last}`}
                </h3>
                <div className="Scenes-session-cards">
                    {arc.sessions.map(session => {
                        const state = sessionState(scenes, session.id);
                        const stats = sessionStats(scenes, session.id);
                        const pips = timelinePips(scenes, session.id);
                        const upcoming = playedScenes(scenes, session.id).filter(scene => scene.status !== 'completed' && scene.status !== 'skipped').length;
                        return <button type="button" key={session.id} className={`Scenes-session-card Scenes-session-card-${state}`} onClick={() => onOpenSession(session.id)} aria-label={`${sessionTitle(session)}, ${STATE_LABEL[state]}`}>
                            <span className="Scenes-session-card-head">
                                <strong>{sessionTitle(session)}</strong>
                                <span className={`Scenes-chip Scenes-chip-${state}`}>{STATE_LABEL[state]}</span>
                            </span>
                            <span className="Scenes-muted">{session.inWorldDate ? `In-world ${session.inWorldDate}` : 'In-world date not set'}</span>
                            <span className="Scenes-pips">
                                {pips.length === 0 && <span className="Scenes-muted">No scenes yet</span>}
                                {pips.map(pip => <span key={pip.key} className={`Scenes-pip Scenes-pip-${pip.state}`} title={pip.label}/>)}
                            </span>
                            <span className="Scenes-session-card-stats">
                                {`${stats.scenes} ${stats.scenes === 1 ? 'scene' : 'scenes'}${state === 'planned' && upcoming ? ' planned' : ''}`}
                                {stats.decisions > 0 && ` · ${stats.decisions} ${stats.decisions === 1 ? 'decision' : 'decisions'}`}
                                {stats.didntHappen > 0 && ` · ${stats.didntHappen} didn't happen`}
                            </span>
                            <span className="Scenes-session-card-zoom">{state === 'now' ? `Zoom into Session ${session.number} →` : 'Zoom in →'}</span>
                        </button>;
                    })}
                </div>
            </section>;
        })}

        {sessions.length > 1 && <section className="Scenes-minimap" aria-label="Whole campaign">
            <div className="Scenes-minimap-head">
                <span className="Scenes-arc-title">Whole campaign</span>
                <span className="Scenes-muted">{`${sessions.length} sessions. Click one to zoom in.`}</span>
            </div>
            <div className="Scenes-minimap-bar">
                {[...sessions].sort((a, b) => (a.number ?? 0) - (b.number ?? 0)).map(session =>
                    <button type="button" key={session.id} className={`Scenes-minimap-item Scenes-minimap-item-${sessionState(scenes, session.id)}`}
                        aria-label={`Zoom into ${sessionTitle(session)}`} onClick={() => onOpenSession(session.id)}>{session.number}</button>)}
            </div>
        </section>}
    </div>;
}
