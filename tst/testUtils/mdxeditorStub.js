// Stands in for @mdxeditor/editor in tests of src/components/MarkdownEditorImpl.js
// (mapped in jest.config.js): a textarea with the same props and ref methods, plus
// two triggers - text containing UNPARSEABLE reports a parse error, and text
// containing NORMALIZE reports the editor re-serialising what it just loaded.
const React = require('react');

const state = { lastProps: null, setMarkdownCalls: [] };

const MDXEditor = React.forwardRef(function MDXEditor(props, ref) {
    state.lastProps = props;
    const [text, setText] = React.useState(props.markdown);
    React.useImperativeHandle(ref, () => ({
        setMarkdown: value => { state.setMarkdownCalls.push(value); setText(value); },
        getMarkdown: () => text,
    }), [text]);
    const { onChange, onError, markdown } = props;
    React.useEffect(() => {
        if (markdown.includes('UNPARSEABLE')) onError?.({ error: 'nope', source: markdown });
        if (markdown.includes('NORMALIZE')) onChange?.(markdown.replace('NORMALIZE', 'normalized'), true);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return React.createElement('textarea', {
        'data-testid': 'mdx-stub',
        className: props.className,
        placeholder: props.placeholder,
        readOnly: props.readOnly,
        value: text,
        onChange: event => { setText(event.target.value); props.onChange?.(event.target.value, false); },
    });
});

const plugin = () => ({});
const component = () => null;

module.exports = {
    __state: state,
    MDXEditor,
    headingsPlugin: plugin, linkDialogPlugin: plugin, linkPlugin: plugin, listsPlugin: plugin,
    markdownShortcutPlugin: plugin, maxLengthPlugin: length => ({ maxLength: length }), quotePlugin: plugin, tablePlugin: plugin,
    thematicBreakPlugin: plugin, toolbarPlugin: plugin,
    BlockTypeSelect: component, BoldItalicUnderlineToggles: component, CreateLink: component,
    InsertTable: component, InsertThematicBreak: component, ListsToggle: component,
    Separator: component, UndoRedo: component,
};
