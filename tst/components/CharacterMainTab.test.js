jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockDoc = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
}));

const mockUseIsMobile = jest.fn();
jest.mock('../../src/utils/useIsMobile', () => ({ useIsMobile: () => mockUseIsMobile() }));

const mockUseCampaignMaps = jest.fn();
const mockUseCombatEntities = jest.fn();
jest.mock('../../src/utils/useCampaignCombat', () => ({
    useCampaignMaps: (...args) => mockUseCampaignMaps(...args),
    useCombatEntities: (...args) => mockUseCombatEntities(...args),
}));

jest.mock('../../src/utils/DraggableElements/PostListInventory.tsx', () => ({
    PostListContentInventory: ({ characterId, campaignCharacterList }) => <div>Inventory-stub:{characterId}:{campaignCharacterList.length}</div>,
}));
jest.mock('../../src/utils/DraggableElements/PostListInventoryPocket.tsx', () => ({
    PostListContentInventoryPocket: ({ characterId }) => <div>Pocket-stub:{characterId}</div>,
}));
jest.mock('../../src/utils/DraggableElements/PostListCombat.tsx', () => ({
    PostListContentCombat: ({ campaignId }) => <div>Combat-stub:{campaignId}</div>,
}));
jest.mock('../../src/utils/DraggableElements/PostListCombatMap.tsx', () => ({
    PostListContentCombatMap: ({ campaignId, activeMap, entities }) => <div>CombatMap-stub:{campaignId}:{activeMap?.map_id}:{entities.length}</div>,
}));

// eslint-disable-next-line import/first
import { screen, fireEvent, within } from '@testing-library/react';
// eslint-disable-next-line import/first
import { CharacterMainTab } from '../../src/components/CharacterMainTab';
// eslint-disable-next-line import/first
import { renderWithRouter as render } from '../testUtils/renderWithRouter';

const characterPage = {
    character_id: 'char-1', userId: 'owner-1', campaign: 'camp-1',
    actions: [
        { actionName: 'Stab', actionCost: 1, category: 'action', toHitBool: true, toHit: 2 },
        { actionName: 'Big Slam', actionCost: 3, category: 'action', toHitBool: true, toHit: 2 },
        { actionName: 'Tough Skin', actionCost: 0, category: 'passive', toHitBool: false, difficultyClass: 'Dex,0' },
    ],
    action_points: 2,
    experience_points: 0,
    base_armor_class: 12, base_hit_modifier: 2, base_damage_modifier: 0,
    base_damage_dice: 1, base_damage_dice_type: 6, base_healing_dice_type: 4,
    description: '', class_description: 'A frontline tank.', notes: '',
};

function goToTab(name) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(name + '$') }));
}

function circleButtons() {
    return screen.getAllByRole('button', { name: /^circle/ });
}

beforeEach(() => {
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockUpdateDoc.mockResolvedValue(undefined);
    mockUseIsMobile.mockReturnValue(false);
    mockUseCampaignMaps.mockReturnValue({ activeMap: null });
    mockUseCombatEntities.mockReturnValue([]);
    window.alert = jest.fn();
});

afterEach(() => {
    delete window.alert;
    jest.useRealTimers();
});

