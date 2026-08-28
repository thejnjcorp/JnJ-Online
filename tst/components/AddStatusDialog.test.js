jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockCollection = jest.fn();
const mockWhere = jest.fn();
const mockOr = jest.fn();
const mockQuery = jest.fn();
const mockGetDocs = jest.fn();
const mockGetDoc = jest.fn();
const mockDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockArrayUnion = jest.fn();
jest.mock('firebase/firestore', () => ({
    collection: (...args) => mockCollection(...args),
    where: (...args) => mockWhere(...args),
    or: (...args) => mockOr(...args),
    query: (...args) => mockQuery(...args),
    getDocs: (...args) => mockGetDocs(...args),
    getDoc: (...args) => mockGetDoc(...args),
    doc: (...args) => mockDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
    arrayUnion: (...args) => mockArrayUnion(...args),
}));

// eslint-disable-next-line import/first
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { AddStatusDialog } from '../../src/components/AddStatusDialog';

const characterPage = { character_id: 'char-1', class: 'Fighter', campaign: 'camp-1', statuses: [] };

const poisoned = {
    id: 'status-poisoned', name: 'Poisoned', polarity: 'debuff', defaultStacks: 3,
    description: 'Takes damage each turn.', effects: [{ stat: 'hp', trigger: 'passive', amount: -1 }],
    isDefault: true, public: true,
};
const wrongClass = { id: 'status-blessed', name: 'Blessed', polarity: 'buff', public: true, isDefault: true, classes: ['Cleric'] };
const wrongCampaign = { id: 'status-cursed', name: 'Cursed', polarity: 'debuff', public: true, isDefault: true, campaignId: 'other-camp' };

function docsFrom(items) {
    return { docs: items.map(item => ({ id: item.id, data: () => item })) };
}

beforeEach(() => {
    mockCollection.mockImplementation((_db, name) => ({ __collection: name }));
    mockWhere.mockImplementation((...args) => ({ __where: args }));
    mockOr.mockImplementation((...args) => ({ __or: args }));
    mockQuery.mockImplementation((...args) => ({ __query: args }));
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockGetDocs.mockResolvedValue(docsFrom([]));
    mockGetDoc.mockResolvedValue({ data: () => ({}) });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockArrayUnion.mockImplementation((value) => ({ __arrayUnion: value }));
    window.alert = jest.fn();
    window.crypto.randomUUID = jest.fn(() => 'new-status-id');
});

afterEach(() => {
    delete window.alert;
});

