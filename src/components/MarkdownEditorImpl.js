import { useEffect, useMemo, useRef, useState } from 'react';
import {
    MDXEditor,
    BlockTypeSelect,
    BoldItalicUnderlineToggles,
    ButtonWithTooltip,
    CreateLink,
    InsertTable,
    InsertThematicBreak,
    ListsToggle,
    Separator,
    UndoRedo,
    $isDirectiveNode,
    activeEditor$,
    directivesPlugin,
    headingsPlugin,
    insertDirective$,
    linkDialogPlugin,
    linkPlugin,
    listsPlugin,
    markdownShortcutPlugin,
    maxLengthPlugin,
    quotePlugin,
    rootEditor$,
    tablePlugin,
    thematicBreakPlugin,
    toolbarPlugin,
    usePublisher,
    useCellValue,
} from '@mdxeditor/editor';
import { $getSelection, $isRangeSelection, COMMAND_PRIORITY_HIGH, KEY_BACKSPACE_COMMAND } from 'lexical';
import '@mdxeditor/editor/style.css';
import { MarkdownFallback } from './MarkdownFallback';
import { keepBlankLines } from '../utils/markdownBlankLines';
import { ColorDirectiveDescriptor } from './ColorDirectiveEditor';
import { ReactComponent as ColorPickerIcon } from '../icons/colorpicker.svg';

// Inserts a :color[...]{color=...} at the cursor - the ColorDirectiveEditor
// (registered below via directivesPlugin) then takes over, showing a swatch
// to change the color and a nested editor for the phrase's own text. Text
// already selected when this is clicked becomes the new phrase's own content
// (onPointerDown's preventDefault keeps that selection from being lost to the
// button stealing focus first), rather than being left behind empty.
function ColorDirectiveButton() {
    const insertDirective = usePublisher(insertDirective$);
    const activeEditor = useCellValue(activeEditor$);

    function handleClick() {
        let selectedText = '';
        activeEditor?.getEditorState().read(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection) && !selection.isCollapsed()) {
                selectedText = selection.getTextContent();
            }
        });
        const payload = { name: 'color', type: 'textDirective', attributes: { color: '#ff0000' } };
        if (selectedText) payload.children = [{ type: 'text', value: selectedText }];
        insertDirective(payload);
    }

    return <ButtonWithTooltip
        title="Colored text"
        onPointerDown={event => event.preventDefault()}
        onClick={handleClick}
    >
        <ColorPickerIcon/>
    </ButtonWithTooltip>;
}

// A color directive is a DecoratorNode - as far as the outer editor is
// concerned, an atomic unit - so Lexical's own default Backspace behavior,
// right after one, is to delete the whole thing in a single keystroke. That's
// surprising once it has real text in it: this steps into it instead (same
// place the swatch's own auto-focus lands a brand new one), leaving normal
// character-by-character deletion, and the node's own already-there
// "backspace an empty one closes it" handling, to take it from there.
// Renders nothing - just registers the command for as long as this editor
// instance is mounted.
function ColorDirectiveBackspaceGuard() {
    const rootEditor = useCellValue(rootEditor$);

    useEffect(() => {
        if (!rootEditor) return;
        return rootEditor.registerCommand(
            KEY_BACKSPACE_COMMAND,
            event => {
                const selection = $getSelection();
                if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
                const { anchor } = selection;
                const anchorNode = anchor.getNode();
                const nodeBeforeCursor = anchor.type === 'element'
                    ? anchorNode.getChildAtIndex(anchor.offset - 1)
                    : (anchor.offset === 0 ? anchorNode.getPreviousSibling() : null);
                if (!nodeBeforeCursor || !$isDirectiveNode(nodeBeforeCursor) || nodeBeforeCursor.getMdastNode().name !== 'color') return false;
                // Without this, returning true only stops Lexical's own
                // command chain - the native keydown still reaches the
                // browser's default contentEditable deletion, which by then
                // lands on the nested editor .select() just focused, deleting
                // one more character than intended.
                event.preventDefault();
                nodeBeforeCursor.select();
                return true;
            },
            COMMAND_PRIORITY_HIGH,
        );
    }, [rootEditor]);

    return null;
}

// Only what markdown-to-jsx (which renders all of this text) can show: no
// underline (it needs raw HTML, which we don't render) and no images or code
// blocks. Every editor here reads and writes plain Markdown strings.
const compactPlugins = [
    listsPlugin(),
    markdownShortcutPlugin(),
    directivesPlugin({ directiveDescriptors: [ColorDirectiveDescriptor] }),
    toolbarPlugin({
        toolbarContents: () => <>
            <UndoRedo/>
            <Separator/>
            <BoldItalicUnderlineToggles options={['Bold', 'Italic']}/>
            <Separator/>
            <ListsToggle options={['bullet', 'number']}/>
            <Separator/>
            <ColorDirectiveButton/>
            <ColorDirectiveBackspaceGuard/>
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
    directivesPlugin({ directiveDescriptors: [ColorDirectiveDescriptor] }),
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
            <Separator/>
            <ColorDirectiveButton/>
            <ColorDirectiveBackspaceGuard/>
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
    directivesPlugin({ directiveDescriptors: [ColorDirectiveDescriptor] }),
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
            <Separator/>
            <ColorDirectiveButton/>
            <ColorDirectiveBackspaceGuard/>
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
    function handleChange(reported, normalize) {
        const markdown = keepBlankLines(reported);
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
