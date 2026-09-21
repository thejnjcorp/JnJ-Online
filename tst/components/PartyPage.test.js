jest.mock('../../src/utils/firebase', () => ({ auth: {}, db: {} }));
const mockOnAuthStateChanged = jest.fn();
jest.mock('firebase/auth', () => ({ onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args) }));

const mockOnSnapshot = jest.fn();
jest.mock('firebase/firestore', () => ({
    collection: (_db, name) => ({ __collection: name }),
    doc: (_db, ...path) => ({ __doc: path }),
    onSnapshot: (...args) => mockOnSnapshot(...args),
    query: (...args) => ({ __query: args }),
    where: (...args) => ({ __where: args }),
}));

const mockEnsureParty = jest.fn();
jest.mock('../../src/utils/party', () => ({ ensureParty: (...args) => mockEnsureParty(...args) }));
let mockParty;
jest.mock('../../src/utils/useParty', () => ({ useParty: () => mockParty }));
jest.mock('../../src/utils/usePartyNotes', () => ({ usePartyNotes: jest.fn(), PARTY_NOTES_TEXT: { heading: 'Party notes', storagePrefix: 'x' } }));

const mockNotesProps = [];
jest.mock('../../src/components/DirectorNotes', () => ({ DirectorNotes: props => { mockNotesProps.push(props); return <div>Notes-stub:{props.campaignId}:{props.heading}</div>; } }));
const mockInventoryProps = [];
jest.mock('../../src/components/PartyInventoryTab', () => ({ PartyInventoryTab: props => { mockInventoryProps.push(props); return <div>InventoryTab-stub:{props.acting?.character_id || 'nobody'}:{props.members.join(',')}</div>; } }));
const mockTradesProps = [];
jest.mock('../../src/components/PartyTradesTab', () => ({ PartyTradesTab: props => { mockTradesProps.push(props); return <div>TradesTab-stub:{props.characters.length}:{props.myCharacters.length}:{String(props.isDirector)}</div>; } }));
const mockCalendarProps = [];
jest.mock('../../src/components/PartyCalendarTab', () => ({ PartyCalendarTab: props => { mockCalendarProps.push(props); return <div>CalendarTab-stub:{String(props.isDirector)}</div>; } }));

// eslint-disable-next-line import/first
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
// eslint-disable-next-line import/first
import { PartyPage } from '../../src/components/PartyPage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const campaign = { campaign_name: 'The Iron Vale', director_uid: 'dm', canRead: ['alice', 'bob', 'dm'], canWrite: ['dm'], admins: ['dm'] };
const character = (id, name, playerId, extra = {}) => ({ id, name, data: () => ({ character_name: name, playerId, campaign: 'camp-1', ...extra }) });

let campaignListener;
let campaignFail;
let charactersListener;

function draw({ user = { uid: 'alice' }, route = '/party/camp-1', characters = [character('aria', 'Aria', 'alice'), character('bram', 'Bram', 'bob')], campaignDoc = campaign } = {}) {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => { Promise.resolve().then(() => callback(user)); return jest.fn(); });
    mockOnSnapshot.mockImplementation((ref, onNext, onError) => {
        if (ref.__doc) {
            campaignListener = onNext;
            campaignFail = onError;
            Promise.resolve().then(() => onNext({ exists: () => campaignDoc !== null, id: 'camp-1', data: () => campaignDoc }));
        } else {
            charactersListener = onNext;
            Promise.resolve().then(() => onNext({ docs: characters.map(c => ({ id: c.id, data: c.data })) }));
        }
        return jest.fn();
    });
    return renderWithRouter(<PartyPage />, { route });
}

beforeEach(() => {
    mockParty = { party: { inventory: [] }, loaded: true, error: null };
    mockEnsureParty.mockResolvedValue(undefined);
    [mockNotesProps, mockInventoryProps, mockTradesProps, mockCalendarProps].forEach(list => { list.length = 0; });
});

