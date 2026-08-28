jest.mock('../../src/utils/firebase', () => ({ auth: {}, db: {} }));

const mockOnAuthStateChanged = jest.fn();
jest.mock('firebase/auth', () => ({
    onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
}));

const mockDoc = jest.fn();
const mockQuery = jest.fn();
const mockCollection = jest.fn();
const mockWhere = jest.fn();
const mockOnSnapshot = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    query: (...args) => mockQuery(...args),
    collection: (...args) => mockCollection(...args),
    where: (...args) => mockWhere(...args),
    onSnapshot: (...args) => mockOnSnapshot(...args),
}));

const mockUseIsMobile = jest.fn();
jest.mock('../../src/utils/useIsMobile', () => ({ useIsMobile: () => mockUseIsMobile() }));

jest.mock('../../src/components/CharacterPageVitalsPanel', () => ({ CharacterPageVitalsPanel: ({ characterPageLayoutLive, userId }) => <div>VitalsPanel-stub:{characterPageLayoutLive.character_name}:{userId}</div> }));
jest.mock('../../src/components/CharacterPageNavigation', () => ({ CharacterPageNavigation: ({ characterPage }) => <div>Navigation-stub:{characterPage.character_name}</div> }));
jest.mock('../../src/components/SkillsAndFlaws', () => ({ SkillsAndFlaws: () => <div>SkillsAndFlaws-stub</div> }));
jest.mock('../../src/components/CharacterMainTab', () => ({ CharacterMainTab: ({ characterList, campaignInfo }) => <div>MainTab-stub:{characterList.length}:{campaignInfo.enemy_list.length}</div> }));

// eslint-disable-next-line import/first
import { screen, fireEvent, act } from '@testing-library/react';
// eslint-disable-next-line import/first
import { CharacterPage } from '../../src/components/CharacterPage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

// Routes each onSnapshot(target, ...) call to a callback bucket keyed by the
// query-marker object's own identity, since docQuery/campaignDocQuery/
// charactersQuery all funnel through the same mocked onSnapshot function.
function installSnapshotRouter() {
    const callbacksByTarget = new Map();
    mockOnSnapshot.mockImplementation((target, second, third) => {
        const callback = typeof second === 'function' ? second : third;
        callbacksByTarget.set(target, callback);
        return jest.fn();
    });
    return {
        fire: (target, snapshot) => act(() => callbacksByTarget.get(target)(snapshot)),
        has: (target) => callbacksByTarget.has(target),
    };
}

function characterDoc(data) {
    return { metadata: { hasPendingWrites: false }, data: () => data };
}

beforeEach(() => {
    mockDoc.mockImplementation((_db, collectionName, id) => ({ __doc: `${collectionName}/${id}` }));
    mockCollection.mockImplementation((_db, name) => ({ __collection: name }));
    mockQuery.mockImplementation((...args) => ({ __query: args }));
    mockWhere.mockImplementation((...args) => ({ __where: args }));
    mockOnAuthStateChanged.mockImplementation(() => jest.fn());
    mockUseIsMobile.mockReturnValue(false);
});

