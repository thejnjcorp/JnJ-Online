import { useEffect, useRef } from 'react';
import { NestedLexicalEditor, useMdastNodeUpdater } from '@mdxeditor/editor';
import { isSafeColor } from '../utils/colorDirective';

// The in-place editor MDXEditor shows for a :color[...]{color=...} node
// (registered against ColorDirectiveDescriptor below) - a native color swatch
// for the attribute, and the phrase's own text edited inline right next to
// it, the same way GenericDirectiveEditor combines a PropertyPopover with a
// NestedLexicalEditor, but with a color swatch in place of the popover since
// there's only ever the one attribute.
export function ColorDirectiveEditor({ mdastNode }) {
    const updateMdastNode = useMdastNodeUpdater();
    const color = isSafeColor(mdastNode.attributes?.color) ? mdastNode.attributes.color : '#ff0000';
    const containerRef = useRef(null);
    // MDXEditor's own auto-focus-the-new-node mechanism (insertDirective$ ->
    // node.select()) races the nested editor's own async setup: it publishes
    // to a focus emitter that has no subscriber yet, since NestedLexicalEditor
    // only wires one up once its own child Lexical editor instance exists,
    // one or more renders later. That publish is a fire-and-forget, unbuffered
    // call (see @mdxeditor/editor's voidEmitter) - lost if nothing is listening
    // yet - so a freshly-inserted (still-empty) node never actually gets
    // focused. Only ever do this for a brand new node - captured once, since
    // mdastNode itself changes on every keystroke as the user types.
    const isNewNode = useRef(!mdastNode.children || mdastNode.children.length === 0);
    useEffect(() => {
        if (!isNewNode.current) return;
        let cancelled = false;
        let frame;
        function tryFocus() {
            if (cancelled) return;
            const el = containerRef.current?.querySelector('[contenteditable]');
            if (el) { el.focus(); return; }
            frame = requestAnimationFrame(tryFocus);
        }
        frame = requestAnimationFrame(tryFocus);
        return () => { cancelled = true; if (frame) cancelAnimationFrame(frame); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return <span className="ColorDirectiveEditor" ref={containerRef}>
        <input
            type="color"
            className="ColorDirectiveEditor-swatch"
            aria-label="Text color"
            value={color.startsWith('#') ? color : '#ff0000'}
            onChange={event => updateMdastNode({ attributes: { ...mdastNode.attributes, color: event.target.value } })}
        />
        <span className="ColorDirectiveEditor-text" style={{ color }}>
            <NestedLexicalEditor
                block={false}
                getContent={node => node.children}
                getUpdatedMdastNode={(node, children) => ({ ...node, children })}
            />
        </span>
    </span>;
}

export const ColorDirectiveDescriptor = {
    name: 'color',
    testNode: node => node.type === 'textDirective' && node.name === 'color',
    attributes: ['color'],
    hasChildren: true,
    Editor: ColorDirectiveEditor,
};
