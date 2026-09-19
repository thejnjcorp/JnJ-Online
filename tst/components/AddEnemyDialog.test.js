let mockBestiary;
jest.mock('../../src/utils/useBestiary', () => ({ useBestiary: () => mockBestiary }));

// eslint-disable-next-line import/first
import { render, screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/first
import { AddEnemyDialog } from '../../src/components/AddEnemyDialog';

const wolf = { id: 'e1', enemy_name: 'Wolf', enemy_type: 'Regular', maximum_health: 20, base_armor_class: 13, action_points: 3, actions: [] };

function open(existing = [], props = {}) {
    mockBestiary = { enemies: [wolf], status: 'ready' };
    const on = { onAdd: jest.fn(), onClose: jest.fn(), ...props };
    render(<AddEnemyDialog existing={existing} {...on}/>);
    return on;
}

describe('AddEnemyDialog', () => {
    test('is a dialog for adding an enemy, listing the bestiary', () => {
        open();
        expect(screen.getByRole('dialog', { name: 'Add enemy' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Wolf/ })).toBeInTheDocument();
    });

    test('picking an enemy adds a live one at full health, and the dialog stays for more', () => {
        const on = open();
        fireEvent.click(screen.getByRole('button', { name: /Wolf/ }));

        const added = on.onAdd.mock.calls[0][0];
        expect(added).toMatchObject({ enemy_name: 'Wolf', enemy_type: 'Regular', maximum_health: 20, current_health: 20, action_points: 3, statuses: [] });
        expect(typeof added.id).toBe('string');
        expect(added.id).not.toBe('e1'); // its own enemy, not the bestiary's
        expect(on.onClose).not.toHaveBeenCalled();
    });

    test('another of the same enemy is numbered so it does not repeat a name already in the fight', () => {
        const on = open([{ enemy_name: 'Wolf' }, { enemy_name: 'Wolf 2' }]);
        fireEvent.click(screen.getByRole('button', { name: /Wolf/ }));
        expect(on.onAdd.mock.calls[0][0].enemy_name).toBe('Wolf 3');
    });

    test('Done, Escape and the backdrop close it', () => {
        const on = open();
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(on.onClose).toHaveBeenCalledTimes(3);
    });
});
