import { useState } from 'react';
import { Link } from 'react-router-dom';
import Markdown from './ColoredMarkdown';
import { CombatActionList } from './CombatActionList';
import { CharacterStatCalculator } from './CharacterStatCalculator';
import { chipLabel, hpRatio, hpTone, signed } from '../utils/combatants';
import { getActionCategory, isCombatAction } from '../utils/classActions';
import { getGrantedActions } from '../utils/statusEffects';
import { quantityOf } from '../utils/inventory';
import { formatModifier, parseModifier } from '../utils/enemies';
import { AcPopover, HpPopover, ResourcesPopover, StatPopover, StatusPopover } from './EntityPopovers';
import '../styles/Combat.scss';

const initials = name => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();

function Section({ title, children }) {
    return <div className="Drawer-section"><span className="Drawer-section-title">{title}</span>{children}</div>;
}

function NumberStepper({ label, value, onChange, min = 0, max = 999 }) {
    return <span className="Entity-stepper">
        <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>&minus;</button>
        <span className="Entity-stepper-value">{value}</span>
        <button type="button" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </span>;
}

// Typing a number sets it when you leave the field, not on every key - half a number is not a number.
function NumberField({ label, value, onCommit, width }) {
    const [text, setText] = useState(String(value));
    const [seen, setSeen] = useState(value);
    if (seen !== value) { setSeen(value); setText(String(value)); }
    const commit = () => {
        const number = Number(text);
        if (text.trim() === '' || !Number.isFinite(number)) { setText(String(value)); return; }
        if (number !== value) onCommit(Math.trunc(number));
    };
    return <input className="Entity-input" style={width ? { width } : undefined} type="text" inputMode="numeric" aria-label={label} value={text}
        onChange={event => setText(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.target.blur(); }}/>;
}

// ---- An enemy's drawer ---------------------------------------------------

