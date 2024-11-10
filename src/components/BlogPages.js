import React, { useState } from "react";
import Markdown from 'markdown-to-jsx';

function BlogPages(props) {

    const file_name = `${props.post}.md`;
    const [post, setPost] = useState('');

    import(`../markdown/${file_name}`)
        .then(res => {
            fetch(res.default)
                .then((res) => res.text())
                .then(res => setPost(res));
        })
        .catch(err => console.log(err));

    document.title=props.post
    return (
        <Markdown>{post}</Markdown>
    )
}

export default BlogPages
