jest.mock('../../src/utils/firebase', () => ({ auth: { currentUser: { uid: 'user-1' } }, db: {} }));

const mockOnAuthStateChanged = jest.fn();
jest.mock('firebase/auth', () => ({
    onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
}));

const mockCollection = jest.fn();
const mockAddDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    collection: (...args) => mockCollection(...args),
    addDoc: (...args) => mockAddDoc(...args),
    getDoc: (...args) => mockGetDoc(...args),
    doc: (...args) => mockDoc(...args),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
}));

// eslint-disable-next-line import/first
import { render, screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/first
import { NewCampaignPage } from '../../src/components/NewCampaignPage';

function signIn(playerData = { name: 'Sam' }) {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        // Real Firebase never calls this callback synchronously (even for a
        // cached auth state) - it's always deferred at least a microtask.
        // NewCampaignPage.js's effect relies on that (it calls unsubscribe()
        // from inside the callback, referencing the const the
        // onAuthStateChanged(...) call itself hasn't finished assigning yet
        // if invoked synchronously) - firing synchronously here would hit
        // that same TDZ crash for a reason that could never happen for real.
        Promise.resolve().then(() => callback({ uid: 'user-1' }));
        return jest.fn();
    });
    mockGetDoc.mockResolvedValue({ data: () => playerData });
}

beforeEach(() => {
    mockCollection.mockImplementation((_db, name) => ({ __collection: name }));
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockOnAuthStateChanged.mockImplementation(() => jest.fn());
    mockAddDoc.mockResolvedValue({ id: 'new-campaign-id' });
    window.alert = jest.fn();
});

afterEach(() => {
    delete window.alert;
});

describe('NewCampaignPage', () => {
    test('sets the document title', () => {
        render(<NewCampaignPage />);
        expect(document.title).toBe('New Campaign');
    });

    test('shows a placeholder director name until user info loads, then the real name', async () => {
        signIn({ name: 'Sam' });
        render(<NewCampaignPage />);
        expect(screen.getByText('…')).toBeInTheDocument();

        expect(await screen.findByText('Sam')).toBeInTheDocument();
    });

    test('the submit button is disabled until a non-blank campaign name is entered', () => {
        render(<NewCampaignPage />);
        expect(screen.getByRole('button', { name: 'Create Campaign' })).toBeDisabled();

        fireEvent.change(screen.getByLabelText('Campaign Name'), { target: { value: '  ' } });
        expect(screen.getByRole('button', { name: 'Create Campaign' })).toBeDisabled();

        fireEvent.change(screen.getByLabelText('Campaign Name'), { target: { value: 'The Sunken Archive' } });
        expect(screen.getByRole('button', { name: 'Create Campaign' })).toBeEnabled();
    });

    test('submitting before auth has resolved alerts that you need to be signed in', () => {
        render(<NewCampaignPage />);
        fireEvent.change(screen.getByLabelText('Campaign Name'), { target: { value: 'The Sunken Archive' } });

        fireEvent.click(screen.getByRole('button', { name: 'Create Campaign' }));

        expect(window.alert).toHaveBeenCalledWith('You need to be logged in to use this feature!');
        expect(mockAddDoc).not.toHaveBeenCalled();
    });

    test('a successful submit creates the campaign doc with director info and navigates to it', async () => {
        signIn({ name: 'Sam' });
        render(<NewCampaignPage />);
        await screen.findByText('Sam');
        fireEvent.change(screen.getByLabelText('Campaign Name'), { target: { value: 'The Sunken Archive' } });

        fireEvent.click(screen.getByRole('button', { name: 'Create Campaign' }));

        expect(mockCollection).toHaveBeenCalledWith({}, 'campaigns');
        // On success the component never calls setSubmitting(false) - it
        // relies entirely on navigate() causing the *parent* (Campaigns.js)
        // to swap this component out for CampaignPage. Tested in isolation
        // (no real router swap happening), it stays showing "Creating…"
        // forever - that's expected here, not a bug; findByRole below just
        // waits for the navigate() call to prove the flow completed.
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(mockAddDoc).toHaveBeenCalledWith({ __collection: 'campaigns' }, {
            campaign_name: 'The Sunken Archive',
            director_name: 'Sam',
            director_uid: 'user-1',
            canWrite: ['user-1'],
            admins: ['user-1'],
        });
        expect(mockNavigate).toHaveBeenCalledWith('/campaigns/new-campaign-id');
    });

    test('shows "Creating…" while the submit is in flight, and stays that way after success (relies on the parent unmounting it via navigate(), not on local state)', async () => {
        signIn({ name: 'Sam' });
        let resolveAddDoc;
        mockAddDoc.mockReturnValue(new Promise((resolve) => { resolveAddDoc = resolve; }));
        render(<NewCampaignPage />);
        await screen.findByText('Sam');
        fireEvent.change(screen.getByLabelText('Campaign Name'), { target: { value: 'The Sunken Archive' } });

        fireEvent.click(screen.getByRole('button', { name: 'Create Campaign' }));

        expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
        resolveAddDoc({ id: 'new-campaign-id' });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
        expect(mockNavigate).toHaveBeenCalledWith('/campaigns/new-campaign-id');
    });

    test('a second rapid click while already submitting does not create a second campaign', async () => {
        signIn({ name: 'Sam' });
        mockAddDoc.mockReturnValue(new Promise(() => {})); // never resolves within this test
        render(<NewCampaignPage />);
        await screen.findByText('Sam');
        fireEvent.change(screen.getByLabelText('Campaign Name'), { target: { value: 'The Sunken Archive' } });
        const button = screen.getByRole('button', { name: 'Create Campaign' });

        fireEvent.click(button);
        fireEvent.click(button); // second click fires before React re-renders disabled=true

        expect(mockAddDoc).toHaveBeenCalledTimes(1);
    });

    test('an error during submit is alerted and the form becomes usable again', async () => {
        signIn({ name: 'Sam' });
        mockAddDoc.mockRejectedValue(new Error('offline'));
        render(<NewCampaignPage />);
        await screen.findByText('Sam');
        fireEvent.change(screen.getByLabelText('Campaign Name'), { target: { value: 'The Sunken Archive' } });

        fireEvent.click(screen.getByRole('button', { name: 'Create Campaign' }));

        await screen.findByRole('button', { name: 'Create Campaign', hidden: false });
        expect(window.alert).toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Create Campaign' })).toBeEnabled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });
});
