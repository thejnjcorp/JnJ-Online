import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { db } from "../utils/firebase";
import { getDocs, query, collection } from "firebase/firestore";
import '../styles/ClassListPage.scss';

export function ClassListPage() {
    const [classList, setClassList] = useState([]);
    const [filterClasses, setFilterClasses] = useState("all");
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
        <button onClick={() => setFilterClasses("all")} className="ClassListPage-selector-button" disabled={filterClasses === "all"}>
            All
        </button>
        <button onClick={() => setFilterClasses("Attrionist")} className="ClassListPage-selector-button" disabled={filterClasses === "Attrionist"}>
            Attrionists
        </button>
        <button onClick={() => setFilterClasses("Crit Hunter")} className="ClassListPage-selector-button" disabled={filterClasses === "Crit Hunter"}>
            Crit Hunters
        </button>
        <button onClick={() => setFilterClasses("Manipulator")} className="ClassListPage-selector-button" disabled={filterClasses === "Manipulator"}>
            Manipulators
        </button>
        <button onClick={() => setFilterClasses("Snowballer")} className="ClassListPage-selector-button" disabled={filterClasses === "Snowballer"}>
            Snowballers
        </button>
        <br/>
        {classList.filter(individualClass => {
            if (filterClasses === "all") return true;
            if (filterClasses === individualClass.class_type) return true;
            return false;
        }).map((individualClass, index) =>
            <button className='ClassListPage-class-card' key={index} onClick={() => handleCharacterCardSelect(individualClass)}>
                Class: {individualClass.class_name}<br/>
                <div className="ClassListPage-class-card-small-text">
                    By {individualClass.author}<br/>
                    Class Type: {individualClass.class_type}<br/>
                    <div className="ClassListPage-class-card-description">{individualClass.description}</div>
                </div>
            </button>
        )}<br/>
        <button className="ClassListPage-class-card" onClick={() => navigate("/classes")}>
            Create New Class
        </button>
    </div>
}