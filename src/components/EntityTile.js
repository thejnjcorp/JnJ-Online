import { useState } from 'react';
import { AcPopover, HpPopover, ResourcesPopover, StatPopover, StatusPopover } from './EntityPopovers';
import { chipLabel, groupName, hpRatio, hpTone, signed } from '../utils/combatants';
import '../styles/Combat.scss';

function ShieldIcon() {
    return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3 4.5 6v5.5c0 4.5 3.1 8 7.5 9.5 4.4-1.5 7.5-5 7.5-9.5V6L12 3Z"/>
    </svg>;
}

const abilityLabel = ability => {
    const detail = ability.delta === 0 ? '' : ` (base ${signed(ability.base)})`;
    return `${ability.name} ${signed(ability.value)}${detail}, edit`;
};

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
    const hp = combatant.hp;
    const tone = hpTone(hp);

    // a group's change goes to everyone in it; a single one's, to them
    const forTargets = write => (isGroup && !popover?.member ? members.forEach(write) : write(target));

    return <div className={classes}>
        <div className="Entity-tile-head">
            <span className="Entity-tile-title">
                <button type="button" className="Entity-name" aria-label={`Open ${name} details`} onClick={() => api.openDrawer(combatant.id, isGroup ? tile.key : null)}>
                    <span className="Entity-name-text">{name}</span><span aria-hidden="true" className="Entity-name-chevron">&rsaquo;</span>
                </button>
                {active && <span className="Entity-badge Entity-badge-turn">Turn</span>}
                {down && !combatant.defeated && !isGroup && <span className="Entity-badge Entity-badge-down">Down</span>}
                {combatant.tier && <span className="Entity-tier">{`${combatant.tier} · T${combatant.raw.level ?? 1}`}</span>}
            </span>
            <button type="button" className="Entity-ac" aria-label={`Armor class ${combatant.ac}, edit`} onClick={() => toggle('ac')}>
                <ShieldIcon/>{combatant.ac}
            </button>
        </div>

        {combatant.defeated && !isGroup
            ? <div className="Entity-defeated"><span>Defeated</span><button type="button" className="Entity-button" onClick={() => api.setDefeated(combatant, false)}>Restore</button></div>
            : <>
                {isGroup
                    ? <div className="Entity-pips">
                        {members.map((member, index) => <button type="button" key={member.id}
                            className={`Entity-pip${member.down ? ' Entity-pip-down' : ''} Entity-pip-${hpTone(member.hp)}`}
                            aria-label={`${member.name}: ${member.hp.now} of ${member.hp.max} hit points${member.down ? ' (down)' : ''}`}
                            onClick={() => setPopover(current => (current?.member === member.id ? null : { member: member.id, kind: 'hp' }))}>
                            <span>{member.down ? '×' : member.hp.now}</span><span className="Entity-pip-index">{index + 1}</span>
                        </button>)}
                    </div>
                    : hp.tracked
                        ? <button type="button" className="Entity-hp" aria-label={`Edit hit points: ${hp.now} of ${hp.max}${hp.temp > 0 ? `, plus ${hp.temp} temporary` : ''}`} onClick={() => toggle('hp')}>
                            <span className="Entity-bar"><span className={`Entity-bar-${tone}`} style={{ width: `${hpRatio(hp) * 100}%` }}/></span>
                            <span className="Entity-hp-text">{`${hp.now}/${hp.max}`}</span>
                            {hp.temp > 0 && <span className="Entity-temp">{`+${hp.temp} temp`}</span>}
                        </button>
                        : <span className="Entity-hp Entity-hp-untracked" aria-label="Hit points not tracked for this enemy">HP n/a</span>}

                <div className="Entity-abilities">
                    {combatant.abilities.map(ability => <button type="button" key={ability.key} aria-label={abilityLabel(ability)} onClick={() => toggle(ability.key)}>
                        <span className="Entity-ability-key">{ability.key}</span>
                        <span className={ability.delta === 0 ? 'Entity-ability-value' : 'Entity-ability-value Entity-ability-changed'}>{signed(ability.value)}</span>
                    </button>)}
                </div>

                {!isGroup && <div className="Entity-resources">
                    <button type="button" className="Entity-ap" aria-label={`Action points: ${combatant.ap.now} of ${combatant.ap.max}, edit`} onClick={() => toggle('resources')}>
                        <span className="Entity-ap-label">AP</span>
                        {Array.from({ length: combatant.ap.max }, (_, index) => `${combatant.id}:${index}`).map((key, index) =>
                            <span key={key} className={index < combatant.ap.now ? 'Entity-dot Entity-dot-full' : 'Entity-dot'}/>)}
                    </button>
                    <button type="button" className={combatant.reactionReady ? 'Entity-reaction Entity-reaction-ready' : 'Entity-reaction'}
                        aria-label={`Reaction ${combatant.reactionReady ? 'ready' : 'used'}. Click to toggle.`} onClick={() => api.setReaction(combatant, !combatant.reactionReady)}>R</button>
                    {combatant.kind === 'player' && <button type="button" className="Entity-hero" aria-label={`Hero points: ${combatant.hero}`} onClick={() => toggle('resources')}>
                        <span aria-hidden="true">&#9733;</span>{combatant.hero}
                    </button>}
                </div>}

                {combatant.statuses.length > 0 && <div className="Entity-statuses">
                    {combatant.statuses.map(status => <button type="button" key={status.id} className={`Entity-status Entity-status-${status.polarity || 'neutral'}`}
                        aria-label={`Status: ${chipLabel(status)}. Click to edit.`} onClick={() => toggle('status')}>{chipLabel(status)}</button>)}
                </div>}
            </>}

        {popover === 'hp' && <HpPopover combatant={combatant} onClose={close} onApply={next => { api.setHp(combatant, next); close(); }}/>}
        {popover?.kind === 'hp' && <HpPopover combatant={target} title={target.name} onClose={close} onApply={next => { api.setHp(target, next); close(); }}/>}
        {popover === 'status' && <StatusPopover combatant={combatant} onClose={close} onChange={statuses => forTargets(member => api.setStatuses(member, statuses))} onAdd={() => api.addStatus(combatant)}/>}
        {popover === 'ac' && <AcPopover combatant={combatant} onClose={close} onApply={change => forTargets(member => api.setStatuses(member, change(member.statuses)))}/>}
        {popover === 'resources' && <ResourcesPopover combatant={combatant} api={api} onClose={close}/>}
        {combatant.abilities.map(ability => popover === ability.key && <StatPopover key={ability.key} combatant={combatant} ability={ability} canEditBase={combatant.kind === 'enemy'}
            onClose={close} onSetBase={value => forTargets(member => api.setBaseStat(member, ability.stat, value))} onApply={change => forTargets(member => api.setStatuses(member, change(member.statuses)))}/>)}
    </div>;
}
