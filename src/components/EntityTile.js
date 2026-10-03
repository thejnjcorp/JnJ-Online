import { useState } from 'react';
import { AcPopover, ApDots, HpPopover, ResourcesPopover, StatPopover, StatusPopover } from './EntityPopovers';
import { abilityLabel, chipLabel, groupName, hpRatio, hpTone, signed } from '../utils/combatants';
import '../styles/Combat.scss';

function ShieldIcon() {
    return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3 4.5 6v5.5c0 4.5 3.1 8 7.5 9.5 4.4-1.5 7.5-5 7.5-9.5V6L12 3Z"/>
    </svg>;
}

// A group's hit points: a pip for each, which opens that one's hit points.
function Pips({ members, onPick }) {
    return <div className="Entity-pips">
        {members.map((member, index) => {
            const down = member.down ? ' (down)' : '';
            return <button type="button" key={member.id}
                className={`Entity-pip${member.down ? ' Entity-pip-down' : ''} Entity-pip-${hpTone(member.hp)}`}
                aria-label={`${member.name}: ${member.hp.now} of ${member.hp.max} hit points${down}`}
                onClick={() => onPick(member.id)}>
                <span>{member.down ? '×' : member.hp.now}</span><span className="Entity-pip-index">{index + 1}</span>
            </button>;
        })}
    </div>;
}

// One's hit points as a bar, or a note that an enemy's are not tracked.
function HpReadout({ hp, onEdit }) {
    if (!hp.tracked) return <span className="Entity-hp Entity-hp-untracked" aria-label="Hit points not tracked for this enemy">HP n/a</span>;
    const temp = hp.temp > 0 ? `, plus ${hp.temp} temporary` : '';
    return <button type="button" className="Entity-hp" aria-label={`Edit hit points: ${hp.now} of ${hp.max}${temp}`} onClick={onEdit}>
        <span className="Entity-bar"><span className={`Entity-bar-${hpTone(hp)}`} style={{ width: `${hpRatio(hp) * 100}%` }}/></span>
        <span className="Entity-hp-text">{`${hp.now}/${hp.max}`}</span>
        {hp.temp > 0 && <span className="Entity-temp">{`+${hp.temp} temp`}</span>}
    </button>;
}

function Resources({ combatant, api, toggle }) {
    const reaction = combatant.reactionReady ? 'ready' : 'used';
    return <div className="Entity-resources">
        <span className="Entity-ap">
            <button type="button" className="Entity-ap-label" aria-label={`Action points: ${combatant.ap.now} of ${combatant.ap.max}, edit`} onClick={() => toggle('resources')}>AP</button>
            <ApDots combatant={combatant} api={api}/>
        </span>
        <button type="button" className={combatant.reactionReady ? 'Entity-reaction Entity-reaction-ready' : 'Entity-reaction'}
            aria-label={`Reaction ${reaction}. Click to toggle.`} onClick={() => api.setReaction(combatant, !combatant.reactionReady)}>R</button>
        {combatant.kind === 'player' && <button type="button" className="Entity-hero" aria-label={`Hero points: ${combatant.hero}`} onClick={() => toggle('resources')}>
            <span aria-hidden="true">&#9733;</span>{combatant.hero}
        </button>}
    </div>;
}

// The small edit that is open, if any, beside the tile it came from.
function TilePopovers({ popover, combatant, target, forTargets, api, onClose }) {
    if (popover === 'hp') return <HpPopover combatant={combatant} onClose={onClose} onApply={next => { api.setHp(combatant, next); onClose(); }}/>;
    if (popover?.kind === 'hp') return <HpPopover combatant={target} title={target.name} onClose={onClose} onApply={next => { api.setHp(target, next); onClose(); }}/>;
    if (popover === 'status') return <StatusPopover combatant={combatant} onClose={onClose} onChange={statuses => forTargets(member => api.setStatuses(member, statuses))} onAdd={() => api.addStatus(combatant)}/>;
    if (popover === 'ac') return <AcPopover combatant={combatant} onClose={onClose} onApply={change => forTargets(member => api.setStatuses(member, change(member.statuses)))}/>;
    if (popover === 'resources') return <ResourcesPopover combatant={combatant} api={api} onClose={onClose}/>;
    const ability = combatant.abilities.find(entry => entry.key === popover);
    if (!ability) return null;
    return <StatPopover combatant={combatant} ability={ability} canEditBase={combatant.kind === 'enemy'} onClose={onClose}
        onSetBase={value => forTargets(member => api.setBaseStat(member, ability.stat, value))} onApply={change => forTargets(member => api.setStatuses(member, change(member.statuses)))}/>;
}

