jest.mock('../../src/utils/firebase', () => ({ db: {} }));
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...path) => ({ __doc: path.slice(1) }),
    updateDoc: (...args) => mockUpdateDoc(...args),
}));
const mockLoadClasses = jest.fn();
const mockLoadRaces = jest.fn();
jest.mock('../../src/utils/availableOptions', () => ({
    loadAvailableClasses: (...args) => mockLoadClasses(...args),
    loadAvailableRaces: (...args) => mockLoadRaces(...args),
}));

// eslint-disable-next-line import/first
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { CharacterAdminButton } from '../../src/components/CharacterAdmin';

const character = {
    character_id: 'char-1', character_name: 'Kodi', campaign: 'camp-1', playerId: 'player', admins: ['player'],
    class_id: 'monk', class_name: 'Monk', class_version: 2, race_id: 'kobold', race_name: 'Kobold', race_version: 1,
    strength_stat: 4, dexterity_stat: 3, intelligence_stat: 2, charisma_stat: 1,
    experience_points: 2500, maximum_health: 10, hardness: 0, claimed_level: 2, level_bonuses: { armor_class: 1 },
};
const campaign = { director_uid: 'dm', canWrite: ['dm'] };

const monk = { id: 'monk', class_name: 'Monk', version: 2, actions: [], canWrite: ['x'], admins: ['x'] };
const seer = { id: 'seer', class_name: 'The Seer', version: 4, class_type: 'Manipulator', description: 'Sees', base_armor_class: 12, actions: [{ actionName: 'Fortune Telling' }], canWrite: ['x'], admins: ['x'], public: true };
const kobold = { id: 'kobold', name: 'Kobold', version: 1, actions: [] };
const elf = { id: 'elf', name: 'Elf', version: 3, actions: [{ actionName: 'Keen' }] };

