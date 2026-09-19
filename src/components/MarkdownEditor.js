import { Component, lazy, Suspense } from 'react';
import { MarkdownFallback } from './MarkdownFallback';
import '../styles/MarkdownEditor.scss';

// The editor is a large dependency and only editors ever see it, so it loads
// on demand instead of weighing down every page.
const MarkdownEditorImpl = lazy(() => import('./MarkdownEditorImpl'));

// The download can fail - typically a page left open across a deploy, whose old
// file names no longer exist - and an unhandled failure takes the whole page
// down. Editing still works as plain Markdown, and reloading brings the
// visual editor back.
class LoadFailureBoundary extends Component {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error) {
        console.log('Failed to load the Markdown editor: ' + error);
    }

    render() {
        if (!this.state.failed) return this.props.children;
        const { value, onChange, label, placeholder, readOnly, maxLength, variant, className } = this.props.editorProps;
        return <MarkdownFallback
            value={value} onChange={onChange} label={label} placeholder={placeholder} readOnly={readOnly}
            maxLength={maxLength} variant={variant} className={className}
            note="The visual editor couldn't be loaded, so this is plain Markdown for now. Reload the page to get the editor back."
        />;
    }
}

// A rich-text editor whose value is a Markdown string.
//   value, onChange(markdown)  the text and its updates
//   variant                    'full' (headings, quotes, links, tables),
//                              'action' (rules text: small headings, quotes,
//                              dividers, tables) or 'compact' (bold, italic, lists)
//   label, placeholder         accessible name and empty-state text
//   maxLength, readOnly        optional limit on the text, and view-only mode
export default function MarkdownEditor(props) {
    return <LoadFailureBoundary editorProps={props}>
        <Suspense fallback={<div className="MarkdownEditor-loading" role="status">Loading editor…</div>}>
            <MarkdownEditorImpl {...props}/>
        </Suspense>
    </LoadFailureBoundary>;
}
