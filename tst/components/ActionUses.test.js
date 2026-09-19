import { render, screen, fireEvent } from '@testing-library/react';
import { ActionUsesReset, ActionUsesTracker } from '../../src/components/ActionUses';

const fleetfoot = { actionName: 'Fleetfoot', actionType: 'perDay', actionTypeCount: 2 };
const rage = { actionName: 'Rage', actionType: 'perCombat', actionTypeCount: 1 };

describe('ActionUsesTracker', () => {
    test('shows the uses left out of the total, and how often they come back', () => {
        render(<ActionUsesTracker action={fleetfoot} uses={{ Fleetfoot: 1 }} canEdit onChange={jest.fn()} />);
        expect(screen.getByText('1 / 2')).toBeInTheDocument();
        expect(screen.getByText('per Day')).toBeInTheDocument();
    });

    test('spending a use gives the new map to onChange', () => {
        const onChange = jest.fn();
        render(<ActionUsesTracker action={fleetfoot} uses={{}} canEdit onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: 'Spend a use of Fleetfoot' }));
        expect(onChange).toHaveBeenCalledWith({ Fleetfoot: 1 });
    });

    test('giving a use back removes what was spent', () => {
        const onChange = jest.fn();
        render(<ActionUsesTracker action={fleetfoot} uses={{ Fleetfoot: 1 }} canEdit onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: 'Give back a use of Fleetfoot' }));
        expect(onChange).toHaveBeenCalledWith({});
    });

    test('cannot spend below 0 or give back above the total', () => {
        const { rerender } = render(<ActionUsesTracker action={rage} uses={{ Rage: 1 }} canEdit onChange={jest.fn()} />);
        expect(screen.getByText('0 / 1')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Spend a use of Rage' })).toBeDisabled();

        rerender(<ActionUsesTracker action={rage} uses={{}} canEdit onChange={jest.fn()} />);
        expect(screen.getByRole('button', { name: 'Give back a use of Rage' })).toBeDisabled();
    });

    test('someone who cannot edit only sees the count', () => {
        render(<ActionUsesTracker action={fleetfoot} uses={{}} canEdit={false} onChange={jest.fn()} />);
        expect(screen.getByText('2 / 2')).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    test('running out is marked', () => {
        render(<ActionUsesTracker action={rage} uses={{ Rage: 1 }} canEdit onChange={jest.fn()} />);
        expect(screen.getByRole('group', { name: 'Uses of Rage' })).toHaveClass('ActionUses-empty');
    });
});

describe('ActionUsesReset', () => {
    const actions = [fleetfoot, rage];

    test('has nothing to reset until a use is spent', () => {
        render(<ActionUsesReset actions={actions} uses={{}} onChange={jest.fn()} />);
        ['New combat', 'Short rest', 'New day'].forEach(name => expect(screen.getByRole('button', { name })).toBeDisabled());
    });

    test('each rest is available only if it would give something back', () => {
        render(<ActionUsesReset actions={actions} uses={{ Fleetfoot: 1 }} onChange={jest.fn()} />);
        expect(screen.getByRole('button', { name: 'New combat' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Short rest' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'New day' })).toBeEnabled();
    });

    test('a rest gives onChange the map with what it refreshes taken out', () => {
        const onChange = jest.fn();
        render(<ActionUsesReset actions={actions} uses={{ Fleetfoot: 1, Rage: 1 }} onChange={onChange} />);
        fireEvent.click(screen.getByRole('button', { name: 'New combat' }));
        expect(onChange).toHaveBeenCalledWith({ Fleetfoot: 1 });
    });
});
