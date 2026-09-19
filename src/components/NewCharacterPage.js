import '../styles/NewCharacterPage.scss'
import { useEffect, useReducer, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db, auth } from '../utils/firebase';
import { collection, addDoc, getDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from "firebase/auth";
import { CharacterDiceConverter } from './CharacterStatCalculator';
import { CombatActionList } from './CombatActionList';
import { newCharacterFormReducer } from '../utils/newCharacterFormReducer';
import { raceActionsOf } from '../utils/characterClass';
import { loadAvailableClasses, loadAvailableRaces } from '../utils/availableOptions';
import Markdown from 'markdown-to-jsx';

export const formReducer = newCharacterFormReducer;

export function NewCharacterPage() {
    document.title = "New Character";
    const [formData, setFormData] = useReducer(formReducer, {});
    const [playerInfo, setPlayerInfo] = useState([]);
    const [classList, setClassList] = useState([]);
    const [raceList, setRaceList] = useState([]);
    const [selectedClassInfo, setSelectedClassInfo] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) return;
            getPlayerInfo(user);
            getClassList(user.uid);
            getRaceList(user.uid);
            unsubscribe();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    async function getClassList(uid) {
        try {
            setClassList(await loadAvailableClasses(uid, location.pathname.split("/").at(2)));
        } catch(e) {
            console.log("Failed to get Class list: " + e)
        }
    }

    async function getRaceList(uid) {
        try {
            setRaceList(await loadAvailableRaces(uid, location.pathname.split("/").at(2)));
        } catch(e) {
            console.log("Failed to get Race list: " + e)
        }
    }

    async function getPlayerInfo(user) {
        if (user?.uid === undefined) return;
        try {
            const docSnap = await getDoc(doc(db, "players", user.uid));
            setPlayerInfo({name: docSnap.data().name, uid: user.uid});

        } catch (e) {
            console.log("Failed to get player info: " + e)
        }
    }

    async function getMembersOfCampaign() {
        try {
            const docSnap = await getDoc(doc(db, "campaigns", location.pathname.split("/").at(2)));
            return docSnap.data();
        } catch (e) {
            console.log("Failed to get campaign info: " + e)
        }
    }

    async function handleSubmit() {
        if (formData.class_id === ""
            || formData.race_id === ""
            || formData.strength_stat_allocated === ""
            || formData.charisma_stat_allocated === ""
            || formData.intelligence_stat_allocated === ""
            || formData.dexterity_stat_allocated === "") {
            return alert("invalid form values");
        }
        
        const selectedClass = classList.find(individualClass => individualClass.id === formData.class_id);
        if (!selectedClass) return alert("invalid class found!");
        const raceData = raceList.find(race => race.id === formData.race_id);
        if (!raceData) return alert("invalid race found!");

        // The character reads its class live from the class it's pinned to
        // (class_id + class_version - see useClassVersion.js), so what's
        // copied here is only the saved copy it falls back to when that class
        // can't be read. Class-level bookkeeping (id, permissions, visibility,
        // version metadata) stays on the class. The race's actions are kept in
        // their own field rather than merged into `actions`, so a live class
        // can replace `actions` without dropping them.
        const { id, canWrite, description, public: isPublic, isDefault, visibility, version, versionNotes, publishedAt, ...classFields } = selectedClass;
        const newData = {
            ...classFields,
            class_description: description,
            class_version: version ?? 1,
            actions: classFields.actions || [],
        };
        newData.race_name = raceData.name;
        newData.race_version = raceData.version ?? 1;
        newData.race_actions = raceActionsOf(raceData);
        newData.player_name = playerInfo.name;
        newData.playerId = playerInfo.uid;
        newData.admins = [playerInfo.uid];
        const membersOfCampaign = await getMembersOfCampaign();
        newData.canWrite = [playerInfo.uid].concat(membersOfCampaign.canWrite);
        newData.canRead = membersOfCampaign.canRead
        newData.campaign = location.pathname.split("/").at(2)
        const finalData = {
            ...formData,
            ...newData
        }

        finalData.strength_stat = finalData.strength_stat_allocated
        finalData.dexterity_stat = finalData.dexterity_stat_allocated
        finalData.intelligence_stat = finalData.intelligence_stat_allocated
        finalData.charisma_stat = finalData.charisma_stat_allocated
        delete finalData.strength_stat_allocated
        delete finalData.dexterity_stat_allocated
        delete finalData.intelligence_stat_allocated
        delete finalData.charisma_stat_allocated

        finalData.skills_and_flaws = []

        finalData.inventory = []
        finalData.inventory_pocket = []
        finalData.trading_metadata ={}
        // console.log(finalData)

        console.log("Creating new Character:")
        const docRef = await addDoc(collection(db, "characters"), {
            ...finalData
        });
        console.log("New character Created!")
        navigate("/characters/" + docRef.id);
    }

    const handleChange = event => {
        const value = event.target.type === 'number' ? Number(event.target.value) : event.target.value;

        setFormData({
            name: event.target.name,
            value: value
        });
    }

    return <div className="NewCharacterPage">
        <div className='NewCharacterPage-input'>
            Character Name:{' '}
            <input
                className='NewCharacterPage-input-box' 
                name="character_name" 
                type="text"
                onChange={handleChange}
                required
            />
        </div>
        <div className='NewCharacterPage-input'>
            Player: {playerInfo?.name}<br/>
            UID: {playerInfo?.uid}
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
            Race:{' '}
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
        {formData.race_id && formData.class_id && selectedClassInfo && raceActionsOf(raceList.find(race => race.id === formData.race_id)).length > 0 && <div className='NewCharacterPage-actions'>
            <CombatActionList 
                key={"race-feats"}
                actions={raceActionsOf(raceList.find(race => race.id === formData.race_id))}
                experience_points={0}
                baseArmorClass={Number.parseInt(selectedClassInfo.base_armor_class)}
                baseHitModifier={Number.parseInt(selectedClassInfo.base_hit_modifier)}
                baseDamageModifier={Number.parseInt(selectedClassInfo.base_damage_modifier)}
                baseDamageDice={Number.parseInt(selectedClassInfo.base_damage_dice)}
                baseDamageDiceType={Number.parseInt(selectedClassInfo.base_damage_dice_type)}
                baseHealingDiceType={Number.parseInt(selectedClassInfo.base_healing_dice_type)}
            />
        </div>}
        <div className='NewCharacterPage-input'>
            Class:{' '}
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
            <button type="button" className='NewCharacterPage-submit-button' 
            onClick={() => setSelectedClassInfo(classList.find(individualClass => individualClass.id === formData.class_id))}>View Class Info</button>
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
                <div className="NewCharacterPage-class-description"><Markdown options={{ disableParsingRawHTML: true }}>{selectedClassInfo.description || ""}</Markdown></div>
                <br/>Actions:
                {<div className='NewCharacterPage-actions'>
                    <CombatActionList 
                        key={"class-actions"}
                        actions={selectedClassInfo.actions}
                        experience_points={0}
                        baseArmorClass={Number.parseInt(selectedClassInfo.base_armor_class)}
                        baseHitModifier={Number.parseInt(selectedClassInfo.base_hit_modifier)}
                        baseDamageModifier={Number.parseInt(selectedClassInfo.base_damage_modifier)}
                        baseDamageDice={Number.parseInt(selectedClassInfo.base_damage_dice)}
                        baseDamageDiceType={Number.parseInt(selectedClassInfo.base_damage_dice_type)}
                        baseHealingDiceType={Number.parseInt(selectedClassInfo.base_healing_dice_type)}
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