function EnemyStats({ combatant, api, template }) {
    const { hp, ap } = combatant;
    const raw = combatant.raw;
    const [adding, setAdding] = useState(false);
    const [kind, setKind] = useState('Weaknesses');
    const [text, setText] = useState('');
    const lists = [['Weaknesses', 'Weak', combatant.weaknesses], ['Resistances', 'Resist', combatant.resistances], ['Immunities', 'Immune', combatant.immunities]];
    const entries = lists.flatMap(([field, label, list]) => list.map((entry, index) => ({ field, label, entry, index })));
    const change = (field, list) => api.setField(combatant, { [field]: list });
    const addEntry = () => {
        const value = text.trim();
        if (!value) return;
        const list = raw[kind] || [];
        change(kind, [...list, kind === 'Immunities' ? value : formatModifier(parseModifier(value))]);
        setText('');
        setAdding(false);
    };
    const passives = [...(raw.actions || []), ...getGrantedActions(raw)].filter(action => getActionCategory(action) === 'passive');
    const [popover, setPopover] = useState(null);

    return <>
        <Section title="Hit points">
            {hp.tracked
                ? <>
                    <div className="Drawer-hp-row">
                        {[-5, -1].map(value => <button type="button" key={value} className="Entity-quick-button Entity-quick-damage" aria-label={`Damage ${-value}`}
                            onClick={() => api.setHp(combatant, { ...hp, now: Math.max(0, hp.now + value) })}>{signed(value)}</button>)}
                        <span className="Drawer-hp-value">
                            <NumberField label="Current hit points" width="4.6rem" value={hp.now} onCommit={value => api.setHp(combatant, { ...hp, now: Math.max(0, Math.min(hp.max, value)) })}/>
                            <span className="Drawer-hp-max">/ {hp.max}</span>
                        </span>
                        {[1, 5].map(value => <button type="button" key={value} className="Entity-quick-button Entity-quick-heal" aria-label={`Heal ${value}`}
                            onClick={() => api.setHp(combatant, { ...hp, now: Math.min(hp.max, hp.now + value) })}>{signed(value)}</button>)}
                    </div>
                    <span className="Entity-bar Drawer-bar"><span className={`Entity-bar-${hpTone(hp)}`} style={{ width: `${hpRatio(hp) * 100}%` }}/></span>
                    <div className="Drawer-split">
                        <span className="Drawer-inline"><span className="Entity-muted">Temp HP</span>
                            <NumberStepper label="temporary hit points" value={hp.temp} onChange={value => api.setHp(combatant, { ...hp, temp: value })}/></span>
                        <span className="Drawer-inline"><span className="Entity-muted">Max HP</span>
                            <NumberField label="Maximum hit points" width="3.4rem" value={hp.max} onCommit={value => api.setField(combatant, { maximum_health: Math.max(1, value), current_health: Math.min(hp.now, Math.max(1, value)) })}/></span>
                    </div>
                </>
                : <span className="Entity-muted">Hit points are not tracked for this enemy.</span>}
        </Section>

        <Section title="Defense and turn">
            <div className="Drawer-cards">
                <div className="Drawer-card">
                    <span className="Drawer-card-label">Armor class</span>
                    <NumberField label="Armor class" width="3.4rem" value={combatant.acBase} onCommit={value => api.setBaseStat(combatant, 'base_armor_class', value)}/>
                    <span className="Entity-quick-pair">
                        <button type="button" aria-label="Decrease AC" onClick={() => api.setBaseStat(combatant, 'base_armor_class', combatant.acBase - 1)}>&minus;</button>
                        <button type="button" aria-label="Increase AC" onClick={() => api.setBaseStat(combatant, 'base_armor_class', combatant.acBase + 1)}>+</button>
                    </span>
                    {combatant.ac !== combatant.acBase && <span className="Entity-muted">{`${combatant.ac} with statuses`}</span>}
                </div>
                <div className="Drawer-card">
                    <span className="Drawer-card-label">Action points</span>
                    <button type="button" className="Entity-ap Drawer-ap" aria-label={`Action points: ${ap.now} of ${ap.max}, edit`} onClick={() => setPopover(popover === 'ap' ? null : 'ap')}>
                        {Array.from({ length: ap.max }, (_, index) => `${combatant.id}:${index}`).map((key, index) => <span key={key} className={index < ap.now ? 'Entity-dot Entity-dot-full' : 'Entity-dot'}/>)}
                    </button>
                    <span className="Entity-muted">{`${ap.now} of ${ap.max} · resets on turn`}</span>
                </div>
                <div className="Drawer-card">
                    <span className="Drawer-card-label">Reaction</span>
                    <label className="Entity-check Drawer-reaction">
                        <input type="checkbox" aria-label="Reaction ready" checked={combatant.reactionReady} onChange={event => api.setReaction(combatant, event.target.checked)}/>
                        <span className="Entity-muted">{combatant.reactionReady ? 'Ready' : 'Used'}</span>
                    </label>
                </div>
            </div>
            {popover === 'ap' && <ResourcesPopover combatant={combatant} api={api} onClose={() => setPopover(null)}/>}
        </Section>

        <Section title="Abilities">
            <div className="Drawer-cards">
                {combatant.abilities.map(ability => <div className="Drawer-card Drawer-card-ability" key={ability.key}>
                    <span className="Drawer-card-label">{ability.key}</span>
                    <span className="Drawer-card-value">{signed(ability.value)}</span>
                    <span className="Entity-quick-pair">
                        <button type="button" aria-label={`Decrease ${ability.key}`} onClick={() => api.setBaseStat(combatant, ability.stat, ability.base - 1)}>&minus;</button>
                        <button type="button" aria-label={`Increase ${ability.key}`} onClick={() => api.setBaseStat(combatant, ability.stat, ability.base + 1)}>+</button>
                    </span>
                </div>)}
            </div>
        </Section>

        <Section title="Weaknesses and immunities">
            <div className="Drawer-chips">
                {entries.map(({ field, label, entry, index }) => <span className={`Drawer-chip Drawer-chip-${label.toLowerCase()}`} key={`${field}:${index}`}>
                    <span>{`${label}: ${entry}`}</span>
                    <button type="button" aria-label={`Remove ${label}: ${entry}`} onClick={() => change(field, (raw[field] || []).filter((_, i) => i !== index))}>&times;</button>
                </span>)}
                {!adding && <button type="button" className="Drawer-chip Drawer-chip-add" onClick={() => setAdding(true)}>+ Add</button>}
            </div>
            {adding && <div className="Drawer-add-row">
                <select className="Entity-select" aria-label="Kind" value={kind} onChange={event => setKind(event.target.value)}>
                    {lists.map(([field, label]) => <option key={field} value={field}>{label}</option>)}
                </select>
                <input className="Entity-input" type="text" aria-label="Type and amount" placeholder={kind === 'Immunities' ? 'e.g. Fear' : 'e.g. Fire 5'} value={text}
                    onChange={event => setText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addEntry(); }}/>
                <button type="button" className="Entity-button Entity-button-primary" onClick={addEntry}>Add</button>
                <button type="button" className="Entity-button" onClick={() => { setAdding(false); setText(''); }}>Cancel</button>
            </div>}
        </Section>

        <Section title="Statuses">
            <div className="Drawer-chips">
                {combatant.statuses.length === 0 && <span className="Entity-muted">None right now</span>}
                {combatant.statuses.map(status => <button type="button" key={status.id} className={`Entity-status Entity-status-${status.polarity || 'neutral'}`}
                    aria-label={`Status: ${chipLabel(status)}. Click to edit.`} onClick={() => setPopover(popover === 'status' ? null : 'status')}>{chipLabel(status)}</button>)}
                <button type="button" className="Drawer-chip Drawer-chip-add" onClick={() => api.addStatus(combatant)}>+ Add status</button>
            </div>
            {popover === 'status' && <StatusPopover combatant={combatant} onClose={() => setPopover(null)} onChange={statuses => api.setStatuses(combatant, statuses)} onAdd={() => api.addStatus(combatant)}/>}
        </Section>

        {passives.length > 0 && <Section title="Passive">
            {passives.map(action => <div className="Drawer-passive" key={action.actionName}>
                <span className="Drawer-passive-name">{action.actionName}</span>
                <span className="Entity-muted">{action.description}</span>
            </div>)}
        </Section>}

        <div className="Drawer-footer">
            <span className="Drawer-saved"><span aria-hidden="true">&#10003;</span>Changes save as you make them</span>
            <div className="Drawer-footer-buttons">
                <button type="button" className="Entity-button" disabled={!template} onClick={() => api.resetToTemplate(combatant, template)}>Reset to template</button>
                <button type="button" className="Entity-button Entity-button-danger" onClick={() => api.setDefeated(combatant, !combatant.defeated)}>{combatant.defeated ? 'Restore' : 'Mark defeated'}</button>
            </div>
        </div>
    </>;
}

