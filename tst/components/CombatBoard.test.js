let mockCombat;
jest.mock('../../src/components/CombatContext', () => ({ useCombat: () => mockCombat }));
jest.mock('../../src/components/EntityTile', () => ({
    EntityTile: ({ tile, active }) => <div>Tile:{tile.kind === 'group' ? tile.key : (tile.member || tile).name}:{String(active)}</div>,
}));

// eslint-disable-next-line import/first
import { render, screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/first
import { EnemyTiles, PartyTiles, TurnOrder } from '../../src/components/CombatBoard';

const players = [{ id: 'character:a', name: 'Aria' }, { id: 'character:b', name: 'Bram' }];
const single = { kind: 'single', key: 'npc:g', member: { id: 'npc:g', name: 'Goblin' } };
const group = { kind: 'group', key: 'group:Regular:Goober', base: { name: 'Goober 1' }, members: [{ name: 'Goober 1', raw: { enemy_name: 'Goober 1' }, down: false }, { name: 'Goober 2', raw: { enemy_name: 'Goober 2' }, down: true }] };

beforeEach(() => {
    mockCombat = {
        players, tiles: [single, group], turn: { order: ['character:a', 'npc:g', 'group:Regular:Goober', 'character:b'], active: 'npc:g', round: 2 },
        api: { endTurn: jest.fn(), setActiveKey: jest.fn(), moveInOrder: jest.fn() },
    };
});

describe('PartyTiles', () => {
    test('is a tile for each player, with whose turn it is shown on theirs', () => {
        mockCombat.turn.active = 'character:b';
        render(<PartyTiles/>);
        expect(screen.getByText('Player Characters')).toBeInTheDocument();
        expect(screen.getByText('Tile:Aria:false')).toBeInTheDocument();
        expect(screen.getByText('Tile:Bram:true')).toBeInTheDocument();
    });

    test('is nothing for a campaign with no players', () => {
        mockCombat.players = [];
        const { container } = render(<PartyTiles/>);
        expect(container).toBeEmptyDOMElement();
    });
});

describe('EnemyTiles', () => {
    test('is a tile for each enemy or group, with the ways to add, stage and clear', () => {
        const onAdd = jest.fn();
        const onEncounters = jest.fn();
        const onClear = jest.fn();
        render(<EnemyTiles onAdd={onAdd} onEncounters={onEncounters} onClear={onClear}/>);
        expect(screen.getByText('Tile:Goblin:true')).toBeInTheDocument();
        expect(screen.getByText('Tile:group:Regular:Goober:false')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '+ Add Enemy' }));
        fireEvent.click(screen.getByRole('button', { name: 'Encounters' }));
        fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
        expect(onAdd).toHaveBeenCalled();
        expect(onEncounters).toHaveBeenCalled();
        expect(onClear).toHaveBeenCalled();
    });

    test('with no enemies it says how to fill the fight, and has nothing to clear', () => {
        mockCombat.tiles = [];
        render(<EnemyTiles onAdd={jest.fn()} onEncounters={jest.fn()} onClear={jest.fn()}/>);
        expect(screen.getByText(/No enemies in the fight/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();
    });
});

describe('TurnOrder', () => {
    test('shows everyone in the order, the acting one highlighted, and the round', () => {
        render(<TurnOrder/>);
        expect(screen.getAllByRole('button').filter(button => button.getAttribute('aria-pressed')).map(button => button.textContent)).toEqual(['Aria', 'Goblin', 'Goober ×1', 'Bram']);
        expect(screen.getByRole('button', { name: 'Goblin' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Aria' })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByText('Round 2')).toBeInTheDocument();
    });

    test('clicking someone gives them the turn', () => {
        render(<TurnOrder/>);
        fireEvent.click(screen.getByRole('button', { name: 'Bram' }));
        expect(mockCombat.api.setActiveKey).toHaveBeenCalledWith('character:b');
    });

    test('the acting one can be moved earlier or later', () => {
        render(<TurnOrder/>);
        fireEvent.click(screen.getByRole('button', { name: 'Move earlier in the order' }));
        expect(mockCombat.api.moveInOrder).toHaveBeenCalledWith('npc:g', -1);
        fireEvent.click(screen.getByRole('button', { name: 'Move later in the order' }));
        expect(mockCombat.api.moveInOrder).toHaveBeenCalledWith('npc:g', 1);
    });

    test('End turn hands it on', () => {
        render(<TurnOrder/>);
        fireEvent.click(screen.getByRole('button', { name: 'End turn →' }));
        expect(mockCombat.api.endTurn).toHaveBeenCalled();
    });

    test('before anyone has the turn it offers to start combat, with no arrows to move anyone', () => {
        mockCombat.turn.active = null;
        render(<TurnOrder/>);
        expect(screen.getByRole('button', { name: 'Start combat →' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Move earlier in the order' })).not.toBeInTheDocument();
    });

    test('with no one in the fight there is nothing to start', () => {
        mockCombat.turn = { order: [], active: null, round: 1 };
        render(<TurnOrder/>);
        expect(screen.getByText('No one in the fight yet.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start combat →' })).toBeDisabled();
    });
});
