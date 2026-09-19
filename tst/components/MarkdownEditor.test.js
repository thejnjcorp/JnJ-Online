import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MarkdownEditor from '../../src/components/MarkdownEditor';

jest.unmock('../../src/components/MarkdownEditor');

const { __state: stub } = require('../testUtils/mdxeditorStub');

// Behaves like a page that owns the text: what the editor reports comes back in as `value`.
function Harness({ initial = '', onChange = () => {}, ...props }) {
    const [value, setValue] = useState(initial);
    return <>
        <MarkdownEditor
            label="Notes"
            value={value}
            onChange={next => { setValue(next); onChange(next); }}
            {...props}
        />
        <button onClick={() => setValue('changed elsewhere')}>Change elsewhere</button>
    </>;
}

const editor = () => screen.findByTestId('mdx-stub');

beforeEach(() => { stub.setMarkdownCalls.length = 0; });

describe('MarkdownEditor', () => {
    test('shows a loading message, then the editor, named for assistive tech', async () => {
        render(<Harness initial="hello"/>);
        expect(screen.getByRole('status')).toHaveTextContent('Loading editor');

        expect(await editor()).toHaveValue('hello');
        expect(screen.getByRole('group', { name: 'Notes' })).toBeInTheDocument();
    });

    test('reports what is typed as Markdown', async () => {
        const onChange = jest.fn();
        render(<Harness initial="hello" onChange={onChange}/>);

        fireEvent.change(await editor(), { target: { value: 'hello **world**' } });

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith('hello **world**');
    });

    test('does not report a change that leaves the text as it was', async () => {
        const onChange = jest.fn();
        render(<Harness initial="same" onChange={onChange}/>);

        fireEvent.change(await editor(), { target: { value: 'same' } });

        expect(onChange).not.toHaveBeenCalled();
    });

    test('opening text the editor would tidy up is not an edit', async () => {
        const onChange = jest.fn();
        render(<Harness initial="* NORMALIZE" onChange={onChange}/>);

        expect(await editor()).toHaveValue('* NORMALIZE');
        expect(onChange).not.toHaveBeenCalled();
    });

    test('text that changes elsewhere is shown in the editor without being reported back', async () => {
        const onChange = jest.fn();
        render(<Harness initial="first" onChange={onChange}/>);
        expect(await editor()).toHaveValue('first');

        fireEvent.click(screen.getByText('Change elsewhere'));

        expect(screen.getByTestId('mdx-stub')).toHaveValue('changed elsewhere');
        expect(stub.setMarkdownCalls).toEqual(['changed elsewhere']);
        expect(onChange).not.toHaveBeenCalled();
    });

    test('text it just reported is not pushed back into the editor', async () => {
        render(<Harness initial="first"/>);

        fireEvent.change(await editor(), { target: { value: 'first, then more' } });

        expect(stub.setMarkdownCalls).toEqual([]);
        expect(screen.getByTestId('mdx-stub')).toHaveValue('first, then more');
    });

    describe('Markdown the visual editor cannot open', () => {
        test('falls back to a plain Markdown textarea holding the same text', async () => {
            render(<Harness initial="keep UNPARSEABLE me"/>);

            const fallback = await screen.findByRole('textbox', { name: 'Notes' });
            expect(fallback).toHaveValue('keep UNPARSEABLE me');
            expect(screen.queryByTestId('mdx-stub')).not.toBeInTheDocument();
            expect(screen.getByText(/edited as plain Markdown/)).toBeInTheDocument();
        });

        test('edits in the fallback are reported like any other', async () => {
            const onChange = jest.fn();
            render(<Harness initial="keep UNPARSEABLE me" onChange={onChange}/>);

            fireEvent.change(await screen.findByRole('textbox', { name: 'Notes' }), { target: { value: 'fixed' } });

            expect(onChange).toHaveBeenCalledWith('fixed');
            expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue('fixed');
        });
    });

    test('the variant picks the styling and toolbar', async () => {
        const { container } = render(<Harness variant="compact" className="mine"/>);
        await editor();

        const root = container.querySelector('.MarkdownEditor');
        expect(root).toHaveClass('MarkdownEditor-compact', 'mine');
    });

    test('passes the placeholder and read-only state through', async () => {
        render(<Harness placeholder="Write here" readOnly/>);

        const field = await editor();
        expect(field).toHaveAttribute('placeholder', 'Write here');
        expect(field).toHaveAttribute('readonly');
    });

    describe('Markdown it writes', () => {
        // markdown-to-jsx (which renders it all) shows a backslash break as a
        // stray "\" and a bare newline as a space, so both are two spaces + newline.
        test('writes line breaks as two trailing spaces and bullets as dashes', async () => {
            render(<Harness initial="x"/>);
            await editor();

            const { handlers, bullet, emphasis, strong } = stub.lastProps.toMarkdownOptions;
            expect(bullet).toBe('-');
            expect(emphasis).toBe('*');
            expect(strong).toBe('*');
            expect(handlers.break()).toBe('  \n');
            const state = { safe: text => text };
            expect(handlers.text({ value: 'one\ntwo' }, null, state, {})).toBe('one  \ntwo');
        });
    });
});
