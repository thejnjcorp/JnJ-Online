import React from "react";
import { Link } from "react-router-dom";
import '../styles/Blog.scss';

export function Blog({markdowns}) {
    document.title="Blog"
    return <div className="Blog">
        <h2>Important documents made for the JnJ System</h2>
        {markdowns?.map((markdown, index) => {
            return <div className="Blog-link-container" key={index}>
                <Link to={"/blog/" + markdown} className="Blog-link">{markdown}</Link>
            </div>
        })}
    </div>
}