jest.mock('../../src/utils/firebase', () => ({ auth: {}, db: {} }));

const mockOnAuthStateChanged = jest.fn();
jest.mock('firebase/auth', () => ({ onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args) }));

let mockCatalog;
jest.mock('../../src/utils/useTagCatalog', () => ({ useTagCatalog: () => mockCatalog }));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ ...jest.requireActual('react-router-dom'), useNavigate: () => mockNavigate }));

// eslint-disable-next-line import/first
import { screen, fireEvent, within } from '@testing-library/react';
// eslint-disable-next-line import/first
import { TagListPage } from '../../src/components/TagListPage';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';

const melee = { id: 't-melee', tagInfo: 'Melee', tagColor: '#00f', textColor: '#fff', isDefault: true, public: true, classes: [], tagDescription: 'Up close' };
const fire = { id: 't-fire', tagInfo: 'Fire', tagColor: '#f00', textColor: '#fff', public: true, canWrite: ['user-1'], classes: [] };
const stance = { id: 't-stance', tagInfo: 'Stance', tagColor: '#0a0', textColor: '#fff', public: true, classes: ['Monk', 'Gunslinger'] };
const secret = { id: 't-secret', tagInfo: 'Homebrew', tagColor: '#000', textColor: '#fff', public: false, canWrite: ['user-1'], classes: ['Monk'] };

function render(tags, status = 'ready', user = { uid: 'user-1' }) {
    mockCatalog = { tags, status };
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
        Promise.resolve().then(() => callback(user));
        return jest.fn();
    });
    renderWithRouter(<TagListPage />);
}

const shown = () => screen.getAllByRole('button').filter(button => button.className.includes('StatusListPage-card')).map(button => button.querySelector('.TagPage-pill').textContent);

describe('TagListPage', () => {
    test('sets the document title and describes what tags are for', () => {
        render([]);
        expect(document.title).toBe('Tags');
        expect(screen.getByText(/Players can filter and sort their actions by them/)).toBeInTheDocument();
    });

    test('shows each tag as a card with its pill, who can see it, and which classes it is for', () => {
        render([melee, stance, secret]);

        expect(shown()).toEqual(['Melee', 'Homebrew', 'Stance']); // defaults first, then A-Z
        expect(screen.getByText('Any class')).toBeInTheDocument();
        expect(screen.getByText('Monk, Gunslinger')).toBeInTheDocument();
        expect(screen.getByText('Default')).toBeInTheDocument();
        expect(screen.getByText('Private')).toBeInTheDocument();
        expect(screen.getByText('Up close')).toBeInTheDocument();
    });

    test('a card opens its tag', () => {
        render([fire]);
        fireEvent.click(screen.getByText('Fire'));
        expect(mockNavigate).toHaveBeenCalledWith('/tags/t-fire');
    });

    test('+ Create New Tag goes to a blank tag page', () => {
        render([]);
        fireEvent.click(screen.getByRole('button', { name: '+ Create New Tag' }));
        expect(mockNavigate).toHaveBeenCalledWith('/tags');
    });

    describe('filters', () => {
        test('Mine keeps only tags the viewer can write, Public only public ones', async () => {
            render([melee, fire, secret]);
            await screen.findByRole('button', { name: 'Mine' });
            await screen.findByText('Homebrew');

            fireEvent.click(screen.getByRole('button', { name: 'Mine' }));
            expect(shown().sort()).toEqual(['Fire', 'Homebrew']);

            fireEvent.click(screen.getByRole('button', { name: 'Public' }));
            expect(shown().sort()).toEqual(['Fire', 'Melee']);

            fireEvent.click(within(screen.getByRole('group', { name: 'Whose' })).getByRole('button', { name: 'All' }));
            expect(shown()).toHaveLength(3);
        });

        test('General keeps tags for any class; a class keeps tags scoped to it', () => {
            render([melee, fire, stance, secret]);

            fireEvent.click(screen.getByRole('button', { name: 'General' }));
            expect(shown().sort()).toEqual(['Fire', 'Melee']);

            fireEvent.click(screen.getByRole('button', { name: 'Gunslinger' }));
            expect(shown()).toEqual(['Stance']);

            fireEvent.click(screen.getByRole('button', { name: 'Monk' }));
            expect(shown().sort()).toEqual(['Homebrew', 'Stance']);
        });

        test('the class filters are the classes the tags are actually scoped to, alphabetical', () => {
            render([melee, stance]);
            const scopeGroup = screen.getByRole('group', { name: 'For' });
            expect([...scopeGroup.querySelectorAll('button')].map(button => button.textContent)).toEqual(['All', 'General', 'Gunslinger', 'Monk']);
        });

        test('says when nothing matches', () => {
            render([melee]);
            fireEvent.click(screen.getByRole('button', { name: 'Mine' }));
            expect(screen.getByText('No tags match these filters.')).toBeInTheDocument();
        });

        test('the chosen filters are marked pressed', () => {
            render([melee]);
            expect(screen.getByRole('button', { name: 'Mine' })).toHaveAttribute('aria-pressed', 'false');
            fireEvent.click(screen.getByRole('button', { name: 'Mine' }));
            expect(screen.getByRole('button', { name: 'Mine' })).toHaveAttribute('aria-pressed', 'true');
        });
    });

    test('says when the tags are still loading', () => {
        render([], 'loading');
        expect(screen.getByText('Loading…')).toBeInTheDocument();
    });

    test('an error is reported instead of an empty catalog', () => {
        render([], 'error');
        expect(screen.getByText("Couldn't load the tags.")).toBeInTheDocument();
    });
});
