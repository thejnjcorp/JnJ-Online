import { render, screen, fireEvent } from '@testing-library/react';
import { ColorField } from '../../src/components/ColorField';

describe('ColorField', () => {
    test('shows the colour, and picking another reports it', () => {
        const onChange = jest.fn();
        render(<ColorField label="Enemy color" value="#ff7a1f" onChange={onChange}/>);
        expect(screen.getByLabelText('Enemy color')).toHaveValue('#ff7a1f');
        expect(screen.getByText('#ff7a1f')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Enemy color'), { target: { value: '#00ff85' } });
        expect(onChange).toHaveBeenCalledWith('#00ff85');
    });

    test('clearing reports none', () => {
        const onChange = jest.fn();
        render(<ColorField label="Enemy color" value="#ff7a1f" onChange={onChange}/>);
        fireEvent.click(screen.getByRole('button', { name: 'Clear enemy color' }));
        expect(onChange).toHaveBeenCalledWith('');
    });

    test('with none it says so, offers nothing to clear, and a value that is not a colour counts as none', () => {
        const { rerender } = render(<ColorField label="Enemy color" value="" fallbackText="Red, like every enemy" onChange={jest.fn()}/>);
        expect(screen.getByText('Red, like every enemy')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Clear/ })).not.toBeInTheDocument();
        rerender(<ColorField label="Enemy color" value="orange" fallbackText="Red, like every enemy" onChange={jest.fn()}/>);
        expect(screen.getByText('Red, like every enemy')).toBeInTheDocument();
    });

    test('read-only, it can be neither changed nor cleared', () => {
        render(<ColorField label="Enemy color" value="#ff7a1f" disabled onChange={jest.fn()}/>);
        expect(screen.getByLabelText('Enemy color')).toBeDisabled();
        expect(screen.queryByRole('button', { name: /Clear/ })).not.toBeInTheDocument();
    });
});
