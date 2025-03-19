import { useEffect, useReducer, useState } from 'react';
import { reverseCharacterDiceConverter, CharacterDiceConverter } from './CharacterStatCalculator';
import { useNavigate, useLocation } from 'react-router-dom';
import { addDoc, collection, getDoc, doc, updateDoc } from '@firebase/firestore';
import { auth, db } from '../utils/firebase';
import ClassLayout from '../ClassLayout.json';
import '../styles/ClassPage.scss';

const formReducer = (state, event) => {
    switch(event.type) {
        case 'SET_FORM_DATA':
        return {
            ...state,
            ...event.payload,
        };
        default: 
        const { name, value } = event;
        const arrayRegex = /(\w+)\[(\d+)\](\.\w+|\[\d+\])*/g;
        let newState = { ...state };

        if (arrayRegex.test(name)) {
            const keys = name.split('.');
            let currentObject = newState;
            keys.forEach((key, index) => {
                // If the key contains an array index (e.g., "actions[0]")
                const arrayMatch = key.match(/(\w+)\[(\d+)\]/);
            
                if (arrayMatch) {
                    const arrayName = arrayMatch[1]; // Array name, like 'actions'
                    const arrayIndex = parseInt(arrayMatch[2], 10); // Index, like 0 or 1
            
                    // Ensure the array exists
                    if (!currentObject[arrayName]) {
                    currentObject[arrayName] = [];
                    }
            
                    // Navigate to the array at the specified index
                    if (!currentObject[arrayName][arrayIndex]) {
                    currentObject[arrayName][arrayIndex] = {};
                    }
            
                    // Move down to the array item
                    currentObject = currentObject[arrayName][arrayIndex];
                } else {
                    // If it's a regular object property (e.g., "tags" or "tagInfo")
                    if (!currentObject[key]) {
                    currentObject[key] = {};  // Initialize if the key doesn't exist yet
                    }
            
                    if (keys.length - 1 !== index) {
                        // Move down to the nested object
                        currentObject = currentObject[key];
                    }
                }
            });
            
            // Set the final value
            currentObject[keys[keys.length - 1]] = value;
            return newState;
        } else {
            // If there are no arrays or nested objects, handle the flat properties
            return {
            ...state,
            [name]: value
            };
        }
    }
};

const delay = ms => new Promise(res => setTimeout(res, ms));

