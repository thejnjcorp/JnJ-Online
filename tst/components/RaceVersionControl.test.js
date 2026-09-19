jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockDoc = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
}));

const mockListRaceVersions = jest.fn();
jest.mock('../../src/utils/raceVersions', () => ({
    listRaceVersions: (...args) => mockListRaceVersions(...args),
}));

// eslint-disable-next-line import/first
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
// eslint-disable-next-line import/first
import { RaceVersionControl } from '../../src/components/RaceVersionControl';

const character = { character_id: 'char-1', race_id: 'kobold', race_version: 1, race_name: 'Kobold', canWrite: ['user-1'] };
const versions = [
    { version: 2, notes: 'More scales', publishedAt: null },
    { version: 1, notes: '', publishedAt: null },
];

beforeEach(() => {
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockUpdateDoc.mockResolvedValue(undefined);
    mockListRaceVersions.mockResolvedValue(versions);
});

describe('RaceVersionControl', () => {
    test('renders nothing for a character that is not linked to a race', () => {
        const { container } = render(<RaceVersionControl characterPage={{ race_name: 'Kobold' }} userId="user-1" status="unlinked" latestVersion={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    test('shows the pinned race version and flags a newer one', () => {
        render(<RaceVersionControl characterPage={character} userId="user-1" status="ready" latestVersion={2} />);

        expect(screen.getByRole('button', { name: /Race v1/ })).toBeInTheDocument();
        expect(screen.getByText('v2 available')).toBeInTheDocument();
    });

    test('upgrading writes race_version (not class_version) to the character', async () => {
        render(<RaceVersionControl characterPage={character} userId="user-1" status="ready" latestVersion={2} />);

        fireEvent.click(screen.getByRole('button', { name: /Race v1/ }));
        const dialog = await screen.findByRole('dialog', { name: 'Race versions' });
        expect(within(dialog).getByText('Kobold versions')).toBeInTheDocument();
        fireEvent.click(await within(dialog).findByRole('button', { name: 'Upgrade to this' }));

        await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { race_version: 2 }));
        expect(mockListRaceVersions).toHaveBeenCalledWith('kobold');
    });

    test('a race that cannot be read shows that the saved copy is in use', () => {
        render(<RaceVersionControl characterPage={character} userId="user-1" status="fallback" latestVersion={null} />);
        expect(screen.getByText(/Race not available/)).toBeInTheDocument();
    });

    test('people who cannot write to the character get no switch buttons', async () => {
        render(<RaceVersionControl characterPage={character} userId="stranger" status="ready" latestVersion={2} />);

        fireEvent.click(screen.getByRole('button', { name: /Race v1/ }));
        await screen.findByText('v2');
        expect(screen.queryByRole('button', { name: 'Upgrade to this' })).not.toBeInTheDocument();
    });
});
