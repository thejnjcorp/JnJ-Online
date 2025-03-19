import '../styles/NewCharacterPage.scss'
import { useEffect, useReducer, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../utils/firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { CharacterDiceConverter } from './CharacterStatCalculator';
import { CombatActionList } from './CombatActionList';

const formReducer = (state, event) => {
    switch(event.type) {
        case 'SET_FORM_DATA':
        return {
            ...state,
            ...event.payload,
        };
        default: 
        return {
            ...state,
            [event.name]: event.value
        }
    }
}

export function NewCharacterPage() {
    document.title = "New Character";
    const [formData, setFormData] = useReducer(formReducer, {});
    const [playerList, setPlayerList] = useState([]);
    const [classList, setClassList] = useState([]);
    const [raceList, setRaceList] = useState([]);
    const [isNewPlayerTabVisible, setIsNewPlayerTabVisible] = useState(false);
    const [newPlayerInfo, setNewPlayerInfo] = useState(null);
    const [selectedClassInfo, setSelectedClassInfo] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        getPlayerList();
        getClassList();
        getRaceList();
        // eslint-disable-next-line
    }, [location]);

    useEffect(() => {
        if (formData.class_id === ""
            || formData.race_id === ""
            || formData.strength_stat_allocated === ""
            || formData.charisma_stat_allocated === ""
            || formData.intelligence_stat_allocated === ""
            || formData.dexterity_stat_allocated === ""
            || formData.player_id === ""
            || formData.character_name === ""
            || formData.class_name
            || !formData.player_name
            || !formData.race_name) {
            return;
        }
        console.log("ready to submit!")
    },[formData])

    async function getPlayerList() {
        const players = query(collection(db, "players"), where("campaigns", "array-contains", location.pathname.split("/").at(2)));
        const querySnapshot = await getDocs(players);
        setPlayerList(querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
    }

    async function getClassList() {
        const docsSnapshot = await getDocs(collection(db, "classes"));
        setClassList(docsSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
    }

    async function getRaceList() {
        const docsSnapshot = await getDocs(collection(db, "races"));
        setRaceList(docsSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
    }

    async function handleSubmit() {
        if (formData.class_id === ""
            || formData.race_id === ""
            || formData.strength_stat_allocated === ""
            || formData.charisma_stat_allocated === ""
            || formData.intelligence_stat_allocated === ""
            || formData.dexterity_stat_allocated === ""
            || formData.player_id === "") {
            return alert("invalid form values");
        }
        
        const classData = classList.filter(individualClass => individualClass.id === formData.class_id)?.at(0);
        if (!classData) return alert("invalid class found!");
        delete classData.id;
        delete classData.canWrite;
        classData.class_description = classData.description;
        delete classData.description;
        const playerData = playerList.filter(player => player.id === formData.player_id)?.at(0);
        if (!playerData) return alert("invalid player found!");
        const raceData = raceList.filter(race => race.id === formData.race_id)?.at(0);
        delete raceData.canWrite;
        if (!raceData) return alert("invalid race found!");

        const newData = classData;
        newData.race_name = raceData.name;
        newData.actions = newData.actions.concat(raceData.feat);
        newData.player_name = playerData.player_name;
        const finalData = {
            ...formData,
            ...newData
        }
        console.log(finalData)

        //const docRef = await addDoc(collection(db, "characters"), {
        //    ...formData,
        //    ...newData
        //});
        //navigate(docRef.id);
    }

    async function handlePlayerSubmit() {
        if (!newPlayerInfo) return alert("no name provided!");

        const docRef = await addDoc(collection(db, "players"), { player_name: newPlayerInfo, campaigns: [location.pathname.split("/").at(2)] });
        setPlayerList(playerList.concat({id: docRef.id, campaigns: [location.pathname.split("/").at(2)], player_name: newPlayerInfo }));
        setIsNewPlayerTabVisible(false);
        alert("Successfully added new player");
    }

    const handleChange = event => {
        const value = event.target.type === 'number' ? Number(event.target.value) : event.target.value;

        setFormData({
            name: event.target.name,
            value: value
        });
    }

    const handleAddPlayer = function() {
        setIsNewPlayerTabVisible(true);
    }

    const handleNewPlayerChange = event => {
        setNewPlayerInfo(event.target.value);
    }

    return <div className="NewCharacterPage">
        <div className='NewCharacterPage-input'>
            Character Name:
            <input 
                className='NewCharacterPage-input-box' 
                name="character_name" 
                type="text"
                onChange={handleChange}
                required
            />
        </div>
        <div className='NewCharacterPage-input'>
            Player:
            <select 
                className='NewCharacterPage-input-box' 
                name="player_id" 
                type="text"
                onChange={handleChange}
                required
            >
                <option hidden></option>
                {playerList.map((player) => {
                    return <option key={player.id} value={player.id}>{player.player_name}</option>
                })}
            </select>
            <button className='NewCharacterPage-add-player-button' onClick={() => handleAddPlayer()}>
                Add Player
            </button>
            {isNewPlayerTabVisible && <div className='NewCharacterPage-input'>
                New Player Name:
                <input 
                    className='NewCharacterPage-input-box' 
                    name="player_name" 
                    type="text"
                    onChange={handleNewPlayerChange}
                    required
                />
                <button className='NewCharacterPage-submit-button' type='submit' onClick={() => handlePlayerSubmit()}>
                    Add Player
                </button>
            </div>}
        </div>
        <div className='NewCharacterPage-input'>
            {"Ability Point Allocation: (+4, +3, +2, +1 or +3, +3, +2, +2)"}<br/>
            Strength:
            <input 
                className='NewCharacterPage-input-box' 
                name="strength_stat_allocated" 
                type="number" min={0} max={4} // 10 points total
                onChange={handleChange}
                required
                placeholder={0}
                style={{width: 30}}
            />{"\xa0\xa0"}
            Dexterity:
            <input 
                className='NewCharacterPage-input-box' 
                name="dexterity_stat_allocated" 
                type="number" min={0} max={4}
                onChange={handleChange}
                required
                placeholder={0}
                style={{width: 30}}
            />{"\xa0\xa0"}
            Intelligence:
            <input 
                className='NewCharacterPage-input-box' 
                name="intelligence_stat_allocated" 
                type="number" min={0} max={4}
                onChange={handleChange}
                required
                placeholder={0}
                style={{width: 30}}
            />{"\xa0\xa0"}
            Charisma:
            <input 
                className='NewCharacterPage-input-box' 
                name="charisma_stat_allocated" 
                type="number" min={0} max={4}
                onChange={handleChange}
                required
                placeholder={0}
                style={{width: 30}}
            />
        </div>
        <div className='NewCharacterPage-input'>
            Race:
            <select 
                className='NewCharacterPage-input-box' 
                name="race_id" 
                type="text"
                onChange={handleChange}
                required
            >
                <option hidden></option>
                {raceList.map((race) => {
                    return <option key={race.id} value={race.id}>{race.name}</option>
                })}
            </select>
        </div>
        {formData.race_id && formData.class_id && selectedClassInfo && <div className='NewCharacterPage-actions'>
            <CombatActionList 
                key={"race-feats"}
                actions={[raceList.filter(race => race.id === formData.race_id)?.at(0).feat]}
                experience_points={0}
                baseArmorClass={parseInt(selectedClassInfo.base_armor_class)}
                baseHitModifier={parseInt(selectedClassInfo.base_hit_modifier)}
                baseDamageModifier={parseInt(selectedClassInfo.base_damage_modifier)}
                baseDamageDice={parseInt(selectedClassInfo.base_damage_dice)}
                baseDamageDiceType={parseInt(selectedClassInfo.base_damage_dice_type)}
                baseHealingDiceType={parseInt(selectedClassInfo.base_healing_dice_type)}
            />
        </div>}
        <div className='NewCharacterPage-input'>
            Class:
            <select 
                className='NewCharacterPage-input-box' 
                name="class_id" 
                type="text"
                onChange={handleChange}
                required
            >
                <option hidden></option>
                {classList.map((individualClass) => {
                    return <option key={individualClass.id} value={individualClass.id}>{individualClass.class_name}</option>
                })}
            </select>
        </div>
        {formData.class_id && <div>
            <button className='NewCharacterPage-submit-button' 
            onClick={() => setSelectedClassInfo(classList.filter(individualClass => individualClass.id === formData.class_id).at(0))}>View Class Info</button>
            {selectedClassInfo && <><br/>
                {selectedClassInfo.class_name}:<br/>
                {selectedClassInfo.class_type}<br/>
                {"Author: " + selectedClassInfo.author}<br/>
                {"Base AC: " + selectedClassInfo.base_armor_class}
                {"\xa0\xa0Base Hardness: " + selectedClassInfo.base_hardness}<br/>
                {"+" + selectedClassInfo.base_hit_modifier + " to Hit"}
                {"\xa0\xa0Base DC: " + selectedClassInfo.base_class_damage_class}<br/>
                {`Base Melee Damage: \
                ${selectedClassInfo.base_melee_damage_dice}${CharacterDiceConverter(selectedClassInfo.base_melee_damage_dice_type)}+${selectedClassInfo.base_melee_damage_modifier} \
                ${selectedClassInfo.base_melee_damage_type}`}<br/>
                {`Base Ranged Damage: \
                ${selectedClassInfo.base_ranged_damage_dice}${CharacterDiceConverter(selectedClassInfo.base_ranged_damage_dice_type)}+${selectedClassInfo.base_ranged_damage_modifier} \
                ${selectedClassInfo.base_ranged_damage_type}`}<br/>
                {"Base Healing Dice Type: " + CharacterDiceConverter(selectedClassInfo.base_healing_dice_type)}<br/>
                <br/>Description:<br/>
                <div style={{whiteSpace: "pre-wrap"}}>{selectedClassInfo.description}</div>
                <br/>Actions:
                {<div className='NewCharacterPage-actions'>
                    <CombatActionList 
                        key={"class-actions"}
                        actions={selectedClassInfo.actions}
                        experience_points={0}
                        baseArmorClass={parseInt(selectedClassInfo.base_armor_class)}
                        baseHitModifier={parseInt(selectedClassInfo.base_hit_modifier)}
                        baseDamageModifier={parseInt(selectedClassInfo.base_damage_modifier)}
                        baseDamageDice={parseInt(selectedClassInfo.base_damage_dice)}
                        baseDamageDiceType={parseInt(selectedClassInfo.base_damage_dice_type)}
                        baseHealingDiceType={parseInt(selectedClassInfo.base_healing_dice_type)}
                    />
                </div>}
            </>}
        </div>}
        <button className='NewCharacterPage-submit-button' type='submit' onClick={() => handleSubmit()}>
            Create Character
        </button>
        <br/><br/>
    </div>
}