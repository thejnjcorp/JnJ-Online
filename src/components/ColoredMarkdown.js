import MarkdownToJsx from 'markdown-to-jsx';
import { splitColorDirectives } from '../utils/colorDirective';
import { keyed } from '../utils/keyed';

// A block (one blank-line-separated chunk of markdown - see below) with any
// line that starts like a heading, blockquote, list item, table row, or code
// fence isn't plain prose - splicing an inline colored <span> into it isn't
// safe with a regex-based split, so a color directive there is left as plain
// text (markup stripped) rather than risk producing something broken.
const BLOCK_SYNTAX = /^\s{0,3}(#{1,6}\s|>|[-*+]\s|\d+[.)]\s|```|~~~|\|)/;
const isPlainProse = block => !block.split('\n').some(line => BLOCK_SYNTAX.test(line));

// One segment (see colorDirective.js) rendered inline - no block-level
// wrapper of its own - so a run of these composes into one continuous line
// of text, the way a colored phrase sits inside a normal sentence.
function InlineSegment({ segment, options }) {
    if (typeof segment === 'string') {
        return <MarkdownToJsx options={{ ...options, forceInline: true }}>{segment}</MarkdownToJsx>;
    }
    return <span style={{ color: segment.color }}>
        <MarkdownToJsx options={{ ...options, forceInline: true }}>{segment.text}</MarkdownToJsx>
    </span>;
}

// Drop-in replacement for markdown-to-jsx's own <Markdown> (same
// children/options props) that also understands :color[text]{color=value} -
// a standard markdown "text directive" (see colorDirective.js), the same
// syntax MDXEditor's own directivesPlugin reads and writes (see
// MarkdownEditorImpl.js's ColorDirectiveDescriptor) - markdown-to-jsx has a
// fixed grammar with no plugin system, so it can't parse this on its own.
//
// Content with no color directive at all (the common case) renders exactly
// as markdown-to-jsx alone would, with no extra work. Content that has one
// is split into blocks (CommonMark's own blank-line boundary); a block that
// is plain prose gets its colored run spliced in as an inline <span>, with
// the rest of that block's own markdown (bold, links, ...) still working on
// either side of it; any other kind of block (a list, a table, ...) just has
// the directive markup stripped back to plain text instead.
export default function ColoredMarkdown({ children, options, ...rest }) {
    if (typeof children !== 'string' || !children.includes(':color[')) {
        return <MarkdownToJsx options={options} {...rest}>{children}</MarkdownToJsx>;
    }

    const blocks = children.split(/\n{2,}/);
    return <>{keyed(blocks, 'block').map(({ item: block, key }) => {
        // A lone block rendered by itself (rather than as part of the whole
        // original text) reads to markdown-to-jsx as "just one line", which
        // it renders inline (a bare <span>) instead of wrapping in <p> -
        // forceBlock keeps that wrapping consistent regardless of the split.
        if (!block.includes(':color[')) return <MarkdownToJsx key={key} options={{ ...options, forceBlock: true }} {...rest}>{block}</MarkdownToJsx>;
        const segments = splitColorDirectives(block);
        if (!isPlainProse(block)) {
            const plain = segments.map(segment => (typeof segment === 'string' ? segment : segment.text)).join('');
            return <MarkdownToJsx key={key} options={options} {...rest}>{plain}</MarkdownToJsx>;
        }
        return <p key={key}>{keyed(segments, 'segment').map(({ item: segment, key: segmentKey }) => <InlineSegment key={segmentKey} segment={segment} options={options}/>)}</p>;
    })}</>;
}
