import { useEffect, useMemo, useReducer, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { classFormReducer } from '../utils/classFormReducer';
import { NO_ENEMY_ERRORS, ENEMY_STAT_FIELDS, ENEMY_TIERS, formatModifier, newEnemy, parseModifier, validateEnemy } from '../utils/enemies';
import { newActionDefaults } from '../utils/classValidation';
import { getActionCategory } from '../utils/classActions';
import { newCustomTag } from '../utils/tags';
import { useTagCatalog } from '../utils/useTagCatalog';
import { ClassActionEditor } from './ClassActionEditor';
import { DocAdminManager } from './DocAdminManager';
import { FieldError, ValidationSummary, invalidClass, invalidProps, scrollToProblem } from './FormErrors';
import MarkdownEditor from './MarkdownEditor';
import '../styles/ClassPage.scss';
import '../styles/StatusPage.scss';
import '../styles/EnemyPage.scss';

const CATEGORY_SECTIONS = [
    { key: 'feat', label: 'Feats' },
    { key: 'passive', label: 'Passives' },
    { key: 'reaction', label: 'Reactions' },
    { key: 'action', label: 'Actions' },
];

const STAT_INPUTS = [
    ['base_armor_class', 'Armor Class'], ['maximum_health', 'Maximum Health'], ['action_points', 'Action Points'], ['hardness', 'Hardness'],
    ['strength_stat', 'Strength'], ['dexterity_stat', 'Dexterity'], ['intelligence_stat', 'Intelligence'], ['charisma_stat', 'Charisma'],
    ['base_hit_modifier', 'Hit Modifier'], ['base_damage_modifier', 'Damage Modifier'],
    ['base_damage_dice', 'Damage Dice'], ['base_damage_dice_type', 'Damage Die (1-6)'], ['base_healing_dice_type', 'Healing Die (1-6)'],
];

const VISIBILITIES = [
    { key: 'private', label: 'Private', hint: 'Only you (and anyone you add as a writer) can see this enemy.' },
    { key: 'public', label: 'Public', hint: 'Any signed-in user can find this enemy and copy it into their own encounters.' },
];

// A number field's value: '' shows as empty, so clearing it isn't a 0 that
// looks valid.
const shown = value => (typeof value === 'number' && !Number.isNaN(value) ? value : '');
const parsed = text => (text.trim() === '' ? NaN : Number(text));

// Weaknesses or resistances: a list of "type amount" rows. The rows are kept
// here as typed (so "Non Magical" can be typed with its space) and reported
// out as the "Fire 5" strings an enemy stores.
function ModifierList({ title, initial, readOnly, onChange, error, problemId }) {
    const [rows, setRows] = useState(() => (initial || []).map(entry => {
        const { type, amount } = parseModifier(entry);
        return { type, amount: Number.isNaN(amount) ? '' : String(amount) };
    }));

    function update(next) {
        setRows(next);
        onChange(next.map(row => formatModifier({ type: row.type, amount: row.amount === '' ? NaN : Number(row.amount) })));
    }

    return <div className="EnemyPage-modifiers" {...invalidProps(problemId, error)} tabIndex={error ? -1 : undefined}>
        <span className="ClassPage-field-label">{title}</span>
        {rows.map((row, index) => <div className="EnemyPage-modifier-row" key={index}>
            <input
                className={invalidClass('ClassPage-field-input', error)}
                aria-label={`${title} type ${index + 1}`}
                placeholder="Fire"
                value={row.type}
                disabled={readOnly}
                onChange={event => update(rows.map((r, i) => (i === index ? { ...r, type: event.target.value } : r)))}
            />
            <input
                className={invalidClass('ClassPage-field-input ClassPage-field-input-narrow', error)}
                aria-label={`${title} amount ${index + 1}`}
                type="number"
                placeholder="5"
                value={row.amount}
                disabled={readOnly}
                onChange={event => update(rows.map((r, i) => (i === index ? { ...r, amount: event.target.value } : r)))}
            />
            {!readOnly && <button type="button" className="EnemyPage-modifier-remove" aria-label={`Remove ${title.toLowerCase()} ${index + 1}`} onClick={() => update(rows.filter((_, i) => i !== index))}>Remove</button>}
        </div>)}
        <FieldError message={error}/>
        {!readOnly && <button type="button" className="ClassPage-add-tag-button" onClick={() => update([...rows, { type: '', amount: '' }])}>+ Add</button>}
    </div>;
}

// A bestiary entry: one enemy's stat block. Create at /enemies, edit at
// /enemies/:id. Staging it into a fight copies it, so editing an enemy later
// never changes one that's already been staged.
export function EnemyPage() {
    const [formData, setFormData] = useReducer(classFormReducer, { ...newEnemy(), visibility: 'private' });
    const [loaded, setLoaded] = useState(false);
    const [userId, setUserId] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showErrors, setShowErrors] = useState(false);
    const [jumpToken, setJumpToken] = useState(0);
    const navigate = useNavigate();
    const location = useLocation();
    const enemyId = location.pathname.split('/').at(2);
    const isEditing = Boolean(enemyId);
    const tagCatalog = useTagCatalog();

    useEffect(() => {
        document.title = isEditing ? 'Edit Enemy' : 'New Enemy';
        if (!isEditing) { setLoaded(true); return; }
        getDoc(doc(db, 'enemies', enemyId)).then(snap => {
            if (!snap.exists()) return;
            const data = snap.data();
            setFormData({
                type: 'REPLACE_FORM_DATA',
                payload: {
                    ...newEnemy(), ...data,
                    // an action without an id would have no stable identity in the editor
                    actions: (data.actions || []).map(action => (action.id ? action : { ...action, id: crypto.randomUUID() })),
                    visibility: data.public ? 'public' : 'private',
                },
            });
            document.title = data.enemy_name || 'Edit Enemy';
            setLoaded(true);
        }).catch(error => console.log(error));
    }, [enemyId, isEditing]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => { if (user) setUserId(user.uid); });
        return () => unsubscribe();
    }, []);

    const readOnly = isEditing && Boolean(userId) && !formData.canWrite?.includes(userId);
    const validation = useMemo(() => validateEnemy(formData), [formData]);
    const errors = showErrors ? validation : NO_ENEMY_ERRORS;

    useEffect(() => {
        if (jumpToken > 0) scrollToProblem();
    }, [jumpToken]);

    const set = (name, value) => setFormData({ name, value });
    const setNumber = field => event => set(field, parsed(event.target.value));

    function handleAddAction(category) {
        set('actions', [...(formData.actions || []), newActionDefaults(category)]);
    }

    function handleRemoveAction(index) {
        set('actions', formData.actions.filter((_, i) => i !== index));
    }

    function handleAddTag(index) {
        set(`actions[${index}].tags`, [...(formData.actions[index].tags || []), newCustomTag()]);
    }

    function handleRemoveTag(index, tagIndex) {
        set(`actions[${index}].tags`, formData.actions[index].tags.filter((_, i) => i !== tagIndex));
    }

    async function handleSubmit() {
        if (!validation.valid) {
            setShowErrors(true);
            setJumpToken(token => token + 1);
            return;
        }
        setSubmitting(true);
        try {
            const payload = { description: formData.description || '' };
            ENEMY_STAT_FIELDS.forEach(field => { payload[field] = formData[field]; });
            // a toggled-on-then-abandoned outcome table shouldn't write empty strings
            payload.actions = (formData.actions || []).map(action => {
                if (action.outcomeTable && !Object.values(action.outcomeTable).some(Boolean)) {
                    const { outcomeTable, ...rest } = action;
                    return rest;
                }
                return action;
            });
            payload.enemy_name = formData.enemy_name.trim();
            payload.public = formData.visibility === 'public';
            payload.canRead = payload.public ? [] : [userId];

            if (isEditing) {
                await updateDoc(doc(db, 'enemies', enemyId), { ...payload, canWrite: Array.from(new Set([...(formData.canWrite || []), userId])) });
                alert('Enemy updated.');
            } else {
                const docRef = await addDoc(collection(db, 'enemies'), { ...payload, canWrite: [userId], admins: [userId] });
                navigate('/enemies/' + docRef.id);
                alert('Enemy created.');
            }
        } catch (error) {
            alert('Failed to save enemy: ' + error.message);
        }
        setSubmitting(false);
    }

    async function handleDelete() {
        if (!window.confirm(`Delete "${formData.enemy_name}"? Encounters that already use it keep their copy.`)) return;
        try {
            await deleteDoc(doc(db, 'enemies', enemyId));
            navigate('/bestiary');
        } catch (error) {
            alert('Failed to delete enemy: ' + error.message);
        }
    }

    const numberField = (field, label) => <label className="EnemyPage-stat" key={field}>
        <span className="ClassPage-field-label">{label}</span>
        <input
            className={invalidClass('ClassPage-field-input', errors.fields[field])}
            {...invalidProps(`field-${field}`, errors.fields[field])}
            type="number"
            value={shown(formData[field])}
            disabled={readOnly}
            onChange={setNumber(field)}
        />
        <FieldError message={errors.fields[field]}/>
    </label>;

    const categorized = { feat: [], passive: [], reaction: [], action: [] };
    (formData.actions || []).forEach((action, index) => {
        categorized[getActionCategory(action)].push(
            <ClassActionEditor
                key={action.id || index}
                index={index}
                action={action}
                onChange={setFormData}
                onRemove={handleRemoveAction}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
                isEditable={!readOnly}
                errors={errors.actions[index]}
                previewStats={{ baseHitModifier: Number(formData.base_hit_modifier) || 0 }}
                tagCatalog={tagCatalog}
            />
        );
    });

    if (!loaded) return <div className="ClassPage"><div className="ClassPage-inner"><div className="ClassPage-hint">Loading…</div></div></div>;

    return <div className="ClassPage">
        <div className="ClassPage-inner">
            <button type="button" className="ClassPage-breadcrumb" onClick={() => navigate('/bestiary')}>&larr; Bestiary</button>

            <div className="ClassPage-header">
                <div className="ClassPage-header-main">
                    <input
                        className={invalidClass('ClassPage-title-input', errors.fields.enemy_name)}
                        {...invalidProps('field-enemy_name', errors.fields.enemy_name)}
                        aria-label="Name"
                        placeholder="Enemy name"
                        value={formData.enemy_name || ''}
                        disabled={readOnly}
                        onChange={event => set('enemy_name', event.target.value)}
                    />
                    <FieldError message={errors.fields.enemy_name}/>
                </div>
            </div>

            <ValidationSummary problems={errors.problems}/>
            {readOnly && <div className="ClassPage-hint">This enemy belongs to someone else, so it's read-only. Copy it into an encounter to use it.</div>}

            <div className="ClassPage-card">
                <div className="ClassPage-section-title">Tier</div>
                <div className="ClassPage-pill-group" role="group" aria-label="Tier" {...invalidProps('field-enemy_type', errors.fields.enemy_type)} tabIndex={errors.fields.enemy_type ? -1 : undefined}>
                    {ENEMY_TIERS.map(tier => <button
                        type="button"
                        key={tier.key}
                        className={formData.enemy_type === tier.key ? 'ClassPage-pill ClassPage-pill-selected' : 'ClassPage-pill'}
                        aria-pressed={formData.enemy_type === tier.key}
                        disabled={readOnly}
                        onClick={() => set('enemy_type', tier.key)}
                    >{tier.key}</button>)}
                </div>
                <FieldError message={errors.fields.enemy_type}/>
                <div className="ClassPage-hint">A label - shown as a badge and used to filter and total up encounters. What makes an enemy stronger is the numbers you give it below.</div>
            </div>

            <div className="ClassPage-card">
                <div className="ClassPage-section-title">Stat block</div>
                <div className="EnemyPage-stats">
                    {numberField('level', 'Level')}
                    {STAT_INPUTS.map(([field, label]) => numberField(field, label))}
                </div>
            </div>

            <div className="ClassPage-card">
                <div className="ClassPage-section-title">Weaknesses &amp; Resistances</div>
                <div className="ClassPage-hint">A type and an amount, like Fire 5. Shown as chips on the enemy's card.</div>
                <ModifierList key={`w-${enemyId}`} title="Weaknesses" initial={formData.Weaknesses} readOnly={readOnly} onChange={value => set('Weaknesses', value)} error={errors.fields.Weaknesses} problemId="field-Weaknesses"/>
                <ModifierList key={`r-${enemyId}`} title="Resistances" initial={formData.Resistances} readOnly={readOnly} onChange={value => set('Resistances', value)} error={errors.fields.Resistances} problemId="field-Resistances"/>
            </div>

            <div className="ClassPage-card">
                <div className="ClassPage-actions-header">
                    <div className="ClassPage-section-title">Actions</div>
                    {!readOnly && <div className="ClassPage-add-action-buttons">
                        <button type="button" className="ClassPage-add-action-button" onClick={() => handleAddAction('feat')}>+ Feat</button>
                        <button type="button" className="ClassPage-add-action-button" onClick={() => handleAddAction('passive')}>+ Passive</button>
                        <button type="button" className="ClassPage-add-action-button" onClick={() => handleAddAction('reaction')}>+ Reaction</button>
                        <button type="button" className="ClassPage-add-action-button" onClick={() => handleAddAction('action')}>+ Action</button>
                    </div>}
                </div>
                {CATEGORY_SECTIONS.map(section => categorized[section.key].length > 0 && <div className="ClassPage-category-group" key={section.key}>
                    <div className="ClassPage-category-group-title">{section.label}</div>
                    {categorized[section.key]}
                </div>)}
                {(formData.actions || []).length === 0 && <div className="ClassPage-hint">No actions yet.</div>}
            </div>

            <div className="ClassPage-card">
                <div className="ClassPage-section-title">Notes</div>
                <MarkdownEditor label="Notes" placeholder="Tactics, personality, what it drops - for you." value={formData.description || ''} readOnly={readOnly} onChange={value => set('description', value)}/>
            </div>

            <div className="ClassPage-card">
                <div className="ClassPage-section-title">Visibility</div>
                <div className="ClassPage-pill-group ClassPage-vis-pill-group">
                    {VISIBILITIES.map(option => <button
                        type="button"
                        key={option.key}
                        className={option.key === formData.visibility ? 'ClassPage-vis-pill ClassPage-vis-pill-selected' : 'ClassPage-vis-pill'}
                        aria-pressed={option.key === formData.visibility}
                        disabled={readOnly}
                        onClick={() => set('visibility', option.key)}
                    >
                        <span>{option.label}</span>
                        <span className="ClassPage-vis-pill-sub">{option.hint}</span>
                    </button>)}
                </div>
            </div>

            {isEditing && <DocAdminManager docRef={doc(db, 'enemies', enemyId)} admins={formData.admins} userId={userId} onChanged={() => {}}/>}

            <div className="EnemyPage-actions">
                <button type="button" className="StatusPage-submit-button" onClick={handleSubmit} disabled={readOnly || submitting}>
                    {submitting ? 'Saving…' : (isEditing ? 'Update Enemy' : 'Create Enemy')}
                </button>
                {isEditing && !readOnly && <button type="button" className="StatusPage-delete-button" onClick={handleDelete}>Delete Enemy</button>}
            </div>
        </div>
    </div>;
}
