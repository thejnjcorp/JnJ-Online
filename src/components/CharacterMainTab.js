import { CombatActionList } from "./CombatActionList";
import DraggableLayout from "react-draggable-layout";
import Collapsible from "react-collapsible";
import starIcon from '../icons/star.svg';
import starFilledIcon from '../icons/star_filled.svg';
import '../styles/CharacterMainTab.scss';

export function CharacterMainTab(characterPage, setCharacterPage) {
    function setActionPoints(actionPoints) {
        setCharacterPage(prevState => ({
            ...prevState,
            action_points: actionPoints
        }));
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
    
    return [
        {
            tabName: "Roleplay Mode",
            content: <>
            <div className="CharacterMainTab-background">
                <h2>Background:</h2>
                {characterPage.class_description}
            </div>
            </>
        },
        {
            tabName: "Combat Mode",
            content: <>
                
                <div className="CharacterMainTab-action-points">
                    Action Points:{"\xa0\xa0\xa0"}
                    {characterPage.action_points > 0 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={() => setActionPoints(1)}/> :
                    <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={() => setActionPoints(1)}/>}
                    {characterPage.action_points > 1 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={() => setActionPoints(2)}/> :
                    <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={() => setActionPoints(2)}/>}
                    {characterPage.action_points > 2 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={() => setActionPoints(3)}/> :
                    <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={() => setActionPoints(3)}/>}
                    {characterPage.action_points > 3 ? <img src={starFilledIcon} alt='starFilled' className="CharacterMainTab-star" width={30} onClick={() => setActionPoints(4)}/> :
                    <img src={starIcon} alt='star' className="CharacterMainTab-star" width={30} onClick={() => setActionPoints(4)}/>}
                </div>
                <div className="CharacterMainTab-action-body">
                    <span className="CharacterMainTab-header-left-align">Available Actions:</span>
                    <CombatActionList 
                        actions={characterPage.actions.filter(action => action.actionCost <= characterPage.action_points)}
                        experience_points={characterPage.experience_points}
                        baseArmorClass={characterPage.base_armor_class}
                        baseHitModifier={characterPage.base_hit_modifier}
                        baseDamageModifier={characterPage.base_damage_modifier}
                        baseDamageDice={characterPage.base_damage_dice}
                        baseDamageDiceType={characterPage.base_damage_dice_type}
                        baseHealingDiceType={characterPage.base_healing_dice_type}
                        canUseActions={true}
                        characterPage={characterPage}
                        setCharacterPage={setCharacterPage}
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
        }
    ]
}