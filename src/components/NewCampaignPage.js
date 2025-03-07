import { useReducer } from 'react';
import { db } from '../utils/firebase';
import { collection, addDoc } from 'firebase/firestore';
import '../styles/NewCampaignPage.scss';
import { useNavigate } from 'react-router-dom';

const formReducer = (state, event) => {
    if(event.reset) {
        return {
            campaign_name: '',
            director_name: ''
        }
    }
    return {
        ...state,
        [event.name]: event.value
    }
}

export function NewCampaignPage() {
    const [formData, setFormData] = useReducer(formReducer, {});
    const navigate = useNavigate();

    async function handleSubmit() {
        if (!formData.campaign_name || !formData.director_name) {
            return alert("invalid form values");
        }
        
        const docRef = await addDoc(collection(db, "campaigns"), formData);
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
            Director:
            <input 
                className='NewCampaignPage-input-box' 
                name="director_name" 
                type="text"
                onChange={handleChange}
                required
            />
        </div>
        <button className='NewCampaignPage-submit-button' type='submit' onClick={() => handleSubmit()}>
            Create Campaign
        </button>
    </div>
}