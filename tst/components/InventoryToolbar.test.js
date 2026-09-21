const mockAddItemToCharacter = jest.fn();
jest.mock('../../src/utils/partyInventory', () => ({ addItemToCharacter: (...args) => mockAddItemToCharacter(...args) }));
let mockPickerProps;
jest.mock('../../src/components/ItemPicker', () => ({
    ItemPicker: props => {
        mockPickerProps = props;
        return <div>ItemPicker-stub:{props.title}:{props.shareWith.join(',')}<button type="button" onClick={props.onClose}>close-picker</button></div>;
    },
}));

// eslint-disable-next-line import/first
import { screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/first
import { InventoryToolbar } from '../../src/components/InventoryToolbar';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

beforeEach(() => {
    mockAddItemToCharacter.mockResolvedValue(undefined);
    mockPickerProps = null;
});

const draw = (props = {}) => renderWithRouter(<InventoryToolbar characterId="aria" campaignId="camp-1" userId="alice" members={['alice', 'dir']} {...props}/>);

describe('InventoryToolbar', () => {
    test('links to the item database and the party inventory', () => {
        draw();
        expect(screen.getByRole('link', { name: 'Item database' })).toHaveAttribute('href', '/item-list');
        expect(screen.getByRole('link', { name: 'Party inventory' })).toHaveAttribute('href', '/party/camp-1?tab=inventory');
    });

    test('a character in no campaign has no party inventory to go to', () => {
        draw({ campaignId: undefined });
        expect(screen.queryByRole('link', { name: 'Party inventory' })).not.toBeInTheDocument();
    });

    test('the picker is closed until Add item is pressed, and Add item shows whether it is open', () => {
        draw();
        expect(screen.queryByText(/ItemPicker-stub/)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add item' })).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
        expect(screen.getByText('ItemPicker-stub:Add an item to this inventory:alice,dir')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add item' })).toHaveAttribute('aria-pressed', 'true');
        expect(mockPickerProps.userId).toBe('alice');
    });

    test('the picker can be closed', () => {
        draw();
        fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
        fireEvent.click(screen.getByRole('button', { name: 'close-picker' }));
        expect(screen.queryByText(/ItemPicker-stub/)).not.toBeInTheDocument();
    });

    test('an item picked goes into the character\'s inventory, as an item and how many', async () => {
        draw();
        fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
        await mockPickerProps.onPick({ id: 'torch', item_name: 'Torch', item_description: 'ignored' }, 3);
        expect(mockAddItemToCharacter).toHaveBeenCalledWith('aria', { id: 'torch', item_name: 'Torch' }, 3);
    });

    test('a refusal - no room - is passed back to the picker to show', async () => {
        mockAddItemToCharacter.mockRejectedValue(new Error("There's no room to carry that."));
        draw();
        fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
        await expect(mockPickerProps.onPick({ id: 'torch', item_name: 'Torch' }, 1)).rejects.toThrow("no room");
    });
});
