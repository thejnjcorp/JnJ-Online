import Collapsible from 'react-collapsible';
import starIcon from '../icons/star.svg';
import { useState, useEffect, useRef, useReducer } from 'react';
import { auth, db } from '../utils/firebase';
import '../styles/SkillsAndFlaws.scss';
import { formReducer } from './NewCharacterPage';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';

export function SkillsAndFlaws({characterPage, userId}) {
    const [addSkillFLawVisible, setAddSkillFlawVisible] = useState(false);
    const [removeSkillFlawVisible, setRemoveSkillFlawVisible] = useState(false);
    const [formData, setFormData] = useReducer(formReducer, {});
    const divRef = useRef(null);

    useEffect(() => {
        document.addEventListener('mousedown', clickOutsidePopupScreen);

        return () => {
            document.removeEventListener('mousedown', clickOutsidePopupScreen);
        }
        // eslint-disable-next-line
    },[location]);

    const clickOutsidePopupScreen = (event) => {
        if (divRef.current && !divRef.current.contains(event.target)) {
            setAddSkillFlawVisible(false);
            setRemoveSkillFlawVisible(false);
        }
    }

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
           <button className='SkillsAndFlaws-button SkillFlawButtonOverride' onClick={() => setRemoveSkillFlawVisible(true)}>Remove</button>
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
        </>}
        {characterPage.skills_and_flaws.map((skill_or_flaw, index, isOpen=false) => 
            <Collapsible 
                key={index}
                trigger={<>{skill_or_flaw.name}
                <span>
                    {Array.from({ length: skill_or_flaw.degree }, (_, index) => (
                        <img key={index} src={starIcon} alt='star' className='SkillsAndFlaws-star' width={30}/>
                    ))}
                </span>
                </>}
                className={skill_or_flaw.isSkill ? "SkillsAndFlaws SkillsAndFlaws-skill SkillsOverride" : "SkillsAndFlaws SkillsAndFlaws-flaw FlawsOverride"}
                openedClassName={skill_or_flaw.isSkill ? "SkillsAndFlaws SkillsAndFlaws-skill SkillsOverride" : "SkillsAndFlaws SkillsAndFlaws-flaw FlawsOverride"}
                contentInnerClassName='SkillsAndFlaws-inner-div'
                triggerClassName='SkillsAndFlaws-trigger'
                triggerOpenedClassName='SkillsAndFlaws-trigger'
                transitionTime={100}
                open={isOpen}
            >
                <p style={{margin: 0}}>
                    {skill_or_flaw.description}
                </p>
            </Collapsible>
        )}
    </>
}