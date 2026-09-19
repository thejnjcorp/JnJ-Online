import { render, screen, fireEvent, within } from '@testing-library/react';
import { BalanceGuide } from '../../src/components/BalanceGuide';

describe('BalanceGuide', () => {
    test('starts closed, as a bar that says what it is', () => {
        render(<BalanceGuide />);
        const toggle = screen.getByRole('button', { name: /Balance guide/ });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByText('Level 1 encounter cheat sheet')).toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
        expect(screen.queryByRole('group', { name: 'Guide sections' })).not.toBeInTheDocument();
    });

    test('opens and closes', () => {
        render(<BalanceGuide />);
        const toggle = screen.getByRole('button', { name: /Balance guide/ });

        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('group', { name: 'Guide sections' })).toBeInTheDocument();

        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('group', { name: 'Guide sections' })).not.toBeInTheDocument();
    });

    test('opens on the enemy stats, with the benchmark table', () => {
        render(<BalanceGuide />);
        fireEvent.click(screen.getByRole('button', { name: /Balance guide/ }));

        const sections = screen.getByRole('group', { name: 'Guide sections' });
        expect(within(sections).getAllByRole('button').map(button => button.textContent)).toEqual(['Enemy stats', 'Damage & AC', 'HP & actions', 'Build steps', 'Objectives']);
        expect(within(sections).getByRole('button', { name: 'Enemy stats' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByText('1. Quick Enemy Benchmark Bank')).toBeInTheDocument();
        const table = screen.getByRole('table');
        expect(within(table).getByRole('rowheader', { name: 'REGULAR' }).parentElement).toHaveTextContent('12-18');
        expect(screen.getByText('Calibration')).toBeInTheDocument();
    });

    test('shows one section at a time', () => {
        render(<BalanceGuide />);
        fireEvent.click(screen.getByRole('button', { name: /Balance guide/ }));

        fireEvent.click(screen.getByRole('button', { name: 'HP & actions' }));

        expect(screen.getByText('4. Effective HP (EHP) Bank')).toBeInTheDocument();
        expect(screen.getByText('5. Enemy Action Economy Bank')).toBeInTheDocument();
        expect(screen.getByText('Summon Warning')).toBeInTheDocument();
        expect(screen.queryByText('1. Quick Enemy Benchmark Bank')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'HP & actions' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Enemy stats' })).toHaveAttribute('aria-pressed', 'false');
    });

    test.each([
        ['Damage & AC', '2. Damage Bank'],
        ['Build steps', '6. The Encounter-Building Algorithm'],
        ['Build steps', '12. Quick Build Card'],
        ['Objectives', '8. Secondary Objective Toolkit'],
        ['Objectives', '9. Progress Track Framework'],
    ])('the %s section has %s', (pill, heading) => {
        render(<BalanceGuide />);
        fireEvent.click(screen.getByRole('button', { name: /Balance guide/ }));
        fireEvent.click(screen.getByRole('button', { name: pill }));
        expect(screen.getByText(heading)).toBeInTheDocument();
    });

    test('tables have column and row headers, so they read properly to a screen reader', () => {
        render(<BalanceGuide />);
        fireEvent.click(screen.getByRole('button', { name: /Balance guide/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Objectives' }));

        const toolkit = screen.getAllByRole('table')[1];
        expect(within(toolkit).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(['Objective', 'Player Activity', 'Combat Consequence']);
        expect(within(toolkit).getByRole('rowheader', { name: 'Stop a Ritual' }).parentElement).toHaveTextContent('Failure summons enemies or buffs the boss');
    });

    test('remembers the section while it is closed and reopened', () => {
        render(<BalanceGuide />);
        const toggle = screen.getByRole('button', { name: /Balance guide/ });
        fireEvent.click(toggle);
        fireEvent.click(screen.getByRole('button', { name: 'Objectives' }));
        fireEvent.click(toggle);
        fireEvent.click(toggle);
        expect(screen.getByRole('button', { name: 'Objectives' })).toHaveAttribute('aria-pressed', 'true');
    });
});
