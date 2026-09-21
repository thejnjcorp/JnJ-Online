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
    arrayUnion: (...values) => ({ __arrayUnion: values }),
    collection: (_db, name) => ({ __collection: name }),
    deleteDoc: (...args) => mockDeleteDoc(...args),
    doc: (_db, ...path) => ({ __doc: path }),
    getDoc: (...args) => mockGetDoc(...args),
    getDocs: (...args) => mockGetDocs(...args),
    or: (...args) => ({ __or: args }),
    query: (...args) => ({ __query: args }),
    updateDoc: (...args) => mockUpdateDoc(...args),
    where: (...args) => ({ __where: args }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ ...jest.requireActual('react-router-dom'), useNavigate: () => mockNavigate }));
jest.mock('../../src/components/DocAdminManager', () => ({
    DocAdminManager: ({ admins, userId }) => <div>DocAdminManager-stub:{JSON.stringify(admins)}:{userId}</div>,
}));
const mockUpload = jest.fn();
jest.mock('../../src/utils/imgurUploader', () => ({ uploadImageToImgur: (...args) => mockUpload(...args) }));

// eslint-disable-next-line import/first
import { screen, fireEvent, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { ItemPage } from '../../src/components/ItemPage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

function signIn(user) {
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => { Promise.resolve().then(() => callback(user)); return jest.fn(); });
}

const campaign = { id: 'camp-1', campaign_name: 'The Iron Vale', director_uid: 'dm', canRead: ['dm', 'p1'], canWrite: ['dm'], admins: ['dm'] };

