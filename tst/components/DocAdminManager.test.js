jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockArrayRemove = jest.fn();
const mockArrayUnion = jest.fn();
const mockCollection = jest.fn();
const mockDocumentId = jest.fn();
const mockGetCountFromServer = jest.fn();
const mockGetDocs = jest.fn();
const mockQuery = jest.fn();
const mockUpdateDoc = jest.fn();
const mockWhere = jest.fn();
jest.mock('firebase/firestore', () => ({
    arrayRemove: (...args) => mockArrayRemove(...args),
    arrayUnion: (...args) => mockArrayUnion(...args),
    collection: (...args) => mockCollection(...args),
    documentId: (...args) => mockDocumentId(...args),
    getCountFromServer: (...args) => mockGetCountFromServer(...args),
    getDocs: (...args) => mockGetDocs(...args),
    query: (...args) => mockQuery(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
    where: (...args) => mockWhere(...args),
}));

// eslint-disable-next-line import/first
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
// eslint-disable-next-line import/first
import { DocAdminManager } from '../../src/components/DocAdminManager';

const docRef = { __doc: ['classes', 'class-1'] };

function docsFrom(items) {
    return { docs: items.map(item => ({ id: item.id, data: () => item })) };
}

beforeEach(() => {
    mockCollection.mockImplementation((_db, name) => ({ __collection: name }));
    mockWhere.mockImplementation((...args) => ({ __where: args }));
    mockQuery.mockImplementation((...args) => ({ __query: args }));
    mockDocumentId.mockImplementation(() => '__documentId__');
    mockArrayUnion.mockImplementation((value) => ({ __arrayUnion: value }));
    mockArrayRemove.mockImplementation((value) => ({ __arrayRemove: value }));
    mockGetDocs.mockResolvedValue(docsFrom([]));
    mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 1 }) });
    mockUpdateDoc.mockResolvedValue(undefined);
    window.alert = jest.fn();
    window.confirm = jest.fn(() => true);
});

afterEach(() => {
    delete window.alert;
    delete window.confirm;
});

