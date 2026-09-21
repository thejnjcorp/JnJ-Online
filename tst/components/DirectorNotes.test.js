let mockHook;
jest.mock('../../src/utils/useDirectorNotes', () => ({
    useDirectorNotes: () => mockHook,
}));

// eslint-disable-next-line import/first
import { act, render, screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/first
import { AUTOSAVE_DELAY_MS, DirectorNotes } from '../../src/components/DirectorNotes';

const savePage = jest.fn();
const createPage = jest.fn();
const deletePage = jest.fn();

const pageA = { id: 'a', title: 'Session 1', body: 'The party meets in a tavern.', order: 1 };
const pageB = { id: 'b', title: 'The Lich', body: 'Secretly the mayor.', order: 2 };
const pageC = { id: 'c', title: '', body: '', order: 3 };

function setHook(overrides = {}) {
    mockHook = { pages: [pageA, pageB], status: 'ready', createPage, savePage, deletePage, ...overrides };
}

let view;
function mount(overrides) {
    setHook(overrides);
    view = render(<DirectorNotes campaignId="camp-1" />);
    return view;
}
function update(overrides) {
    setHook(overrides);
    view.rerender(<DirectorNotes campaignId="camp-1" />);
}

const body = () => screen.getByLabelText('Page notes');
const title = () => screen.getByLabelText('Page title');
const type = (element, value) => fireEvent.change(element, { target: { value } });
const advance = async (ms) => { await act(async () => { jest.advanceTimersByTime(ms); }); };

beforeEach(() => {
    jest.useFakeTimers();
    window.localStorage.clear();
    savePage.mockResolvedValue(undefined);
    createPage.mockResolvedValue('new-page');
    deletePage.mockResolvedValue(undefined);
    window.confirm = jest.fn(() => true);
    window.alert = jest.fn();
});

afterEach(() => {
    jest.useRealTimers();
    delete window.confirm;
    delete window.alert;
});

describe('states', () => {
    test('shows a loading message while the notebook loads', () => {
        mount({ status: 'loading', pages: [] });
        expect(screen.getByText('Loading notes…')).toBeInTheDocument();
    });

    test('says so when the notebook cannot be loaded', () => {
        mount({ status: 'error', pages: [] });
        expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load your notes");
    });

    test('an empty notebook explains itself and offers a first page', async () => {
        mount({ pages: [] });
        expect(screen.getByText(/only directors can see it/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Create your first page' }));

        expect(createPage).toHaveBeenCalledWith('New page');
        await advance(0);
    });
});

describe('page list', () => {
    test('lists every page in order, opens the first, and marks the open one as current', () => {
        mount();
        const buttons = screen.getAllByRole('button', { name: /Session 1|The Lich/ });
        expect(buttons.map(button => button.textContent)).toEqual(['Session 1', 'The Lich']);
        expect(screen.getByRole('button', { name: 'Session 1' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('button', { name: 'The Lich' })).not.toHaveAttribute('aria-current');
        expect(title()).toHaveValue('Session 1');
        expect(body()).toHaveValue('The party meets in a tavern.');
    });

    test('flipping to another page shows it', () => {
        mount();
        fireEvent.click(screen.getByRole('button', { name: 'The Lich' }));
        expect(title()).toHaveValue('The Lich');
        expect(body()).toHaveValue('Secretly the mayor.');
        expect(screen.getByRole('button', { name: 'The Lich' })).toHaveAttribute('aria-current', 'page');
    });

    test('a page with no title is listed as "Untitled page"', () => {
        mount({ pages: [pageA, pageC] });
        expect(screen.getByRole('button', { name: 'Untitled page' })).toBeInTheDocument();
    });

    test('reopens the page you had open last time', () => {
        window.localStorage.setItem('jnj-director-notes-page:camp-1', 'b');
        mount();
        expect(title()).toHaveValue('The Lich');
    });

    test('a remembered page that no longer exists falls back to the first', () => {
        window.localStorage.setItem('jnj-director-notes-page:camp-1', 'gone');
        mount();
        expect(title()).toHaveValue('Session 1');
    });

    test('remembers the page you switch to, per campaign', () => {
        mount();
        fireEvent.click(screen.getByRole('button', { name: 'The Lich' }));
        expect(window.localStorage.getItem('jnj-director-notes-page:camp-1')).toBe('b');
    });

    test('blocked storage does not break the notebook', () => {
        const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
        const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
        mount();
        fireEvent.click(screen.getByRole('button', { name: 'The Lich' }));
        expect(title()).toHaveValue('The Lich');
        spy.mockRestore();
        setSpy.mockRestore();
    });

    test('shows when the page was last edited', () => {
        mount({ pages: [{ ...pageA, updatedAt: { toDate: () => new Date(2026, 8, 19, 15, 42) } }, pageB] });
        expect(screen.getByRole('status')).toHaveTextContent(/Last edited .*3:42/);
    });
});

describe('autosave', () => {
    test('saves the page a moment after you stop typing, not on every keystroke', async () => {
        mount();

        type(body(), 'The party meets in a tavern. A stranger enters.');
        expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes…');
        await advance(AUTOSAVE_DELAY_MS - 1);
        expect(savePage).not.toHaveBeenCalled();

        await advance(1);

        expect(savePage).toHaveBeenCalledTimes(1);
        expect(savePage).toHaveBeenCalledWith('a', { title: 'Session 1', body: 'The party meets in a tavern. A stranger enters.' });
        expect(screen.getByRole('status')).toHaveTextContent('All changes saved');
    });

    test('a burst of typing is one save of the final text', async () => {
        mount();
        type(body(), 'a');
        await advance(300);
        type(body(), 'ab');
        await advance(300);
        type(body(), 'abc');

        await advance(AUTOSAVE_DELAY_MS);

        expect(savePage).toHaveBeenCalledTimes(1);
        expect(savePage).toHaveBeenCalledWith('a', { title: 'Session 1', body: 'abc' });
    });

    test('renaming a page updates the list at once and saves the new title', async () => {
        mount();

        type(title(), 'Session 1 - The Tavern');

        expect(screen.getByRole('button', { name: 'Session 1 - The Tavern' })).toBeInTheDocument();
        await advance(AUTOSAVE_DELAY_MS);
        expect(savePage).toHaveBeenCalledWith('a', { title: 'Session 1 - The Tavern', body: 'The party meets in a tavern.' });
    });

    test('clearing the title is allowed (it is shown as Untitled page)', async () => {
        mount();
        type(title(), '');
        expect(screen.getByRole('button', { name: 'Untitled page' })).toBeInTheDocument();
        await advance(AUTOSAVE_DELAY_MS);
        expect(savePage).toHaveBeenCalledWith('a', { title: '', body: 'The party meets in a tavern.' });
    });

    test('flipping to another page saves the one you were on immediately, without waiting', async () => {
        mount();
        type(body(), 'Fresh thoughts');

        fireEvent.click(screen.getByRole('button', { name: 'The Lich' }));
        await advance(0);

        expect(savePage).toHaveBeenCalledWith('a', { title: 'Session 1', body: 'Fresh thoughts' });
        expect(body()).toHaveValue('Secretly the mayor.');
        await advance(AUTOSAVE_DELAY_MS * 2);
        expect(savePage).toHaveBeenCalledTimes(1); // and the pause that was pending doesn't save it a second time
    });

    test('coming back to a page you edited shows your text, not a stale copy', async () => {
        mount();
        type(body(), 'Edited');
        fireEvent.click(screen.getByRole('button', { name: 'The Lich' }));
        await advance(0);
        update({ pages: [{ ...pageA, body: 'Edited' }, pageB] });

        fireEvent.click(screen.getByRole('button', { name: 'Session 1' }));

        expect(body()).toHaveValue('Edited');
    });

    test('leaving the notebook saves what you had typed in the last moment', async () => {
        const { unmount } = mount();
        type(body(), 'Almost lost');

        unmount();
        await advance(0);

        expect(savePage).toHaveBeenCalledWith('a', { title: 'Session 1', body: 'Almost lost' });
    });

    test('closing the browser tab (pagehide) saves it too', async () => {
        mount();
        type(body(), 'Closing the tab');

        act(() => { window.dispatchEvent(new Event('pagehide')); });
        await advance(0);

        expect(savePage).toHaveBeenCalledWith('a', { title: 'Session 1', body: 'Closing the tab' });
    });

    test('nothing is saved for a page you only looked at', async () => {
        mount();
        fireEvent.click(screen.getByRole('button', { name: 'The Lich' }));
        await advance(AUTOSAVE_DELAY_MS * 3);
        expect(savePage).not.toHaveBeenCalled();
    });

    test('a failed save is reported and retried until it goes through, keeping your text', async () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        savePage.mockRejectedValueOnce(new Error('offline'));
        mount();
        type(body(), 'Keep me');

        await advance(AUTOSAVE_DELAY_MS);
        expect(screen.getByRole('status')).toHaveTextContent("Couldn't save - will keep trying");
        expect(body()).toHaveValue('Keep me');

        await advance(5000);

        expect(savePage).toHaveBeenCalledTimes(2);
        expect(savePage).toHaveBeenLastCalledWith('a', { title: 'Session 1', body: 'Keep me' });
        expect(screen.getByRole('status')).toHaveTextContent('All changes saved');
        log.mockRestore();
    });

    test('text typed while a save is in flight is saved afterwards, not lost', async () => {
        let finishFirst;
        savePage.mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }));
        mount();
        type(body(), 'first');
        await advance(AUTOSAVE_DELAY_MS);
        expect(screen.getByRole('status')).toHaveTextContent('Saving…');

        type(body(), 'first and second');
        await act(async () => { finishFirst(); });
        await advance(AUTOSAVE_DELAY_MS);

        expect(savePage).toHaveBeenCalledTimes(2);
        expect(savePage).toHaveBeenLastCalledWith('a', { title: 'Session 1', body: 'first and second' });
        // Firestore reports our own saved write straight back to the listener
        update({ pages: [{ ...pageA, body: 'first and second' }, pageB] });
        expect(body()).toHaveValue('first and second');
    });
});

describe('live updates from another device', () => {
    test('a change to the open page shows up when you are not editing it', () => {
        mount();
        update({ pages: [{ ...pageA, body: 'Changed elsewhere' }, pageB] });
        expect(body()).toHaveValue('Changed elsewhere');
    });

    test('a change never overwrites what you are in the middle of typing', () => {
        mount();
        type(body(), 'My unsaved words');

        update({ pages: [{ ...pageA, body: 'Changed elsewhere' }, pageB] });

        expect(body()).toHaveValue('My unsaved words');
    });

    test('once your text is saved, later changes from elsewhere show again', async () => {
        mount();
        type(body(), 'Mine');
        await advance(AUTOSAVE_DELAY_MS);
        update({ pages: [{ ...pageA, body: 'Mine' }, pageB] });

        update({ pages: [{ ...pageA, body: 'Theirs' }, pageB] });

        expect(body()).toHaveValue('Theirs');
    });

    test('a page added elsewhere appears in the list', () => {
        mount();
        update({ pages: [pageA, pageB, { id: 'd', title: 'Villains', body: '', order: 4 }] });
        expect(screen.getByRole('button', { name: 'Villains' })).toBeInTheDocument();
    });

    test('if the open page is deleted elsewhere you land on another page', () => {
        window.localStorage.setItem('jnj-director-notes-page:camp-1', 'b');
        mount();
        update({ pages: [pageA] });
        expect(title()).toHaveValue('Session 1');
    });
});

describe('new page', () => {
    test('creates a page, opens it, and puts the cursor in its title', async () => {
        mount();

        fireEvent.click(screen.getByRole('button', { name: '+ New page' }));
        await advance(0);
        update({ pages: [pageA, pageB, { id: 'new-page', title: 'New page', body: '', order: 3 }] });
        await advance(0);

        expect(createPage).toHaveBeenCalledWith('New page');
        expect(title()).toHaveValue('New page');
        expect(title()).toHaveFocus();
    });

    test('the new page stays open even if its snapshot arrives a moment later than the id', async () => {
        mount();

        fireEvent.click(screen.getByRole('button', { name: '+ New page' }));
        await advance(0);
        // not in the list yet: the page you were on must not snap back
        expect(screen.queryByLabelText('Page title')).not.toBeInTheDocument();
        update({ pages: [pageA, pageB, { id: 'new-page', title: 'New page', body: '', order: 3 }] });

        expect(title()).toHaveValue('New page');
    });

    test('saves the page you were on before moving to the new one', async () => {
        mount();
        type(body(), 'Not yet saved');

        fireEvent.click(screen.getByRole('button', { name: '+ New page' }));
        await advance(0);

        expect(savePage).toHaveBeenCalledWith('a', { title: 'Session 1', body: 'Not yet saved' });
    });

    test('a failure to create is reported', async () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        createPage.mockRejectedValue(new Error('denied'));
        mount();

        fireEvent.click(screen.getByRole('button', { name: '+ New page' }));
        await advance(0);

        expect(window.alert).toHaveBeenCalledWith("Couldn't create a new page.");
        log.mockRestore();
    });
});

