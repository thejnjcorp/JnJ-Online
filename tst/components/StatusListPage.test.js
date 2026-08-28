jest.mock('../../src/utils/firebase', () => ({ auth: {}, db: {} }));

const mockOnAuthStateChanged = jest.fn();
jest.mock('firebase/auth', () => ({
    onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
}));

const mockCollection = jest.fn();
const mockGetDocs = jest.fn();
const mockOr = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
jest.mock('firebase/firestore', () => ({
    collection: (...args) => mockCollection(...args),
    getDocs: (...args) => mockGetDocs(...args),
    or: (...args) => mockOr(...args),
    query: (...args) => mockQuery(...args),
    where: (...args) => mockWhere(...args),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

// eslint-disable-next-line import/first
import { screen, fireEvent, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { StatusListPage } from '../../src/components/StatusListPage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const blessed = { id: 'status-blessed', name: 'Blessed', polarity: 'buff', isDefault: true, effects: [{ stat: 'base_hit_modifier', delta: 2 }] };
const poisoned = { id: 'status-poisoned', name: 'Poisoned', polarity: 'debuff', public: true, effects: [{ stat: 'hardness', delta: -1 }], classes: ['Fighter', 'Rogue'], description: 'Ongoing damage.' };
const dazed = { id: 'status-dazed', name: 'Dazed', polarity: 'neutral', campaignId: 'camp-1', canWrite: ['user-1'] };

function docsFrom(items) {
    return { docs: items.map(item => ({ id: item.id, data: () => item })) };
}

function signIn(user, statuses = []) {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        Promise.resolve().then(() => callback(user));
        return jest.fn();
    });
    mockGetDocs.mockResolvedValue(docsFrom(statuses));
}

beforeEach(() => {
    mockCollection.mockImplementation((_db, name) => ({ __collection: name }));
    mockQuery.mockImplementation((...args) => ({ __query: args }));
    mockOr.mockImplementation((...args) => ({ __or: args }));
    mockWhere.mockImplementation((...args) => ({ __where: args }));
    mockOnAuthStateChanged.mockImplementation(() => jest.fn());
    mockGetDocs.mockResolvedValue(docsFrom([]));
});

describe('StatusListPage', () => {
    test('sets the document title', () => {
        renderWithRouter(<StatusListPage />);
        expect(document.title).toBe('Statuses');
    });

    test('shows the empty state before auth resolves', () => {
        renderWithRouter(<StatusListPage />);
        expect(screen.getByText('No statuses match these filters.')).toBeInTheDocument();
    });

    test('queries public statuses plus ones the user can read or write', async () => {
        signIn({ uid: 'user-1' }, [blessed]);
        renderWithRouter(<StatusListPage />);

        expect(await screen.findByText('Blessed')).toBeInTheDocument();
        expect(mockCollection).toHaveBeenCalledWith({}, 'statuses');
        expect(mockWhere).toHaveBeenCalledWith('public', '==', true);
        expect(mockWhere).toHaveBeenCalledWith('canRead', 'array-contains', 'user-1');
        expect(mockWhere).toHaveBeenCalledWith('canWrite', 'array-contains', 'user-1');
    });

    test('a failed query is logged, leaving the list empty instead of crashing', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        mockOnAuthStateChanged.mockImplementation((_auth, callback) => { Promise.resolve().then(() => callback({ uid: 'user-1' })); return jest.fn(); });
        mockGetDocs.mockRejectedValue(new Error('offline'));
        renderWithRouter(<StatusListPage />);

        await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
        expect(screen.getByText('No statuses match these filters.')).toBeInTheDocument();
        consoleSpy.mockRestore();
    });

    describe('cards', () => {
        test('a flat-delta effect shows a signed badge', async () => {
            signIn({ uid: 'user-1' }, [blessed]);
            renderWithRouter(<StatusListPage />);
            await screen.findByText('Blessed');
            expect(screen.getByText('+2 Hit Modifier')).toBeInTheDocument();
        });

        test('a negative delta effect keeps its own sign, no extra +', async () => {
            signIn({ uid: 'user-1' }, [poisoned]);
            renderWithRouter(<StatusListPage />);
            await screen.findByText('Poisoned');
            expect(screen.getByText('-1 Hardness')).toBeInTheDocument();
        });

        test('a scaled effect shows the min-to-max range', async () => {
            const scaled = { id: 'status-scaled', name: 'Growing', polarity: 'buff', effects: [{ stat: 'hardness', mode: 'scaled', table: [{ level: 1, delta: 1 }, { level: 3, delta: 4 }] }] };
            signIn({ uid: 'user-1' }, [scaled]);
            renderWithRouter(<StatusListPage />);
            await screen.findByText('Growing');
            expect(screen.getByText('Hardness 1 to 4 by stacks')).toBeInTheDocument();
        });

        test('a scaled effect with an empty table shows "unset"', async () => {
            const scaled = { id: 'status-scaled', name: 'Growing', polarity: 'buff', effects: [{ stat: 'hardness', mode: 'scaled', table: [] }] };
            signIn({ uid: 'user-1' }, [scaled]);
            renderWithRouter(<StatusListPage />);
            await screen.findByText('Growing');
            expect(screen.getByText('Hardness (scaled, unset)')).toBeInTheDocument();
        });

        test('a granted action shows a "Grants:" badge', async () => {
            const grants = { id: 'status-grants', name: 'Empowered', polarity: 'buff', grantedAction: { actionName: 'Power Strike' } };
            signIn({ uid: 'user-1' }, [grants]);
            renderWithRouter(<StatusListPage />);
            await screen.findByText('Empowered');
            expect(screen.getByText('Grants: Power Strike')).toBeInTheDocument();
        });

        test('no badge row at all when there are no effects and no granted action', async () => {
            const plain = { id: 'status-plain', name: 'Plain', polarity: 'neutral' };
            signIn({ uid: 'user-1' }, [plain]);
            renderWithRouter(<StatusListPage />);
            await screen.findByText('Plain');
            expect(screen.queryByText(/Grants:/)).not.toBeInTheDocument();
        });

        test.each([
            ['Admin Default', blessed],
            ['Pool (subscribe to use)', poisoned],
            ['Campaign-locked', dazed],
            ['Creator-locked', { id: 'status-x', name: 'Whatever', polarity: 'neutral' }],
        ])('shows the "%s" visibility label', async (label, status) => {
            signIn({ uid: 'user-1' }, [status]);
            renderWithRouter(<StatusListPage />);
            await screen.findByText(status.name);
            expect(screen.getByText(label)).toBeInTheDocument();
        });

        test('shows the class restriction list when present', async () => {
            signIn({ uid: 'user-1' }, [poisoned]);
            renderWithRouter(<StatusListPage />);
            await screen.findByText('Poisoned');
            expect(screen.getByText('Fighter, Rogue')).toBeInTheDocument();
        });

        test('shows the description', async () => {
            signIn({ uid: 'user-1' }, [poisoned]);
            renderWithRouter(<StatusListPage />);
            await screen.findByText('Poisoned');
            expect(screen.getByText('Ongoing damage.')).toBeInTheDocument();
        });

        test('clicking a card navigates to its detail route', async () => {
            signIn({ uid: 'user-1' }, [blessed]);
            renderWithRouter(<StatusListPage />);
            fireEvent.click(await screen.findByText('Blessed'));
            expect(mockNavigate).toHaveBeenCalledWith('/statuses/status-blessed');
        });

        test('+ Create New Status navigates to /statuses', () => {
            renderWithRouter(<StatusListPage />);
            fireEvent.click(screen.getByRole('button', { name: '+ Create New Status' }));
            expect(mockNavigate).toHaveBeenCalledWith('/statuses');
        });
    });

    describe('filters', () => {
        beforeEach(() => signIn({ uid: 'user-1' }, [blessed, poisoned, dazed]));

        test('filtering by polarity shows only matching cards', async () => {
            renderWithRouter(<StatusListPage />);
            await screen.findByText('Blessed');

            fireEvent.click(screen.getByRole('button', { name: 'Debuff' }));

            expect(screen.queryByText('Blessed')).not.toBeInTheDocument();
            expect(screen.getByText('Poisoned')).toBeInTheDocument();
        });

        test('"Mine" shows only statuses the user can write to', async () => {
            renderWithRouter(<StatusListPage />);
            await screen.findByText('Blessed');

            fireEvent.click(screen.getByRole('button', { name: 'Mine' }));

            expect(screen.queryByText('Blessed')).not.toBeInTheDocument();
            expect(screen.queryByText('Poisoned')).not.toBeInTheDocument();
            expect(screen.getByText('Dazed')).toBeInTheDocument();
        });

        test('"Public" shows only statuses marked public', async () => {
            renderWithRouter(<StatusListPage />);
            await screen.findByText('Blessed');

            fireEvent.click(screen.getByRole('button', { name: 'Public' }));

            expect(screen.queryByText('Blessed')).not.toBeInTheDocument();
            expect(screen.getByText('Poisoned')).toBeInTheDocument();
            expect(screen.queryByText('Dazed')).not.toBeInTheDocument();
        });

        test('a filter combination with no matches shows the empty state', async () => {
            renderWithRouter(<StatusListPage />);
            await screen.findByText('Blessed');

            fireEvent.click(screen.getByRole('button', { name: 'Mine' }));
            fireEvent.click(screen.getByRole('button', { name: 'Debuff' }));

            expect(screen.getByText('No statuses match these filters.')).toBeInTheDocument();
        });
    });
});
