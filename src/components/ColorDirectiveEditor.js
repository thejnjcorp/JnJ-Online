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

    return <span className="ColorDirectiveEditor">
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
