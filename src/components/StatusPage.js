import { useEffect, useReducer, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth, db } from '../utils/firebase';
import '../styles/StatusPage.scss';

const formReducer = (state, event) => {
    if (event.type === 'SET_FORM_DATA') {
        return { ...state, ...event.payload };
    }
    return { ...state, [event.name]: event.value };
};

const POLARITIES = ['buff', 'debuff', 'neutral'];

const EMPTY_STATUS = {
    name: '',
    description: '',
    polarity: 'neutral',
    defaultStacks: 0,
    classes: [],
    effect: null,
};

export function StatusPage() {
    const [formData, setFormData] = useReducer(formReducer, EMPTY_STATUS);
    const [classOptions, setClassOptions] = useState([]);
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
            setFormData({ type: 'SET_FORM_DATA', payload: { ...EMPTY_STATUS, ...snap.data() } });
            document.title = snap.data().name;
        }).catch(error => console.log(error));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusId]);

    useEffect(() => {
        getDocs(collection(db, 'classes')).then(querySnapshot => {
            setClassOptions(querySnapshot.docs.map(d => d.data().class_name).filter(Boolean));
        }).catch(error => console.log(error));
    }, []);

    // A status not yet saved has no canWrite list to check against - anyone
    // signed in is creating it fresh, so it can't be someone else's yet.
    const canWrite = isEditing && !formData.canWrite?.includes(auth.currentUser.uid);

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

    function toggleHasEffect(event) {
        setFormData({
            name: 'effect',
            value: event.target.checked ? { stat: 'action_points', delta: 1, trigger: 'turn_start' } : null
        });
    }

    function handleEffectChange(event) {
        const { name, type, value } = event.target;
        setFormData({
            name: 'effect',
            value: { ...formData.effect, [name]: type === 'number' ? Number(value) : value }
        });
    }

    async function handleSubmit() {
        if (!formData.name?.trim()) return alert('A status needs a name.');
        setSubmitting(true);
        try {
            const payload = {
                name: formData.name,
                description: formData.description || '',
                polarity: formData.polarity || 'neutral',
                defaultStacks: Number(formData.defaultStacks) || 0,
                classes: formData.classes || [],
                effect: formData.effect || null,
                canWrite: [auth.currentUser.uid],
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
            <textarea
                className="StatusPage-textarea"
                name="description"
                placeholder="Gain a single action for a certain number of rounds..."
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
                value={formData.defaultStacks ?? 0}
                onChange={handleChange}
                disabled={canWrite}
            />
            <p className="StatusPage-hint">0 means this status is a toggle (present/absent) rather than something that counts down each turn.</p>
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
            <label className="StatusPage-checkbox-label">
                <input
                    type="checkbox"
                    checked={Boolean(formData.effect)}
                    onChange={toggleHasEffect}
                    disabled={canWrite}
                />
                Automatically applies a mechanical effect at the start of a turn
            </label>
            {formData.effect && <div className="StatusPage-effect-row">
                Each turn this status is active, adjust
                <select name="stat" className="StatusPage-input StatusPage-input-narrow" value={formData.effect.stat} onChange={handleEffectChange} disabled={canWrite}>
                    <option value="action_points">Action Points</option>
                </select>
                by
                <input
                    className="StatusPage-input StatusPage-input-narrow"
                    name="delta"
                    type="number"
                    value={formData.effect.delta}
                    onChange={handleEffectChange}
                    disabled={canWrite}
                />
                <p className="StatusPage-hint">Use a positive delta for buffs like Haste (+1 AP) and a negative delta for debuffs like Slowed (-1 AP). Applied once per "Next Turn" while stacks remain, then this status loses a stack.</p>
            </div>}
        </div>

        <div className="StatusPage-actions">
            <button className="StatusPage-submit-button" onClick={handleSubmit} disabled={canWrite || submitting}>
                {submitting ? 'Saving…' : (isEditing ? 'Update Status' : 'Create Status')}
            </button>
            {isEditing && !canWrite && <button className="StatusPage-delete-button" onClick={handleDelete}>Delete Status</button>}
        </div>
    </div>
}
