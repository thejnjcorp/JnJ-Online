jest.mock('../../src/utils/firebase', () => ({ auth: {}, db: {} }));
const mockOnAuthStateChanged = jest.fn();
jest.mock('firebase/auth', () => ({ onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args) }));
let mockCatalog;
jest.mock('../../src/utils/useItems', () => ({ useItemCatalog: () => mockCatalog }));
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ ...jest.requireActual('react-router-dom'), useNavigate: () => mockNavigate }));

// eslint-disable-next-line import/first
import { screen, fireEvent, within, act } from '@testing-library/react';
// eslint-disable-next-line import/first
import { ItemListPage } from '../../src/components/ItemListPage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const torch = { id: 'torch', item_name: 'Torch', item_description: 'Burns for an hour.', item_image: 'AbC1d2E.png', tags: ['light', 'tool'], isPublic: true, canWrite: ['admin'] };
const rope = { id: 'rope', item_name: 'Rope', item_description: 'Fifty feet of hemp.', tags: ['tool'], isPublic: false, canWrite: ['me'] };
const dagger = { id: 'dagger', item_name: 'Dagger', tags: ['weapon'], isPublic: true, canWrite: ['someone'] };

function draw(items = [torch, rope, dagger], status = 'ready') {
    mockCatalog = { items, status };
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => { Promise.resolve().then(() => callback({ uid: 'me' })); return jest.fn(); });
    renderWithRouter(<ItemListPage />);
}
const names = () => screen.getAllByRole('button').filter(button => button.className.includes('StatusListPage-card')).map(card => card.querySelector('.StatusListPage-card-name').textContent);
const group = name => within(screen.getByRole('group', { name }));

describe('ItemListPage', () => {
    test('sets the title and says what the database is for', () => {
        draw();
        expect(document.title).toBe('Items');
        expect(screen.getByText(/Write a thing once/)).toBeInTheDocument();
    });

    test('shows each item as a card, by name, with its description, tags and whether it is public', () => {
        draw();
        expect(names()).toEqual(['Dagger', 'Rope', 'Torch']);
        const card = screen.getByText('Torch').closest('button');
        expect(within(card).getByText('Burns for an hour.')).toBeInTheDocument();
        expect(within(card).getByText('light')).toBeInTheDocument();
        expect(within(card).getByText('Public')).toBeInTheDocument();
        expect(card.querySelector('img')).toHaveAttribute('src', 'https://i.imgur.com/AbC1d2E.png');
        expect(within(screen.getByText('Rope').closest('button')).getByText('Private')).toBeInTheDocument();
    });

    test('an item with no picture has no empty frame', () => {
        draw([rope]);
        expect(document.querySelector('.ItemList-thumb')).toBeNull();
    });

    test('pressing a card opens the item', () => {
        draw();
        fireEvent.click(screen.getByText('Torch').closest('button'));
        expect(mockNavigate).toHaveBeenCalledWith('/items/torch');
    });

    test('Create New Item goes to a new one', () => {
        draw();
        fireEvent.click(screen.getByRole('button', { name: '+ Create New Item' }));
        expect(mockNavigate).toHaveBeenCalledWith('/items');
    });

    test('Mine shows the items the user can write, Public the public ones', async () => {
        draw();
        await act(async () => { await Promise.resolve(); }); // who is signed in arrives
        fireEvent.click(group('Whose').getByRole('button', { name: 'Mine' }));
        expect(names()).toEqual(['Rope']);
        fireEvent.click(group('Whose').getByRole('button', { name: 'Public' }));
        expect(names()).toEqual(['Dagger', 'Torch']);
        fireEvent.click(group('Whose').getByRole('button', { name: 'All' }));
        expect(names()).toHaveLength(3);
    });

    test('offers each tag in use, and filters by it; Any tag clears it', () => {
        draw();
        expect(group('Tag').getAllByRole('button').map(button => button.textContent)).toEqual(['Any tag', 'light', 'tool', 'weapon']);
        fireEvent.click(group('Tag').getByRole('button', { name: 'tool' }));
        expect(names()).toEqual(['Rope', 'Torch']);
        expect(group('Tag').getByRole('button', { name: 'tool' })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(group('Tag').getByRole('button', { name: 'Any tag' }));
        expect(names()).toHaveLength(3);
    });

    test('has no tag filter when no item has a tag', () => {
        draw([{ id: 'x', item_name: 'Plain', tags: [], isPublic: true }]);
        expect(screen.queryByRole('group', { name: 'Tag' })).not.toBeInTheDocument();
    });

    test('searches by name or description, and the filters combine', () => {
        draw();
        fireEvent.change(screen.getByLabelText('Search items'), { target: { value: 'hemp' } });
        expect(names()).toEqual(['Rope']);
        fireEvent.click(group('Whose').getByRole('button', { name: 'Public' }));
        expect(screen.getByText('No items match these filters.')).toBeInTheDocument();
    });

    test('says while it loads, when it fails, and when there are no items', () => {
        draw([], 'loading');
        expect(screen.getByText('Loading…')).toBeInTheDocument();
    });

    test('says when it could not load', () => {
        draw([], 'error');
        expect(screen.getByText("Couldn't load the item database.")).toBeInTheDocument();
    });

    test('says when the database is empty', () => {
        draw([], 'ready');
        expect(screen.getByText('No items yet - create your first.')).toBeInTheDocument();
    });
});
