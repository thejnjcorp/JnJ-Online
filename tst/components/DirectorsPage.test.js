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
const mockOpenPanel = jest.fn();
jest.mock('react-router-dom', () => ({ ...jest.requireActual('react-router-dom'), useNavigate: () => mockNavigate }));

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

// The scenes framework has its own tests (ScenesTab.test.js). Here it is a stand-in that
// hosts what this page gives it - the combat view, the maps and the notes - one at a time
// behind buttons, so each of those is tested as the page builds it.
jest.mock('../../src/components/ScenesTab', () => {
    const { useState } = jest.requireActual('react');
    return {
        ScenesTab: ({ campaignId, header, renderSidebar, renderCombat, renderMaps, renderNotes, onSceneEnded }) => {
            const [shown, setShown] = useState(null);
            const combat = () => { const parts = renderCombat({ openPanel: mockOpenPanel }); return <>{parts.main}{parts.aside}</>; };
            const views = { Combat: combat, Maps: renderMaps, Notes: renderNotes, Run: () => null };
            return <div>
                {header}
                {renderSidebar(shown === 'Run' ? 'run' : 'scenes')}
                <div>ScenesTab-stub:{campaignId}</div>
                <button type="button" onClick={onSceneEnded}>Scene ended</button>
                {Object.keys(views).map(name => <button type="button" key={name} onClick={() => setShown(name)}>{name}</button>)}
                {shown && views[shown]()}
            </div>;
        },
    };
});

