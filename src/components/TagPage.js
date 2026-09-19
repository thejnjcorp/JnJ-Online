import { useEffect, useReducer, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, or, query, updateDoc, where } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { ADMIN_UIDS } from '../utils/statusEffects';
import { statusFormReducer } from '../utils/statusFormReducer';
import { DocAdminManager } from './DocAdminManager';
import '../styles/StatusPage.scss';
import '../styles/TagPage.scss';

const EMPTY_TAG = {
    tagInfo: '',
    tagColor: '#61dafb',
    textColor: '#1b1b1f',
    tagDescription: '',
    classes: [],
    visibility: 'public',
    isDefault: false,
};

// Default (general, curated by the admin account) and Public are the same
// stored state - `public: true` - and differ only in `isDefault`, which only
// the admin account can ever set, so a non-admin choosing "Public" lands in the
// pool. Same idea as the status page's visibility picker.
function getVisibilityOptions(isAdmin) {
    return [
        {
            key: 'public',
            label: isAdmin ? 'Default' : 'Public',
            hint: isAdmin
                ? 'Listed first for everyone. Only the admin account can create these.'
                : 'Any signed-in user can find this tag and put it on their actions.',
        },
        { key: 'private', label: 'Private', hint: 'Only visible to you (and anyone else you add as a writer).' },
    ];
}

const visibilityFromDoc = data => (data.public ? 'public' : 'private');
const isHexColor = value => /^#[0-9a-f]{6}$/i.test(value || '');

