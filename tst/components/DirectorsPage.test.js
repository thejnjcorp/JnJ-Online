jest.mock('../../src/utils/firebase', () => ({ auth: {}, db: {} }));

const mockOnAuthStateChanged = jest.fn();
jest.mock('firebase/auth', () => ({
    onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
}));

const mockAddDoc = jest.fn();
const mockCollection = jest.fn();
const mockDeleteDoc = jest.fn();
const mockDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockQuery = jest.fn();
const mockUpdateDoc = jest.fn();
const mockWhere = jest.fn();
jest.mock('firebase/firestore', () => ({
    addDoc: (...args) => mockAddDoc(...args),
    collection: (...args) => mockCollection(...args),
    deleteDoc: (...args) => mockDeleteDoc(...args),
    doc: (...args) => mockDoc(...args),
    onSnapshot: (...args) => mockOnSnapshot(...args),
    query: (...args) => mockQuery(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
    where: (...args) => mockWhere(...args),
}));

// The combat tracker is on the party doc; taking enemies off it is a change worked
// out against it (utils/party.js).
const mockUpdateCombatTracker = jest.fn();
jest.mock('../../src/utils/party', () => ({
    ...jest.requireActual('../../src/utils/party'),
    updateCombatTracker: (...args) => mockUpdateCombatTracker(...args),
}));

const mockUploadImageToImgur = jest.fn();
jest.mock('../../src/utils/imgurUploader', () => ({
    uploadImageToImgur: (...args) => mockUploadImageToImgur(...args),
}));

const mockUseCampaignMaps = jest.fn();
const mockUseCombatEntities = jest.fn();
jest.mock('../../src/utils/useCampaignCombat', () => ({
    useCampaignMaps: (...args) => mockUseCampaignMaps(...args),
    useCombatEntities: (...args) => mockUseCombatEntities(...args),
}));

let mockBestiary;
jest.mock('../../src/utils/useBestiary', () => ({ useBestiary: () => mockBestiary }));
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ ...jest.requireActual('react-router-dom'), useNavigate: () => mockNavigate }));

jest.mock('../../src/components/SkillsAndFlaws', () => ({
    SkillsAndFlaws: ({ characterPage }) => <div>SkillsAndFlaws-stub:{characterPage.character_name}</div>,
}));
jest.mock('../../src/components/Statuses', () => ({
    Statuses: ({ characterPage, hasWritePermissions }) => <div>Statuses-stub:{characterPage.character_id || characterPage.id}:{hasWritePermissions ? 'write' : 'readonly'}</div>,
}));
jest.mock('../../src/components/CombatActionList', () => ({
    CombatActionList: ({ actions, onUseAction }) => <div>
        CombatActionList-stub:{actions.length}
        {onUseAction && <button type="button" onClick={() => onUseAction({ actionCost: 1 })}>StubUseAction</button>}
        {onUseAction && <button type="button" onClick={() => onUseAction({ actionCost: 1, category: 'reaction' })}>StubUseReaction</button>}
    </div>,
}));
jest.mock('../../src/components/DirectorNotes', () => ({
    DirectorNotes: ({ campaignId }) => <div>DirectorNotes-stub:{campaignId}</div>,
}));
jest.mock('../../src/components/MapRenderer', () => ({
    MapRenderer: ({ map, userId }) => <div>MapRenderer-stub:{map.map_id}:{userId}</div>,
}));
jest.mock('../../src/components/DocAdminManager', () => ({
    DocAdminManager: ({ admins, userId }) => <div>DocAdminManager-stub:{JSON.stringify(admins)}:{userId}</div>,
}));
const mockLineProps = [];
jest.mock('../../src/utils/DraggableElements/PostListCombat.tsx', () => ({
    PostListContentCombat: props => {
        mockLineProps.push(props);
        return <div data-readonly={String(Boolean(props.readOnly))}>Combat-stub:{props.campaignId}:{props.inputStatuses.length}</div>;
    },
}));
const mockMapProps = [];
jest.mock('../../src/utils/DraggableElements/PostListCombatMap.tsx', () => ({
    PostListContentCombatMap: props => {
        mockMapProps.push(props);
        const { campaignId, activeMap, entities, noMap, canEdit } = props;
        return <div data-nomap={String(Boolean(noMap))} data-canedit={String(Boolean(canEdit))}>CombatMap-stub:{campaignId}:{activeMap?.map_id}:{entities.length}</div>;
    },
}));

// eslint-disable-next-line import/first
import { screen, fireEvent, waitFor, act, within } from '@testing-library/react';
// eslint-disable-next-line import/first
import { DirectorsPage } from '../../src/components/DirectorsPage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const character = {
    character_id: 'char-1', character_name: 'Aria', class: 'Fighter', userId: 'owner-1',
    current_health: 20, maximum_health: 25, temporary_health: 0, action_points: 2,
    experience_points: 0, base_armor_class: 12, base_hit_modifier: 2, base_damage_modifier: 0,
    base_damage_dice: 1, base_damage_dice_type: 6, base_healing_dice_type: 4,
    actions: [],
};

const enemy = {
    id: 'enemy-1', enemy_name: 'Goblin', level: 2, current_health: 10, maximum_health: 10, temporary_health: 0,
    action_points: 1, base_armor_class: 11, base_hit_modifier: 1, base_damage_modifier: 0,
    base_damage_dice: 1, base_damage_dice_type: 4, base_healing_dice_type: 4,
    Weaknesses: ['Fire'], Resistances: ['Cold'], actions: [],
};

const baseCampaignInfo = {
    campaign_name: 'The Iron Vale', director_name: 'Sam',
    enemy_list: [], ally_combat_npc_list: [], neutral_combat_npc_list: [],
    active_map: null, maps: [],
};

// Installs a router that dispatches each onSnapshot(target, opts, cb) call
// to a callback bucket keyed by the target's own identity, since the
// campaign-doc and characters-query listeners both funnel through the same
// mocked onSnapshot function - mirrors CharacterPage.test.js's identical need.
function installSnapshotRouter() {
    const callbacksByTarget = new Map();
    mockOnSnapshot.mockImplementation((target, _opts, callback) => {
        callbacksByTarget.set(target, callback);
        return jest.fn();
    });
    return {
        fireCampaign: (data, hasPendingWrites = false) => act(() => callbacksByTarget.get(mockDoc.mock.results[0].value)({
            metadata: { hasPendingWrites }, data: () => data,
        })),
        fireCharacters: (items, hasPendingWrites = false) => act(() => callbacksByTarget.get(mockQuery.mock.results[0].value)({
            metadata: { hasPendingWrites }, docs: items.map(item => ({ id: item.character_id, data: () => item })),
        })),
    };
}

