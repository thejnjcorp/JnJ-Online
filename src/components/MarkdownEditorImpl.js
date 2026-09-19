import { useEffect, useMemo, useRef, useState } from 'react';
import {
    MDXEditor,
    BlockTypeSelect,
    BoldItalicUnderlineToggles,
    CreateLink,
    InsertTable,
    InsertThematicBreak,
    ListsToggle,
    Separator,
    UndoRedo,
    headingsPlugin,
    linkDialogPlugin,
    linkPlugin,
    listsPlugin,
    markdownShortcutPlugin,
    maxLengthPlugin,
    quotePlugin,
    tablePlugin,
    thematicBreakPlugin,
    toolbarPlugin,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { MarkdownFallback } from './MarkdownFallback';

// Only what markdown-to-jsx (which renders all of this text) can show: no
// underline (it needs raw HTML, which we don't render) and no images or code
// blocks. Every editor here reads and writes plain Markdown strings.
const compactPlugins = [
    listsPlugin(),
    markdownShortcutPlugin(),
    toolbarPlugin({
        toolbarContents: () => <>
            <UndoRedo/>
            <Separator/>
            <BoldItalicUnderlineToggles options={['Bold', 'Italic']}/>
            <Separator/>
            <ListsToggle options={['bullet', 'number']}/>
        </>,
    }),
];

const fullPlugins = [
    headingsPlugin({ allowedHeadingLevels: [2, 3, 4] }),
    listsPlugin(),
    quotePlugin(),
    thematicBreakPlugin(),
    linkPlugin(),
    linkDialogPlugin(),
    tablePlugin(),
    markdownShortcutPlugin(),
    toolbarPlugin({
        toolbarContents: () => <>
            <UndoRedo/>
            <Separator/>
            <BlockTypeSelect/>
            <Separator/>
            <BoldItalicUnderlineToggles options={['Bold', 'Italic']}/>
            <Separator/>
            <ListsToggle options={['bullet', 'number']}/>
            <Separator/>
            <CreateLink/>
            <InsertTable/>
            <InsertThematicBreak/>
        </>,
    }),
];

// Rules text for an action: enough structure to lay a long description out
// (section headings, a quote for flavour text, dividers, tables) without the
// large headings and links the notes and lore editors offer.
const actionPlugins = [
    headingsPlugin({ allowedHeadingLevels: [3, 4] }),
    listsPlugin(),
    quotePlugin(),
    thematicBreakPlugin(),
    tablePlugin(),
    markdownShortcutPlugin(),
    toolbarPlugin({
        toolbarContents: () => <>
            <UndoRedo/>
            <Separator/>
            <BlockTypeSelect/>
            <Separator/>
            <BoldItalicUnderlineToggles options={['Bold', 'Italic']}/>
            <Separator/>
            <ListsToggle options={['bullet', 'number']}/>
            <Separator/>
            <InsertTable/>
            <InsertThematicBreak/>
        </>,
    }),
];

const PLUGINS = { compact: compactPlugins, full: fullPlugins, action: actionPlugins };
// A line break within a paragraph is written as two trailing spaces: the
// default (a bare newline, or a backslash) shows up as a space, or a stray
// backslash, in markdown-to-jsx.
const HARD_BREAK = '  \n';
const MARKDOWN_OPTIONS = {
    bullet: '-',
    emphasis: '*',
    strong: '*',
    handlers: {
        break: () => HARD_BREAK,
        text: (node, _parent, state, info) => state.safe(node.value, info).replaceAll('\n', HARD_BREAK),
    },
};

export default function MarkdownEditorImpl({ value, onChange, placeholder, label, variant = 'full', className = '', readOnly = false, maxLength }) {
    const editorRef = useRef(null);
    // What the editor last reported, so that only a change that came from
    // somewhere else (a synced note, a reset form) is pushed back into it.
    const lastValue = useRef(value || '');
    // Text the visual editor can't parse would leave it blank and silently
    // drop anything typed, so those edit as plain Markdown instead.
    const [unparseable, setUnparseable] = useState(false);

    useEffect(() => {
        const next = value || '';
        if (next === lastValue.current) return;
        lastValue.current = next;
        editorRef.current?.setMarkdown(next);
    }, [value]);

    // `normalize` is true when the editor is only re-serialising what it just
    // loaded (a different bullet character, extra whitespace). That isn't an
    // edit, so merely opening something mustn't change or save it.
    function handleChange(markdown, normalize) {
        if (normalize || markdown === lastValue.current) return;
        lastValue.current = markdown;
        onChange(markdown);
    }

    // Read once, when the editor mounts, like every plugin.
    const plugins = useMemo(() => {
        const base = PLUGINS[variant] || fullPlugins;
        return maxLength ? [...base, maxLengthPlugin(maxLength)] : base;
    }, [variant, maxLength]);

    const classes = ['MarkdownEditor', `MarkdownEditor-${variant}`, readOnly && 'MarkdownEditor-readonly', className].filter(Boolean).join(' ');

    if (unparseable) {
        return <MarkdownFallback
            value={value} onChange={onChange} label={label} placeholder={placeholder} readOnly={readOnly}
            maxLength={maxLength} variant={variant} className={className}
            note="This text uses Markdown the visual editor can't show, so it's being edited as plain Markdown."
        />;
    }

    return <div className={classes} role="group" aria-label={label}>
        <MDXEditor
            ref={editorRef}
            className="MarkdownEditor-root"
            contentEditableClassName="MarkdownEditor-content"
            markdown={value || ''}
            onChange={handleChange}
            onError={() => setUnparseable(true)}
            plugins={plugins}
            toMarkdownOptions={MARKDOWN_OPTIONS}
            placeholder={placeholder}
            readOnly={readOnly}
            suppressHtmlProcessing
        />
    </div>;
}