describe('CharacterPage', () => {
    test('shows the loading icon until the character document\'s first snapshot arrives', () => {
        installSnapshotRouter();
        renderWithRouter(<CharacterPage />, { route: '/characters/char-1' });
        expect(screen.getByAltText('loading')).toBeInTheDocument();
    });

    test('subscribes to the character doc identified by the URL\'s 3rd path segment', () => {
        installSnapshotRouter();
        renderWithRouter(<CharacterPage />, { route: '/characters/char-1' });
        expect(mockDoc).toHaveBeenCalledWith({}, 'characters', 'char-1');
    });

    test('once the first snapshot arrives, renders the page and sets the document title to the character name', () => {
        const router = installSnapshotRouter();
        renderWithRouter(<CharacterPage />, { route: '/characters/char-1' });
        const target = mockDoc.mock.results.find(r => r.value.__doc === 'characters/char-1').value;

        router.fire(target, characterDoc({ character_name: 'Aria', skills_and_flaws: [] }));

        expect(screen.queryByAltText('loading')).not.toBeInTheDocument();
        expect(document.title).toBe('Aria');
        expect(screen.getByText('Navigation-stub:Aria')).toBeInTheDocument();
    });

    describe('skills & flaws count', () => {
        test('splits skills_and_flaws into skill vs flaw counts for the mobile summary button', () => {
            mockUseIsMobile.mockReturnValue(true);
            const router = installSnapshotRouter();
            renderWithRouter(<CharacterPage />, { route: '/characters/char-1' });
            const target = mockDoc.mock.results[0].value;

            router.fire(target, characterDoc({
                character_name: 'Aria',
                skills_and_flaws: [{ isSkill: true }, { isSkill: true }, { isSkill: false }],
            }));

            expect(screen.getByText('Skills & Flaws · 2 · 1')).toBeInTheDocument();
        });
    });

    describe('mobile vs desktop skills panel', () => {
        function renderReady(overrides = {}) {
            const router = installSnapshotRouter();
            renderWithRouter(<CharacterPage />, { route: '/characters/char-1' });
            const target = mockDoc.mock.results[0].value;
            router.fire(target, characterDoc({ character_name: 'Aria', skills_and_flaws: [], ...overrides }));
        }

        test('desktop shows SkillsAndFlaws directly in the sidebar, no summary button', () => {
            mockUseIsMobile.mockReturnValue(false);
            renderReady();
            expect(screen.getByText('SkillsAndFlaws-stub')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /Skills & Flaws/ })).not.toBeInTheDocument();
        });

        test('mobile shows the summary button instead, and opens a drawer with SkillsAndFlaws when clicked', () => {
            mockUseIsMobile.mockReturnValue(true);
            renderReady();
            expect(screen.queryByText('SkillsAndFlaws-stub')).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: /Skills & Flaws/ }));

            expect(screen.getByText('SkillsAndFlaws-stub')).toBeInTheDocument();
        });

        test('the drawer closes via its own × button', () => {
            mockUseIsMobile.mockReturnValue(true);
            renderReady();
            fireEvent.click(screen.getByRole('button', { name: /Skills & Flaws/ }));

            fireEvent.click(screen.getByRole('button', { name: '×' }));

            expect(screen.queryByText('SkillsAndFlaws-stub')).not.toBeInTheDocument();
        });

        test('the drawer closes via clicking the scrim', () => {
            mockUseIsMobile.mockReturnValue(true);
            renderReady();
            fireEvent.click(screen.getByRole('button', { name: /Skills & Flaws/ }));

            fireEvent.click(screen.getByRole('button', { name: 'Close' }));

            expect(screen.queryByText('SkillsAndFlaws-stub')).not.toBeInTheDocument();
        });
    });

    describe('campaign data', () => {
        test('a character with no campaign never subscribes to a campaign doc or the campaign roster', () => {
            const router = installSnapshotRouter();
            renderWithRouter(<CharacterPage />, { route: '/characters/char-1' });
            const target = mockDoc.mock.results[0].value;

            router.fire(target, characterDoc({ character_name: 'Aria', skills_and_flaws: [], campaign: null }));

            expect(mockDoc).not.toHaveBeenCalledWith({}, 'campaigns', expect.anything());
        });

        test('once the character doc reports a campaign, subscribes to that campaign doc and its character roster', () => {
            const router = installSnapshotRouter();
            renderWithRouter(<CharacterPage />, { route: '/characters/char-1' });
            const charTarget = mockDoc.mock.results[0].value;

            router.fire(charTarget, characterDoc({ character_name: 'Aria', skills_and_flaws: [], campaign: 'camp-1' }));

            expect(mockDoc).toHaveBeenCalledWith({}, 'campaigns', 'camp-1');
            expect(mockWhere).toHaveBeenCalledWith('campaign', '==', 'camp-1');
        });

        test('campaign info and the character roster flow down to CharacterMainTab once their snapshots arrive', () => {
            const router = installSnapshotRouter();
            renderWithRouter(<CharacterPage />, { route: '/characters/char-1' });
            const charTarget = mockDoc.mock.results[0].value;
            router.fire(charTarget, characterDoc({ character_name: 'Aria', skills_and_flaws: [], campaign: 'camp-1' }));

            const campaignTarget = mockDoc.mock.results.find(r => r.value.__doc === 'campaigns/camp-1').value;
            router.fire(campaignTarget, { metadata: { hasPendingWrites: false }, data: () => ({ enemy_list: [{ id: 'e1' }], ally_combat_npc_list: [], neutral_combat_npc_list: [], active_map: null, maps: [] }) });

            const charactersTarget = mockQuery.mock.results[0].value;
            router.fire(charactersTarget, { metadata: { hasPendingWrites: false }, docs: [{ id: 'char-2', data: () => ({ character_name: 'Finn' }) }] });

            expect(screen.getByText('MainTab-stub:1:1')).toBeInTheDocument(); // 1 character in roster, 1 enemy
        });
    });

    test('passes the signed-in user down to child panels once auth resolves', async () => {
        // Deferred like real Firebase (never fires onAuthStateChanged
        // synchronously) - CharacterPage.js's effect calls unsubscribe()
        // from inside this callback, referencing the const the
        // onAuthStateChanged(...) call itself hasn't finished assigning yet
        // if invoked synchronously, which would hit a TDZ crash that could
        // never happen for real.
        mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
            Promise.resolve().then(() => act(() => callback({ uid: 'user-1' })));
            return jest.fn();
        });
        const router = installSnapshotRouter();
        renderWithRouter(<CharacterPage />, { route: '/characters/char-1' });
        const target = mockDoc.mock.results[0].value;
        await act(async () => { await Promise.resolve(); });

        router.fire(target, characterDoc({ character_name: 'Aria', skills_and_flaws: [] }));

        expect(screen.getByText('VitalsPanel-stub:Aria:user-1')).toBeInTheDocument();
    });
});