describe('delete page', () => {
    test('asks first, and does nothing if you say no', async () => {
        window.confirm.mockReturnValue(false);
        mount();

        fireEvent.click(screen.getByRole('button', { name: 'Delete page' }));
        await advance(0);

        expect(window.confirm).toHaveBeenCalledWith('Delete "Session 1"? This can\'t be undone.');
        expect(deletePage).not.toHaveBeenCalled();
    });

    test('deletes the open page and moves to the next one', async () => {
        mount({ pages: [pageA, pageB, pageC] });
        fireEvent.click(screen.getByRole('button', { name: 'The Lich' }));

        fireEvent.click(screen.getByRole('button', { name: 'Delete page' }));
        await advance(0);
        update({ pages: [pageA, pageC] });

        expect(deletePage).toHaveBeenCalledWith('b');
        expect(screen.getByRole('button', { name: 'Untitled page' })).toHaveAttribute('aria-current', 'page');
    });

    test('deleting the last page in the list moves to the previous one', async () => {
        mount();
        fireEvent.click(screen.getByRole('button', { name: 'The Lich' }));

        fireEvent.click(screen.getByRole('button', { name: 'Delete page' }));
        await advance(0);
        update({ pages: [pageA] });

        expect(title()).toHaveValue('Session 1');
    });

    test('deleting the only page returns to the empty notebook', async () => {
        mount({ pages: [pageA] });

        fireEvent.click(screen.getByRole('button', { name: 'Delete page' }));
        await advance(0);
        update({ pages: [] });

        expect(screen.getByRole('button', { name: 'Create your first page' })).toBeInTheDocument();
    });

    test('edits you had not saved yet are dropped with the page, not saved back after it is gone', async () => {
        mount();
        type(body(), 'About to be deleted');

        fireEvent.click(screen.getByRole('button', { name: 'Delete page' }));
        await advance(AUTOSAVE_DELAY_MS * 2);

        expect(deletePage).toHaveBeenCalledWith('a');
        expect(savePage).not.toHaveBeenCalled();
    });

    test('a failure to delete is reported', async () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        deletePage.mockRejectedValue(new Error('denied'));
        mount();

        fireEvent.click(screen.getByRole('button', { name: 'Delete page' }));
        await advance(0);

        expect(window.alert).toHaveBeenCalledWith("Couldn't delete this page.");
        log.mockRestore();
    });
});

