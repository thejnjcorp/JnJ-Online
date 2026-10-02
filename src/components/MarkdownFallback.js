import '../styles/MarkdownEditor.scss';

// The plain-Markdown stand-in for the visual editor, for text it can't open
// (MarkdownEditorImpl) or when it can't be loaded at all (MarkdownEditor).
export function MarkdownFallback({ value, onChange, label, placeholder, readOnly, maxLength, variant = 'full', className = '', note }) {
    const classes = ['MarkdownEditor', `MarkdownEditor-${variant}`, className].filter(Boolean).join(' ');
    return <div className={classes}>
        <output className="MarkdownEditor-fallback-note">{note}</output>
        <textarea
            className="MarkdownEditor-fallback"
            aria-label={label}
            placeholder={placeholder}
            value={value || ''}
            readOnly={readOnly}
            maxLength={maxLength}
            onChange={event => onChange(event.target.value)}
        />
    </div>;
}
