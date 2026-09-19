import { useState } from 'react';
import { BONUS_STATS, MAX_LEVEL, MIN_REWARD_LEVEL, actionsUnlockedAt, describeReward, newReward } from '../utils/levelUps';
import { FieldError, invalidClass, invalidProps } from './FormErrors';
import '../styles/ClassLevelRewards.scss';

const LEVELS = Array.from({ length: MAX_LEVEL - MIN_REWARD_LEVEL + 1 }, (_, index) => index + MIN_REWARD_LEVEL);

const ADD_BUTTONS = [
    { kind: 'stat_point', label: '+ Stat point' },
    { kind: 'bonus', label: '+ Bonus' },
    { kind: 'note', label: '+ Note' },
];

function RewardRow({ reward, errors = {}, onChange, onRemove }) {
    const problemId = field => `reward-${reward.id}-${field}`;
    const fieldProps = (field, baseClass) => ({ className: invalidClass(baseClass, errors[field]), ...invalidProps(problemId(field), errors[field]) });
    const number = event => Number(event.target.value);

    return <div className="ClassLevelRewards-reward">
        <div className="ClassLevelRewards-reward-fields">
            {reward.kind === 'stat_point' && <>
                <span className="ClassLevelRewards-reward-label">Stat point</span>
                <input
                    {...fieldProps('points', 'ClassPage-field-input ClassPage-field-input-narrow')}
                    type="number" min={1} max={4} aria-label="Points"
                    value={reward.points}
                    onChange={event => onChange({ points: number(event) })}
                />
                <span className="ClassLevelRewards-reward-help">to one ability score, the player's choice</span>
            </>}
            {reward.kind === 'bonus' && <>
                <span className="ClassLevelRewards-reward-label">Bonus</span>
                <select
                    {...fieldProps('stat', 'ClassPage-field-input')}
                    aria-label="Stat"
                    value={reward.stat || ''}
                    onChange={event => onChange({ stat: event.target.value })}
                >
                    {!BONUS_STATS.some(stat => stat.key === reward.stat) && <option value="">Pick a stat</option>}
                    {BONUS_STATS.map(stat => <option key={stat.key} value={stat.key}>{stat.label}</option>)}
                </select>
                <input
                    {...fieldProps('amount', 'ClassPage-field-input ClassPage-field-input-narrow')}
                    type="number" aria-label="Amount"
                    value={reward.amount}
                    onChange={event => onChange({ amount: number(event) })}
                />
            </>}
            {reward.kind === 'note' && <>
                <span className="ClassLevelRewards-reward-label">Note</span>
                <input
                    {...fieldProps('text', 'ClassPage-field-input ClassLevelRewards-note-input')}
                    aria-label="Note"
                    placeholder="e.g. Choose a Stance to specialise in"
                    value={reward.text || ''}
                    onChange={event => onChange({ text: event.target.value })}
                />
            </>}
            <button type="button" className="ClassLevelRewards-remove" aria-label="Remove reward" onClick={onRemove}>Remove</button>
        </div>
        <FieldError message={errors.points || errors.stat || errors.amount || errors.text || errors.level || errors.kind}/>
    </div>;
}

// The class's level-up rewards, grouped by the level they arrive at, with the
// actions that unlock at each level shown alongside (those come from the
// action's own Level, so they aren't rewards to add here).
export function ClassLevelRewards({ rewards = [], actions = [], isEditable, errors = {}, onChange }) {
    const [addLevel, setAddLevel] = useState(MIN_REWARD_LEVEL);
    const asClass = { actions };
    const shownLevels = LEVELS.filter(level => rewards.some(reward => reward.level === level) || actionsUnlockedAt(asClass, level).length > 0);

    if (!isEditable && rewards.length === 0 && shownLevels.length === 0) return null;

    const update = (id, changes) => onChange(rewards.map(reward => (reward.id === id ? { ...reward, ...changes } : reward)));
    const remove = id => onChange(rewards.filter(reward => reward.id !== id));
    const add = kind => onChange([...rewards, newReward(addLevel, kind)]);

    return <div className="ClassPage-card ClassLevelRewards">
        <div className="ClassPage-section-title">Level-up rewards</div>
        <div className="ClassPage-hint">
            What a character can take when it reaches a level. Bonuses are applied automatically; stat points are placed by the player;
            notes are for anything else. Actions unlock at the Level set on the action itself, so they aren't added here.
        </div>

        {shownLevels.length === 0 && <div className="ClassPage-hint">No rewards yet.</div>}
        {shownLevels.map(level => {
            const unlocks = actionsUnlockedAt(asClass, level);
            const atLevel = rewards.filter(reward => reward.level === level);
            return <section className="ClassLevelRewards-level" key={level} aria-label={`Level ${level}`}>
                <h3 className="ClassLevelRewards-level-title">Level {level}</h3>
                {unlocks.length > 0 && <div className="ClassLevelRewards-unlocks">Unlocks: {unlocks.map(action => action.actionName || 'Unnamed').join(', ')}</div>}
                {isEditable
                    ? atLevel.map(reward => <RewardRow
                        key={reward.id}
                        reward={reward}
                        errors={errors[reward.id]}
                        onChange={changes => update(reward.id, changes)}
                        onRemove={() => remove(reward.id)}
                    />)
                    : <ul className="ClassLevelRewards-list">{atLevel.map(reward => <li key={reward.id}>{describeReward(reward)}</li>)}</ul>}
            </section>;
        })}

        {isEditable && <div className="ClassLevelRewards-add">
            <label className="ClassLevelRewards-add-level">
                <span className="ClassPage-field-label">Add to level</span>
                <select className="ClassPage-field-input" value={addLevel} onChange={event => setAddLevel(Number(event.target.value))}>
                    {LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
                </select>
            </label>
            <div className="ClassPage-add-action-buttons">
                {ADD_BUTTONS.map(button => <button type="button" key={button.kind} className="ClassPage-add-action-button" onClick={() => add(button.kind)}>{button.label}</button>)}
            </div>
        </div>}
    </div>;
}
