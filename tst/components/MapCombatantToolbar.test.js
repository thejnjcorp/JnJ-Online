import { render, screen, fireEvent, within } from '@testing-library/react';
import { MapCombatantToolbar } from '../../src/components/MapCombatantToolbar';

const goblin = { id: 'npc:g1', title: 'Goblin 1', kind: 'enemy', defeated: false };

function setup(combatant = goblin, props = {}) {
    const handlers = { onSetDefeated: jest.fn(), onRemove: jest.fn() };
    render(<MapCombatantToolbar combatant={combatant} {...handlers} {...props}/>);
    return handlers;
}

describe('MapCombatantToolbar', () => {
    test('is nothing when no combatant is selected', () => {
        const { container } = render(<MapCombatantToolbar combatant={undefined} onSetDefeated={jest.fn()} onRemove={jest.fn()}/>);
        expect(container).toBeEmptyDOMElement();
    });

    test('names the selected combatant', () => {
        setup();
        expect(within(screen.getByRole('toolbar', { name: 'Selected combatant' })).getByText('Goblin 1')).toBeInTheDocument();
    });

    test('offers to mark it defeated, giving its id and the new state', () => {
        const { onSetDefeated } = setup();
        fireEvent.click(screen.getByRole('button', { name: 'Mark defeated' }));
        expect(onSetDefeated).toHaveBeenCalledWith('npc:g1', true);
    });

    test('a defeated one says so, and offers to revive it instead', () => {
        const { onSetDefeated } = setup({ ...goblin, defeated: true });
        expect(screen.getByText('Goblin 1 - defeated')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Mark defeated' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Revive' }));
        expect(onSetDefeated).toHaveBeenCalledWith('npc:g1', false);
    });

    test('offers to take it out of the fight, giving the combatant', () => {
        const { onRemove } = setup();
        fireEvent.click(screen.getByRole('button', { name: 'Remove from fight' }));
        expect(onRemove).toHaveBeenCalledWith(goblin);
    });

    test('offers only what it has the means for', () => {
        setup(goblin, { onSetDefeated: undefined });
        expect(screen.queryByRole('button', { name: 'Mark defeated' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Remove from fight' })).toBeInTheDocument();
    });

    test('a combatant with no name is still called something', () => {
        setup({ ...goblin, title: '' });
        expect(screen.getByText('Combatant')).toBeInTheDocument();
    });
});
