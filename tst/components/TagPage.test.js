jest.mock('../../src/utils/firebase', () => ({ auth: {}, db: {} }));

const mockOnAuthStateChanged = jest.fn();
jest.mock('firebase/auth', () => ({ onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args) }));

const mockAddDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    addDoc: (...args) => mockAddDoc(...args),
    collection: (_db, name) => ({ __collection: name }),
    deleteDoc: (...args) => mockDeleteDoc(...args),
    doc: (_db, ...path) => ({ __doc: path }),
    getDoc: (...args) => mockGetDoc(...args),
    getDocs: (...args) => mockGetDocs(...args),
    or: (...args) => ({ __or: args }),
    query: (source, ...rest) => ({ __collection: source.__collection, args: rest }),
    updateDoc: (...args) => mockUpdateDoc(...args),
    where: (...args) => ({ __where: args }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ ...jest.requireActual('react-router-dom'), useNavigate: () => mockNavigate }));

jest.mock('../../src/components/DocAdminManager', () => ({
    DocAdminManager: ({ admins, userId }) => <div>DocAdminManager-stub:{JSON.stringify(admins)}:{userId}</div>,
}));

// eslint-disable-next-line import/first
import { screen, fireEvent, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { TagPage } from '../../src/components/TagPage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const ADMIN_UID = 'wmJQbIlzX9RydXFmh3DzSBpIqHa2';

const docsFrom = items => ({ docs: items.map(item => ({ id: item.id, data: () => item })) });

function signIn(user, classes = [{ id: 'c1', class_name: 'Monk' }, { id: 'c2', class_name: 'Gunslinger' }]) {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        Promise.resolve().then(() => callback(user));
        return jest.fn();
    });
    mockGetDocs.mockResolvedValue(docsFrom(classes));
}

beforeEach(() => {
    mockOnAuthStateChanged.mockImplementation(() => jest.fn());
    mockGetDocs.mockResolvedValue(docsFrom([]));
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockAddDoc.mockResolvedValue({ id: 'new-tag-id' });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    window.alert = jest.fn();
    window.confirm = jest.fn(() => true);
});

afterEach(() => {
    delete window.alert;
    delete window.confirm;
});

const label = () => screen.getByLabelText('Label');
const submit = name => screen.getByRole('button', { name });

