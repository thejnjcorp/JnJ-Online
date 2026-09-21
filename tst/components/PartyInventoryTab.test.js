const mockUseItem = jest.fn();
jest.mock('../../src/utils/useItems', () => ({ useItem: (...args) => mockUseItem(...args) }));
const mockOps = { addToParty: jest.fn(), putInParty: jest.fn(), removePartyEntry: jest.fn(), setPartyQuantity: jest.fn(), takeFromParty: jest.fn() };
jest.mock('../../src/utils/partyInventory', () => ({
    addToParty: (...args) => mockOps.addToParty(...args),
    putInParty: (...args) => mockOps.putInParty(...args),
    removePartyEntry: (...args) => mockOps.removePartyEntry(...args),
    setPartyQuantity: (...args) => mockOps.setPartyQuantity(...args),
    takeFromParty: (...args) => mockOps.takeFromParty(...args),
}));
const mockShareItem = jest.fn();
jest.mock('../../src/utils/itemAccess', () => ({ shareItem: (...args) => mockShareItem(...args) }));
let mockPickerProps;
jest.mock('../../src/components/ItemPicker', () => ({
    ItemPicker: props => { mockPickerProps = props; return <div>ItemPicker-stub:{props.title}</div>; },
}));

// eslint-disable-next-line import/first
import { screen, fireEvent, within, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { PartyInventoryTab } from '../../src/components/PartyInventoryTab';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const torch = { id: 'torch', item_name: 'Torch', item_description: '', tags: [] };
const entry = (id, item_id, title, quantity) => ({ id, item_id, title, quantity, added_by: 'bob' });
const aria = { character_id: 'aria', character_name: 'Aria', inventory: [{ id: 'c1', item_id: 'rope', title: 'Rope', quantity: 2, status: '1', index: 0 }], inventory_pocket: [] };

const draw = (props = {}) => renderWithRouter(
    <PartyInventoryTab campaignId="camp-1" party={{ inventory: [entry('p1', 'torch', 'Torch', 5), entry('p2', 'lamp', 'Lamp', 1)] }} loaded acting={aria} userId="alice" members={['alice', 'dir']} {...props}/>
);
const row = name => screen.getByRole('button', { name: new RegExp(`^${name}`) }).closest('.Party-list-item');

beforeEach(() => {
    Object.values(mockOps).forEach(op => op.mockResolvedValue(undefined));
    mockShareItem.mockResolvedValue(false);
    mockUseItem.mockImplementation(id => ({ item: id === 'torch' ? torch : null, status: id === 'torch' ? 'ready' : 'missing' }));
    mockPickerProps = null;
});

describe('PartyInventoryTab', () => {
    test('lists what the party has, with how many', () => {
        draw();
        expect(row('Torch')).toHaveTextContent('×5');
        expect(row('Lamp')).toBeInTheDocument();
    });

    test('says when nothing is here yet, and while it loads', () => {
        draw({ party: {} });
        expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument();
    });

    test('shows loading before the party doc arrives', () => {
        draw({ party: {}, loaded: false });
        expect(screen.getByText('Loading…')).toBeInTheDocument();
        expect(screen.queryByText(/Nothing here yet/)).not.toBeInTheDocument();
    });

    describe('adding', () => {
        test('the picker opens and closes with Add an item', () => {
            draw();
            expect(screen.queryByText(/ItemPicker-stub/)).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Add an item' }));
            expect(screen.getByText('ItemPicker-stub:Add an item to the party inventory')).toBeInTheDocument();
            expect(mockPickerProps.shareWith).toEqual(['alice', 'dir']);
        });

        test('an item picked goes in the party inventory, noting who put it there, and is shared so the party can read it', async () => {
            draw();
            fireEvent.click(screen.getByRole('button', { name: 'Add an item' }));
            const item = { id: 'rope', item_name: 'Rope', item_description: 'ignored', canWrite: ['alice'] };
            await mockPickerProps.onPick(item, 2);
            expect(mockOps.addToParty).toHaveBeenCalledWith('camp-1', { id: 'rope', item_name: 'Rope' }, 2, 'alice');
            expect(mockShareItem).toHaveBeenCalledWith(item, ['alice', 'dir'], 'alice');
        });

        test('a refusal is passed back to the picker, and the item is not shared', async () => {
            mockOps.addToParty.mockRejectedValue(new Error('The party inventory is full - take something out first.'));
            draw();
            fireEvent.click(screen.getByRole('button', { name: 'Add an item' }));
            await expect(mockPickerProps.onPick({ id: 'rope', item_name: 'Rope' }, 1)).rejects.toThrow('full');
            expect(mockShareItem).not.toHaveBeenCalled();
        });
    });

    describe('taking things out', () => {
        test('a player takes some into the character they are playing', () => {
            draw();
            const line = within(row('Torch'));
            fireEvent.change(line.getByLabelText('How many to take'), { target: { value: '2' } });
            fireEvent.click(line.getByRole('button', { name: 'Take' }));
            expect(mockOps.takeFromParty).toHaveBeenCalledWith({ campaignId: 'camp-1', characterId: 'aria', itemId: 'torch', title: 'Torch', quantity: 2 });
        });

        test('what they take is kept to what there is, and at least one', () => {
            draw();
            const line = within(row('Torch'));
            fireEvent.change(line.getByLabelText('How many to take'), { target: { value: '99' } });
            fireEvent.click(line.getByRole('button', { name: 'Take' }));
            expect(mockOps.takeFromParty).toHaveBeenLastCalledWith(expect.objectContaining({ quantity: 5 }));
            fireEvent.change(line.getByLabelText('How many to take'), { target: { value: '-4' } });
            fireEvent.click(line.getByRole('button', { name: 'Take' }));
            expect(mockOps.takeFromParty).toHaveBeenLastCalledWith(expect.objectContaining({ quantity: 1 }));
        });

        test('someone with no character in the campaign cannot take, and is told', () => {
            draw({ acting: null });
            expect(screen.queryByRole('button', { name: 'Take' })).not.toBeInTheDocument();
            expect(screen.getByText(/You don't have a character in this campaign/)).toBeInTheDocument();
        });

        test('a refusal is shown', async () => {
            mockOps.takeFromParty.mockRejectedValue(new Error("There's no room to carry that."));
            draw();
            fireEvent.click(within(row('Torch')).getByRole('button', { name: 'Take' }));
            expect(await screen.findByRole('alert')).toHaveTextContent("There's no room to carry that.");
        });
    });

    describe('changing the inventory', () => {
        test('one more and one fewer change the party\'s count', () => {
            draw();
            fireEvent.click(screen.getByRole('button', { name: 'One more Torch' }));
            expect(mockOps.setPartyQuantity).toHaveBeenCalledWith('camp-1', 'p1', 6);
            fireEvent.click(screen.getByRole('button', { name: 'One fewer Torch' }));
            expect(mockOps.setPartyQuantity).toHaveBeenCalledWith('camp-1', 'p1', 4);
        });

        test('anyone can remove an entry', () => {
            draw();
            fireEvent.click(screen.getByRole('button', { name: 'Remove Lamp' }));
            expect(mockOps.removePartyEntry).toHaveBeenCalledWith('camp-1', 'p2');
        });

        test('an entry from before items existed can be taken out but not counted or taken', () => {
            mockUseItem.mockReturnValue({ item: null, status: 'missing' });
            draw({ party: { inventory: [{ id: 'old', title: 'Rusty Key', content: 'Opens something.', quantity: 1 }] } });
            expect(screen.queryByRole('button', { name: /One more/ })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Take' })).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Remove Rusty Key' })).toBeInTheDocument();
        });

        test('a refusal is shown, and clears when something else is tried', async () => {
            mockOps.setPartyQuantity.mockRejectedValueOnce(new Error('That could not be done.'));
            draw();
            fireEvent.click(screen.getByRole('button', { name: 'One more Torch' }));
            expect(await screen.findByRole('alert')).toHaveTextContent('That could not be done.');
            fireEvent.click(screen.getByRole('button', { name: 'One more Torch' }));
            await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
        });
    });

    describe('the character\'s own inventory beside it', () => {
        test('shows what they are carrying, with how many', () => {
            draw();
            const section = within(screen.getByRole('region', { name: "Aria's inventory" }));
            expect(section.getByText('Aria is carrying')).toBeInTheDocument();
            expect(section.getByRole('button', { name: /^Rope/ })).toHaveTextContent('×2');
        });

        test('puts some in the party inventory', () => {
            draw();
            const section = within(screen.getByRole('region', { name: "Aria's inventory" }));
            fireEvent.change(section.getByLabelText('How many to put in party'), { target: { value: '1' } });
            fireEvent.click(section.getByRole('button', { name: 'Put in party' }));
            expect(mockOps.putInParty).toHaveBeenCalledWith({ campaignId: 'camp-1', characterId: 'aria', itemId: 'rope', title: 'Rope', quantity: 1, userId: 'alice' });
        });

        test('says so when they carry nothing that can be put in', () => {
            draw({ acting: { ...aria, inventory: [] } });
            expect(screen.getByText(/Nothing that can be put in the party inventory/)).toBeInTheDocument();
        });

        test('is not shown for someone with no character', () => {
            draw({ acting: null });
            expect(screen.queryByText(/is carrying/)).not.toBeInTheDocument();
        });
    });
});
