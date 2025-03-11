import React, { useState, useEffect } from "react";
import Markdown from 'markdown-to-jsx';
import '../styles/BlogPages.scss';
import Collapsible from "react-collapsible";

const BlogPages =(props)=> {
    const file_name = `${props.post}.md`;
    const [post, setPost] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [headers, setHeaders] = useState([]);
    const [showSidebar, setShowSidebar] = useState(false);

    const nextPage = () => {
        if (currentPage < post.length - 1) {
            setCurrentPage(currentPage + 1);
            window.scrollTo(0, 0);
        }
    };

    const prevPage = () => {
        if (currentPage > 0) {
            setCurrentPage(currentPage - 1);
            window.scrollTo(0, 0);
        }
    };

    const extractHeaders = (markdown) => {
        const headers = [];
        var subHeaders = [];
        const lines = markdown.split('\n');
        var tempHeader;
        lines.forEach((line) => {
            const match = line.match(/^(#{1,6})\s+(.*)/);
            if (match) {
                const level = match[1].length;
                const text = match[2];
                if (level === 1) {
                    if (headers.length === 0) {
                        headers.push({ text });
                        tempHeader = { text };
                    } else {
                        headers.push({ ...tempHeader, subHeaders });
                        tempHeader = { text };
                        subHeaders = [];
                    }
                } else {
                    subHeaders.push({ text, level });
                }
            }
        });
        headers.push({ ...tempHeader, subHeaders });
        headers.shift();
        headers.shift();
        return headers;
    }

    // Split markdown content by headers
    const splitSections = (markdown) => {
        const sections = [];
        let currentSection = '';
        const lines = markdown.split('\n');
    
        lines.forEach((line) => {
        if (line.startsWith('# ')) {
            if (currentSection) {
            sections.push(currentSection);
            }
            currentSection = line; // Start new section with the header
        } else {
            currentSection += '\n' + line; // Append content to the current section
        }
        });
    
        if (currentSection) {
        sections.push(currentSection); // Add the last section
        }
        return sections;
    };

    useEffect(() => {
        import(`../markdown/${file_name}`)
        .then(res => {
            fetch(res.default)
                .then((res) => res.text())
                .then(res => {
                    setHeaders(extractHeaders(res));
                    setPost(splitSections(res));
                });
        })
        .catch(err => console.log(err));

        document.title=props.post
    }, [props.post, file_name])

    const navigationButtons = <div className="BlogPage-nav-buttons">
        <button onClick={prevPage} disabled={currentPage === 1}>
            Previous Page
        </button>
        <button onClick={nextPage} disabled={currentPage === post.length - 1}>
            Next Page
        </button>
    </div>
    
    return <div className="BlogPage-content">
        <div className="BlogPage-summary-sidebar" onMouseOver={() => setShowSidebar(true)} onMouseOut={() => setShowSidebar(false)}>
            {showSidebar && <div className="BlogPage-summary-sidebar-content">
                <h2>Pages:</h2>
                {headers?.map((header, index) => {
                    return <Collapsible
                        key={`sidebar-header-${index}`}
                        trigger={<div style={{fontSize: 24}} onClick={() => {
                            setCurrentPage(index + 1);
                            window.scrollTo(0, 0);
                        }}>{header?.text || "Placeholder"}</div>}
                        transitionTime={100}
                    >
                        {header?.subHeaders?.map((subHeader, subIndex) => {
                            return <div key={`sidebar-header-${index}-${subIndex}`} style={{ marginLeft: (subHeader.level - 1) * 20}}><a 
                            // eslint-disable-next-line
                            href={`#${subHeader.text.slice(0, -1).replace(/\s+/g, '-').replace(/[\\\/]/g, "").toLowerCase()}`}
                            className="BlogPage-summary-sidebar-subheader-href"
                            >- {subHeader.text}</a></div>
                        })}
                    </Collapsible>                   
                })}
            </div>}
        </div>
        <Markdown>{post?.at(0)}</Markdown>
        {navigationButtons}
        <Markdown>{post?.at(currentPage)}</Markdown>
        {navigationButtons}
        <br/>
    </div>
}

export default BlogPages