describe('DirectorNotes serving as the party\'s notebook', () => {
    const partyPages = [{ id: 'p1', title: 'Session 1', body: 'We began.', updatedAt: { toDate: () => new Date(2026, 8, 20, 14, 5) }, updated_by_name: 'Sam' }];
    const makeHook = (pages = partyPages, status = 'ready') => jest.fn(() => ({ pages, status, createPage: jest.fn().mockResolvedValue('p2'), savePage: jest.fn().mockResolvedValue(undefined), deletePage: jest.fn() }));
    const text = { heading: 'Party notes', intro: 'A notebook the whole party shares.', errorText: "Couldn't load the party notes.", storagePrefix: 'jnj-party-notes-page' };

    test('loads its pages with the hook it is given, for the campaign it is given, not the director\'s', () => {
        setHook({ pages: [{ id: 'dir', title: 'Secret villain', body: '', order: 1 }] }); // what the director's own hook would give
        const useNotes = makeHook();
        render(<DirectorNotes campaignId="camp-9" useNotes={useNotes} {...text}/>);
        expect(useNotes).toHaveBeenCalledWith('camp-9');
        expect(screen.getByRole('button', { name: 'Session 1' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Secret villain' })).not.toBeInTheDocument();
    });

    test('an empty notebook is worded for the party', () => {
        render(<DirectorNotes campaignId="camp-9" useNotes={makeHook([])} {...text}/>);
        expect(screen.getByRole('heading', { name: 'Party notes' })).toBeInTheDocument();
        expect(screen.getByText('A notebook the whole party shares.')).toBeInTheDocument();
        expect(screen.queryByText(/only directors can see it/)).not.toBeInTheDocument();
    });

    test('a notebook that cannot load says so in the party\'s words', () => {
        render(<DirectorNotes campaignId="camp-9" useNotes={makeHook([], 'error')} {...text}/>);
        expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load the party notes.");
    });

    test('says who last changed the page, when the pages say', () => {
        render(<DirectorNotes campaignId="camp-9" useNotes={makeHook()} {...text}/>);
        expect(screen.getByRole('status')).toHaveTextContent(/Last edited .* by Sam/);
    });

    test('remembers the open page separately from the director\'s notebook', () => {
        window.localStorage.clear();
        render(<DirectorNotes campaignId="camp-9" useNotes={makeHook([...partyPages, { id: 'p2', title: 'Session 2', body: '', order: 2 }])} {...text}/>);
        fireEvent.click(screen.getByRole('button', { name: 'Session 2' }));
        expect(window.localStorage.getItem('jnj-party-notes-page:camp-9')).toBe('p2');
        expect(window.localStorage.getItem('jnj-director-notes-page:camp-9')).toBeNull();
    });

    test('without those props it is the director\'s notebook, as before', () => {
        setHook({ pages: [] });
        render(<DirectorNotes campaignId="camp-1"/>);
        expect(screen.getByRole('heading', { name: "Director's notes" })).toBeInTheDocument();
        expect(screen.getByText(/only directors can see it/)).toBeInTheDocument();
    });
});
