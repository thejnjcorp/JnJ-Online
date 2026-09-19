import { render, screen, fireEvent } from '@testing-library/react';
import { ClassPublishDialog } from '../../src/components/ClassPublishDialog';

describe('ClassPublishDialog', () => {
    test('names the version being published and what happens to the current one', () => {
        render(<ClassPublishDialog nextVersion={3} busy={false} onPublish={() => {}} onClose={() => {}} />);

        expect(screen.getByText('Publish as v3')).toBeInTheDocument();
        expect(screen.getByText(/frozen as v2/)).toBeInTheDocument();
    });

    test('publishing passes the changelog note, trimmed', () => {
        const onPublish = jest.fn();
        render(<ClassPublishDialog nextVersion={2} busy={false} onPublish={onPublish} onClose={() => {}} />);

        fireEvent.change(screen.getByPlaceholderText(/Rebalanced/), { target: { value: '  Added Fleetfoot  ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Publish v2' }));

        expect(onPublish).toHaveBeenCalledWith('Added Fleetfoot');
    });

    test('the note is optional', () => {
        const onPublish = jest.fn();
        render(<ClassPublishDialog nextVersion={2} busy={false} onPublish={onPublish} onClose={() => {}} />);

        fireEvent.click(screen.getByRole('button', { name: 'Publish v2' }));

        expect(onPublish).toHaveBeenCalledWith('');
    });

    test('Cancel and the backdrop both close it', () => {
        const onClose = jest.fn();
        render(<ClassPublishDialog nextVersion={2} busy={false} onPublish={() => {}} onClose={onClose} />);

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));

        expect(onClose).toHaveBeenCalledTimes(2);
    });

    test('while publishing, the buttons are disabled and say so', () => {
        render(<ClassPublishDialog nextVersion={2} busy={true} onPublish={() => {}} onClose={() => {}} />);

        expect(screen.getByRole('button', { name: /Publishing/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    });
});
