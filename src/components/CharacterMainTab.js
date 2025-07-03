import { CombatActionList } from "./CombatActionList";
import DraggableLayout from "react-draggable-layout";
import { PostListContent } from "../utils/DraggableElements/PostListContent.tsx";
import Collapsible from "react-collapsible";
import TextareaAutosize from "react-textarea-autosize";
import starIcon from '../icons/star.svg';
import starFilledIcon from '../icons/star_filled.svg';
import '../styles/CharacterMainTab.scss';
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import { useRef, useState, useEffect } from "react";
import { TabContainer } from "./TabContainer.js";

export function CharacterMainTab({ characterPage, setCharacterPage, userId }) {
    const hasWritePermissions = userId ? (characterPage.userId === userId || characterPage.canWrite.includes(userId)) : false;
    const debounceRef = useRef({});
    const [localValues, setLocalValues] = useState({
        description: characterPage.description ? characterPage.description : characterPage.class_description,
        notes: characterPage.notes ? characterPage.notes : ""
    });

    useEffect(() => {
        setLocalValues({
            description: characterPage.description ? characterPage.description : characterPage.class_description,
            notes: characterPage.notes ? characterPage.notes : ""
        });
    }, [
        characterPage.description,
        characterPage.class_description,
        characterPage.notes
    ]);

    const handleChange = event => {
        const { name, type, value } = event.target;
        const parsedValue = type === 'number' && value !== '' ? Number(value) : value;

        setLocalValues(prev => ({
            ...prev,
            [name]: value
        }));

        if (debounceRef.current[name]) {
            clearTimeout(debounceRef.current[name]);
        }
        debounceRef.current[name] = setTimeout(() => {
            if (value !== '') {
                updateDoc(doc(db, "characters", characterPage.character_id), {
                    [name]: parsedValue
                }).catch(e => {
                    alert(e);
                });
            }
        }, 1000);
    };

    function isPassive(action) {
        return action.tags !== undefined && action.tags.some(tag => tag.tagInfo === "Passive")
    }

    function setActionPoints(actionPoints) {
        try {
            updateDoc(doc(db, "characters", characterPage.character_id), {
                action_points: actionPoints
            });
        } catch (e) {
            alert(e);
        }
    }

    function generateDraggableInventory(inventory) {
        return inventory.map((item, key) => {
            return { col: item.colNum, id: key, component: <Collapsible 
                className="CharacterMainTab-inventory-item"
                openedClassName="CharacterMainTab-inventory-item-opened"
                contentInnerClassName="CharacterMainTab-inventory-item-description"
                contentOuterClassName="CharacterMainTab-inventory-item-description"
                trigger={item.itemName}
            >
                <p>
                    {item.description}
                </p>
            </Collapsible> };
        })
    }

    const handleDragItemChange = (c) => {
        // console.log("onChange()", c);
        const newMapping = c.map(item => {
            return {
                itemName: item.component.props.trigger,
                description: item.component.props.children.props.children,
                colNum: item.col
            }
        });
        setCharacterPage(prevState => ({
            ...prevState,
            inventory: [...prevState.inventory, newMapping]
        }));
    }

    const handleNewItem = () => {
        // finish this later
    }
    
    const tabs = [
        {
            tabName: "Roleplay Mode",
            content: <>
            <div className="CharacterMainTab-background">
                <h2>Background:</h2>
                <TextareaAutosize
                    className="CharacterMainTab-background-description"
                    minRows={3}
                    value={localValues.description}
                    name="description"
                    disabled={!hasWritePermissions}
                    onChange={handleChange}
                />
            </div>
            <div className="CharacterMainTab-notes">
                <h2>Notes:</h2>
                <TextareaAutosize
                    className="CharacterMainTab-notes-description"
                    minRows={3}
                    value={localValues.notes}
                    name="notes"
                    disabled={!hasWritePermissions}
                    onChange={handleChange}
                />
            </div>
            </>
        },
        {
            tabName: "Combat Mode",
            content: <>
                
                <div className="CharacterMainTab-action-points">
                    Action Points:{"\xa0\xa0\xa0"}
                    {characterPage.action_points > 0 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(1) : undefined}/> :
                    <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(1) : undefined}/>}
                    {characterPage.action_points > 1 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(2) : undefined}/> :
                    <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(2) : undefined}/>}
                    {characterPage.action_points > 2 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(3) : undefined}/> :
                    <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(3) : undefined}/>}
                    {characterPage.action_points > 3 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(4) : undefined}/> :
                    <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={hasWritePermissions ? () => setActionPoints(4) : undefined}/>}
                </div>
                <div className="CharacterMainTab-action-body">
                    <span className="CharacterMainTab-header-left-align">Passives:</span>
                    <CombatActionList 
                        actions={characterPage.actions.filter(action => isPassive(action))}
                        experience_points={characterPage.experience_points}
                        baseArmorClass={characterPage.base_armor_class}
                        baseHitModifier={characterPage.base_hit_modifier}
                        baseDamageModifier={characterPage.base_damage_modifier}
                        baseDamageDice={characterPage.base_damage_dice}
                        baseDamageDiceType={characterPage.base_damage_dice_type}
                        baseHealingDiceType={characterPage.base_healing_dice_type}
                        canUseActions={false}
                        characterPage={characterPage}
                    />
                    <span className="CharacterMainTab-header-left-align">Available Actions:</span>
                    <CombatActionList 
                        actions={characterPage.actions.filter(action => action.actionCost <= characterPage.action_points).filter(action => !isPassive(action))}
                        experience_points={characterPage.experience_points}
                        baseArmorClass={characterPage.base_armor_class}
                        baseHitModifier={characterPage.base_hit_modifier}
                        baseDamageModifier={characterPage.base_damage_modifier}
                        baseDamageDice={characterPage.base_damage_dice}
                        baseDamageDiceType={characterPage.base_damage_dice_type}
                        baseHealingDiceType={characterPage.base_healing_dice_type}
                        canUseActions={true}
                        characterPage={characterPage}
                        userId={userId}
                    />
                    <span className="CharacterMainTab-header-left-align">Unavailable Actions:</span>
                    <CombatActionList 
                        actions={characterPage.actions.filter(action => action.actionCost > characterPage.action_points)}
                        experience_points={characterPage.experience_points}
                        baseArmorClass={characterPage.base_armor_class}
                        baseHitModifier={characterPage.base_hit_modifier}
                        baseDamageModifier={characterPage.base_damage_modifier}
                        baseDamageDice={characterPage.base_damage_dice}
                        baseDamageDiceType={characterPage.base_damage_dice_type}
                        baseHealingDiceType={characterPage.base_healing_dice_type}
                    />
                </div>
            </>
        },
        {
            tabName: "Inventory",
            content: <>
                <DraggableLayout components={generateDraggableInventory(characterPage.inventory)} columns={3} mainColumnIndex={-1} onChange={handleDragItemChange} draggable={true} />
                <div className='CharacterMainTab-inventory-item' onClick={handleNewItem}>Add Item</div>
            </>
        },
        {
            tabName: "Combat Map",
            content: <div className="CharacterMainTab-combat-map">
                <PostListContent inputStatuses={["Zone 0", "Zone 1", "Zone 2", "Special Zone"]}/>
            </div>
        }
    ];

    return <TabContainer tabs={tabs}/>
}