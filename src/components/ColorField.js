import { chosenColor } from '../utils/entityColor';

// A colour to pick, or none. `value` is a #rrggbb colour or empty; empty means the side's own colour
// (`fallbackText` says so). Picking is one control, clearing another, so "none" is always one press away.
export function ColorField({ label, value, onChange, disabled = false, fallbackText = 'No colour chosen' }) {
    const color = chosenColor(value);
    return <div className="ColorField">
        <input type="color" className="ColorField-input" aria-label={label} value={color || '#888888'} disabled={disabled} onChange={event => onChange(event.target.value)}/>
        <span className="ColorField-value">{color || fallbackText}</span>
        {color && !disabled && <button type="button" className="ColorField-clear" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => onChange('')}>Clear</button>}
    </div>;
}