// ---- Actions (either kind) ------------------------------------------------

function ActionsTab({ combatant, api, userId }) {
    const raw = combatant.raw;
    const actions = [...(raw.actions || []), ...getGrantedActions(raw)].filter(isCombatAction);
    const stats = { base_hit_modifier: raw.base_hit_modifier, base_damage_modifier: raw.base_damage_modifier };
    const effective = combatant.kind === 'player'
        ? CharacterStatCalculator(raw.experience_points, combatant.ac, raw.base_hit_modifier, raw.base_damage_modifier, raw.base_damage_dice, raw.base_damage_dice_type, raw.base_healing_dice_type)
        : { ArmorClass: combatant.ac };
    return <div className="Drawer-actions">
        <div className="Drawer-ap-line">
            <span className="Entity-muted">Action points</span>
            <span className="Drawer-ap-dots">{Array.from({ length: combatant.ap.max }, (_, index) => `${combatant.id}:${index}`).map((key, index) =>
                <span key={key} className={index < combatant.ap.now ? 'Entity-dot Entity-dot-full' : 'Entity-dot'}/>)}</span>
            <span className="Entity-muted Drawer-ap-hint">Using an action spends AP on the tile</span>
        </div>
        {actions.length === 0
            ? <span className="Entity-muted">No combat actions.</span>
            : <CombatActionList
                actions={actions}
                experience_points={combatant.kind === 'player' ? raw.experience_points : 0}
                baseArmorClass={effective.ArmorClass}
                baseHitModifier={stats.base_hit_modifier}
                baseDamageModifier={stats.base_damage_modifier}
                baseDamageDice={raw.base_damage_dice}
                baseDamageDiceType={raw.base_damage_dice_type}
                baseHealingDiceType={raw.base_healing_dice_type}
                canUseActions={true}
                characterPage={raw}
                userId={userId}
                onUseAction={action => api.useAction(combatant, action)}
                hasWritePermissions={true}/>}
    </div>;
}

// ---- A player's quick look -------------------------------------------------