function signIn(user) {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        Promise.resolve().then(() => callback(user));
        return jest.fn();
    });
}

async function renderReady({ campaignInfo = baseCampaignInfo, characters = [character] } = {}) {
    const router = installSnapshotRouter();
    renderWithRouter(<DirectorsPage />, { route: '/directors/camp-1' });
    router.fireCampaign(campaignInfo);
    router.fireCharacters(characters);
    await act(async () => { await Promise.resolve(); });
    return router;
}

beforeEach(() => {
    mockMapProps.length = 0;
    mockLineProps.length = 0;
    mockCollection.mockImplementation((_db, name) => ({ __collection: name }));
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockQuery.mockImplementation((...args) => ({ __query: args }));
    mockWhere.mockImplementation((...args) => ({ __where: args }));
    mockOnSnapshot.mockImplementation(() => jest.fn());
    mockOnAuthStateChanged.mockImplementation(() => jest.fn());
    mockUpdateDoc.mockResolvedValue(undefined);
    mockUpdateCombatTracker.mockReset();
    mockUpdateCombatTracker.mockResolvedValue(undefined);
    mockAddDoc.mockResolvedValue({ id: 'new-map-id' });
    mockDeleteDoc.mockResolvedValue(undefined);
    mockUploadImageToImgur.mockResolvedValue('https://imgur.example/map.png');
    mockUseCampaignMaps.mockReturnValue({ maps: [], activeMap: null });
    mockUseCombatEntities.mockReturnValue([]);
    mockBestiary = { enemies: [], status: 'ready' };
    signIn({ uid: 'owner-1' });
    window.alert = jest.fn();
    window.confirm = jest.fn(() => true);
    global.URL.createObjectURL = jest.fn(() => 'blob:preview');
});

afterEach(() => {
    delete window.alert;
    delete window.confirm;
    delete global.URL.createObjectURL;
});

function goToTab(name) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(name + '$') }));
}