// Someone in the fight, as a tile: name, armor class, hit points, the four abilities, action
// points, reaction, hero points and statuses - everything a director reads at a glance and most of
// what they change, each part a button that opens a small edit next to it. Players and enemies
// are the same tile (an enemy has a tier and no hero points); a group of minions has a pip of hit
// points for each instead of one bar. `active` is whose turn it is.
export function EntityTile({ tile, active, api }) {
    const [popover, setPopover] = useState(null);
    const isGroup = tile.kind === 'group';
    const combatant = isGroup ? tile.base : (tile.member || tile);
    const members = isGroup ? tile.members : [combatant];
    const name = isGroup ? groupName(members) : combatant.name;
    const close = () => setPopover(null);
    const toggle = which => setPopover(current => (current === which ? null : which));
    const target = popover?.member ? members.find(member => member.id === popover.member) || combatant : combatant;
    const down = isGroup ? members.every(member => member.down) : combatant.down;
    const classes = ['Entity-tile', `Entity-tile-${combatant.kind}`, active && 'Entity-tile-active', down && 'Entity-tile-down'].filter(Boolean).join(' ');
    const showDefeated = combatant.defeated && !isGroup;
    const pickPip = id => setPopover(current => (current?.member === id ? null : { member: id, kind: 'hp' }));

    // a group's change goes to everyone in it; a single one's, to them
    const forTargets = write => (isGroup && !popover?.member ? members.forEach(write) : write(target));

    return <div className={classes}>
        <div className="Entity-tile-head">
            <span className="Entity-tile-title">
                <button type="button" className="Entity-name" aria-label={`Open ${name} details`} onClick={() => api.openDrawer(combatant.id, isGroup ? tile.key : null)}>
                    <span className="Entity-name-text">{name}</span><span aria-hidden="true" className="Entity-name-chevron">&rsaquo;</span>
                </button>
                {active && <span className="Entity-badge Entity-badge-turn">Turn</span>}
                {down && !showDefeated && !isGroup && <span className="Entity-badge Entity-badge-down">Down</span>}
                {combatant.tier && <span className="Entity-tier">{`${combatant.tier} · T${combatant.raw.level ?? 1}`}</span>}
            </span>
            <button type="button" className="Entity-ac" aria-label={`Armor class ${combatant.ac}, edit`} onClick={() => toggle('ac')}>
                <ShieldIcon/>{combatant.ac}
            </button>
        </div>

        {showDefeated
            ? <div className="Entity-defeated"><span>Defeated</span><button type="button" className="Entity-button" onClick={() => api.setDefeated(combatant, false)}>Restore</button></div>
            : <>
                {isGroup ? <Pips members={members} onPick={pickPip}/> : <HpReadout hp={combatant.hp} onEdit={() => toggle('hp')}/>}

                <div className="Entity-abilities">
                    {combatant.abilities.map(ability => <button type="button" key={ability.key} aria-label={abilityLabel(ability)} onClick={() => toggle(ability.key)}>
                        <span className="Entity-ability-key">{ability.key}</span>
                        <span className={ability.delta === 0 ? 'Entity-ability-value' : 'Entity-ability-value Entity-ability-changed'}>{signed(ability.value)}</span>
                    </button>)}
                </div>

                {!isGroup && <Resources combatant={combatant} api={api} toggle={toggle}/>}

                {combatant.statuses.length > 0 && <div className="Entity-statuses">
                    {combatant.statuses.map(status => <button type="button" key={status.id} className={`Entity-status Entity-status-${status.polarity || 'neutral'}`}
                        aria-label={`Status: ${chipLabel(status)}. Click to edit.`} onClick={() => toggle('status')}>{chipLabel(status)}</button>)}
                </div>}
            </>}

        <TilePopovers popover={popover} combatant={combatant} target={target} forTargets={forTargets} api={api} onClose={close}/>
    </div>;
}
