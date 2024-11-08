import React from "react";
import { Link } from "react-router-dom";
import '../styles/Navigation.scss';

const Navigation =()=> {
    return <div className="Navigation">
        <Link to="/home" className="Navigation-button Navigaton-button">Home</Link>
        <Link to="/blog" className="Navigation-button Navigaton-button">Blog</Link>
    </div>
}

export { Navigation }