import { useEffect, useMemo, useReducer, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { addDoc, arrayRemove, collection, getDoc, getDocs, doc, or, query, updateDoc, where } from '@firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import Markdown from 'markdown-to-jsx';
import { auth, db } from '../utils/firebase';
import { ADMIN_UIDS } from '../utils/statusEffects';
import { getActionCategory } from '../utils/classActions';
import { raceActionsOf } from '../utils/characterClass';
import { subscribeRaceToCampaign } from '../utils/campaignSubscriptions';
import { classFormReducer } from '../utils/classFormReducer';
import { NO_ERRORS, newActionDefaults, validateRace } from '../utils/classValidation';
import { FieldError, ValidationSummary, invalidClass, invalidProps, scrollToProblem } from './FormErrors';
import { ClassActionEditor } from './ClassActionEditor';
import { DocAdminManager } from './DocAdminManager';
import { ClassPublishDialog } from './ClassPublishDialog';
import { listRaceVersions, publishRaceVersion, resolveRaceVersion, versionOf } from '../utils/raceVersions';
import '../styles/ClassPage.scss';

// A race is a name, some Markdown lore, and a list of racial actions/feats
// (authored with the same action editor classes use). Everything else - the
// view/edit toggle, visibility tiers, versioning, campaign subscription - is
// ClassPage.js's design reused as-is, including its CSS classes.
const CATEGORY_SECTIONS = [
    { key: 'feat', label: 'Feats' },
    { key: 'passive', label: 'Passives' },
    { key: 'reaction', label: 'Reactions' },
    { key: 'action', label: 'Actions' },
];

function getVisibilityOptions(isAdmin) {
    return [
        {
            key: 'public',
            label: isAdmin ? 'Public (Default)' : 'Pool (Public)',
            hint: isAdmin
                ? 'Every campaign gets this automatically - no subscription needed. Only the admin account can create these.'
                : "Any signed-in user can browse this in the Races catalog, but a Director has to subscribe their campaign to it (see below, once saved) before it's offered when creating a character in that campaign.",
        },
        { key: 'private', label: 'Private', hint: 'Only visible to you (and anyone else you add to canWrite).' },
    ];
}

function visibilityFromDoc(data) {
    return data.public ? 'public' : 'private';
}

const delay = ms => new Promise(res => setTimeout(res, ms));

export function RacePage() {
    const [liveFormData, setFormData] = useReducer(classFormReducer, { visibility: 'public' });
    // Looking at an older version is read-only and display-only: its snapshot
    // stands in for the form data (keeping the race's own permission and
    // visibility fields, which snapshots don't carry) without touching the
    // real form state, so nothing from an old version can be saved by accident.
    const [viewingSnapshot, setViewingSnapshot] = useState(null);
    const formData = viewingSnapshot
        ? {
            ...viewingSnapshot.data,
            actions: raceActionsOf(viewingSnapshot.data),
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
    const raceId = location.pathname.split('/').at(2);
    const isEditingExisting = location.pathname.split('/').length > 2;
    // Starts in View mode even for the race's own author - editing is opt-in
    // via the header's Edit button. A brand-new race has nothing to view, so
    // it's always in edit mode instead.
    const [isEditingMode, setIsEditingMode] = useState(!isEditingExisting);
    const [savedSnapshot, setSavedSnapshot] = useState(null);
    // Errors stay hidden until the first failed save, then track the form live.
    const [showErrors, setShowErrors] = useState(false);
    const [jumpToken, setJumpToken] = useState(0);
    const validation = useMemo(() => validateRace(liveFormData), [liveFormData]);
    const errors = showErrors ? validation : NO_ERRORS;

    useEffect(() => {
        if (jumpToken === 0) return;
        scrollToProblem();
    }, [jumpToken]);

    useEffect(() => {
        document.title = "New Race";
        if (isEditingExisting) {
            getRaceData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location])

    useEffect(() => {
        // auth.currentUser can still be null right after a hard page load,
        // before Firebase has rehydrated the session.
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) return;
            setUserId(user.uid);
            getDocs(query(collection(db, 'campaigns'), or(where('canRead', 'array-contains', user.uid), where('canWrite', 'array-contains', user.uid))))
                .then(querySnapshot => {
                    setMyCampaigns(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                }).catch(error => console.log(error));
            unsubscribe();
        });
    }, []);

    async function getRaceData() {
        const docRef = await getDoc(doc(db, "races", raceId));
        const data = docRef.data();
        // Races seeded before actions existed carry a single `feat` instead.
        setFormData({ type: 'SET_FORM_DATA', payload: { ...data, actions: raceActionsOf(data), visibility: visibilityFromDoc(data) } });
        document.title = data.name;
        setViewingSnapshot(null);
        rerenderPage();
        // Best effort - someone who can read the race but not (say) its
        // versions subcollection just doesn't get a history list.
        listRaceVersions(raceId).then(setVersionList).catch(() => setVersionList([]));
    }

    async function viewVersion(version) {
        if (version === versionOf(liveFormData)) {
            setViewingSnapshot(null);
            return;
        }
        try {
            const { data } = await resolveRaceVersion(raceId, version);
            setViewingSnapshot({ version, data });
        } catch (e) {
            alert(`Couldn't load version ${version}: ${e.message}`);
        }
    }

    // Subscribing writes to the campaign doc, not the race - needs actual
    // write access there (director or canWrite), not just membership.
    const myWritableCampaigns = myCampaigns.filter(c => c.canWrite?.includes(userId) || c.director_uid === userId);

    async function toggleSubscription(campaign) {
        const subscribed = campaign.subscribedRaceIds?.includes(raceId);
        try {
            if (subscribed) {
                await updateDoc(doc(db, 'campaigns', campaign.id), {
                    subscribedRaceIds: arrayRemove(raceId)
                });
            } else {
                await subscribeRaceToCampaign(campaign.id, { id: raceId });
            }
            setMyCampaigns(prev => prev.map(c => c.id !== campaign.id ? c : {
                ...c,
                subscribedRaceIds: subscribed
                    ? (c.subscribedRaceIds || []).filter(id => id !== raceId)
                    : [...(c.subscribedRaceIds || []), raceId],
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
        const { name, value } = event.target;
        setFormData({ name, value });
    }

    const handleAddAction = function(category) {
        const newAction = newActionDefaults(category);
        setFormData({
            name: "actions",
            value: (formData.actions || []).concat(newAction)
        });
    }

    const rerenderActionList = async function() {
        setIsActionListVisible(false)
        await delay(1);
        setIsActionListVisible(true);
    }

    const handleRemoveAction = function(index) {
        setFormData({
            name: "actions",
            value: formData.actions.filter((_, i) => i !== index)
        });
        rerenderActionList();
    }

    const handleAddTag = function(index) {
        const newTag = { id: crypto.randomUUID() };
        setFormData({
            name: `actions[${index}].tags`,
            value: (formData.actions[index].tags || []).concat(newTag)
        });
    }

    const handleRemoveTag = function(index, tagIndex) {
        setFormData({
            name: `actions[${index}].tags`,
            value: formData.actions[index].tags.filter((_, i) => i !== tagIndex)
        });
    }

    // False (after revealing every problem and scrolling to the first) when the
    // form can't be saved yet - see utils/classValidation.js for the rules.
    function checkValid() {
        if (validateRace(liveFormData).valid) return true;
        setShowErrors(true);
        setJumpToken(token => token + 1);
        return false;
    }

    // publishNotes (a string, possibly empty) publishes this as a new version
    // instead of updating the current one in place - see publishRaceVersion.
    async function handleSubmit({ publishNotes } = {}) {
        if (!checkValid()) return false;

        // A toggled-on-then-abandoned outcome table shouldn't write empty
        // strings into Firestore - see the same clean-up in ClassPage.js.
        const cleanedActions = (formData.actions || []).map(action => {
            if (action.outcomeTable && !Object.values(action.outcomeTable).some(Boolean)) {
                const { outcomeTable, ...rest } = action;
                return rest;
            }
            return action;
        });

        // isDefault only ever true for the admin account - a non-admin
        // picking "Public" lands in the pool instead. Mirrors ClassPage.js.
        const visibilityFields = formData.visibility === 'public'
            ? { public: true, isDefault: isAdmin, canRead: [] }
            : { public: false, isDefault: false, canRead: [auth.currentUser.uid] };

        // The version fields are managed only by create/publish - an in-place
        // save writing back stale values could roll a newer version back.
        const { version, versionNotes, publishedAt, ...editableFields } = formData;

        if (isEditingExisting) {
            try {
                const payload = {
                    ...editableFields,
                    actions: cleanedActions,
                    ...visibilityFields,
                    canWrite: Array.from(new Set([...(formData.canWrite || []), auth.currentUser.uid])),
                };
                if (publishNotes === undefined) {
                    await updateDoc(doc(db, "races", raceId), payload);
                } else {
                    await publishRaceVersion(raceId, payload, publishNotes, versionOf(formData));
                }
                return true;
            } catch(error) {
                alert(`Failed to update race: ${error.message}`)
                return false;
            }
        } else {
            try {
                const docRef = await addDoc(collection(db, "races"), {
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
                alert(`Failed to create race: ${error.message}`);
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
            await getRaceData();
        }
    }

    function handleCancelClick() {
        setShowErrors(false);
        if (isEditingExisting) {
            setFormData({ type: 'SET_FORM_DATA', payload: savedSnapshot });
            setIsEditingMode(false);
        } else {
            navigate('/race-list');
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
            />
        );
    });

    const visibility = formData.visibility || 'public';
    // The doc's own isDefault field, not the current viewer's admin status -
    // matches RaceListPage's visibilityOf(), so the badge always agrees with
    // the catalog card.
    let visLabel = 'Pool';
    if (visibility === 'private') visLabel = 'Private';
    else if (formData.isDefault) visLabel = 'Default';

    return <>{isPageVisible && <div className='ClassPage'>
        <div className='ClassPage-inner'>
            <button type="button" className="ClassPage-breadcrumb" onClick={() => navigate('/race-list')}>&larr; Races</button>

            <div className="ClassPage-header">
                <div className="ClassPage-header-main">
                    {isEditingMode
                        ? <>
                            <input className={invalidClass('ClassPage-title-input', errors.fields.name)} {...invalidProps('field-name', errors.fields.name)} name="name" onChange={handleChange} defaultValue={formData.name} placeholder="Race Name"/>
                            <FieldError message={errors.fields.name}/>
                        </>
                        : <div className="ClassPage-title-view">{formData.name}</div>}
                    <div className="ClassPage-header-meta">
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
                <div className="ClassPage-section-title">Lore &amp; Flavor Text</div>
                {isEditingMode
                    ? <>
                        <textarea className="ClassPage-field-input ClassPage-field-textarea" name="description" onChange={handleChange} placeholder="Where this people comes from, what they look like, how they see the world." defaultValue={formData.description}/>
                        <div className="ClassPage-hint">Supports Markdown - **bold**, *italic*, and bullet lists (- item) all render in the catalog card.</div>
                      </>
                    : <div className="ClassPage-lore-view"><Markdown options={{ disableParsingRawHTML: true }}>{formData.description || ''}</Markdown></div>}
            </div>

            <div className="ClassPage-card">
                <div className="ClassPage-actions-header">
                    <div className="ClassPage-section-title">Racial Feats &amp; Actions</div>
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
                {(formData.actions || []).length === 0 && <div className="ClassPage-hint">No racial feats or actions yet.</div>}
            </div>

            {isEditingExisting && formData.public && !formData.isDefault && <div className='ClassPage-card'>
                <div className="ClassPage-section-title">Subscribe your campaigns</div>
                <div className='ClassPage-hint'>A pool race like this one only shows up when creating a character in a campaign once that campaign subscribes to it - not automatically, the way an admin default would.</div>
                {myWritableCampaigns.length === 0 && <div className='ClassPage-hint'>You don't direct (or have write access to) any campaigns yet.</div>}
                <div className="ClassPage-pill-group">
                    {myWritableCampaigns.map(c => {
                        const subscribed = c.subscribedRaceIds?.includes(raceId);
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
                <div className="ClassPage-hint">Characters are pinned to a version and only change version when someone switches them. Updating a race edits its latest version in place; publishing starts a new one.</div>
                <ul className="ClassPage-version-list">
                    {versionList.map(entry => <li key={entry.version} className="ClassPage-version-row">
                        <div className="ClassPage-version-row-main">
                            <span className="ClassPage-version-row-title">
                                v{entry.version}
                                {entry.version === versionOf(liveFormData) && <em> latest</em>}
                                {entry.version === versionOf(formData) && viewingSnapshot && <em> viewing</em>}
                            </span>
                            {entry.notes && <span className="ClassPage-version-row-notes">{entry.notes}</span>}
                        </div>
                        {!isEditingMode && entry.version !== versionOf(formData) && <button type="button" className="ClassPage-version-view-button" onClick={() => viewVersion(entry.version)}>View</button>}
                    </li>)}
                </ul>
            </div>}

            {isEditingExisting && <DocAdminManager docRef={doc(db, "races", raceId)} admins={formData.admins} userId={userId} onChanged={getRaceData}/>}

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
                    {isEditingExisting ? "Update Race" : "Create Race"}
                </button>
            </div>}

            {publishDialogOpen && <ClassPublishDialog
                kind="race"
                nextVersion={versionOf(liveFormData) + 1}
                busy={publishing}
                onPublish={handlePublish}
                onClose={() => setPublishDialogOpen(false)}
            />}
        </div>
    </div>}</>
}
