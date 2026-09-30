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
const chipButton = name => screen.getByRole('button', { name: new RegExp(`^${name}`) });
const wounded = { id: 'status-2', name: 'Wounded', polarity: 'debuff', stacks: 0, description: 'Ouch.' };

function characterPageWith(statuses, overrides = {}) {
    return { character_id: 'char-1', userId: 'owner-1', statuses, ...overrides };
}

beforeEach(() => {
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockUpdateDoc.mockResolvedValue(undefined);
    window.alert = jest.fn();
    window.confirm = jest.fn().mockReturnValue(true);
});

afterEach(() => {
    delete window.alert;
    delete window.confirm;
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

    describe('chip colors', () => {
        const chipOf = name => screen.getByText(name).closest('button');

        test('a status uses the color of its type', () => {
            render(<Statuses characterPage={characterPageWith([haste, { id: 's-t', name: 'Stance', polarity: 'token', stacks: -1 }])} userId="owner-1" />);
            expect(chipOf('Haste')).toHaveClass('CharacterPage-status-chip-buff');
            expect(chipOf('Stance')).toHaveClass('CharacterPage-status-chip-token');
            expect(chipOf('Haste')).not.toHaveClass('CharacterPage-status-chip-custom');
            expect(chipOf('Haste').style.getPropertyValue('--status-color')).toBe('');
        });

        test('a status with its own color wears it', () => {
            render(<Statuses characterPage={characterPageWith([{ ...haste, color: '#1abc9c' }])} userId="owner-1" />);
            expect(chipOf('Haste')).toHaveClass('CharacterPage-status-chip-custom');
            expect(chipOf('Haste').style.getPropertyValue('--status-color')).toBe('#1abc9c');
            expect(chipOf('Haste').style.getPropertyValue('--status-on-color')).toBe('#1b1b1f');
        });

        test('a token has its detail and stacks like any other status', () => {
            render(<Statuses characterPage={characterPageWith([{ id: 's-t', name: 'Stance', polarity: 'token', stacks: -1, description: 'In the stance.' }])} userId="owner-1" />);
            fireEvent.click(chipButton('Stance'));
            expect(screen.getByText('In the stance.')).toBeInTheDocument();
            expect(screen.getByText('None')).toBeInTheDocument();
        });
    });

    describe('a status with no stack count (-1)', () => {
        const prone = { id: 'status-3', name: 'Prone', polarity: 'debuff', stacks: -1, description: 'On the ground.' };

        test('shows no badge on its chip and "None" for its stacks', () => {
            render(<Statuses characterPage={characterPageWith([prone])} userId="owner-1" />);
            expect(screen.queryByText('-1')).not.toBeInTheDocument();

            fireEvent.click(chipButton('Prone'));

            expect(screen.getByText('None')).toBeInTheDocument();
            expect(screen.queryByText('-1')).not.toBeInTheDocument();
        });

        test('a viewer who cannot edit sees "None" too', () => {
            render(<Statuses characterPage={characterPageWith([prone])} userId="stranger-1" />);

            fireEvent.click(chipButton('Prone'));

            expect(screen.getByText('None')).toBeInTheDocument();
        });

        test('+ gives it a count, starting at 0, and 0 can step back down to none', async () => {
            render(<Statuses characterPage={characterPageWith([prone])} userId="owner-1" />);
            fireEvent.click(chipButton('Prone'));

            fireEvent.click(screen.getByRole('button', { name: '+' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { statuses: [{ ...prone, stacks: 0 }] }));
        });
    });

    test('a status description renders as Markdown', () => {
        render(<Statuses characterPage={characterPageWith([{ ...haste, description: 'You are **hasted**.' }])} userId="owner-1" />);

        fireEvent.click(chipButton('Haste'));

        expect(screen.getByText('hasted').tagName).toBe('STRONG');
    });

    test('clicking a status chip opens its detail (description + stacks) as a popup, clicking it again closes it', () => {
        render(<Statuses characterPage={characterPageWith([haste])} userId="owner-1" />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        fireEvent.click(chipButton('Haste'));
        expect(screen.getByRole('dialog', { name: 'Haste details' })).toBeInTheDocument();
        expect(screen.getByText('You are hasted.')).toBeInTheDocument();

        fireEvent.click(chipButton('Haste'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('the popup closes from its × button, its backdrop, and Escape', () => {
        render(<Statuses characterPage={characterPageWith([haste])} userId="owner-1" />);
        const open = () => fireEvent.click(chipButton('Haste'));

        open();
        fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        open();
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        open();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('opening another status swaps the popup rather than stacking a second one', () => {
        render(<Statuses characterPage={characterPageWith([haste, wounded])} userId="owner-1" />);
        fireEvent.click(chipButton('Haste'));
        fireEvent.click(chipButton('Wounded'));

        expect(screen.getAllByRole('dialog')).toHaveLength(1);
        expect(screen.getByRole('dialog', { name: 'Wounded details' })).toBeInTheDocument();
    });

    test('removing a status closes its popup', async () => {
        render(<Statuses characterPage={characterPageWith([haste])} userId="owner-1" />);
        fireEvent.click(chipButton('Haste'));

        fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    describe('as a read-only viewer', () => {
        test('sees a plain stacks number, no stepper, no remove/add buttons', () => {
            render(<Statuses characterPage={characterPageWith([haste])} userId="stranger-1" />);
            fireEvent.click(chipButton('Haste'));

            expect(screen.queryByRole('button', { name: '+' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: '−' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: '+ Add Status' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Clear All' })).not.toBeInTheDocument();
        });
    });

    describe('as a writer (owner)', () => {
        test('sees the stepper, remove button, and add-status button', () => {
            render(<Statuses characterPage={characterPageWith([haste])} userId="owner-1" />);
            fireEvent.click(chipButton('Haste'));

            expect(screen.getByRole('button', { name: '+' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: '−' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: '+ Add Status' })).toBeInTheDocument();
        });

        test('clicking + increases stacks by 1 and writes the whole updated statuses array', async () => {
            render(<Statuses characterPage={characterPageWith([haste])} userId="owner-1" />);
            fireEvent.click(chipButton('Haste'));

            fireEvent.click(screen.getByRole('button', { name: '+' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { statuses: [{ ...haste, stacks: 3 }] });
        });

        test('clicking − decreases stacks by 1', async () => {
            render(<Statuses characterPage={characterPageWith([haste])} userId="owner-1" />);
            fireEvent.click(chipButton('Haste'));

            fireEvent.click(screen.getByRole('button', { name: '−' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { statuses: [{ ...haste, stacks: 1 }] }));
        });

        test('the − stepper is disabled at no stack count (-1) and the + stepper is disabled at 9', () => {
            render(<Statuses characterPage={characterPageWith([{ ...wounded, stacks: -1 }, { ...haste, stacks: 9 }])} userId="owner-1" />);

            fireEvent.click(chipButton('Wounded'));
            expect(screen.getByRole('button', { name: '−' })).toBeDisabled();
            fireEvent.click(chipButton('Wounded')); // collapse it again before expanding the other

            fireEvent.click(chipButton('Haste'));
            expect(screen.getByRole('button', { name: '+' })).toBeDisabled();
        });

        test('clicking Remove writes the statuses array with that status filtered out', async () => {
            render(<Statuses characterPage={characterPageWith([haste, wounded])} userId="owner-1" />);
            fireEvent.click(chipButton('Haste'));

            fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { statuses: [wounded] }));
        });

        test('a write error is alerted', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            render(<Statuses characterPage={characterPageWith([haste])} userId="owner-1" />);
            fireEvent.click(chipButton('Haste'));

            fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

            await waitFor(() => expect(window.alert).toHaveBeenCalled());
        });

        test('Clear All is hidden with no statuses, shown once there are some', () => {
            const { rerender } = render(<Statuses characterPage={characterPageWith([])} userId="owner-1" />);
            expect(screen.queryByRole('button', { name: 'Clear All' })).not.toBeInTheDocument();

            rerender(<Statuses characterPage={characterPageWith([haste])} userId="owner-1" />);
            expect(screen.getByRole('button', { name: 'Clear All' })).toBeInTheDocument();
        });

        test('Clear All asks for confirmation, then writes an empty statuses array', async () => {
            render(<Statuses characterPage={characterPageWith([haste, wounded])} userId="owner-1" />);

            fireEvent.click(screen.getByRole('button', { name: 'Clear All' }));

            expect(window.confirm).toHaveBeenCalledWith('Remove all 2 statuses?');
            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { statuses: [] }));
        });

        test('Clear All does nothing if the confirmation is declined', () => {
            window.confirm.mockReturnValue(false);
            render(<Statuses characterPage={characterPageWith([haste])} userId="owner-1" />);

            fireEvent.click(screen.getByRole('button', { name: 'Clear All' }));

            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        test('a Clear All write error is alerted', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            render(<Statuses characterPage={characterPageWith([haste])} userId="owner-1" />);

            fireEvent.click(screen.getByRole('button', { name: 'Clear All' }));

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
            fireEvent.click(chipButton('Haste'));

            fireEvent.click(screen.getByRole('button', { name: '+' }));

            await waitFor(() => expect(onUpdateStatuses).toHaveBeenCalledWith([{ ...haste, stacks: 3 }]));
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        test('an explicit hasWritePermissions=false hides write controls even for the doc owner', () => {
            render(<Statuses characterPage={characterPageWith([haste])} userId="owner-1" hasWritePermissions={false} />);
            fireEvent.click(chipButton('Haste'));
            expect(screen.queryByRole('button', { name: '+' })).not.toBeInTheDocument();
        });

        test('an explicit hasWritePermissions=true grants write controls even for a non-owner', () => {
            render(<Statuses characterPage={characterPageWith([haste])} userId="stranger-1" hasWritePermissions={true} />);
            fireEvent.click(chipButton('Haste'));
            expect(screen.getByRole('button', { name: '+' })).toBeInTheDocument();
        });
    });
});
