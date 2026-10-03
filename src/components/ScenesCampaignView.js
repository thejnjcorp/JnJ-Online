import { ScenesMinimap } from './ScenesMinimap';
import { useSessionScroller } from '../utils/useSessionScroller';
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

// One session's card: its scenes as a row of small marks (the one being played lists them by name),
// and a way in.
function SessionCard({ session, scenes, onOpen, cardRef }) {
    const state = sessionState(scenes, session.id);
    const stats = sessionStats(scenes, session.id);
    const pips = timelinePips(scenes, session.id);
    const upcoming = playedScenes(scenes, session.id).filter(scene => scene.status !== 'completed' && scene.status !== 'skipped').length;
    return <button type="button" ref={cardRef} className={`Scenes-session-card Scenes-session-card-${state}`} onClick={() => onOpen(session.id)} aria-label={`${sessionTitle(session)}, ${STATE_LABEL[state]}`}>
        <span className="Scenes-session-card-head">
            <strong>{sessionTitle(session)}</strong>
            <span className={`Scenes-chip Scenes-chip-${state}`}>{STATE_LABEL[state]}</span>
        </span>
        <span className="Scenes-muted">{session.inWorldDate ? `In-world ${session.inWorldDate}` : 'In-world date not set'}</span>
        {pips.length === 0 && <span className="Scenes-pips"><span className="Scenes-muted">No scenes yet</span></span>}
        {pips.length > 0 && state === 'now' && <span className="Scenes-session-card-scenes">
            {pips.map(pip => <span key={pip.key}><span className={`Scenes-pip Scenes-pip-${pip.state}`}/>{pip.label || 'Untitled scene'}</span>)}
        </span>}
        {pips.length > 0 && state !== 'now' && <span className="Scenes-pips">
            {pips.map(pip => <span key={pip.key} className={`Scenes-pip Scenes-pip-${pip.state}`} title={pip.label}/>)}
        </span>}
        <span className="Scenes-session-card-stats">
            {`${stats.scenes} ${stats.scenes === 1 ? 'scene' : 'scenes'}${state === 'planned' && upcoming ? ' planned' : ''}`}
            {stats.decisions > 0 && ` · ${stats.decisions} ${stats.decisions === 1 ? 'decision' : 'decisions'}`}
            {stats.didntHappen > 0 && ` · ${stats.didntHappen} didn't happen`}
        </span>
        <span className="Scenes-session-card-zoom">{state === 'now' ? `Zoom into Session ${session.number} →` : 'Zoom in →'}</span>
    </button>;
}

// "Zoomed out": every session of the campaign, grouped into arcs, in one row that scrolls sideways
// (arrows at its ends), each as a card showing its scenes as a row of small marks - and under it the
// whole campaign on a strip, with a frame round what the row shows. Click a card to zoom in.
export function ScenesCampaignView({ sessions, scenes, onOpenSession, onNewSession, onNewScene }) {
    const arcs = groupArcs(sessions);
    const sorted = arcs.flatMap(arc => arc.sessions);
    const current = sessions.find(session => sessionState(scenes, session.id) === 'now');
    const { scroller, register, range, measure, scrollToSession, scrollByPage } = useSessionScroller(sorted.map(session => session.id));

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
                {current && <button type="button" className="Scenes-button" onClick={() => { onOpenSession(current.id); }}>Jump to now</button>}
                <button type="button" className="Scenes-button" onClick={onNewSession}>+ New Session</button>
                <button type="button" className="Scenes-button Scenes-button-primary" onClick={() => onNewScene()} disabled={sessions.length === 0}>+ New Scene</button>
            </div>
        </div>

        <PipLegend/>

        <div className="Scenes-sessions-frame">
            <div className="Scenes-sessions-scroller" ref={scroller} onScroll={measure}>
                {arcs.map(arc => {
                    const first = arc.sessions[0].number;
                    const last = arc.sessions.at(-1).number;
                    return <section className="Scenes-arc" key={`${arc.arc}:${first}`}>
                        <h3 className="Scenes-arc-title">
                            {arc.arc ? `${arc.arc} · ` : ''}{first === last ? `Session ${first}` : `Sessions ${first}–${last}`}
                        </h3>
                        <div className="Scenes-session-cards">
                            {arc.sessions.map(session => <SessionCard key={session.id} session={session} scenes={scenes} onOpen={onOpenSession} cardRef={register(session.id)}/>)}
                        </div>
                    </section>;
                })}
            </div>
            {!range.atStart && <span className="Scenes-sessions-fade Scenes-sessions-fade-start" aria-hidden="true"/>}
            {!range.atEnd && <span className="Scenes-sessions-fade Scenes-sessions-fade-end" aria-hidden="true"/>}
            <button type="button" className="Scenes-sessions-arrow Scenes-sessions-arrow-start" aria-label="Scroll to earlier sessions" disabled={range.atStart} onClick={() => scrollByPage(-1)}>&lsaquo;</button>
            <button type="button" className="Scenes-sessions-arrow Scenes-sessions-arrow-end" aria-label="Scroll to later sessions" disabled={range.atEnd} onClick={() => scrollByPage(1)}>&rsaquo;</button>
        </div>

        {sessions.length > 1 && <ScenesMinimap sorted={sorted} scenes={scenes} range={range} onMoveTo={scrollToSession}/>}
    </div>;
}
