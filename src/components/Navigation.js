import React from "react";
import { Link } from "react-router-dom";
import '../styles/Navigation.scss';



const Navigation =()=> {
    return <nav className="Navigation">
        <Link to="/home" className="Navigation-button">Home</Link>
        <Link to="/blog" className="Navigation-button">Blog</Link>
        <Link to="/characters" className="Navigation-button">Characters</Link>
        <Link to="/campaigns" className="Navigation-button">Campaigns</Link>
        <Link to="/account" className="Navigation-button">Account</Link>
    </nav>
}

export { Navigation }