function QuickLook({ combatant, api, notes }) {
    const raw = combatant.raw;
    const flaws = (raw.skills_and_flaws || []).filter(entry => entry && entry.isSkill === false);
    const reactions = [...(raw.actions || []), ...getGrantedActions(raw)].filter(action => getActionCategory(action) === 'reaction');
    const classDc = CharacterStatCalculator(raw.experience_points, combatant.ac, raw.base_hit_modifier, raw.base_damage_modifier, raw.base_damage_dice, raw.base_damage_dice_type, raw.base_healing_dice_type).ClassDifficultyClass;
    const items = [...(raw.inventory || []), ...(raw.inventory_pocket || [])].filter(entry => entry?.title);
    const [draft, setDraft] = useState(notes.text);
    const [seen, setSeen] = useState(notes.text);
    if (seen !== notes.text) { setSeen(notes.text); setDraft(notes.text); }
    return <div className="Drawer-look">
        <Section title="Traits">
            {flaws.map(flaw => <div className="Drawer-row" key={flaw.name}><span className="Entity-muted">Flaw</span><span>{flaw.name}</span></div>)}
            {reactions.map(action => <div className="Drawer-row" key={action.actionName}><span className="Entity-muted">Reaction</span><span>{action.actionName}</span></div>)}
            <div className="Drawer-row"><span className="Entity-muted">Class DC</span><span>{classDc}</span></div>
        </Section>
        {items.length > 0 && <Section title="Inventory highlights">
            {items.slice(0, 6).map(entry => <div className="Drawer-row" key={entry.id || entry.title}>
                <span>{entry.title}</span><span className="Entity-muted">{quantityOf(entry) > 1 ? `×${quantityOf(entry)}` : ''}</span>
            </div>)}
        </Section>}
        <label className="Drawer-notes">
            <span className="Drawer-section-title">Director notes, private</span>
            <textarea aria-label={`Director notes on ${combatant.name}`} rows={4} value={draft} disabled={!notes.available}
                placeholder={notes.available ? '' : 'Notes need the updated Firestore rules.'}
                onChange={event => setDraft(event.target.value)} onBlur={() => draft !== notes.text && notes.save(draft)}/>
        </label>
        <div className="Drawer-look-footer">
            <span className="Entity-muted">Read-only. Edit on the character page.</span>
            <Link className="Entity-button" to={`/characters/${combatant.key}`}>Open full character page &#8599;</Link>
        </div>
    </div>;
}

// ---- The drawer itself ----------------------------------------------------

