jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockDoc = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
}));

const mockUseIsMobile = jest.fn();
const mockUseOwnCombatTokens = jest.fn();
jest.mock('../../src/utils/useOwnCombatTokens', () => ({ useOwnCombatTokens: (...args) => mockUseOwnCombatTokens(...args) }));
jest.mock('../../src/utils/useIsMobile', () => ({ useIsMobile: () => mockUseIsMobile() }));

const mockUseCampaignMaps = jest.fn();
const mockUseCombatEntities = jest.fn();
jest.mock('../../src/utils/useCampaignCombat', () => ({
    useCampaignMaps: (...args) => mockUseCampaignMaps(...args),
    useCombatEntities: (...args) => mockUseCombatEntities(...args),
}));

let mockParty = {};
jest.mock('../../src/utils/useParty', () => ({ useParty: () => ({ party: mockParty, loaded: true }) }));

const mockInventoryProps = [];
jest.mock('../../src/utils/DraggableElements/PostListInventory.tsx', () => ({
    PostListContentInventory: props => {
        mockInventoryProps.push(['backpack', props]);
        return <div>Inventory-stub:{props.characterId}</div>;
    },
}));
jest.mock('../../src/utils/DraggableElements/PostListInventoryPocket.tsx', () => ({
    PostListContentInventoryPocket: props => {
        mockInventoryProps.push(['pocket', props]);
        return <div>Pocket-stub:{props.characterId}</div>;
    },
}));
jest.mock('../../src/components/InventoryToolbar', () => ({
    InventoryToolbar: ({ characterId, campaignId, userId, members }) => <div>InventoryToolbar-stub:{characterId}:{campaignId}:{userId}:{members.join(',')}</div>,
}));
const mockLineProps = [];
jest.mock('../../src/utils/DraggableElements/PostListCombat.tsx', () => ({
    PostListContentCombat: props => {
        mockLineProps.push(props);
        return <div>Combat-stub:{props.campaignId}</div>;
    },
}));
jest.mock('../../src/utils/DraggableElements/PostListCombatMap.tsx', () => ({
    PostListContentCombatMap: ({ campaignId, activeMap, entities, canEdit, toolbarsBeside }) => <div data-canedit={String(Boolean(canEdit))} data-beside={String(Boolean(toolbarsBeside))}>CombatMap-stub:{campaignId}:{activeMap?.map_id}:{entities.length}</div>,
}));
const mockCharacterNotesProps = [];
jest.mock('../../src/components/PartySpace', () => ({ PartySpace: ({ campaignId, tab, onTab, actingCharacterId }) => <div>PartySpace-stub:{campaignId}:{tab}:{actingCharacterId}<button type="button" onClick={() => onTab('trades')}>Go to trades</button></div> }));
jest.mock('../../src/components/RollRequests', () => ({ RollRequests: ({ characterId, canClear }) => <div>RollRequests-stub:{characterId}:{String(canClear)}</div> }));
jest.mock('../../src/components/CharacterNotes', () => ({
    CharacterNotes: props => {
        mockCharacterNotesProps.push(props);
        return <div>CharacterNotes-stub:{props.characterId}</div>;
    },
}));

