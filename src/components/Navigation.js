import React from "react";
import { Link } from "react-router-dom";
import '../styles/Navigation.scss';

const Navigation =()=> {
    return <nav className="Navigation">
        <Link to="/home" className="Navigation-button Navigaton-button">Home</Link>
        <Link to="/blog" className="Navigation-button Navigaton-button">Blog</Link>
        <Link to="/characters" className="Navigation-button Navigation-button">Characters</Link>
        <Link to="/campaigns" className="Navigation-button Navigation-button">Campaigns</Link>
    </nav>
}

export { Navigation }