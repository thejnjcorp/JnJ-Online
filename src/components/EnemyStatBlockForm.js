import { useState } from 'react';
import { uploadImageToImgur } from '../utils/imgurUploader';
import { imageRef, imageSrc } from '../utils/imageRefs';
import { tokenInitials } from '../utils/mapTokens';
import { ENEMY_TIERS, formatModifier, parseModifier } from '../utils/enemies';
import { benchmarkDefaults, benchmarkFor, benchmarkSummary } from '../utils/encounterGuide';
import { newActionDefaults } from '../utils/classValidation';
import { getActionCategory } from '../utils/classActions';
import { newCustomTag } from '../utils/tags';
import { ClassActionEditor } from './ClassActionEditor';
import { FieldError, invalidClass, invalidProps } from './FormErrors';
import MarkdownEditor from './MarkdownEditor';
import '../styles/ClassPage.scss';
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

// An enemy's picture, which is what its token on the combat map shows (with no
// picture the token shows the enemy's initials). A link can be pasted in, or a file
// uploaded (through Imgur, like the other pictures in the app); an Imgur link is
// stored as just its hash (see imageRefs.js).
function EnemyPicture({ name, value, readOnly, error, onChange }) {
    const [uploading, setUploading] = useState(false);
    const ref = imageRef(value);
    const [broken, setBroken] = useState(false);

    async function handleFile(event) {
        const [file] = event.target.files;
        event.target.value = '';
        if (!file) return;
        setUploading(true);
        try {
            const uploaded = await uploadImageToImgur(file);
            if (uploaded) {
                setBroken(false);
                onChange(uploaded);
            }
        } catch (uploadError) {
            alert("Couldn't upload the picture: " + uploadError.message);
        } finally {
            setUploading(false);
        }
    }

    return <div className="EnemyPage-picture">
        <div className="EnemyPage-picture-token" aria-hidden="true">
            {ref && !broken
                ? <img className="EnemyPage-picture-image" src={imageSrc(ref)} alt="" onError={() => setBroken(true)}/>
                : <span className="EnemyPage-picture-initials">{tokenInitials(name)}</span>}
        </div>
        <div className="EnemyPage-picture-fields">
            <label className="EnemyPage-picture-field">
                <span className="ClassPage-field-label">Picture link</span>
                <input
                    className={invalidClass('ClassPage-field-input', error)}
                    {...invalidProps('field-portrait_url', error)}
                    type="url"
                    placeholder="https://..."
                    value={value ? imageSrc(value) : ''}
                    disabled={readOnly}
                    onChange={event => { setBroken(false); onChange(event.target.value); }}
                />
            </label>
            {!readOnly && <div className="EnemyPage-picture-actions">
                <label className="EnemyPage-picture-upload">
                    <span className="ClassPage-field-label">Or upload one</span>
                    <input type="file" accept="image/*" disabled={uploading} onChange={handleFile}/>
                </label>
                {value && <button type="button" className="EnemyPage-modifier-remove" onClick={() => { setBroken(false); onChange(''); }}>Remove picture</button>}
            </div>}
            {uploading && <div className="ClassPage-hint" role="status">Uploading...</div>}
            {broken && <div className="ClassPage-hint" role="alert">That picture didn't load - check the link.</div>}
            <FieldError message={error}/>
        </div>
    </div>;
}

// The body of an enemy's form - tier, stat block, weaknesses and resistances,
// actions and notes - shared by the bestiary's enemy page and the encounter
// builder's "create an enemy". The name and whatever is saved around it (who can
// see it, the buttons) belong to the page using it.
//
// `formData` and `setFormData` are the form's reducer state and dispatch (see
// classFormReducer); `errors` is what validateEnemy returned once a save has been
// tried; `idKey` restarts the weakness and resistance lists when a different
// enemy is loaded into the form.
export function EnemyStatBlockForm({ formData, setFormData, errors, readOnly = false, idKey = 'new', tagCatalog }) {
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

    const benchmark = benchmarkFor(formData.enemy_type);

    return <>
        <div className="ClassPage-card">
            <div className="ClassPage-section-title">Picture</div>
            <EnemyPicture name={formData.enemy_name} value={formData.portrait_url || ''} readOnly={readOnly} error={errors.fields.portrait_url} onChange={value => set('portrait_url', value)}/>
            <div className="ClassPage-hint">Shown on this enemy's token on the combat map, instead of its initials.</div>
        </div>

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
            {benchmark && <div className="EnemyPage-benchmark">
                <span>{benchmarkSummary(benchmark)}</span>
                {!readOnly && <button type="button" className="ClassPage-add-tag-button" onClick={() => Object.entries(benchmarkDefaults(formData.enemy_type)).forEach(([field, value]) => set(field, value))}>Use the guide's numbers</button>}
            </div>}
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
            <ModifierList key={`w-${idKey}`} title="Weaknesses" initial={formData.Weaknesses} readOnly={readOnly} onChange={value => set('Weaknesses', value)} error={errors.fields.Weaknesses} problemId="field-Weaknesses"/>
            <ModifierList key={`r-${idKey}`} title="Resistances" initial={formData.Resistances} readOnly={readOnly} onChange={value => set('Resistances', value)} error={errors.fields.Resistances} problemId="field-Resistances"/>
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
    </>;
}