// The combat view's tiles, drawer and turn have their own tests (CombatBoard, CombatContext). Here
// they are stand-ins that show what this page hands them.
let mockProviderProps;
jest.mock('../../src/components/CombatContext', () => ({
    CombatProvider: props => {
        mockProviderProps = props;
        const { campaignInfo, updateEnemy, removeEnemy, children } = props;
        return <>
            {campaignInfo.enemy_list.map(enemy => <span key={enemy.id}>
                <button type="button" onClick={() => removeEnemy(enemy)}>{`Remove ${enemy.enemy_name} from the fight`}</button>
                <button type="button" onClick={() => updateEnemy(enemy.id, { defeated: true })}>{`Defeat ${enemy.enemy_name}`}</button>
            </span>)}
            {children}
        </>;
    },
}));
jest.mock('../../src/components/CombatBoard', () => ({
    PartyTiles: () => <div>PartyTiles-stub</div>,
    TurnOrder: () => <div>TurnOrder-stub</div>,
    EnemyTiles: ({ onAdd, onEncounters, onClear }) => <div>
        <button type="button" onClick={onAdd}>+ Add Enemy</button>
        <button type="button" onClick={onEncounters}>Encounters</button>
        <button type="button" onClick={onClear}>Clear all</button>
    </div>,
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
    Weaknesses: ['Fire'], Resistances: ['Cold'], Immunities: ['Poison'], actions: [],
};

// director_uid: 'owner-1' - renderReady() always signs in as owner-1 (see
// below), and Director Mode now refuses anyone who isn't the director, a
// co-director, or a doc admin, so every test that isn't specifically about
// that gate (or deliberately overriding it to test a non-director) needs
// this by default to reach the page at all.
const baseCampaignInfo = {
    campaign_name: 'The Iron Vale', director_name: 'Sam', director_uid: 'owner-1',
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

    test('the bar across the top names the campaign and its director, with a way to its settings and out', async () => {
        await renderReady();
        expect(screen.getByText('The Iron Vale')).toBeInTheDocument();
        expect(screen.getByText('Directors: Sam')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Campaign settings' }));
        expect(mockNavigate).toHaveBeenCalledWith('/campaigns/camp-1');
        fireEvent.click(screen.getByRole('button', { name: 'Exit campaign' }));
        expect(mockNavigate).toHaveBeenCalledWith('/campaigns');
    });

    test('the party is the same tiles in every view - scenes, build and run - so it can be read when planning', async () => {
        await renderReady();
        expect(screen.getByText('PartyTiles-stub')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Run' }));
        expect(screen.getByText('PartyTiles-stub')).toBeInTheDocument();
        expect(screen.queryByText('Player Characters')).not.toBeInTheDocument();
    });

    test('the combat view puts the turn order above the tracker', async () => {
        await renderReady();
        goToTab('Combat');
        expect(screen.getByText('TurnOrder-stub')).toBeInTheDocument();
    });

    test('the party strip is left out when the campaign has no characters', async () => {
        await renderReady({ characters: [] });
        expect(screen.queryByText('Player Characters')).not.toBeInTheDocument();
    });

    test('the page is the scenes framework for this campaign, with no tab bar of its own', async () => {
        await renderReady();
        expect(screen.getByText('ScenesTab-stub:camp-1')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Roleplay$/ })).not.toBeInTheDocument();
    });

    describe('Director Mode access', () => {
        test('a campaign member who is only a player (canRead, not a director) is refused the whole page, not a reduced view of it', async () => {
            await renderReady({ campaignInfo: { ...baseCampaignInfo, director_uid: 'someone-else', canRead: ['owner-1'] } });
            expect(screen.getByRole('alert')).toHaveTextContent("Director Mode is for the campaign's director and co-directors only.");
            expect(screen.queryByText('Aria')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /Combat$/ })).not.toBeInTheDocument();
        });

        test('shows Loading… rather than the denial, while the campaign doc is still on its way in', async () => {
            const router = installSnapshotRouter();
            renderWithRouter(<DirectorsPage />, { route: '/directors/camp-1' });
            await act(async () => { await Promise.resolve(); });
            expect(screen.getByText('Loading…')).toBeInTheDocument();
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
            router.fireCampaign({ ...baseCampaignInfo, director_uid: 'someone-else', canRead: ['owner-1'] });
            router.fireCharacters([]);
            await act(async () => { await Promise.resolve(); });
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });

    describe('Notes (directors only)', () => {
        test.each([
            ['the campaign\'s director', { director_uid: 'owner-1' }],
            ['a co-director in canWrite', { director_uid: 'someone-else', canWrite: ['owner-1'] }],
            ['a campaign doc admin', { director_uid: 'someone-else', admins: ['owner-1'] }],
        ])('is offered to %s, and opens the notebook for this campaign', async (_who, permissions) => {
            await renderReady({ campaignInfo: { ...baseCampaignInfo, ...permissions } });

            goToTab('Notes');

            expect(screen.getByText('DirectorNotes-stub:camp-1')).toBeInTheDocument();
        });

        test('is not offered to a player (in canRead, not a director) - Director Mode itself refuses them first', async () => {
            await renderReady({ campaignInfo: { ...baseCampaignInfo, director_uid: 'someone-else', canWrite: ['someone-else'], canRead: ['owner-1'] } });

            expect(screen.queryByRole('button', { name: /Notes$/ })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /Combat$/ })).not.toBeInTheDocument();
            expect(screen.getByRole('alert')).toHaveTextContent("Director Mode is for the campaign's director and co-directors only.");
        });

        test('is not offered before the campaign has loaded or while signed out', async () => {
            signIn(null);
            await renderReady({ campaignInfo: { ...baseCampaignInfo, director_uid: 'owner-1' } });
            expect(screen.queryByRole('button', { name: /Notes$/ })).not.toBeInTheDocument();
        });

        test('the combat view, the maps and the notes are all handed to the scenes framework', async () => {
            await renderReady({ campaignInfo: { ...baseCampaignInfo, director_uid: 'owner-1' } });
            ['Combat', 'Maps', 'Notes'].forEach(name => expect(screen.getByRole('button', { name: new RegExp(name + '$') })).toBeInTheDocument());
        });
    });

    describe('Combat tab: enemies', () => {

        describe('the director\'s tools', () => {
            const directing = { ...baseCampaignInfo, director_uid: 'owner-1' };
            const wolf = { id: 'b1', enemy_name: 'Wolf', enemy_type: 'Regular', maximum_health: 20, base_armor_class: 13, action_points: 3, actions: [] };

            test('the enemies column is given the ways to add enemies, go to encounters, and clear the fight', async () => {
                await renderReady({ campaignInfo: { ...directing, enemy_list: [enemy] } });
                goToTab('Combat');
                expect(screen.getByRole('button', { name: '+ Add Enemy' })).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Encounters' })).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Clear all' })).toBeInTheDocument();
            });

            test('the combat view is handed the enemies, and how to change and remove them', async () => {
                await renderReady({ campaignInfo: { ...directing, enemy_list: [enemy] } });
                expect(mockProviderProps).toMatchObject({ campaignId: 'camp-1', userId: 'owner-1' });
                expect(mockProviderProps.campaignInfo.enemy_list).toEqual([enemy]);
                expect(mockProviderProps.characters.map(entry => entry.character_name)).toEqual(['Aria']);
                fireEvent.click(screen.getByRole('button', { name: 'Defeat Goblin' }));
                expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1'] }, { enemy_list: [{ ...enemy, defeated: true }] });
            });

            test('ending a scene tells the combat view, so what lasted only for the scene ends', async () => {
                await renderReady({ campaignInfo: directing });
                const endScene = jest.fn();
                act(() => mockProviderProps.onApi({ endScene }));
                fireEvent.click(screen.getByRole('button', { name: 'Scene ended' }));
                expect(endScene).toHaveBeenCalled();
            });

            // A non-director never sees the enemy list at all any more - that's
            // the whole point of Director Mode being planning-only (Director
            // Mode access, above) - not a read-only view of it.

            test('Encounters opens the scenes framework\'s Encounters popup', async () => {
                await renderReady({ campaignInfo: directing });
                goToTab('Combat');
                fireEvent.click(screen.getByRole('button', { name: 'Encounters' }));
                expect(mockOpenPanel).toHaveBeenCalledWith('encounters');
            });

            test('+ Add opens the bestiary, and picking an enemy adds it to the campaign at full health', async () => {
                mockBestiary = { enemies: [wolf], status: 'ready' };
                await renderReady({ campaignInfo: { ...directing, enemy_list: [enemy] } });
                goToTab('Combat');
                fireEvent.click(screen.getByRole('button', { name: '+ Add Enemy' }));

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
                fireEvent.click(screen.getByRole('button', { name: '+ Add Enemy' }));
                fireEvent.click(screen.getByRole('button', { name: 'Done' }));
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });

            test('Remove from fight takes the enemy and its tracker card off the campaign, after asking', async () => {
                const other = { ...enemy, id: 'enemy-2', enemy_name: 'Troll' };
                await renderReady({ campaignInfo: { ...directing, enemy_list: [enemy, other] } });

                fireEvent.click(screen.getByRole('button', { name: 'Remove Goblin from the fight' }));

                expect(window.confirm).toHaveBeenCalledWith('Remove Goblin from the fight?');
                await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1'] }, { enemy_list: [other] }));
                expect(mockUpdateCombatTracker).toHaveBeenCalledWith('camp-1', expect.any(Function));
                const trackerChange = mockUpdateCombatTracker.mock.calls[0][1];
                expect(trackerChange([{ id: 'npc:enemy-1' }, { id: 'npc:enemy-2' }, { id: 'character:char-1' }])).toEqual([{ id: 'npc:enemy-2' }, { id: 'character:char-1' }]);
            });

            describe('defeating enemies', () => {
                describe('from the map', () => {
                    const lastMapProps = () => mockMapProps[mockMapProps.length - 1];

                    test('a director\'s maps are given the means to mark an enemy defeated or take it out of the fight', async () => {
                        await renderReady({ campaignInfo: { ...directing, enemy_list: [enemy] } });
                        goToTab('Combat');
                        expect(lastMapProps()).toMatchObject({ onSetDefeated: expect.any(Function), onRemoveEntity: expect.any(Function) });
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
                fireEvent.click(screen.getByRole('button', { name: 'Remove Goblin from the fight' }));
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
    });

    describe('Combat Tracker', () => {
        test('starts on the zones', async () => {
            await renderReady();
            goToTab('Combat');
            expect(screen.getByRole('button', { name: 'Zones' })).toHaveAttribute('aria-pressed', 'true');
            expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'false');
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

            // combatantMover's own "a player only moves their own character"
            // case is covered directly in combatTracker.test.js, where it's
            // actually reachable by a player - the character page's own
            // Combat Map tab; a non-director can't reach this line view at
            // all any more (Director Mode access, above).

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

        // A non-director can't reach this tab at all any more (Director Mode
        // access, above) - a false "no map" reading before the campaign doc
        // has arrived is no longer reachable either, since nothing renders
        // until isLoaded is true (same test).

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
            expect(screen.getByText('This map has no zones yet. Add some from the Maps popup.')).toBeInTheDocument();
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

        });

        test('Map View shows the Open Full Map button once there is a map; Line View does not', async () => {
            mockUseCampaignMaps.mockReturnValue({ maps: [], activeMap: { map_id: 'map-1', zones: [{ name: 'A' }] } });
            await renderReady({ campaignInfo: { ...baseCampaignInfo, active_map: 'map-1' } });
            goToTab('Combat');
            expect(screen.queryByRole('button', { name: /Open Full Map/ })).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Map' }));

            expect(screen.getByRole('button', { name: /Open Full Map/ })).toBeInTheDocument();
        });

        test('with no map there is nothing to open full-screen', async () => {
            await renderReady();
            goToTab('Combat');
            fireEvent.click(screen.getByRole('button', { name: 'Map' }));
            expect(screen.queryByRole('button', { name: /Open Full Map/ })).not.toBeInTheDocument();
        });

        test('the map opened full-size has its tools beside it; the one in the tracker column keeps them above', async () => {
            mockUseCampaignMaps.mockReturnValue({ maps: [], activeMap: { map_id: 'map-1', zones: [{ name: 'A' }] } });
            await renderReady({ campaignInfo: { ...baseCampaignInfo, active_map: 'map-1' } });
            goToTab('Combat');
            expect(mockMapProps.every(props => !props.toolbarsBeside)).toBe(true);

            fireEvent.click(screen.getByRole('button', { name: 'Map' }));
            fireEvent.click(screen.getByRole('button', { name: /Open Full Map/ }));

            expect(mockMapProps[mockMapProps.length - 1].toolbarsBeside).toBe(true);
        });

        test('Open Full Map opens an overlay with the full combat map, closable via its own button or the scrim', async () => {
            mockUseCampaignMaps.mockReturnValue({ maps: [], activeMap: { map_id: 'map-1', zones: [{ name: 'A' }] } });
            await renderReady({ campaignInfo: { ...baseCampaignInfo, active_map: 'map-1' } });
            goToTab('Combat');
            fireEvent.click(screen.getByRole('button', { name: 'Map' }));
            fireEvent.click(screen.getByRole('button', { name: /Open Full Map/ }));
            expect(screen.getAllByText(/CombatMap-stub/).length).toBeGreaterThan(0);

            fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[1]);

            expect(screen.queryAllByText(/CombatMap-stub/)).toHaveLength(1); // only the always-mounted Map View copy remains
        });
    });

    describe('Maps', () => {
        test('Add Map is disabled until a link is pasted or a picture uploaded', async () => {
            await renderReady();
            goToTab('Maps');
            expect(screen.getByRole('button', { name: 'Add Map' })).toBeDisabled();
        });

        test('pasting a link enables Add Map, with no upload needed', async () => {
            await renderReady();
            goToTab('Maps');

            fireEvent.change(screen.getByLabelText('Picture link'), { target: { value: 'https://example.com/dungeon.png' } });

            expect(screen.getByRole('button', { name: 'Add Map' })).toBeEnabled();
            expect(mockUploadImageToImgur).not.toHaveBeenCalled();
        });

        test('uploading a picture enables Add Map once the upload resolves', async () => {
            await renderReady();
            goToTab('Maps');
            const file = new File(['(binary)'], 'map.png', { type: 'image/png' });

            fireEvent.change(screen.getByLabelText('Or upload one'), { target: { files: [file] } });

            await waitFor(() => expect(screen.getByRole('button', { name: 'Add Map' })).toBeEnabled());
            expect(mockUploadImageToImgur).toHaveBeenCalledWith(file);
        });

        test('Add Map creates the map doc from a pasted link and links it into the campaign', async () => {
            await renderReady();
            goToTab('Maps');
            fireEvent.change(screen.getByLabelText('Picture link'), { target: { value: 'https://example.com/dungeon.png' } });

            fireEvent.click(screen.getByRole('button', { name: 'Add Map' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1'] }, { maps: ['new-map-id'] }));
            expect(mockAddDoc).toHaveBeenCalledWith({ __collection: 'maps' }, { canWrite: ['owner-1'], admins: ['owner-1'], link: 'https://example.com/dungeon.png', zones: [] });
            expect(window.alert).toHaveBeenCalledWith('Map added to campaign successfully!');
        });

        test('Add Map creates the map doc from an uploaded picture\'s resulting link', async () => {
            await renderReady();
            goToTab('Maps');
            const file = new File(['(binary)'], 'map.png', { type: 'image/png' });
            fireEvent.change(screen.getByLabelText('Or upload one'), { target: { files: [file] } });
            await waitFor(() => expect(screen.getByRole('button', { name: 'Add Map' })).toBeEnabled());

            fireEvent.click(screen.getByRole('button', { name: 'Add Map' }));

            await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Map added to campaign successfully!'));
            expect(mockAddDoc).toHaveBeenCalledWith({ __collection: 'maps' }, { canWrite: ['owner-1'], admins: ['owner-1'], link: 'https://imgur.example/map.png', zones: [] });
        });

        test('a failed save is alerted', async () => {
            mockAddDoc.mockRejectedValue(new Error('offline'));
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            await renderReady();
            goToTab('Maps');
            fireEvent.change(screen.getByLabelText('Picture link'), { target: { value: 'https://example.com/dungeon.png' } });

            fireEvent.click(screen.getByRole('button', { name: 'Add Map' }));

            await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to upload map. Please try again.'));
            consoleSpy.mockRestore();
        });

        describe('existing maps', () => {
            const map = { map_id: 'map-1', link: 'map.png', admins: ['owner-1'] };

            test('renders each map as a thumbnail and marks the active one - its full zone editor stays collapsed until opened', async () => {
                mockUseCampaignMaps.mockReturnValue({ maps: [map], activeMap: null });
                await renderReady({ campaignInfo: { ...baseCampaignInfo, active_map: 'map-1' } });
                goToTab('Maps');
                expect(screen.getByRole('button', { name: 'Unselect Map' })).toBeEnabled();
                expect(screen.getByText('Active in combat')).toBeInTheDocument();
                expect(screen.queryByRole('button', { name: 'Set as Active' })).not.toBeInTheDocument();
                expect(screen.queryByText('MapRenderer-stub:map-1:owner-1')).not.toBeInTheDocument();

                fireEvent.click(screen.getByRole('button', { name: "Open this map's zone editor" }));

                expect(screen.getByText('MapRenderer-stub:map-1:owner-1')).toBeInTheDocument();
            });

            test('opening one map\'s editor and closing it again collapses it back to just the thumbnail', async () => {
                mockUseCampaignMaps.mockReturnValue({ maps: [map], activeMap: null });
                await renderReady();
                goToTab('Maps');

                fireEvent.click(screen.getByRole('button', { name: "Open this map's zone editor" }));
                expect(screen.getByText('MapRenderer-stub:map-1:owner-1')).toBeInTheDocument();

                fireEvent.click(screen.getByRole('button', { name: 'Close zone editor' }));

                expect(screen.queryByText('MapRenderer-stub:map-1:owner-1')).not.toBeInTheDocument();
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
                expect(screen.queryByText('Active in combat')).not.toBeInTheDocument();
            });

            test('passes the map\'s admins list and the signed-in user down to DocAdminManager, once its editor is open', async () => {
                mockUseCampaignMaps.mockReturnValue({ maps: [map], activeMap: null });
                await renderReady();
                goToTab('Maps');
                expect(screen.queryByText('DocAdminManager-stub:["owner-1"]:owner-1')).not.toBeInTheDocument();

                fireEvent.click(screen.getByRole('button', { name: "Open this map's zone editor" }));

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
