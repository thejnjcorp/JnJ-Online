import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { db } from "../utils/firebase";
import { getDocs, query, collection } from "firebase/firestore";
import '../styles/ClassListPage.scss';

export function ClassListPage() {
    const [classList, setClassList] = useState([]);
    const navigate = useNavigate();
    const location = useLocation();
    document.title = "Class List";

    const getClassList = async() => {
        const characters = query(collection(db, "classes"));
        const querySnapshot = await getDocs(characters);
        setClassList(querySnapshot.docs.map(doc => ({
            id: doc.id, 
            class_name: doc.data().class_name, 
            class_type: doc.data().class_type, 
            author: doc.data().author, 
            description: doc.data().description
        })));
    }

    useEffect(() => {
        getClassList();
        // eslint-disable-next-line
    },[location]);

    function handleCharacterCardSelect(individualClass) {
        navigate("/classes/" + individualClass.id)
    }

    return <div className="ClassListPage">
        <div className="ClassListPage-title">
            Classes:
        </div>
        {classList.map((individualClass, index) =>
        <button className='ClassListPage-class-card' key={index} onClick={() => handleCharacterCardSelect(individualClass)}>
                Class: {individualClass.class_name}<br/>
                <div className="ClassListPage-class-card-small-text">
                    By {individualClass.author}<br/>
                    Class Type: {individualClass.class_type}<br/>
                    <div className="ClassListPage-class-card-description">{individualClass.description}</div>
                </div>
            </button>
        )}
    </div>
}