import React from "react";
import { Link } from "react-router-dom";
import '../styles/Blog.scss';

const Blog =()=> {
    document.title="Blog"
    return <div>
        <p>This is the text for the blog page</p>
        <div className="Blog-link-container"><Link to="/blog/README" className="Blog-link">README</Link></div>
        <div className="Blog-link-container"><Link to="/blog/test" className="Blog-link">test</Link></div>
        <div className="Blog-link-container"><Link to="/blog/test2" className="Blog-link">test 2</Link></div>
    </div>
}

export { Blog }