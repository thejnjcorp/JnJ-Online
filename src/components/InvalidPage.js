import React from "react";
import '../styles/InvalidPage.scss';

const InvalidPage =()=> {
    document.title="404 Invalid Page"
    return <div>
        <div className="Invalid-page-big-text">
            404 Not Found</div>
        The page you are looking for is not here.
    </div>
}

export { InvalidPage }