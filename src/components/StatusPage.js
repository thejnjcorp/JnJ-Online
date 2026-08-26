import { useEffect, useReducer, useState } from 'react';
import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, or, query, updateDoc, where } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import TextareaAutosize from 'react-textarea-autosize';
import { auth, db } from '../utils/firebase';
import { ADMIN_UIDS, STATUS_STAT_DEFINITIONS, getEffectsArray } from '../utils/statusEffects';
import '../styles/StatusPage.scss';

const formReducer = (state, event) => {
    if (event.type === 'SET_FORM_DATA') {
        return { ...state, ...event.payload };
    }
    return { ...state, [event.name]: event.value };
};

const POLARITIES = ['buff', 'debuff', 'neutral'];

// Both roles write `public: true` for this option - what differs is
// `isDefault` (see handleSubmit), which only the admin account can ever set.
// Kept as one 'public' key (not two visibility options) so a non-admin
// editing their own pool status and an admin editing a default both land on
// the same picker slot instead of the UI branching around it everywhere.
function getVisibilityOptions(isAdmin) {
    return [
        {
            key: 'public',
            label: isAdmin ? 'Public (Default)' : 'Pool (Public)',
            hint: isAdmin
                ? 'Every campaign gets this automatically - no subscription needed. Only the admin account can create these.'
                : "Any signed-in user can browse this in the catalog, but a Director has to subscribe their campaign to it (see below, once saved) before it's offered as a preset for that campaign's characters.",
        },
        { key: 'campaign', label: 'Campaign-locked', hint: "Only visible to members of the campaign you pick below - locked to just that one campaign, no subscription step." },
        { key: 'private', label: 'Creator-locked', hint: 'Only visible to you (and anyone else you add to canWrite).' },
    ];
}

const EMPTY_GRANTED_ACTION = { actionName: '', actionCost: 1, range: '', toHitBool: false, toHit: 1, difficultyClass: '', description: '' };

const EMPTY_STATUS = {
    name: '',
    description: '',
    polarity: 'neutral',
    defaultStacks: 1,
    classes: [],
    effects: [],
    decaysPerTurn: false,
    grantedAction: null,
    visibility: 'public',
    campaignId: null,
    isDefault: false,
};

// Derives the UI-only "visibility" radio from the persisted public/campaignId
// fields, so editing an existing status starts on the right option.
function visibilityFromDoc(data) {
    if (data.public) return 'public';
    if (data.campaignId) return 'campaign';
    return 'private';
}

