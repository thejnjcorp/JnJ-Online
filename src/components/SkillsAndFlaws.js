import Collapsible from 'react-collapsible';
import starIcon from '../icons/star.svg';
import { useState, useReducer } from 'react';
import { db } from '../utils/firebase';
import '../styles/SkillsAndFlaws.scss';
import { formReducer } from './NewCharacterPage';
import { arrayRemove, arrayUnion, doc, updateDoc } from 'firebase/firestore';
import trashCanIcon from '../icons/trash_can.svg';

export function SkillsAndFlaws({characterPage, userId}) {
    const [addSkillFLawVisible, setAddSkillFlawVisible] = useState(false);
    const [removeSkillFlawVisible, setRemoveSkillFlawVisible] = useState(false);
    const [confirmRemoveSkillFlaw, setConfirmRemoveSkillFlaw] = useState(false);
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
        const value = event.target.value === 'true' ? true : false;

        setFormData({
            name: event.target.name,
            value: value
        });
    }
    
    return <>
        {hasWritePermissions && <><div className='SkillsAndFlaws-button-container SkillFlawButtonContainerOverride'>
           <button className='SkillsAndFlaws-button SkillFlawButtonOverride' onClick={() => setAddSkillFlawVisible(true)}>Add</button>
           <button className='SkillsAndFlaws-button SkillFlawButtonOverride' onClick={() => setRemoveSkillFlawVisible(!removeSkillFlawVisible)}>{removeSkillFlawVisible ? "Cancel" : "Remove"}</button>
        </div>
        <br/>
        {addSkillFLawVisible && <div className='SkillsAndFlaws-add-menu SkillFlawButtonAddMenuOverride'>
            <div className={formData?.isSkill ? "SkillsAndFlaws-preview SkillsAndFlaws-skill SkillsOverride" : "SkillsAndFlaws-preview SkillsAndFlaws-flaw FlawsOverride"}>
                <input 
                    name='name'
                    placeholder='Skill/Flaw Name'
                    onChange={handleChange}
                />
                <input 
                    name='degree'
                    placeholder='1-3'
                    type='number'
                    onChange={handleChange}
                    max={3}
                    min={1}
                />
                <select
                    name='isSkill'
                    type='boolean'
                    onChange={handleBooleanChange}>
                        <option hidden></option>
                        <option value={true}>Skill</option>
                        <option value={false}>Flaw</option>
                </select>
                <br/>
                <textarea name='description'
                    placeholder='description'
                    type='text'
                    onChange={handleChange}
                />
            </div>
            <button className='SkillsAndFlaws-button SkillFlawButtonOverride' type='submit' onClick={async () => {
                if (formData.name === undefined || 
                    formData.degree === undefined || 
                    formData.isSkill === undefined || 
                    formData.description === undefined) {
                    return alert("Invalid Skill/Flaw");
                }
                if (!hasWritePermissions) return alert("Invalid write permissions!");
                try {
                    await updateDoc(doc(db, "characters", characterPage.character_id), {
                        skills_and_flaws: arrayUnion(formData)
                    });
                    setAddSkillFlawVisible(false);
                } catch (e) {
                    alert(e);
                }
            }}>Add</button>
            <button className='SkillsAndFlaws-button SkillFlawButtonOverride' onClick={() => setAddSkillFlawVisible(false)}>Cancel</button>
        </div>}
        {confirmRemoveSkillFlaw && <div className='SkillsAndFlaws-remove-skill-flaw-confirm SkillFlawRemoveSkillFlawConfirmOverride'>
            Are you sure you want to delete "{confirmRemoveSkillFlaw.name}"?<br/>
            <button className='SkillsAndFlaws-button SkillFlawButtonOverride' onClick={async () => {
                try {
                    await updateDoc(doc(db, "characters", characterPage.character_id), {
                        skills_and_flaws: arrayRemove(confirmRemoveSkillFlaw)
                    });
                    setRemoveSkillFlawVisible(false);
                    setConfirmRemoveSkillFlaw(false);
                } catch (e) {
                    alert(e);
                }
            }}>Yes</button>
            <button className='SkillsAndFlaws-button SkillFlawButtonOverride' onClick={() => setConfirmRemoveSkillFlaw(false)}>No</button>
        </div>}
        </>}
        {characterPage.skills_and_flaws.map((skill_or_flaw, index) => 
            <Collapsible 
                key={skill_or_flaw.name + index}
                id={skill_or_flaw.name + index}
                trigger={<>{skill_or_flaw.name}
                <span>
                    {Array.from({ length: skill_or_flaw.degree }, (_, index) => (
                        <img key={index} src={starIcon} alt='star' className='SkillsAndFlaws-star' width={30}/>
                    ))}
                </span>
                {removeSkillFlawVisible && <button className='SkillsAndFlaws-trash-button SkillFlawTrashButtonOverride'
                    onClick={(e) => {
                        e.stopPropagation();
                        setConfirmRemoveSkillFlaw(skill_or_flaw);
                    }}>
                    <img key={index} src={trashCanIcon} alt='trash' className='SkillsAndFlaws-trash-can' width={30}/>
                </button>}
                </>}
                className={skill_or_flaw.isSkill ? "SkillsAndFlaws SkillsAndFlaws-skill SkillsOverride" : "SkillsAndFlaws SkillsAndFlaws-flaw FlawsOverride"}
                openedClassName={skill_or_flaw.isSkill ? "SkillsAndFlaws SkillsAndFlaws-skill SkillsOverride" : "SkillsAndFlaws SkillsAndFlaws-flaw FlawsOverride"}
                contentInnerClassName='SkillsAndFlaws-inner-div'
                triggerClassName='SkillsAndFlaws-trigger'
                triggerOpenedClassName='SkillsAndFlaws-trigger'
                transitionTime={100}
                open={false}
            >
                <p style={{margin: 0}}>
                    {skill_or_flaw.description}
                </p>
            </Collapsible>
        )}
    </>
}