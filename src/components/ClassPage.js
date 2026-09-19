import { useEffect, useMemo, useReducer, useState } from 'react';
import { reverseCharacterDiceConverter, CharacterDiceConverter } from './CharacterStatCalculator';
import { useNavigate, useLocation } from 'react-router-dom';
import { addDoc, arrayRemove, collection, getDoc, getDocs, doc, or, query, updateDoc, where } from '@firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import Markdown from 'markdown-to-jsx';
import MarkdownEditor from './MarkdownEditor';
import { auth, db } from '../utils/firebase';
import { ADMIN_UIDS } from '../utils/statusEffects';
import { getActionCategory } from '../utils/classActions';
import { subscribeClassToCampaign } from '../utils/campaignSubscriptions';
import { classFormReducer } from '../utils/classFormReducer';
import { NO_ERRORS, newActionDefaults, validateClass } from '../utils/classValidation';
import { FieldError, ValidationSummary, invalidClass, invalidProps, scrollToProblem } from './FormErrors';
import { ClassActionEditor } from './ClassActionEditor';
import { ClassLevelRewards } from './ClassLevelRewards';
import { newCustomTag } from '../utils/tags';
import { useTagCatalog } from '../utils/useTagCatalog';
import { ClassDamageCard } from './ClassDamageCard';
import { DocAdminManager } from './DocAdminManager';
import { ClassPublishDialog } from './ClassPublishDialog';
import { listClassVersions, publishClassVersion, resolveClassVersion, versionOf } from '../utils/classVersions';
import ClassLayout from '../ClassLayout.json';
import '../styles/ClassPage.scss';

const CATEGORY_SECTIONS = [
    { key: 'feat', label: 'Feats' },
    { key: 'passive', label: 'Passives' },
    { key: 'reaction', label: 'Reactions' },
    { key: 'action', label: 'Actions' },
];

const TYPE_OPTIONS = ['Attrionist', 'Crit Hunter', 'Manipulator', 'Snowballer'];
// Same accent mapping ClassListPage.js's TYPE_ACCENT_CLASS uses, so a
// class's type badge here matches its catalog card's accent color.
const TYPE_ACCENT_CLASS = {
    'Attrionist': 'ClassPage-type-arcane',
    'Crit Hunter': 'ClassPage-type-ember',
    'Manipulator': 'ClassPage-type-success',
    'Snowballer': 'ClassPage-type-danger',
};

// Same three-tier model as StatusPage.js's getVisibilityOptions, minus the
// campaign-lock tier (no class-creation flow asks for one yet - see the
// comment on the classes match block in firestore.rules).
function getVisibilityOptions(isAdmin) {
    return [
        {
            key: 'public',
            label: isAdmin ? 'Public (Default)' : 'Pool (Public)',
            hint: isAdmin
                ? 'Every campaign gets this automatically - no subscription needed. Only the admin account can create these.'
                : "Any signed-in user can browse this in the Classes catalog, but a Director has to subscribe their campaign to it (see below, once saved) before it's offered when creating a character in that campaign.",
        },
        { key: 'private', label: 'Private', hint: 'Only visible to you (and anyone else you add to canWrite).' },
    ];
}

// Derives the UI-only "visibility" radio from the persisted public field, so
// editing an existing class starts on the right option.
function visibilityFromDoc(data) {
    return data.public ? 'public' : 'private';
}

const formReducer = classFormReducer;

const delay = ms => new Promise(res => setTimeout(res, ms));