beforeEach(() => {
    mockUpdateDoc.mockResolvedValue(undefined);
    mockLoadClasses.mockResolvedValue([monk, seer]);
    mockLoadRaces.mockResolvedValue([kobold, elf]);
    jest.spyOn(window, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

async function openDialog(props = {}) {
    render(<CharacterAdminButton character={character} campaignInfo={campaign} userId="player" {...props}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Update character' }));
    const dialog = await screen.findByRole('dialog', { name: 'Update character' });
    await waitFor(() => expect(screen.getByLabelText('Class')).toBeEnabled());
    return dialog;
}

const field = label => screen.getByLabelText(label);
const save = () => screen.getByRole('button', { name: 'Save changes' });

describe('CharacterAdminButton', () => {
    describe('who sees it', () => {
        test.each([
            ['the player', 'player'],
            ['the campaign director', 'dm'],
        ])('%s', (_who, userId) => {
            render(<CharacterAdminButton character={character} campaignInfo={campaign} userId={userId}/>);
            expect(screen.getByRole('button', { name: 'Update character' })).toBeInTheDocument();
        });

        test.each([
            ['another player', 'stranger'],
            ['someone signed out', ''],
        ])('not %s', (_who, userId) => {
            const { container } = render(<CharacterAdminButton character={character} campaignInfo={campaign} userId={userId}/>);
            expect(container).toBeEmptyDOMElement();
        });
    });

    describe('the dialog', () => {
        test('loads what the campaign offers for the viewer, and shows the current values', async () => {
            await openDialog();

            expect(mockLoadClasses).toHaveBeenCalledWith('player', 'camp-1');
            expect(mockLoadRaces).toHaveBeenCalledWith('player', 'camp-1');
            expect(field('Name')).toHaveValue('Kodi');
            expect(field('Class')).toHaveValue('monk');
            expect(field('Race')).toHaveValue('kobold');
            expect(field('Strength')).toHaveValue(4);
            expect(field('Experience')).toHaveValue(2500);
            expect(field('Claimed level')).toHaveValue(2);
            expect(field('Armor Class bonus')).toHaveValue(1);
            expect(screen.getByText('Level 3 at this experience')).toBeInTheDocument();
        });

        test('a current class that the campaign does not offer is still shown, as the current one', async () => {
            mockLoadClasses.mockResolvedValue([seer]);
            await openDialog();
            expect(screen.getByRole('option', { name: 'Monk (current)' })).toBeInTheDocument();
            expect(field('Class')).toHaveValue('monk');
        });

        test('saving with nothing changed writes nothing and closes', async () => {
            await openDialog();
            fireEvent.click(save());
            expect(mockUpdateDoc).not.toHaveBeenCalled();
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        });

        test('saves only what was changed', async () => {
            await openDialog();
            fireEvent.change(field('Strength'), { target: { value: '6' } });
            fireEvent.change(field('Name'), { target: { value: '  Kodi the Bold ' } });
            fireEvent.change(field('Experience'), { target: { value: '4000' } });
            fireEvent.change(field('Hit Modifier bonus'), { target: { value: '2' } });

            fireEvent.click(save());

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
            const [target, changes] = mockUpdateDoc.mock.calls[0];
            expect(target).toEqual({ __doc: ['characters', 'char-1'] });
            expect(changes).toEqual({ strength_stat: 6, character_name: 'Kodi the Bold', experience_points: 4000, level_bonuses: { armor_class: 1, hit_modifier: 2 } });
        });

        test('bonuses set back to 0 are left out of level_bonuses, and the claimed level can be moved', async () => {
            await openDialog();
            fireEvent.change(field('Armor Class bonus'), { target: { value: '0' } });
            fireEvent.change(field('Claimed level'), { target: { value: '1' } });

            fireEvent.click(save());

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
            expect(mockUpdateDoc.mock.calls[0][1]).toEqual({ level_bonuses: {}, claimed_level: 1 });
        });

        describe('changing class', () => {
            test('warns what it does, and clears the old class\'s level-up bonuses in the form', async () => {
                await openDialog();
                fireEvent.change(field('Class'), { target: { value: 'seer' } });

                expect(screen.getByRole('status', {})).toHaveTextContent(/replaces the character's class actions and base stats/);
                expect(field('Armor Class bonus')).toHaveValue(0);
                expect(field('Claimed level')).toHaveValue(3); // the level it is at, so nothing is offered again
            });

            test('saves the new class\'s fields, pinned to its version, without its permissions', async () => {
                await openDialog();
                fireEvent.change(field('Class'), { target: { value: 'seer' } });

                fireEvent.click(save());

                await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
                const changes = mockUpdateDoc.mock.calls[0][1];
                expect(changes).toMatchObject({
                    class_id: 'seer', class_name: 'The Seer', class_version: 4, class_type: 'Manipulator',
                    class_description: 'Sees', base_armor_class: 12, actions: [{ actionName: 'Fortune Telling' }],
                    level_bonuses: {}, claimed_level: 3,
                });
                ['canWrite', 'admins', 'public', 'canRead'].forEach(key => expect(changes).not.toHaveProperty(key));
            });

            test('going back to the original class restores its bonuses and claimed level', async () => {
                await openDialog();
                fireEvent.change(field('Class'), { target: { value: 'seer' } });
                fireEvent.change(field('Class'), { target: { value: 'monk' } });

                expect(field('Armor Class bonus')).toHaveValue(1);
                expect(field('Claimed level')).toHaveValue(2);
                expect(screen.queryByText(/replaces the character's class actions/)).not.toBeInTheDocument();
            });
        });

        describe('changing race', () => {
            test('saves the race pinned to its version with its actions', async () => {
                await openDialog();
                fireEvent.change(field('Race'), { target: { value: 'elf' } });
                expect(screen.getByText(/replaces the character's racial actions/)).toBeInTheDocument();

                fireEvent.click(save());

                await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
                expect(mockUpdateDoc.mock.calls[0][1]).toEqual({ race_id: 'elf', race_name: 'Elf', race_version: 3, race_actions: [{ actionName: 'Keen' }] });
            });
        });

        describe('validation', () => {
            test.each([
                ['a blank name', 'Name', '   ', /Give the character a name/],
                ['a fractional ability score', 'Strength', '4.5', /Strength must be a whole number/],
                ['a blank ability score', 'Dexterity', '', /Dexterity must be a whole number/],
                ['negative experience', 'Experience', '-1', /Experience must be at least 0/],
                ['no health', 'Maximum health', '0', /Maximum health must be at least 1/],
                ['a claimed level of 0', 'Claimed level', '0', /Claimed level must be from 1 to 15/],
                ['a claimed level past the maximum', 'Claimed level', '16', /Claimed level must be from 1 to 15/],
                ['a fractional bonus', 'Hit Modifier bonus', '1.5', /Hit Modifier bonus must be a whole number/],
            ])('%s is explained and blocks the save', async (_name, label, value, message) => {
                await openDialog();
                fireEvent.change(field(label), { target: { value } });

                expect(screen.getByRole('alert')).toHaveTextContent(message);
                expect(save()).toBeDisabled();
            });
        });

        test('cannot be saved before the classes and races have loaded', async () => {
            mockLoadClasses.mockReturnValue(new Promise(() => {}));
            render(<CharacterAdminButton character={character} campaignInfo={campaign} userId="player"/>);
            fireEvent.click(screen.getByRole('button', { name: 'Update character' }));

            expect(await screen.findByRole('dialog')).toBeInTheDocument();
            expect(save()).toBeDisabled();
            expect(field('Class')).toBeDisabled();
        });

        test('if the lists cannot be loaded it says so, and the other fields still work', async () => {
            mockLoadClasses.mockRejectedValue(new Error('offline'));
            await openDialog();

            expect(screen.getByRole('alert')).toHaveTextContent(/Couldn't load the classes and races/);
            fireEvent.change(field('Strength'), { target: { value: '5' } });
            fireEvent.click(save());
            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { strength_stat: 5 }));
        });

        test('a failed write is reported and the dialog stays open', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('denied'));
            await openDialog();
            fireEvent.change(field('Strength'), { target: { value: '5' } });

            fireEvent.click(save());

            await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('denied')));
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            await waitFor(() => expect(save()).toBeEnabled());
        });

        test('Cancel, Escape and the backdrop close it without saving', async () => {
            await openDialog();
            fireEvent.change(field('Strength'), { target: { value: '9' } });
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Update character' }));
            fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' });
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Update character' }));
            fireEvent.click(await screen.findByRole('button', { name: 'Close' }));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });
    });
});
