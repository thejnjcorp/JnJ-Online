let mockBestiary;
jest.mock('../../src/utils/useBestiary', () => ({ useBestiary: () => mockBestiary }));

// eslint-disable-next-line import/first
import { render, screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/first
import { EnemyPicker } from '../../src/components/EnemyPicker';

const enemies = [
    { id: 'e1', enemy_name: 'Wolf', enemy_type: 'Regular', maximum_health: 20, base_armor_class: 13 },
    { id: 'e2', enemy_name: 'Rust Bandit', enemy_type: 'Goon', maximum_health: 8, base_armor_class: 11 },
    { id: 'e3', enemy_name: 'Iron Captain', enemy_type: 'Captain', maximum_health: 90, base_armor_class: 17 },
];

function renderPicker(status = 'ready', list = enemies, props = {}) {
    mockBestiary = { enemies: list, status };
    return render(<EnemyPicker onPick={jest.fn()} onClose={jest.fn()} {...props}/>);
}

describe('EnemyPicker', () => {
    test('lists the bestiary by name, with tier, HP and AC', () => {
        renderPicker();
        const options = screen.getAllByRole('button').filter(button => button.className.includes('picker-option'));
        expect(options.map(option => option.querySelector('span').textContent)).toEqual(['Iron Captain', 'Rust Bandit', 'Wolf']);
        expect(screen.getByText('90 HP · AC 17')).toBeInTheDocument();
        expect(screen.getByText('Captain')).toBeInTheDocument();
    });

    test('choosing one gives it to onPick, and the list stays open for another', () => {
        const onPick = jest.fn();
        renderPicker('ready', enemies, { onPick });

        fireEvent.click(screen.getByRole('button', { name: /Wolf/ }));
        fireEvent.click(screen.getByRole('button', { name: /Wolf/ }));

        expect(onPick).toHaveBeenCalledTimes(2);
        expect(onPick).toHaveBeenCalledWith(enemies[0]);
    });

    test('search narrows it, without regard to case', () => {
        renderPicker();
        fireEvent.change(screen.getByRole('searchbox', { name: 'Search the bestiary' }), { target: { value: 'BAND' } });
        expect(screen.getByRole('button', { name: /Rust Bandit/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Wolf/ })).not.toBeInTheDocument();
    });

    test('the tier menu keeps just that tier', () => {
        renderPicker();
        fireEvent.change(screen.getByRole('combobox', { name: 'Tier' }), { target: { value: 'Goon' } });
        expect(screen.getByRole('button', { name: /Rust Bandit/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Iron Captain/ })).not.toBeInTheDocument();
    });

    test('says so when nothing matches, when the bestiary is empty, while loading, and on error', () => {
        const { unmount } = renderPicker();
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } });
        expect(screen.getByText('No enemies match.')).toBeInTheDocument();
        unmount();

        const empty = renderPicker('ready', []);
        expect(screen.getByText(/Your bestiary is empty/)).toBeInTheDocument();
        empty.unmount();

        const loading = renderPicker('loading', []);
        expect(screen.getByText('Loading the bestiary…')).toBeInTheDocument();
        loading.unmount();

        renderPicker('error', []);
        expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load the bestiary");
    });

    test('Done calls onClose', () => {
        const onClose = jest.fn();
        renderPicker('ready', enemies, { onClose });
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(onClose).toHaveBeenCalled();
    });
});