describe('CharacterMainTab', () => {
    describe('Roleplay tab (default)', () => {
        test('shows the background description, falling back to the class description when unset', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            expect(screen.getByDisplayValue('A frontline tank.')).toBeInTheDocument();
        });

        test('prefers the character\'s own description once set', () => {
            render(<CharacterMainTab characterPage={{ ...characterPage, description: 'My own story.' }} userId="owner-1" />);
            expect(screen.getByDisplayValue('My own story.')).toBeInTheDocument();
            expect(screen.queryByDisplayValue('A frontline tank.')).not.toBeInTheDocument();
        });

        test('the background and notes are read-only without write permissions', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="stranger-1" />);
            expect(screen.getByLabelText('Background')).toHaveAttribute('readonly');
            expect(screen.getByLabelText('Notes')).toHaveAttribute('readonly');
        });

        test('the notes are written in the Markdown editor, and can be edited by someone with write permissions', () => {
            render(<CharacterMainTab characterPage={{ ...characterPage, notes: 'Met **Mara**.' }} userId="owner-1" />);
            const notes = screen.getByLabelText('Notes');
            expect(notes).toHaveValue('Met **Mara**.');
            expect(notes).not.toHaveAttribute('readonly');
        });

        test('the notes can be emptied out, and that is saved', () => {
            jest.useFakeTimers();
            render(<CharacterMainTab characterPage={{ ...characterPage, notes: 'Old notes' }} userId="owner-1" />);

            fireEvent.change(screen.getByLabelText('Notes'), { target: { value: '' } });
            jest.advanceTimersByTime(1000);

            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { notes: '' });
        });

        describe('the background', () => {
            const own = { ...characterPage, description: 'My own story.' };

            test('is written in the Markdown editor', () => {
                render(<CharacterMainTab characterPage={own} userId="owner-1" />);
                expect(screen.getByLabelText('Background')).toHaveValue('My own story.');
            });

            test('emptying it is not saved while you are still in it (you may be rewriting it)', () => {
                jest.useFakeTimers();
                render(<CharacterMainTab characterPage={own} userId="owner-1" />);

                fireEvent.change(screen.getByLabelText('Background'), { target: { value: '' } });
                jest.advanceTimersByTime(5000);

                expect(mockUpdateDoc).not.toHaveBeenCalled();
                expect(screen.getByLabelText('Background')).toHaveValue('');
            });

            test('leaving it empty puts the class\'s lore back and clears the saved background', () => {
                render(<CharacterMainTab characterPage={own} userId="owner-1" />);
                fireEvent.change(screen.getByLabelText('Background'), { target: { value: '' } });

                fireEvent.blur(screen.getByLabelText('Background'));

                expect(screen.getByLabelText('Background')).toHaveValue('A frontline tank.');
                expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { description: '' });
            });

            test('with nothing saved to clear, the lore just comes back', () => {
                render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
                fireEvent.change(screen.getByLabelText('Background'), { target: { value: '' } });

                fireEvent.blur(screen.getByLabelText('Background'));

                expect(screen.getByLabelText('Background')).toHaveValue('A frontline tank.');
                expect(mockUpdateDoc).not.toHaveBeenCalled();
            });

            test('a background with something in it is left alone on blur', () => {
                render(<CharacterMainTab characterPage={own} userId="owner-1" />);
                fireEvent.blur(screen.getByLabelText('Background'));
                expect(screen.getByLabelText('Background')).toHaveValue('My own story.');
                expect(mockUpdateDoc).not.toHaveBeenCalled();
            });

            test('a pending save of emptied text is dropped when the lore comes back', () => {
                jest.useFakeTimers();
                render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
                fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'x' } });
                fireEvent.change(screen.getByLabelText('Background'), { target: { value: '' } });
                fireEvent.blur(screen.getByLabelText('Background'));

                jest.advanceTimersByTime(5000);

                expect(mockUpdateDoc).not.toHaveBeenCalled();
            });
        });

        test('typing updates immediately, then writes to Firestore after the debounce delay', () => {
            jest.useFakeTimers();
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            const notesBox = screen.getByLabelText('Notes');

            fireEvent.change(notesBox, { target: { value: 'Loves cats.' } });
            expect(screen.getByDisplayValue('Loves cats.')).toBeInTheDocument();
            expect(mockUpdateDoc).not.toHaveBeenCalled();

            jest.advanceTimersByTime(1000);
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { notes: 'Loves cats.' });
        });

        test('a failed write is alerted', () => {
            jest.useFakeTimers();
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);

            fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Loves cats.' } });
            jest.advanceTimersByTime(1000);

            return Promise.resolve().then(() => expect(window.alert).toHaveBeenCalled());
        });
    });

    describe('Combat tab', () => {
        test('shows a filled circle per spent action point, out of 4', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Combat');
            // Scoped to the action-point pips specifically - CombatActionList
            // renders its own "circle" alt-text icons for cost pips, which
            // would otherwise also match these queries.
            expect(screen.getAllByAltText('circleFilled').filter(img => img.className.includes('CharacterMainTab-circle'))).toHaveLength(2);
            expect(screen.getAllByAltText('circle').filter(img => img.className.includes('CharacterMainTab-circle'))).toHaveLength(2);
            expect(screen.getByText(/2 \/ 4 available/)).toBeInTheDocument();
        });

        test('the Combat tab lets its action points stick to the top while the actions scroll', () => {
            const { container } = render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            expect(container.querySelector('.TabContainer-content')).not.toHaveClass('TabContainer-content-unclipped');

            goToTab('Combat');

            expect(container.querySelector('.TabContainer-content')).toHaveClass('TabContainer-content-unclipped');
            expect(container.querySelector('.TabContainer-content > .CharacterMainTab-action-points')).toBeInTheDocument();
        });

        describe('statuses next to the action points', () => {
            const statuses = [
                { id: 's1', name: 'Haste', polarity: 'buff', stacks: 2 },
                { id: 's2', name: 'Stance: Heartstealer', polarity: 'token', stacks: -1 },
                { id: 's3', name: 'Inspired', polarity: 'buff', stacks: 0, color: '#f5a623' },
            ];

            test('sit in the sticky bar under the action points, so they stay in view while scrolling', () => {
                const { container } = render(<CharacterMainTab characterPage={{ ...characterPage, statuses }} userId="owner-1" />);
                goToTab('Combat');

                const bar = container.querySelector('.TabContainer-content > .CharacterMainTab-action-points');
                const strip = within(bar).getByRole('group', { name: 'Active statuses' });
                expect(within(strip).getAllByText(/Haste|Stance: Heartstealer|Inspired/).map(el => el.textContent)).toEqual(['Haste', 'Stance: Heartstealer', 'Inspired']);
                expect(bar.querySelector('.CharacterMainTab-ap-row').compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
            });

            test('show their type, stack count and own color', () => {
                render(<CharacterMainTab characterPage={{ ...characterPage, statuses }} userId="owner-1" />);
                goToTab('Combat');
                const strip = screen.getByRole('group', { name: 'Active statuses' });

                expect(within(strip).getByText('Haste').closest('.CharacterPage-status-chip')).toHaveClass('CharacterPage-status-chip-buff');
                expect(within(strip).getByText('2')).toBeInTheDocument();
                expect(within(strip).getByText('Stance: Heartstealer').closest('.CharacterPage-status-chip')).toHaveClass('CharacterPage-status-chip-token');
                expect(within(strip).getByText('Inspired').closest('.CharacterPage-status-chip').style.getPropertyValue('--status-color')).toBe('#f5a623');
            });

            test('are read-only labels here (the sheet\'s status panel is where they are managed)', () => {
                render(<CharacterMainTab characterPage={{ ...characterPage, statuses }} userId="owner-1" />);
                goToTab('Combat');
                expect(within(screen.getByRole('group', { name: 'Active statuses' })).queryAllByRole('button')).toHaveLength(0);
            });

            test('leave the bar exactly as it was for a character with none', () => {
                const { container } = render(<CharacterMainTab characterPage={{ ...characterPage, statuses: [] }} userId="owner-1" />);
                goToTab('Combat');
                expect(screen.queryByRole('group', { name: 'Active statuses' })).not.toBeInTheDocument();
                expect(container.querySelector('.CharacterMainTab-action-points').children).toHaveLength(1);
            });

            test('a character with no statuses field at all is fine', () => {
                const { statuses: _omit, ...withoutStatuses } = characterPage;
                render(<CharacterMainTab characterPage={withoutStatuses} userId="owner-1" />);
                goToTab('Combat');
                expect(screen.queryByRole('group', { name: 'Active statuses' })).not.toBeInTheDocument();
            });
        });

        test('the label is "Action Points", shortened to "AP" (hidden from screen readers) for phones', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Combat');

            expect(screen.getByText('Action Points')).toBeInTheDocument();
            expect(screen.getByText('AP')).toHaveAttribute('aria-hidden', 'true');
        });

        describe('filtering and sorting the actions', () => {
            const fire = { id: 'a1', tagId: 't-fire', tagInfo: 'Fire', tagColor: '#f00', textColor: '#fff' };
            const melee = { id: 'a2', tagId: 't-melee', tagInfo: 'Melee', tagColor: '#00f', textColor: '#fff' };
            const tagged = {
                ...characterPage,
                action_points: 4,
                actions: [
                    { actionName: 'Stab', actionCost: 2, category: 'action', toHitBool: true, toHit: 2, tags: [melee] },
                    { actionName: 'Fireball', actionCost: 3, category: 'action', toHitBool: true, toHit: 2, tags: [fire] },
                    { actionName: 'Flame Guard', actionCost: 1, category: 'reaction', toHitBool: true, toHit: 2, tags: [fire, melee] },
                    { actionName: 'Tough Skin', actionCost: 0, category: 'passive', toHitBool: false, difficultyClass: 'Dex,0' },
                ],
            };
            const names = () => [...document.querySelectorAll('.CombatActionListCard-name')].map(name => name.textContent);
            const chip = name => screen.getByRole('button', { name, pressed: undefined });

            function open(page = tagged) {
                render(<CharacterMainTab characterPage={page} userId="owner-1" />);
                goToTab('Combat');
            }

            test('offers the kinds of action and tags the character actually has, and a sort', () => {
                open();
                const controls = within(screen.getByRole('group', { name: 'Filter and sort actions' }));

                expect(controls.getAllByRole('button').map(button => button.textContent)).toEqual(['Passive', 'Reaction', 'Action', 'Fire', 'Melee']);
                expect(controls.getByRole('combobox', { name: 'Sort' })).toHaveValue('default');
            });

            test('nothing is filtered to begin with', () => {
                open();
                expect(names()).toEqual(['Tough Skin', 'Stab', 'Fireball', 'Flame Guard']);
            });

            test('choosing a tag keeps the actions that have it, in every list', () => {
                open();
                fireEvent.click(chip('Fire'));
                expect(names()).toEqual(['Fireball', 'Flame Guard']);
                expect(chip('Fire')).toHaveAttribute('aria-pressed', 'true');
            });

            test('choosing several tags keeps actions with any of them', () => {
                open();
                fireEvent.click(chip('Fire'));
                fireEvent.click(chip('Melee'));
                expect(names()).toEqual(['Stab', 'Fireball', 'Flame Guard']);
            });

            test('a kind and a tag together keep what matches both', () => {
                open();
                fireEvent.click(chip('Reaction'));
                fireEvent.click(chip('Melee'));
                expect(names()).toEqual(['Flame Guard']);
            });

            test('choosing a chip again takes it back out', () => {
                open();
                fireEvent.click(chip('Fire'));
                fireEvent.click(chip('Fire'));
                expect(names()).toHaveLength(4);
            });

            test('says which sections have nothing matching, and Clear filters brings everything back', () => {
                open();
                fireEvent.click(chip('Fire'));
                expect(screen.getAllByText('No actions match.')).toHaveLength(2); // passives, and the (empty) unavailable list

                fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

                expect(names()).toHaveLength(4);
                expect(screen.queryByText('No actions match.')).not.toBeInTheDocument();
                expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
            });

            test('sorting orders each list, and choosing Class order puts it back', () => {
                open();
                const sort = screen.getByRole('combobox', { name: 'Sort' });

                fireEvent.change(sort, { target: { value: 'name' } });
                expect(names()).toEqual(['Tough Skin', 'Fireball', 'Flame Guard', 'Stab']);

                fireEvent.change(sort, { target: { value: 'cost' } });
                expect(names()).toEqual(['Tough Skin', 'Flame Guard', 'Stab', 'Fireball']);

                fireEvent.change(sort, { target: { value: 'default' } });
                expect(names()).toEqual(['Tough Skin', 'Stab', 'Fireball', 'Flame Guard']);
            });

            test('filtering and sorting work together', () => {
                open();
                fireEvent.click(chip('Fire'));
                fireEvent.change(screen.getByRole('combobox', { name: 'Sort' }), { target: { value: 'cost' } });
                expect(names()).toEqual(['Flame Guard', 'Fireball']);
            });

            test('a filter chosen for something the actions no longer have is dropped, not left hiding everything', () => {
                const { rerender } = render(<CharacterMainTab characterPage={tagged} userId="owner-1" />);
                goToTab('Combat');
                fireEvent.click(chip('Fire'));

                rerender(<CharacterMainTab characterPage={{ ...tagged, actions: tagged.actions.filter(action => !action.tags?.some(tag => tag.tagId === 't-fire')) }} userId="owner-1" />);

                expect(names()).toEqual(['Tough Skin', 'Stab']);
            });

            test('no controls for a character with fewer than two actions', () => {
                open({ ...tagged, actions: [tagged.actions[0]] });
                expect(screen.queryByRole('group', { name: 'Filter and sort actions' })).not.toBeInTheDocument();
            });

            test('with no tags and only one kind of action, only the sort is offered', () => {
                open({ ...tagged, actions: [{ ...tagged.actions[0], tags: [] }, { ...tagged.actions[1], tags: [] }] });
                const controls = within(screen.getByRole('group', { name: 'Filter and sort actions' }));
                expect(controls.queryByRole('group', { name: 'Type' })).not.toBeInTheDocument();
                expect(controls.queryByRole('group', { name: 'Tags' })).not.toBeInTheDocument();
                expect(controls.getByRole('combobox', { name: 'Sort' })).toBeInTheDocument();
            });
        });

        test('the hint to click a circle only appears with write permissions', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Combat');
            expect(screen.getByText(/click a circle to spend/)).toBeInTheDocument();
        });

        test('no hint, and disabled circle buttons, without write permissions', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="stranger-1" />);
            goToTab('Combat');
            expect(screen.queryByText(/click a circle to spend/)).not.toBeInTheDocument();
            circleButtons().forEach(b => expect(b).toBeDisabled());
        });

        test('clicking a circle sets action_points to that circle\'s number', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Combat');

            fireEvent.click(circleButtons()[2]); // the 3rd circle

            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { action_points: 3 });
        });

        test('clicking the last filled circle spends it', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />); // 2 action points
            goToTab('Combat');

            fireEvent.click(circleButtons()[1]); // the 2nd circle, the last one filled

            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { action_points: 1 });
        });

        test('a character can get to 0 action points by clicking the first circle when it is the only one filled', () => {
            render(<CharacterMainTab characterPage={{ ...characterPage, action_points: 1 }} userId="owner-1" />);
            goToTab('Combat');

            fireEvent.click(circleButtons()[0]);

            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { action_points: 0 });
        });

        test('with 0 action points, the first circle sets 1 again', () => {
            render(<CharacterMainTab characterPage={{ ...characterPage, action_points: 0 }} userId="owner-1" />);
            goToTab('Combat');

            fireEvent.click(circleButtons()[0]);

            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { action_points: 1 });
        });

        test('at 4 action points, the 4th circle spends one and an earlier one sets that many', () => {
            render(<CharacterMainTab characterPage={{ ...characterPage, action_points: 4 }} userId="owner-1" />);
            goToTab('Combat');

            fireEvent.click(circleButtons()[3]);
            expect(mockUpdateDoc).toHaveBeenLastCalledWith({ __doc: ['characters', 'char-1'] }, { action_points: 3 });

            fireEvent.click(circleButtons()[1]);
            expect(mockUpdateDoc).toHaveBeenLastCalledWith({ __doc: ['characters', 'char-1'] }, { action_points: 2 });
        });

        describe('combat and roleplay actions', () => {
            const sheet = (actions, extra = {}) => ({ ...characterPage, actions, ...extra });
            const stab = { actionName: 'Stab', actionCost: 1, category: 'action', toHitBool: true, toHit: 2 };
            const talk = { actionName: 'Silver Tongue', actionCost: 0, category: 'action', toHitBool: false, difficultyClass: 'Cha,0', usage: 'roleplay' };
            const parry = { actionName: 'Parry', actionCost: 1, category: 'reaction', toHitBool: true, toHit: 1, usage: 'both' };
            const names = () => [...document.querySelectorAll('.CombatActionListCard-name')].map(el => el.textContent);

            test('the Combat tab lists combat and both actions, not roleplay-only ones', () => {
                render(<CharacterMainTab characterPage={sheet([stab, talk, parry])} userId="owner-1" />);
                goToTab('Combat');
                expect(names()).toEqual(['Stab', 'Parry']);
            });

            test('an action with no usage is a combat action, as it always was', () => {
                render(<CharacterMainTab characterPage={sheet([stab])} userId="owner-1" />);
                goToTab('Combat');
                expect(names()).toEqual(['Stab']);
            });

            test('the Roleplay tab lists roleplay and both actions, in a card of their own above the notes', () => {
                render(<CharacterMainTab characterPage={sheet([stab, talk, parry])} userId="owner-1" />);
                const card = screen.getByRole('heading', { name: 'Roleplay Actions' }).closest('.CharacterMainTab-roleplay-actions');
                expect(within(card).getAllByText(/^(Stab|Silver Tongue|Parry)$/).map(el => el.textContent)).toEqual(['Silver Tongue', 'Parry']);
                expect(card.compareDocumentPosition(screen.getByRole('heading', { name: 'Notes' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
            });

            test('there is no Roleplay Actions card when the character has none', () => {
                render(<CharacterMainTab characterPage={sheet([stab])} userId="owner-1" />);
                expect(screen.queryByRole('heading', { name: 'Roleplay Actions' })).not.toBeInTheDocument();
                expect(screen.getByRole('heading', { name: 'Background' })).toBeInTheDocument();
            });

            test('roleplay cards do not cost action points, so there is no Use Action button for them', () => {
                render(<CharacterMainTab characterPage={sheet([talk, parry])} userId="owner-1" />);
                const card = screen.getByRole('heading', { name: 'Roleplay Actions' }).closest('.CharacterMainTab-roleplay-actions');
                expect(within(card).queryByRole('button', { name: /^Use/ })).not.toBeInTheDocument();
                expect(within(card).queryByText(/Action$/)).not.toBeInTheDocument();
            });

            test('a limited roleplay action can be used from the Roleplay tab, spending a use', () => {
                const limited = { ...talk, actionName: 'Old Friend', actionType: 'perDay', actionTypeCount: 1 };
                render(<CharacterMainTab characterPage={sheet([limited])} userId="owner-1" />);

                fireEvent.click(screen.getByRole('button', { name: 'Use' }));

                expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { action_uses: { 'Old Friend': 1 } });
            });

            test('an action used in both shares its uses between the tabs', () => {
                const both = { ...parry, actionName: 'Lucky Break', actionType: 'perDay', actionTypeCount: 2 };
                render(<CharacterMainTab characterPage={sheet([both], { action_uses: { 'Lucky Break': 1 } })} userId="owner-1" />);
                expect(screen.getByText('1 / 2')).toBeInTheDocument(); // on the Roleplay tab
                goToTab('Combat');
                expect(screen.getByText('1 / 2')).toBeInTheDocument();
            });

            test('the Combat tab\'s filters and reset row only count combat actions', () => {
                const talkLimited = { ...talk, actionType: 'perDay', actionTypeCount: 1, tags: [{ tagInfo: 'Social', tagColor: '#fff', textColor: '#000' }] };
                render(<CharacterMainTab characterPage={sheet([stab, talkLimited], { action_uses: { 'Silver Tongue': 1 } })} userId="owner-1" />);
                goToTab('Combat');
                expect(screen.queryByRole('button', { name: 'Social' })).not.toBeInTheDocument(); // the roleplay action's tag
                expect(screen.queryByRole('group', { name: 'Reset limited uses' })).not.toBeInTheDocument();
            });

            test('the Roleplay tab has its own reset row for its limited actions', () => {
                const limited = { ...talk, actionName: 'Old Friend', actionType: 'perDay', actionTypeCount: 1 };
                render(<CharacterMainTab characterPage={sheet([limited], { action_uses: { 'Old Friend': 1 } })} userId="owner-1" />);
                fireEvent.click(screen.getByRole('button', { name: 'New day' }));
                expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { action_uses: {} });
            });
        });

        describe('sections with nothing in them', () => {
            const only = actions => ({ ...characterPage, actions });
            const stab = { actionName: 'Stab', actionCost: 1, category: 'action', toHitBool: true, toHit: 2 };
            const skin = { actionName: 'Tough Skin', actionCost: 0, category: 'passive', toHitBool: false, difficultyClass: 'Dex,0' };

            test('an empty Passives section says so, without any filter on', () => {
                render(<CharacterMainTab characterPage={only([stab])} userId="owner-1" />);
                goToTab('Combat');
                expect(screen.getByText('No passive abilities.')).toBeInTheDocument();
            });

            test('an empty Available section says why', () => {
                render(<CharacterMainTab characterPage={{ ...only([skin]), action_points: 0 }} userId="owner-1" />);
                goToTab('Combat');
                expect(screen.getByText('No actions you can afford with your current action points.')).toBeInTheDocument();
            });

            test('an empty Unavailable section says everything is affordable', () => {
                render(<CharacterMainTab characterPage={only([stab])} userId="owner-1" />);
                goToTab('Combat');
                expect(screen.getByText('None - you have enough action points for every action.')).toBeInTheDocument();
            });

            test('a section that has actions has no such note', () => {
                render(<CharacterMainTab characterPage={{ ...only([stab, skin]), action_points: 2 }} userId="owner-1" />);
                goToTab('Combat');
                expect(screen.queryByText('No passive abilities.')).not.toBeInTheDocument();
                expect(screen.queryByText(/No actions you can afford/)).not.toBeInTheDocument();
            });

            test('with a filter on, an empty section says nothing matches instead', () => {
                render(<CharacterMainTab characterPage={only([stab, skin])} userId="owner-1" />);
                goToTab('Combat');
                fireEvent.click(screen.getByRole('button', { name: 'Passive' })); // leaves Available and Unavailable empty
                expect(screen.getAllByText('No actions match.')).toHaveLength(2);
                expect(screen.queryByText(/No actions you can afford/)).not.toBeInTheDocument();
                expect(screen.queryByText(/None - you have enough/)).not.toBeInTheDocument();
            });

            test('a character with no combat actions at all gets a note in every section', () => {
                render(<CharacterMainTab characterPage={only([])} userId="owner-1" />);
                goToTab('Combat');
                expect(screen.getByText('No passive abilities.')).toBeInTheDocument();
                expect(screen.getByText(/No actions you can afford/)).toBeInTheDocument();
                expect(screen.getByText(/None - you have enough/)).toBeInTheDocument();
            });
        });

        describe('limited-use actions', () => {
            const limited = { actionName: 'Fleetfoot', actionCost: 1, category: 'action', toHitBool: true, toHit: 2, actionType: 'perDay', actionTypeCount: 1 };
            const withLimited = (extra = {}) => ({ ...characterPage, actions: [...characterPage.actions, limited], ...extra });

            test('track their uses on the card, and spending one is saved on the character', () => {
                render(<CharacterMainTab characterPage={withLimited()} userId="owner-1" />);
                goToTab('Combat');
                expect(screen.getByText('1 / 1')).toBeInTheDocument();

                fireEvent.click(screen.getByRole('button', { name: 'Spend a use of Fleetfoot' }));

                expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { action_uses: { Fleetfoot: 1 } });
            });

            test('a spent-out action cannot be used until the uses are restored', () => {
                render(<CharacterMainTab characterPage={withLimited({ action_uses: { Fleetfoot: 1 } })} userId="owner-1" />);
                goToTab('Combat');
                expect(screen.getByText('0 / 1')).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'No uses left' })).toBeDisabled();

                fireEvent.click(screen.getByRole('button', { name: 'Give back a use of Fleetfoot' }));

                expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { action_uses: {} });
            });

            test('Reset uses gives them back for a new day', () => {
                render(<CharacterMainTab characterPage={withLimited({ action_uses: { Fleetfoot: 1 } })} userId="owner-1" />);
                goToTab('Combat');

                fireEvent.click(screen.getByRole('button', { name: 'New day' }));

                expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { action_uses: {} });
            });

            test('the reset row only shows for someone who can edit, and only when the character has limited actions', () => {
                const { unmount } = render(<CharacterMainTab characterPage={withLimited()} userId="stranger-1" />);
                goToTab('Combat');
                expect(screen.queryByRole('group', { name: 'Reset limited uses' })).not.toBeInTheDocument();
                unmount();

                render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
                goToTab('Combat');
                expect(screen.queryByRole('group', { name: 'Reset limited uses' })).not.toBeInTheDocument();
            });
        });

        test('partitions actions into Passives, Available, and Unavailable by cost and category', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Combat');
            expect(screen.getByText('Passives')).toBeInTheDocument();
            expect(screen.getByText('Available Actions')).toBeInTheDocument();
            expect(screen.getByText(/Unavailable/)).toBeInTheDocument();
            expect(screen.getByText('Tough Skin')).toBeInTheDocument();
            expect(screen.getByText('Stab')).toBeInTheDocument(); // costs 1, <= 2 available points
            expect(screen.getByText('Big Slam')).toBeInTheDocument(); // costs 3, > 2 available points
        });
    });

    describe('Inventory tab', () => {
        test('desktop shows one inventory column plus a pocket', () => {
            mockUseIsMobile.mockReturnValue(false);
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" characterList={[{ character_id: 'char-2' }]} />);
            goToTab('Inventory');
            expect(screen.getByText('Inventory-stub:char-1:1')).toBeInTheDocument();
            expect(screen.getByText('Pocket-stub:char-1')).toBeInTheDocument();
            expect(screen.queryByText('Relics')).not.toBeInTheDocument();
        });

        test('mobile shows separate Relics, Backpack, and Pocket sections', () => {
            mockUseIsMobile.mockReturnValue(true);
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Inventory');
            expect(screen.getByText('Relics')).toBeInTheDocument();
            expect(screen.getByText('Backpack')).toBeInTheDocument();
            expect(screen.getByText('Pocket')).toBeInTheDocument();
            expect(screen.getAllByText(/Inventory-stub:char-1/)).toHaveLength(2); // relics + backpack
        });
    });

    describe('Combat Map tab', () => {
        test('a character with no campaign shows a join/create prompt instead of the map', () => {
            render(<CharacterMainTab characterPage={{ ...characterPage, campaign: null }} userId="owner-1" />);
            goToTab('Combat Map');
            expect(screen.getByText("This character isn't part of a campaign yet.")).toBeInTheDocument();
            expect(screen.getByRole('link', { name: /Join or create a campaign/ })).toHaveAttribute('href', '/campaigns');
        });

        test('a character with a campaign shows the inline combat list, scoped to that campaign', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Combat Map');
            expect(screen.getByText('Combat-stub:camp-1')).toBeInTheDocument();
        });

        test('Open Combat Map opens a full-screen overlay with the active map and combat entities', () => {
            mockUseCampaignMaps.mockReturnValue({ activeMap: { map_id: 'map-1' } });
            mockUseCombatEntities.mockReturnValue([{ id: 'character:char-1', title: 'Aria' }]);
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Combat Map');

            fireEvent.click(screen.getByRole('button', { name: /Open Combat Map/ }));

            expect(screen.getByText('CombatMap-stub:camp-1:map-1:1')).toBeInTheDocument();
        });

        test('the overlay closes via its own close button', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Combat Map');
            fireEvent.click(screen.getByRole('button', { name: /Open Combat Map/ }));
            expect(screen.getByText(/CombatMap-stub/)).toBeInTheDocument();

            // Both the scrim and the floating × button share the accessible
            // name "Close" (aria-label overrides the × glyph's own text) -
            // the floating one is the second in DOM order.
            fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[1]);

            expect(screen.queryByText(/CombatMap-stub/)).not.toBeInTheDocument();
        });

        test('the overlay also closes via clicking the scrim', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Combat Map');
            fireEvent.click(screen.getByRole('button', { name: /Open Combat Map/ }));

            fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);

            expect(screen.queryByText(/CombatMap-stub/)).not.toBeInTheDocument();
        });
    });
});
