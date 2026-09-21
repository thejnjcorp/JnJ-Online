import { useEffect, useMemo, useReducer, useState } from 'react';
import { addDoc, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, or, query, updateDoc, where } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { classFormReducer } from '../utils/classFormReducer';
import { MAX_ITEM_DESCRIPTION, MAX_ITEM_NAME, MAX_ITEM_TAGS, MAX_TAG_LENGTH, NO_ITEM_ERRORS, itemDocFields, newItem, normalizeTags, validateItem } from '../utils/items';
import { withoutArchivedCampaigns } from '../utils/campaignArchive';
import { membersOf } from '../utils/itemAccess';
import { DocAdminManager } from './DocAdminManager';
import { FieldError, ValidationSummary, invalidClass, invalidProps, scrollToProblem } from './FormErrors';
import { PictureField } from './PictureField';
import MarkdownEditor from './MarkdownEditor';
import '../styles/ClassPage.scss';
import '../styles/StatusPage.scss';
import '../styles/EnemyPage.scss';
import '../styles/ItemPage.scss';

const VISIBILITIES = [
    { key: 'private', label: 'Private', hint: 'Only you (and anyone you add as a writer or share it with) can see this item.' },
    { key: 'public', label: 'Public', hint: 'Any signed-in user can find this item in the database and put it in an inventory.' },
];