describe('AddStatusDialog', () => {
    test('with no userId, skips loading presets and defaults to the Custom option', () => {
        render(<AddStatusDialog characterPage={characterPage} userId={undefined} onClose={jest.fn()} />);
        expect(mockGetDocs).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Custom…' })).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Status name')).toBeInTheDocument();
    });

    describe('loading presets', () => {
        test('queries the statuses collection scoped to public/readable/writable', async () => {
            render(<AddStatusDialog characterPage={characterPage} userId="user-1" onClose={jest.fn()} />);
            await waitFor(() => expect(mockGetDocs).toHaveBeenCalled());

            expect(mockCollection).toHaveBeenCalledWith({}, 'statuses');
            expect(mockWhere).toHaveBeenCalledWith('public', '==', true);
            expect(mockWhere).toHaveBeenCalledWith('canRead', 'array-contains', 'user-1');
            expect(mockWhere).toHaveBeenCalledWith('canWrite', 'array-contains', 'user-1');
        });

        test('an in-scope preset is auto-selected, with its own polarity and default stacks', async () => {
            mockGetDocs.mockResolvedValue(docsFrom([poisoned]));
            render(<AddStatusDialog characterPage={characterPage} userId="user-1" onClose={jest.fn()} />);

            const chip = await screen.findByRole('button', { name: 'Poisoned' });
            expect(chip.className).toMatch(/selected/);
            expect(screen.getByRole('button', { name: 'Debuff' }).className).toMatch(/selected/);
            expect(screen.getByText('3')).toBeInTheDocument(); // stacks stepper display
            expect(screen.getByText('Takes damage each turn.')).toBeInTheDocument();
        });

        test('a preset restricted to a different class is filtered out', async () => {
            mockGetDocs.mockResolvedValue(docsFrom([wrongClass]));
            render(<AddStatusDialog characterPage={characterPage} userId="user-1" onClose={jest.fn()} />);
            await waitFor(() => expect(mockGetDocs).toHaveBeenCalled());
            expect(screen.queryByRole('button', { name: 'Blessed' })).not.toBeInTheDocument();
        });

        test('a preset locked to a different campaign is filtered out', async () => {
            mockGetDocs.mockResolvedValue(docsFrom([wrongCampaign]));
            render(<AddStatusDialog characterPage={characterPage} userId="user-1" onClose={jest.fn()} />);
            await waitFor(() => expect(mockGetDocs).toHaveBeenCalled());
            expect(screen.queryByRole('button', { name: 'Cursed' })).not.toBeInTheDocument();
        });

        test('the Custom option is always appended after any presets', async () => {
            mockGetDocs.mockResolvedValue(docsFrom([poisoned]));
            render(<AddStatusDialog characterPage={characterPage} userId="user-1" onClose={jest.fn()} />);
            await screen.findByRole('button', { name: 'Poisoned' });
            expect(screen.getByRole('button', { name: 'Custom…' })).toBeInTheDocument();
        });

        test('a failed campaign-doc lookup is swallowed and still loads presets', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            mockGetDoc.mockRejectedValue(new Error('offline'));
            mockGetDocs.mockResolvedValue(docsFrom([poisoned]));
            render(<AddStatusDialog characterPage={characterPage} userId="user-1" onClose={jest.fn()} />);

            expect(await screen.findByRole('button', { name: 'Poisoned' })).toBeInTheDocument();
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('stacks stepper', () => {
        test('increments and decrements, clamped between 0 and 9', () => {
            render(<AddStatusDialog characterPage={characterPage} userId={undefined} onClose={jest.fn()} />);
            const [minus, plus] = screen.getAllByRole('button', { name: /^[−+]$/ });

            fireEvent.click(minus); // already 0, stays 0
            expect(screen.getByText('0')).toBeInTheDocument();

            for (let i = 0; i < 10; i++) fireEvent.click(plus);
            expect(screen.getByText('9')).toBeInTheDocument();

            fireEvent.click(minus);
            expect(screen.getByText('8')).toBeInTheDocument();
        });
    });

    describe('polarity chips', () => {
        test('clicking a chip selects it', () => {
            render(<AddStatusDialog characterPage={characterPage} userId={undefined} onClose={jest.fn()} />);
            expect(screen.getByRole('button', { name: 'Neutral' }).className).toMatch(/selected/);

            fireEvent.click(screen.getByRole('button', { name: 'Buff' }));

            expect(screen.getByRole('button', { name: 'Buff' }).className).toMatch(/selected/);
            expect(screen.getByRole('button', { name: 'Neutral' }).className).not.toMatch(/selected/);
        });
    });

    describe('closing', () => {
        test('the scrim calls onClose', () => {
            const onClose = jest.fn();
            render(<AddStatusDialog characterPage={characterPage} userId={undefined} onClose={onClose} />);
            fireEvent.click(screen.getByRole('button', { name: 'Close' }));
            expect(onClose).toHaveBeenCalled();
        });

        test('the Cancel button calls onClose', () => {
            const onClose = jest.fn();
            render(<AddStatusDialog characterPage={characterPage} userId={undefined} onClose={onClose} />);
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('confirming a custom status', () => {
        test('a blank name alerts and does not submit', () => {
            const onClose = jest.fn();
            render(<AddStatusDialog characterPage={characterPage} userId={undefined} onClose={onClose} />);

            fireEvent.click(screen.getByRole('button', { name: 'Add Status' }));

            expect(window.alert).toHaveBeenCalledWith('Give this status a name.');
            expect(onClose).not.toHaveBeenCalled();
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        test('with no onUpdateStatuses prop, writes the new status via updateDoc and closes', async () => {
            const onClose = jest.fn();
            render(<AddStatusDialog characterPage={characterPage} userId={undefined} onClose={onClose} />);
            fireEvent.change(screen.getByPlaceholderText('Status name'), { target: { value: 'Frozen' } });
            fireEvent.change(screen.getByPlaceholderText('What does it do?'), { target: { value: "Can't move." } });
            fireEvent.click(screen.getByRole('button', { name: 'Debuff' }));

            fireEvent.click(screen.getByRole('button', { name: 'Add Status' }));

            await waitFor(() => expect(onClose).toHaveBeenCalled());
            expect(mockUpdateDoc).toHaveBeenCalledWith(
                { __doc: ['characters', 'char-1'] },
                { statuses: { __arrayUnion: {
                    id: 'new-status-id', name: 'Frozen', polarity: 'debuff', stacks: 0, description: "Can't move.",
                    effects: [], decaysPerTurn: false, grantedAction: null,
                } } },
            );
        });

        test('with an onUpdateStatuses prop, calls it instead of writing to Firestore', async () => {
            const onClose = jest.fn();
            const onUpdateStatuses = jest.fn().mockResolvedValue(undefined);
            render(<AddStatusDialog characterPage={characterPage} userId={undefined} onClose={onClose} onUpdateStatuses={onUpdateStatuses} />);
            fireEvent.change(screen.getByPlaceholderText('Status name'), { target: { value: 'Frozen' } });

            fireEvent.click(screen.getByRole('button', { name: 'Add Status' }));

            await waitFor(() => expect(onClose).toHaveBeenCalled());
            expect(onUpdateStatuses).toHaveBeenCalledWith([expect.objectContaining({ id: 'new-status-id', name: 'Frozen' })]);
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        test('a write error alerts and leaves the dialog open', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            const onClose = jest.fn();
            render(<AddStatusDialog characterPage={characterPage} userId={undefined} onClose={onClose} />);
            fireEvent.change(screen.getByPlaceholderText('Status name'), { target: { value: 'Frozen' } });

            fireEvent.click(screen.getByRole('button', { name: 'Add Status' }));

            await waitFor(() => expect(window.alert).toHaveBeenCalled());
            expect(onClose).not.toHaveBeenCalled();
        });
    });

    describe('confirming a preset status', () => {
        test('builds the new status from the preset, including its effects and sourceStatusId', async () => {
            mockGetDocs.mockResolvedValue(docsFrom([poisoned]));
            const onClose = jest.fn();
            render(<AddStatusDialog characterPage={characterPage} userId="user-1" onClose={onClose} />);
            await screen.findByRole('button', { name: 'Poisoned' });

            fireEvent.click(screen.getByRole('button', { name: 'Add Status' }));

            await waitFor(() => expect(onClose).toHaveBeenCalled());
            expect(mockUpdateDoc).toHaveBeenCalledWith(
                { __doc: ['characters', 'char-1'] },
                { statuses: { __arrayUnion: {
                    id: 'new-status-id', name: 'Poisoned', polarity: 'debuff', stacks: 3,
                    description: 'Takes damage each turn.', effects: poisoned.effects,
                    decaysPerTurn: false, grantedAction: null, sourceStatusId: 'status-poisoned',
                } } },
            );
        });

        test('switching to a different preset resets polarity and stacks to its own defaults', async () => {
            const blessed = { id: 'status-blessed', name: 'Blessed', polarity: 'buff', defaultStacks: 1, public: true, isDefault: true };
            mockGetDocs.mockResolvedValue(docsFrom([poisoned, blessed]));
            render(<AddStatusDialog characterPage={characterPage} userId="user-1" onClose={jest.fn()} />);
            await screen.findByRole('button', { name: 'Poisoned' });

            fireEvent.click(screen.getByRole('button', { name: 'Blessed' }));

            expect(screen.getByRole('button', { name: 'Buff' }).className).toMatch(/selected/);
            expect(screen.getByText('1')).toBeInTheDocument();
        });
    });
});