export function StatusPage() {
    const [formData, setFormData] = useReducer(formReducer, EMPTY_STATUS);
    const [classOptions, setClassOptions] = useState([]);
    const [myCampaigns, setMyCampaigns] = useState([]);
    const [userId, setUserId] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const statusId = location.pathname.split('/').at(2);
    const isEditing = Boolean(statusId);

    useEffect(() => {
        document.title = isEditing ? 'Edit Status' : 'New Status';
        if (!isEditing) return;
        getDoc(doc(db, 'statuses', statusId)).then(snap => {
            if (!snap.exists()) return;
            const data = snap.data();
            const effects = getEffectsArray(data);
            const decaysPerTurn = typeof data.decaysPerTurn === 'boolean' ? data.decaysPerTurn : effects.some(e => e.trigger === 'turn_start');
            setFormData({ type: 'SET_FORM_DATA', payload: { ...EMPTY_STATUS, ...data, effects, decaysPerTurn, visibility: visibilityFromDoc(data) } });
            document.title = data.name;
        }).catch(error => console.log(error));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusId]);

    useEffect(() => {
        // auth.currentUser can still be null right after a hard page load,
        // before Firebase has rehydrated the session - waiting on this
        // (same as CharacterPage.js/DirectorsPage.js do) avoids a crash on
        // /statuses/:id reached by a fresh navigation or a page refresh.
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) return;
            setUserId(user.uid);
            // Same visibility scoping ClassListPage.js uses - an unfiltered
            // collection() scan doesn't satisfy the classes read rule's
            // per-doc conditions (public/canRead/canWrite), so it gets
            // rejected outright as unprovable rather than just filtering
            // results - found by hand after the classes rules shipped
            // (this call silently failed, leaving "No classes exist yet."
            // showing even with real classes in the catalog).
            getDocs(query(collection(db, 'classes'),
                or(where('public', '==', true), where('canRead', 'array-contains', user.uid), where('canWrite', 'array-contains', user.uid))))
                .then(querySnapshot => {
                    setClassOptions(querySnapshot.docs.map(d => d.data().class_name).filter(Boolean));
                }).catch(error => console.log(error));
            // Same "campaigns I belong to" query Campaigns.js already uses -
            // needed here to populate the campaign-lock picker.
            getDocs(query(collection(db, 'campaigns'), or(where('canRead', 'array-contains', user.uid), where('canWrite', 'array-contains', user.uid))))
                .then(querySnapshot => {
                    setMyCampaigns(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                }).catch(error => console.log(error));
            unsubscribe();
        });
    }, []);

    // A status not yet saved has no canWrite list to check against - anyone
    // signed in is creating it fresh, so it can't be someone else's yet.
    const canWrite = isEditing && Boolean(userId) && !formData.canWrite?.includes(userId);
    const isAdmin = Boolean(userId) && ADMIN_UIDS.includes(userId);
    const VISIBILITIES = getVisibilityOptions(isAdmin);
    // Subscribing writes to the campaign doc, not the status - needs actual
    // write access there (director or canWrite), not just membership (the
    // broader "campaigns I belong to" list myCampaigns already fetches for
    // the campaign-lock picker above).
    const myWritableCampaigns = myCampaigns.filter(c => c.canWrite?.includes(userId) || c.director_uid === userId);

    async function toggleSubscription(campaign) {
        const subscribed = campaign.subscribedStatusIds?.includes(statusId);
        try {
            await updateDoc(doc(db, 'campaigns', campaign.id), {
                subscribedStatusIds: subscribed ? arrayRemove(statusId) : arrayUnion(statusId)
            });
            setMyCampaigns(prev => prev.map(c => c.id !== campaign.id ? c : {
                ...c,
                subscribedStatusIds: subscribed
                    ? (c.subscribedStatusIds || []).filter(id => id !== statusId)
                    : [...(c.subscribedStatusIds || []), statusId],
            }));
        } catch (e) {
            alert(e);
        }
    }

    const handleChange = event => {
        const { name, type, checked, value } = event.target;
        const parsedValue = type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value);
        setFormData({ name, value: parsedValue });
    };

    function toggleClass(className) {
        const current = formData.classes || [];
        setFormData({
            name: 'classes',
            value: current.includes(className) ? current.filter(c => c !== className) : [...current, className]
        });
    }

    function addEffect() {
        const firstStat = STATUS_STAT_DEFINITIONS[0];
        const effects = formData.effects || [];
        setFormData({ name: 'effects', value: [...effects, { stat: firstStat.key, delta: 1, trigger: firstStat.triggers[0] }] });
        // A turn_start effect (currently only action_points) almost always
        // wants the status to also count down - Frightened-style "passive
        // effect that still decays" is the exception, still just a checkbox
        // toggle away.
        if (firstStat.triggers[0] === 'turn_start') setFormData({ name: 'decaysPerTurn', value: true });
    }

    function removeEffect(index) {
        setFormData({ name: 'effects', value: formData.effects.filter((_, i) => i !== index) });
    }

    function updateEffectStat(index, statKey) {
        // Each stat only supports one trigger (see STATUS_STAT_DEFINITIONS) -
        // action_points is a turn-based resource, everything else is a
        // continuous/passive modifier - so switching the stat picks the
        // right trigger automatically instead of offering an invalid
        // combination (e.g. a "passive" action_points effect).
        const definition = STATUS_STAT_DEFINITIONS.find(s => s.key === statKey);
        const effects = [...formData.effects];
        effects[index] = { ...effects[index], stat: statKey, trigger: definition.triggers[0] };
        setFormData({ name: 'effects', value: effects });
        if (definition.triggers[0] === 'turn_start') setFormData({ name: 'decaysPerTurn', value: true });
    }

    function updateEffectDelta(index, delta) {
        const effects = [...formData.effects];
        effects[index] = { ...effects[index], delta: Number(delta) };
        setFormData({ name: 'effects', value: effects });
    }

    function toggleEffectMode(index, mode) {
        const effects = [...formData.effects];
        const current = effects[index];
        effects[index] = mode === 'scaled'
            ? { ...current, mode: 'scaled', table: current.table?.length ? current.table : [{ level: 1, delta: current.delta || 0 }] }
            : { ...current, mode: 'flat' };
        setFormData({ name: 'effects', value: effects });
    }

    function addTableLevel(index) {
        const effects = [...formData.effects];
        const table = effects[index].table || [];
        const nextLevel = table.length > 0 ? Math.max(...table.map(row => row.level)) + 1 : 1;
        effects[index] = { ...effects[index], table: [...table, { level: nextLevel, delta: 0 }] };
        setFormData({ name: 'effects', value: effects });
    }

    function removeTableLevel(index, rowIndex) {
        const effects = [...formData.effects];
        effects[index] = { ...effects[index], table: effects[index].table.filter((_, i) => i !== rowIndex) };
        setFormData({ name: 'effects', value: effects });
    }

    function updateTableLevel(index, rowIndex, field, value) {
        const effects = [...formData.effects];
        const table = [...effects[index].table];
        table[rowIndex] = { ...table[rowIndex], [field]: Number(value) };
        effects[index] = { ...effects[index], table };
        setFormData({ name: 'effects', value: effects });
    }

    function toggleGrantsAction(event) {
        setFormData({ name: 'grantedAction', value: event.target.checked ? EMPTY_GRANTED_ACTION : null });
    }

    function handleGrantedActionChange(event) {
        const { name, type, checked, value } = event.target;
        const parsedValue = type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value);
        setFormData({ name: 'grantedAction', value: { ...formData.grantedAction, [name]: parsedValue } });
    }

    async function handleSubmit() {
        if (!formData.name?.trim()) return alert('A status needs a name.');
        if (formData.visibility === 'campaign' && !formData.campaignId) return alert('Pick a campaign to lock this status to.');
        if (formData.grantedAction && !formData.grantedAction.actionName?.trim()) return alert('The granted action needs a name (or turn off "Grants a special action").');
        setSubmitting(true);
        try {
            const uid = userId;
            // canRead is a snapshot, not a live campaign lookup - see the
            // comment on the statuses match block in firestore.rules. Every
            // save (create or edit) re-copies the campaign's current
            // membership, so editing a campaign-locked status is also how
            // you refresh it after the campaign's roster changes.
            let visibilityFields;
            if (formData.visibility === 'public') {
                // isDefault only ever true for the admin account - a
                // non-admin picking this option lands in the pool instead
                // (public + browsable, but not auto-usable - see
                // AddStatusDialog.js). firestore.rules enforces this too;
                // this just avoids ever attempting a write it would reject.
                visibilityFields = { public: true, isDefault: isAdmin, canRead: [], campaignId: null };
            } else if (formData.visibility === 'campaign') {
                const campaign = myCampaigns.find(c => c.id === formData.campaignId);
                const members = Array.from(new Set([...(campaign?.canRead || []), ...(campaign?.canWrite || [])]));
                visibilityFields = { public: false, isDefault: false, canRead: members, campaignId: formData.campaignId };
            } else {
                visibilityFields = { public: false, isDefault: false, canRead: [uid], campaignId: null };
            }
            const payload = {
                name: formData.name,
                description: formData.description || '',
                polarity: formData.polarity || 'neutral',
                defaultStacks: Number(formData.defaultStacks) || 0,
                classes: formData.classes || [],
                effects: formData.effects || [],
                decaysPerTurn: Boolean(formData.decaysPerTurn),
                grantedAction: formData.grantedAction?.actionName ? formData.grantedAction : null,
                ...visibilityFields,
                canWrite: [uid],
            };
            if (isEditing) {
                await updateDoc(doc(db, 'statuses', statusId), payload);
                alert('Status updated.');
            } else {
                const docRef = await addDoc(collection(db, 'statuses'), payload);
                navigate('/statuses/' + docRef.id);
                alert('Status created.');
            }
        } catch (error) {
            alert('Failed to save status: ' + error.message);
        }
        setSubmitting(false);
    }

    async function handleDelete() {
        if (!window.confirm('Delete "' + formData.name + '"? This cannot be undone.')) return;
        try {
            await deleteDoc(doc(db, 'statuses', statusId));
            navigate('/status-list');
        } catch (error) {
            alert('Failed to delete status: ' + error.message);
        }
    }

    return <div className="StatusPage">
        <div className="StatusPage-inner">
        <div className="StatusPage-header">
            <h1 className="StatusPage-title">{isEditing ? 'Edit Status' : 'New Status'}</h1>
            <p className="StatusPage-subtitle">Statuses live in the shared catalog and appear as presets in the Add Status dialog on the character page.</p>
        </div>

        <div className="StatusPage-field">
            <label className="StatusPage-label">Name</label>
            <input
                className="StatusPage-input"
                name="name"
                type="text"
                placeholder="Haste"
                value={formData.name || ''}
                onChange={handleChange}
                disabled={canWrite}
            />
        </div>

        <div className="StatusPage-field">
            <label className="StatusPage-label">Description</label>
            <TextareaAutosize
                className="StatusPage-textarea"
                name="description"
                placeholder="Gain a single action for a certain number of rounds..."
                minRows={3}
                value={formData.description || ''}
                onChange={handleChange}
                disabled={canWrite}
            />
        </div>

        <div className="StatusPage-field">
            <label className="StatusPage-label">Polarity</label>
            <div className="StatusPage-chip-row">
                {POLARITIES.map(polarity =>
                    <button
                        key={polarity}
                        type="button"
                        className={formData.polarity === polarity ? `StatusPage-chip StatusPage-chip-${polarity} StatusPage-chip-selected` : `StatusPage-chip StatusPage-chip-${polarity}`}
                        onClick={() => !canWrite && setFormData({ name: 'polarity', value: polarity })}
                        disabled={canWrite}
                    >
                        {polarity[0].toUpperCase() + polarity.slice(1)}
                    </button>
                )}
            </div>
        </div>

        <div className="StatusPage-field">
            <label className="StatusPage-label">Default stacks / duration</label>
            <input
                className="StatusPage-input StatusPage-input-narrow"
                name="defaultStacks"
                type="number"
                min={0}
                value={formData.defaultStacks ?? 1}
                onChange={handleChange}
                disabled={canWrite}
            />
            <p className="StatusPage-hint">The stack count a character starts at when this status is added - 1 for most conditions, or a real duration/severity for ones like Haste (turns remaining) or Exhaustion (level). Adjustable per character afterward regardless of this default.</p>
        </div>

        <div className="StatusPage-field">
            <label className="StatusPage-label">Class scoping</label>
            <div className="StatusPage-chip-row">
                {classOptions.length === 0 && <span className="StatusPage-hint">No classes exist yet.</span>}
                {classOptions.map(className =>
                    <button
                        key={className}
                        type="button"
                        className={(formData.classes || []).includes(className) ? 'StatusPage-chip StatusPage-chip-selected' : 'StatusPage-chip'}
                        onClick={() => !canWrite && toggleClass(className)}
                        disabled={canWrite}
                    >
                        {className}
                    </button>
                )}
            </div>
            <p className="StatusPage-hint">Leave none selected for a status any class can use.</p>
        </div>

        <div className="StatusPage-field">
            <label className="StatusPage-label">Visibility</label>
            <div className="StatusPage-chip-row">
                {VISIBILITIES.map(v =>
                    <button
                        key={v.key}
                        type="button"
                        className={formData.visibility === v.key ? 'StatusPage-chip StatusPage-chip-selected' : 'StatusPage-chip'}
                        onClick={() => !canWrite && setFormData({ name: 'visibility', value: v.key })}
                        disabled={canWrite}
                    >
                        {v.label}
                    </button>
                )}
            </div>
            <p className="StatusPage-hint">{VISIBILITIES.find(v => v.key === formData.visibility)?.hint}</p>
            {formData.visibility === 'campaign' && <>
                <select
                    className="StatusPage-input"
                    value={formData.campaignId || ''}
                    onChange={e => setFormData({ name: 'campaignId', value: e.target.value || null })}
                    disabled={canWrite}
                >
                    <option value="" hidden>Choose a campaign…</option>
                    {myCampaigns.map(c => <option key={c.id} value={c.id}>{c.campaign_name}</option>)}
                </select>
                {myCampaigns.length === 0 && <p className="StatusPage-hint">You aren't in any campaigns yet.</p>}
            </>}
        </div>

        <div className="StatusPage-field">
            <label className="StatusPage-label">Mechanical effects</label>
            <p className="StatusPage-hint">Action Points is a turn-based resource - its effect applies once per "Next Turn" while stacks remain (Haste/Slowed/Stunned). Every other stat is a continuous modifier, applied everywhere that stat is shown or used (AC, hit rolls, ability scores, hardness) for as long as this status is on the character (Exhaustion, a temporary Strength buff, Frightened's hit penalty).</p>
            {(formData.effects || []).map((effect, index) => {
                const definition = STATUS_STAT_DEFINITIONS.find(s => s.key === effect.stat) || STATUS_STAT_DEFINITIONS[0];
                const isScaled = effect.mode === 'scaled';
                return <div className="StatusPage-effect-row" key={index}>
                    <div className="StatusPage-effect-row-main">
                        Adjust
                        <select
                            className="StatusPage-input StatusPage-input-narrow"
                            value={effect.stat}
                            onChange={e => updateEffectStat(index, e.target.value)}
                            disabled={canWrite}
                        >
                            {STATUS_STAT_DEFINITIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                        <span className="StatusPage-effect-trigger-label">{definition.triggers[0] === 'turn_start' ? 'per turn' : 'passive'}</span>
                        <div className="StatusPage-mode-toggle">
                            <button type="button" className={!isScaled ? 'StatusPage-chip StatusPage-chip-selected' : 'StatusPage-chip'} onClick={() => toggleEffectMode(index, 'flat')} disabled={canWrite}>Flat</button>
                            <button type="button" className={isScaled ? 'StatusPage-chip StatusPage-chip-selected' : 'StatusPage-chip'} onClick={() => toggleEffectMode(index, 'scaled')} disabled={canWrite}>Scaled by stacks</button>
                        </div>
                        {!canWrite && <button type="button" className="StatusPage-remove-effect-button" onClick={() => removeEffect(index)}>Remove</button>}
                    </div>

                    {!isScaled && <div className="StatusPage-effect-row-flat">
                        by
                        <input
                            className="StatusPage-input StatusPage-input-narrow"
                            type="number"
                            value={effect.delta}
                            onChange={e => updateEffectDelta(index, e.target.value)}
                            disabled={canWrite}
                        />
                    </div>}

                    {isScaled && <div className="StatusPage-effect-table">
                        <p className="StatusPage-hint">The value at the highest defined stack level at or below the status's current stacks applies - e.g. Exhaustion's table only defines levels 1-6, so stacks 7+ still resolves to level 6's value. Lets one status (stacks = severity level) reproduce a non-linear table like Exhaustion's, instead of a flat per-stack delta.</p>
                        {(effect.table || []).map((row, rowIndex) =>
                            <div className="StatusPage-effect-table-row" key={rowIndex}>
                                <span>Stacks &ge;</span>
                                <input
                                    className="StatusPage-input StatusPage-input-narrow"
                                    type="number"
                                    min={1}
                                    value={row.level}
                                    onChange={e => updateTableLevel(index, rowIndex, 'level', e.target.value)}
                                    disabled={canWrite}
                                />
                                <span>adjust by</span>
                                <input
                                    className="StatusPage-input StatusPage-input-narrow"
                                    type="number"
                                    value={row.delta}
                                    onChange={e => updateTableLevel(index, rowIndex, 'delta', e.target.value)}
                                    disabled={canWrite}
                                />
                                {!canWrite && <button type="button" className="StatusPage-remove-effect-button" onClick={() => removeTableLevel(index, rowIndex)}>Remove</button>}
                            </div>
                        )}
                        {!canWrite && <button type="button" className="StatusPage-add-effect-button" onClick={() => addTableLevel(index)}>+ Add Level</button>}
                    </div>}
                </div>;
            })}
            {!canWrite && <button type="button" className="StatusPage-add-effect-button" onClick={addEffect}>+ Add Effect</button>}
            <label className="StatusPage-checkbox-label">
                <input
                    type="checkbox"
                    checked={Boolean(formData.decaysPerTurn)}
                    onChange={e => setFormData({ name: 'decaysPerTurn', value: e.target.checked })}
                    disabled={canWrite}
                />
                Counts down by 1 stack each "Next Turn"
            </label>
            <p className="StatusPage-hint">On by default for an Action Points effect (Haste/Slowed/Stunned). Turn on for a passive effect that should still wear off over time (Frightened); leave off for one that persists until removed by hand or a rest (Exhaustion, Wounded, a temporary buff with no fixed duration).</p>
        </div>

        <div className="StatusPage-field">
            <label className="StatusPage-checkbox-label">
                <input
                    type="checkbox"
                    checked={Boolean(formData.grantedAction)}
                    onChange={toggleGrantsAction}
                    disabled={canWrite}
                />
                Grants a special action while active
            </label>
            <p className="StatusPage-hint">Shows up alongside the character's own class actions on the Combat tab for as long as this status is active (e.g. an "Identify" status granting a free Identify action).</p>
            {formData.grantedAction && <div className="StatusPage-effect-row StatusPage-granted-action">
                <input
                    className="StatusPage-input"
                    name="actionName"
                    type="text"
                    placeholder="Action name"
                    value={formData.grantedAction.actionName}
                    onChange={handleGrantedActionChange}
                    disabled={canWrite}
                />
                <div>
                    Cost:
                    <input
                        className="StatusPage-input StatusPage-input-narrow"
                        name="actionCost"
                        type="number"
                        min={0}
                        max={3}
                        value={formData.grantedAction.actionCost}
                        onChange={handleGrantedActionChange}
                        disabled={canWrite}
                    />
                    Range:
                    <input
                        className="StatusPage-input StatusPage-input-narrow"
                        name="range"
                        type="text"
                        placeholder="1 Zone"
                        value={formData.grantedAction.range}
                        onChange={handleGrantedActionChange}
                        disabled={canWrite}
                    />
                </div>
                <label className="StatusPage-checkbox-label">
                    <input type="checkbox" name="toHitBool" checked={formData.grantedAction.toHitBool} onChange={handleGrantedActionChange} disabled={canWrite}/>
                    To-hit action (unchecked = DC check)
                </label>
                {formData.grantedAction.toHitBool
                    ? <input
                        className="StatusPage-input StatusPage-input-narrow"
                        name="toHit"
                        type="number"
                        placeholder="To-hit modifier"
                        value={formData.grantedAction.toHit}
                        onChange={handleGrantedActionChange}
                        disabled={canWrite}
                    />
                    : <input
                        className="StatusPage-input"
                        name="difficultyClass"
                        type="text"
                        placeholder="DC modifier, e.g. Int,0"
                        value={formData.grantedAction.difficultyClass}
                        onChange={handleGrantedActionChange}
                        disabled={canWrite}
                    />}
                <TextareaAutosize
                    className="StatusPage-textarea"
                    name="description"
                    placeholder="What does the action do?"
                    minRows={2}
                    value={formData.grantedAction.description}
                    onChange={handleGrantedActionChange}
                    disabled={canWrite}
                />
            </div>}
        </div>

        {isEditing && formData.public && !formData.isDefault && <div className="StatusPage-field">
            <label className="StatusPage-label">Subscribe your campaigns</label>
            <p className="StatusPage-hint">A pool status like this one only shows up as an addable preset for a campaign's characters once that campaign subscribes to it - not automatically, the way an admin default would.</p>
            {myWritableCampaigns.length === 0 && <p className="StatusPage-hint">You don't direct (or have write access to) any campaigns yet.</p>}
            <div className="StatusPage-chip-row">
                {myWritableCampaigns.map(c => {
                    const subscribed = c.subscribedStatusIds?.includes(statusId);
                    return <button
                        key={c.id}
                        type="button"
                        className={subscribed ? 'StatusPage-chip StatusPage-chip-selected' : 'StatusPage-chip'}
                        onClick={() => toggleSubscription(c)}
                    >
                        {c.campaign_name}{subscribed ? ' ✓' : ''}
                    </button>;
                })}
            </div>
        </div>}

        <div className="StatusPage-actions">
            <button className="StatusPage-submit-button" onClick={handleSubmit} disabled={canWrite || submitting}>
                {submitting ? 'Saving…' : (isEditing ? 'Update Status' : 'Create Status')}
            </button>
            {isEditing && !canWrite && <button className="StatusPage-delete-button" onClick={handleDelete}>Delete Status</button>}
        </div>
        </div>
    </div>
}
