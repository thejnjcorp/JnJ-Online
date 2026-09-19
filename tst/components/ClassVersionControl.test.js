jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockDoc = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
}));

const mockListClassVersions = jest.fn();
jest.mock('../../src/utils/classVersions', () => ({
    listClassVersions: (...args) => mockListClassVersions(...args),
}));

// eslint-disable-next-line import/first
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
// eslint-disable-next-line import/first
import { ClassVersionControl } from '../../src/components/ClassVersionControl';

const character = { character_id: 'char-1', class_id: 'monk', class_version: 2, class_name: 'Monk', canWrite: ['user-1'] };
const versions = [
    { version: 3, notes: 'Added Fleetfoot', publishedAt: null },
    { version: 2, notes: 'Rebalanced', publishedAt: null },
    { version: 1, notes: '', publishedAt: null },
];

beforeEach(() => {
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockUpdateDoc.mockResolvedValue(undefined);
    mockListClassVersions.mockResolvedValue(versions);
});

describe('ClassVersionControl', () => {
    test('renders nothing for a character that is not linked to a class', () => {
        const { container } = render(<ClassVersionControl characterPage={{ class_name: 'Old' }} userId="user-1" status="unlinked" latestVersion={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    test('shows the pinned version', () => {
        render(<ClassVersionControl characterPage={character} userId="user-1" status="ready" latestVersion={2} />);

        expect(screen.getByRole('button', { name: 'Class v2' })).toBeInTheDocument();
        expect(screen.queryByText(/available/)).not.toBeInTheDocument();
    });

    test('flags when a newer version exists', () => {
        render(<ClassVersionControl characterPage={character} userId="user-1" status="ready" latestVersion={3} />);
        expect(screen.getByText('v3 available')).toBeInTheDocument();
    });

    test('when the class could not be read, says the saved copy is being shown instead of offering versions', () => {
        render(<ClassVersionControl characterPage={character} userId="user-1" status="fallback" latestVersion={null} />);

        expect(screen.getByText(/saved copy/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Class v/ })).not.toBeInTheDocument();
    });

    test('opening it loads and lists the class\'s versions with their notes', async () => {
        render(<ClassVersionControl characterPage={character} userId="user-1" status="ready" latestVersion={3} />);

        fireEvent.click(screen.getByRole('button', { name: /Class v2/ }));

        expect(await screen.findByText('Added Fleetfoot')).toBeInTheDocument();
        expect(screen.getByText('Rebalanced')).toBeInTheDocument();
        expect(mockListClassVersions).toHaveBeenCalledWith('monk');
    });

    test('a writer can move up to a newer version, which pins the character to it', async () => {
        render(<ClassVersionControl characterPage={character} userId="user-1" status="ready" latestVersion={3} />);
        fireEvent.click(screen.getByRole('button', { name: /Class v2/ }));

        fireEvent.click(await screen.findByRole('button', { name: 'Upgrade to this' }));

        await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { class_version: 3 }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); // closes once the switch lands
    });

    test('a writer can also go back down to an older version', async () => {
        render(<ClassVersionControl characterPage={character} userId="user-1" status="ready" latestVersion={3} />);
        fireEvent.click(screen.getByRole('button', { name: /Class v2/ }));

        fireEvent.click(await screen.findByRole('button', { name: 'Switch back to this' }));

        await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { class_version: 1 }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    test('the version the character is already on has no switch button', async () => {
        render(<ClassVersionControl characterPage={character} userId="user-1" status="ready" latestVersion={3} />);
        fireEvent.click(screen.getByRole('button', { name: /Class v2/ }));

        await screen.findByText('Rebalanced');
        expect(screen.getAllByRole('button', { name: /Upgrade to this|Switch back to this/ })).toHaveLength(2);
    });

    test('someone who cannot edit the character can look but not switch', async () => {
        render(<ClassVersionControl characterPage={character} userId="someone-else" status="ready" latestVersion={3} />);
        fireEvent.click(screen.getByRole('button', { name: /Class v2/ }));

        await screen.findByText('Added Fleetfoot');
        expect(screen.getByText(/Only people who can edit this character/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Upgrade to this|Switch back to this/ })).not.toBeInTheDocument();
    });

    test('a failed load of the version list is reported', async () => {
        mockListClassVersions.mockRejectedValue(new Error('denied'));
        render(<ClassVersionControl characterPage={character} userId="user-1" status="ready" latestVersion={3} />);

        fireEvent.click(screen.getByRole('button', { name: /Class v2/ }));

        expect(await screen.findByText(/Couldn't load this class's versions/)).toBeInTheDocument();
    });

    test('a failed switch is reported and the dialog stays open', async () => {
        mockUpdateDoc.mockRejectedValue(new Error('offline'));
        render(<ClassVersionControl characterPage={character} userId="user-1" status="ready" latestVersion={3} />);
        fireEvent.click(screen.getByRole('button', { name: /Class v2/ }));

        fireEvent.click(await screen.findByRole('button', { name: 'Upgrade to this' }));

        expect(await screen.findByText('offline')).toBeInTheDocument();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    test('Close dismisses the dialog', async () => {
        render(<ClassVersionControl characterPage={character} userId="user-1" status="ready" latestVersion={3} />);
        fireEvent.click(screen.getByRole('button', { name: /Class v2/ }));
        await screen.findByText('Rebalanced');

        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('clicking the backdrop dismisses the dialog too', async () => {
        render(<ClassVersionControl characterPage={character} userId="user-1" status="ready" latestVersion={3} />);
        fireEvent.click(screen.getByRole('button', { name: /Class v2/ }));
        await screen.findByText('Rebalanced');

        fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