// One item in the item database: what a thing is, written once so inventories can
// refer to it. Create at /items, edit at /items/:id.
export function ItemPage() {
    const [formData, setFormData] = useReducer(classFormReducer, { ...newItem(), visibility: 'private' });
    const [loaded, setLoaded] = useState(false);
    const [userId, setUserId] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showErrors, setShowErrors] = useState(false);
    const [jumpToken, setJumpToken] = useState(0);
    const [tagText, setTagText] = useState('');
    const [myCampaigns, setMyCampaigns] = useState([]);
    const [shared, setShared] = useState({});
    const navigate = useNavigate();
    const location = useLocation();
    const itemId = location.pathname.split('/').at(2);
    const isEditing = Boolean(itemId);

    useEffect(() => {
        document.title = isEditing ? 'Edit Item' : 'New Item';
        if (!isEditing) { setLoaded(true); return; }
        getDoc(doc(db, 'items', itemId)).then(snap => {
            if (!snap.exists()) return;
            const data = snap.data();
            setFormData({ type: 'REPLACE_FORM_DATA', payload: { ...newItem(), ...data, visibility: data.isPublic ? 'public' : 'private' } });
            document.title = data.item_name || 'Edit Item';
            setLoaded(true);
        }).catch(error => console.log(error));
    }, [itemId, isEditing]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            if (!user) return;
            setUserId(user.uid);
            getDocs(query(collection(db, 'campaigns'), or(where('canRead', 'array-contains', user.uid), where('canWrite', 'array-contains', user.uid))))
                .then(snapshot => setMyCampaigns(withoutArchivedCampaigns(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))))
                .catch(error => console.log(error));
        });
        return () => unsubscribe();
    }, []);

    const readOnly = isEditing && Boolean(userId) && !formData.canWrite?.includes(userId);
    const validation = useMemo(() => validateItem(formData), [formData]);
    const errors = showErrors ? validation : NO_ITEM_ERRORS;

    useEffect(() => {
        if (jumpToken > 0) scrollToProblem();
    }, [jumpToken]);

    const set = (name, value) => setFormData({ name, value });

    function addTags(text) {
        const next = normalizeTags([...(formData.tags || []), ...text.split(',')]);
        set('tags', next);
        setTagText('');
    }

    async function handleSubmit() {
        if (!validation.valid) {
            setShowErrors(true);
            setJumpToken(token => token + 1);
            return;
        }
        setSubmitting(true);
        try {
            const payload = itemDocFields(formData);
            if (isEditing) {
                await updateDoc(doc(db, 'items', itemId), { ...payload, canWrite: Array.from(new Set([...(formData.canWrite || []), userId])) });
                alert('Item updated.');
            } else {
                const docRef = await addDoc(collection(db, 'items'), { ...payload, canRead: payload.isPublic ? [] : [userId], canWrite: [userId], admins: [userId] });
                navigate('/items/' + docRef.id);
                alert('Item created.');
            }
        } catch (error) {
            alert('Failed to save item: ' + error.message);
        }
        setSubmitting(false);
    }

    async function handleDelete() {
        if (!window.confirm(`Delete "${formData.item_name}"? Inventories that hold it will show it by the name they kept, without its details.`)) return;
        try {
            await deleteDoc(doc(db, 'items', itemId));
            navigate('/item-list');
        } catch (error) {
            alert('Failed to delete item: ' + error.message);
        }
    }

    // Let a campaign's members read this item (add them to who can read it).
    async function shareWith(campaign) {
        try {
            await updateDoc(doc(db, 'items', itemId), { canRead: arrayUnion(...membersOf(campaign)) });
            setShared(current => ({ ...current, [campaign.id]: true }));
        } catch (error) {
            alert("Couldn't share it: " + error.message);
        }
    }

    if (!loaded) return <div className="ClassPage"><div className="ClassPage-inner"><div className="ClassPage-hint">Loading…</div></div></div>;

    const canShare = isEditing && !readOnly && !formData.isPublic && formData.visibility !== 'public' && myCampaigns.length > 0;

    return <div className="ClassPage">
        <div className="ClassPage-inner">
            <button type="button" className="ClassPage-breadcrumb" onClick={() => navigate('/item-list')}>&larr; Items</button>

            <div className="ClassPage-header">
                <div className="ClassPage-header-main">
                    <input
                        className={invalidClass('ClassPage-title-input', errors.fields.item_name)}
                        {...invalidProps('field-item_name', errors.fields.item_name)}
                        aria-label="Name"
                        placeholder="Item name"
                        maxLength={MAX_ITEM_NAME + 20}
                        value={formData.item_name || ''}
                        disabled={readOnly}
                        onChange={event => set('item_name', event.target.value)}
                    />
                    <FieldError message={errors.fields.item_name}/>
                </div>
            </div>

            <ValidationSummary problems={errors.problems}/>
            {readOnly && <div className="ClassPage-hint">This item belongs to someone else, so it's read-only. You can still put it in an inventory.</div>}

            <div className="ClassPage-card">
                <div className="ClassPage-section-title">Picture</div>
                <PictureField name={formData.item_name} value={formData.item_image || ''} readOnly={readOnly} error={errors.fields.item_image} onChange={value => set('item_image', value)} square fieldId="field-item_image"/>
                <div className="ClassPage-hint">Shown beside the item in inventories and the database.</div>
            </div>

            <div className="ClassPage-card">
                <div className="ClassPage-section-title">Description</div>
                <div {...invalidProps('field-item_description', errors.fields.item_description)} tabIndex={errors.fields.item_description ? -1 : undefined}>
                    <MarkdownEditor
                        label="Description"
                        variant="compact"
                        placeholder="What it is, what it does, how much it weighs - whatever the table needs to know."
                        value={formData.item_description || ''}
                        readOnly={readOnly}
                        maxLength={MAX_ITEM_DESCRIPTION}
                        onChange={value => set('item_description', value)}
                    />
                </div>
                <FieldError message={errors.fields.item_description}/>
            </div>

            <div className="ClassPage-card" {...invalidProps('field-tags', errors.fields.tags)} tabIndex={errors.fields.tags ? -1 : undefined}>
                <div className="ClassPage-section-title">Tags</div>
                <div className="ItemPage-tags">
                    {(formData.tags || []).map(tag => <span className="ItemPage-tag" key={tag}>
                        {tag}
                        {!readOnly && <button type="button" className="ItemPage-tag-remove" aria-label={`Remove tag ${tag}`} onClick={() => set('tags', formData.tags.filter(other => other !== tag))}>×</button>}
                    </span>)}
                    {(formData.tags || []).length === 0 && <span className="ClassPage-hint">No tags yet.</span>}
                </div>
                {!readOnly && (formData.tags || []).length < MAX_ITEM_TAGS && <div className="ItemPage-tag-add">
                    <input
                        className="ClassPage-field-input"
                        aria-label="Add a tag"
                        placeholder="weapon, light, consumable..."
                        maxLength={MAX_TAG_LENGTH}
                        value={tagText}
                        onChange={event => setTagText(event.target.value)}
                        onKeyDown={event => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addTags(tagText); } }}
                    />
                    <button type="button" className="ClassPage-add-tag-button" onClick={() => addTags(tagText)} disabled={tagText.trim() === ''}>+ Add tag</button>
                </div>}
                <FieldError message={errors.fields.tags}/>
                <div className="ClassPage-hint">Tags let people find it in the database - up to {MAX_ITEM_TAGS}.</div>
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
                        onClick={() => { set('visibility', option.key); set('isPublic', option.key === 'public'); }}
                    >
                        <span>{option.label}</span>
                        <span className="ClassPage-vis-pill-sub">{option.hint}</span>
                    </button>)}
                </div>
            </div>

            {canShare && <div className="ClassPage-card">
                <div className="ClassPage-section-title">Share with a campaign</div>
                <div className="ClassPage-hint">Lets everyone in the campaign read this private item, so it shows in their party inventory and trades.</div>
                <div className="ItemPage-share">
                    {myCampaigns.map(campaign => <button type="button" key={campaign.id} className="ClassPage-add-tag-button" disabled={shared[campaign.id]} onClick={() => shareWith(campaign)}>
                        {shared[campaign.id] ? `Shared with ${campaign.campaign_name}` : `Share with ${campaign.campaign_name}`}
                    </button>)}
                </div>
            </div>}

            {isEditing && <DocAdminManager docRef={doc(db, 'items', itemId)} admins={formData.admins} userId={userId} onChanged={() => {}}/>}

            <div className="EnemyPage-actions">
                <button type="button" className="StatusPage-submit-button" onClick={handleSubmit} disabled={readOnly || submitting}>
                    {submitting ? 'Saving…' : (isEditing ? 'Update Item' : 'Create Item')}
                </button>
                {isEditing && !readOnly && <button type="button" className="StatusPage-delete-button" onClick={handleDelete}>Delete Item</button>}
            </div>
        </div>
    </div>;
}
