import { ENCOUNTER_TIERS, OBJECTIVE_LOADS, evaluateEncounter, landingText, rangeText } from '../utils/encounterGuide';
import '../styles/BalanceGuide.scss';

const statusText = status => (status.state === 'within' ? 'On target' : `${status.by} ${status.state}`);

function Metric({ label, value, range, status, note }) {
    return <div className="BalanceCheck-metric">
        <span className="BalanceCheck-metric-label">{label}</span>
        <span className="BalanceCheck-metric-value">{value}</span>
        {range && <span className="BalanceCheck-metric-range">target {rangeText(range)}</span>}
        {status && <span className={status.state === 'within' ? 'BalanceCheck-status BalanceCheck-status-good' : 'BalanceCheck-status BalanceCheck-status-warn'}>{statusText(status)}</span>}
        {note && <span className="BalanceCheck-metric-note">{note}</span>}
    </div>;
}

// How the roster stacks up against the balance guide: what difficulty its enemy
// HP amounts to, whether it is on target for the difficulty you are aiming at
// (allowing for a secondary objective), and its enemy actions and zones. The
// target and objective are the director's own choices, kept with the encounter.
export function BalanceCheck({ roster, target, objective, zoneCount, onTarget, onObjective }) {
    const result = evaluateEncounter({ roster, target, objective, zoneCount });
    const adjusted = result.hpRange && result.hpBaseRange && rangeText(result.hpRange) !== rangeText(result.hpBaseRange);

    return <div className="ClassPage-card BalanceCheck" aria-label="Balance check">
        <div className="ClassPage-section-title">Balance check</div>
        <div className="ClassPage-hint">Compared with the Level 1 balance guide - a starting benchmark for a five-character Level 1 party, not a rule.</div>

        <div className="BalanceCheck-controls">
            <div className="BalanceCheck-control">
                <span className="ClassPage-field-label">Target difficulty</span>
                <div className="ClassPage-pill-group" role="group" aria-label="Target difficulty">
                    {ENCOUNTER_TIERS.map(tier => <button
                        key={tier.key}
                        type="button"
                        className={tier.key === target ? 'ClassPage-pill ClassPage-pill-selected' : 'ClassPage-pill'}
                        aria-pressed={tier.key === target}
                        onClick={() => onTarget(tier.key === target ? '' : tier.key)}
                    >{tier.label}</button>)}
                </div>
            </div>
            <label className="BalanceCheck-control">
                <span className="ClassPage-field-label">Secondary objective</span>
                <select className="ClassPage-field-input" value={objective} onChange={event => onObjective(event.target.value)}>
                    <option value="">None</option>
                    {OBJECTIVE_LOADS.map(load => <option key={load.key} value={load.key}>{load.label} ({load.partyActions} party actions)</option>)}
                </select>
            </label>
        </div>

        {result.objective && <div className="BalanceCheck-note">{result.objective.label} objective: {result.objective.adjustment}.</div>}

        {result.enemies === 0
            ? <div className="ClassPage-hint">Add enemies to see how the fight compares.</div>
            : <>
                <div className="BalanceCheck-metrics">
                    <Metric label="Enemy HP" value={result.hp} range={result.hpRange} status={result.hpStatus} note={adjusted ? `adjusted for the objective from ${rangeText(result.hpBaseRange)}` : null}/>
                    <Metric label="Enemy actions at start" value={result.actions} range={result.actionRange} status={result.actionStatus}/>
                    {result.zoneStatus && <Metric label="Zones on the map" value={zoneCount} range={result.zoneRange} status={result.zoneStatus}/>}
                </div>
                <div className="BalanceCheck-landing">Total enemy HP is a <strong>{landingText(result.landing)}</strong> fight.</div>
                <div className="BalanceCheck-note">HP and actions here are printed HP and each enemy's action points. Resistance, healing, temporary HP, defensive reactions and summons all add to Effective HP and to the enemy actions - count them on top.</div>
                {result.flagged.length > 0 && <div className="BalanceCheck-note BalanceCheck-note-warn">{result.flagged.length === 1 ? '1 enemy is' : `${result.flagged.length} enemies are`} outside {result.flagged.length === 1 ? "its role's" : 'their roles\''} benchmarks - see the flags on {result.flagged.length === 1 ? 'its row' : 'their rows'} below.</div>}
            </>}
    </div>;
}
