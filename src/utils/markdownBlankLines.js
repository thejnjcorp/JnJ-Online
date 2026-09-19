// Markdown collapses any number of blank lines into one paragraph break, so
// pressing Enter twice in the editor (an empty paragraph) used to save as
// nothing at all. An empty paragraph is written as a line holding `&nbsp;`,
// which the renderer (markdown-to-jsx) shows as a blank line - and which the
// editor loads back as an empty-looking paragraph, so it round-trips.
//
// The editor's own serializer hands us extra blank lines for an empty
// paragraph, and a bare non-breaking or zero-width space (what an "empty" line
// typed with one becomes), which the renderer would treat as empty and hide.
export function keepBlankLines(markdown) {
    return markdown
        .replace(/^[ ​]+$/gm, '&nbsp;')
        .replace(/\n{4,}/g, run => '\n\n' + '&nbsp;\n\n'.repeat(Math.floor((run.length - 2) / 2)));
}
