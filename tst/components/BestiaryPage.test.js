jest.mock('../../src/utils/firebase', () => ({ auth: {}, db: {} }));
const mockOnAuthStateChanged = jest.fn();
jest.mock('firebase/auth', () => ({ onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args) }));
let mockBestiary;
jest.mock('../../src/utils/useBestiary', () => ({ useBestiary: () => mockBestiary }));
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ ...jest.requireActual('react-router-dom'), useNavigate: () => mockNavigate }));

// eslint-disable-next-line import/first
import { screen, fireEvent, within } from '@testing-library/react';
// eslint-disable-next-line import/first
import { BestiaryPage } from '../../src/components/BestiaryPage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const goon = { id: 'g', enemy_name: 'Rust Bandit', enemy_type: 'Goon', level: 1, maximum_health: 8, base_armor_class: 11, actions: [{}], public: false, canWrite: ['me'] };
const captain = { id: 'c', enemy_name: 'Iron Captain', enemy_type: 'Captain', level: 4, maximum_health: 90, base_armor_class: 17, actions: [{}, {}], public: true, canWrite: ['someone'] };
const wolf = { id: 'w', enemy_name: 'Wolf', enemy_type: 'Regular', level: 2, maximum_health: 20, base_armor_class: 13, actions: [], public: true, canWrite: ['me'] };

function renderPage(enemies, status = 'ready') {
    mockBestiary = { enemies, status };
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => { Promise.resolve().then(() => callback({ uid: 'me' })); return jest.fn(); });
    renderWithRouter(<BestiaryPage />);
}

const names = () => screen.getAllByRole('button').filter(button => button.className.includes('StatusListPage-card')).map(card => card.querySelector('.StatusListPage-card-name').textContent);
const group = name => within(screen.getByRole('group', { name }));

describe('BestiaryPage', () => {
    test('sets the title and says what the bestiary is for', () => {
        renderPage([]);
        expect(document.title).toBe('Bestiary');
        expect(screen.getByText(/each fight gets its own copy/)).toBeInTheDocument();
    });

    test('shows each enemy as a card with its tier, level, HP, AC and number of actions, weakest tier first', () => {
        renderPage([captain, wolf, goon]);
        expect(names()).toEqual(['Rust Bandit', 'Wolf', 'Iron Captain']);
        expect(screen.getByText('Lvl 4')).toBeInTheDocument();
        expect(screen.getByText('90 HP')).toBeInTheDocument();
        expect(screen.getByText('AC 17')).toBeInTheDocument();
        expect(screen.getByText('2 actions')).toBeInTheDocument();
        expect(screen.getByText('1 action')).toBeInTheDocument();
    });

    test('a card opens its enemy', () => {
        renderPage([wolf]);
        fireEvent.click(screen.getByText('Wolf'));
        expect(mockNavigate).toHaveBeenCalledWith('/enemies/w');
    });

    test('+ Create New Enemy goes to a blank enemy', () => {
        renderPage([]);
        fireEvent.click(screen.getByRole('button', { name: '+ Create New Enemy' }));
        expect(mockNavigate).toHaveBeenCalledWith('/enemies');
    });

    describe('filters', () => {
        test('a tier keeps just that tier', () => {
            renderPage([goon, wolf, captain]);
            fireEvent.click(group('Tier').getByRole('button', { name: 'Goons' }));
            expect(names()).toEqual(['Rust Bandit']);
            fireEvent.click(group('Tier').getByRole('button', { name: 'All' }));
            expect(names()).toHaveLength(3);
        });

        test('the tiers offered are all five, by plural', () => {
            renderPage([]);
            expect(group('Tier').getAllByRole('button').map(button => button.textContent)).toEqual(['All', 'Goons', 'Regulars', 'Veterans', 'Elites', 'Captains']);
        });

        test('Mine keeps enemies the viewer can write, Public keeps public ones', async () => {
            renderPage([goon, wolf, captain]);
            await screen.findByText('Wolf');
            fireEvent.click(group('Whose').getByRole('button', { name: 'Mine' }));
            expect(names().sort()).toEqual(['Rust Bandit', 'Wolf']);
            fireEvent.click(group('Whose').getByRole('button', { name: 'Public' }));
            expect(names().sort()).toEqual(['Iron Captain', 'Wolf']);
        });

        test('search matches names without regard to case, and combines with the tier', () => {
            renderPage([goon, wolf, captain]);
            fireEvent.change(screen.getByRole('searchbox', { name: 'Search enemies' }), { target: { value: 'IRON' } });
            expect(names()).toEqual(['Iron Captain']);
            fireEvent.click(group('Tier').getByRole('button', { name: 'Goons' }));
            expect(screen.getByText('No enemies match these filters.')).toBeInTheDocument();
        });
    });

    test('says when there are no enemies, while loading, and on error', () => {
        renderPage([]);
        expect(screen.getByText('No enemies yet - create your first.')).toBeInTheDocument();
    });

    test('loading and error', () => {
        renderPage([], 'loading');
        expect(screen.getByText('Loading…')).toBeInTheDocument();
    });

    test('an error is reported', () => {
        renderPage([], 'error');
        expect(screen.getByText("Couldn't load the bestiary.")).toBeInTheDocument();
    });
});
