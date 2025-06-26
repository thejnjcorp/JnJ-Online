import { useState, useEffect } from "react";
import { auth, db } from '../utils/firebase';
import { collection, where, getDoc, doc, getDocs, query, or } from 'firebase/firestore';
import { onAuthStateChanged } from "firebase/auth";

export function AccountPage({userInfo, setUserInfo}) {
    const [accountInfo, setAccountInfo] = useState([]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) return;
            getAccountInfo(user);
            unsubscribe();
        });
        // eslint-disable-next-line
    },[]);

    async function getAccountInfo(user) {
        if (user?.uid === undefined) return;
        try {
            const docSnapPlayer = await getDoc(doc(db, "players", user.uid));
            const docSnapCampaigns = await getCampaigns(user);
            const docSnapCharacters = await getCharacters(user);
            const docAccountInfo = {
                ...docSnapPlayer.data(),
                campaigns: docSnapCampaigns,
                characters: docSnapCharacters
            }
            setAccountInfo(docAccountInfo);
            console.log(docAccountInfo)
        } catch(e) {
            console.log("Failed to get account info: " + e)
        }
    }

    async function getCampaigns(user) {
        try {
           const campaigns = query(collection(db, "campaigns"), or(where("canRead", "array-contains", user.uid), where("canWrite", "array-contains", user.uid)));
            const querySnapshot = await getDocs(campaigns);
            return querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()})); 
        } catch (e) {
            console.log("Failed to get campaign info: " + e)
        }
    }

    async function getCharacters(user) {
        try {
            const characters = query(collection(db, "characters"), where("playerId", "==", user.uid));
            const querySnapshot = await getDocs(characters);
            return querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
        } catch (e) {
            console.log("Failed to get character info: " + e)
        }
    }

    return <div>
        <h1>Account</h1>
        Display Name: {accountInfo?.name}<br/>
        UID: {userInfo?.uid}<br/>
        Email: {userInfo?.email}<br/>
        <h2>Characters</h2>
        {accountInfo?.characters?.length !== 0 && accountInfo?.characters?.map((character, index) => 
            <div key={index}>
                Character Name: {character?.character_name}<br/>
                Class: {character?.class_name}<br/>
                Campaign: {character?.campaign}<br/>
            </div>
        )}
        {!(accountInfo?.characters?.length !== 0) && "No Characters Found"}
        <h2>Campaigns</h2>
        {accountInfo?.campaigns?.length !== 0 && accountInfo?.campaigns?.map((campaign, index) => 
            <div key={index}>
                Campaign: {campaign?.campaign_name}<br/>
                Director: {campaign?.director_name}<br/>
            </div>
        )}
        {!(accountInfo?.characters?.length !== 0) && "No Campaigns Found"}
    </div>
}