describe('DocAdminManager', () => {
    describe('visibility', () => {
        test('renders nothing for a viewer who is not in admins', () => {
            const { container } = render(<DocAdminManager docRef={docRef} admins={['owner-1']} userId="stranger-1"/>);
            expect(container).toBeEmptyDOMElement();
        });

        test('renders nothing when admins is undefined', () => {
            const { container } = render(<DocAdminManager docRef={docRef} admins={undefined} userId="owner-1"/>);
            expect(container).toBeEmptyDOMElement();
        });

        test('renders for a viewer listed in admins', async () => {
            render(<DocAdminManager docRef={docRef} admins={['owner-1']} userId="owner-1"/>);
            expect(screen.getByText('Admins')).toBeInTheDocument();
            await act(async () => { await Promise.resolve(); });
        });
    });

    describe('name resolution', () => {
        test('shows "Loading…" until player names resolve, then the resolved name', async () => {
            mockGetDocs.mockResolvedValue(docsFrom([{ id: 'owner-1', name: 'Sam' }]));
            render(<DocAdminManager docRef={docRef} admins={['owner-1']} userId="owner-1"/>);
            expect(screen.getByText('Loading…')).toBeInTheDocument();

            expect(await screen.findByText('Sam')).toBeInTheDocument();
            expect(mockWhere).toHaveBeenCalledWith('__documentId__', 'in', ['owner-1']);
        });

        test('falls back to "Unknown Player" for an admin with no matching players doc', async () => {
            mockGetDocs.mockResolvedValue(docsFrom([]));
            render(<DocAdminManager docRef={docRef} admins={['ghost-1']} userId="ghost-1"/>);
            expect(await screen.findByText('Unknown Player')).toBeInTheDocument();
        });

        test('a failed name lookup is logged and swallowed, still showing the fallback', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            mockGetDocs.mockRejectedValue(new Error('offline'));
            render(<DocAdminManager docRef={docRef} admins={['owner-1']} userId="owner-1"/>);
            expect(await screen.findByText('Unknown Player')).toBeInTheDocument();
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        test('shows every admin\'s own uid alongside their name', async () => {
            mockGetDocs.mockResolvedValue(docsFrom([{ id: 'owner-1', name: 'Sam' }]));
            render(<DocAdminManager docRef={docRef} admins={['owner-1']} userId="owner-1"/>);
            await screen.findByText('Sam');
            expect(screen.getByText('owner-1')).toBeInTheDocument();
        });
    });

    describe('promoting a new admin', () => {
        test('Promote to Admin is disabled until an id is entered', async () => {
            render(<DocAdminManager docRef={docRef} admins={['owner-1']} userId="owner-1"/>);
            expect(screen.getByRole('button', { name: 'Promote to Admin' })).toBeDisabled();

            fireEvent.change(screen.getByPlaceholderText('Player ID'), { target: { value: 'new-admin' } });

            expect(screen.getByRole('button', { name: 'Promote to Admin' })).toBeEnabled();
            await act(async () => { await Promise.resolve(); });
        });

        test('promoting someone already in admins is rejected without a Firestore call', async () => {
            render(<DocAdminManager docRef={docRef} admins={['owner-1']} userId="owner-1"/>);
            fireEvent.change(screen.getByPlaceholderText('Player ID'), { target: { value: 'owner-1' } });

            fireEvent.click(screen.getByRole('button', { name: 'Promote to Admin' }));

            expect(window.alert).toHaveBeenCalledWith('That person is already an admin.');
            expect(mockGetCountFromServer).not.toHaveBeenCalled();
            await act(async () => { await Promise.resolve(); });
        });

        test('a nonexistent player id is alerted and not promoted', async () => {
            mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 0 }) });
            render(<DocAdminManager docRef={docRef} admins={['owner-1']} userId="owner-1"/>);
            fireEvent.change(screen.getByPlaceholderText('Player ID'), { target: { value: 'ghost-1' } });

            fireEvent.click(screen.getByRole('button', { name: 'Promote to Admin' }));

            await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Error: player does not exist!'));
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        test('a valid player id is promoted via arrayUnion, clears the input, and calls onChanged', async () => {
            const onChanged = jest.fn();
            render(<DocAdminManager docRef={docRef} admins={['owner-1']} userId="owner-1" onChanged={onChanged}/>);
            fireEvent.change(screen.getByPlaceholderText('Player ID'), { target: { value: 'new-admin' } });

            fireEvent.click(screen.getByRole('button', { name: 'Promote to Admin' }));

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith(docRef, { admins: { __arrayUnion: 'new-admin' } }));
            expect(onChanged).toHaveBeenCalled();
            expect(screen.getByPlaceholderText('Player ID')).toHaveValue('');
        });

        test('a failed promote is alerted', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            render(<DocAdminManager docRef={docRef} admins={['owner-1']} userId="owner-1"/>);
            fireEvent.change(screen.getByPlaceholderText('Player ID'), { target: { value: 'new-admin' } });

            fireEvent.click(screen.getByRole('button', { name: 'Promote to Admin' }));

            await waitFor(() => expect(window.alert).toHaveBeenCalled());
        });
    });

    describe('revoking an admin', () => {
        test('Revoke is disabled when only one admin remains, even for someone else', async () => {
            mockGetDocs.mockResolvedValue(docsFrom([{ id: 'owner-1', name: 'Sam' }]));
            render(<DocAdminManager docRef={docRef} admins={['owner-1']} userId="owner-1"/>);
            await screen.findByText('Sam');
            expect(screen.getByRole('button', { name: 'Revoke' })).toBeDisabled();
        });

        test('confirmed, removes the admin via arrayRemove and calls onChanged', async () => {
            const onChanged = jest.fn();
            mockGetDocs.mockResolvedValue(docsFrom([{ id: 'owner-1', name: 'Sam' }, { id: 'co-admin', name: 'Alex' }]));
            render(<DocAdminManager docRef={docRef} admins={['owner-1', 'co-admin']} userId="owner-1" onChanged={onChanged}/>);
            await screen.findByText('Alex');

            fireEvent.click(screen.getAllByRole('button', { name: 'Revoke' })[1]);

            await waitFor(() => expect(onChanged).toHaveBeenCalled());
            expect(mockUpdateDoc).toHaveBeenCalledWith(docRef, { admins: { __arrayRemove: 'co-admin' } });
        });

        test('declined via confirm, revokes nothing', async () => {
            window.confirm = jest.fn(() => false);
            mockGetDocs.mockResolvedValue(docsFrom([{ id: 'owner-1', name: 'Sam' }, { id: 'co-admin', name: 'Alex' }]));
            render(<DocAdminManager docRef={docRef} admins={['owner-1', 'co-admin']} userId="owner-1"/>);
            await screen.findByText('Alex');

            fireEvent.click(screen.getAllByRole('button', { name: 'Revoke' })[1]);

            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        test('a failed revoke is alerted', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            mockGetDocs.mockResolvedValue(docsFrom([{ id: 'owner-1', name: 'Sam' }, { id: 'co-admin', name: 'Alex' }]));
            render(<DocAdminManager docRef={docRef} admins={['owner-1', 'co-admin']} userId="owner-1"/>);
            await screen.findByText('Alex');

            fireEvent.click(screen.getAllByRole('button', { name: 'Revoke' })[1]);

            await waitFor(() => expect(window.alert).toHaveBeenCalled());
        });
    });
});
