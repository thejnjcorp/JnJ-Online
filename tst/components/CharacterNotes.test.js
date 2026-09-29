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
    return render(<CharacterNotes characterId="char-1" legacyNotes="" canEdit={true} {...props} />);
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

    describe('importing the old single-field notes', () => {
        test('an empty notebook with old notes and edit access imports them as a first page, titled "Notes"', () => {
            mount({ legacyNotes: 'Met a merchant.', canEdit: true }, { status: 'ready', pages: [] });
            expect(createPage).toHaveBeenCalledWith('Notes', 'Met a merchant.');
        });

        test('does not import when the notebook already has pages', () => {
            mount({ legacyNotes: 'Met a merchant.', canEdit: true }, { status: 'ready', pages: [{ id: 'a', title: 'X', body: '', order: 1 }] });
            expect(createPage).not.toHaveBeenCalled();
        });

        test('does not import blank or whitespace-only old notes', () => {
            mount({ legacyNotes: '   ', canEdit: true }, { status: 'ready', pages: [] });
            expect(createPage).not.toHaveBeenCalled();
        });

        test('does not import for a read-only viewer', () => {
            mount({ legacyNotes: 'Met a merchant.', canEdit: false }, { status: 'ready', pages: [] });
            expect(createPage).not.toHaveBeenCalled();
        });

        test('does not import before the notebook has actually loaded', () => {
            mount({ legacyNotes: 'Met a merchant.', canEdit: true }, { status: 'loading', pages: [] });
            expect(createPage).not.toHaveBeenCalled();
        });

        test('an empty notebook with no old notes creates nothing - the normal empty state shows instead', () => {
            mount({ legacyNotes: '', canEdit: true }, { status: 'ready', pages: [] });
            expect(createPage).not.toHaveBeenCalled();
            expect(screen.getByRole('button', { name: 'Create your first page' })).toBeInTheDocument();
        });

        test('only imports once, even if it rerenders while still empty (e.g. import failed)', () => {
            setHook({ status: 'ready', pages: [] });
            const { rerender } = render(<CharacterNotes characterId="char-1" legacyNotes="Met a merchant." canEdit={true} />);
            expect(createPage).toHaveBeenCalledTimes(1);

            rerender(<CharacterNotes characterId="char-1" legacyNotes="Met a merchant." canEdit={true} />);
            expect(createPage).toHaveBeenCalledTimes(1);
        });
    });
});
