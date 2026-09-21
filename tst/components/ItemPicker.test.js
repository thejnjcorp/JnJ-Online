jest.mock('../../src/utils/firebase', () => ({ db: {}, auth: {} }));

const mockAddDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    collection: (_db, name) => ({ __collection: name }),
    addDoc: (...args) => mockAddDoc(...args),
}));

const mockReload = jest.fn();
let mockCatalog;
jest.mock('../../src/utils/useItems', () => ({ useItemCatalog: () => ({ ...mockCatalog, reload: mockReload }) }));

// eslint-disable-next-line import/first
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { ItemPicker } from '../../src/components/ItemPicker';

const torch = { id: 'torch', item_name: 'Torch', item_description: 'Burns for an hour.', item_image: 'AbC1d2E.png', tags: ['light'] };
const rope = { id: 'rope', item_name: 'Rope', item_description: 'Fifty feet of hemp.', tags: ['tool'] };
const draw = (props = {}) => {
    const handlers = { onPick: jest.fn().mockResolvedValue(undefined), onClose: jest.fn() };
    render(<ItemPicker userId="user-1" shareWith={['user-1', 'friend']} {...handlers} {...props}/>);
    return handlers;
};

beforeEach(() => {
    mockCatalog = { items: [rope, torch], status: 'ready' };
    mockAddDoc.mockResolvedValue({ id: 'made' });
});

describe('ItemPicker', () => {
    test('lists the items in the database by name', () => {
        draw();
        const names = screen.getAllByRole('listitem').map(row => row.querySelector('.ItemPicker-name').textContent);
        expect(names).toEqual(['Rope', 'Torch']);
    });

    test('adding an item calls back with the item and one of it', () => {
        const { onPick } = draw();
        fireEvent.click(screen.getByRole('button', { name: 'Add Torch' }));
        expect(onPick).toHaveBeenCalledWith(torch, 1);
    });

    test('adds as many as it is told', () => {
        const { onPick } = draw();
        fireEvent.change(screen.getByLabelText('How many'), { target: { value: '4' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add Rope' }));
        expect(onPick).toHaveBeenCalledWith(rope, 4);
    });

    test('a nonsense number of them is made sensible: at least one, whole, no more than a stack', async () => {
        const { onPick } = draw();
        const addWith = async value => {
            fireEvent.change(screen.getByLabelText('How many'), { target: { value } });
            fireEvent.click(screen.getByRole('button', { name: 'Add Rope' }));
            await waitFor(() => expect(screen.getByRole('button', { name: 'Add Rope' })).toBeEnabled());
        };
        await addWith('-3');
        expect(onPick).toHaveBeenLastCalledWith(rope, 1);
        await addWith('2.9');
        expect(onPick).toHaveBeenLastCalledWith(rope, 2);
        await addWith('5000');
        expect(onPick).toHaveBeenLastCalledWith(rope, 999);
    });

    test('searches by name or description', () => {
        draw();
        fireEvent.change(screen.getByLabelText('Search the item database'), { target: { value: 'hemp' } });
        expect(screen.getByRole('button', { name: 'Add Rope' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Add Torch' })).not.toBeInTheDocument();
    });

    test('filters by tag, when items have tags', () => {
        draw();
        fireEvent.change(screen.getByLabelText('Tag'), { target: { value: 'light' } });
        expect(screen.getByRole('button', { name: 'Add Torch' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Add Rope' })).not.toBeInTheDocument();
    });

    test('says when nothing matches, and when the database is empty', () => {
        draw();
        fireEvent.change(screen.getByLabelText('Search the item database'), { target: { value: 'zzz' } });
        expect(screen.getByText('No items match.')).toBeInTheDocument();
    });

    test('an empty database says how to fill it', () => {
        mockCatalog = { items: [], status: 'ready' };
        draw();
        expect(screen.getByText(/database is empty/)).toBeInTheDocument();
    });

    test('says while loading, and when it could not load', () => {
        mockCatalog = { items: [], status: 'loading' };
        const { unmount } = render(<ItemPicker userId="u" onPick={jest.fn()} onClose={jest.fn()}/>);
        expect(screen.getByText(/Loading the item database/)).toBeInTheDocument();
        unmount();
        mockCatalog = { items: [], status: 'error' };
        render(<ItemPicker userId="u" onPick={jest.fn()} onClose={jest.fn()}/>);
        expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load the item database.");
    });

    test('an error from the place it is being put is shown, and the picker stays open for another go', async () => {
        const onPick = jest.fn().mockRejectedValue(new Error("There's no room to carry that."));
        const { onClose } = draw({ onPick });
        fireEvent.click(screen.getByRole('button', { name: 'Add Torch' }));
        expect(await screen.findByRole('alert')).toHaveTextContent("There's no room to carry that.");
        expect(onClose).not.toHaveBeenCalled();
        expect(onPick).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.getByRole('button', { name: 'Add Torch' })).toBeEnabled());
    });

    test('the buttons wait while one is being added', async () => {
        let finish;
        draw({ onPick: jest.fn(() => new Promise(resolve => { finish = resolve; })) });
        fireEvent.click(screen.getByRole('button', { name: 'Add Torch' }));
        expect(screen.getByRole('button', { name: 'Add Rope' })).toBeDisabled();
        finish();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Add Rope' })).toBeEnabled());
    });

    test('Done closes it', () => {
        const { onClose } = draw();
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(onClose).toHaveBeenCalled();
    });

    describe('making a new item', () => {
        const open = () => fireEvent.click(screen.getByRole('button', { name: '+ Make a new item' }));

        test('makes a private item, readable by the party, and adds it', async () => {
            const { onPick } = draw();
            open();
            fireEvent.change(screen.getByLabelText('New item name'), { target: { value: '  Silver Locket ' } });
            fireEvent.change(screen.getByLabelText('New item description'), { target: { value: 'Holds a portrait.' } });
            fireEvent.change(screen.getByLabelText('How many'), { target: { value: '2' } });
            fireEvent.click(screen.getByRole('button', { name: 'Make it and add' }));

            await waitFor(() => expect(mockAddDoc).toHaveBeenCalled());
            expect(mockAddDoc).toHaveBeenCalledWith({ __collection: 'items' }, {
                item_name: 'Silver Locket'.slice(0, 60), item_description: 'Holds a portrait.', item_image: '', tags: [], isPublic: false,
                canRead: ['user-1', 'friend'], canWrite: ['user-1'], admins: ['user-1'],
            });
            await waitFor(() => expect(onPick).toHaveBeenCalled());
            expect(onPick.mock.calls[0][0]).toMatchObject({ id: 'made', item_name: 'Silver Locket' });
            expect(onPick.mock.calls[0][1]).toBe(2);
            expect(mockReload).toHaveBeenCalled();
        });

        test('needs a name', async () => {
            draw();
            open();
            fireEvent.click(screen.getByRole('button', { name: 'Make it and add' }));
            expect(await screen.findByRole('alert')).toHaveTextContent('Give the item a name.');
            expect(mockAddDoc).not.toHaveBeenCalled();
        });

        test('can be cancelled', () => {
            draw();
            open();
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(screen.queryByLabelText('New item name')).not.toBeInTheDocument();
        });

        test('a failure to make it is shown', async () => {
            mockAddDoc.mockRejectedValue(new Error('permission-denied'));
            draw();
            open();
            fireEvent.change(screen.getByLabelText('New item name'), { target: { value: 'Locket' } });
            fireEvent.click(screen.getByRole('button', { name: 'Make it and add' }));
            expect(await screen.findByRole('alert')).toHaveTextContent('permission-denied');
        });
    });
});