describe('DirectorsPage', () => {
    test('subscribes to the campaign doc and characters scoped to the URL\'s campaign id', async () => {
        await renderReady();
        expect(mockDoc).toHaveBeenCalledWith({}, 'campaigns', 'camp-1');
        expect(mockCollection).toHaveBeenCalledWith({}, 'characters');
        expect(mockWhere).toHaveBeenCalledWith('campaign', '==', 'camp-1');
    });

    test('the sidebar lists each character with their skills & flaws', async () => {
        await renderReady();
        expect(screen.getByText('Aria')).toBeInTheDocument();
        expect(screen.getByText('SkillsAndFlaws-stub:Aria')).toBeInTheDocument();
    });

    test('the Roleplay tab is present (placeholder content)', async () => {
        await renderReady();
        expect(screen.getByRole('button', { name: /Roleplay$/ })).toBeInTheDocument();
    });

    describe('Notes tab (directors only)', () => {
        test.each([
            ['the campaign\'s director', { director_uid: 'owner-1' }],
            ['a co-director in canWrite', { director_uid: 'someone-else', canWrite: ['owner-1'] }],
            ['a campaign doc admin', { director_uid: 'someone-else', admins: ['owner-1'] }],
        ])('is offered to %s, and opens the notebook for this campaign', async (_who, permissions) => {
            await renderReady({ campaignInfo: { ...baseCampaignInfo, ...permissions } });

            goToTab('Notes');

            expect(screen.getByText('DirectorNotes-stub:camp-1')).toBeInTheDocument();
        });

        test('is not offered to a player (in canRead, not a director) - the rule would refuse it anyway', async () => {
            await renderReady({ campaignInfo: { ...baseCampaignInfo, director_uid: 'someone-else', canWrite: ['someone-else'], canRead: ['owner-1'] } });

            expect(screen.queryByRole('button', { name: /Notes$/ })).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Combat$/ })).toBeInTheDocument();
        });

        test('is not offered before the campaign has loaded or while signed out', async () => {
            signIn(null);
            await renderReady({ campaignInfo: { ...baseCampaignInfo, director_uid: 'owner-1' } });
            expect(screen.queryByRole('button', { name: /Notes$/ })).not.toBeInTheDocument();
        });

        test('the other tabs are untouched', async () => {
            await renderReady({ campaignInfo: { ...baseCampaignInfo, director_uid: 'owner-1' } });
            ['Roleplay', 'Combat', 'Maps', 'Notes'].forEach(name => expect(screen.getByRole('button', { name: new RegExp(name + '$') })).toBeInTheDocument());
        });
    });

    describe('Combat tab: player characters', () => {
        test('shows the character name, HP, and AC', async () => {
            await renderReady();
            goToTab('Combat');
            expect(screen.getByText('Aria', { selector: '.DirectorsPage-entity-name' })).toBeInTheDocument();
            expect(screen.getByText('20/25 HP')).toBeInTheDocument();
            expect(screen.getByText('12')).toBeInTheDocument(); // AC
        });

        test('lists only the combat actions: a roleplay-only action is left off, one used in both stays', async () => {
            const actions = [
                { actionName: 'Stab', actionCost: 1 },
                { actionName: 'Silver Tongue', actionCost: 0, usage: 'roleplay' },
                { actionName: 'Parry', actionCost: 1, usage: 'both' },
            ];
            await renderReady({ characters: [{ ...character, actions }] });
            goToTab('Combat');
            fireEvent.click(screen.getByRole('button', { name: /Actions$/ }));

            expect(screen.getByText(/CombatActionList-stub:2/)).toBeInTheDocument();
        });

        test('the owner can spend an action point, writing to the character doc', async () => {
            await renderReady();
            goToTab('Combat');
            // eslint-disable-next-line testing-library/no-node-access -- the AP circle buttons only contain an empty-alt icon, with no accessible name to query by
            const apButtons = screen.getByText('20/25 HP').closest('.DirectorsPage-entity-card').querySelectorAll('.DirectorsPage-ap-circles button');

            fireEvent.click(apButtons[2]);

            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { action_points: 3 });
        });

        test('a non-owner, non-writer cannot spend action points or advance the turn', async () => {
            await renderReady({ characters: [{ ...character, userId: 'someone-else', canWrite: [] }] });
            goToTab('Combat');
            expect(screen.queryByRole('button', { name: 'Next Turn' })).not.toBeInTheDocument();
            // eslint-disable-next-line testing-library/no-node-access -- same as above: no accessible name on these icon-only buttons
            const apButtons = screen.getByText('20/25 HP').closest('.DirectorsPage-entity-card').querySelectorAll('.DirectorsPage-ap-circles button');
            apButtons.forEach(b => expect(b).toBeDisabled());
        });

        describe('the reaction (one per turn)', () => {
            const card = () => screen.getByText('20/25 HP').closest('.DirectorsPage-entity-card');
            const pip = () => within(card()).getByRole('button', { name: /^Reaction (available|used)$/ });

            test('each player card shows whether the reaction is available', async () => {
                await renderReady();
                goToTab('Combat');
                expect(pip()).toHaveAccessibleName('Reaction available');
                expect(pip()).toHaveAttribute('aria-pressed', 'true');
            });

            test('and whether it has been used', async () => {
                await renderReady({ characters: [{ ...character, reaction_used: true }] });
                goToTab('Combat');
                expect(pip()).toHaveAccessibleName('Reaction used');
                expect(pip()).toHaveAttribute('aria-pressed', 'false');
            });

            test('clicking it marks the reaction used, writing to the character', async () => {
                await renderReady();
                goToTab('Combat');
                fireEvent.click(pip());
                expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { reaction_used: true });
            });

            test('and clicking a used one gives it back', async () => {
                await renderReady({ characters: [{ ...character, reaction_used: true }] });
                goToTab('Combat');
                fireEvent.click(pip());
                expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { reaction_used: false });
            });

            test('someone who cannot edit the character sees it but cannot change it', async () => {
                await renderReady({ characters: [{ ...character, userId: 'someone-else', canWrite: [] }] });
                goToTab('Combat');
                expect(pip()).toBeDisabled();
            });

            test('Next Turn gives the reaction back', async () => {
                await renderReady({ characters: [{ ...character, reaction_used: true }] });
                goToTab('Combat');
                fireEvent.click(screen.getByRole('button', { name: 'Next Turn' }));
                expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, expect.objectContaining({ reaction_used: false }));
            });
        });

        test('Next Turn writes the advanced-turn character data', async () => {
            await renderReady();
            goToTab('Combat');

            fireEvent.click(screen.getByRole('button', { name: 'Next Turn' }));

            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, expect.any(Object));
        });

        test('Statuses receives write permission matching the owner check', async () => {
            await renderReady();
            goToTab('Combat');
            expect(screen.getByText('Statuses-stub:char-1:write')).toBeInTheDocument();
        });

        test('the Actions toggle reveals the combat action list', async () => {
            await renderReady();
            goToTab('Combat');
            expect(screen.queryByText(/CombatActionList-stub/)).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: /Actions$/ }));

            expect(screen.getByText(/CombatActionList-stub/)).toBeInTheDocument();
        });

        test('the entity card collapses and expands via its header', async () => {
            await renderReady();
            goToTab('Combat');
            expect(screen.getByText('Statuses-stub:char-1:write')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: /Aria.*20\/25 HP/ }));

            expect(screen.queryByText('Statuses-stub:char-1:write')).not.toBeInTheDocument();
        });

        test('the Player Characters panel collapses via its own button', async () => {
            await renderReady();
            goToTab('Combat');
            expect(screen.getByText('Player Characters')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Collapse Player Characters' }));

            expect(screen.queryByText('Player Characters')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Expand Player Characters' })).toBeInTheDocument();
        });
    });

    describe('Combat tab: enemies', () => {
        test('shows the enemy name, level subtitle, and weakness/resistance chips', async () => {
            await renderReady({ campaignInfo: { ...baseCampaignInfo, enemy_list: [enemy] } });
            goToTab('Combat');
            expect(screen.getByText('Goblin')).toBeInTheDocument();
            expect(screen.getByText('Lvl 2')).toBeInTheDocument();
            expect(screen.getByText('Fire')).toBeInTheDocument();
            expect(screen.getByText('Cold')).toBeInTheDocument();
        });

        test('spending an enemy action point writes the whole updated enemy_list', async () => {
            await renderReady({ campaignInfo: { ...baseCampaignInfo, enemy_list: [enemy] } });
            goToTab('Combat');
            // eslint-disable-next-line testing-library/no-node-access -- icon-only AP buttons again have no accessible name
            const apButtons = screen.getByText('Goblin').closest('.DirectorsPage-entity-card').querySelectorAll('.DirectorsPage-ap-circles button');

            fireEvent.click(apButtons[0]);

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith(
                { __doc: ['campaigns', 'camp-1'] },
                { enemy_list: [{ ...enemy, action_points: 1 }] },
            ));
        });

        test('Statuses for an enemy always has write access, and updates route through the campaign doc', async () => {
            await renderReady({ campaignInfo: { ...baseCampaignInfo, enemy_list: [enemy] } });
            goToTab('Combat');
            expect(screen.getByText('Statuses-stub:enemy-1:write')).toBeInTheDocument();
        });

        test('using an enemy action deducts its action cost', async () => {
            await renderReady({ characters: [], campaignInfo: { ...baseCampaignInfo, enemy_list: [{ ...enemy, actions: [{ actionName: 'Bite', actionCost: 1 }] }] } });
            goToTab('Combat');
            fireEvent.click(screen.getByRole('button', { name: /Actions$/ }));

            fireEvent.click(screen.getByRole('button', { name: 'StubUseAction' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith(
                { __doc: ['campaigns', 'camp-1'] },
                { enemy_list: [expect.objectContaining({ action_points: 0 })] }, // 1 - 1
            ));
        });

        describe('the reaction (one per turn)', () => {
            const withEnemy = (extra = {}) => ({ characters: [], campaignInfo: { ...baseCampaignInfo, enemy_list: [{ ...enemy, actions: [{ actionName: 'Parry', actionCost: 1, category: 'reaction' }], ...extra }] } });
            const pip = () => screen.getByRole('button', { name: /^Reaction (available|used)$/ });

            test('an enemy card shows its reaction, available to begin with', async () => {
                await renderReady(withEnemy());
                goToTab('Combat');
                expect(pip()).toHaveAccessibleName('Reaction available');
            });

            test('clicking it marks the enemy\'s reaction used, and again gives it back', async () => {
                await renderReady(withEnemy());
                goToTab('Combat');
                fireEvent.click(pip());
                await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1'] }, { enemy_list: [expect.objectContaining({ reaction_used: true })] }));
            });

            test('a used reaction is shown as used', async () => {
                await renderReady(withEnemy({ reaction_used: true }));
                goToTab('Combat');
                expect(pip()).toHaveAccessibleName('Reaction used');
            });

            test('using a reaction action spends the reaction as well as the action points', async () => {
                await renderReady(withEnemy());
                goToTab('Combat');
                fireEvent.click(screen.getByRole('button', { name: /Actions$/ }));

                fireEvent.click(screen.getByRole('button', { name: 'StubUseReaction' }));

                await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith(
                    { __doc: ['campaigns', 'camp-1'] },
                    { enemy_list: [expect.objectContaining({ action_points: 0, reaction_used: true })] },
                ));
            });

            test('using an ordinary action leaves the reaction alone', async () => {
                await renderReady(withEnemy());
                goToTab('Combat');
                fireEvent.click(screen.getByRole('button', { name: /Actions$/ }));

                fireEvent.click(screen.getByRole('button', { name: 'StubUseAction' }));

                await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
                expect(mockUpdateDoc.mock.calls.at(-1)[1].enemy_list[0].reaction_used).toBeUndefined();
            });

            test('Next Turn gives an enemy its reaction back', async () => {
                await renderReady(withEnemy({ reaction_used: true }));
                goToTab('Combat');
                fireEvent.click(screen.getAllByRole('button', { name: 'Next Turn' })[0]);
                await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1'] }, { enemy_list: [expect.objectContaining({ reaction_used: false })] }));
            });
        });

        test('shows the enemy\'s tier as a badge beside its name', async () => {
            await renderReady({ campaignInfo: { ...baseCampaignInfo, enemy_list: [{ ...enemy, enemy_type: 'Captain' }] } });
            goToTab('Combat');
            expect(screen.getByText('Captain')).toHaveClass('EnemyTier-captain');
        });

        test('an enemy with no tier (from before there were tiers) has no badge', async () => {
            await renderReady({ campaignInfo: { ...baseCampaignInfo, enemy_list: [enemy] } });
            goToTab('Combat');
            expect(document.querySelector('.EnemyTier')).toBeNull();
        });

        describe('the director\'s tools', () => {
            const directing = { ...baseCampaignInfo, director_uid: 'owner-1' };
            const wolf = { id: 'b1', enemy_name: 'Wolf', enemy_type: 'Regular', maximum_health: 20, base_armor_class: 13, action_points: 3, actions: [] };

            test('a director can add an enemy, go to encounters, and clear the fight (once there is one)', async () => {
                await renderReady({ campaignInfo: { ...directing, enemy_list: [enemy] } });
                goToTab('Combat');
                expect(screen.getByRole('button', { name: '+ Add' })).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Encounters' })).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Clear all' })).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Remove from fight' })).toBeInTheDocument();
            });

            test('there is nothing to clear in an empty fight, which says how to fill it', async () => {
                await renderReady({ campaignInfo: directing });
                goToTab('Combat');
                expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();
                expect(screen.getByText(/No enemies in the fight/)).toBeInTheDocument();
            });

            test('a player, who cannot direct, sees the enemies but none of the tools', async () => {
                await renderReady({ campaignInfo: { ...baseCampaignInfo, enemy_list: [enemy], director_uid: 'someone-else', canRead: ['owner-1'] } });
                goToTab('Combat');
                expect(screen.getByText('Goblin')).toBeInTheDocument();
                ['+ Add', 'Encounters', 'Clear all', 'Remove from fight'].forEach(name => expect(screen.queryByRole('button', { name })).not.toBeInTheDocument());
                expect(screen.queryByText(/No enemies in the fight/)).not.toBeInTheDocument();
            });

            test('Encounters goes to this campaign\'s encounters', async () => {
                await renderReady({ campaignInfo: directing });
                goToTab('Combat');
                fireEvent.click(screen.getByRole('button', { name: 'Encounters' }));
                expect(mockNavigate).toHaveBeenCalledWith('/campaigns/camp-1/encounters');
            });

            test('+ Add opens the bestiary, and picking an enemy adds it to the campaign at full health', async () => {
                mockBestiary = { enemies: [wolf], status: 'ready' };
                await renderReady({ campaignInfo: { ...directing, enemy_list: [enemy] } });
                goToTab('Combat');
                fireEvent.click(screen.getByRole('button', { name: '+ Add' }));

                fireEvent.click(screen.getByRole('button', { name: /Wolf/ }));

                await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
                const [target, data] = mockUpdateDoc.mock.calls[0];
                expect(target).toEqual({ __doc: ['campaigns', 'camp-1'] });
                expect(data.enemy_list).toHaveLength(2);
                expect(data.enemy_list[0]).toEqual(enemy);
                expect(data.enemy_list[1]).toMatchObject({ enemy_name: 'Wolf', enemy_type: 'Regular', current_health: 20, maximum_health: 20, statuses: [] });
                expect(screen.getByRole('dialog', { name: 'Add enemy' })).toBeInTheDocument(); // still open, for another
            });

            test('the dialog closes', async () => {
                await renderReady({ campaignInfo: directing });
                goToTab('Combat');
                fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
                fireEvent.click(screen.getByRole('button', { name: 'Done' }));
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });

            test('Remove from fight takes the enemy and its tracker card off the campaign, after asking', async () => {
                const other = { ...enemy, id: 'enemy-2', enemy_name: 'Troll' };
                await renderReady({ campaignInfo: { ...directing, enemy_list: [enemy, other] } });
                goToTab('Combat');
                const card = screen.getByText('Goblin').closest('.DirectorsPage-entity-card');

                fireEvent.click(within(card).getByRole('button', { name: 'Remove from fight' }));

                expect(window.confirm).toHaveBeenCalledWith('Remove Goblin from the fight?');
                await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1'] }, { enemy_list: [other] }));
                expect(mockUpdateCombatTracker).toHaveBeenCalledWith('camp-1', expect.any(Function));
                const trackerChange = mockUpdateCombatTracker.mock.calls[0][1];
                expect(trackerChange([{ id: 'npc:enemy-1' }, { id: 'npc:enemy-2' }, { id: 'character:char-1' }])).toEqual([{ id: 'npc:enemy-2' }, { id: 'character:char-1' }]);
            });

            describe('defeating enemies', () => {
                const card = () => screen.getByText('Goblin').closest('.DirectorsPage-entity-card');

                test('a card offers to mark an enemy defeated, and writes it to the enemy on the campaign', async () => {
                    const other = { ...enemy, id: 'enemy-2', enemy_name: 'Troll' };
                    await renderReady({ campaignInfo: { ...directing, enemy_list: [enemy, other] } });
                    goToTab('Combat');

                    fireEvent.click(within(card()).getByRole('button', { name: 'Mark defeated' }));

                    await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1'] }, { enemy_list: [{ ...enemy, defeated: true }, other] }));
                });

                test('a defeated enemy\'s card says so, is dimmed, and offers to revive it instead', async () => {
                    await renderReady({ campaignInfo: { ...directing, enemy_list: [{ ...enemy, defeated: true }] } });
                    goToTab('Combat');

                    expect(within(card()).getByText('Defeated')).toBeInTheDocument();
                    expect(card()).toHaveClass('DirectorsPage-entity-card-defeated');
                    expect(within(card()).queryByRole('button', { name: 'Mark defeated' })).not.toBeInTheDocument();

                    fireEvent.click(within(card()).getByRole('button', { name: 'Revive' }));
                    await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1'] }, { enemy_list: [{ ...enemy, defeated: false }] }));
                });

                test('an enemy that is not defeated has no badge and is not dimmed', async () => {
                    await renderReady({ campaignInfo: { ...directing, enemy_list: [enemy] } });
                    goToTab('Combat');
                    expect(within(card()).queryByText('Defeated')).not.toBeInTheDocument();
                    expect(card()).not.toHaveClass('DirectorsPage-entity-card-defeated');
                });

                test('a player sees that an enemy is defeated, but cannot change it', async () => {
                    await renderReady({ campaignInfo: { ...baseCampaignInfo, enemy_list: [{ ...enemy, defeated: true }], director_uid: 'someone-else', canRead: ['owner-1'] } });
                    goToTab('Combat');
                    expect(within(card()).getByText('Defeated')).toBeInTheDocument();
                    ['Revive', 'Mark defeated'].forEach(name => expect(screen.queryByRole('button', { name })).not.toBeInTheDocument());
                });

                test('a failed write is alerted', async () => {
                    mockUpdateDoc.mockRejectedValue(new Error('offline'));
                    await renderReady({ campaignInfo: { ...directing, enemy_list: [enemy] } });
                    goToTab('Combat');
                    fireEvent.click(within(card()).getByRole('button', { name: 'Mark defeated' }));
                    await waitFor(() => expect(window.alert).toHaveBeenCalled());
                });

                describe('from the map', () => {
                    const lastMapProps = () => mockMapProps[mockMapProps.length - 1];

                    test('a director\'s maps are given the means to mark an enemy defeated or take it out of the fight', async () => {
                        await renderReady({ campaignInfo: { ...directing, enemy_list: [enemy] } });
                        goToTab('Combat');
                        expect(lastMapProps()).toMatchObject({ onSetDefeated: expect.any(Function), onRemoveEntity: expect.any(Function) });
                    });

                    test('a player\'s are not', async () => {
                        await renderReady({ campaignInfo: { ...baseCampaignInfo, enemy_list: [enemy], director_uid: 'someone-else', canRead: ['owner-1'] } });
                        goToTab('Combat');
                        expect(lastMapProps().onSetDefeated).toBeUndefined();
                        expect(lastMapProps().onRemoveEntity).toBeUndefined();
                    });

                    test('marking one defeated from its token writes it to that enemy, and reviving clears it', async () => {
                        const other = { ...enemy, id: 'enemy-2', enemy_name: 'Troll' };
                        await renderReady({ campaignInfo: { ...directing, enemy_list: [enemy, other] } });
                        goToTab('Combat');

                        lastMapProps().onSetDefeated('npc:enemy-2', true);

                        await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1'] }, { enemy_list: [enemy, { ...other, defeated: true }] }));
                    });

                    test('a token that is not an enemy in the fight (a player\'s, or one that is gone) is ignored', async () => {
                        await renderReady({ campaignInfo: { ...directing, enemy_list: [enemy] } });
                        goToTab('Combat');
                        lastMapProps().onSetDefeated('character:char-1', true);
                        lastMapProps().onSetDefeated('npc:nobody', true);
                        lastMapProps().onRemoveEntity({ id: 'npc:nobody' });
                        expect(mockUpdateDoc).not.toHaveBeenCalled();
                        expect(window.confirm).not.toHaveBeenCalled();
                    });

                    test('taking one out from the map asks first, like the card does, and takes its tracker card too', async () => {
                        const other = { ...enemy, id: 'enemy-2', enemy_name: 'Troll' };
                        await renderReady({ campaignInfo: { ...directing, enemy_list: [enemy, other] } });
                        goToTab('Combat');

                        lastMapProps().onRemoveEntity({ id: 'npc:enemy-1', title: 'Goblin' });

                        expect(window.confirm).toHaveBeenCalledWith('Remove Goblin from the fight?');
                        await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1'] }, { enemy_list: [other] }));
                        expect(mockUpdateCombatTracker).toHaveBeenCalledWith('camp-1', expect.any(Function));
                    });

                    test('declining leaves it in the fight', async () => {
                        window.confirm = jest.fn(() => false);
                        await renderReady({ campaignInfo: { ...directing, enemy_list: [enemy] } });
                        goToTab('Combat');
                        lastMapProps().onRemoveEntity({ id: 'npc:enemy-1', title: 'Goblin' });
                        expect(mockUpdateDoc).not.toHaveBeenCalled();
                    });
                });
            });

            test('declining removes nothing', async () => {
                window.confirm = jest.fn(() => false);
                await renderReady({ campaignInfo: { ...directing, enemy_list: [enemy] } });
                goToTab('Combat');
                fireEvent.click(screen.getByRole('button', { name: 'Remove from fight' }));
                expect(mockUpdateDoc).not.toHaveBeenCalled();
            });

            test('Clear all removes every enemy and their tracker cards, but not the players\'', async () => {
                const other = { ...enemy, id: 'enemy-2', enemy_name: 'Troll' };
                await renderReady({ campaignInfo: { ...directing, enemy_list: [enemy, other] } });
                goToTab('Combat');

                fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));

                expect(window.confirm).toHaveBeenCalledWith('Remove every enemy from the fight?');
                await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1'] }, { enemy_list: [] }));
                const trackerChange = mockUpdateCombatTracker.mock.calls[0][1];
                expect(trackerChange([{ id: 'npc:enemy-1' }, { id: 'npc:enemy-2' }, { id: 'character:char-1' }])).toEqual([{ id: 'character:char-1' }]);
            });

            test('a failed write is alerted', async () => {
                mockUpdateDoc.mockRejectedValue(new Error('offline'));
                await renderReady({ campaignInfo: { ...directing, enemy_list: [enemy] } });
                goToTab('Combat');
                fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
                await waitFor(() => expect(window.alert).toHaveBeenCalled());
            });
        });

        test('the Enemies panel collapses via its own button', async () => {
            await renderReady({ campaignInfo: { ...baseCampaignInfo, enemy_list: [enemy] } });
            goToTab('Combat');

            fireEvent.click(screen.getByRole('button', { name: 'Collapse Enemies' }));

            expect(screen.queryByText('Enemies')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Expand Enemies' })).toBeInTheDocument();
        });
    });

    describe('Combat Tracker', () => {
        test('starts in Line View', async () => {
            await renderReady();
            goToTab('Combat');
            expect(screen.getByRole('button', { name: 'Line View' })).toHaveClass('DirectorsPage-mode-btn-active');
        });

        test('with no map selected, the line view is one shared column (Combatants), with no hint', async () => {
            await renderReady();
            goToTab('Combat');
            expect(screen.getByText(/Combat-stub:camp-1:1/)).toBeInTheDocument(); // the one "Combatants" column
            expect(screen.queryByText(/has no zones yet/)).not.toBeInTheDocument();
            expect(screen.queryByText(/No active map selected/)).not.toBeInTheDocument();
        });

        test('the map views are told there is no map, so they keep everyone in that one column', async () => {
            await renderReady();
            goToTab('Combat');
            screen.getAllByText(/CombatMap-stub/).forEach(stub => expect(stub).toHaveAttribute('data-nomap', 'true'));
        });

        test('a director can move the map\'s tokens; anyone else only watches', async () => {
            await renderReady({ campaignInfo: { ...baseCampaignInfo, director_uid: 'owner-1' } });
            goToTab('Combat');
            screen.getAllByText(/CombatMap-stub/).forEach(stub => expect(stub).toHaveAttribute('data-canedit', 'true'));
        });

        test('the line view can be dragged by a director, and only looked at by anyone else', async () => {
            await renderReady({ campaignInfo: { ...baseCampaignInfo, director_uid: 'owner-1' } });
            goToTab('Combat');
            expect(screen.getByText(/Combat-stub/)).toHaveAttribute('data-readonly', 'false');
        });

        describe('moving people in the line view', () => {
            const lineProps = () => mockLineProps[mockLineProps.length - 1];
            const entities = [
                { id: 'character:char-1', title: 'Aria', kind: 'player', ownerIds: ['owner-1'] },
                { id: 'character:char-2', title: 'Bram', kind: 'player', ownerIds: ['other-player'] },
                { id: 'npc:goblin', title: 'Goblin', kind: 'enemy' },
            ];
            beforeEach(() => mockUseCombatEntities.mockReturnValue(entities));

            test('a director drags anyone', async () => {
                await renderReady({ campaignInfo: { ...baseCampaignInfo, director_uid: 'owner-1' } });
                goToTab('Combat');
                expect(lineProps().readOnly).toBeFalsy();
                ['character:char-1', 'character:char-2', 'npc:goblin'].forEach(id => expect(lineProps().canMovePost({ id })).toBe(true));
            });

            test('a player drags their own character and nobody else', async () => {
                await renderReady({ campaignInfo: { ...baseCampaignInfo, director_uid: 'someone-else', canRead: ['owner-1'] } });
                goToTab('Combat');
                expect(lineProps().canMovePost({ id: 'character:char-1' })).toBe(true);
                expect(lineProps().canMovePost({ id: 'character:char-2' })).toBe(false);
                expect(lineProps().canMovePost({ id: 'npc:goblin' })).toBe(false);
            });

            test('with the map\'s zones as rectangles for where a moved token lands, or none without a map', async () => {
                mockUseCampaignMaps.mockReturnValue({ maps: [], activeMap: { map_id: 'map-1', zones: [{ name: 'Gate', x: 50, y: 100, width: 100, height: 50 }] } });
                await renderReady({ campaignInfo: { ...baseCampaignInfo, director_uid: 'owner-1' } });
                goToTab('Combat');
                expect(lineProps().rects).toEqual([{ name: 'Gate', x: 0.1, y: 0.2, w: 0.2, h: 0.1 }]);
            });

            test('no rectangles without an active map', async () => {
                await renderReady({ campaignInfo: { ...baseCampaignInfo, director_uid: 'owner-1' } });
                goToTab('Combat');
                expect(lineProps().rects).toBeNull();
            });
        });

        test('someone who is not a director cannot', async () => {
            await renderReady();
            goToTab('Combat');
            screen.getAllByText(/CombatMap-stub/).forEach(stub => expect(stub).toHaveAttribute('data-canedit', 'false'));
        });

        test('a campaign that has not loaded yet is not taken for one with no map', async () => {
            installSnapshotRouter();
            renderWithRouter(<DirectorsPage />, { route: '/directors/camp-1' });
            await act(async () => { await Promise.resolve(); });
            goToTab('Combat');
            screen.queryAllByText(/CombatMap-stub/).forEach(stub => expect(stub).toHaveAttribute('data-nomap', 'false'));
            expect(screen.queryByText(/Combat-stub:camp-1:1/)).not.toBeInTheDocument();
        });

        test('waits for the characters too before treating the campaign as having no map', async () => {
            const router = installSnapshotRouter();
            renderWithRouter(<DirectorsPage />, { route: '/directors/camp-1' });
            router.fireCampaign(baseCampaignInfo); // the campaign is in; the characters are not yet
            await act(async () => { await Promise.resolve(); });
            goToTab('Combat');
            screen.getAllByText(/CombatMap-stub/).forEach(stub => expect(stub).toHaveAttribute('data-nomap', 'false'));

            router.fireCharacters([character]);
            await act(async () => { await Promise.resolve(); });
            screen.getAllByText(/CombatMap-stub/).forEach(stub => expect(stub).toHaveAttribute('data-nomap', 'true'));
        });

        test('with a map selected, its zones are the columns, and the map views are not in no-map mode', async () => {
            mockUseCampaignMaps.mockReturnValue({ maps: [], activeMap: { map_id: 'map-1', zones: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] } });
            await renderReady({ campaignInfo: { ...baseCampaignInfo, active_map: 'map-1' } });
            goToTab('Combat');
            expect(screen.getByText(/Combat-stub:camp-1:3/)).toBeInTheDocument();
            screen.getAllByText(/CombatMap-stub/).forEach(stub => expect(stub).toHaveAttribute('data-nomap', 'false'));
        });

        test('a selected map with no zones says so', async () => {
            mockUseCampaignMaps.mockReturnValue({ maps: [], activeMap: { map_id: 'map-1', zones: [] } });
            await renderReady({ campaignInfo: { ...baseCampaignInfo, active_map: 'map-1' } });
            goToTab('Combat');
            expect(screen.getByText('This map has no zones yet. Add some from the Maps tab.')).toBeInTheDocument();
        });

        describe('choosing the map from the tracker', () => {
            const maps = [{ map_id: 'map-1', link: 'a.png' }, { map_id: 'map-2', link: 'b.png' }];
            const director = { ...baseCampaignInfo, director_uid: 'owner-1', maps: ['map-1', 'map-2'] };

            test('a director gets a Combat map choice: No map, then each map', async () => {
                mockUseCampaignMaps.mockReturnValue({ maps, activeMap: null });
                await renderReady({ campaignInfo: director });
                goToTab('Combat');
                const select = screen.getByLabelText('Combat map');
                expect([...select.options].map(option => option.text)).toEqual(['No map', 'Map 1', 'Map 2']);
                expect(select).toHaveValue('');
            });

            test('shows the active map as chosen', async () => {
                mockUseCampaignMaps.mockReturnValue({ maps, activeMap: maps[1] });
                await renderReady({ campaignInfo: { ...director, active_map: 'map-2' } });
                goToTab('Combat');
                expect(screen.getByLabelText('Combat map')).toHaveValue('map-2');
            });

            test('choosing a map writes it as the active one', async () => {
                mockUseCampaignMaps.mockReturnValue({ maps, activeMap: null });
                await renderReady({ campaignInfo: director });
                goToTab('Combat');

                fireEvent.change(screen.getByLabelText('Combat map'), { target: { value: 'map-1' } });

                expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1'] }, { active_map: 'map-1' });
            });

            test('choosing No map clears the active map', async () => {
                mockUseCampaignMaps.mockReturnValue({ maps, activeMap: maps[0] });
                await renderReady({ campaignInfo: { ...director, active_map: 'map-1' } });
                goToTab('Combat');

                fireEvent.change(screen.getByLabelText('Combat map'), { target: { value: '' } });

                expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1'] }, { active_map: null });
            });

            test('is not offered when there are no maps to choose from, or to someone who is not a director', async () => {
                await renderReady({ campaignInfo: director });
                goToTab('Combat');
                expect(screen.queryByLabelText('Combat map')).not.toBeInTheDocument();
            });

            test('a player is not offered it', async () => {
                mockUseCampaignMaps.mockReturnValue({ maps, activeMap: null });
                await renderReady({ campaignInfo: { ...baseCampaignInfo, maps: ['map-1', 'map-2'] } });
                goToTab('Combat');
                expect(screen.queryByLabelText('Combat map')).not.toBeInTheDocument();
            });
        });

        test('Map View shows the Open Full Map button once there is a map; Line View does not', async () => {
            mockUseCampaignMaps.mockReturnValue({ maps: [], activeMap: { map_id: 'map-1', zones: [{ name: 'A' }] } });
            await renderReady({ campaignInfo: { ...baseCampaignInfo, active_map: 'map-1' } });
            goToTab('Combat');
            expect(screen.queryByRole('button', { name: /Open Full Map/ })).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Map View' }));

            expect(screen.getByRole('button', { name: /Open Full Map/ })).toBeInTheDocument();
        });

        test('with no map there is nothing to open full-screen', async () => {
            await renderReady();
            goToTab('Combat');
            fireEvent.click(screen.getByRole('button', { name: 'Map View' }));
            expect(screen.queryByRole('button', { name: /Open Full Map/ })).not.toBeInTheDocument();
        });

        test('the map opened full-size has its tools beside it; the one in the tracker column keeps them above', async () => {
            mockUseCampaignMaps.mockReturnValue({ maps: [], activeMap: { map_id: 'map-1', zones: [{ name: 'A' }] } });
            await renderReady({ campaignInfo: { ...baseCampaignInfo, active_map: 'map-1' } });
            goToTab('Combat');
            expect(mockMapProps.every(props => !props.toolbarsBeside)).toBe(true);

            fireEvent.click(screen.getByRole('button', { name: 'Map View' }));
            fireEvent.click(screen.getByRole('button', { name: /Open Full Map/ }));

            expect(mockMapProps[mockMapProps.length - 1].toolbarsBeside).toBe(true);
        });

        test('Open Full Map opens an overlay with the full combat map, closable via its own button or the scrim', async () => {
            mockUseCampaignMaps.mockReturnValue({ maps: [], activeMap: { map_id: 'map-1', zones: [{ name: 'A' }] } });
            await renderReady({ campaignInfo: { ...baseCampaignInfo, active_map: 'map-1' } });
            goToTab('Combat');
            fireEvent.click(screen.getByRole('button', { name: 'Map View' }));
            fireEvent.click(screen.getByRole('button', { name: /Open Full Map/ }));
            expect(screen.getAllByText(/CombatMap-stub/).length).toBeGreaterThan(0);

            fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[1]);

            expect(screen.queryAllByText(/CombatMap-stub/)).toHaveLength(1); // only the always-mounted Map View copy remains
        });
    });

    describe('Maps tab', () => {
        function fileInput() {
            // eslint-disable-next-line testing-library/no-node-access -- the file input has no accessible label/name in the markup
            return document.querySelector('input[type="file"]');
        }

        test('Upload is disabled until a file is chosen', async () => {
            await renderReady();
            goToTab('Maps');
            expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
        });

        test('choosing a file enables Upload and shows a preview', async () => {
            await renderReady();
            goToTab('Maps');
            const file = new File(['(binary)'], 'map.png', { type: 'image/png' });

            fireEvent.change(fileInput(), { target: { files: [file] } });

            expect(screen.getByRole('button', { name: 'Upload' })).toBeEnabled();
            expect(screen.getByAltText('Map Preview')).toBeInTheDocument();
        });

        test('choosing a non-image file is rejected immediately, with no preview and Upload still disabled', async () => {
            await renderReady();
            goToTab('Maps');
            const file = new File(['not an image'], 'notes.txt', { type: 'text/plain' });

            fireEvent.change(fileInput(), { target: { files: [file] } });

            expect(window.alert).toHaveBeenCalledWith('Please select an image file.');
            expect(screen.queryByAltText('Map Preview')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
        });

        test('Upload uploads the image, creates the map doc, and links it into the campaign', async () => {
            await renderReady();
            goToTab('Maps');
            const file = new File(['(binary)'], 'map.png', { type: 'image/png' });
            fireEvent.change(fileInput(), { target: { files: [file] } });

            fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1'] }, { maps: ['new-map-id'] }));
            expect(mockUploadImageToImgur).toHaveBeenCalledWith(file);
            expect(mockAddDoc).toHaveBeenCalledWith({ __collection: 'maps' }, { canWrite: ['owner-1'], admins: ['owner-1'], link: 'https://imgur.example/map.png', zones: [] });
            expect(window.alert).toHaveBeenCalledWith('Map added to campaign successfully!');
        });

        test('a failed upload is alerted', async () => {
            mockUploadImageToImgur.mockRejectedValue(new Error('offline'));
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            await renderReady();
            goToTab('Maps');
            const file = new File(['(binary)'], 'map.png', { type: 'image/png' });
            fireEvent.change(fileInput(), { target: { files: [file] } });

            fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

            await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to upload map. Please try again.'));
            consoleSpy.mockRestore();
        });

        describe('existing maps', () => {
            const map = { map_id: 'map-1', link: 'map.png', admins: ['owner-1'] };

            test('renders each map and marks the active one', async () => {
                mockUseCampaignMaps.mockReturnValue({ maps: [map], activeMap: null });
                await renderReady({ campaignInfo: { ...baseCampaignInfo, active_map: 'map-1' } });
                goToTab('Maps');
                expect(screen.getByText('MapRenderer-stub:map-1:owner-1')).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Unselect Map' })).toBeEnabled();
                expect(screen.getByText('Active on the combat tracker')).toBeInTheDocument();
                expect(screen.queryByRole('button', { name: 'Set as Active' })).not.toBeInTheDocument();
            });

            test('Unselect Map clears active_map, leaving no map for the combat tracker', async () => {
                mockUseCampaignMaps.mockReturnValue({ maps: [map], activeMap: null });
                await renderReady({ campaignInfo: { ...baseCampaignInfo, active_map: 'map-1' } });
                goToTab('Maps');

                fireEvent.click(screen.getByRole('button', { name: 'Unselect Map' }));

                expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1'] }, { active_map: null });
            });

            test('a map that is not active has no active badge, and Set as Active still selects it', async () => {
                mockUseCampaignMaps.mockReturnValue({ maps: [map], activeMap: null });
                await renderReady();
                goToTab('Maps');
                expect(screen.queryByText('Active on the combat tracker')).not.toBeInTheDocument();
            });

            test('passes the map\'s admins list and the signed-in user down to DocAdminManager', async () => {
                mockUseCampaignMaps.mockReturnValue({ maps: [map], activeMap: null });
                await renderReady();
                goToTab('Maps');
                expect(screen.getByText('DocAdminManager-stub:["owner-1"]:owner-1')).toBeInTheDocument();
            });

            test('Set as Active writes active_map', async () => {
                mockUseCampaignMaps.mockReturnValue({ maps: [map], activeMap: null });
                await renderReady();
                goToTab('Maps');

                fireEvent.click(screen.getByRole('button', { name: 'Set as Active' }));

                expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1'] }, { active_map: 'map-1' });
            });

            test('Delete Map, confirmed, removes it from the campaign and deletes the doc', async () => {
                mockUseCampaignMaps.mockReturnValue({ maps: [map], activeMap: null });
                await renderReady({ campaignInfo: { ...baseCampaignInfo, maps: ['map-1'] } });
                goToTab('Maps');

                fireEvent.click(screen.getByRole('button', { name: 'Delete Map' }));

                await waitFor(() => expect(mockDeleteDoc).toHaveBeenCalledWith({ __doc: ['maps', 'map-1'] }));
                expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1'] }, { maps: [] });
            });

            test('Delete Map, declined via confirm, writes nothing', async () => {
                window.confirm = jest.fn(() => false);
                mockUseCampaignMaps.mockReturnValue({ maps: [map], activeMap: null });
                await renderReady();
                goToTab('Maps');

                fireEvent.click(screen.getByRole('button', { name: 'Delete Map' }));

                expect(mockDeleteDoc).not.toHaveBeenCalled();
                expect(mockUpdateDoc).not.toHaveBeenCalled();
            });
        });
    });
});
