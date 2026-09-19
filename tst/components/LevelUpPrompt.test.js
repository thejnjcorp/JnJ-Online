jest.mock('../../src/utils/firebase', () => ({ db: {} }));
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...path) => ({ __doc: path.slice(1) }),
    updateDoc: (...args) => mockUpdateDoc(...args),
}));

// eslint-disable-next-line import/first
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
// eslint-disable-next-line import/first
import { LevelUpPrompt } from '../../src/components/LevelUpPrompt';

const character = {
    character_id: 'char-1', userId: 'owner-1', canWrite: ['owner-1'], experience_points: 2000,
    strength_stat: 4, dexterity_stat: 3, intelligence_stat: 2, charisma_stat: 1, maximum_health: 10,
    actions: [{ actionName: 'Start' }, { actionName: 'Fleetfoot', actionLevel: 3 }],
    level_rewards: [
        { id: 'sp', level: 2, kind: 'stat_point', points: 1 },
        { id: 'ac', level: 2, kind: 'bonus', stat: 'armor_class', amount: 1 },
        { id: 'hp', level: 3, kind: 'bonus', stat: 'maximum_health', amount: 5 },
        { id: 'nt', level: 3, kind: 'note', text: 'Pick a Stance' },
    ],
};

beforeEach(() => {
    mockUpdateDoc.mockResolvedValue(undefined);
    jest.spyOn(window, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

const open = () => fireEvent.click(screen.getByRole('button', { name: 'Level up' }));
const confirm = () => screen.getByRole('button', { name: 'Confirm level-up' });

describe('LevelUpPrompt', () => {
    describe('the banner', () => {
        test('says which levels have rewards waiting', () => {
            render(<LevelUpPrompt character={character} userId="owner-1"/>);
            expect(screen.getByRole('status')).toHaveTextContent('Levels 2, 3 reached');
        });

        test('a single level is worded as one', () => {
            render(<LevelUpPrompt character={{ ...character, experience_points: 1000 }} userId="owner-1"/>);
            expect(screen.getByRole('status')).toHaveTextContent('Level 2 reached');
        });

        test.each([
            ['a character with nothing to claim', { ...character, claimed_level: 3 }, 'owner-1'],
            ['a character below level 2', { ...character, experience_points: 500 }, 'owner-1'],
            ['someone who cannot edit the sheet', character, 'stranger-1'],
            ['someone signed out', character, ''],
        ])('is not shown for %s', (_name, who, userId) => {
            const { container } = render(<LevelUpPrompt character={who} userId={userId}/>);
            expect(container).toBeEmptyDOMElement();
        });

        test('a co-editor in canWrite (a director) sees it', () => {
            render(<LevelUpPrompt character={{ ...character, userId: 'someone-else', canWrite: ['someone-else', 'dm'] }} userId="dm"/>);
            expect(screen.getByRole('button', { name: 'Level up' })).toBeInTheDocument();
        });
    });

    describe('the dialog', () => {
        test('shows each level with its rewards, new actions, and what will happen', () => {
            render(<LevelUpPrompt character={character} userId="owner-1"/>);
            open();

            const dialog = screen.getByRole('dialog', { name: 'Level up' });
            expect(within(dialog.querySelector('[aria-label="Level 2"]')).getByText(/\+1 Armor Class/)).toHaveTextContent('applied automatically');
            const three = within(dialog.querySelector('[aria-label="Level 3"]'));
            expect(three.getByText(/New: Fleetfoot/)).toBeInTheDocument();
            expect(three.getByText(/\+5 Maximum Health/)).toBeInTheDocument();
            expect(three.getByText('Pick a Stance')).toBeInTheDocument();
        });

        test('a stat point offers the four abilities with what each would become', () => {
            render(<LevelUpPrompt character={character} userId="owner-1"/>);
            open();

            const group = screen.getByRole('group', { name: /\+1 to an ability score/ });
            expect(within(group).getAllByRole('radio').map(radio => radio.value)).toEqual(['strength_stat', 'dexterity_stat', 'intelligence_stat', 'charisma_stat']);
            expect(within(group).getByText('4 → 5')).toBeInTheDocument();
            expect(within(group).getByText('1 → 2')).toBeInTheDocument();
        });

        test('cannot be confirmed until every stat point has somewhere to go', () => {
            render(<LevelUpPrompt character={character} userId="owner-1"/>);
            open();
            expect(confirm()).toBeDisabled();
            expect(screen.getByText(/Choose where each stat point goes/)).toBeInTheDocument();

            fireEvent.click(screen.getByRole('radio', { name: /Intelligence/ }));

            expect(confirm()).toBeEnabled();
            expect(screen.queryByText(/Choose where each stat point goes/)).not.toBeInTheDocument();
        });

        test('confirming writes the whole claim to the character and closes', async () => {
            render(<LevelUpPrompt character={character} userId="owner-1"/>);
            open();
            fireEvent.click(screen.getByRole('radio', { name: /Intelligence/ }));

            fireEvent.click(confirm());

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
            const [target, changes] = mockUpdateDoc.mock.calls[0];
            expect(target).toEqual({ __doc: ['characters', 'char-1'] });
            expect(changes).toMatchObject({ intelligence_stat: 3, maximum_health: 15, level_bonuses: { armor_class: 1 }, claimed_level: 3 });
            expect(changes.level_history).toHaveLength(2);
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        });

        test('"Not yet" closes it without writing, and the banner stays', () => {
            render(<LevelUpPrompt character={character} userId="owner-1"/>);
            open();

            fireEvent.click(screen.getByRole('button', { name: 'Not yet' }));

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(screen.getByRole('status')).toBeInTheDocument();
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        test('Escape and the backdrop close it too', () => {
            render(<LevelUpPrompt character={character} userId="owner-1"/>);
            open();
            fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

            open();
            fireEvent.click(screen.getByRole('button', { name: 'Close' }));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        test('a failed save is reported, and the dialog stays for another try', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            render(<LevelUpPrompt character={character} userId="owner-1"/>);
            open();
            fireEvent.click(screen.getByRole('radio', { name: /Strength/ }));

            fireEvent.click(confirm());

            await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('offline')));
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            await waitFor(() => expect(confirm()).toBeEnabled());
        });
    });
});
