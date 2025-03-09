import React from "react";
import { Link } from "react-router-dom";
import '../styles/Blog.scss';

const Blog =()=> {
    document.title="Blog"
    return <div>
        <p>This is the text for the blog page</p>
        <div className="Blog-link-container"><Link to="/blog/JnJ-Ruleset" className="Blog-link">JnJ Ruleset</Link></div>
    </div>
}

export { Blog }