// eslint-disable-next-line import/first
import { screen, fireEvent, within } from '@testing-library/react';
// eslint-disable-next-line import/first
import { CharacterMainTab } from '../../src/components/CharacterMainTab';
// eslint-disable-next-line import/first
import { renderWithRouter as render } from '../testUtils/renderWithRouter';
// eslint-disable-next-line import/first
import { engagementStone } from '../../src/utils/engagements';

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
    mockParty = {};
    mockCharacterNotesProps.length = 0;
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

        test('the background is read-only without write permissions', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="stranger-1" />);
            expect(screen.getByLabelText('Background')).toHaveAttribute('readonly');
        });

        describe('notes', () => {
            test('renders the character\'s own notebook (see CharacterNotes.js), passed this character\'s id', () => {
                render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
                expect(screen.getByText('CharacterNotes-stub:char-1')).toBeInTheDocument();
            });
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
            const background = screen.getByLabelText('Background');

            fireEvent.change(background, { target: { value: 'A frontline tank who loves cats.' } });
            expect(screen.getByDisplayValue('A frontline tank who loves cats.')).toBeInTheDocument();
            expect(mockUpdateDoc).not.toHaveBeenCalled();

            jest.advanceTimersByTime(1000);
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { description: 'A frontline tank who loves cats.' });
        });

        test('a failed write is alerted', () => {
            jest.useFakeTimers();
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);

            fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'A frontline tank who loves cats.' } });
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

        test('the fourth circle, the extra point from haste, is drawn in a colour of its own', () => {
            render(<CharacterMainTab characterPage={{ ...characterPage, action_points: 4 }} userId="owner-1" />);
            goToTab('Combat');
            const circles = screen.getAllByAltText('circleFilled').filter(img => img.className.includes('CharacterMainTab-circle'));
            expect(circles).toHaveLength(4);
            expect(circles.filter(img => img.className.includes('CharacterMainTab-circle-haste'))).toHaveLength(1);
            expect(circles[3]).toHaveClass('CharacterMainTab-circle-haste');
            expect(circles[3]).not.toHaveAttribute('src', circles[2].getAttribute('src'));
        });

        test('the Combat tab lets its action points stick to the top while the actions scroll', () => {
            const { container } = render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            expect(container.querySelector('.TabContainer-content')).not.toHaveClass('TabContainer-content-unclipped');

            goToTab('Combat');

            expect(container.querySelector('.TabContainer-content')).toHaveClass('TabContainer-content-unclipped');
            expect(container.querySelector('.TabContainer-content > .CharacterMainTab-action-points')).toBeInTheDocument();
        });

        test('shows the whole party\'s HP/statuses read-only, since there is nowhere else a player can check on a teammate mid-fight', () => {
            const teammate = { character_id: 'char-2', character_name: 'Bram', current_health: 5, maximum_health: 10, statuses: [] };
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" characterList={[characterPage, teammate]} />);
            goToTab('Combat');
            expect(within(screen.getByLabelText('Party')).getByText('Bram')).toBeInTheDocument();
            expect(within(screen.getByLabelText('Party')).getByText('5/10 HP')).toBeInTheDocument();
        });

        test('no party roster for a character with no campaign - nobody to share it with', () => {
            render(<CharacterMainTab characterPage={{ ...characterPage, campaign: '' }} userId="owner-1" />);
            goToTab('Combat');
            expect(screen.queryByLabelText('Party')).not.toBeInTheDocument();
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

            test('open that status\'s details as a popup when pressed, with its stacks and controls for someone who can edit', () => {
                render(<CharacterMainTab characterPage={{ ...characterPage, statuses: statuses.map(s => ({ ...s, description: `About ${s.name}` })) }} userId="owner-1" />);
                goToTab('Combat');
                const strip = screen.getByRole('group', { name: 'Active statuses' });

                fireEvent.click(within(strip).getByRole('button', { name: /^Haste/ }));

                const dialog = screen.getByRole('dialog', { name: 'Haste details' });
                expect(within(dialog).getByText('About Haste')).toBeInTheDocument();
                expect(within(dialog).getByRole('button', { name: 'Remove' })).toBeInTheDocument();

                fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });

            test('open read-only for a viewer who cannot edit the character', () => {
                render(<CharacterMainTab characterPage={{ ...characterPage, statuses }} userId="stranger-1" />);
                goToTab('Combat');

                fireEvent.click(within(screen.getByRole('group', { name: 'Active statuses' })).getByRole('button', { name: /^Haste/ }));

                const dialog = screen.getByRole('dialog', { name: 'Haste details' });
                expect(within(dialog).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
            });

            describe('engagement', () => {
                const tracker = [
                    { id: 'character:char-1', title: 'Aria', content: '', status: 'Zone 1', index: 0, engagement: 'eng-1' },
                    { id: 'npc:g', title: 'Goblin', content: '', status: 'Zone 1', index: 1, engagement: 'eng-1' },
                    { id: 'character:char-2', title: 'Bram', content: '', status: 'Zone 1', index: 2 },
                ];

                test('a character who is engaged has a ring in the strip, saying with whom, even with no other status', () => {
                    mockParty = { combat_tracker: tracker };
                    mockUseCombatEntities.mockReturnValue([{ id: 'npc:g', title: 'Grub the Goblin' }]);
                    render(<CharacterMainTab characterPage={{ ...characterPage, statuses: [] }} userId="owner-1" />);
                    goToTab('Combat');
                    const strip = screen.getByRole('group', { name: 'Active statuses' });
                    expect(within(strip).getByText('Engaged with Grub the Goblin')).toBeInTheDocument();
                });

                test('sits beside the other statuses, in the colour of the engagement', () => {
                    mockParty = { combat_tracker: tracker };
                    render(<CharacterMainTab characterPage={{ ...characterPage, statuses }} userId="owner-1" />);
                    goToTab('Combat');
                    const strip = screen.getByRole('group', { name: 'Active statuses' });
                    expect(within(strip).getByText('Haste')).toBeInTheDocument();
                    expect(within(strip).getByText('Engaged with Goblin').closest('.CharacterPage-status-chip').style.getPropertyValue('--status-color')).toBe(engagementStone('eng-1'));
                });

                test('a character who is not engaged has none, and a tracker that cannot be read is fine', () => {
                    mockParty = { combat_tracker: tracker };
                    const { unmount } = render(<CharacterMainTab characterPage={{ ...characterPage, character_id: 'char-2', statuses: [] }} userId="owner-1" />);
                    goToTab('Combat');
                    expect(screen.queryByText(/^Engaged with/)).not.toBeInTheDocument();
                    unmount();
                    mockParty = {};
                    render(<CharacterMainTab characterPage={{ ...characterPage, statuses: [] }} userId="owner-1" />);
                    goToTab('Combat');
                    expect(screen.queryByText(/^Engaged with/)).not.toBeInTheDocument();
                });
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
                expect(card.compareDocumentPosition(screen.getByText(/CharacterNotes-stub/)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

        describe('the reaction (one per turn)', () => {
            const reactionButton = () => screen.getByRole('button', { name: /^Reaction (available|used)$/ });

            test('sits in the sticky bar beside the action points, available to begin with', () => {
                const { container } = render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
                goToTab('Combat');
                expect(reactionButton()).toHaveAccessibleName('Reaction available');
                expect(reactionButton()).toHaveAttribute('aria-pressed', 'true');
                expect(container.querySelector('.CharacterMainTab-action-points .CharacterMainTab-ap-row')).toContainElement(reactionButton());
            });

            test('its icon is not mistaken for one of the four action point circles', () => {
                render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
                goToTab('Combat');
                expect(circleButtons()).toHaveLength(4);
            });

            test('shows a used reaction, with an empty circle', () => {
                render(<CharacterMainTab characterPage={{ ...characterPage, reaction_used: true }} userId="owner-1" />);
                goToTab('Combat');
                expect(reactionButton()).toHaveAccessibleName('Reaction used');
                expect(reactionButton()).toHaveAttribute('aria-pressed', 'false');
                expect(reactionButton().querySelector('img').src).toMatch(/circle\.svg|circle$/);
            });

            test('clicking it marks the reaction used, and again gives it back', () => {
                const { rerender } = render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
                goToTab('Combat');
                fireEvent.click(reactionButton());
                expect(mockUpdateDoc).toHaveBeenLastCalledWith({ __doc: ['characters', 'char-1'] }, { reaction_used: true });

                rerender(<CharacterMainTab characterPage={{ ...characterPage, reaction_used: true }} userId="owner-1" />);
                fireEvent.click(reactionButton());
                expect(mockUpdateDoc).toHaveBeenLastCalledWith({ __doc: ['characters', 'char-1'] }, { reaction_used: false });
            });

            test('someone who cannot edit the sheet sees it but cannot change it', () => {
                render(<CharacterMainTab characterPage={characterPage} userId="stranger-1" />);
                goToTab('Combat');
                expect(reactionButton()).toBeDisabled();
            });

            test('a reaction card can not be used again once the reaction is used', () => {
                const reaction = { actionName: 'Parry', actionCost: 1, category: 'reaction', toHitBool: true, toHit: 1 };
                render(<CharacterMainTab characterPage={{ ...characterPage, actions: [...characterPage.actions, reaction], reaction_used: true }} userId="owner-1" />);
                goToTab('Combat');
                const useButton = screen.getAllByRole('button', { name: 'Reaction used' }).find(button => button.classList.contains('CombatActionList-use-action-button'));
                expect(useButton).toBeDisabled();
            });

            test('using a reaction card spends the reaction only, not an action point too', () => {
                const reaction = { actionName: 'Parry', actionCost: 1, category: 'reaction', toHitBool: true, toHit: 1 };
                render(<CharacterMainTab characterPage={{ ...characterPage, actions: [...characterPage.actions, reaction] }} userId="owner-1" />);
                goToTab('Combat');

                fireEvent.click(screen.getByRole('button', { name: 'Use Reaction' }));

                expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { reaction_used: true });
            });

            test('a reaction more expensive than the character\'s current AP is still usable - AP never gates a reaction', () => {
                const reaction = { actionName: 'Parry', actionCost: 3, category: 'reaction', toHitBool: true, toHit: 1 };
                render(<CharacterMainTab characterPage={{ ...characterPage, action_points: 0, actions: [...characterPage.actions, reaction] }} userId="owner-1" />);
                goToTab('Combat');

                expect(screen.getByRole('button', { name: 'Use Reaction' })).toBeEnabled();
                fireEvent.click(screen.getByRole('button', { name: 'Use Reaction' }));
                expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { reaction_used: true });
            });
        });

        describe('hero points', () => {
            const heroPoints = () => screen.getByRole('group', { name: 'Hero points' });

            test('starts at 1 when never set, same as the ruleset\'s "everyone starts each session with one"', () => {
                render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
                goToTab('Combat');
                expect(within(heroPoints()).getByText('1')).toBeInTheDocument();
            });

            test('shows whatever is saved', () => {
                render(<CharacterMainTab characterPage={{ ...characterPage, hero_points: 3 }} userId="owner-1" />);
                goToTab('Combat');
                expect(within(heroPoints()).getByText('3')).toBeInTheDocument();
            });

            test('the owner can spend one (down) or add one (up)', () => {
                render(<CharacterMainTab characterPage={{ ...characterPage, hero_points: 2 }} userId="owner-1" />);
                goToTab('Combat');

                fireEvent.click(within(heroPoints()).getByRole('button', { name: 'Spend a hero point' }));
                expect(mockUpdateDoc).toHaveBeenLastCalledWith({ __doc: ['characters', 'char-1'] }, { hero_points: 1 });

                fireEvent.click(within(heroPoints()).getByRole('button', { name: 'Add a hero point' }));
                expect(mockUpdateDoc).toHaveBeenLastCalledWith({ __doc: ['characters', 'char-1'] }, { hero_points: 3 });
            });

            test('cannot go negative - spending at 0 is disabled', () => {
                render(<CharacterMainTab characterPage={{ ...characterPage, hero_points: 0 }} userId="owner-1" />);
                goToTab('Combat');
                expect(within(heroPoints()).getByRole('button', { name: 'Spend a hero point' })).toBeDisabled();
            });

            test('someone who cannot edit the sheet sees it but cannot change it', () => {
                render(<CharacterMainTab characterPage={characterPage} userId="stranger-1" />);
                goToTab('Combat');
                expect(within(heroPoints()).getByRole('button', { name: 'Spend a hero point' })).toBeDisabled();
                expect(within(heroPoints()).getByRole('button', { name: 'Add a hero point' })).toBeDisabled();
            });
        });

        describe('the combat map peek', () => {
            test('is a map icon in the sticky bar for a character in a campaign', () => {
                const { container } = render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
                goToTab('Combat');
                expect(container.querySelector('.CharacterMainTab-action-points .CombatMapPeek')).toContainElement(screen.getByRole('button', { name: 'Combat map' }));
            });

            test('opens the combat map when clicked, without leaving the Combat tab', () => {
                render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
                goToTab('Combat');

                fireEvent.click(screen.getByRole('button', { name: 'Combat map' }));

                expect(screen.getByRole('region', { name: 'Combat map' })).toBeInTheDocument();
                expect(screen.getByText(/CombatMap-stub:camp-1/)).toBeInTheDocument();
                expect(screen.getByText('Passives')).toBeInTheDocument(); // still on the Combat tab
            });

            test('a player only watches: they cannot move the tokens', () => {
                render(<CharacterMainTab characterPage={characterPage} userId="owner-1" campaignInfo={{ director_uid: 'someone-else', canWrite: ['co-director'] }} />);
                goToTab('Combat');
                fireEvent.click(screen.getByRole('button', { name: 'Combat map' }));
                expect(screen.getByText(/CombatMap-stub:camp-1/)).toHaveAttribute('data-canedit', 'false');
            });

            test.each([
                ['the campaign\'s director', { director_uid: 'owner-1' }],
                ['a co-director', { director_uid: 'x', canWrite: ['owner-1'] }],
                ['a campaign admin', { director_uid: 'x', admins: ['owner-1'] }],
            ])('%s can move them', (_who, campaignInfo) => {
                render(<CharacterMainTab characterPage={characterPage} userId="owner-1" campaignInfo={campaignInfo} />);
                goToTab('Combat');
                fireEvent.click(screen.getByRole('button', { name: 'Combat map' }));
                expect(screen.getByText(/CombatMap-stub:camp-1/)).toHaveAttribute('data-canedit', 'true');
            });

            test('a character in no campaign has no map to peek at', () => {
                render(<CharacterMainTab characterPage={{ ...characterPage, campaign: '' }} userId="owner-1" />);
                goToTab('Combat');
                expect(screen.queryByRole('button', { name: 'Combat map' })).not.toBeInTheDocument();
            });
        });

        describe('the combat portrait', () => {
            test('someone with write permissions sees the optional combat-portrait control', () => {
                render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
                goToTab('Combat');
                expect(screen.getByText('Combat Portrait')).toBeInTheDocument();
                expect(screen.getByText('No combat portrait yet')).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Change combat portrait' })).toBeInTheDocument();
            });

            test('a read-only viewer sees nothing if none was ever set - no clutter with nothing to do about it', () => {
                render(<CharacterMainTab characterPage={characterPage} userId="stranger-1" />);
                goToTab('Combat');
                expect(screen.queryByText('Combat Portrait')).not.toBeInTheDocument();
            });

            test('a read-only viewer still sees one that was set, just without the edit control', () => {
                const { container } = render(<CharacterMainTab characterPage={{ ...characterPage, combat_portrait_url: 'https://example.com/c.png' }} userId="stranger-1" />);
                goToTab('Combat');
                expect(screen.getByText('Combat Portrait')).toBeInTheDocument();
                expect(container.querySelector('.CharacterMainTab-combat-portrait img')).toHaveAttribute('src', 'https://example.com/c.png');
                expect(screen.queryByRole('button', { name: 'Change combat portrait' })).not.toBeInTheDocument();
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
            expect(screen.getByText('Inventory-stub:char-1')).toBeInTheDocument();
            expect(screen.getByText('Pocket-stub:char-1')).toBeInTheDocument();
            expect(screen.queryByText('Relics')).not.toBeInTheDocument();
        });

        test('someone who can change the character gets the add-item toolbar and can drag things about; everyone else only looks', () => {
            mockInventoryProps.length = 0;
            mockUseIsMobile.mockReturnValue(false);
            const { unmount } = render(<CharacterMainTab characterPage={characterPage} userId="owner-1" campaignInfo={{ director_uid: 'dm', canRead: ['owner-1'], canWrite: ['dm'] }} />);
            goToTab('Inventory');
            expect(screen.getByText('InventoryToolbar-stub:char-1:camp-1:owner-1:dm,owner-1')).toBeInTheDocument();
            mockInventoryProps.forEach(([, props]) => expect(props).toMatchObject({ canEdit: true, campaignId: 'camp-1', userId: 'owner-1' }));
            unmount();

            mockInventoryProps.length = 0;
            render(<CharacterMainTab characterPage={characterPage} userId="stranger-1" />);
            goToTab('Inventory');
            expect(screen.queryByText(/InventoryToolbar-stub/)).not.toBeInTheDocument();
            mockInventoryProps.forEach(([, props]) => expect(props.canEdit).toBe(false));
        });

        test('the backpack, the relics and the pocket are all given the campaign, for the party inventory', () => {
            mockInventoryProps.length = 0;
            mockUseIsMobile.mockReturnValue(true);
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Inventory');
            expect(mockInventoryProps.length).toBeGreaterThanOrEqual(3);
            mockInventoryProps.forEach(([, props]) => expect(props.campaignId).toBe('camp-1'));
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

    describe('Party tab', () => {
        test('opens the party (inventory, trades, notebook, calendar) for the character\'s campaign, acting as this character', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Party');
            expect(screen.getByText('PartySpace-stub:camp-1:inventory:char-1')).toBeInTheDocument();
        });

        test('remembers which of its tabs it was on when you come back to it', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Party');
            fireEvent.click(screen.getByRole('button', { name: 'Go to trades' }));
            goToTab('Roleplay');
            goToTab('Party');
            expect(screen.getByText('PartySpace-stub:camp-1:trades:char-1')).toBeInTheDocument();
        });

        test('a character with no campaign gets the join/create prompt instead', () => {
            render(<CharacterMainTab characterPage={{ ...characterPage, campaign: null }} userId="owner-1" />);
            goToTab('Party');
            expect(screen.getByText("This character isn't part of a campaign yet.")).toBeInTheDocument();
            expect(screen.queryByText(/PartySpace-stub/)).not.toBeInTheDocument();
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

        describe('moving people between zones in the list', () => {
            const lineProps = () => mockLineProps[mockLineProps.length - 1];
            const entities = [
                { id: 'character:char-1', title: 'Aria', kind: 'player', ownerIds: ['owner-1'] },
                { id: 'character:char-2', title: 'Bram', kind: 'player', ownerIds: ['other-player'] },
                { id: 'npc:goblin', title: 'Goblin', kind: 'enemy' },
            ];

            beforeEach(() => {
                mockLineProps.length = 0;
                mockUseCombatEntities.mockReturnValue(entities);
            });

            test('a player can drag their own character, and nobody else\'s, nor the enemies\'', () => {
                render(<CharacterMainTab characterPage={characterPage} userId="owner-1" campaignInfo={{ director_uid: 'someone-else' }} />);
                goToTab('Combat Map');
                expect(lineProps().readOnly).toBeFalsy();
                expect(lineProps().canMovePost({ id: 'character:char-1' })).toBe(true);
                expect(lineProps().canMovePost({ id: 'character:char-2' })).toBe(false);
                expect(lineProps().canMovePost({ id: 'npc:goblin' })).toBe(false);
            });

            test('a director can drag anyone', () => {
                render(<CharacterMainTab characterPage={characterPage} userId="owner-1" campaignInfo={{ director_uid: 'owner-1' }} />);
                goToTab('Combat Map');
                ['character:char-1', 'character:char-2', 'npc:goblin'].forEach(id => expect(lineProps().canMovePost({ id })).toBe(true));
            });

            test('someone who is signed out cannot drag anyone', () => {
                render(<CharacterMainTab characterPage={characterPage} userId={undefined} campaignInfo={{ director_uid: 'someone-else' }} />);
                goToTab('Combat Map');
                expect(lineProps().canMovePost({ id: 'character:char-1' })).toBe(false);
            });

            test('the columns are the active map\'s zones, so a move can only be to a zone the map has', () => {
                mockUseCampaignMaps.mockReturnValue({ activeMap: { map_id: 'map-1', zones: [{ name: 'Gate', x: 10, y: 10, width: 100, height: 80 }, { name: 'Yard', x: 200, y: 10, width: 100, height: 80 }] } });
                render(<CharacterMainTab characterPage={characterPage} userId="owner-1" campaignInfo={{ director_uid: 'owner-1' }} />);
                goToTab('Combat Map');
                expect(lineProps().inputStatuses).toEqual(['Gate', 'Yard']);
            });

            test('with no active map there are no zones to list, and no positions to give', () => {
                render(<CharacterMainTab characterPage={characterPage} userId="owner-1" campaignInfo={{ director_uid: 'owner-1' }} />);
                goToTab('Combat Map');
                expect(lineProps().inputStatuses).toEqual([]);
                expect(lineProps().rects).toBeNull();
            });

            test('given the map\'s zones as rectangles, for where a moved token lands on the map', () => {
                mockUseCampaignMaps.mockReturnValue({ activeMap: { map_id: 'map-1', zones: [{ name: 'Gate', x: 50, y: 100, width: 100, height: 50 }] } });
                render(<CharacterMainTab characterPage={characterPage} userId="owner-1" campaignInfo={{ director_uid: 'owner-1' }} />);
                goToTab('Combat Map');
                expect(lineProps().rects).toEqual([{ name: 'Gate', x: 0.1, y: 0.2, w: 0.2, h: 0.1 }]);
            });

            test('a map with no zones list is fine', () => {
                mockUseCampaignMaps.mockReturnValue({ activeMap: { map_id: 'map-1' } });
                render(<CharacterMainTab characterPage={characterPage} userId="owner-1" campaignInfo={{ director_uid: 'owner-1' }} />);
                goToTab('Combat Map');
                expect(lineProps().inputStatuses).toEqual([]);
            });
        });

        test('the player\'s own characters put themselves on the tracker, given the campaign, the active map and everyone in the fight', () => {
            const activeMap = { map_id: 'map-1' };
            const entities = [{ id: 'character:char-1', title: 'Aria' }];
            mockUseCampaignMaps.mockReturnValue({ activeMap });
            mockUseCombatEntities.mockReturnValue(entities);
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            expect(mockUseOwnCombatTokens).toHaveBeenCalledWith({ campaignId: 'camp-1', activeMap, entities, userId: 'owner-1' });
        });

        test('a character with no campaign has no tracker to be put on', () => {
            render(<CharacterMainTab characterPage={{ ...characterPage, campaign: undefined }} userId="owner-1" />);
            expect(mockUseOwnCombatTokens).toHaveBeenCalledWith(expect.objectContaining({ campaignId: '' }));
        });

        test('Open Combat Map opens a full-screen overlay with the active map and combat entities', () => {
            mockUseCampaignMaps.mockReturnValue({ activeMap: { map_id: 'map-1' } });
            mockUseCombatEntities.mockReturnValue([{ id: 'character:char-1', title: 'Aria' }]);
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Combat Map');

            fireEvent.click(screen.getByRole('button', { name: /Open Combat Map/ }));

            expect(screen.getByText('CombatMap-stub:camp-1:map-1:1')).toBeInTheDocument();
        });

        test('the overlay puts the director\'s map tools beside the map, where the wide screen has room for them', () => {
            mockUseCampaignMaps.mockReturnValue({ activeMap: { map_id: 'map-1' } });
            mockUseCombatEntities.mockReturnValue([{ id: 'character:char-1', title: 'Aria' }]);
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Combat Map');
            fireEvent.click(screen.getByRole('button', { name: /Open Combat Map/ }));
            expect(screen.getByText('CombatMap-stub:camp-1:map-1:1')).toHaveAttribute('data-beside', 'true');
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
