const mockUseItem = jest.fn();
jest.mock('../../src/utils/useItems', () => ({ useItem: (...args) => mockUseItem(...args) }));

// eslint-disable-next-line import/first
import { screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/first
import { ItemDetails, ItemLine, itemName } from '../../src/components/ItemLine';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const torch = { id: 'torch', item_name: 'Torch', item_description: 'Burns for **an hour**.', item_image: 'AbC1d2E.png', tags: ['light', 'tool'] };
const ready = item => ({ item, status: 'ready' });

describe('itemName', () => {
    test('is the item\'s name when it is known, else the name the entry kept, else something plain', () => {
        expect(itemName(ready(torch), 'Old name')).toBe('Torch');
        expect(itemName({ item: null, status: 'error' }, 'Kept name')).toBe('Kept name');
        expect(itemName({ item: null, status: 'error' }, '')).toBe('Unknown item');
        expect(itemName(undefined, undefined)).toBe('Unknown item');
    });
});

describe('ItemLine', () => {
    test('shows the item\'s name and picture, read from the database, and asks for the item it refers to', () => {
        mockUseItem.mockReturnValue(ready(torch));
        const { container } = renderWithRouter(<ItemLine itemId="torch" title="kept" quantity={1}/>);
        expect(mockUseItem).toHaveBeenCalledWith('torch');
        expect(screen.getByRole('button', { name: 'Torch' })).toBeInTheDocument();
        expect(container.querySelector('img')).toHaveAttribute('src', 'https://i.imgur.com/AbC1d2E.png');
    });

    test('says how many when there is more than one, and nothing when there is one', () => {
        mockUseItem.mockReturnValue(ready(torch));
        const { rerender } = renderWithRouter(<ItemLine itemId="torch" title="Torch" quantity={5}/>);
        expect(screen.getByLabelText('quantity 5')).toHaveTextContent('×5');
        rerender(<ItemLine itemId="torch" title="Torch" quantity={1}/>);
        expect(screen.queryByLabelText(/quantity/)).not.toBeInTheDocument();
    });

    test('pressing the name opens the details - the description as Markdown, the tags, a link to the database - and again closes them', () => {
        mockUseItem.mockReturnValue(ready(torch));
        renderWithRouter(<ItemLine itemId="torch" title="Torch" quantity={1}/>);
        expect(screen.queryByText('an hour')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Torch' }));
        expect(screen.getByText('an hour').tagName).toBe('STRONG');
        expect(screen.getByText('light')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Open in the item database' })).toHaveAttribute('href', '/items/torch');

        fireEvent.click(screen.getByRole('button', { name: 'Torch' }));
        expect(screen.queryByText('an hour')).not.toBeInTheDocument();
    });

    test('an item that cannot be read is shown by the name the entry kept, and says the details are not visible', () => {
        mockUseItem.mockReturnValue({ item: null, status: 'error' });
        renderWithRouter(<ItemLine itemId="secret" title="Secret Map" quantity={1}/>);
        fireEvent.click(screen.getByRole('button', { name: 'Secret Map' }));
        expect(screen.getByText("You can't see this item's details.")).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    test('an item that has been deleted says so', () => {
        mockUseItem.mockReturnValue({ item: null, status: 'missing' });
        renderWithRouter(<ItemLine itemId="gone" title="Old Sword" quantity={1}/>);
        fireEvent.click(screen.getByRole('button', { name: 'Old Sword' }));
        expect(screen.getByText('This item is no longer in the item database.')).toBeInTheDocument();
    });

    test('while it loads it is shown by its kept name', () => {
        mockUseItem.mockReturnValue({ item: null, status: 'loading' });
        renderWithRouter(<ItemLine itemId="torch" title="Torch" quantity={1}/>);
        expect(screen.getByRole('button', { name: 'Torch' })).toBeInTheDocument();
    });

    test('an entry from before items existed shows the text it was typed with, and is not "deleted"', () => {
        mockUseItem.mockReturnValue({ item: null, status: 'missing' });
        renderWithRouter(<ItemLine itemId="" title="Rusty Key" content="Opens *something*." quantity={1}/>);
        fireEvent.click(screen.getByRole('button', { name: 'Rusty Key' }));
        expect(screen.getByText('something').tagName).toBe('EM');
        expect(screen.queryByText(/no longer in the item database/)).not.toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    test('an old entry with no text says there is no description', () => {
        mockUseItem.mockReturnValue({ item: null, status: 'missing' });
        renderWithRouter(<ItemLine itemId="" title="Rusty Key" quantity={1}/>);
        fireEvent.click(screen.getByRole('button', { name: 'Rusty Key' }));
        expect(screen.getByText('No description.')).toBeInTheDocument();
    });

    test('an item with no description says so', () => {
        mockUseItem.mockReturnValue(ready({ ...torch, item_description: '' }));
        renderWithRouter(<ItemLine itemId="torch" title="Torch" quantity={1}/>);
        fireEvent.click(screen.getByRole('button', { name: 'Torch' }));
        expect(screen.getByText('No description.')).toBeInTheDocument();
    });

    test('the actions it is given are shown at the end of the line', () => {
        mockUseItem.mockReturnValue(ready(torch));
        renderWithRouter(<ItemLine itemId="torch" title="Torch" quantity={1}><button type="button">Take</button></ItemLine>);
        expect(screen.getByRole('button', { name: 'Take' })).toBeInTheDocument();
    });
});

describe('ItemDetails', () => {
    test('can leave out the link to the database', () => {
        renderWithRouter(<ItemDetails state={ready(torch)} showLink={false}/>);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
});
