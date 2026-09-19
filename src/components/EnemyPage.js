import { useEffect, useMemo, useReducer, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { classFormReducer } from '../utils/classFormReducer';
import { NO_ENEMY_ERRORS, enemyDocFields, newEnemy, validateEnemy } from '../utils/enemies';
import { useTagCatalog } from '../utils/useTagCatalog';
import { DocAdminManager } from './DocAdminManager';
import { EnemyStatBlockForm } from './EnemyStatBlockForm';
import { FieldError, ValidationSummary, invalidClass, invalidProps, scrollToProblem } from './FormErrors';
import '../styles/ClassPage.scss';
import '../styles/StatusPage.scss';
import '../styles/EnemyPage.scss';

const VISIBILITIES = [
    { key: 'private', label: 'Private', hint: 'Only you (and anyone you add as a writer) can see this enemy.' },
    { key: 'public', label: 'Public', hint: 'Any signed-in user can find this enemy and copy it into their own encounters.' },
];

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

    async function handleSubmit() {
        if (!validation.valid) {
            setShowErrors(true);
            setJumpToken(token => token + 1);
            return;
        }
        setSubmitting(true);
        try {
            const payload = enemyDocFields(formData);
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

            <EnemyStatBlockForm formData={formData} setFormData={setFormData} errors={errors} readOnly={readOnly} idKey={enemyId} tagCatalog={tagCatalog}/>

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
