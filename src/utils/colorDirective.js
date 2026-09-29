// Colored text in markdown: a standard remark "text directive"
// (https://github.com/micromark/micromark-extension-directive),
// :color[some text]{color="#ff0000"} - the same syntax MDXEditor's own
// directivesPlugin already reads and writes (see MarkdownEditorImpl.js's
// ColorDirectiveDescriptor), so a value saved from the rich editor round-trips
// through here exactly. markdown-to-jsx (used for every read-only render - see
// ColoredMarkdown.js) has a fixed grammar with no plugin system, so it can't
// parse this on its own; this is the shared regex/validation both that editor
// plugin's toolbar button and the read-only renderer are built on.

// A hex color (#abc, #aabbcc, #aabbccdd) or a bare CSS/SVG named color
// (letters only) - never anything with a semicolon, parenthesis, "url(",
// or other CSS value that could smuggle something else into a style
// attribute built from user-authored text.
export const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)$/;

export const isSafeColor = value => typeof value === 'string' && SAFE_COLOR.test(value);

// Matches one :color[text]{color=value} run. `text` never contains a literal
// "]" (an author wanting one has to use a different directive shape - a rare
// enough case not worth a full bracket-matching parser here); `value` is
// unquoted, single- or double-quoted.
const COLOR_DIRECTIVE = /:color\[([^\]]*)\]\{color=(?:"([^"}]*)"|'([^'}]*)'|([^\s}]*))\}/g;

// Splits `markdown` on every :color[...]{...} run, safe ones becoming
// { text, color } objects and everything else (plain markdown, or a run
// naming an unsafe/invalid color, shown as plain text with the markup
// stripped) staying a string. A string with no color directive at all comes
// back as [markdown] unchanged, including when `markdown` isn't a string -
// the common case, and the only one most callers need to handle.
export function splitColorDirectives(markdown) {
    if (typeof markdown !== 'string' || !markdown.includes(':color[')) return [markdown];
    const parts = [];
    let lastIndex = 0;
    for (const match of markdown.matchAll(COLOR_DIRECTIVE)) {
        const [whole, text, doubleQuoted, singleQuoted, bare] = match;
        const color = doubleQuoted ?? singleQuoted ?? bare ?? '';
        if (match.index > lastIndex) parts.push(markdown.slice(lastIndex, match.index));
        parts.push(isSafeColor(color) ? { text, color } : text);
        lastIndex = match.index + whole.length;
    }
    if (lastIndex < markdown.length) parts.push(markdown.slice(lastIndex));
    return parts;
}
