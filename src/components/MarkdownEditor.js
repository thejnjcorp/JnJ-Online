import { lazy, Suspense } from 'react';
import '../styles/MarkdownEditor.scss';

// The editor is a large dependency and only editors ever see it, so it loads
// on demand instead of weighing down every page.
const MarkdownEditorImpl = lazy(() => import('./MarkdownEditorImpl'));

// A rich-text editor whose value is a Markdown string.
//   value, onChange(markdown)  the text and its updates
//   variant                    'full' (headings, quotes, links, tables) or
//                              'compact' (bold, italic, lists)
//   label, placeholder         accessible name and empty-state text
//   maxLength, readOnly        optional limit on the text, and view-only mode
export default function MarkdownEditor(props) {
    return <Suspense fallback={<div className="MarkdownEditor-loading" role="status">Loading editor…</div>}>
        <MarkdownEditorImpl {...props}/>
    </Suspense>;
}
