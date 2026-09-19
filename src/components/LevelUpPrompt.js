import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { ABILITY_STATS, claimLevelUps, describeReward, pendingLevelUps, unchosenRewards } from '../utils/levelUps';
import '../styles/LevelUpPrompt.scss';

function RewardLine({ reward, character, choice, onChoose }) {
    if (reward.kind === 'stat_point') {
        const name = `stat-${reward.id}`;
        return <fieldset className="LevelUp-stat-choice">
            <legend>{describeReward(reward)}</legend>
            <div className="LevelUp-stat-options">
                {ABILITY_STATS.map(stat => <label key={stat.key} className={choice === stat.key ? 'LevelUp-stat LevelUp-stat-selected' : 'LevelUp-stat'}>
                    <input type="radio" name={name} value={stat.key} checked={choice === stat.key} onChange={() => onChoose(stat.key)}/>
                    <span>{stat.label}</span>
                    <span className="LevelUp-stat-value">{Number(character[stat.key]) || 0} → {(Number(character[stat.key]) || 0) + reward.points}</span>
                </label>)}
            </div>
        </fieldset>;
    }
    return <li className="LevelUp-reward">{describeReward(reward)}{reward.kind === 'bonus' && <span className="LevelUp-auto"> (applied automatically)</span>}</li>;
}

function LevelUpDialog({ character, pending, onClose }) {
    const [choices, setChoices] = useState({});
    const [saving, setSaving] = useState(false);
    const missing = unchosenRewards(pending, choices);

    async function confirm() {
        setSaving(true);
        try {
            await updateDoc(doc(db, 'characters', character.character_id), claimLevelUps(character, pending, choices));
            onClose();
        } catch (error) {
            console.log('Failed to level up: ' + error);
            alert("Couldn't save the level-up: " + error.message);
            setSaving(false);
        }
    }

    return <>
        <button type="button" className="LevelUp-scrim" aria-label="Close" onClick={onClose}/>
        <div className="LevelUp-dialog" role="dialog" aria-modal="true" aria-label="Level up" onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
            <h2 className="LevelUp-title">Level up</h2>
            {pending.map(({ level, rewards, unlockedActions }) => <section className="LevelUp-level" key={level} aria-label={`Level ${level}`}>
                <h3>Level {level}</h3>
                {unlockedActions.length > 0 && <div className="LevelUp-unlocks">New: {unlockedActions.map(action => action.actionName).join(', ')}</div>}
                <ul className="LevelUp-rewards">
                    {rewards.map(reward => reward.kind === 'stat_point'
                        ? <li key={reward.id}><RewardLine reward={reward} character={character} choice={choices[reward.id]} onChoose={key => setChoices(prev => ({ ...prev, [reward.id]: key }))}/></li>
                        : <RewardLine key={reward.id} reward={reward} character={character}/>)}
                </ul>
            </section>)}
            {missing.length > 0 && <div className="LevelUp-hint">Choose where each stat point goes to continue.</div>}
            <div className="LevelUp-actions">
                <button type="button" className="LevelUp-button" onClick={onClose} disabled={saving}>Not yet</button>
                <button type="button" className="LevelUp-button LevelUp-button-primary" onClick={confirm} disabled={saving || missing.length > 0}>
                    {saving ? 'Saving…' : 'Confirm level-up'}
                </button>
            </div>
        </div>
    </>;
}

// Shown on a character sheet when the character has reached levels whose
// class rewards haven't been claimed. Anyone who can edit the sheet can claim.
export function LevelUpPrompt({ character, userId }) {
    const [open, setOpen] = useState(false);
    const canWrite = Boolean(userId) && (character.userId === userId || Boolean(character.canWrite?.includes(userId)));
    const pending = canWrite ? pendingLevelUps(character) : [];
    if (pending.length === 0) return null;

    const levels = pending.map(entry => entry.level);
    return <>
        <div className="LevelUp-banner" role="status">
            <span>{levels.length === 1 ? `Level ${levels[0]} reached - ` : `Levels ${levels.join(', ')} reached - `}rewards are waiting.</span>
            <button type="button" className="LevelUp-button LevelUp-button-primary" onClick={() => setOpen(true)}>Level up</button>
        </div>
        {open && <LevelUpDialog character={character} pending={pending} onClose={() => setOpen(false)}/>}
    </>;
}
