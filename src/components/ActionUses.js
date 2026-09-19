import { RESETS, frequencyName, hasSpentUses, resetUses, setUsesLeft, usesLeft, usesTotal } from '../utils/actionUses';
import '../styles/ActionUses.scss';

// How many uses of a limited-use action are left ("1 / 2 per Day"). Someone who
// can edit the sheet can spend or give back a use by hand - to correct a miscount,
// or because the use happened away from the Use button.
export function ActionUsesTracker({ action, uses, canEdit, onChange }) {
    const left = usesLeft(action, uses);
    const total = usesTotal(action);
    const name = action.actionName;
    return <div className={left === 0 ? 'ActionUses ActionUses-empty' : 'ActionUses'} role="group" aria-label={`Uses of ${name}`}>
        <span className="ActionUses-label">Uses left</span>
        {canEdit && <button type="button" className="ActionUses-step" aria-label={`Spend a use of ${name}`} disabled={left <= 0} onClick={() => onChange(setUsesLeft(uses, action, left - 1))}>&minus;</button>}
        <span className="ActionUses-count">{left} / {total}</span>
        {canEdit && <button type="button" className="ActionUses-step" aria-label={`Give back a use of ${name}`} disabled={left >= total} onClick={() => onChange(setUsesLeft(uses, action, left + 1))}>+</button>}
        <span className="ActionUses-frequency">per {frequencyName(action)}</span>
    </div>;
}

// "New combat / Short rest / New day": gives the uses back to every limited-use
// action that refreshes then. A button is off when there is nothing to give back.
export function ActionUsesReset({ actions, uses, onChange }) {
    return <div className="ActionUsesReset" role="group" aria-label="Reset limited uses">
        <span className="ActionUses-label">Reset uses</span>
        {RESETS.map(reset => <button
            key={reset.key}
            type="button"
            className="ActionUsesReset-button"
            disabled={!hasSpentUses(actions, uses, reset)}
            onClick={() => onChange(resetUses(actions, uses, reset))}
        >{reset.label}</button>)}
    </div>;
}
