jest.mock('../../src/utils/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), updateDoc: jest.fn() }));

// eslint-disable-next-line import/first
import { render, screen, within } from '@testing-library/react';
// eslint-disable-next-line import/first
import { PartyCombatRoster } from '../../src/components/PartyCombatRoster';

const status = { id: 's1', name: 'Prone', stacks: 1 };
const aria = {
    character_id: 'char-1', character_name: 'Aria', current_health: 8, maximum_health: 20,
    temporary_health: 0, hardness: 2, statuses: [], action_points: 2, reaction_used: false,
};
const bram = {
    character_id: 'char-2', character_name: 'Bram', current_health: 15, maximum_health: 15,
    temporary_health: 5, hardness: 0, statuses: [status], action_points: 0, reaction_used: true,
};

describe('PartyCombatRoster', () => {
    test('renders nothing at all with no one to show', () => {
        const { container } = render(<PartyCombatRoster characterList={[]}/>);
        expect(container).toBeEmptyDOMElement();
    });

    test('the fourth action point pip, the one haste gives, has its own colour', () => {
        render(<PartyCombatRoster characterList={[{ ...aria, action_points: 4 }]}/>);
        const round = screen.getByLabelText(/4 of 4 action points/);
        expect(within(round).getAllByText('', { selector: '.PartyCombatRoster-pip-haste' })).toHaveLength(1);
        expect(within(round).getAllByText('', { selector: '.PartyCombatRoster-pip-filled' })).toHaveLength(4);
    });

    test('shows every party member\'s name and HP', () => {
        render(<PartyCombatRoster characterList={[aria, bram]}/>);
        expect(screen.getByText('Aria')).toBeInTheDocument();
        expect(screen.getByText('8/20 HP')).toBeInTheDocument();
        expect(screen.getByText('Bram')).toBeInTheDocument();
        expect(screen.getByText('15/15 HP')).toBeInTheDocument();
    });

    test('shows temp HP only for whoever has any', () => {
        render(<PartyCombatRoster characterList={[aria, bram]}/>);
        expect(screen.getByText('+5 temp')).toBeInTheDocument();
        expect(screen.queryByText('+0 temp')).not.toBeInTheDocument();
    });

    test('shows each member\'s hardness, 0 when there is none', () => {
        render(<PartyCombatRoster characterList={[aria, bram]}/>);
        expect(screen.getByText('Hardness 2')).toBeInTheDocument();
        expect(screen.getByText('Hardness 0')).toBeInTheDocument();
    });

    test('shows a member\'s statuses, and nobody without any shows the section as empty-but-present', () => {
        render(<PartyCombatRoster characterList={[aria, bram]}/>);
        expect(screen.getByText('Prone')).toBeInTheDocument();
    });

    test('is read-only - no way to remove a status or add one from here', () => {
        render(<PartyCombatRoster characterList={[bram]}/>);
        expect(screen.queryByText('+ Add Status')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    });

    test('an unnamed character still gets a card, not a crash', () => {
        render(<PartyCombatRoster characterList={[{ character_id: 'char-3' }]}/>);
        expect(screen.getByText('Unnamed')).toBeInTheDocument();
        expect(screen.getByText('0/0 HP')).toBeInTheDocument();
    });

    test('a status\'s stat-boosted hardness (see getEffectiveCharacterStats) is reflected, not just the raw field', () => {
        const boosted = { ...aria, hardness: 2, statuses: [{ id: 's2', name: 'Iron Skin', stacks: 1, effects: [{ trigger: 'passive', stat: 'hardness', delta: 3 }] }] };
        render(<PartyCombatRoster characterList={[boosted]}/>);
        expect(within(screen.getByText('Aria').closest('.PartyCombatRoster-card')).getByText('Hardness 5')).toBeInTheDocument();
    });

    describe('action points and reaction, so a teammate can see the current round at a glance', () => {
        test('shows each member\'s current action points', () => {
            render(<PartyCombatRoster characterList={[aria, bram]}/>);
            expect(screen.getByText('AP 2/4')).toBeInTheDocument();
            expect(screen.getByText('AP 0/4')).toBeInTheDocument();
        });

        test('shows whether a member\'s reaction is still available or already used', () => {
            render(<PartyCombatRoster characterList={[aria, bram]}/>);
            expect(screen.getByText('Reaction ready')).toBeInTheDocument();
            expect(screen.getByText('Reaction used')).toBeInTheDocument();
        });

        test('a member with no action_points field yet shows 0, not a crash', () => {
            render(<PartyCombatRoster characterList={[{ character_id: 'char-3' }]}/>);
            expect(screen.getByText('AP 0/4')).toBeInTheDocument();
            expect(screen.getByText('Reaction ready')).toBeInTheDocument();
        });
    });
});