describe('PartyPage', () => {
    describe('getting in', () => {
        test('says to sign in when signed out', async () => {
            draw({ user: null });
            expect(await screen.findByText('Sign in to see the party.')).toBeInTheDocument();
        });

        test('shows loading while it finds who and what', () => {
            draw();
            expect(screen.getByText('Loading…')).toBeInTheDocument();
        });

        test('says so when the campaign is not there or the person is not in it', async () => {
            draw({ campaignDoc: null });
            expect(await screen.findByRole('alert')).toHaveTextContent("This campaign doesn't exist, or you're not part of it.");
        });

        test('says so when the campaign cannot be read at all', async () => {
            draw();
            await screen.findByRole('heading', { name: 'The Party' });
            act(() => campaignFail(new Error('permission-denied')));
            expect(await screen.findByRole('alert')).toHaveTextContent("doesn't exist, or you're not part of it");
        });

        test('listens to this campaign, and its characters', async () => {
            draw();
            await screen.findByRole('heading', { name: 'The Party' });
            expect(mockOnSnapshot).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1'] }, expect.any(Function), expect.any(Function));
            await waitFor(() => expect(mockOnSnapshot.mock.calls.some(call => call[0].__query)).toBe(true));
            expect(JSON.stringify(mockOnSnapshot.mock.calls.find(call => call[0].__query)[0])).toContain('camp-1');
        });

        test('makes sure the campaign has a party doc, as anyone opening the campaign does', async () => {
            draw();
            await screen.findByRole('heading', { name: 'The Party' });
            await waitFor(() => expect(mockEnsureParty).toHaveBeenCalledWith('camp-1'));
        });

        test('a party doc that could not be made is logged, not thrown', async () => {
            const log = jest.spyOn(console, 'log').mockImplementation(() => {});
            mockEnsureParty.mockRejectedValue(new Error('offline'));
            draw();
            await screen.findByRole('heading', { name: 'The Party' });
            await waitFor(() => expect(log).toHaveBeenCalledWith("Couldn't create the party doc: Error: offline"));
            log.mockRestore();
        });
    });

    describe('the page', () => {
        test('names the campaign, links back to it, and titles the tab', async () => {
            draw();
            expect(await screen.findByRole('link', { name: /The Iron Vale/ })).toHaveAttribute('href', '/campaigns/camp-1');
            expect(document.title).toBe('Party - The Iron Vale');
        });

        test('opens on the inventory, and has a tab for each part of the party', async () => {
            draw();
            expect(await screen.findByText(/InventoryTab-stub/)).toBeInTheDocument();
            expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Inventory', 'Trades', 'Notes', 'Calendar']);
            expect(screen.getByRole('tab', { name: 'Inventory' })).toHaveAttribute('aria-selected', 'true');
        });

        test.each([
            ['trades', /TradesTab-stub/],
            ['notes', /Notes-stub:camp-1:Party notes/],
            ['calendar', /CalendarTab-stub/],
        ])('the %s tab is chosen from the address', async (tab, expected) => {
            draw({ route: `/party/camp-1?tab=${tab}` });
            expect(await screen.findByText(expected)).toBeInTheDocument();
            expect(screen.getByRole('tab', { name: new RegExp(`^${tab}$`, 'i') })).toHaveAttribute('aria-selected', 'true');
        });

        test('a tab that does not exist opens the inventory', async () => {
            draw({ route: '/party/camp-1?tab=nonsense' });
            expect(await screen.findByText(/InventoryTab-stub/)).toBeInTheDocument();
        });

        test('pressing a tab switches to it', async () => {
            draw();
            await screen.findByText(/InventoryTab-stub/);
            fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));
            expect(screen.getByText(/CalendarTab-stub/)).toBeInTheDocument();
            expect(screen.queryByText(/InventoryTab-stub/)).not.toBeInTheDocument();
        });

        test('the notes are the party\'s notebook: the same notebook as the director\'s, worded for the party', async () => {
            draw({ route: '/party/camp-1?tab=notes' });
            await screen.findByText(/Notes-stub/);
            expect(mockNotesProps[0].useNotes).toEqual(expect.any(Function));
            expect(mockNotesProps[0]).toMatchObject({ campaignId: 'camp-1', heading: 'Party notes', storagePrefix: 'x' });
        });

        test('says so when the party cannot be loaded', async () => {
            mockParty = { party: {}, loaded: true, error: new Error('permission-denied') };
            draw();
            expect(await screen.findByText(/Couldn't load the party/)).toBeInTheDocument();
        });
    });

    describe('who is playing', () => {
        test('a player plays their own character, and the tabs are given it and everyone else\'s', async () => {
            draw();
            await screen.findByText(/InventoryTab-stub:aria/);
            expect(mockInventoryProps.at(-1).acting.character_id).toBe('aria');
            expect(mockInventoryProps.at(-1).members).toEqual(['dm', 'alice', 'bob']);
            fireEvent.click(screen.getByRole('tab', { name: 'Trades' }));
            expect(screen.getByText('TradesTab-stub:2:1:false')).toBeInTheDocument();
        });

        test('someone with several characters picks which they are playing', async () => {
            draw({ characters: [character('aria', 'Aria', 'alice'), character('cleo', 'Cleo', 'alice'), character('bram', 'Bram', 'bob')] });
            await screen.findByText(/InventoryTab-stub:aria/);
            fireEvent.change(screen.getByLabelText('Playing as'), { target: { value: 'cleo' } });
            expect(screen.getByText(/InventoryTab-stub:cleo/)).toBeInTheDocument();
        });

        test('someone with no character in the campaign plays nobody, and has no choice to make', async () => {
            draw({ user: { uid: 'dm' } });
            await screen.findByText(/InventoryTab-stub:nobody/);
            expect(screen.queryByLabelText('Playing as')).not.toBeInTheDocument();
        });

        test('a director is known as one, for the trades and the calendar', async () => {
            draw({ user: { uid: 'dm' }, route: '/party/camp-1?tab=trades' });
            expect(await screen.findByText('TradesTab-stub:2:0:true')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));
            expect(screen.getByText('CalendarTab-stub:true')).toBeInTheDocument();
        });

        test('a player is not', async () => {
            draw({ route: '/party/camp-1?tab=calendar' });
            expect(await screen.findByText('CalendarTab-stub:false')).toBeInTheDocument();
        });

        test('archived characters are not in the party', async () => {
            draw({ characters: [character('aria', 'Aria', 'alice'), character('zed', 'Zed', 'bob', { archived: true })], route: '/party/camp-1?tab=trades' });
            expect(await screen.findByText('TradesTab-stub:1:1:false')).toBeInTheDocument();
        });

        test('characters that change are followed', async () => {
            draw({ route: '/party/camp-1?tab=trades' });
            await screen.findByText('TradesTab-stub:2:1:false');
            act(() => charactersListener({ docs: [character('aria', 'Aria', 'alice'), character('bram', 'Bram', 'bob'), character('cleo', 'Cleo', 'cara')].map(c => ({ id: c.id, data: c.data })) }));
            expect(screen.getByText('TradesTab-stub:3:1:false')).toBeInTheDocument();
            expect(campaignListener).toBeDefined();
        });
    });
});
