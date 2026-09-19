import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MarkdownEditor from '../../src/components/MarkdownEditor';

jest.unmock('../../src/components/MarkdownEditor');
// What a page left open across a deploy sees: the editor's file is gone.
jest.mock('../../src/components/MarkdownEditorImpl', () => {
    throw new Error('Loading chunk 123 failed. (ChunkLoadError)');
});

function Harness({ onChange = () => {} }) {
    const [value, setValue] = useState('some **text**');
    return <MarkdownEditor label="Notes" placeholder="Write" maxLength={50} value={value} onChange={next => { setValue(next); onChange(next); }}/>;
}

describe('MarkdownEditor when the visual editor cannot be loaded', () => {
    let consoleError;
    let consoleLog;

    beforeEach(() => {
        // React reports the error it hands to the boundary, and the boundary logs it
        consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleError.mockRestore();
        consoleLog.mockRestore();
    });

    test('the page survives, with the text in a plain Markdown box and a note saying why', async () => {
        render(<Harness/>);

        const field = await screen.findByRole('textbox', { name: 'Notes' });
        expect(field).toHaveValue('some **text**');
        expect(field).toHaveAttribute('placeholder', 'Write');
        expect(field).toHaveAttribute('maxlength', '50');
        expect(screen.getByText(/couldn't be loaded.*Reload the page/)).toBeInTheDocument();
        expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('Failed to load the Markdown editor'));
    });

    test('editing still works, and is reported like any other edit', async () => {
        const onChange = jest.fn();
        render(<Harness onChange={onChange}/>);

        fireEvent.change(await screen.findByRole('textbox', { name: 'Notes' }), { target: { value: 'rewritten' } });

        expect(onChange).toHaveBeenCalledWith('rewritten');
        expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue('rewritten');
    });
});
