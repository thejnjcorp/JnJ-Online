import { useState } from 'react';
import { CombatActionList } from './CombatActionList';
import { FeatEntry } from './SkillsAndFlaws';
import { getActionCategory } from '../utils/classActions';
import '../styles/ActionPreview.scss';

const noop = () => {};

function Choice({ options, selected, onPick, label }) {
    return <div className="ClassPage-pill-group" role="group" aria-label={label}>
        {options.map(option => <button
            type="button"
            key={option.key}
            className={option.key === selected ? 'ClassPage-pill ClassPage-pill-selected' : 'ClassPage-pill'}
            aria-pressed={option.key === selected}
            onClick={() => onPick(option.key)}
        >{option.label}</button>)}
    </div>;
}

// What an action looks like where players will meet it: a card on the
// character's Combat tab (as one they can use, or greyed out when they can't
// afford it), or - for a feat - its entry in the Skills & Flaws sidebar. It
// renders the real components, so what you see is what a character sheet
// shows, and updates as you type.
//
// The Combat tab's numbers depend on the character, so this shows the action
// at its own level with `stats` (the class's base hit modifier, when there is
// one) and no other bonuses.
export function ActionPreview({ action, stats = {} }) {
    const category = getActionCategory(action);
    const isFeat = category === 'feat';
    const isPassive = category === 'passive' || isFeat;
    const costs = Number(action.actionCost) > 0;

    const views = [{ key: 'combat', label: 'Combat tab' }];
    if (!isPassive && costs) views.push({ key: 'locked', label: 'Not enough AP' });
    if (isFeat) views.push({ key: 'sidebar', label: 'Skills sidebar' });

    const [requestedView, setView] = useState('combat');
    const [phone, setPhone] = useState(false);
    // The action's category or cost can change while previewing, which can
    // remove the view that was showing.
    const view = views.some(v => v.key === requestedView) ? requestedView : 'combat';

    const shown = {
        ...action,
        actionName: action.actionName || 'Unnamed action',
        actionCost: Number(action.actionCost) || 0,
        toHit: action.toHit ?? 0,
        difficultyClass: typeof action.difficultyClass === 'string' ? action.difficultyClass : '',
    };
    const level = Math.min(15, Math.max(1, Number(action.actionLevel) || 1));

    const list = <CombatActionList
        actions={[shown]}
        experience_points={(level - 1) * 1000}
        baseArmorClass={stats.baseArmorClass ?? 10}
        baseHitModifier={stats.baseHitModifier ?? 0}
        baseDamageModifier={0}
        baseDamageDice={1}
        baseDamageDiceType={2}
        baseHealingDiceType={2}
        canUseActions={!isPassive}
        locked={view === 'locked'}
        hasWritePermissions={true}
        onUseAction={noop}
    />;

    return <div className="ActionPreview">
        <span className="ClassPage-field-label">Preview</span>
        <div className="ActionPreview-controls">
            {views.length > 1 && <Choice label="Where to preview" options={views} selected={view} onPick={setView}/>}
            {view !== 'sidebar' && <Choice
                label="Screen size"
                options={[{ key: 'desktop', label: 'Desktop' }, { key: 'phone', label: 'Phone' }]}
                selected={phone ? 'phone' : 'desktop'}
                onPick={key => setPhone(key === 'phone')}
            />}
        </div>
        {view === 'sidebar'
            ? <div className="ActionPreview-stage ActionPreview-sidebar"><FeatEntry feat={shown} id="action-preview-feat" open/></div>
            : <div className={phone ? 'ActionPreview-stage ActionPreview-phone' : 'ActionPreview-stage'}>{list}</div>}
        <div className="ClassPage-hint">Shown at level {level}{stats.baseHitModifier !== undefined ? " with this class's base hit modifier" : ''}, with no other bonuses.</div>
    </div>;
}
