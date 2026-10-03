import { useState } from 'react';
import { NO_STACK_COUNT, clampStacks } from '../utils/statusEffects';
import {
    AC_STAT, DAMAGE_TYPES, DURATIONS, adjustDamage, applyHp, modifierOf, signed, statusContributions, withModifier,
} from '../utils/combatants';

// The small panels that open next to an entity's tile for a quick edit: hit points, statuses,
// armor class, action points and the like, and a single ability. Each is told what it is
// editing and hands back the change; none of them writes anything itself.

function Stepper({ label, value, onChange, min = -99, max = 99 }) {
    return <span className="Entity-stepper">
        <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>&minus;</button>
        <span className="Entity-stepper-value">{value}</span>
        <button type="button" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </span>;
}

function DurationSelect({ label, value, onChange, options = DURATIONS }) {
    return <select className="Entity-select" aria-label={label} value={value} onChange={event => onChange(event.target.value)}>
        {options.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
    </select>;
}

// The frame: what it is for, who it is for, and a way out.
export function Popover({ title, subtitle, onClose, children, label }) {
    return <div className="Entity-popover" role="group" aria-label={label || title}>
        <div className="Entity-popover-head">
            <span className="Entity-popover-title">{title}</span>
            {subtitle && <span className="Entity-popover-subtitle">{subtitle}</span>}
        </div>
        {children}
        {onClose && <span className="Entity-popover-close"><button type="button" className="Entity-button" onClick={onClose}>Done</button></span>}
    </div>;
}

// Damage, healing or temporary hit points: what the hit does, shown before it is applied.
export function HpPopover({ combatant, title, onApply, onClose }) {
    const [mode, setMode] = useState('damage');
    const [amount, setAmount] = useState('5');
    const [type, setType] = useState('Physical');
    const [useModifiers, setUseModifiers] = useState(true);
    const typed = mode === 'damage' && combatant.kind === 'enemy';
    const adjusted = typed && useModifiers ? adjustDamage(combatant, type, amount) : { amount: Math.max(0, Math.floor(Number(amount) || 0)), note: null };
    const hp = combatant.hp;
    const after = applyHp(hp, mode === 'damage' ? adjusted.amount : amount, mode);
    const verb = { damage: 'damage', heal: 'healing', temp: 'temp HP' }[mode];
    const note = typed ? adjustDamage(combatant, type, amount).note : null;

    return <Popover title="Hit points" subtitle={`${hp.now} / ${hp.max}`} label={`Hit points: ${title || combatant.name}`}>
        <div className="Entity-segmented" role="group" aria-label="Kind of change">
            {[['damage', 'Damage'], ['heal', 'Heal'], ['temp', 'Temp HP']].map(([key, text]) =>
                <button type="button" key={key} aria-pressed={mode === key} onClick={() => setMode(key)}>{text}</button>)}
        </div>
        <div className="Entity-row">
            <input className="Entity-input" type="text" inputMode="numeric" aria-label="Amount" value={amount} onChange={event => setAmount(event.target.value)}/>
            {typed && <select className="Entity-select" aria-label="Damage type" value={type} onChange={event => setType(event.target.value)}>
                {DAMAGE_TYPES.map(option => <option key={option}>{option}</option>)}
            </select>}
        </div>
        <div className="Entity-quick">
            {[1, 5, 10, 15].map(value => <button type="button" key={value} aria-label={`Set amount to ${value}`} onClick={() => setAmount(String(value))}>{value}</button>)}
        </div>
        {note && <label className="Entity-check">
            <input type="checkbox" checked={useModifiers} onChange={event => setUseModifiers(event.target.checked)}/>
            {`Apply ${note.text.toLowerCase().replace(':', '')}: makes it ${adjustDamage(combatant, type, amount).amount}`}
        </label>}
        <div className="Entity-preview">
            <span>After this {mode === 'damage' ? 'hit' : 'change'}</span>
            <span>{mode === 'temp' ? `${hp.temp} → ${after.temp} temp` : `${hp.now} → ${after.now}`}</span>
        </div>
        <div className="Entity-actions">
            <button type="button" className="Entity-button" onClick={onClose}>Cancel</button>
            <button type="button" className="Entity-button Entity-button-primary" onClick={() => onApply(after)}>
                {`Apply ${mode === 'damage' ? adjusted.amount : Math.max(0, Math.floor(Number(amount) || 0))} ${verb}`}
            </button>
        </div>
    </Popover>;
}

// Every status on them, with its count and how long it lasts; the way to add another.
export function StatusPopover({ combatant, onChange, onAdd, onClose }) {
    const statuses = combatant.statuses;
    const change = (id, patch) => onChange(statuses.map(status => (status.id === id ? { ...status, ...patch } : status)));
    return <Popover title="Statuses" subtitle={combatant.name} onClose={onClose}>
        {statuses.length === 0 && <span className="Entity-muted">None right now.</span>}
        {statuses.map(status => <div className="Entity-status-row" key={status.id}>
            <div className="Entity-status-line">
                <span className="Entity-status-name">{status.name}</span>
                {!status.modifier && status.stacks !== NO_STACK_COUNT && <Stepper label={status.name} value={status.stacks} min={0} max={9}
                    onChange={stacks => change(status.id, { stacks: clampStacks(stacks) })}/>}
                <button type="button" className="Entity-remove" aria-label={`Remove ${status.name}`} onClick={() => onChange(statuses.filter(other => other.id !== status.id))}>&times;</button>
            </div>
            <DurationSelect label={`${status.name} duration`} value={status.duration || 'removed'} onChange={duration => change(status.id, { duration })}/>
        </div>)}
        <button type="button" className="Entity-button" onClick={onAdd}>+ Add status</button>
    </Popover>;
}

// Armor class: the base, a hand-set modifier with how long it lasts and why, and the total.
export function AcPopover({ combatant, onApply, onClose }) {
    const current = modifierOf(combatant.statuses, AC_STAT);
    const [delta, setDelta] = useState(current?.delta || 0);
    const [duration, setDuration] = useState(current?.duration || 'scene');
    const [reason, setReason] = useState(current?.reason || '');
    const others = statusContributions(combatant.statuses, AC_STAT).reduce((sum, entry) => sum + entry.delta, 0);
    return <Popover title="Armor class" subtitle={`${combatant.acBase} base`} onClose={null}>
        <div className="Entity-field-row"><span>Modifier</span><Stepper label="AC modifier" value={delta} onChange={setDelta}/></div>
        <DurationSelect label="Modifier duration" value={duration} onChange={setDuration}/>
        <input className="Entity-input Entity-input-wide" type="text" aria-label="Reason" placeholder="Reason (optional), e.g. Raised shield" value={reason} onChange={event => setReason(event.target.value)}/>
        <div className="Entity-preview"><span>Total AC</span><span>{combatant.acBase + others + delta}</span></div>
        <div className="Entity-actions">
            <button type="button" className="Entity-button" onClick={() => { onApply(statuses => withModifier(statuses, AC_STAT, { delta: 0 })); onClose(); }}>Clear</button>
            <button type="button" className="Entity-button Entity-button-primary" onClick={() => { onApply(statuses => withModifier(statuses, AC_STAT, { delta, duration, reason })); onClose(); }}>Apply</button>
        </div>
    </Popover>;
}

// Action points, the reaction, hero points - each changes the moment it is clicked.
export function ResourcesPopover({ combatant, api, onClose }) {
    const { ap } = combatant;
    return <Popover title="Resources" subtitle={combatant.name} onClose={onClose}>
        <div className="Entity-field-row">
            <span>Action points</span>
            <Stepper label="AP" value={ap.now} min={0} max={ap.max} onChange={value => api.setAp(combatant, value)}/>
        </div>
        <div className="Entity-quick Entity-quick-wide">
            <button type="button" aria-label={`Reset action points to ${ap.max}`} onClick={() => api.setAp(combatant, ap.max)}>{`Reset to ${ap.max}`}</button>
            <button type="button" aria-label="Spend one action point" disabled={ap.now < 1} onClick={() => api.setAp(combatant, ap.now - 1)}>Spend 1</button>
            <button type="button" aria-label="Spend two action points" disabled={ap.now < 2} onClick={() => api.setAp(combatant, ap.now - 2)}>Spend 2</button>
        </div>
        <label className="Entity-check">
            <input type="checkbox" checked={combatant.reactionReady} onChange={event => api.setReaction(combatant, event.target.checked)}/>
            Reaction ready
        </label>
        {combatant.kind === 'player' && <div className="Entity-field-row">
            <span>Hero points</span>
            <Stepper label="hero points" value={combatant.hero} min={0} max={9} onChange={value => api.setHero(combatant, value)}/>
        </div>}
    </Popover>;
}

// One ability: what it is now, the base (editable for an enemy), what the statuses do to it,
// and a hand-set modifier.
export function StatPopover({ combatant, ability, canEditBase, onApply, onSetBase, onClose }) {
    const current = modifierOf(combatant.statuses, ability.stat);
    const [delta, setDelta] = useState(current?.delta || 0);
    const [duration, setDuration] = useState(current?.duration || 'scene');
    const contributions = statusContributions(combatant.statuses, ability.stat);
    const effective = ability.base + contributions.reduce((sum, entry) => sum + entry.delta, 0) + delta;
    return <Popover title={ability.name} subtitle={`${signed(ability.value)} now`} onClose={null}>
        <div className="Entity-field-row">
            <span>Base</span>
            {canEditBase
                ? <Stepper label={`base ${ability.name}`} value={ability.base} onChange={onSetBase}/>
                : <span className="Entity-stepper-value">{signed(ability.base)}</span>}
        </div>
        {contributions.map(entry => <div className="Entity-field-row" key={entry.name}>
            <span>{entry.name}</span><span className="Entity-stepper-value">{signed(entry.delta)}</span>
        </div>)}
        <div className="Entity-field-row"><span>Extra modifier</span><Stepper label={`${ability.name} modifier`} value={delta} onChange={setDelta}/></div>
        <DurationSelect label="Modifier duration" value={duration} onChange={setDuration}/>
        <div className="Entity-preview"><span>{`Effective ${ability.key}`}</span><span>{signed(effective)}</span></div>
        <div className="Entity-actions">
            <button type="button" className="Entity-button" onClick={() => { onApply(statuses => withModifier(statuses, ability.stat, { delta: 0 })); onClose(); }}>Clear</button>
            <button type="button" className="Entity-button Entity-button-primary" onClick={() => { onApply(statuses => withModifier(statuses, ability.stat, { delta, duration })); onClose(); }}>Apply</button>
        </div>
    </Popover>;
}

