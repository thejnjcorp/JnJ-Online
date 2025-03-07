import '../styles/NewCharacterPage.scss'
import { useEffect, useReducer, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../utils/firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';

const formReducer = (state, event) => {
    return {
        ...state,
        [event.name]: event.value
    }
}

export function NewCharacterPage() {
    document.title = "New Character";
    const [formData, setFormData] = useReducer(formReducer, {});
    const [playerList, setPlayerList] = useState([]);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        getPlayerList();
        // eslint-disable-next-line
    }, [location])

    async function getPlayerList() {
        const players = query(collection(db, "players"), where("campaigns", "array-contains", location.pathname.split("/").at(2)));
        const querySnapshot = await getDocs(players);
        setPlayerList(querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()})));
    }

    async function handleSubmit() {
        if (!formData.campaign_name || !formData.director_name) {
            return alert("invalid form values");
        }
        
        const docRef = await addDoc(collection(db, "characters"), formData);
        navigate(docRef.id);
    }

    const handleChange = event => {
        setFormData({
            name: event.target.name,
            value: event.target.value
        });
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
                name="player_name" 
                type="text"
                onChange={handleChange}
                required
            >
                {playerList.map((player) => {
                    return <option key={player.id} value={player.id}>{player.player_name}</option>
                })}
            </select>
            <button>
                Add Player
            </button>
        </div>
        <button className='NewCharacterPage-submit-button' type='submit' onClick={() => handleSubmit()}>
            Create Character
        </button>
    </div>
}