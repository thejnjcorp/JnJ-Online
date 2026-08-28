jest.mock('../../src/utils/firebase', () => ({ auth: {}, db: {} }));

const mockOnAuthStateChanged = jest.fn();
jest.mock('firebase/auth', () => ({
    onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
}));

const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockGetDocs = jest.fn();
const mockOr = jest.fn();
const mockWhere = jest.fn();
jest.mock('firebase/firestore', () => ({
    collection: (...args) => mockCollection(...args),
    query: (...args) => mockQuery(...args),
    getDocs: (...args) => mockGetDocs(...args),
    or: (...args) => mockOr(...args),
    where: (...args) => mockWhere(...args),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

// Every routed sub-page gets its own dedicated test file - stubbed here so
// Campaigns.js's own path-based routing and campaign-list logic can be
// tested in isolation.
jest.mock('../../src/components/CampaignPage', () => ({ CampaignPage: () => <div>CampaignPage-stub</div> }));
jest.mock('../../src/components/NewCampaignPage', () => ({ NewCampaignPage: () => <div>NewCampaignPage-stub</div> }));
jest.mock('../../src/components/NewCharacterPage', () => ({ NewCharacterPage: () => <div>NewCharacterPage-stub</div> }));
jest.mock('../../src/components/CampaignClassesPage', () => ({ CampaignClassesPage: () => <div>CampaignClassesPage-stub</div> }));
jest.mock('../../src/components/CampaignStatusesPage', () => ({ CampaignStatusesPage: () => <div>CampaignStatusesPage-stub</div> }));

// eslint-disable-next-line import/first
import { screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/first
import { Campaigns } from '../../src/components/Campaigns';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const campaignA = { id: 'camp-a', campaign_name: 'The Iron Vale', director_name: 'Sam', players: ['p1', 'p2'] };
const campaignB = { id: 'camp-b', campaign_name: 'Solo', director_name: 'Sam', players: ['p1'] };
const archivedCampaign = { id: 'camp-old', campaign_name: 'Old Times', director_name: 'Sam', archived: true };

function mockSignedIn(campaigns) {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        callback({ uid: 'user-1' });
        return jest.fn();
    });
    mockGetDocs.mockResolvedValue({ docs: campaigns.map(c => ({ id: c.id, data: () => c })) });
}

beforeEach(() => {
    mockCollection.mockImplementation((_db, name) => ({ __collection: name }));
    mockQuery.mockImplementation((...args) => ({ __query: args }));
    mockOr.mockImplementation((...args) => ({ __or: args }));
    mockWhere.mockImplementation((...args) => ({ __where: args }));
    mockOnAuthStateChanged.mockImplementation(() => jest.fn());
    mockGetDocs.mockResolvedValue({ docs: [] });
});

describe('Campaigns', () => {
    describe('on /campaigns', () => {
        test('shows a loading state before the auth listener has resolved', () => {
            renderWithRouter(<Campaigns />, { route: '/campaigns' });
            expect(screen.getByAltText('Loading')).toBeInTheDocument();
        });

        test('shows a sign-in prompt when signed out', async () => {
            mockOnAuthStateChanged.mockImplementation((_auth, callback) => { callback(null); return jest.fn(); });
            renderWithRouter(<Campaigns />, { route: '/campaigns' });
            expect(await screen.findByText('Sign in to see your campaigns.')).toBeInTheDocument();
        });

        test('queries campaigns the user can read or write, then renders a card per active campaign', async () => {
            mockSignedIn([campaignA]);
            renderWithRouter(<Campaigns />, { route: '/campaigns' });

            expect(await screen.findByText('The Iron Vale')).toBeInTheDocument();
            expect(mockCollection).toHaveBeenCalledWith({}, 'campaigns');
            expect(mockWhere).toHaveBeenCalledWith('canRead', 'array-contains', 'user-1');
            expect(mockWhere).toHaveBeenCalledWith('canWrite', 'array-contains', 'user-1');
        });

        test('shows the director name and pluralized player count', async () => {
            mockSignedIn([campaignA, campaignB]);
            renderWithRouter(<Campaigns />, { route: '/campaigns' });

            await screen.findByText('The Iron Vale');
            expect(screen.getByText(/Director: Sam.*2 players/)).toBeInTheDocument();
            expect(screen.getByText(/Director: Sam.*1 player$/)).toBeInTheDocument();
        });

        test('a campaign with no players shown gets no player-count text at all', async () => {
            mockSignedIn([{ ...campaignA, players: [] }]);
            renderWithRouter(<Campaigns />, { route: '/campaigns' });

            await screen.findByText('The Iron Vale');
            expect(screen.getByText('Director: Sam')).toBeInTheDocument();
        });

        test('shows "No campaigns yet." when there are no active campaigns', async () => {
            mockSignedIn([]);
            renderWithRouter(<Campaigns />, { route: '/campaigns' });
            expect(await screen.findByText('No campaigns yet.')).toBeInTheDocument();
        });

        test('archived campaigns are excluded from the main grid and from the empty-state check', async () => {
            mockSignedIn([archivedCampaign]);
            renderWithRouter(<Campaigns />, { route: '/campaigns' });

            expect(await screen.findByText('No campaigns yet.')).toBeInTheDocument();
            expect(screen.queryByText('Old Times')).not.toBeInTheDocument();
        });

        test('clicking a campaign card navigates to /campaigns/<id>', async () => {
            mockSignedIn([campaignA]);
            renderWithRouter(<Campaigns />, { route: '/campaigns' });

            fireEvent.click(await screen.findByText('The Iron Vale'));

            expect(mockNavigate).toHaveBeenCalledWith('/campaigns/camp-a');
        });

        test('clicking + Create Campaign navigates to /campaigns/new', async () => {
            mockSignedIn([]);
            renderWithRouter(<Campaigns />, { route: '/campaigns' });

            fireEvent.click(await screen.findByText('+ Create Campaign'));

            expect(mockNavigate).toHaveBeenCalledWith('/campaigns/new');
        });

        describe('archived section', () => {
            test('is hidden entirely when there are no archived campaigns', async () => {
                mockSignedIn([campaignA]);
                renderWithRouter(<Campaigns />, { route: '/campaigns' });
                await screen.findByText('The Iron Vale');
                expect(screen.queryByText(/Archived/)).not.toBeInTheDocument();
            });

            test('shows a toggle with the archived count, collapsed by default', async () => {
                mockSignedIn([campaignA, archivedCampaign]);
                renderWithRouter(<Campaigns />, { route: '/campaigns' });

                expect(await screen.findByRole('button', { name: 'Show Archived (1)' })).toBeInTheDocument();
                expect(screen.queryByText('Old Times')).not.toBeInTheDocument();
            });

            test('clicking the toggle reveals the archived campaigns, and toggles the button label', async () => {
                mockSignedIn([campaignA, archivedCampaign]);
                renderWithRouter(<Campaigns />, { route: '/campaigns' });
                const toggle = await screen.findByRole('button', { name: 'Show Archived (1)' });

                fireEvent.click(toggle);

                expect(screen.getByText('Old Times')).toBeInTheDocument();
                expect(screen.getByRole('button', { name: 'Hide Archived (1)' })).toBeInTheDocument();
            });

            test('shows the scheduled deletion date when present', async () => {
                const withDeletion = { ...archivedCampaign, scheduledDeletionAt: { toDate: () => new Date(2026, 0, 15) } };
                mockSignedIn([campaignA, withDeletion]);
                renderWithRouter(<Campaigns />, { route: '/campaigns' });
                fireEvent.click(await screen.findByRole('button', { name: 'Show Archived (1)' }));

                expect(screen.getByText(/Deletes January 15, 2026/)).toBeInTheDocument();
            });
        });
    });

    describe('sub-route rendering', () => {
        test('/campaigns/new renders NewCampaignPage, not the campaign list', async () => {
            renderWithRouter(<Campaigns />, { route: '/campaigns/new' });
            expect(await screen.findByText('NewCampaignPage-stub')).toBeInTheDocument();
            expect(screen.queryByText('Campaigns')).not.toBeInTheDocument();
        });

        test('/campaigns/:id/newCharacter renders NewCharacterPage', async () => {
            renderWithRouter(<Campaigns />, { route: '/campaigns/camp-a/newCharacter' });
            expect(await screen.findByText('NewCharacterPage-stub')).toBeInTheDocument();
        });

        test('/campaigns/:id/classes renders CampaignClassesPage', async () => {
            renderWithRouter(<Campaigns />, { route: '/campaigns/camp-a/classes' });
            expect(await screen.findByText('CampaignClassesPage-stub')).toBeInTheDocument();
        });

        test('/campaigns/:id/statuses renders CampaignStatusesPage', async () => {
            renderWithRouter(<Campaigns />, { route: '/campaigns/camp-a/statuses' });
            expect(await screen.findByText('CampaignStatusesPage-stub')).toBeInTheDocument();
        });

        test('/campaigns/:id (no special suffix) renders CampaignPage - the catch-all detail view', async () => {
            renderWithRouter(<Campaigns />, { route: '/campaigns/camp-a' });
            expect(await screen.findByText('CampaignPage-stub')).toBeInTheDocument();
        });
    });
});