describe('TagPage', () => {
    describe('creating a tag', () => {
        function renderNew(user = { uid: 'user-1' }, classes) {
            signIn(user, classes);
            renderWithRouter(<TagPage />, { route: '/tags' });
        }

        test('sets the document title and starts with a preview and sensible colours', () => {
            renderNew();
            expect(document.title).toBe('New Tag');
            expect(screen.getByRole('heading', { name: 'New Tag' })).toBeInTheDocument();
            expect(screen.getByLabelText('Tag colour')).toHaveValue('#61dafb');
            expect(screen.getByLabelText('Text colour')).toHaveValue('#1b1b1f');
            expect(screen.getByLabelText('Preview')).toHaveTextContent('Tag');
        });

        test('the preview follows the label and the colours', () => {
            renderNew();
            fireEvent.change(label(), { target: { value: 'Fire' } });
            fireEvent.change(screen.getByLabelText('Tag colour'), { target: { value: '#ff0000' } });
            fireEvent.change(screen.getByLabelText('Text colour'), { target: { value: '#ffffff' } });

            const pill = screen.getByLabelText('Preview').firstChild;
            expect(pill).toHaveTextContent('Fire');
            expect(pill).toHaveStyle({ backgroundColor: '#ff0000', color: '#ffffff' });
        });

        test('offers the classes it can be scoped to', async () => {
            renderNew();
            expect(await screen.findByRole('button', { name: 'Gunslinger' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Monk' })).toBeInTheDocument();
        });

        test('with no classes yet, says so', async () => {
            renderNew({ uid: 'user-1' }, []);
            expect(await screen.findByText('No classes exist yet.')).toBeInTheDocument();
        });

        test('a tag with no label is not saved', () => {
            renderNew();
            fireEvent.click(submit('Create Tag'));
            expect(window.alert).toHaveBeenCalledWith('A tag needs a label.');
            expect(mockAddDoc).not.toHaveBeenCalled();
        });

        test('a label of only spaces counts as none', () => {
            renderNew();
            fireEvent.change(label(), { target: { value: '   ' } });
            fireEvent.click(submit('Create Tag'));
            expect(mockAddDoc).not.toHaveBeenCalled();
        });

        test('saves a public tag for a non-admin into the pool: public, not a default, and the creator as its writer and admin', async () => {
            renderNew();
            await screen.findByRole('button', { name: 'Monk' });
            fireEvent.change(label(), { target: { value: '  Fire ' } });
            fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Burns things' } });
            fireEvent.click(screen.getByRole('button', { name: 'Monk' }));

            fireEvent.click(submit('Create Tag'));

            await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
            const [target, payload] = mockAddDoc.mock.calls[0];
            expect(target).toEqual({ __collection: 'tags' });
            expect(payload).toEqual({
                tagInfo: 'Fire', tagColor: '#61dafb', textColor: '#1b1b1f', tagDescription: 'Burns things', classes: ['Monk'],
                public: true, isDefault: false, canRead: [], canWrite: ['user-1'], admins: ['user-1'],
            });
            await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/tags/new-tag-id'));
            expect(window.alert).toHaveBeenCalledWith('Tag created.');
        });

        test('an admin choosing Default makes it a default tag', async () => {
            renderNew({ uid: ADMIN_UID });
            fireEvent.change(label(), { target: { value: 'Melee' } });
            expect(await screen.findByRole('button', { name: 'Default' })).toBeInTheDocument();

            fireEvent.click(submit('Create Tag'));

            await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
            expect(mockAddDoc.mock.calls[0][1]).toMatchObject({ public: true, isDefault: true });
        });

        test('a non-admin is offered Public, not Default', async () => {
            renderNew();
            expect(await screen.findByRole('button', { name: 'Public' })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Default' })).not.toBeInTheDocument();
        });

        test('a private tag is readable only by its creator', async () => {
            renderNew();
            await screen.findByRole('button', { name: 'Private' });
            fireEvent.change(label(), { target: { value: 'Homebrew' } });
            fireEvent.click(screen.getByRole('button', { name: 'Private' }));
            expect(screen.getByText(/Only visible to you/)).toBeInTheDocument();

            fireEvent.click(submit('Create Tag'));

            await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
            expect(mockAddDoc.mock.calls[0][1]).toMatchObject({ public: false, isDefault: false, canRead: ['user-1'] });
        });

        test('choosing a class again takes it back out of the scope', async () => {
            renderNew();
            fireEvent.click(await screen.findByRole('button', { name: 'Monk' }));
            fireEvent.click(screen.getByRole('button', { name: 'Monk' }));
            fireEvent.change(label(), { target: { value: 'Fire' } });

            fireEvent.click(submit('Create Tag'));

            await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
            expect(mockAddDoc.mock.calls[0][1].classes).toEqual([]);
        });

        test('a failed save is alerted', async () => {
            mockAddDoc.mockRejectedValue(new Error('offline'));
            renderNew();
            await screen.findByRole('button', { name: 'Monk' });
            fireEvent.change(label(), { target: { value: 'Fire' } });

            fireEvent.click(submit('Create Tag'));

            await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to save tag: offline'));
            expect(mockNavigate).not.toHaveBeenCalled();
        });
    });

    describe('editing a tag', () => {
        const tagDoc = (overrides = {}) => ({
            tagInfo: 'Fire', tagColor: '#ff0000', textColor: '#ffffff', tagDescription: 'Burns', classes: ['Monk'],
            public: true, isDefault: false, canRead: [], canWrite: ['user-1', 'co-writer'], admins: ['user-1'], ...overrides,
        });

        function renderExisting(data, user = { uid: 'user-1' }) {
            signIn(user);
            mockGetDoc.mockResolvedValue({ exists: () => true, data: () => data });
            renderWithRouter(<TagPage />, { route: '/tags/tag-1' });
        }

        test('loads the tag into the form and titles the page with it', async () => {
            renderExisting(tagDoc());

            expect(await screen.findByDisplayValue('Fire')).toBeInTheDocument();
            expect(document.title).toBe('Fire');
            expect(screen.getByLabelText('Tag colour')).toHaveValue('#ff0000');
            expect(screen.getByLabelText('Description')).toHaveValue('Burns');
            expect(await screen.findByRole('button', { name: 'Monk' })).toHaveAttribute('aria-pressed', 'true');
            expect(screen.getByRole('heading', { name: 'Edit Tag' })).toBeInTheDocument();
        });

        test('shows a private tag on Private', async () => {
            renderExisting(tagDoc({ public: false }));
            await screen.findByDisplayValue('Fire');
            expect(await screen.findByRole('button', { name: 'Private' })).toHaveAttribute('aria-pressed', 'true');
        });

        test('shows the admins of the tag', async () => {
            renderExisting(tagDoc());
            expect(await screen.findByText('DocAdminManager-stub:["user-1"]:user-1')).toBeInTheDocument();
        });

        test('fields are editable for a writer', async () => {
            renderExisting(tagDoc());
            await screen.findByDisplayValue('Fire');
            await waitFor(() => expect(label()).toBeEnabled());
        });

        test('someone who cannot write the tag can look but not change it or delete it', async () => {
            renderExisting(tagDoc(), { uid: 'stranger' });
            await screen.findByDisplayValue('Fire');

            await waitFor(() => expect(label()).toBeDisabled());
            expect(screen.getByLabelText('Tag colour')).toBeDisabled();
            expect(submit('Update Tag')).toBeDisabled();
            expect(screen.queryByRole('button', { name: 'Delete Tag' })).not.toBeInTheDocument();
        });

        test('Update saves in place, keeping co-writers, without touching who administers it', async () => {
            renderExisting(tagDoc());
            await screen.findByDisplayValue('Fire');
            fireEvent.change(label(), { target: { value: 'Flame' } });

            fireEvent.click(submit('Update Tag'));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
            const [target, payload] = mockUpdateDoc.mock.calls[0];
            expect(target).toEqual({ __doc: ['tags', 'tag-1'] });
            expect(payload).toMatchObject({ tagInfo: 'Flame', classes: ['Monk'], canWrite: ['user-1', 'co-writer'] });
            expect(payload).not.toHaveProperty('admins');
            await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Tag updated.'));
        });

        test('Delete asks first, then removes the tag and goes back to the list', async () => {
            renderExisting(tagDoc());
            await screen.findByDisplayValue('Fire');

            fireEvent.click(await screen.findByRole('button', { name: 'Delete Tag' }));

            expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Fire'));
            await waitFor(() => expect(mockDeleteDoc).toHaveBeenCalledWith({ __doc: ['tags', 'tag-1'] }));
            await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/tag-list'));
        });

        test('declining the confirmation deletes nothing', async () => {
            window.confirm = jest.fn(() => false);
            renderExisting(tagDoc());
            await screen.findByDisplayValue('Fire');

            fireEvent.click(await screen.findByRole('button', { name: 'Delete Tag' }));

            expect(mockDeleteDoc).not.toHaveBeenCalled();
        });

        test('a failed delete is alerted', async () => {
            mockDeleteDoc.mockRejectedValue(new Error('denied'));
            renderExisting(tagDoc());
            await screen.findByDisplayValue('Fire');

            fireEvent.click(await screen.findByRole('button', { name: 'Delete Tag' }));

            await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to delete tag: denied'));
        });
    });
});
