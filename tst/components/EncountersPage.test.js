jest.mock('../../src/utils/firebase', () => ({ db: {} }));
const mockAddDoc = jest.fn();
const mockDeleteDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    addDoc: (...args) => mockAddDoc(...args),
    collection: (_db, ...path) => ({ __collection: path }),
    deleteDoc: (...args) => mockDeleteDoc(...args),
    doc: (_db, ...path) => ({ __doc: path }),
    serverTimestamp: () => 'now',
}));
let mockEncounters;
jest.mock('../../src/utils/useEncounters', () => ({ useEncounters: () => mockEncounters }));
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ ...jest.requireActual('react-router-dom'), useNavigate: () => mockNavigate }));

// eslint-disable-next-line import/first
import { screen, fireEvent, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { EncountersPage } from '../../src/components/EncountersPage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const ambush = {
    id: 'e1', name: 'Ambush', stagedIds: [],
    roster: [{ count: 4, enemy: { enemy_type: 'Goon' } }, { count: 1, enemy: { enemy_type: 'Captain' } }],
};
const camp = { id: 'e2', name: 'Bandit camp', stagedIds: ['x'], roster: [] };

function renderPage(encounters, status = 'ready') {
    mockEncounters = { encounters, status };
    renderWithRouter(<EncountersPage />, { route: '/campaigns/camp-1/encounters' });
}

beforeEach(() => {
    mockAddDoc.mockResolvedValue({ id: 'new-encounter' });
    mockDeleteDoc.mockResolvedValue(undefined);
    window.alert = jest.fn();
    window.confirm = jest.fn(() => true);
});

afterEach(() => {
    delete window.alert;
    delete window.confirm;
});

describe('EncountersPage', () => {
    test('lists each encounter with a summary of its roster, and marks the staged ones', () => {
        renderPage([ambush, camp]);
        expect(screen.getByText('Ambush')).toBeInTheDocument();
        expect(screen.getByText('4 Goons, 1 Captain')).toBeInTheDocument();
        expect(screen.getByText('No enemies yet')).toBeInTheDocument();
        expect(screen.getAllByText('Staged')).toHaveLength(1);
    });

    test('opening one goes to its page in this campaign', () => {
        renderPage([ambush]);
        fireEvent.click(screen.getByText('Ambush'));
        expect(mockNavigate).toHaveBeenCalledWith('/campaigns/camp-1/encounters/e1');
    });

    test('the breadcrumb goes back to the campaign', () => {
        renderPage([]);
        fireEvent.click(screen.getByRole('button', { name: /Campaign/ }));
        expect(mockNavigate).toHaveBeenCalledWith('/campaigns/camp-1');
    });

    test('+ New Encounter makes an empty one in this campaign and opens it', async () => {
        renderPage([]);
        fireEvent.click(screen.getByRole('button', { name: '+ New Encounter' }));

        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/campaigns/camp-1/encounters/new-encounter'));
        const [target, data] = mockAddDoc.mock.calls[0];
        expect(target).toEqual({ __collection: ['campaigns', 'camp-1', 'encounters'] });
        expect(data).toMatchObject({ name: 'New encounter', notes: '', roster: [], stagedIds: [] });
    });

    test('a failed create is alerted and goes nowhere', async () => {
        mockAddDoc.mockRejectedValue(new Error('denied'));
        renderPage([]);
        fireEvent.click(screen.getByRole('button', { name: '+ New Encounter' }));
        await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('denied')));
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('Delete asks first, then removes just that encounter', async () => {
        renderPage([ambush]);
        fireEvent.click(screen.getByRole('button', { name: 'Delete Ambush' }));

        expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Ambush'));
        await waitFor(() => expect(mockDeleteDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1', 'encounters', 'e1'] }));
    });

    test('declining the confirmation deletes nothing', () => {
        window.confirm = jest.fn(() => false);
        renderPage([ambush]);
        fireEvent.click(screen.getByRole('button', { name: 'Delete Ambush' }));
        expect(mockDeleteDoc).not.toHaveBeenCalled();
    });

    test('says when there are none, while loading, and when they cannot be read', () => {
        renderPage([]);
        expect(screen.getByText('No encounters yet.')).toBeInTheDocument();
    });

    test('loading and error states', () => {
        renderPage([], 'loading');
        expect(screen.getByText('Loading…')).toBeInTheDocument();
    });

    test('someone who cannot read them is told why', () => {
        renderPage([], 'error');
        expect(screen.getByText(/Only this campaign's directors can see them/)).toBeInTheDocument();
    });
});