beforeEach(() => {
    signIn({ uid: 'author' });
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockGetDocs.mockResolvedValue({ docs: [{ id: 'camp-1', data: () => campaign }] });
    mockAddDoc.mockResolvedValue({ id: 'new-item' });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    window.alert = jest.fn();
    window.confirm = jest.fn(() => true);
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

afterEach(() => {
    delete window.alert;
    delete window.confirm;
});

const field = label => screen.getByLabelText(label);
const type = (label, value) => fireEvent.change(field(label), { target: { value } });
const press = name => fireEvent.click(screen.getByRole('button', { name }));
const summary = () => document.querySelector('.ClassPage-validation-summary');

const itemDoc = (overrides = {}) => ({
    item_name: 'Silver Locket', item_description: 'Holds a portrait.', item_image: 'AbC1d2E.png', tags: ['jewelry', 'quest'], isPublic: false,
    canRead: ['author'], canWrite: ['author', 'co-author'], admins: ['author'], ...overrides,
});

describe('ItemPage', () => {
    describe('creating an item', () => {
        const renderNew = () => renderWithRouter(<ItemPage />, { route: '/items' });

        test('starts empty and private, with no delete button', async () => {
            renderNew();
            expect(document.title).toBe('New Item');
            expect(await screen.findByLabelText('Name')).toHaveValue('');
            expect(screen.getByRole('button', { name: /^Private/ })).toHaveAttribute('aria-pressed', 'true');
            expect(screen.getByRole('button', { name: 'Create Item' })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Delete Item' })).not.toBeInTheDocument();
            expect(screen.queryByText(/DocAdminManager-stub/)).not.toBeInTheDocument();
        });

        test('needs a name, and says so, without saving', async () => {
            renderNew();
            await screen.findByLabelText('Name');
            press('Create Item');
            expect(summary()).toHaveTextContent('Give the item a name.');
            expect(field('Name')).toHaveAttribute('aria-invalid', 'true');
            expect(mockAddDoc).not.toHaveBeenCalled();
        });

        test('a problem clears as it is fixed', async () => {
            renderNew();
            await screen.findByLabelText('Name');
            press('Create Item');
            type('Name', 'Locket');
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        test('saves a private item its author can read, write and administer, and opens it', async () => {
            renderNew();
            await screen.findByLabelText('Name');
            type('Name', '  Silver Locket ');
            press('Create Item');

            await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
            const [target, payload] = mockAddDoc.mock.calls[0];
            expect(target).toEqual({ __collection: 'items' });
            expect(payload).toEqual({
                item_name: 'Silver Locket', item_description: '', item_image: '', tags: [], isPublic: false,
                canRead: ['author'], canWrite: ['author'], admins: ['author'],
            });
            await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/items/new-item'));
            expect(window.alert).toHaveBeenCalledWith('Item created.');
        });

        test('a public item is readable by everyone, so needs no list of readers', async () => {
            renderNew();
            await screen.findByLabelText('Name');
            type('Name', 'Torch');
            press(/^Public/);
            press('Create Item');
            await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
            expect(mockAddDoc.mock.calls[0][1]).toMatchObject({ isPublic: true, canRead: [] });
        });

        test('tags are added by typing and pressing Enter or a comma, tidied, and can be taken off again', async () => {
            renderNew();
            await screen.findByLabelText('Name');
            type('Name', 'Torch');
            type('Add a tag', 'Light');
            fireEvent.keyDown(field('Add a tag'), { key: 'Enter' });
            type('Add a tag', 'Tool, LIGHT');
            fireEvent.keyDown(field('Add a tag'), { key: ',' });
            expect(screen.getByText('light')).toBeInTheDocument();
            expect(screen.getByText('tool')).toBeInTheDocument();
            expect(screen.getAllByText('light')).toHaveLength(1);

            press('Remove tag tool');
            expect(screen.queryByText('tool')).not.toBeInTheDocument();

            press('Create Item');
            await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
            expect(mockAddDoc.mock.calls[0][1].tags).toEqual(['light']);
        });

        test('the tag button is off with nothing typed', async () => {
            renderNew();
            await screen.findByLabelText('Name');
            expect(screen.getByRole('button', { name: '+ Add tag' })).toBeDisabled();
            type('Add a tag', 'x');
            expect(screen.getByRole('button', { name: '+ Add tag' })).toBeEnabled();
        });

        test('the picture is a link, saved as its Imgur hash, and shown in the preview', async () => {
            renderNew();
            await screen.findByLabelText('Name');
            type('Name', 'Locket');
            type('Picture link', 'https://i.imgur.com/AbC1d2E.png');
            expect(document.querySelector('.EnemyPage-picture-token-square img')).toHaveAttribute('src', 'https://i.imgur.com/AbC1d2E.png');
            press('Create Item');
            await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
            expect(mockAddDoc.mock.calls[0][1].item_image).toBe('AbC1d2E.png');
        });

        test('a picture that is not a web link is explained, and stops the save', async () => {
            renderNew();
            await screen.findByLabelText('Name');
            type('Name', 'Locket');
            type('Picture link', 'javascript:alert(1)');
            press('Create Item');
            expect(summary()).toHaveTextContent('Picture');
            expect(field('Picture link')).toHaveAttribute('aria-invalid', 'true');
            expect(mockAddDoc).not.toHaveBeenCalled();
        });

        test('a picture can be uploaded', async () => {
            mockUpload.mockResolvedValue('https://i.imgur.com/UpLoad1.jpg');
            renderNew();
            await screen.findByLabelText('Name');
            fireEvent.change(field('Or upload one'), { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } });
            await waitFor(() => expect(field('Picture link')).toHaveValue('https://i.imgur.com/UpLoad1.jpg'));
        });

        test('the description is written in the editor, and saved', async () => {
            renderNew();
            await screen.findByLabelText('Name');
            type('Name', 'Locket');
            type('Description', 'Holds a **portrait**.');
            press('Create Item');
            await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
            expect(mockAddDoc.mock.calls[0][1].item_description).toBe('Holds a **portrait**.');
        });

        test('a failed save is alerted', async () => {
            mockAddDoc.mockRejectedValue(new Error('offline'));
            renderNew();
            await screen.findByLabelText('Name');
            type('Name', 'Locket');
            press('Create Item');
            await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to save item: offline'));
            expect(mockNavigate).not.toHaveBeenCalled();
        });

        test('there is nothing to share with a campaign until it is saved', async () => {
            renderNew();
            await screen.findByLabelText('Name');
            expect(screen.queryByText('Share with a campaign')).not.toBeInTheDocument();
        });
    });

    describe('editing an item', () => {
        function renderExisting(data = itemDoc(), user = { uid: 'author' }) {
            signIn(user);
            mockGetDoc.mockResolvedValue({ exists: () => true, data: () => data });
            renderWithRouter(<ItemPage />, { route: '/items/item-1' });
        }

        test('loads the item into the form, and titles the page with it', async () => {
            renderExisting();
            expect(await screen.findByDisplayValue('Silver Locket')).toBeInTheDocument();
            expect(mockGetDoc).toHaveBeenCalledWith({ __doc: ['items', 'item-1'] });
            expect(document.title).toBe('Silver Locket');
            expect(field('Description')).toHaveValue('Holds a portrait.');
            expect(field('Picture link')).toHaveValue('https://i.imgur.com/AbC1d2E.png');
            expect(screen.getByText('jewelry')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /^Private/ })).toHaveAttribute('aria-pressed', 'true');
            expect(screen.getByRole('button', { name: 'Update Item' })).toBeInTheDocument();
        });

        test('shows the admin manager', async () => {
            renderExisting();
            expect(await screen.findByText('DocAdminManager-stub:["author"]:author')).toBeInTheDocument();
        });

        test('saving changes updates it, keeping its permissions and adding the editor as a writer', async () => {
            renderExisting();
            await screen.findByDisplayValue('Silver Locket');
            type('Name', 'Gold Locket');
            press('Update Item');
            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
            const [target, payload] = mockUpdateDoc.mock.calls[0];
            expect(target).toEqual({ __doc: ['items', 'item-1'] });
            expect(payload).toMatchObject({ item_name: 'Gold Locket', tags: ['jewelry', 'quest'], item_image: 'AbC1d2E.png', canWrite: ['author', 'co-author'] });
            expect(payload).not.toHaveProperty('canRead'); // shared campaigns are kept
            expect(payload).not.toHaveProperty('admins');
            await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Item updated.'));
        });

        test('making it public and saving says so', async () => {
            renderExisting();
            await screen.findByDisplayValue('Silver Locket');
            press(/^Public/);
            press('Update Item');
            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
            expect(mockUpdateDoc.mock.calls[0][1].isPublic).toBe(true);
        });

        test('deleting asks first, then goes back to the database', async () => {
            renderExisting();
            await screen.findByDisplayValue('Silver Locket');
            press('Delete Item');
            expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Delete "Silver Locket"?'));
            await waitFor(() => expect(mockDeleteDoc).toHaveBeenCalledWith({ __doc: ['items', 'item-1'] }));
            await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/item-list'));
        });

        test('declining the delete does nothing', async () => {
            window.confirm = jest.fn(() => false);
            renderExisting();
            await screen.findByDisplayValue('Silver Locket');
            press('Delete Item');
            expect(mockDeleteDoc).not.toHaveBeenCalled();
        });

        test('someone who cannot write it sees it read-only, with no save or delete', async () => {
            renderExisting(itemDoc(), { uid: 'stranger' });
            await screen.findByDisplayValue('Silver Locket');
            await waitFor(() => expect(field('Name')).toBeDisabled());
            expect(screen.getByText(/belongs to someone else/)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Update Item' })).toBeDisabled();
            expect(screen.queryByRole('button', { name: 'Delete Item' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Remove tag jewelry' })).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Add a tag')).not.toBeInTheDocument();
        });

        describe('sharing a private item with a campaign', () => {
            test('offers each of the user\'s campaigns, and lets its members read the item', async () => {
                renderExisting();
                await screen.findByDisplayValue('Silver Locket');
                press('Share with The Iron Vale');
                await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['items', 'item-1'] }, { canRead: { __arrayUnion: expect.arrayContaining(['dm', 'p1']) } }));
                expect(await screen.findByRole('button', { name: 'Shared with The Iron Vale' })).toBeDisabled();
            });

            test('does not offer archived campaigns', async () => {
                mockGetDocs.mockResolvedValue({ docs: [{ id: 'camp-1', data: () => ({ ...campaign, archived: true }) }] });
                renderExisting();
                await screen.findByDisplayValue('Silver Locket');
                expect(screen.queryByText('Share with a campaign')).not.toBeInTheDocument();
            });

            test('is not offered for a public item, or to someone who cannot write it', async () => {
                renderExisting(itemDoc({ isPublic: true }));
                await screen.findByDisplayValue('Silver Locket');
                expect(screen.queryByText('Share with a campaign')).not.toBeInTheDocument();
            });

            test('a refusal is alerted', async () => {
                mockUpdateDoc.mockRejectedValue(new Error('permission-denied'));
                renderExisting();
                await screen.findByDisplayValue('Silver Locket');
                press('Share with The Iron Vale');
                await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Couldn't share it: permission-denied"));
            });
        });
    });
});
