const mockUseItem = jest.fn();
jest.mock('../../src/utils/useItems', () => ({ useItem: (...args) => mockUseItem(...args) }));
const mockSetQuantity = jest.fn();
const mockRemove = jest.fn();
const mockPutInParty = jest.fn();
jest.mock('../../src/utils/partyInventory', () => ({
    setCharacterQuantity: (...args) => mockSetQuantity(...args),
    removeCharacterEntry: (...args) => mockRemove(...args),
    putInParty: (...args) => mockPutInParty(...args),
}));

// eslint-disable-next-line import/first
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
// eslint-disable-next-line import/first
import { MemoryRouter } from 'react-router-dom';
// eslint-disable-next-line import/first
import { InventoryCard, InventoryContext } from '../../src/utils/DraggableElements/InventoryCard.tsx';

const torch = { id: 'torch', item_name: 'Torch', item_description: 'Burns for an hour.', item_image: 'AbC1d2E.png', tags: [] };
const entry = (extra = {}) => ({ id: 'e1', item_id: 'torch', title: 'Torch', quantity: 3, status: '1', index: 0, ...extra });

function draw(post, context = {}) {
    return render(
        <MemoryRouter>
            <InventoryContext.Provider value={{ characterId: 'aria', canEdit: true, campaignId: 'camp-1', userId: 'alice', ...context }}>
                <DragDropContext onDragEnd={() => {}}>
                    <Droppable droppableId="1">
                        {provided => <div ref={provided.innerRef} {...provided.droppableProps}>
                            <InventoryCard post={post} index={0} titleClassName="title" contentClassName="content" boxClassName="box" extraClassNames={[]}/>
                            {provided.placeholder}
                        </div>}
                    </Droppable>
                </DragDropContext>
            </InventoryContext.Provider>
        </MemoryRouter>
    );
}
// the drag handle around the card is a button too; the card's own button is the one that opens it
const titleButton = name => screen.getAllByRole('button', { name }).find(button => button.tagName === 'BUTTON');
const open = name => fireEvent.click(titleButton(name));

beforeEach(() => {
    mockUseItem.mockReturnValue({ item: torch, status: 'ready' });
    mockSetQuantity.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);
    mockPutInParty.mockResolvedValue(undefined);
});

