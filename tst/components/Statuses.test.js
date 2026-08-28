jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockDoc = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
}));

// AddStatusDialog pulls in its own Firestore catalog queries - out of scope
// for testing Statuses.js itself, stubbed to just confirm it gets opened/closed.
jest.mock('../../src/components/AddStatusDialog', () => ({
    AddStatusDialog: ({ onClose }) => (
        <div data-testid="add-status-dialog"><button type="button" onClick={onClose}>close-dialog</button></div>
    ),
}));

// eslint-disable-next-line import/first
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { Statuses } from '../../src/components/Statuses';

const haste = { id: 'status-1', name: 'Haste', polarity: 'buff', stacks: 2, description: 'You are hasted.' };
const wounded = { id: 'status-2', name: 'Wounded', polarity: 'debuff', stacks: 0, description: 'Ouch.' };

function characterPageWith(statuses, overrides = {}) {
    return { character_id: 'char-1', userId: 'owner-1', statuses, ...overrides };
}

beforeEach(() => {
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockUpdateDoc.mockResolvedValue(undefined);
    window.alert = jest.fn();
});

afterEach(() => {
    delete window.alert;
});

describe('Statuses', () => {
    test('renders one chip per status, by name', () => {
        render(<Statuses characterPage={characterPageWith([haste, wounded])} userId="owner-1" />);
        expect(screen.getByText('Haste')).toBeInTheDocument();
        expect(screen.getByText('Wounded')).toBeInTheDocument();
    });

    test('shows a stack-count badge only for statuses with stacks > 0', () => {
        render(<Statuses characterPage={characterPageWith([haste, wounded])} userId="owner-1" />);
        expect(screen.getByText('2')).toBeInTheDocument(); // Haste's badge
        // Wounded has 0 stacks - its chip shows no badge (its name is still there, just no lone "0" badge)
        expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    test('clicking a status chip expands its detail (description + stacks), clicking again collapses it', () => {
        render(<Statuses characterPage={characterPageWith([haste])} userId="owner-1" />);
        expect(screen.queryByText('You are hasted.')).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('Haste'));
        expect(screen.getByText('You are hasted.')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Haste'));
        expect(screen.queryByText('You are hasted.')).not.toBeInTheDocument();
    });

    describe('as a read-only viewer', () => {
        test('sees a plain stacks number, no stepper, no remove/add buttons', () => {
            render(<Statuses characterPage={characterPageWith([haste])} userId="stranger-1" />);
            fireEvent.click(screen.getByText('Haste'));

            expect(screen.queryByRole('button', { name: '+' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: '−' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: '+ Add Status' })).not.toBeInTheDocument();
        });
    });

    describe('as a writer (owner)', () => {
        test('sees the stepper, remove button, and add-status button', () => {
            render(<Statuses characterPage={characterPageWith([haste])} userId="owner-1" />);
            fireEvent.click(screen.getByText('Haste'));

            expect(screen.getByRole('button', { name: '+' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: '−' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: '+ Add Status' })).toBeInTheDocument();
        });

        test('clicking + increases stacks by 1 and writes the whole updated statuses array', async () => {
            render(<Statuses characterPage={characterPageWith([haste])} userId="owner-1" />);
            fireEvent.click(screen.getByText('Haste'));

            fireEvent.click(screen.getByRole('button', { name: '+' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { statuses: [{ ...haste, stacks: 3 }] });
        });

        test('clicking − decreases stacks by 1', async () => {
            render(<Statuses characterPage={characterPageWith([haste])} userId="owner-1" />);
            fireEvent.click(screen.getByText('Haste'));

            fireEvent.click(screen.getByRole('button', { name: '−' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { statuses: [{ ...haste, stacks: 1 }] }));
        });

        test('the − stepper is disabled at 0 stacks and the + stepper is disabled at 9', () => {
            render(<Statuses characterPage={characterPageWith([wounded, { ...haste, stacks: 9 }])} userId="owner-1" />);

            fireEvent.click(screen.getByText('Wounded'));
            expect(screen.getByRole('button', { name: '−' })).toBeDisabled();
            fireEvent.click(screen.getByText('Wounded')); // collapse it again before expanding the other

            fireEvent.click(screen.getByText('Haste'));
            expect(screen.getByRole('button', { name: '+' })).toBeDisabled();
        });

        test('clicking Remove writes the statuses array with that status filtered out', async () => {
            render(<Statuses characterPage={characterPageWith([haste, wounded])} userId="owner-1" />);
            fireEvent.click(screen.getByText('Haste'));

            fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { statuses: [wounded] }));
        });

        test('a write error is alerted', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            render(<Statuses characterPage={characterPageWith([haste])} userId="owner-1" />);
            fireEvent.click(screen.getByText('Haste'));

            fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

            await waitFor(() => expect(window.alert).toHaveBeenCalled());
        });

        test('clicking + Add Status opens the AddStatusDialog, and its onClose closes it again', () => {
            render(<Statuses characterPage={characterPageWith([])} userId="owner-1" />);
            expect(screen.queryByTestId('add-status-dialog')).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: '+ Add Status' }));
            expect(screen.getByTestId('add-status-dialog')).toBeInTheDocument();

            fireEvent.click(screen.getByText('close-dialog'));
            expect(screen.queryByTestId('add-status-dialog')).not.toBeInTheDocument();
        });
    });

    describe('onUpdateStatuses override (Director-controlled NPC path)', () => {
        test('when provided, writes go through onUpdateStatuses instead of Firestore directly', async () => {
            const onUpdateStatuses = jest.fn().mockResolvedValue(undefined);
            render(<Statuses characterPage={characterPageWith([haste])} userId="owner-1" onUpdateStatuses={onUpdateStatuses} hasWritePermissions={true} />);
            fireEvent.click(screen.getByText('Haste'));

            fireEvent.click(screen.getByRole('button', { name: '+' }));

            await waitFor(() => expect(onUpdateStatuses).toHaveBeenCalledWith([{ ...haste, stacks: 3 }]));
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        test('an explicit hasWritePermissions=false hides write controls even for the doc owner', () => {
            render(<Statuses characterPage={characterPageWith([haste])} userId="owner-1" hasWritePermissions={false} />);
            fireEvent.click(screen.getByText('Haste'));
            expect(screen.queryByRole('button', { name: '+' })).not.toBeInTheDocument();
        });

        test('an explicit hasWritePermissions=true grants write controls even for a non-owner', () => {
            render(<Statuses characterPage={characterPageWith([haste])} userId="stranger-1" hasWritePermissions={true} />);
            fireEvent.click(screen.getByText('Haste'));
            expect(screen.getByRole('button', { name: '+' })).toBeInTheDocument();
        });
    });
});
