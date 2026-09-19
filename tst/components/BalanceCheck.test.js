import { render, screen, fireEvent, within } from '@testing-library/react';
import { BalanceCheck } from '../../src/components/BalanceCheck';

const enemy = (tier, hp, ac, ap, name = `${tier} 1`) => ({ enemy_name: name, enemy_type: tier, maximum_health: hp, base_armor_class: ac, action_points: ap });
const entry = (stats, count = 1) => ({ id: stats.enemy_name, count, enemy: stats });

// a set-piece-sized roster: 60 + 2 x 25 + 3 x 4 = 122 HP and 15 actions
const roster = [entry(enemy('Captain', 60, 17, 3)), entry(enemy('Regular', 25, 14, 3), 2), entry(enemy('Goon', 4, 13, 2), 3)];

function setup(props = {}) {
    const onTarget = jest.fn();
    const onObjective = jest.fn();
    render(<BalanceCheck roster={roster} target="" objective="" zoneCount={0} onTarget={onTarget} onObjective={onObjective} {...props} />);
    return { onTarget, onObjective, card: screen.getByLabelText('Balance check') };
}

describe('BalanceCheck', () => {
    test('says it is a benchmark for a Level 1 party, not a rule', () => {
        setup();
        expect(screen.getByText(/starting benchmark for a five-character Level 1 party, not a rule/)).toBeInTheDocument();
    });

    describe('the controls', () => {
        test('offer each difficulty, with the target marked', () => {
            setup({ target: 'hard' });
            const group = screen.getByRole('group', { name: 'Target difficulty' });
            expect(within(group).getAllByRole('button').map(button => button.textContent)).toEqual(['Easy', 'Standard', 'Hard', 'Set Piece']);
            expect(within(group).getByRole('button', { name: 'Hard' })).toHaveAttribute('aria-pressed', 'true');
            expect(within(group).getByRole('button', { name: 'Easy' })).toHaveAttribute('aria-pressed', 'false');
        });

        test('picking a difficulty reports it, and picking the chosen one again clears it', () => {
            const { onTarget } = setup({ target: 'hard' });
            fireEvent.click(screen.getByRole('button', { name: 'Standard' }));
            expect(onTarget).toHaveBeenLastCalledWith('standard');
            fireEvent.click(screen.getByRole('button', { name: 'Hard' }));
            expect(onTarget).toHaveBeenLastCalledWith('');
        });

        test('the objective is chosen from None and the four loads, showing the party actions each takes', () => {
            const { onObjective } = setup({ objective: '' });
            const select = screen.getByLabelText('Secondary objective');
            expect([...select.options].map(option => option.text)).toEqual([
                'None', 'Light (1-2 party actions)', 'Moderate (3-5 party actions)', 'Heavy (6-9 party actions)', 'Primary objective (10+ party actions)',
            ]);
            fireEvent.change(select, { target: { value: 'heavy' } });
            expect(onObjective).toHaveBeenCalledWith('heavy');
        });

        test('show the saved choices', () => {
            setup({ target: 'standard', objective: 'moderate' });
            expect(screen.getByLabelText('Secondary objective')).toHaveValue('moderate');
        });
    });

    describe('with no enemies', () => {
        test('invites you to add some, and shows no numbers', () => {
            setup({ roster: [], target: 'standard' });
            expect(screen.getByText('Add enemies to see how the fight compares.')).toBeInTheDocument();
            expect(screen.queryByText('Enemy HP')).not.toBeInTheDocument();
        });
    });

    describe('with enemies', () => {
        test('shows the enemy HP and actions totals', () => {
            const { card } = setup();
            expect(within(card).getByText('Enemy HP').parentElement).toHaveTextContent('122');
            expect(within(card).getByText('Enemy actions at start').parentElement).toHaveTextContent('15');
        });

        test('says which difficulty the HP amounts to, without any target chosen', () => {
            setup();
            expect(screen.getByText('Set Piece (120-160 EHP, 6-8 rounds)')).toBeInTheDocument();
            expect(screen.queryByText(/target /)).not.toBeInTheDocument();
        });

        test('with a target, shows its ranges and how far over the fight is', () => {
            const { card } = setup({ target: 'standard' });
            const hp = within(card).getByText('Enemy HP').parentElement;
            expect(hp).toHaveTextContent('target 65-90');
            expect(hp).toHaveTextContent('32 over');
            const actions = within(card).getByText('Enemy actions at start').parentElement;
            expect(actions).toHaveTextContent('target 6-8');
            expect(actions).toHaveTextContent('7 over');
        });

        test('shows "On target" (as a good sign) when within the range', () => {
            const { card } = setup({ target: 'setpiece' });
            const hp = within(card).getByText('Enemy HP').parentElement;
            expect(hp).toHaveTextContent('On target');
            expect(within(hp).getByText('On target')).toHaveClass('BalanceCheck-status-good');
        });

        test('and a warning when under or over', () => {
            const { card } = setup({ target: 'standard' });
            expect(within(within(card).getByText('Enemy HP').parentElement).getByText('32 over')).toHaveClass('BalanceCheck-status-warn');
        });

        test('an under-budget fight says how far under', () => {
            const { card } = setup({ roster: [entry(enemy('Goon', 4, 13, 1), 2)], target: 'easy' });
            expect(within(within(card).getByText('Enemy HP').parentElement).getByText('32 under')).toBeInTheDocument();
        });

        test('an objective shows its adjustment and the HP range it leaves', () => {
            const { card } = setup({ target: 'standard', objective: 'moderate' });
            expect(screen.getByText('Moderate objective: Reduce enemy EHP by about 10-15%, or remove one minor enemy.')).toBeInTheDocument();
            const hp = within(card).getByText('Enemy HP').parentElement;
            expect(hp).toHaveTextContent('target 55-81');
            expect(hp).toHaveTextContent('adjusted for the objective from 65-90');
        });

        test('a light objective shows no adjusted range', () => {
            const { card } = setup({ target: 'standard', objective: 'light' });
            expect(within(card).getByText('Enemy HP').parentElement).toHaveTextContent('target 65-90');
            expect(screen.queryByText(/adjusted for the objective/)).not.toBeInTheDocument();
        });

        test('a primary objective leaves HP with no target, and says enemies are pressure', () => {
            const { card } = setup({ target: 'standard', objective: 'primary' });
            const hp = within(card).getByText('Enemy HP').parentElement;
            expect(hp).not.toHaveTextContent('target');
            expect(hp).not.toHaveTextContent('over');
            expect(screen.getByText(/Enemies should mostly provide pressure/)).toBeInTheDocument();
        });

        test('shows the map\'s zones against the target only when there is a map and a target', () => {
            const { card } = setup({ target: 'standard', zoneCount: 5 });
            const zones = within(card).getByText('Zones on the map').parentElement;
            expect(zones).toHaveTextContent('5');
            expect(zones).toHaveTextContent('target 3-4');
            expect(zones).toHaveTextContent('1 over');
        });

        test('no zones line without a map, or without a target', () => {
            setup({ target: 'standard', zoneCount: 0 });
            expect(screen.queryByText('Zones on the map')).not.toBeInTheDocument();
        });

        test('no zones line without a target', () => {
            setup({ target: '', zoneCount: 4 });
            expect(screen.queryByText('Zones on the map')).not.toBeInTheDocument();
        });

        test('reminds you that HP is printed HP, and what else counts toward it', () => {
            setup();
            expect(screen.getByText(/printed HP and each enemy's action points/)).toBeInTheDocument();
            expect(screen.getByText(/Resistance, healing, temporary HP, defensive reactions and summons/)).toBeInTheDocument();
        });

        test('counts the enemies outside their role\'s benchmarks, and points to their rows', () => {
            setup();
            expect(screen.getByText(/1 enemy is outside its role's benchmarks - see the flags on its row below\./)).toBeInTheDocument();
        });

        test('says nothing about benchmarks when every enemy is inside them', () => {
            setup({ roster: [entry(enemy('Regular', 15, 14, 2))] });
            expect(screen.queryByText(/outside/)).not.toBeInTheDocument();
        });

        test('says how many when several are outside', () => {
            setup({ roster: [entry(enemy('Regular', 25, 14, 2)), entry(enemy('Goon', 20, 13, 1, 'Big Goon'))] });
            expect(screen.getByText(/2 enemies are outside their roles' benchmarks - see the flags on their rows below\./)).toBeInTheDocument();
        });
    });
});
