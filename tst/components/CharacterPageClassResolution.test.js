// Covers CharacterPage.js's class resolution specifically: a character pinned
// to a class version renders that class's live data, not the copy saved on
// its own doc. The real child panels are stubbed to print the class-derived
// values they receive.
jest.mock('../../src/utils/firebase', () => ({ auth: {}, db: {} }));

jest.mock('firebase/auth', () => ({ onAuthStateChanged: () => jest.fn() }));

const mockDoc = jest.fn();
const mockOnSnapshot = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    query: (...args) => ({ __query: args }),
    collection: (name) => ({ __collection: name }),
    where: (...args) => ({ __where: args }),
    onSnapshot: (...args) => mockOnSnapshot(...args),
}));

const mockResolveClassVersion = jest.fn();
jest.mock('../../src/utils/classVersions', () => ({
    resolveClassVersion: (...args) => mockResolveClassVersion(...args),
}));

jest.mock('../../src/utils/useIsMobile', () => ({ useIsMobile: () => false }));

jest.mock('../../src/components/CharacterPageVitalsPanel', () => ({ CharacterPageVitalsPanel: ({ characterPageLayoutLive }) => <div>Vitals-AC:{characterPageLayoutLive.base_armor_class}</div> }));
jest.mock('../../src/components/CharacterPageNavigation', () => ({ CharacterPageNavigation: ({ characterPage, classInfo }) => <div>Nav:{characterPage.class_name}:{classInfo.status}:{classInfo.latestVersion}</div> }));
jest.mock('../../src/components/SkillsAndFlaws', () => ({ SkillsAndFlaws: ({ characterPage }) => <div>Feats:{characterPage.actions.filter(a => a.category === 'feat').map(a => a.actionName).join(',')}</div> }));
jest.mock('../../src/components/CharacterMainTab', () => ({ CharacterMainTab: ({ characterPage }) => <div>Actions:{characterPage.actions.map(a => a.actionName).join(',')}</div> }));
jest.mock('../../src/components/DocAdminManager', () => ({ DocAdminManager: () => null }));

// eslint-disable-next-line import/first
import { screen, act, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { CharacterPage } from '../../src/components/CharacterPage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const raceFeat = { actionName: 'Mild Fire', category: 'feat' };
const savedCopy = {
    character_name: 'Kodi', skills_and_flaws: [], class_id: 'monk', class_name: 'Monk (saved)',
    base_armor_class: 10, actions: [{ actionName: 'Saved Action', category: 'action' }], race_feat: raceFeat,
};
const liveClass = {
    class_name: 'Monk', base_armor_class: 16,
    actions: [{ actionName: 'Fleetfoot', category: 'action' }, { actionName: 'Adaptability', category: 'feat' }],
};

function mount(characterData) {
    const callbacks = new Map();
    mockOnSnapshot.mockImplementation((target, second, third) => {
        callbacks.set(target, typeof second === 'function' ? second : third);
        return jest.fn();
    });
    renderWithRouter(<CharacterPage />, { route: '/characters/char-1' });
    const target = mockDoc.mock.results.find(r => r.value.__doc === 'characters/char-1').value;
    const fire = (data, hasPendingWrites = false) => act(() => callbacks.get(target)({ metadata: { hasPendingWrites }, data: () => data }));
    fire(characterData);
    return { fire };
}

beforeEach(() => {
    mockDoc.mockImplementation((_db, collectionName, id) => ({ __doc: `${collectionName}/${id}` }));
});

describe('CharacterPage class resolution', () => {
    test('a linked character renders its pinned class\'s live data, with the race feat kept', async () => {
        mockResolveClassVersion.mockResolvedValue({ data: liveClass, version: 2, latestVersion: 3 });

        mount({ ...savedCopy, class_version: 2 });

        expect(await screen.findByText('Actions:Fleetfoot,Adaptability,Mild Fire')).toBeInTheDocument();
        expect(screen.getByText('Vitals-AC:16')).toBeInTheDocument();
        expect(screen.getByText('Feats:Adaptability,Mild Fire')).toBeInTheDocument();
        expect(screen.getByText('Nav:Monk:ready:3')).toBeInTheDocument();
        expect(mockResolveClassVersion).toHaveBeenCalledWith('monk', 2);
    });

    test('until the class has loaded, the saved copy is shown rather than a blank sheet', () => {
        mockResolveClassVersion.mockReturnValue(new Promise(() => {}));

        mount({ ...savedCopy, class_version: 1 });

        expect(screen.getByText('Actions:Saved Action,Mild Fire')).toBeInTheDocument();
        expect(screen.getByText('Vitals-AC:10')).toBeInTheDocument();
    });

    test('a class that cannot be read leaves the saved copy in place and tells the navigation so', async () => {
        mockResolveClassVersion.mockRejectedValue(new Error('permission-denied'));

        mount({ ...savedCopy, class_version: 1 });

        await waitFor(() => expect(screen.getByText(/Nav:Monk \(saved\):fallback/)).toBeInTheDocument());
        expect(screen.getByText('Actions:Saved Action,Mild Fire')).toBeInTheDocument();
    });

    test('a legacy character with no pinned version never reads a class and renders as before', () => {
        const { race_feat, ...legacy } = savedCopy;

        mount(legacy);

        expect(mockResolveClassVersion).not.toHaveBeenCalled();
        expect(screen.getByText('Actions:Saved Action')).toBeInTheDocument();
        expect(screen.getByText('Vitals-AC:10')).toBeInTheDocument();
    });

    test('switching the pinned version (a local write) re-reads the class at the new version', async () => {
        mockResolveClassVersion.mockImplementation(async (_classId, version) => ({
            data: version === 1 ? { ...liveClass, actions: [{ actionName: 'Old Fleetfoot' }] } : liveClass,
            version, latestVersion: 2,
        }));
        const { fire } = mount({ ...savedCopy, class_version: 1 });
        expect(await screen.findByText('Actions:Old Fleetfoot,Mild Fire')).toBeInTheDocument();

        fire({ ...savedCopy, class_version: 2 }, true);

        expect(await screen.findByText('Actions:Fleetfoot,Adaptability,Mild Fire')).toBeInTheDocument();
        expect(mockResolveClassVersion).toHaveBeenLastCalledWith('monk', 2);
    });
});
