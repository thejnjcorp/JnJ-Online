import { useEffect, useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { canAdministerCharacter, classToCharacterFields, raceToCharacterFields } from '../utils/characterClass';
import { loadAvailableClasses, loadAvailableRaces } from '../utils/availableOptions';
import { ABILITY_STATS, BONUS_STATS, MAX_LEVEL, claimedLevel, levelOf } from '../utils/levelUps';
import '../styles/CharacterAdmin.scss';

const NUMBER_FIELDS = [
    ...ABILITY_STATS.map(stat => ({ key: stat.key, label: stat.label, min: undefined })),
    { key: 'experience_points', label: 'Experience', min: 0 },
    { key: 'maximum_health', label: 'Maximum health', min: 1 },
    { key: 'hardness', label: 'Hardness', min: undefined },
];

const BONUS_FIELDS = BONUS_STATS.filter(stat => stat.target === 'bonus');

function initialForm(character) {
    const form = {
        character_name: character.character_name || '',
        class_id: character.class_id || '',
        race_id: character.race_id || '',
        claimed_level: String(Math.min(MAX_LEVEL, claimedLevel(character))),
    };
    NUMBER_FIELDS.forEach(field => { form[field.key] = String(character[field.key] ?? 0); });
    BONUS_FIELDS.forEach(stat => { form[`bonus_${stat.key}`] = String(character.level_bonuses?.[stat.key] ?? 0); });
    return form;
}

const isWhole = text => text.trim() !== '' && Number.isInteger(Number(text));

// Options for a class/race picker: what the campaign offers, plus the
// character's current one even when it isn't offered (a private class, say),
// so it always has something selected.
function optionsWith(available, currentId, currentName) {
    if (!currentId || available.some(item => item.id === currentId)) return available;
    return [{ id: currentId, label: `${currentName || currentId} (current)` }, ...available];
}

function AdminDialog({ character, userId, onClose }) {
    const [form, setForm] = useState(() => initialForm(character));
    const [classes, setClasses] = useState(null);
    const [races, setRaces] = useState(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        Promise.all([loadAvailableClasses(userId, character.campaign), loadAvailableRaces(userId, character.campaign)])
            .then(([loadedClasses, loadedRaces]) => {
                if (cancelled) return;
                setClasses(loadedClasses);
                setRaces(loadedRaces);
            })
            .catch(error => {
                console.log('Failed to load classes and races: ' + error);
                if (!cancelled) { setClasses([]); setRaces([]); setLoadFailed(true); }
            });
        return () => { cancelled = true; };
    }, [userId, character.campaign]);

    const classChanged = form.class_id !== (character.class_id || '');
    const raceChanged = form.race_id !== (character.race_id || '');
    const level = levelOf(form.experience_points);

    const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

    // Switching class clears what the old class handed out, so the fields show
    // what will be saved instead of leaving it a surprise.
    function pickClass(classId) {
        setForm(prev => {
            const next = { ...prev, class_id: classId };
            if (classId !== (character.class_id || '')) {
                BONUS_FIELDS.forEach(stat => { next[`bonus_${stat.key}`] = '0'; });
                next.claimed_level = String(Math.min(MAX_LEVEL, levelOf(prev.experience_points)));
            } else {
                const original = initialForm(character);
                BONUS_FIELDS.forEach(stat => { next[`bonus_${stat.key}`] = original[`bonus_${stat.key}`]; });
                next.claimed_level = original.claimed_level;
            }
            return next;
        });
    }

    const problems = useMemo(() => {
        const found = [];
        if (form.character_name.trim() === '') found.push('Give the character a name.');
        NUMBER_FIELDS.forEach(field => {
            if (!isWhole(form[field.key])) found.push(`${field.label} must be a whole number.`);
            else if (field.min !== undefined && Number(form[field.key]) < field.min) found.push(`${field.label} must be at least ${field.min}.`);
        });
        if (!isWhole(form.claimed_level) || Number(form.claimed_level) < 1 || Number(form.claimed_level) > MAX_LEVEL) found.push(`Claimed level must be from 1 to ${MAX_LEVEL}.`);
        BONUS_FIELDS.forEach(stat => { if (!isWhole(form[`bonus_${stat.key}`])) found.push(`${stat.label} bonus must be a whole number.`); });
        return found;
    }, [form]);

    const classOptions = optionsWith((classes || []).map(item => ({ id: item.id, label: item.class_name })), character.class_id, character.class_name);
    const raceOptions = optionsWith((races || []).map(item => ({ id: item.id, label: item.name })), character.race_id, character.race_name);

    async function save() {
        const changes = {};
        const name = form.character_name.trim();
        if (name !== character.character_name) changes.character_name = name;
        NUMBER_FIELDS.forEach(field => {
            if (Number(form[field.key]) !== Number(character[field.key] ?? 0)) changes[field.key] = Number(form[field.key]);
        });
        if (Number(form.claimed_level) !== Math.min(MAX_LEVEL, claimedLevel(character))) changes.claimed_level = Number(form.claimed_level);

        const bonuses = {};
        let bonusesChanged = false;
        BONUS_FIELDS.forEach(stat => {
            const amount = Number(form[`bonus_${stat.key}`]);
            if (amount !== 0) bonuses[stat.key] = amount;
            if (amount !== Number(character.level_bonuses?.[stat.key] ?? 0)) bonusesChanged = true;
        });
        if (bonusesChanged) changes.level_bonuses = bonuses;

        if (classChanged) Object.assign(changes, classToCharacterFields(classes.find(item => item.id === form.class_id)));
        if (raceChanged) Object.assign(changes, raceToCharacterFields(races.find(item => item.id === form.race_id)));

        if (Object.keys(changes).length === 0) return onClose();
        setSaving(true);
        try {
            await updateDoc(doc(db, 'characters', character.character_id), changes);
            onClose();
        } catch (error) {
            console.log('Failed to update character: ' + error);
            alert("Couldn't update the character: " + error.message);
            setSaving(false);
        }
    }

    const ready = classes !== null && races !== null;
    const canSave = ready && problems.length === 0 && !saving
        && (!classChanged || classes.some(item => item.id === form.class_id))
        && (!raceChanged || races.some(item => item.id === form.race_id));

    return <>
        <button type="button" className="CharacterAdmin-scrim" aria-label="Close" onClick={onClose}/>
        <div className="CharacterAdmin-dialog" role="dialog" aria-modal="true" aria-label="Update character" onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
            <h2 className="CharacterAdmin-title">Update character</h2>
            <p className="CharacterAdmin-help">For fixing a character or changing what it is. Everything here is saved straight to the sheet.</p>

            <label className="CharacterAdmin-field">
                <span>Name</span>
                <input value={form.character_name} onChange={event => set('character_name', event.target.value)}/>
            </label>

            <fieldset className="CharacterAdmin-group">
                <legend>Class and race</legend>
                <label className="CharacterAdmin-field">
                    <span>Class</span>
                    <select value={form.class_id} onChange={event => pickClass(event.target.value)} disabled={!ready}>
                        {!form.class_id && <option value="">Pick a class</option>}
                        {classOptions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                </label>
                {classChanged && <div className="CharacterAdmin-note" role="status">
                    Changing class replaces the character's class actions and base stats with the new class's, and clears the level-up bonuses from the old one (below - adjust them if needed). Ability scores and experience stay as they are.
                </div>}
                <label className="CharacterAdmin-field">
                    <span>Race</span>
                    <select value={form.race_id} onChange={event => set('race_id', event.target.value)} disabled={!ready}>
                        {!form.race_id && <option value="">Pick a race</option>}
                        {raceOptions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                </label>
                {raceChanged && <div className="CharacterAdmin-note" role="status">Changing race replaces the character's racial actions with the new race's.</div>}
                {loadFailed && <div className="CharacterAdmin-error" role="alert">Couldn't load the classes and races this campaign offers.</div>}
            </fieldset>

            <fieldset className="CharacterAdmin-group">
                <legend>Stats</legend>
                <div className="CharacterAdmin-grid">
                    {NUMBER_FIELDS.map(field => <label className="CharacterAdmin-field" key={field.key}>
                        <span>{field.label}</span>
                        <input type="number" min={field.min} value={form[field.key]} onChange={event => set(field.key, event.target.value)}/>
                    </label>)}
                </div>
                <div className="CharacterAdmin-level">Level {level} at this experience</div>
            </fieldset>

            <fieldset className="CharacterAdmin-group">
                <legend>Level-ups</legend>
                <div className="CharacterAdmin-grid">
                    <label className="CharacterAdmin-field">
                        <span>Claimed level</span>
                        <input type="number" min={1} max={MAX_LEVEL} value={form.claimed_level} onChange={event => set('claimed_level', event.target.value)}/>
                    </label>
                    {BONUS_FIELDS.map(stat => <label className="CharacterAdmin-field" key={stat.key}>
                        <span>{stat.label} bonus</span>
                        <input type="number" value={form[`bonus_${stat.key}`]} onChange={event => set(`bonus_${stat.key}`, event.target.value)}/>
                    </label>)}
                </div>
                <div className="CharacterAdmin-help">Level-up rewards are offered for every level above the claimed level. Bonuses are what the character has taken so far, added on top of its class's base stats.</div>
            </fieldset>

            {problems.length > 0 && <ul className="CharacterAdmin-error" role="alert">{problems.map(problem => <li key={problem}>{problem}</li>)}</ul>}

            <div className="CharacterAdmin-actions">
                <button type="button" className="CharacterAdmin-button" onClick={onClose} disabled={saving}>Cancel</button>
                <button type="button" className="CharacterAdmin-button CharacterAdmin-button-primary" onClick={save} disabled={!canSave}>
                    {saving ? 'Saving…' : 'Save changes'}
                </button>
            </div>
        </div>
    </>;
}

// The "Update character" button and its dialog, for whoever may change what a
// character is (see canAdministerCharacter); nothing for anyone else.
export function CharacterAdminButton({ character, campaignInfo, userId }) {
    const [open, setOpen] = useState(false);
    if (!canAdministerCharacter(character, campaignInfo, userId)) return null;
    return <>
        <div className="CharacterAdmin-bar">
            <button type="button" className="CharacterAdmin-open" onClick={() => setOpen(true)}>Update character</button>
        </div>
        {open && <AdminDialog character={character} userId={userId} onClose={() => setOpen(false)}/>}
    </>;
}
