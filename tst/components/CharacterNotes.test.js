// DirectorNotes.js imports the real useDirectorNotes.js as its default
// useNotes prop (unused here - CharacterNotes.js always passes its own - but
// still evaluated at module load), which imports firebase.js for real unless
// this is mocked too.
jest.mock('../../src/utils/firebase', () => ({ db: {} }));

let mockHook;
jest.mock('../../src/utils/useCharacterNotes', () => ({
    useCharacterNotes: () => mockHook,
}));

// eslint-disable-next-line import/first
import { render, screen } from '@testing-library/react';
// eslint-disable-next-line import/first
import { CharacterNotes } from '../../src/components/CharacterNotes';

const savePage = jest.fn();
const createPage = jest.fn();
const deletePage = jest.fn();

function setHook(overrides = {}) {
    mockHook = { pages: [], status: 'loading', createPage, savePage, deletePage, ...overrides };
}

function mount(props = {}, hookOverrides = {}) {
    setHook(hookOverrides);
    return render(<CharacterNotes characterId="char-1" {...props} />);
}

beforeEach(() => {
    createPage.mockResolvedValue('new-page');
});

describe('CharacterNotes', () => {
    test('renders the notebook, and its empty state is worded for a character rather than a campaign', () => {
        mount({}, { status: 'ready', pages: [] });
        expect(screen.getByRole('heading', { name: 'Notes' })).toBeInTheDocument();
        expect(screen.getByText(/A notebook for this character/)).toBeInTheDocument();
    });

    test('shows a saved page once the notebook has one', () => {
        mount({}, { status: 'ready', pages: [{ id: 'a', title: 'Session 1', body: 'Met a merchant.', order: 1 }] });
        expect(screen.getByLabelText('Page title')).toHaveValue('Session 1');
        expect(screen.getByLabelText('Page notes')).toHaveValue('Met a merchant.');
    });
});