export function ClassPage() {
    const [formData, setFormData] = useReducer(formReducer, {});
    const [isPageVisible, setIsPageVisible] = useState(true);
    const [isActionListVisible, setIsActionListVisible] = useState(true);
    const [areTagsVisible, setAreTagsVisible] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        document.title = "New Class";
        console.log(location.pathname)
        if (location.pathname.split('/').length > 2) {
            getClassData();
        }
        // eslint-disable-next-line
    }, [location])

    async function getClassData() {
        const docRef = await getDoc(doc(db, "classes", location.pathname.split('/').at(2)));
        setFormData({ type: 'SET_FORM_DATA', payload: docRef.data() });
        document.title = docRef.data().class_name;
        rerenderPage();
    }

    const rerenderPage = async function() {
        setIsPageVisible(false);
        await delay(1);
        setIsPageVisible(true);
    }

    const canWrite = !formData.canWrite?.includes(auth.currentUser.uid) && (location.pathname.split('/').length > 2);

    const handleChange = event => {
        const { name, type, checked, value } = event.target;
        const newValue = type === 'checkbox' ? checked : value;
        const newValue2 = type === 'number' ? Number(newValue) : value;

        setFormData({
            name: name,
            value: newValue2
        });
    }

    const handleChangeDice = event => {
        const { name, value } = event.target;

        setFormData({
            name: name,
            value: reverseCharacterDiceConverter(value)
        });
    }

    const handleAddAction = function() {
        if (formData.actions !== undefined) {
            setFormData({
                name: "actions",
                value: formData.actions.concat({ actionType: "standard", toHitBool: false })
            });
        } else {
            setFormData({
                name: "actions",
                value: [{ actionType: "standard", toHitBool: false }]
            });
        }
    }

    const rerenderActionList = async function() {
        setIsActionListVisible(false)
        await delay(1);
        setIsActionListVisible(true);
    }

    const rerenderTags = async function() {
        setAreTagsVisible(false);
        await delay(1);
        setAreTagsVisible(true);
    }

    const handleRemoveAction = function(index) {
        if (formData.actions.length > 1) {
            const newActions = [];
            for (var i = 0; i < formData.actions.length; i++) {
                if (i !== index) newActions.push(formData.actions[i]);
            }
            setFormData({
                name: "actions",
                value: newActions
            })
        } else {
            setFormData({
                name: "actions",
                value: []
            })
        }
        rerenderActionList();
    }

    const handleAddTag = function(index) {
        if (formData.actions[index].tags !== undefined) {
            setFormData({
                name: `actions[${index}].tags`,
                value: formData.actions[index].tags.concat({})
            });
        } else {
            setFormData({
                name: `actions[${index}].tags`,
                value: [{}]
            });
        }
    }

    const handleRemoveTag = function(index, tagIndex) {
        if (formData.actions[index].tags.length > 1) {
            const newTags = [];
            for (var i = 0; i < formData.actions[index].tags.length; i++) {
                if (i !== tagIndex) newTags.push(formData.actions[index].tags[i]);
            }
            setFormData({
                name: `actions[${index}].tags`,
                value: newTags
            })
        } else {
            setFormData({
                name: `actions[${index}].tags`,
                value: []
            })
        }
        rerenderTags();
    }

    async function handleSubmit() {
        if (formData.class_name === ""
            || formData.author === ""
            || formData.class_type === ""
            || formData.base_armor_class === ""
            || formData.base_health_dice === ""
            || formData.base_hit_modifier === ""
            || formData.base_healing_dice_type === ""
            || formData.base_class_damage_class === ""
            || formData.base_hardness === ""
            || formData.base_melee_damage_dice_type === ""
            || formData.base_melee_damage_dice === ""
            || formData.base_melee_damage_modifier === ""
            || formData.base_ranged_damage_dice_type === ""
            || formData.base_ranged_damage_dice === ""
            || formData.base_ranged_damage_modifier === "") {
            return alert("invalid form value(s)");
        }
        if (CharacterDiceConverter(formData.base_healing_dice_type) === 'N/A') return alert("invalid base healing dice type");
        if (CharacterDiceConverter(formData.base_melee_damage_dice_type) === 'N/A') return alert("invalid base melee damage dice type");
        if (CharacterDiceConverter(formData.base_ranged_damage_dice_type) === 'N/A') return alert("invalid base ranged damage dice type");

        formData.actions.forEach(action => {
            if (action.actionCost === ""
                || action.range === ""
                || action.actionName === ""
                || action.actionLevel === ""
                || action.actionType === ""
                ) {
                    return alert("invalid action value(s)")
                }
        })
        
        if (location.pathname.split('/').length > 2) {
            try {
                await updateDoc(doc(db, "classes", location.pathname.split('/').at(2)), {
                    ...formData, 
                    canWrite: [auth.currentUser.uid]
                });
                alert("successfully updated the class")
            } catch(error) {
                alert(`Failed to update class: ${error.message}`)
            }
        } else {
            const docRef = await addDoc(collection(db, "classes"), formData);
            navigate(docRef.id);
            alert("sucessfully created the class")
        }
    }

    return <>{isPageVisible && <div className='ClassPage'>
        <div className='ClassPage-input'>
            Class Name:
            <input 
                className='ClassPage-input-box' 
                name="class_name" 
                type="text"
                onChange={handleChange}
                required
                defaultValue={formData.class_name}
                disabled={canWrite}
            />
        </div>
        <div className='ClassPage-input'>
            Author:
            <input 
                className='ClassPage-input-box' 
                name="author" 
                type="text"
                onChange={handleChange}
                required
                defaultValue={formData.author}
                disabled={canWrite}
            />
        </div>
        <div className='ClassPage-input'>
            Class Type:
            <select
                className='ClassPage-input-box'
                name={"class_type"}
                onChange={handleChange}
                required
                type='dropdown'
                defaultValue={formData.class_type}
                disabled={canWrite}
            >
                <option hidden></option>
                <option value="Attrionist">Attrionist</option>
                <option value="Crit Hunter">Crit Hunter</option>
                <option value="Manipulator">Manipulator</option>
                <option value="Snowballer">Snowballer</option>
            </select>
        </div>
        <div className='ClassPage-input'>
            Base Armor Class:
            <input 
                className='ClassPage-input-box' 
                name="base_armor_class" 
                type="number"
                onChange={handleChange}
                required
                placeholder={ClassLayout.base_armor_class}
                defaultValue={formData.base_armor_class}
                disabled={canWrite}
            />
        </div>
        <div className='ClassPage-input'>
            Base Health Dice:
            <input 
                className='ClassPage-input-box' 
                name="base_health_dice" 
                type="text"
                onChange={handleChangeDice}
                required
                placeholder={CharacterDiceConverter(ClassLayout.base_health_dice)}
                defaultValue={CharacterDiceConverter(formData.base_health_dice) === 'N/A' ? null : CharacterDiceConverter(formData.base_health_dice)}
                disabled={canWrite}
            />
        </div>
        <div className='ClassPage-input'>
            Base Hit Modifier:
            <input 
                className='ClassPage-input-box' 
                name="base_hit_modifier" 
                type="number"
                onChange={handleChange}
                required
                placeholder={ClassLayout.base_hit_modifier}
                defaultValue={formData.base_hit_modifier}
                disabled={canWrite}
            />
        </div>
        <div className='ClassPage-input'>
            Base Melee Damage:
            <input 
                className='ClassPage-input-box' 
                name="base_melee_damage_dice" 
                type="number"
                onChange={handleChange}
                required
                style={{width: 40}}
                placeholder={ClassLayout.base_melee_damage_dice}
                defaultValue={formData.base_melee_damage_dice}
                disabled={canWrite}
            />
            <input 
                className='ClassPage-input-box' 
                name="base_melee_damage_dice_type" 
                type="text"
                onChange={handleChangeDice}
                required
                style={{width: 40}}
                placeholder={CharacterDiceConverter(ClassLayout.base_melee_damage_dice_type)}
                defaultValue={CharacterDiceConverter(formData.base_melee_damage_dice_type) === 'N/A' ? null : CharacterDiceConverter(formData.base_melee_damage_dice_type)}
                disabled={canWrite}
            />{"\xa0"}+
            <input 
                className='ClassPage-input-box' 
                name="base_melee_damage_modifier" 
                type="number"
                onChange={handleChange}
                required
                style={{width: 40}}
                placeholder={ClassLayout.base_melee_damage_modifier}
                defaultValue={formData.base_melee_damage_modifier}
                disabled={canWrite}
            />
            {"\xa0"}Damage Type:
            <input 
                className='ClassPage-input-box' 
                name="base_melee_damage_type" 
                type="text"
                onChange={handleChange}
                required
                placeholder={ClassLayout.base_melee_damage_type}
                defaultValue={formData.base_melee_damage_type}
                disabled={canWrite}
            />
        </div>
        <div className='ClassPage-input'>
            Base Ranged Damage:
            <input 
                className='ClassPage-input-box' 
                name="base_ranged_damage_dice" 
                type="number"
                onChange={handleChange}
                required
                style={{width: 40}}
                placeholder={ClassLayout.base_ranged_damage_dice}
                defaultValue={formData.base_ranged_damage_dice}
                disabled={canWrite}
            />
            <input 
                className='ClassPage-input-box' 
                name="base_ranged_damage_dice_type" 
                type="text"
                onChange={handleChangeDice}
                required
                style={{width: 40}}
                placeholder={CharacterDiceConverter(ClassLayout.base_ranged_damage_dice_type)}
                defaultValue={CharacterDiceConverter(formData.base_ranged_damage_dice_type) === 'N/A' ? null : CharacterDiceConverter(formData.base_ranged_damage_dice_type)}
                disabled={canWrite}
            />{"\xa0"}+
            <input 
                className='ClassPage-input-box' 
                name="base_ranged_damage_modifier" 
                type="number"
                onChange={handleChange}
                required
                style={{width: 40}}
                placeholder={ClassLayout.base_ranged_damage_modifier}
                defaultValue={formData.base_ranged_damage_modifier}
                disabled={canWrite}
            />
            {"\xa0"}Damage Type:
            <input 
                className='ClassPage-input-box' 
                name="base_ranged_damage_type" 
                type="text"
                onChange={handleChange}
                required
                placeholder={ClassLayout.base_ranged_damage_type}
                defaultValue={formData.base_ranged_damage_type}
                disabled={canWrite}
            />
        </div>
        <div className='ClassPage-input'>
            Base Healing Dice Type:
            <input 
                className='ClassPage-input-box' 
                name="base_healing_dice_type" 
                type="text"
                onChange={handleChangeDice}
                required
                placeholder={CharacterDiceConverter(ClassLayout.base_healing_dice_type)}
                defaultValue={CharacterDiceConverter(formData.base_healing_dice_type) === 'N/A' ? null : CharacterDiceConverter(formData.base_healing_dice_type)}
                disabled={canWrite}
            />
        </div>
        <div className='ClassPage-input'>
            Base Class DC:
            <input 
                className='ClassPage-input-box' 
                name="base_class_damage_class" 
                type="number"
                onChange={handleChange}
                required
                placeholder={ClassLayout.base_class_damage_class}
                defaultValue={formData.base_class_damage_class}
                disabled={canWrite}
            />
        </div>
        <div className='ClassPage-input'>
            Base Hardness:
            <input 
                className='ClassPage-input-box' 
                name="base_hardness" 
                type="number"
                onChange={handleChange}
                required
                placeholder={ClassLayout.base_hardness}
                defaultValue={formData.base_hardness}
                disabled={canWrite}
            />
        </div>
        <div className='ClassPage-input'>
            Lore/Flavor Text:<br/>
            <textarea 
                className='ClassPage-input-text-area' 
                name="description"
                onChange={handleChange}
                required
                placeholder={ClassLayout.description}
                defaultValue={formData.description}
                disabled={canWrite}
            />
        </div>
        <div className='ClassPage-actions-box'>
            Actions:
            <button className='ClassPage-add-action-button' onClick={() => handleAddAction()} disabled={canWrite}>
                Add Action
            </button>
            {"\xa0*Note: Feats are actions denoted by the prefix \"Feat:\""}<br/>
            {isActionListVisible && formData.actions !== undefined && formData.actions.map((action, index) => {
                return <div key={index} className='ClassPage-input'>
                    Action Cost:
                    <input
                        className='ClassPage-input-box'
                        style={{width:30}} 
                        name={`actions[${index}].actionCost`}
                        onChange={handleChange}
                        required
                        type='number' min={0} max={3}
                        placeholder={0}
                        defaultValue={formData.actions[index].actionCost}
                        disabled={canWrite}
                    />
                    {"\xa0Range:"}
                    <input
                        className='ClassPage-input-box'
                        name={`actions[${index}].range`}
                        onChange={handleChange}
                        required
                        type='text'
                        placeholder='1 Zone'
                        defaultValue={formData.actions[index].range}
                        disabled={canWrite}
                    />
                    {"\xa0To-Hit Action:"}
                    <input
                        className='ClassPage-input-box'
                        name={`actions[${index}].toHitBool`}
                        onChange={handleChange}
                        required
                        type='checkbox'
                        defaultChecked={formData.actions[index].toHitBool}
                        disabled={canWrite}
                    />
                    {formData.actions[index].toHitBool && <>
                        {"\xa0To Hit Modifier:"}
                        <input
                            className='ClassPage-input-box'
                            style={{width:40}}
                            name={`actions[${index}].toHit`}
                            onChange={handleChange}
                            required
                            type="number"
                            placeholder={1}
                            defaultValue={formData.actions[index].toHit}
                            disabled={canWrite}
                        />
                    </>}
                    {!formData.actions[index].toHitBool && <>
                        {"\xa0DC Modifier:"}
                        <input
                            className='ClassPage-input-box'
                            style={{width:60}}
                            name={`actions[${index}].difficultyClass`}
                            onChange={handleChange}
                            required
                            type="text"
                            placeholder="Dex,0"
                            defaultValue={formData.actions[index].difficultyClass}
                            disabled={canWrite}
                        />
                    </>}
                    {"\xa0Action Name:"}
                    <input
                        className='ClassPage-input-box'
                        name={`actions[${index}].actionName`}
                        onChange={handleChange}
                        required
                        type="text"
                        defaultValue={formData.actions[index].actionName}
                        disabled={canWrite}
                    />
                    <button className='ClassPage-add-tag-button' onClick={() => handleAddTag(index)} disabled={canWrite}>
                        Add Tag
                    </button>
                    <button className='ClassPage-remove-action-button' onClick={() => handleRemoveAction(index)} disabled={canWrite}>
                        Remove Action
                    </button>
                    <br/>
                    Action Level:
                    <input
                        className='ClassPage-input-box'
                        style={{width:40}} 
                        name={`actions[${index}].actionLevel`}
                        onChange={handleChange}
                        required
                        type='number' min={1} max={15}
                        placeholder={1}
                        defaultValue={formData.actions[index].actionLevel}
                        disabled={canWrite}
                    />
                    {"\xa0Action Type:"}
                    <select
                        className='ClassPage-input-box'
                        name={`actions[${index}].actionType`}
                        onChange={handleChange}
                        required
                        type='dropdown'
                        defaultValue={formData.actions[index].actionType}
                        disabled={canWrite}
                    >
                        <option value="standard">Standard</option>
                        <option value="perDay">Per Day</option>
                        <option value="perShortRest">Per Short Rest</option>
                        <option value="perCombat">Per Combat</option>
                    </select>
                    {formData.actions[index].actionType !== "standard" && <input
                        className='ClassPage-input-box'
                        style={{width:30}} 
                        name={`actions[${index}].actionTypeCount`}
                        onChange={handleChange}
                        required
                        type='number' min={0}
                        placeholder={0}
                        defaultValue={formData.actions[index].actionTypeCount}
                        disabled={canWrite}
                    />}
                    <br/>
                    {areTagsVisible && formData.actions[index].tags !== undefined && formData.actions[index].tags.map((tag, tagIndex) => {
                        return <div className='ClassPage-tag-input-box' key={tagIndex} 
                        style={tag.tagColor !== undefined ? tag.textColor !== undefined ? {backgroundColor:tag.tagColor, color:tag.textColor} : {backgroundColor:tag.tagColor} : {color:tag.textColor}}>
                            Tag Information:
                            <input
                                className='ClassPage-input-box'
                                name={`actions[${index}].tags[${tagIndex}].tagInfo`}
                                onChange={handleChange}
                                required
                                type="text"
                                defaultValue={formData.actions[index].tags[tagIndex].tagInfo}
                                disabled={canWrite}
                            />
                            {"\xa0Tag Color"}
                            <input
                                className='ClassPage-input-box'
                                name={`actions[${index}].tags[${tagIndex}].tagColor`}
                                onChange={handleChange}
                                required
                                type="color"
                                defaultValue={formData.actions[index].tags[tagIndex].tagColor}
                                disabled={canWrite}
                            />
                            {"\xa0Text Color"}
                            <input
                                className='ClassPage-input-box'
                                name={`actions[${index}].tags[${tagIndex}].textColor`}
                                onChange={handleChange}
                                required
                                type="color"
                                defaultValue={formData.actions[index].tags[tagIndex].textColor}
                                disabled={canWrite}
                            />
                            {"\xa0Tag Description"}
                            <input
                                className='ClassPage-input-box'
                                style={{width:400}}
                                name={`actions[${index}].tags[${tagIndex}].tagDescription`}
                                onChange={handleChange}
                                required
                                type="text"
                                defaultValue={formData.actions[index].tags[tagIndex].tagDescription}
                                disabled={canWrite}
                            />
                            <button className='ClassPage-delete-tag-button' onClick={() => handleRemoveTag(index, tagIndex)} disabled={canWrite}>
                                Delete Tag
                            </button>
                        </div>
                    })}
                    Description:
                    <textarea
                        className='ClassPage-input-text-area'
                        name={`actions[${index}].description`}
                        onChange={handleChange}
                        required
                        type="textarea"
                        defaultValue={formData.actions[index].description}
                        disabled={canWrite}
                    />
                </div>
            })}
        </div>
        <button className='ClassPage-submit-button' type='submit' onClick={() => handleSubmit()} disabled={canWrite}>
            {location.pathname.split('/').length > 2 ? "Update Class" : "Create Class"}
        </button>
        <br/><br/>
    </div>}</>
}