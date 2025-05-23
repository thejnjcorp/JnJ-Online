import { useReducer } from 'react';
import { auth, db } from '../utils/firebase';
import { useState, useEffect } from 'react';
import { collection, addDoc, getDoc, doc } from 'firebase/firestore';
import '../styles/NewCampaignPage.scss';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';

const formReducer = (state, event) => {
    if(event.reset) {
        return {
            campaign_name: '',
        }
    }
    return {
        ...state,
        [event.name]: event.value
    }
}

export function NewCampaignPage() {
    const [formData, setFormData] = useReducer(formReducer, {});
    const [userInfo, setUserInfo] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) return;
            getUserInfo(user);
            unsubscribe();
        });
    },[])

    async function getUserInfo(user) {
            if (user?.uid === undefined) return;
            try {
                const docSnapPlayer = await getDoc(doc(db, "players", user.uid));
                const docAccountInfo = {
                    ...docSnapPlayer.data()
                }
                setUserInfo(docAccountInfo);
            } catch(e) {
                console.log("Failed to get user info: " + e)
            }
        }

    async function handleSubmit() {
        if (!formData.campaign_name) {
            return alert("invalid form values");
        }

        if (userInfo?.uid === undefined) {
            return alert("You need to be logged in to use this feature!");
        }
        
        const docRef = await addDoc(collection(db, "campaigns"), {
            ...formData, 
            director_name: userInfo.name,
            director_uid: userInfo.uid,
            canWrite: [auth.currentUser.uid]
        });
        navigate(docRef.id);
    }

    const handleChange = event => {
        setFormData({
            name: event.target.name,
            value: event.target.value
        });
    }

    return <div className='NewCampaignPage'>
        <div className='NewCampaignPage-input'>
            Campaign Name:
            <input 
                className='NewCampaignPage-input-box' 
                name="campaign_name" 
                type="text"
                onChange={handleChange}
                required
            />
        </div>
        <div className='NewCampaignPage-input'>
            Director: { userInfo?.name }
        </div>
        <button className='NewCampaignPage-submit-button' type='submit' onClick={() => handleSubmit()}>
            Create Campaign
        </button>
    </div>
}