export function ClassPage() {
    const [liveFormData, setFormData] = useReducer(formReducer, { visibility: 'public' });
    // Looking at an older version is read-only and display-only: its snapshot
    // stands in for the form data (keeping the class's own permission and
    // visibility fields, which snapshots don't carry) without touching the
    // real form state, so nothing from an old version can be saved by accident.
    const [viewingSnapshot, setViewingSnapshot] = useState(null);
    const formData = viewingSnapshot
        ? {
            ...viewingSnapshot.data,
            version: viewingSnapshot.version,
            canWrite: liveFormData.canWrite,
            admins: liveFormData.admins,
            public: liveFormData.public,
            isDefault: liveFormData.isDefault,
            visibility: liveFormData.visibility,
        }
        : liveFormData;
    const [versionList, setVersionList] = useState([]);
    const [publishDialogOpen, setPublishDialogOpen] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [isPageVisible, setIsPageVisible] = useState(true);
    const [isActionListVisible, setIsActionListVisible] = useState(true);
    const [userId, setUserId] = useState('');
    const [myCampaigns, setMyCampaigns] = useState([]);
    const navigate = useNavigate();
    const location = useLocation();
    const classId = location.pathname.split('/').at(2);
    const isEditingExisting = location.pathname.split('/').length > 2;
    // Starts in View mode even for the class's own author - editing is
    // opt-in via the header's Edit button, never automatic just because you
    // have write access. A brand-new class has nothing to view, so it's
    // always in edit mode instead.
    const [isEditingMode, setIsEditingMode] = useState(!isEditingExisting);
    const tagCatalog = useTagCatalog(isEditingMode);
    const [savedSnapshot, setSavedSnapshot] = useState(null);
    // Errors stay hidden until the first failed save, then track the form live
    // so each one clears the moment it's fixed.
    const [showErrors, setShowErrors] = useState(false);
    const [jumpToken, setJumpToken] = useState(0);
    const validation = useMemo(() => validateClass(liveFormData), [liveFormData]);
    const errors = showErrors ? validation : NO_ERRORS;

    useEffect(() => {
        if (jumpToken === 0) return;
        scrollToProblem();
    }, [jumpToken]);

    useEffect(() => {
        document.title = "New Class";
        if (isEditingExisting) {
            getClassData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location])

    useEffect(() => {
        // auth.currentUser can still be null right after a hard page load,
        // before Firebase has rehydrated the session - waiting on this (same
        // as StatusPage.js does) avoids the admin/subscribe sections
        // silently staying empty on a fresh navigation or a page refresh.
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) return;
            setUserId(user.uid);
            // Same "campaigns I belong to" query StatusPage.js already uses
            // for its own subscribe section.
            getDocs(query(collection(db, 'campaigns'), or(where('canRead', 'array-contains', user.uid), where('canWrite', 'array-contains', user.uid))))
                .then(querySnapshot => {
                    setMyCampaigns(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                }).catch(error => console.log(error));
            unsubscribe();
        });
    }, []);

    async function getClassData() {
        const docRef = await getDoc(doc(db, "classes", classId));
        const data = docRef.data();
        setFormData({ type: 'SET_FORM_DATA', payload: { ...data, visibility: visibilityFromDoc(data) } });
        document.title = data.class_name;
        setViewingSnapshot(null);
        rerenderPage();
        // Best effort - someone who can read the class but not (say) its
        // versions subcollection just doesn't get a history list.
        listClassVersions(classId).then(setVersionList).catch(() => setVersionList([]));
    }

    async function viewVersion(version) {
        if (version === versionOf(liveFormData)) {
            setViewingSnapshot(null);
            return;
        }
        try {
            const { data } = await resolveClassVersion(classId, version);
            setViewingSnapshot({ version, data });
        } catch (e) {
            alert(`Couldn't load version ${version}: ${e.message}`);
        }
    }

    // Subscribing writes to the campaign doc, not the class - needs actual
    // write access there (director or canWrite), not just membership (the
    // broader "campaigns I belong to" list myCampaigns already fetches).
    const myWritableCampaigns = myCampaigns.filter(c => c.canWrite?.includes(userId) || c.director_uid === userId);

    async function toggleSubscription(campaign) {
        const subscribed = campaign.subscribedClassIds?.includes(classId);
        try {
            let subscribedStatusIds = campaign.subscribedStatusIds || [];
            if (subscribed) {
                await updateDoc(doc(db, 'campaigns', campaign.id), {
                    subscribedClassIds: arrayRemove(classId)
                });
            } else {
                // Also auto-subscribes any public status scoped to this
                // class - see campaignSubscriptions.js.
                const newStatusIds = await subscribeClassToCampaign(campaign.id, { id: classId, class_name: formData.class_name });
                subscribedStatusIds = Array.from(new Set([...subscribedStatusIds, ...newStatusIds]));
            }
            setMyCampaigns(prev => prev.map(c => c.id !== campaign.id ? c : {
                ...c,
                subscribedClassIds: subscribed
                    ? (c.subscribedClassIds || []).filter(id => id !== classId)
                    : [...(c.subscribedClassIds || []), classId],
                subscribedStatusIds,
            }));
        } catch (e) {
            alert(e);
        }
    }

    const rerenderPage = async function() {
        setIsPageVisible(false);
        await delay(1);
        setIsPageVisible(true);
    }

    const hasWriteAccess = !isEditingExisting || Boolean(formData.canWrite?.includes(auth.currentUser.uid));
    const isAdmin = Boolean(userId) && ADMIN_UIDS.includes(userId);
    const VISIBILITIES = getVisibilityOptions(isAdmin);

    const handleChange = event => {
        const { name, type, checked, value } = event.target;
        const newValue = type === 'checkbox' ? checked : value;
        const newValue2 = type === 'number' ? Number(newValue) : value;

        setFormData({
            name: name,
            value: newValue2
        });
    }

    const handleChangeDice = event => {
        const { name, value } = event.target;

        setFormData({
            name: name,
            value: reverseCharacterDiceConverter(value)
        });
    }

    const handleSetDieType = (fieldName, dieLabel) => {
        setFormData({ name: fieldName, value: reverseCharacterDiceConverter(dieLabel) });
    }

    const handleAddAction = function(category) {
        const newAction = newActionDefaults(category);
        if (formData.actions !== undefined) {
            setFormData({
                name: "actions",
                value: formData.actions.concat(newAction)
            });
        } else {
            setFormData({
                name: "actions",
                value: [newAction]
            });
        }
    }

    const rerenderActionList = async function() {
        setIsActionListVisible(false)
        await delay(1);
        setIsActionListVisible(true);
    }

    const handleRemoveAction = function(index) {
        if (formData.actions.length > 1) {
            const newActions = [];
            for (let i = 0; i < formData.actions.length; i++) {
                if (i !== index) newActions.push(formData.actions[i]);
            }
            setFormData({
                name: "actions",
                value: newActions
            })
        } else {
            setFormData({
                name: "actions",
                value: []
            })
        }
        rerenderActionList();
    }

    const handleAddTag = function(index) {
        const newTag = newCustomTag();
        if (formData.actions[index].tags !== undefined) {
            setFormData({
                name: `actions[${index}].tags`,
                value: formData.actions[index].tags.concat(newTag)
            });
        } else {
            setFormData({
                name: `actions[${index}].tags`,
                value: [newTag]
            });
        }
    }

    const handleRemoveTag = function(index, tagIndex) {
        if (formData.actions[index].tags.length > 1) {
            const newTags = [];
            for (let i = 0; i < formData.actions[index].tags.length; i++) {
                if (i !== tagIndex) newTags.push(formData.actions[index].tags[i]);
            }
            setFormData({
                name: `actions[${index}].tags`,
                value: newTags
            })
        } else {
            setFormData({
                name: `actions[${index}].tags`,
                value: []
            })
        }
    }

    // False (after revealing every problem and scrolling to the first) when the
    // form can't be saved yet - see utils/classValidation.js for the rules.
    function checkValid() {
        if (validateClass(liveFormData).valid) return true;
        setShowErrors(true);
        setJumpToken(token => token + 1);
        return false;
    }

    // publishNotes (a string, possibly empty) publishes this as a new version
    // instead of updating the current one in place - see publishClassVersion.
    async function handleSubmit({ publishNotes } = {}) {
        if (!checkValid()) return false;

        // A toggled-on-then-abandoned outcome table shouldn't write
        // {criticalSuccess:"",success:"",failure:"",...} into Firestore -
        // strip the whole field when every sub-value is empty so
        // CombatActionList's "does this action have an outcome table" check
        // stays a simple truthiness/Object.values(...).some(Boolean) test.
        const cleanedActions = (formData.actions || []).map(action => {
            if (action.outcomeTable && !Object.values(action.outcomeTable).some(Boolean)) {
                const { outcomeTable, ...rest } = action;
                return rest;
            }
            return action;
        });

        // isDefault only ever true for the admin account - a non-admin
        // picking "Public" lands in the pool instead (public + browsable,
        // but a campaign has to subscribe before it's offered when creating
        // a character - see "Subscribe your campaigns" below). Mirrors
        // StatusPage.js's identical handleSubmit branch.
        const visibilityFields = formData.visibility === 'public'
            ? { public: true, isDefault: isAdmin, canRead: [] }
            : { public: false, isDefault: false, canRead: [auth.currentUser.uid] };

        // The version fields are managed only by create/publish - an in-place
        // save writing back the (possibly stale) values it loaded could
        // otherwise roll a newer version number back.
        const { version, versionNotes, publishedAt, ...editableFields } = formData;

        if (isEditingExisting) {
            try {
                const payload = {
                    ...editableFields,
                    actions: cleanedActions,
                    ...visibilityFields,
                    // Merge rather than clobber - a bare overwrite here used
                    // to silently drop any co-authors previously granted
                    // write access every time anyone saved an edit.
                    canWrite: Array.from(new Set([...(formData.canWrite || []), auth.currentUser.uid])),
                };
                if (publishNotes === undefined) {
                    await updateDoc(doc(db, "classes", classId), payload);
                } else {
                    await publishClassVersion(classId, payload, publishNotes, versionOf(formData));
                }
                return true;
            } catch(error) {
                alert(`Failed to update class: ${error.message}`)
                return false;
            }
        } else {
            try {
                const docRef = await addDoc(collection(db, "classes"), {
                    ...editableFields,
                    version: 1,
                    actions: cleanedActions,
                    ...visibilityFields,
                    canWrite: [auth.currentUser.uid],
                    admins: [auth.currentUser.uid]
                });
                navigate(docRef.id);
                return true;
            } catch (error) {
                alert(`Failed to create class: ${error.message}`);
                return false;
            }
        }
    }

    function handleEditClick() {
        setShowErrors(false);
        setSavedSnapshot(structuredClone(formData));
        setIsEditingMode(true);
    }

    async function handleSaveClick() {
        const ok = await handleSubmit();
        if (ok) setIsEditingMode(false);
    }

    async function handlePublish(notes) {
        setPublishing(true);
        const ok = await handleSubmit({ publishNotes: notes });
        setPublishing(false);
        if (ok) {
            setPublishDialogOpen(false);
            setIsEditingMode(false);
            await getClassData();
        }
    }

    function handleCancelClick() {
        setShowErrors(false);
        if (isEditingExisting) {
            setFormData({ type: 'REPLACE_FORM_DATA', payload: savedSnapshot });
            setIsEditingMode(false);
        } else {
            navigate('/class-list');
        }
    }

    const categorizedActions = { feat: [], passive: [], reaction: [], action: [] };
    (formData.actions || []).forEach((action, index) => {
        categorizedActions[getActionCategory(action)].push(
            <ClassActionEditor
                key={action.id || index}
                index={index}
                action={action}
                onChange={setFormData}
                onRemove={handleRemoveAction}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
                isEditable={isEditingMode}
                errors={errors.actions[index]}
                previewStats={{ baseHitModifier: Number(formData.base_hit_modifier) || 0 }}
                tagCatalog={tagCatalog}
                forClass={formData.class_name}
            />
        );
    });

    const visibility = formData.visibility || 'public';
    // The doc's own isDefault field, not the current viewer's admin status
    // - matches ClassListPage.js's visibilityOf(), so the badge here always
    // agrees with the catalog card regardless of who's looking at it.
    let visLabel = 'Pool';
    if (visibility === 'private') visLabel = 'Private';
    else if (formData.isDefault) visLabel = 'Default';

    return <>{isPageVisible && <div className='ClassPage'>
        <div className='ClassPage-inner'>
            <button type="button" className="ClassPage-breadcrumb" onClick={() => navigate('/class-list')}>&larr; Classes</button>

            <div className="ClassPage-header">
                <div className="ClassPage-header-main">
                    {isEditingMode
                        ? <>
                            <input className={invalidClass('ClassPage-title-input', errors.fields.class_name)} {...invalidProps('field-class_name', errors.fields.class_name)} name="class_name" onChange={handleChange} defaultValue={formData.class_name} placeholder="Class Name"/>
                            <FieldError message={errors.fields.class_name}/>
                        </>
                        : <div className="ClassPage-title-view">{formData.class_name}</div>}
                    <div className="ClassPage-header-meta">
                        {formData.class_type && <span className={`ClassPage-type-badge ${TYPE_ACCENT_CLASS[formData.class_type] || ''}`}>{formData.class_type}</span>}
                        {!isEditingMode && <span className="ClassPage-author-line">by {formData.author}</span>}
                        {!isEditingMode && isEditingExisting && <span className={visibility === 'private' ? 'ClassPage-vis-badge ClassPage-vis-badge-private' : 'ClassPage-vis-badge'}>{visLabel}</span>}
                        {isEditingExisting && <span className="ClassPage-version-badge">v{versionOf(formData)}</span>}
                    </div>
                    {viewingSnapshot && <div className="ClassPage-version-banner">
                        Viewing version {viewingSnapshot.version} (read-only).{' '}
                        <button type="button" className="ClassPage-version-banner-link" onClick={() => setViewingSnapshot(null)}>Back to the latest (v{versionOf(liveFormData)})</button>
                    </div>}
                    {isEditingMode && <div className="ClassPage-field-row">
                        <div className="ClassPage-field-grow">
                            <span className="ClassPage-field-label">Author</span>
                            <input className={invalidClass('ClassPage-field-input', errors.fields.author)} {...invalidProps('field-author', errors.fields.author)} name="author" onChange={handleChange} defaultValue={formData.author}/>
                            <FieldError message={errors.fields.author}/>
                        </div>
                    </div>}
                </div>
                <div className="ClassPage-header-side">
                    {isEditingExisting && hasWriteAccess && !viewingSnapshot && <button type="button" className="ClassPage-edit-button" onClick={isEditingMode ? handleSaveClick : handleEditClick}>
                        {isEditingMode ? 'Done Editing' : 'Edit'}
                    </button>}
                    {isEditingMode && <>
                        <span className="ClassPage-field-label">Class Type</span>
                        <div className={errors.fields.class_type ? 'ClassPage-pill-group ClassPage-pill-group-invalid' : 'ClassPage-pill-group'} {...invalidProps('field-class_type', errors.fields.class_type)} tabIndex={errors.fields.class_type ? -1 : undefined}>
                            {TYPE_OPTIONS.map(t => <button
                                type="button"
                                key={t}
                                className={t === formData.class_type ? `ClassPage-pill ClassPage-pill-selected ${TYPE_ACCENT_CLASS[t]}` : 'ClassPage-pill'}
                                onClick={() => setFormData({ name: 'class_type', value: t })}
                            >{t}</button>)}
                        </div>
                        <FieldError message={errors.fields.class_type}/>
                    </>}
                </div>
            </div>

            {isEditingMode && <ValidationSummary problems={errors.problems}/>}

            {isEditingMode && <div className="ClassPage-card">
                <div className="ClassPage-section-title">Visibility</div>
                <div className="ClassPage-pill-group ClassPage-vis-pill-group">
                    {VISIBILITIES.map(v => <button
                        type="button"
                        key={v.key}
                        className={v.key === visibility ? 'ClassPage-vis-pill ClassPage-vis-pill-selected' : 'ClassPage-vis-pill'}
                        onClick={() => setFormData({ name: 'visibility', value: v.key })}
                    >
                        <span>{v.label}</span>
                        <span className="ClassPage-vis-pill-sub">{v.hint}</span>
                    </button>)}
                </div>
            </div>}

            <div className="ClassPage-card">
                <div className="ClassPage-section-title">Combat Stats</div>
                <div className="ClassPage-stat-grid">
                    {[
                        { key: 'base_armor_class', label: 'Armor Class' },
                        { key: 'base_hit_modifier', label: 'Hit Modifier' },
                        { key: 'base_class_damage_class', label: 'Class DC' },
                        { key: 'base_hardness', label: 'Hardness' },
                    ].map(s => <div key={s.key}>
                        <span className="ClassPage-field-label">{s.label}</span>
                        {isEditingMode
                            ? <>
                                <input className={invalidClass('ClassPage-field-input', errors.fields[s.key])} {...invalidProps(`field-${s.key}`, errors.fields[s.key])} name={s.key} type="number" onChange={handleChange} placeholder={ClassLayout[s.key]} defaultValue={formData[s.key]}/>
                                <FieldError message={errors.fields[s.key]}/>
                            </>
                            : <div className="ClassPage-field-value">{formData[s.key]}</div>}
                    </div>)}
                </div>
                <div className="ClassPage-stat-grid-secondary">
                    <div>
                        <span className="ClassPage-field-label">Base Health Dice</span>
                        {isEditingMode
                            ? <>
                                <input className={invalidClass('ClassPage-field-input ClassPage-field-input-narrow', errors.fields.base_health_dice)} {...invalidProps('field-base_health_dice', errors.fields.base_health_dice)} name="base_health_dice" onChange={handleChangeDice} placeholder={CharacterDiceConverter(ClassLayout.base_health_dice)} defaultValue={CharacterDiceConverter(formData.base_health_dice) === 'N/A' ? null : CharacterDiceConverter(formData.base_health_dice)}/>
                                <FieldError message={errors.fields.base_health_dice}/>
                            </>
                            : <div className="ClassPage-field-value">{CharacterDiceConverter(formData.base_health_dice)}</div>}
                    </div>
                </div>
            </div>

            <ClassDamageCard kind="melee" label="Melee Damage" formData={formData} onChange={handleChange} onSetDieType={handleSetDieType} isEditable={isEditingMode} errors={errors.fields}/>
            <ClassDamageCard kind="ranged" label="Ranged Damage" formData={formData} onChange={handleChange} onSetDieType={handleSetDieType} isEditable={isEditingMode} errors={errors.fields}/>

            <div className="ClassPage-card">
                <div className="ClassPage-section-title">Healing</div>
                <span className="ClassPage-field-label">Base Healing Dice Type</span>
                {isEditingMode
                    ? <>
                        <input className={invalidClass('ClassPage-field-input ClassPage-field-input-narrow', errors.fields.base_healing_dice_type)} {...invalidProps('field-base_healing_dice_type', errors.fields.base_healing_dice_type)} name="base_healing_dice_type" onChange={handleChangeDice} placeholder={CharacterDiceConverter(ClassLayout.base_healing_dice_type)} defaultValue={CharacterDiceConverter(formData.base_healing_dice_type) === 'N/A' ? null : CharacterDiceConverter(formData.base_healing_dice_type)}/>
                        <FieldError message={errors.fields.base_healing_dice_type}/>
                    </>
                    : <div className="ClassPage-field-value">{CharacterDiceConverter(formData.base_healing_dice_type)}</div>}
            </div>

            <div className="ClassPage-card">
                <div className="ClassPage-section-title">Lore &amp; Flavor Text</div>
                {isEditingMode
                    ? <>
                        <MarkdownEditor label="Lore & Flavor Text" placeholder={ClassLayout.description} value={formData.description || ''} onChange={value => setFormData({ name: 'description', value })}/>
                      </>
                    : <div className="ClassPage-lore-view"><Markdown options={{ disableParsingRawHTML: true }}>{formData.description || ''}</Markdown></div>}
                <div className="ClassPage-field-row" style={{ marginTop: 'var(--jnj-space-3)' }}>
                    <div className="ClassPage-field-grow">
                        <span className="ClassPage-field-label">Class Weapon(s)</span>
                        {isEditingMode
                            ? <input className="ClassPage-field-input" name="class_weapons" onChange={handleChange} placeholder={ClassLayout.class_weapons} defaultValue={formData.class_weapons}/>
                            : <div className="ClassPage-field-value">{formData.class_weapons}</div>}
                    </div>
                </div>
            </div>

            <div className="ClassPage-card">
                <div className="ClassPage-actions-header">
                    <div className="ClassPage-section-title">Actions &amp; Feats</div>
                    {isEditingMode && <div className="ClassPage-add-action-buttons">
                        <button type="button" className="ClassPage-add-action-button" onClick={() => handleAddAction('feat')}>+ Feat</button>
                        <button type="button" className="ClassPage-add-action-button" onClick={() => handleAddAction('passive')}>+ Passive</button>
                        <button type="button" className="ClassPage-add-action-button" onClick={() => handleAddAction('reaction')}>+ Reaction</button>
                        <button type="button" className="ClassPage-add-action-button" onClick={() => handleAddAction('action')}>+ Action</button>
                    </div>}
                </div>
                {isActionListVisible && CATEGORY_SECTIONS.map(section =>
                    categorizedActions[section.key].length > 0 && <div className='ClassPage-category-group' key={section.key}>
                        <div className='ClassPage-category-group-title'>{section.label}</div>
                        {categorizedActions[section.key]}
                    </div>
                )}
                {(formData.actions || []).length === 0 && <div className="ClassPage-hint">No actions yet.</div>}
            </div>

            <ClassLevelRewards
                rewards={formData.level_rewards || []}
                actions={formData.actions || []}
                isEditable={isEditingMode}
                errors={errors.rewards}
                onChange={value => setFormData({ name: 'level_rewards', value })}
            />

            {isEditingExisting && formData.public && !formData.isDefault && <div className='ClassPage-card'>
                <div className="ClassPage-section-title">Subscribe your campaigns</div>
                <div className='ClassPage-hint'>A pool class like this one only shows up when creating a character in a campaign once that campaign subscribes to it - not automatically, the way an admin default would.</div>
                {myWritableCampaigns.length === 0 && <div className='ClassPage-hint'>You don't direct (or have write access to) any campaigns yet.</div>}
                <div className="ClassPage-pill-group">
                    {myWritableCampaigns.map(c => {
                        const subscribed = c.subscribedClassIds?.includes(classId);
                        return <button
                            key={c.id}
                            type="button"
                            className={subscribed ? 'ClassPage-pill ClassPage-pill-selected' : 'ClassPage-pill'}
                            onClick={() => toggleSubscription(c)}
                        >
                            {c.campaign_name}{subscribed ? ' ✓' : ''}
                        </button>;
                    })}
                </div>
            </div>}

            {isEditingExisting && versionList.length > 0 && <div className="ClassPage-card">
                <div className="ClassPage-section-title">Version history</div>
                <div className="ClassPage-hint">Characters are pinned to a version and only change version when someone switches them. Updating a class edits its latest version in place; publishing starts a new one.</div>
                <ul className="ClassPage-version-list">
                    {versionList.map(entry => <li key={entry.version} className="ClassPage-version-row">
                        <div className="ClassPage-version-row-main">
                            <span className="ClassPage-version-row-title">
                                v{entry.version}
                                {entry.version === versionOf(liveFormData) && <em> latest</em>}
                                {entry.version === versionOf(formData) && viewingSnapshot && <em> viewing</em>}
                            </span>
                            {entry.notes && <div className="ClassPage-version-row-notes"><Markdown options={{ disableParsingRawHTML: true }}>{entry.notes}</Markdown></div>}
                        </div>
                        {!isEditingMode && entry.version !== versionOf(formData) && <button type="button" className="ClassPage-version-view-button" onClick={() => viewVersion(entry.version)}>View</button>}
                    </li>)}
                </ul>
            </div>}

            {isEditingExisting && <DocAdminManager docRef={doc(db, "classes", classId)} admins={formData.admins} userId={userId} onChanged={getClassData}/>}

            {isEditingMode && <div className="ClassPage-save-bar">
                {errors.problems.length > 0
                    ? <button type="button" className="ClassPage-save-bar-label ClassPage-save-bar-label-error" onClick={() => scrollToProblem()}>
                        {errors.problems.length === 1 ? '1 thing to fix' : `${errors.problems.length} things to fix`}
                    </button>
                    : <span className="ClassPage-save-bar-label">Unsaved changes</span>}
                <button type="button" className="ClassPage-cancel-button" onClick={handleCancelClick}>Cancel</button>
                {isEditingExisting && <button type="button" className="ClassPage-publish-button" onClick={() => { if (checkValid()) setPublishDialogOpen(true); }}>
                    Publish as v{versionOf(liveFormData) + 1}
                </button>}
                <button type="button" className="ClassPage-save-button" onClick={handleSaveClick}>
                    {isEditingExisting ? "Update Class" : "Create Class"}
                </button>
            </div>}

            {publishDialogOpen && <ClassPublishDialog
                nextVersion={versionOf(liveFormData) + 1}
                busy={publishing}
                onPublish={handlePublish}
                onClose={() => setPublishDialogOpen(false)}
            />}
        </div>
    </div>}</>
}