export function TagPage() {
    // The status form's reducer is the generic one: {name, value} sets a field,
    // SET_FORM_DATA merges a document in.
    const [formData, setFormData] = useReducer(statusFormReducer, EMPTY_TAG);
    const [classOptions, setClassOptions] = useState([]);
    const [userId, setUserId] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const tagId = location.pathname.split('/').at(2);
    const isEditing = Boolean(tagId);

    function loadTag() {
        return getDoc(doc(db, 'tags', tagId)).then(snap => {
            if (!snap.exists()) return;
            const data = snap.data();
            setFormData({ type: 'SET_FORM_DATA', payload: { ...EMPTY_TAG, ...data, visibility: visibilityFromDoc(data) } });
            document.title = data.tagInfo || 'Edit Tag';
        }).catch(error => console.log(error));
    }

    useEffect(() => {
        document.title = isEditing ? 'Edit Tag' : 'New Tag';
        if (!isEditing) return;
        loadTag();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tagId]);

    useEffect(() => {
        // Auth can still be settling right after a page load - see StatusPage.js.
        const unsubscribe = onAuthStateChanged(auth, user => {
            if (!user) return;
            setUserId(user.uid);
            getDocs(query(collection(db, 'classes'),
                or(where('public', '==', true), where('canRead', 'array-contains', user.uid), where('canWrite', 'array-contains', user.uid))))
                .then(snapshot => setClassOptions([...new Set(snapshot.docs.map(d => d.data().class_name).filter(Boolean))].sort((a, b) => a.localeCompare(b))))
                .catch(error => console.log(error));
            unsubscribe();
        });
    }, []);

    // Someone else's tag can be read but not changed. A tag not saved yet has no
    // writers to check, so it can't be someone else's.
    const readOnly = isEditing && Boolean(userId) && !formData.canWrite?.includes(userId);
    const isAdmin = Boolean(userId) && ADMIN_UIDS.includes(userId);
    const visibilities = getVisibilityOptions(isAdmin);
    const set = (name, value) => setFormData({ name, value });

    function toggleClass(className) {
        const current = formData.classes || [];
        set('classes', current.includes(className) ? current.filter(name => name !== className) : [...current, className]);
    }

    async function handleSubmit() {
        if (!formData.tagInfo?.trim()) return alert('A tag needs a label.');
        if (!isHexColor(formData.tagColor) || !isHexColor(formData.textColor)) return alert('Pick a colour for the tag and its text.');
        setSubmitting(true);
        try {
            const visibilityFields = formData.visibility === 'public'
                ? { public: true, isDefault: isAdmin, canRead: [] }
                : { public: false, isDefault: false, canRead: [userId] };
            const payload = {
                tagInfo: formData.tagInfo.trim(),
                tagColor: formData.tagColor,
                textColor: formData.textColor,
                tagDescription: formData.tagDescription || '',
                classes: formData.classes || [],
                ...visibilityFields,
            };
            if (isEditing) {
                // Merge rather than replace, so co-writers aren't dropped by an
                // edit. admins is left alone: only an admin can change it.
                await updateDoc(doc(db, 'tags', tagId), { ...payload, canWrite: Array.from(new Set([...(formData.canWrite || []), userId])) });
                alert('Tag updated.');
            } else {
                const docRef = await addDoc(collection(db, 'tags'), { ...payload, canWrite: [userId], admins: [userId] });
                navigate('/tags/' + docRef.id);
                alert('Tag created.');
            }
        } catch (error) {
            alert('Failed to save tag: ' + error.message);
        }
        setSubmitting(false);
    }

    async function handleDelete() {
        if (!window.confirm('Delete "' + formData.tagInfo + '"? Actions that already have it keep their copy.')) return;
        try {
            await deleteDoc(doc(db, 'tags', tagId));
            navigate('/tag-list');
        } catch (error) {
            alert('Failed to delete tag: ' + error.message);
        }
    }

    const submitLabel = submitting ? 'Saving…' : (isEditing ? 'Update Tag' : 'Create Tag');

    return <div className="StatusPage">
        <div className="StatusPage-inner">
            <div className="StatusPage-header">
                <h1 className="StatusPage-title">{isEditing ? 'Edit Tag' : 'New Tag'}</h1>
                <p className="StatusPage-subtitle">Tags are labels for actions. Pick them when editing a class or race; players can then filter and sort their actions by them.</p>
            </div>

            <div className="StatusPage-field">
                <label className="StatusPage-label" htmlFor="tag-label">Label</label>
                <input id="tag-label" className="StatusPage-input" name="tagInfo" type="text" placeholder="Fire" value={formData.tagInfo || ''}
                    onChange={event => set('tagInfo', event.target.value)} disabled={readOnly}/>
            </div>

            <div className="StatusPage-field">
                <span className="StatusPage-label">Colours</span>
                <div className="TagPage-colors">
                    <label>Tag<input type="color" aria-label="Tag colour" value={formData.tagColor || '#61dafb'} onChange={event => set('tagColor', event.target.value)} disabled={readOnly}/></label>
                    <label>Text<input type="color" aria-label="Text colour" value={formData.textColor || '#1b1b1f'} onChange={event => set('textColor', event.target.value)} disabled={readOnly}/></label>
                </div>
                <div className="TagPage-preview" aria-label="Preview">
                    <span className="TagPage-pill" style={{ backgroundColor: formData.tagColor, color: formData.textColor }}>{formData.tagInfo || 'Tag'}</span>
                </div>
            </div>

            <div className="StatusPage-field">
                <label className="StatusPage-label" htmlFor="tag-description">Description</label>
                <input id="tag-description" className="StatusPage-input" name="tagDescription" type="text" placeholder="Shown when someone hovers the tag"
                    value={formData.tagDescription || ''} onChange={event => set('tagDescription', event.target.value)} disabled={readOnly}/>
            </div>

            <div className="StatusPage-field">
                <span className="StatusPage-label">Class scoping</span>
                <div className="StatusPage-chip-row">
                    {classOptions.length === 0 && <span className="StatusPage-hint">No classes exist yet.</span>}
                    {classOptions.map(className =>
                        <button key={className} type="button"
                            className={(formData.classes || []).includes(className) ? 'StatusPage-chip StatusPage-chip-selected' : 'StatusPage-chip'}
                            aria-pressed={(formData.classes || []).includes(className)}
                            onClick={() => !readOnly && toggleClass(className)} disabled={readOnly}
                        >{className}</button>
                    )}
                </div>
                <p className="StatusPage-hint">Leave none selected for a general tag any class can use.</p>
            </div>

            <div className="StatusPage-field">
                <span className="StatusPage-label">Visibility</span>
                <div className="StatusPage-chip-row">
                    {visibilities.map(option =>
                        <button key={option.key} type="button"
                            className={formData.visibility === option.key ? 'StatusPage-chip StatusPage-chip-selected' : 'StatusPage-chip'}
                            aria-pressed={formData.visibility === option.key}
                            onClick={() => !readOnly && set('visibility', option.key)} disabled={readOnly}
                        >{option.label}</button>
                    )}
                </div>
                <p className="StatusPage-hint">{visibilities.find(option => option.key === formData.visibility)?.hint}</p>
            </div>

            {isEditing && <DocAdminManager docRef={doc(db, 'tags', tagId)} admins={formData.admins} userId={userId} onChanged={loadTag}/>}

            <div className="StatusPage-actions">
                <button type="button" className="StatusPage-submit-button" onClick={handleSubmit} disabled={readOnly || submitting}>{submitLabel}</button>
                {isEditing && !readOnly && <button type="button" className="StatusPage-delete-button" onClick={handleDelete}>Delete Tag</button>}
            </div>
        </div>
    </div>;
}
