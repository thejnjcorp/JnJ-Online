import { render, screen, fireEvent } from '@testing-library/react';
import { ClassTagEditDialog } from '../../src/components/ClassTagEditDialog';

const tag = { tagInfo: 'Fire', tagColor: '#ff0000', textColor: '#ffffff', tagDescription: 'Deals fire damage' };

describe('ClassTagEditDialog', () => {
    test('pre-fills every field from the given tag', () => {
        render(<ClassTagEditDialog actionIndex={0} tagIndex={0} tag={tag} onChange={() => {}} onClose={() => {}} onDelete={() => {}} />);

        expect(screen.getByPlaceholderText('e.g. Fire')).toHaveValue('Fire');
        expect(screen.getByDisplayValue('Deals fire damage')).toBeInTheDocument();
    });

    test('color inputs default to react-brand blue/near-black when the tag has no colors set yet', () => {
        render(<ClassTagEditDialog actionIndex={0} tagIndex={0} tag={{}} onChange={() => {}} onClose={() => {}} onDelete={() => {}} />);

        expect(screen.getByDisplayValue('#61dafb')).toHaveAttribute('name', 'tagColor');
        expect(screen.getByDisplayValue('#1b1b1f')).toHaveAttribute('name', 'textColor');
    });

    test('the live preview shows the tag label (or "Tag" if unnamed) styled with the current colors', () => {
        render(<ClassTagEditDialog actionIndex={0} tagIndex={0} tag={tag} onChange={() => {}} onClose={() => {}} onDelete={() => {}} />);
        const preview = screen.getByText('Fire', { selector: '.ClassTagEditDialog-preview' });
        expect(preview).toHaveStyle({ backgroundColor: 'rgb(255, 0, 0)', color: 'rgb(255, 255, 255)' });
    });

    test('the live preview falls back to "Tag" when tagInfo is empty', () => {
        render(<ClassTagEditDialog actionIndex={0} tagIndex={0} tag={{}} onChange={() => {}} onClose={() => {}} onDelete={() => {}} />);
        expect(screen.getByText('Tag', { selector: '.ClassTagEditDialog-preview' })).toBeInTheDocument();
    });

    test('editing the label field reports a change scoped to this action/tag\'s exact form path', () => {
        const onChange = jest.fn();
        render(<ClassTagEditDialog actionIndex={2} tagIndex={1} tag={tag} onChange={onChange} onClose={() => {}} onDelete={() => {}} />);

        fireEvent.change(screen.getByPlaceholderText('e.g. Fire'), { target: { name: 'tagInfo', value: 'Ice' } });

        expect(onChange).toHaveBeenCalledWith({ name: 'actions[2].tags[1].tagInfo', value: 'Ice' });
    });

    test.each([
        // <input type="color"> only accepts valid hex colors (jsdom normalizes
        // anything else to #000000) - currentValue is tag's existing value,
        // used to locate the right field via getByDisplayValue.
        ['tagColor', tag.tagColor, '#00ff00'],
        ['textColor', tag.textColor, '#00ff00'],
        ['tagDescription', tag.tagDescription, 'new-value'],
    ])('editing %s reports a change under the same scoped path', (fieldName, currentValue, newValue) => {
        const onChange = jest.fn();
        render(<ClassTagEditDialog actionIndex={0} tagIndex={3} tag={tag} onChange={onChange} onClose={() => {}} onDelete={() => {}} />);

        fireEvent.change(screen.getByDisplayValue(currentValue), { target: { name: fieldName, value: newValue } });

        expect(onChange).toHaveBeenCalledWith({ name: `actions[0].tags[3].${fieldName}`, value: newValue });
    });

    test('clicking the scrim calls onClose', () => {
        const onClose = jest.fn();
        render(<ClassTagEditDialog actionIndex={0} tagIndex={0} tag={tag} onChange={() => {}} onClose={onClose} onDelete={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('clicking Done calls onClose', () => {
        const onClose = jest.fn();
        render(<ClassTagEditDialog actionIndex={0} tagIndex={0} tag={tag} onChange={() => {}} onClose={onClose} onDelete={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('clicking Delete Tag calls onDelete', () => {
        const onDelete = jest.fn();
        render(<ClassTagEditDialog actionIndex={0} tagIndex={0} tag={tag} onChange={() => {}} onClose={() => {}} onDelete={onDelete} />);
        fireEvent.click(screen.getByRole('button', { name: 'Delete Tag' }));
        expect(onDelete).toHaveBeenCalledTimes(1);
    });
});
