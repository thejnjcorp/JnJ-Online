import Collapsible from 'react-collapsible';
import Markdown from 'markdown-to-jsx';
import circleIcon from '../icons/circle.svg';
import { useState, useReducer } from 'react';
import { db } from '../utils/firebase';
import '../styles/SkillsAndFlaws.scss';
import { newCharacterFormReducer as formReducer } from '../utils/newCharacterFormReducer';
import { arrayRemove, arrayUnion, doc, updateDoc } from 'firebase/firestore';
import trashCanIcon from '../icons/trash_can.svg';
import { getActionCategory } from '../utils/classActions';

export function SkillsAndFlaws({characterPage, userId}) {
    const [addSkillFlawVisible, setAddSkillFlawVisible] = useState(false);
    const [removeSkillFlawVisible, setRemoveSkillFlawVisible] = useState(false);
    const [confirmRemoveSkillFlaw, setConfirmRemoveSkillFlaw] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useReducer(formReducer, {});

    const hasWritePermissions = characterPage?.canWrite?.includes(userId);

    const handleChange = event => {
        const value = event.target.type === 'number' ? Number(event.target.value) : event.target.value;

        setFormData({
            name: event.target.name,
            value: value
        });
    }

    const handleBooleanChange = event => {
        const value = event.target.value === 'true';

        setFormData({
            name: event.target.name,
            value: value
        });
    }

    function closeAddForm() {
        setAddSkillFlawVisible(false);
        // formReducer (newCharacterFormReducer, also used by NewCharacterPage.js)
        // has no dedicated reset action -
        // it only merges a payload over existing state or sets one field at a
        // time - so clearing has to explicitly overwrite every field rather
        // than rely on a {reset: true} shape (that's a different reducer's
        // convention, in NewCampaignPage.js).
        setFormData({ type: 'SET_FORM_DATA', payload: { name: '', degree: '', isSkill: undefined, description: '' } });
    }

    async function handleAdd() {
        if (formData.name === undefined ||
            formData.degree === undefined ||
            formData.isSkill === undefined ||
            formData.description === undefined) {
            return alert("Invalid Skill/Flaw");
        }
        if (!hasWritePermissions) return alert("Invalid write permissions!");
        setSubmitting(true);
        try {
            await updateDoc(doc(db, "characters", characterPage.character_id), {
                skills_and_flaws: arrayUnion(formData)
            });
            closeAddForm();
        } catch (e) {
            alert(e);
        }
        setSubmitting(false);
    }

    async function handleConfirmRemove() {
        setSubmitting(true);
        try {
            await updateDoc(doc(db, "characters", characterPage.character_id), {
                skills_and_flaws: arrayRemove(confirmRemoveSkillFlaw)
            });
            setRemoveSkillFlawVisible(false);
            setConfirmRemoveSkillFlaw(false);
        } catch (e) {
            alert(e);
        }
        setSubmitting(false);
    }

    function renderEntry(skill_or_flaw, index) {
        return <Collapsible
            key={skill_or_flaw.name + index}
            id={skill_or_flaw.name + index}
            trigger={<>
                <span className="SkillsAndFlaws-chevron">›</span>
                <span className="SkillsAndFlaws-name">{skill_or_flaw.name}</span>
                <span className="SkillsAndFlaws-circles">
                    {Array.from({ length: skill_or_flaw.degree }, (_, index) => (
                        <img key={index} src={circleIcon} alt='circle' className='SkillsAndFlaws-circle' width={18}/>
                    ))}
                </span>
                {removeSkillFlawVisible && <button type="button" className='SkillsAndFlaws-trash-button'
                    onClick={(e) => {
                        e.stopPropagation();
                        setConfirmRemoveSkillFlaw(skill_or_flaw);
                    }}>
                    <img src={trashCanIcon} alt='remove' className='SkillsAndFlaws-trash-can' width={16}/>
                </button>}
            </>}
            className={skill_or_flaw.isSkill ? "SkillsAndFlaws SkillsAndFlaws-skill SkillsOverride" : "SkillsAndFlaws SkillsAndFlaws-flaw FlawsOverride"}
            openedClassName={skill_or_flaw.isSkill ? "SkillsAndFlaws SkillsAndFlaws-skill SkillsAndFlaws-open SkillsOverride" : "SkillsAndFlaws SkillsAndFlaws-flaw SkillsAndFlaws-open FlawsOverride"}
            contentInnerClassName='SkillsAndFlaws-inner-div'
            triggerClassName='SkillsAndFlaws-trigger'
            triggerOpenedClassName='SkillsAndFlaws-trigger SkillsAndFlaws-trigger-open'
            transitionTime={180}
            easing="ease"
            open={false}
        >
            <p className="SkillsAndFlaws-description">
                {skill_or_flaw.description}
            </p>
        </Collapsible>
    }

    // Feats are granted by the character's class (denormalized onto
    // characterPage.actions at creation, see NewCharacterPage.js) rather
    // than authored here, so this list is read-only - no Add/Remove
    // toolbar, no degree stars (feats don't have one).
    function renderFeat(feat, index) {
        return <Collapsible
            key={feat.actionName + index}
            id={feat.actionName + index}
            trigger={<>
                <span className="SkillsAndFlaws-chevron">›</span>
                <span className="SkillsAndFlaws-name">{feat.actionName}</span>
            </>}
            className="SkillsAndFlaws SkillsAndFlaws-feat FeatsOverride"
            openedClassName="SkillsAndFlaws SkillsAndFlaws-feat SkillsAndFlaws-open FeatsOverride"
            contentInnerClassName='SkillsAndFlaws-inner-div'
            triggerClassName='SkillsAndFlaws-trigger'
            triggerOpenedClassName='SkillsAndFlaws-trigger SkillsAndFlaws-trigger-open'
            transitionTime={180}
            easing="ease"
            open={false}
        >
            <div className="SkillsAndFlaws-feat-description">
                <Markdown options={{ disableParsingRawHTML: true }}>{feat.description || ""}</Markdown>
            </div>
        </Collapsible>
    }

    const skills = characterPage.skills_and_flaws.filter(item => item.isSkill);
    const flaws = characterPage.skills_and_flaws.filter(item => !item.isSkill);
    const feats = (characterPage.actions || []).filter(action => getActionCategory(action) === 'feat');

    return <>
        <div className="SkillsAndFlaws-header">
            <div className="SkillsAndFlaws-title">Skills &amp; Flaws</div>
            <div className="SkillsAndFlaws-count">{skills.length} skill{skills.length === 1 ? "" : "s"} · {flaws.length} flaw{flaws.length === 1 ? "" : "s"} · {feats.length} feat{feats.length === 1 ? "" : "s"}</div>
        </div>

        {hasWritePermissions && <div className='SkillsAndFlaws-toolbar'>
            <button type="button" className='SkillsAndFlaws-toolbar-button' onClick={() => setAddSkillFlawVisible(true)}>+ Add</button>
            <button type="button"
                className={removeSkillFlawVisible ? 'SkillsAndFlaws-toolbar-button SkillsAndFlaws-toolbar-button-active' : 'SkillsAndFlaws-toolbar-button'}
                onClick={() => setRemoveSkillFlawVisible(!removeSkillFlawVisible)}
            >
                {removeSkillFlawVisible ? "Done" : "Remove"}
            </button>
        </div>}

        <div className="SkillsAndFlaws-group-label SkillsAndFlaws-group-label-skill">Skills</div>
        {skills.length > 0
            ? skills.map((skill, index) => renderEntry(skill, index))
            : <div className="SkillsAndFlaws-empty-group">None recorded yet</div>}

        <div className="SkillsAndFlaws-group-label SkillsAndFlaws-group-label-flaw">Flaws</div>
        {flaws.length > 0
            ? flaws.map((flaw, index) => renderEntry(flaw, index))
            : <div className="SkillsAndFlaws-empty-group">None recorded yet</div>}

        <div className="SkillsAndFlaws-group-label SkillsAndFlaws-group-label-feat">Feats</div>
        {feats.length > 0
            ? feats.map((feat, index) => renderFeat(feat, index))
            : <div className="SkillsAndFlaws-empty-group">None recorded yet</div>}

        {addSkillFlawVisible && <>
            <div className="SkillsAndFlaws-scrim"/>
            <div className="SkillsAndFlaws-dialog">
                <h3>Add Skill or Flaw</h3>
                <div className={formData?.isSkill ? "SkillsAndFlaws-preview SkillsAndFlaws-skill SkillsOverride" : "SkillsAndFlaws-preview SkillsAndFlaws-flaw FlawsOverride"}>
                    <input
                        className="SkillsAndFlaws-dialog-input"
                        name='name'
                        placeholder='Skill/Flaw Name'
                        value={formData.name || ""}
                        onChange={handleChange}
                        autoFocus
                    />
                    <div className="SkillsAndFlaws-dialog-row">
                        <input
                            className="SkillsAndFlaws-dialog-input SkillsAndFlaws-dialog-input-degree"
                            name='degree'
                            placeholder='Degree (1-3)'
                            type='number'
                            value={formData.degree || ""}
                            onChange={handleChange}
                            max={3}
                            min={1}
                        />
                        <select
                            className="SkillsAndFlaws-dialog-select"
                            name='isSkill'
                            value={formData.isSkill === undefined ? "" : String(formData.isSkill)}
                            onChange={handleBooleanChange}
                        >
                            <option hidden value=""></option>
                            <option value={true}>Skill</option>
                            <option value={false}>Flaw</option>
                        </select>
                    </div>
                    <textarea
                        className="SkillsAndFlaws-dialog-textarea"
                        name='description'
                        placeholder='Description'
                        value={formData.description || ""}
                        onChange={handleChange}
                    />
                </div>
                <div className="SkillsAndFlaws-dialog-actions">
                    <button type="button" className="SkillsAndFlaws-dialog-button SkillsAndFlaws-dialog-button-primary" onClick={handleAdd} disabled={submitting}>
                        {submitting ? "Adding…" : "Add"}
                    </button>
                    <button type="button" className="SkillsAndFlaws-dialog-button" onClick={closeAddForm}>Cancel</button>
                </div>
            </div>
        </>}

        {confirmRemoveSkillFlaw && <>
            <div className="SkillsAndFlaws-scrim"/>
            <div className="SkillsAndFlaws-dialog">
                <h3>Remove "{confirmRemoveSkillFlaw.name}"?</h3>
                <p className="SkillsAndFlaws-dialog-help">This can't be undone.</p>
                <div className="SkillsAndFlaws-dialog-actions">
                    <button type="button" className="SkillsAndFlaws-dialog-button SkillsAndFlaws-dialog-button-danger" onClick={handleConfirmRemove} disabled={submitting}>
                        {submitting ? "Removing…" : "Remove"}
                    </button>
                    <button type="button" className="SkillsAndFlaws-dialog-button" onClick={() => setConfirmRemoveSkillFlaw(false)}>Cancel</button>
                </div>
            </div>
        </>}
    </>
}
