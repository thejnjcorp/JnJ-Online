jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockOnSnapshot = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (_db, ...path) => ({ __doc: path }),
    onSnapshot: (...args) => mockOnSnapshot(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
}));

const mockAbstractProps = [];
jest.mock('../../src/utils/DraggableElements/Post.ts', () => ({
    PostListContentAbstract: props => {
        mockAbstractProps.push(props);
        return <div>Slots-stub</div>;
    },
}));
jest.mock('../../src/utils/DraggableElements/InventoryCard.tsx', () => {
    const { createContext } = require('react');
    return { InventoryCard: () => <div/>, InventoryContext: createContext({}) };
});

// eslint-disable-next-line import/first
import { render, act } from '@testing-library/react';
// eslint-disable-next-line import/first
import { PostListContentInventory } from '../../src/utils/DraggableElements/PostListInventory.tsx';
// eslint-disable-next-line import/first
import { PostListContentInventoryPocket } from '../../src/utils/DraggableElements/PostListInventoryPocket.tsx';
// eslint-disable-next-line import/first
import { InventoryCard } from '../../src/utils/DraggableElements/InventoryCard.tsx';

let deliver;
const stop = jest.fn();
const entry = (id, status) => ({ id, item_id: 'torch', title: 'Torch', quantity: 1, status, index: 0 });
const last = () => mockAbstractProps[mockAbstractProps.length - 1];

beforeEach(() => {
    mockAbstractProps.length = 0;
    stop.mockReset();
    mockUpdateDoc.mockResolvedValue(undefined);
    mockOnSnapshot.mockImplementation((_ref, onNext) => { deliver = onNext; return stop; });
});

const snapshot = data => ({ data: () => data, metadata: { hasPendingWrites: false } });

describe.each([
    ['the backpack', PostListContentInventory, 'inventory'],
    ['the pocket', PostListContentInventoryPocket, 'inventory_pocket'],
])('%s', (_name, List, field) => {
    const draw = (props = {}) => render(<List inputStatuses={['1']} characterId="aria" canEdit campaignId="camp-1" userId="alice" {...props}/>);

    test('reads its own list from the character', () => {
        draw();
        expect(mockOnSnapshot).toHaveBeenCalledWith({ __doc: ['characters', 'aria'] }, expect.any(Function));
        act(() => deliver(snapshot({ [field]: [entry('a', '1')], other: [] })));
        expect(last().usePosts()).toEqual({ posts: [entry('a', '1')], loading: false });
    });

    test('is loading until the character arrives, and empty for a character with no list', () => {
        draw();
        expect(last().usePosts().loading).toBe(true);
        act(() => deliver(snapshot({})));
        expect(last().usePosts()).toEqual({ posts: [], loading: false });
    });

    test('shows every change to the character, not only ones made here - a trade by another player, a director giving something', () => {
        draw();
        act(() => deliver(snapshot({ [field]: [entry('a', '1')] })));
        act(() => deliver({ data: () => ({ [field]: [entry('a', '1'), entry('b', '2')] }), metadata: { hasPendingWrites: false } })); // from the server, not this device
        expect(last().usePosts().posts).toHaveLength(2);
    });

    test('dragging writes the whole list back to the character', () => {
        draw();
        last().updatePosts([entry('a', '2')]);
        expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'aria'] }, { [field]: [entry('a', '2')] });
    });

    test('cards are the inventory card, and someone who may change the inventory can drag', () => {
        draw();
        expect(last().PostCardComponent).toBe(InventoryCard);
        expect(last().readOnly).toBe(false);
    });

    test('everyone else can look but not drag', () => {
        draw({ canEdit: false });
        expect(last().readOnly).toBe(true);
    });

    test('stops listening when it goes, and listens to the new character if that changes', () => {
        const { rerender, unmount } = draw();
        rerender(<List inputStatuses={['1']} characterId="bram" canEdit/>);
        expect(stop).toHaveBeenCalledTimes(1);
        expect(mockOnSnapshot).toHaveBeenLastCalledWith({ __doc: ['characters', 'bram'] }, expect.any(Function));
        unmount();
        expect(stop).toHaveBeenCalledTimes(2);
    });
});

test('the backpack is a grid you swap things in, the pocket a single row', () => {
    render(<PostListContentInventory inputStatuses={['1']} characterId="aria"/>);
    expect(last()).toMatchObject({ grid: true, swappableMode: true });
    mockAbstractProps.length = 0;
    render(<PostListContentInventoryPocket inputStatuses={['Pocket']} characterId="aria"/>);
    expect(last()).toMatchObject({ columnFormat: false });
    expect(last().grid).toBeUndefined();
});