// Everything about one combatant, in a panel that slides over the right of the page (the map
// and the turn order stay where they are). An enemy: Stats, Actions, Notes. A player: their
// numbers across the top, then Actions and a Quick look. `members` is the minions when it is a group.
export function EntityDrawer({ combatant, members, zone, api, active, template, notes, userId, onClose }) {
    const isEnemy = combatant.kind === 'enemy';
    const [tab, setTab] = useState(isEnemy ? 'stats' : 'actions');
    const [popover, setPopover] = useState(null);
    const raw = combatant.raw;
    // passives are listed with the actions, but only what can be used is counted
    const actionCount = [...(raw.actions || []), ...getGrantedActions(raw)].filter(action => isCombatAction(action) && getActionCategory(action) !== 'passive').length;
    const tabs = isEnemy
        ? [['stats', 'Stats'], ['actions', `Actions · ${actionCount}`], ['notes', 'Notes']]
        : [['actions', `Actions · ${actionCount}`], ['look', 'Quick look']];
    const subtitle = isEnemy
        ? [combatant.tier, `Tier ${raw.level ?? 1}`, zone].filter(Boolean).join(' · ')
        : [combatant.subtitle, zone].filter(Boolean).join(' · ');
    const toggle = which => setPopover(current => (current === which ? null : which));
    const hp = combatant.hp;

    return <div className="Drawer" role="dialog" aria-label={`${combatant.name} details`}>
        <div className="Drawer-head">
            <span className={`Drawer-avatar Drawer-avatar-${combatant.kind}`}>
                {combatant.portrait ? <img src={combatant.portrait} alt=""/> : initials(combatant.name)}
            </span>
            <div className="Drawer-title">
                <span className="Drawer-name">{members ? `${combatant.name.replace(/\s+\d+$/, '')} ×${members.length}` : combatant.name}</span>
                <span className="Drawer-subtitle">{subtitle}</span>
            </div>
            <button type="button" className="Entity-button" aria-pressed={active} onClick={() => api.setActiveTurn(combatant)}>{active ? 'Their turn' : 'Set active turn'}</button>
            <button type="button" className="Entity-icon-button" aria-label="Close drawer" onClick={onClose}>&times;</button>
        </div>

        {!isEnemy && <>
            <div className="Drawer-summary">
                <button type="button" aria-label="Edit hit points" onClick={() => toggle('hp')}><span className="Drawer-summary-label">HP</span><span className={`Drawer-summary-value Drawer-tone-${hpTone(hp)}`}>{`${hp.now}/${hp.max}`}</span></button>
                <button type="button" aria-label="Edit armor class" onClick={() => toggle('ac')}><span className="Drawer-summary-label">AC</span><span className="Drawer-summary-value Drawer-tone-ac">{combatant.ac}</span></button>
                <button type="button" aria-label="Edit action points" onClick={() => toggle('resources')}><span className="Drawer-summary-label">AP</span><span className="Drawer-summary-value">{`${combatant.ap.now}/${combatant.ap.max}`}</span></button>
                <button type="button" aria-label="Toggle reaction" onClick={() => api.setReaction(combatant, !combatant.reactionReady)}><span className="Drawer-summary-label">Reaction</span><span className="Drawer-summary-value">{combatant.reactionReady ? 'Ready' : 'Used'}</span></button>
                <button type="button" aria-label="Edit hero points" onClick={() => toggle('resources')}><span className="Drawer-summary-label">Hero</span><span className="Drawer-summary-value Drawer-tone-ac">{`★ ${combatant.hero}`}</span></button>
            </div>
            <div className="Drawer-ability-strip">
                {combatant.abilities.map(ability => <button type="button" key={ability.key} onClick={() => toggle(ability.key)}
                    aria-label={`${ability.name} ${signed(ability.value)}${ability.delta === 0 ? '' : ` (base ${signed(ability.base)})`}, edit`}>
                    <span className="Entity-ability-key">{ability.key}</span>
                    <span className={ability.delta === 0 ? 'Entity-ability-value' : 'Entity-ability-value Entity-ability-changed'}>{signed(ability.value)}</span>
                </button>)}
            </div>
            <div className="Drawer-chips Drawer-chips-pad">
                {combatant.statuses.map(status => <button type="button" key={status.id} className={`Entity-status Entity-status-${status.polarity || 'neutral'}`}
                    aria-label={`Status: ${chipLabel(status)}. Click to edit.`} onClick={() => toggle('status')}>{chipLabel(status)}</button>)}
                <button type="button" className="Drawer-chip Drawer-chip-add" onClick={() => api.addStatus(combatant)}>+ Add status</button>
            </div>
            <div className="Drawer-popovers">
                {popover === 'hp' && <HpPopover combatant={combatant} onClose={() => setPopover(null)} onApply={next => { api.setHp(combatant, next); setPopover(null); }}/>}
                {popover === 'ac' && <AcPopover combatant={combatant} onClose={() => setPopover(null)} onApply={change => api.setStatuses(combatant, change(combatant.statuses))}/>}
                {popover === 'resources' && <ResourcesPopover combatant={combatant} api={api} onClose={() => setPopover(null)}/>}
                {popover === 'status' && <StatusPopover combatant={combatant} onClose={() => setPopover(null)} onChange={statuses => api.setStatuses(combatant, statuses)} onAdd={() => api.addStatus(combatant)}/>}
                {combatant.abilities.map(ability => popover === ability.key && <StatPopover key={ability.key} combatant={combatant} ability={ability} canEditBase={false}
                    onClose={() => setPopover(null)} onApply={change => api.setStatuses(combatant, change(combatant.statuses))}/>)}
            </div>
        </>}

        <nav className="Drawer-tabs" aria-label="Drawer sections">
            {tabs.map(([key, label]) => <button type="button" key={key} className={tab === key ? 'Drawer-tab Drawer-tab-active' : 'Drawer-tab'} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>{label}</button>)}
        </nav>

        <div className="Drawer-body">
            {members && tab === 'stats' && <Section title="Each of them">
                {members.map(member => <div className="Drawer-member" key={member.id}>
                    <span className="Drawer-member-name">{member.name}</span>
                    <NumberStepper label={`${member.name} hit points`} value={member.hp.now} max={member.hp.max} onChange={value => api.setHp(member, { ...member.hp, now: value })}/>
                    <span className="Entity-muted">{`/ ${member.hp.max}`}</span>
                    <button type="button" className="Entity-button" onClick={() => api.setDefeated(member, !member.defeated)}>{member.defeated ? 'Restore' : 'Defeat'}</button>
                </div>)}
            </Section>}
            {tab === 'stats' && <EnemyStats combatant={combatant} api={api} template={template}/>}
            {tab === 'actions' && <ActionsTab combatant={combatant} api={api} userId={userId}/>}
            {tab === 'notes' && <div className="Drawer-notes-read">
                {raw.description ? <Markdown options={{ disableParsingRawHTML: true }}>{raw.description}</Markdown> : <span className="Entity-muted">No notes on this enemy. Add tactics and what it drops in the bestiary.</span>}
            </div>}
            {tab === 'look' && <QuickLook combatant={combatant} api={api} notes={notes}/>}
        </div>
    </div>;
}