describe('InventoryCard', () => {
    test('shows the item\'s name, picture and how many, from the item it refers to', () => {
        const { container } = draw(entry());
        expect(mockUseItem).toHaveBeenCalledWith('torch');
        expect(titleButton(/Torch/)).toHaveTextContent('Torch×3');
        expect(container.querySelector('img')).toHaveAttribute('src', 'https://i.imgur.com/AbC1d2E.png');
    });

    test('one of something shows no quantity', () => {
        draw(entry({ quantity: 1 }));
        expect(screen.queryByLabelText(/quantity/)).not.toBeInTheDocument();
    });

    test('an item that cannot be read is shown by the name the entry kept', () => {
        mockUseItem.mockReturnValue({ item: null, status: 'error' });
        draw(entry());
        expect(titleButton(/Torch/)).toBeInTheDocument();
    });

    test('an entry from before items existed is shown by its own title, and asks for no item', () => {
        mockUseItem.mockReturnValue({ item: null, status: 'missing' });
        draw({ id: 'old', title: 'Rusty Key', content: 'Opens *something*.', status: '1', index: 0 });
        expect(mockUseItem).toHaveBeenCalledWith('');
        open(/Rusty Key/);
        expect(screen.getByText('something')).toBeInTheDocument();
    });

    describe('pressing it', () => {
        test('opens the details - the description - and again closes them', () => {
            draw(entry());
            expect(screen.queryByText('Burns for an hour.')).not.toBeInTheDocument();
            open(/Torch/);
            expect(screen.getByText('Burns for an hour.')).toBeInTheDocument();
            open(/Torch/);
            expect(screen.queryByText('Burns for an hour.')).not.toBeInTheDocument();
        });

        test('shows the controls to someone who may change the inventory', () => {
            draw(entry());
            open(/Torch/);
            expect(screen.getByRole('button', { name: 'One more' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'One fewer' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Put in party inventory' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
        });

        test('shows no controls to someone who may not', () => {
            draw(entry(), { canEdit: false });
            open(/Torch/);
            expect(screen.getByText('Burns for an hour.')).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'One more' })).not.toBeInTheDocument();
        });

        test('a character in no campaign has no party inventory to put things in', () => {
            draw(entry(), { campaignId: undefined });
            open(/Torch/);
            expect(screen.queryByRole('button', { name: 'Put in party inventory' })).not.toBeInTheDocument();
        });

        test('an old hand-typed entry can only be removed: no quantity, and nothing to put in the party', () => {
            mockUseItem.mockReturnValue({ item: null, status: 'missing' });
            draw({ id: 'old', title: 'Rusty Key', content: '', status: '1', index: 0 });
            open(/Rusty Key/);
            expect(screen.queryByRole('button', { name: 'One more' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Put in party inventory' })).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
        });
    });

    describe('the controls', () => {
        test('one more and one fewer change the quantity of that entry', () => {
            draw(entry());
            open(/Torch/);
            fireEvent.click(screen.getByRole('button', { name: 'One more' }));
            expect(mockSetQuantity).toHaveBeenCalledWith('aria', 'e1', 4);
            fireEvent.click(screen.getByRole('button', { name: 'One fewer' }));
            expect(mockSetQuantity).toHaveBeenCalledWith('aria', 'e1', 2);
        });

        test('one fewer of one takes it out', () => {
            draw(entry({ quantity: 1 }));
            open(/Torch/);
            fireEvent.click(screen.getByRole('button', { name: 'One fewer' }));
            expect(mockSetQuantity).toHaveBeenCalledWith('aria', 'e1', 0);
        });

        test('one more is off at the most a stack holds', () => {
            draw(entry({ quantity: 999 }));
            open(/Torch/);
            expect(screen.getByRole('button', { name: 'One more' })).toBeDisabled();
        });

        test('Remove takes the entry out', () => {
            draw(entry());
            open(/Torch/);
            fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
            expect(mockRemove).toHaveBeenCalledWith('aria', 'e1');
        });

        test('puts some in the party inventory, as many as it says', () => {
            draw(entry());
            open(/Torch/);
            fireEvent.change(screen.getByLabelText('How many to put in the party inventory'), { target: { value: '2' } });
            fireEvent.click(screen.getByRole('button', { name: 'Put in party inventory' }));
            expect(mockPutInParty).toHaveBeenCalledWith({ campaignId: 'camp-1', characterId: 'aria', itemId: 'torch', title: 'Torch', quantity: 2, userId: 'alice' });
        });

        test('the amount is kept to what there is, and at least one', () => {
            draw(entry());
            open(/Torch/);
            fireEvent.change(screen.getByLabelText('How many to put in the party inventory'), { target: { value: '50' } });
            fireEvent.click(screen.getByRole('button', { name: 'Put in party inventory' }));
            expect(mockPutInParty).toHaveBeenLastCalledWith(expect.objectContaining({ quantity: 3 }));
            fireEvent.change(screen.getByLabelText('How many to put in the party inventory'), { target: { value: '0' } });
            fireEvent.click(screen.getByRole('button', { name: 'Put in party inventory' }));
            expect(mockPutInParty).toHaveBeenLastCalledWith(expect.objectContaining({ quantity: 1 }));
        });

        test('a refusal is shown, in words', async () => {
            mockPutInParty.mockRejectedValue(new Error('The party inventory is full - take something out first.'));
            draw(entry());
            open(/Torch/);
            fireEvent.click(screen.getByRole('button', { name: 'Put in party inventory' }));
            expect(await screen.findByRole('alert')).toHaveTextContent('The party inventory is full');
        });

        test('the message goes when something else is tried', async () => {
            mockSetQuantity.mockRejectedValueOnce(new Error("There's no room to carry that."));
            draw(entry());
            open(/Torch/);
            fireEvent.click(screen.getByRole('button', { name: 'One more' }));
            expect(await screen.findByRole('alert')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'One more' }));
            await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
        });
    });
});
