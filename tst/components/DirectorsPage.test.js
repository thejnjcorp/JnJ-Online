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
    </div>,
}));
jest.mock('../../src/components/MapRenderer', () => ({
    MapRenderer: ({ map, userId }) => <div>MapRenderer-stub:{map.map_id}:{userId}</div>,
}));
jest.mock('../../src/utils/DraggableElements/PostListCombat.tsx', () => ({
    PostListContentCombat: ({ campaignId, inputStatuses }) => <div>Combat-stub:{campaignId}:{inputStatuses.length}</div>,
}));
jest.mock('../../src/utils/DraggableElements/PostListCombatMap.tsx', () => ({
    PostListContentCombatMap: ({ campaignId, activeMap, entities }) => <div>CombatMap-stub:{campaignId}:{activeMap?.map_id}:{entities.length}</div>,
}));

// eslint-disable-next-line import/first
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
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
    combat_tracker: [], active_map: null, maps: [],
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
    mockCollection.mockImplementation((_db, name) => ({ __collection: name }));
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockQuery.mockImplementation((...args) => ({ __query: args }));
    mockWhere.mockImplementation((...args) => ({ __where: args }));
    mockOnSnapshot.mockImplementation(() => jest.fn());
    mockOnAuthStateChanged.mockImplementation(() => jest.fn());
    mockUpdateDoc.mockResolvedValue(undefined);
    mockAddDoc.mockResolvedValue({ id: 'new-map-id' });
    mockDeleteDoc.mockResolvedValue(undefined);
    mockUploadImageToImgur.mockResolvedValue('https://imgur.example/map.png');
    mockUseCampaignMaps.mockReturnValue({ maps: [], activeMap: null });
    mockUseCombatEntities.mockReturnValue([]);
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

    describe('Combat tab: player characters', () => {
        test('shows the character name, HP, and AC', async () => {
            await renderReady();
            goToTab('Combat');
            expect(screen.getByText('Aria', { selector: '.DirectorsPage-entity-name' })).toBeInTheDocument();
            expect(screen.getByText('20/25 HP')).toBeInTheDocument();
            expect(screen.getByText('12')).toBeInTheDocument(); // AC
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

        test('the Enemies panel collapses via its own button', async () => {
            await renderReady({ campaignInfo: { ...baseCampaignInfo, enemy_list: [enemy] } });
            goToTab('Combat');

            fireEvent.click(screen.getByRole('button', { name: 'Collapse Enemies' }));

            expect(screen.queryByText('Enemies')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Expand Enemies' })).toBeInTheDocument();
        });
    });

    describe('Combat Tracker', () => {
        test('starts in Line View, showing the empty-map hint when there is no active map', async () => {
            await renderReady();
            goToTab('Combat');
            expect(screen.getByRole('button', { name: 'Line View' })).toHaveClass('DirectorsPage-mode-btn-active');
            expect(screen.getByText('No active map selected. Set one from the Maps tab.')).toBeInTheDocument();
        });

        test('Map View shows the Open Full Map button; Line View does not', async () => {
            await renderReady();
            goToTab('Combat');
            expect(screen.queryByRole('button', { name: /Open Full Map/ })).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Map View' }));

            expect(screen.getByRole('button', { name: /Open Full Map/ })).toBeInTheDocument();
        });

        test('Open Full Map opens an overlay with the full combat map, closable via its own button or the scrim', async () => {
            await renderReady();
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

        test('Upload uploads the image, creates the map doc, and links it into the campaign', async () => {
            await renderReady();
            goToTab('Maps');
            const file = new File(['(binary)'], 'map.png', { type: 'image/png' });
            fireEvent.change(fileInput(), { target: { files: [file] } });

            fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1'] }, { maps: ['new-map-id'] }));
            expect(mockUploadImageToImgur).toHaveBeenCalledWith(file);
            expect(mockAddDoc).toHaveBeenCalledWith({ __collection: 'maps' }, { canWrite: ['owner-1'], link: 'https://imgur.example/map.png', zones: [] });
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
            const map = { map_id: 'map-1', link: 'map.png' };

            test('renders each map and marks the active one', async () => {
                mockUseCampaignMaps.mockReturnValue({ maps: [map], activeMap: null });
                await renderReady({ campaignInfo: { ...baseCampaignInfo, active_map: 'map-1' } });
                goToTab('Maps');
                expect(screen.getByText('MapRenderer-stub:map-1:owner-1')).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Active Map' })).toBeDisabled();
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
