// App.js owns its own <BrowserRouter> (can't be wrapped in another Router)
// and imports every page component in the app. Each page gets its own
// dedicated test file for what it actually renders - here, every page is
// stubbed to a simple marker so these tests can focus on what's actually
// App.js's own logic: the routing table, the theme class effect, the
// markdown-fetch-driven blog routes, and the auth listener.
let mockAuthCallback;
const mockUnsubscribe = jest.fn();
jest.mock('../../src/utils/firebase.js', () => ({
    auth: { onAuthStateChanged: (cb) => { mockAuthCallback = cb; return mockUnsubscribe; } },
}));

jest.mock('../../src/components/Homepage', () => ({ Homepage: () => <div>Homepage-stub</div> }));
jest.mock('../../src/components/Blog', () => ({ Blog: ({ markdowns }) => <div>Blog-stub:{(markdowns || []).join(',')}</div> }));
jest.mock('../../src/components/Navigation', () => ({ Navigation: ({ userInfo }) => <div>Navigation-stub:{userInfo ? userInfo.uid : 'signed-out'}</div> }));
jest.mock('../../src/components/BlogPages', () => ({ __esModule: true, default: ({ post }) => <div>BlogPages-stub:{post}</div> }));
jest.mock('../../src/components/InvalidPage', () => ({ InvalidPage: () => <div>InvalidPage-stub</div> }));
jest.mock('../../src/components/Characters.js', () => ({ Characters: () => <div>Characters-stub</div> }));
jest.mock('../../src/components/Campaigns.js', () => ({ Campaigns: () => <div>Campaigns-stub</div> }));
jest.mock('../../src/components/AccountPage.js', () => ({ AccountPage: () => <div>AccountPage-stub</div> }));
jest.mock('../../src/components/DirectorsPage.js', () => ({ DirectorsPage: () => <div>DirectorsPage-stub</div> }));
jest.mock('../../src/components/ClassPage.js', () => ({ ClassPage: () => <div>ClassPage-stub</div> }));
jest.mock('../../src/components/ClassListPage.js', () => ({ ClassListPage: () => <div>ClassListPage-stub</div> }));
jest.mock('../../src/components/StatusPage.js', () => ({ StatusPage: () => <div>StatusPage-stub</div> }));
jest.mock('../../src/components/StatusListPage.js', () => ({ StatusListPage: () => <div>StatusListPage-stub</div> }));

// eslint-disable-next-line import/first
import { render, screen, act } from '@testing-library/react';
// eslint-disable-next-line import/first
import App from '../../src/components/App';

function setPath(path) {
    window.history.pushState({}, '', `/JnJ-Online${path}`);
}

// Renders App and fully drains its mount-time fetch('/allFileNames.txt')
// chain (fetch -> .then(r => r.text()) -> .then(text => setMarkdowns(...)),
// two microtask hops deep) before returning, so that state update never
// leaks into a later, unrelated assertion (or the next test) outside of
// act(). A setTimeout(0) macrotask reliably runs after any number of
// pending microtasks, unlike waitFor(() => fetch called), which only
// confirms the first hop.
async function renderApp(path) {
    setPath(path);
    const view = render(<App />);
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
    return view;
}

beforeEach(() => {
    mockAuthCallback = undefined;
    global.fetch = jest.fn().mockResolvedValue({ text: () => Promise.resolve('') });
    document.documentElement.classList.remove('Theme-DarkArcane');
});

afterEach(() => {
    delete global.fetch;
});

describe('App', () => {
    test('adds the theme class to <html> on mount and removes it on unmount', async () => {
        const { unmount } = await renderApp('/home');
        expect(document.documentElement.classList.contains('Theme-DarkArcane')).toBe(true);

        unmount();
        expect(document.documentElement.classList.contains('Theme-DarkArcane')).toBe(false);
    });

    test('renders Navigation alongside the routed page', async () => {
        await renderApp('/home');
        expect(screen.getByText(/Navigation-stub/)).toBeInTheDocument();
        expect(screen.getByText('Homepage-stub')).toBeInTheDocument();
    });

    test('the root path redirects to /home', async () => {
        await renderApp('/');
        expect(screen.getByText('Homepage-stub')).toBeInTheDocument();
    });

    test('an unmatched path renders InvalidPage', async () => {
        await renderApp('/this-page-does-not-exist');
        expect(screen.getByText('InvalidPage-stub')).toBeInTheDocument();
    });

    test.each([
        ['/characters', 'Characters-stub'],
        ['/campaigns', 'Campaigns-stub'],
        ['/account', 'AccountPage-stub'],
        ['/directors', 'DirectorsPage-stub'],
        ['/classes', 'ClassPage-stub'],
        ['/class-list', 'ClassListPage-stub'],
        ['/statuses', 'StatusPage-stub'],
        ['/status-list', 'StatusListPage-stub'],
        ['/blog', 'Blog-stub:'],
    ])('%s routes to the right page', async (path, expectedText) => {
        await renderApp(path);
        expect(screen.getByText(expectedText, { exact: false })).toBeInTheDocument();
    });

    test('fetches the markdown file list on mount and builds a /blog/<file> route per entry', async () => {
        global.fetch.mockResolvedValue({ text: () => Promise.resolve('JnJ_Ruleset\nHomebrew\n') });

        await renderApp('/blog/Homebrew');

        expect(await screen.findByText('BlogPages-stub:Homebrew')).toBeInTheDocument();
        expect(global.fetch).toHaveBeenCalledWith('/JnJ-Online/allFileNames.txt');
    });

    test('the trailing blank line from the markdown file list is dropped, not turned into an empty-string route', async () => {
        global.fetch.mockResolvedValue({ text: () => Promise.resolve('JnJ_Ruleset\nHomebrew\n') });

        await renderApp('/blog');

        // the /blog listing page gets exactly the two real filenames, joined - no trailing empty entry from the final "\n"
        expect(await screen.findByText('Blog-stub:JnJ_Ruleset,Homebrew')).toBeInTheDocument();
    });

    test('passes the signed-in user down to Navigation once the auth listener fires', async () => {
        await renderApp('/home');
        expect(screen.getByText('Navigation-stub:signed-out')).toBeInTheDocument();

        act(() => mockAuthCallback({ uid: 'user-123' }));

        expect(await screen.findByText('Navigation-stub:user-123')).toBeInTheDocument();
    });

    test('unsubscribes the auth listener on unmount', async () => {
        const { unmount } = await renderApp('/home');
        unmount();
        expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
});
