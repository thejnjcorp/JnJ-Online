import { useMemo, useReducer, useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { auth, db } from '../utils/firebase';
import { classFormReducer } from '../utils/classFormReducer';
import { NO_ENEMY_ERRORS, enemyDocFields, newEnemy, rosterEntry, validateEnemy } from '../utils/enemies';
import { benchmarkDefaults } from '../utils/encounterGuide';
import { useTagCatalog } from '../utils/useTagCatalog';
import { EnemyStatBlockForm } from './EnemyStatBlockForm';
import { FieldError, ValidationSummary, invalidClass, invalidProps, scrollToProblem } from './FormErrors';
import '../styles/ClassPage.scss';
import '../styles/EncounterPage.scss';

// A new enemy, made right here for this encounter: the same stat block, actions
// and notes as a bestiary enemy. It starts as a Regular with the guide's numbers
// for one. Adding puts it in the roster; if "Also save it to my bestiary" is
// ticked it is saved there too (private to you), so it can be used again.
// `onAdd` is given the roster entry.
export function EncounterNewEnemy({ onAdd, onClose }) {
    const [formData, setFormData] = useReducer(classFormReducer, undefined, () => ({ ...newEnemy('Regular'), ...benchmarkDefaults('Regular') }));
    const [saveToBestiary, setSaveToBestiary] = useState(false);
    const [showErrors, setShowErrors] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const tagCatalog = useTagCatalog();
    const validation = useMemo(() => validateEnemy(formData), [formData]);
    const errors = showErrors ? validation : NO_ENEMY_ERRORS;

    async function handleAdd() {
        if (!validation.valid) {
            setShowErrors(true);
            // after the errors have rendered, so there is something to scroll to
            setTimeout(scrollToProblem, 0);
            return;
        }
        const payload = enemyDocFields(formData);
        setSubmitting(true);
        try {
            let id;
            if (saveToBestiary) {
                const uid = auth.currentUser?.uid;
                if (!uid) throw new Error('You need to be signed in to save to your bestiary.');
                const docRef = await addDoc(collection(db, 'enemies'), { ...payload, public: false, canRead: [uid], canWrite: [uid], admins: [uid] });
                id = docRef.id;
            }
            onAdd(rosterEntry({ ...payload, id }));
        } catch (error) {
            alert("Couldn't save the enemy to your bestiary: " + error.message);
            setSubmitting(false);
        }
    }

    return <div className="EncounterPage-create" role="group" aria-label="New enemy">
        <div className="ClassPage-section-title">New enemy for this encounter</div>
        <div className="ClassPage-hint">Build it here - stat block, actions and all. It goes into the roster as a copy that belongs to this encounter.</div>
        <input
            className={invalidClass('ClassPage-title-input', errors.fields.enemy_name)}
            {...invalidProps('field-enemy_name', errors.fields.enemy_name)}
            aria-label="Name of the new enemy"
            placeholder="Enemy name"
            value={formData.enemy_name || ''}
            onChange={event => setFormData({ name: 'enemy_name', value: event.target.value })}
        />
        <FieldError message={errors.fields.enemy_name}/>
        <ValidationSummary problems={errors.problems}/>
        <EnemyStatBlockForm formData={formData} setFormData={setFormData} errors={errors} tagCatalog={tagCatalog}/>
        <label className="EncounterPage-create-save">
            <input type="checkbox" checked={saveToBestiary} onChange={event => setSaveToBestiary(event.target.checked)}/>
            <span>Also save it to my bestiary <span className="ClassPage-hint">(private to you, so you can use it in other encounters)</span></span>
        </label>
        <div className="EncounterPage-create-buttons">
            <button type="button" className="ClassPage-edit-button" onClick={handleAdd} disabled={submitting}>{submitting ? 'Adding…' : 'Add to encounter'}</button>
            <button type="button" className="ClassPage-add-tag-button" onClick={onClose} disabled={submitting}>Cancel</button>
        </div>
    </div>;
}
