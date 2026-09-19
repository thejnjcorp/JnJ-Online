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
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

        test('a preset with no stack count (-1) shows "None" and is added with stacks -1', async () => {
            mockGetDocs.mockResolvedValue(docsFrom([{ ...poisoned, defaultStacks: -1 }]));
            const onUpdateStatuses = jest.fn().mockResolvedValue(undefined);
            render(<AddStatusDialog characterPage={characterPage} userId="user-1" onClose={jest.fn()} onUpdateStatuses={onUpdateStatuses} />);

            await screen.findByRole('button', { name: 'Poisoned' });
            expect(screen.getByText('None')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Add Status' }));

            await waitFor(() => expect(onUpdateStatuses).toHaveBeenCalled());
            expect(onUpdateStatuses.mock.calls[0][0].at(-1).stacks).toBe(-1);
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
        test('increments and decrements, clamped between "None" (-1) and 9', () => {
            render(<AddStatusDialog characterPage={characterPage} userId={undefined} onClose={jest.fn()} />);
            const [minus, plus] = screen.getAllByRole('button', { name: /^[−+]$/ });
            expect(screen.getByText('0')).toBeInTheDocument();

            fireEvent.click(minus); // 0 -> no stack count
            expect(screen.getByText('None')).toBeInTheDocument();
            fireEvent.click(minus); // can't go lower
            expect(screen.getByText('None')).toBeInTheDocument();

            fireEvent.click(plus);
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
            expect(screen.getByRole('button', { name: 'Blessed' }).className).toMatch(/selected/); // the first by name

            fireEvent.click(screen.getByRole('button', { name: 'Poisoned' }));

            expect(screen.getByRole('button', { name: 'Debuff' }).className).toMatch(/selected/);
            expect(screen.getByText('3')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Blessed' }));

            expect(screen.getByRole('button', { name: 'Buff' }).className).toMatch(/selected/);
            expect(screen.getByText('1')).toBeInTheDocument();
        });
    });

    describe('class-specific statuses', () => {
        const stance = { id: 'status-stance', name: 'Stance: Heartstealer', polarity: 'token', defaultStacks: -1, description: 'In the stance.', classes: ['Fighter'], public: true, isDefault: true, effects: [{ stat: 'base_armor_class', trigger: 'passive', mode: 'flat', delta: 5 }] };
        const rage = { id: 'status-rage', name: 'Rage', polarity: 'buff', defaultStacks: 1, classes: ['Fighter'], public: true, isDefault: true };

        test('get their own section, above the general ones, named for the class', async () => {
            mockGetDocs.mockResolvedValue(docsFrom([poisoned, stance, rage]));
            render(<AddStatusDialog characterPage={characterPage} userId="user-1" onClose={jest.fn()} />);
            await screen.findByRole('button', { name: 'Rage' });

            const classSection = screen.getByText('Fighter statuses').parentElement;
            const generalSection = screen.getByText('General statuses').parentElement;
            expect(within(classSection).getAllByRole('button').map(b => b.textContent)).toEqual(['Rage', 'Stance: Heartstealer']);
            expect(within(generalSection).getAllByRole('button').map(b => b.textContent)).toEqual(['Poisoned', 'Custom…']);
            expect(classSection.compareDocumentPosition(generalSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
            expect(screen.queryByText('Choose a status')).not.toBeInTheDocument();
        });

        test('use the character\'s class_name when it has one', async () => {
            mockGetDocs.mockResolvedValue(docsFrom([rage]));
            render(<AddStatusDialog characterPage={{ ...characterPage, class: 'Old', class_name: 'Fighter' }} userId="user-1" onClose={jest.fn()} />);
            await screen.findByRole('button', { name: 'Rage' });
            expect(screen.getByText('Fighter statuses')).toBeInTheDocument();
        });

        test('the first class-specific status is the one selected to begin with', async () => {
            mockGetDocs.mockResolvedValue(docsFrom([poisoned, stance, rage]));
            render(<AddStatusDialog characterPage={characterPage} userId="user-1" onClose={jest.fn()} />);
            await screen.findByRole('button', { name: 'Rage' });
            expect(screen.getByRole('button', { name: 'Rage' }).className).toMatch(/selected/);
        });

        test('with none for this class there is a single "Choose a status" list', async () => {
            mockGetDocs.mockResolvedValue(docsFrom([poisoned, wrongClass]));
            render(<AddStatusDialog characterPage={characterPage} userId="user-1" onClose={jest.fn()} />);
            await screen.findByRole('button', { name: 'Poisoned' });
            expect(screen.getByText('Choose a status')).toBeInTheDocument();
            expect(screen.queryByText('General statuses')).not.toBeInTheDocument();
            expect(screen.queryByText('Fighter statuses')).not.toBeInTheDocument();
        });

        test('a status for a different class stays out of both sections', async () => {
            mockGetDocs.mockResolvedValue(docsFrom([rage, wrongClass]));
            render(<AddStatusDialog characterPage={characterPage} userId="user-1" onClose={jest.fn()} />);
            await screen.findByRole('button', { name: 'Rage' });
            expect(screen.queryByRole('button', { name: 'Blessed' })).not.toBeInTheDocument();
        });
    });

    describe('Token statuses', () => {
        const stance = { id: 'status-stance', name: 'Stance: Heartstealer', polarity: 'token', defaultStacks: -1, description: 'In the stance.', public: true, isDefault: true, effects: [{ stat: 'base_armor_class', trigger: 'passive', mode: 'flat', delta: 5 }], decaysPerTurn: true, grantedAction: { actionName: 'Free hit' } };

        test('Token is one of the types to pick from', () => {
            render(<AddStatusDialog characterPage={characterPage} userId={undefined} onClose={jest.fn()} />);
            fireEvent.click(screen.getByRole('button', { name: 'Token' }));
            expect(screen.getByRole('button', { name: 'Token' }).className).toMatch(/selected/);
        });

        test('a Token preset is selected as a token', async () => {
            mockGetDocs.mockResolvedValue(docsFrom([stance]));
            render(<AddStatusDialog characterPage={characterPage} userId="user-1" onClose={jest.fn()} />);
            await screen.findByRole('button', { name: 'Stance: Heartstealer' });
            expect(screen.getByRole('button', { name: 'Token' }).className).toMatch(/selected/);
        });

        test('is added with no effects, no action and no countdown, whatever its preset had', async () => {
            mockGetDocs.mockResolvedValue(docsFrom([stance]));
            const onUpdateStatuses = jest.fn().mockResolvedValue(undefined);
            render(<AddStatusDialog characterPage={characterPage} userId="user-1" onClose={jest.fn()} onUpdateStatuses={onUpdateStatuses} />);
            await screen.findByRole('button', { name: 'Stance: Heartstealer' });

            fireEvent.click(screen.getByRole('button', { name: 'Add Status' }));

            await waitFor(() => expect(onUpdateStatuses).toHaveBeenCalled());
            expect(onUpdateStatuses.mock.calls[0][0].at(-1)).toMatchObject({ polarity: 'token', effects: [], decaysPerTurn: false, grantedAction: null });
        });

        test('changing a mechanical preset to Token drops its effects', async () => {
            mockGetDocs.mockResolvedValue(docsFrom([poisoned]));
            const onUpdateStatuses = jest.fn().mockResolvedValue(undefined);
            render(<AddStatusDialog characterPage={characterPage} userId="user-1" onClose={jest.fn()} onUpdateStatuses={onUpdateStatuses} />);
            await screen.findByRole('button', { name: 'Poisoned' });

            fireEvent.click(screen.getByRole('button', { name: 'Token' }));
            fireEvent.click(screen.getByRole('button', { name: 'Add Status' }));

            await waitFor(() => expect(onUpdateStatuses).toHaveBeenCalled());
            expect(onUpdateStatuses.mock.calls[0][0].at(-1)).toMatchObject({ polarity: 'token', effects: [] });
        });
    });

    describe('status colors', () => {
        const inspired = { id: 'status-inspired', name: 'Inspired', polarity: 'buff', defaultStacks: 1, public: true, isDefault: true, color: '#f5a623' };

        test('start on the type\'s color for a status with none of its own', async () => {
            mockGetDocs.mockResolvedValue(docsFrom([poisoned]));
            render(<AddStatusDialog characterPage={characterPage} userId="user-1" onClose={jest.fn()} />);
            await screen.findByRole('button', { name: 'Poisoned' });
            expect(screen.getByText("Using the color of its type")).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: "Use the type's color" })).not.toBeInTheDocument();
        });

        test('a preset with a color starts on it, and the chosen chip shows it', async () => {
            mockGetDocs.mockResolvedValue(docsFrom([inspired]));
            render(<AddStatusDialog characterPage={characterPage} userId="user-1" onClose={jest.fn()} />);
            const chip = await screen.findByRole('button', { name: 'Inspired' });
            expect(screen.getByLabelText('Status color')).toHaveValue('#f5a623');
            expect(chip.style.getPropertyValue('--status-color')).toBe('#f5a623');
        });

        test('picking a color adds it to the status', async () => {
            const onUpdateStatuses = jest.fn().mockResolvedValue(undefined);
            render(<AddStatusDialog characterPage={characterPage} userId={undefined} onClose={jest.fn()} onUpdateStatuses={onUpdateStatuses} />);
            fireEvent.change(screen.getByPlaceholderText('Status name'), { target: { value: 'Glowing' } });
            fireEvent.change(screen.getByLabelText('Status color'), { target: { value: '#1abc9c' } });

            fireEvent.click(screen.getByRole('button', { name: 'Add Status' }));

            await waitFor(() => expect(onUpdateStatuses).toHaveBeenCalled());
            expect(onUpdateStatuses.mock.calls[0][0].at(-1).color).toBe('#1abc9c');
        });

        test('"Use the type\'s color" takes a preset\'s color off again', async () => {
            mockGetDocs.mockResolvedValue(docsFrom([inspired]));
            const onUpdateStatuses = jest.fn().mockResolvedValue(undefined);
            render(<AddStatusDialog characterPage={characterPage} userId="user-1" onClose={jest.fn()} onUpdateStatuses={onUpdateStatuses} />);
            await screen.findByRole('button', { name: 'Inspired' });

            fireEvent.click(screen.getByRole('button', { name: "Use the type's color" }));
            fireEvent.click(screen.getByRole('button', { name: 'Add Status' }));

            await waitFor(() => expect(onUpdateStatuses).toHaveBeenCalled());
            expect(onUpdateStatuses.mock.calls[0][0].at(-1)).not.toHaveProperty('color');
        });

        test('a status with no color chosen is added without a color field', async () => {
            const onUpdateStatuses = jest.fn().mockResolvedValue(undefined);
            render(<AddStatusDialog characterPage={characterPage} userId={undefined} onClose={jest.fn()} onUpdateStatuses={onUpdateStatuses} />);
            fireEvent.change(screen.getByPlaceholderText('Status name'), { target: { value: 'Plain' } });
            fireEvent.click(screen.getByRole('button', { name: 'Add Status' }));

            await waitFor(() => expect(onUpdateStatuses).toHaveBeenCalled());
            expect(onUpdateStatuses.mock.calls[0][0].at(-1)).not.toHaveProperty('color');
        });

        test('switching to a preset without a color clears the previous one', async () => {
            mockGetDocs.mockResolvedValue(docsFrom([inspired, poisoned]));
            render(<AddStatusDialog characterPage={characterPage} userId="user-1" onClose={jest.fn()} />);
            await screen.findByRole('button', { name: 'Inspired' });

            fireEvent.click(screen.getByRole('button', { name: 'Poisoned' }));

            expect(screen.getByText("Using the color of its type")).toBeInTheDocument();
        });
    });
});
