import { useReducer, useState, useEffect, useRef } from 'react';
import { auth, db } from '../utils/firebase';
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
    document.title = "New Campaign";
    const [formData, setFormData] = useReducer(formReducer, {});
    const [userInfo, setUserInfo] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    // A second click can fire before React re-renders the button's
    // disabled={submitting} state - that gap is exactly how two "test
    // campaign 2" documents got created from one attempt (addDoc has no
    // natural de-dup, unlike arrayUnion/arrayRemove elsewhere in this app).
    // A ref closes it because refs mutate synchronously, unlike state.
    const submittingRef = useRef(false);
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
            setUserInfo({ ...docSnapPlayer.data(), uid: user.uid });
        } catch(e) {
            console.log("Failed to get user info: " + e)
        }
    }

    async function handleSubmit() {
        if (!formData.campaign_name?.trim()) {
            return alert("Give your campaign a name first.");
        }

        if (userInfo?.uid === undefined) {
            return alert("You need to be logged in to use this feature!");
        }

        if (submittingRef.current) return;
        submittingRef.current = true;
        setSubmitting(true);
        try {
            const docRef = await addDoc(collection(db, "campaigns"), {
                ...formData,
                director_name: userInfo.name,
                director_uid: userInfo.uid,
                canWrite: [auth.currentUser.uid],
                admins: [auth.currentUser.uid]
            });
            // Must be absolute: Campaigns.js renders NewCampaignPage from a
            // manual location.pathname check rather than a nested <Route>, so
            // a bare relative segment resolves against the current
            // "/campaigns/new" path and produces "/campaigns/new/{id}" -
            // which CampaignPage.js then misreads as campaignId "new" and
            // gets a permission-denied trying to read that nonexistent
            // document. This is the actual bug behind this session's
            // "campaign creation" error: the create always succeeded, only
            // the post-create navigation was broken.
            navigate("/campaigns/" + docRef.id);
        } catch (e) {
            alert(e);
            submittingRef.current = false;
            setSubmitting(false);
        }
    }

    const handleChange = event => {
        setFormData({
            name: event.target.name,
            value: event.target.value
        });
    }

    return <div className='NewCampaignPage'>
        <h1 className="NewCampaignPage-title">New Campaign</h1>

        <label className='NewCampaignPage-field'>
            <span className="NewCampaignPage-label">Campaign Name</span>
            <input
                className='NewCampaignPage-input'
                name="campaign_name"
                type="text"
                value={formData.campaign_name || ""}
                onChange={handleChange}
                placeholder="The Sunken Archive"
                required
                autoFocus
            />
        </label>

        <div className='NewCampaignPage-field'>
            <span className="NewCampaignPage-label">Director</span>
            <span className="NewCampaignPage-director-name">{userInfo?.name || "…"}</span>
        </div>

        <button
            className='NewCampaignPage-submit-button'
            type='submit'
            onClick={() => handleSubmit()}
            disabled={submitting || !formData.campaign_name?.trim()}
        >
            {submitting ? "Creating…" : "Create Campaign"}
        </button>
    </div>
}
