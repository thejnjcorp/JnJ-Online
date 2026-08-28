/* eslint-disable testing-library/no-container, testing-library/no-node-access --
   the summary sidebar's hover/focus wrapper is a plain non-interactive div
   with no accessible role or text while collapsed, so container access is
   the only way to fire mouse/focus events on it. */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BlogPages from '../../src/components/BlogPages';

// BlogPages dynamically imports `../markdown/${post}.md`, which the CRA jest
// fileTransform resolves to the bare filename (no network/loader involved) -
// so "JnJ_Ruleset" (the one real file under src/markdown) is the only post
// name that resolves without hitting the catch branch.
const markdown = `# Welcome
intro text

# Getting Started
## Step One
do the first thing
## Step Two
do the second thing

# Advanced Topics
## Deep Dive
content`;

function sidebarOf(container) {
    return container.querySelector('.BlogPage-summary-sidebar');
}

beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ text: () => Promise.resolve(markdown) });
    window.scrollTo = jest.fn();
});

afterEach(() => {
    delete global.fetch;
    delete window.scrollTo;
});

describe('BlogPages', () => {
    test('sets the document title to the post name', async () => {
        render(<BlogPages post="JnJ_Ruleset" />);
        expect(document.title).toBe('JnJ_Ruleset');
        await screen.findByText('intro text');
    });

    test('fetches the resolved markdown asset for the given post', async () => {
        render(<BlogPages post="JnJ_Ruleset" />);
        await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('JnJ_Ruleset.md'));
    });

    test('a post with no matching markdown file is logged and swallowed, without crashing', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        render(<BlogPages post="NoSuchPost" />);

        await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
        expect(global.fetch).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    describe('once loaded', () => {
        test('renders the first section unconditionally, then the current page beneath the nav buttons', async () => {
            render(<BlogPages post="JnJ_Ruleset" />);
            expect(await screen.findByText('intro text')).toBeInTheDocument();
            expect(screen.getByRole('heading', { name: 'Welcome' })).toBeInTheDocument();
            expect(screen.getByRole('heading', { name: 'Getting Started' })).toBeInTheDocument();
            expect(screen.getByText('do the first thing')).toBeInTheDocument();
        });

        describe('pagination', () => {
            test('Previous Page starts disabled on the first navigable page', async () => {
                render(<BlogPages post="JnJ_Ruleset" />);
                await screen.findByText('intro text');
                expect(screen.getAllByRole('button', { name: 'Previous Page' })[0]).toBeDisabled();
                expect(screen.getAllByRole('button', { name: 'Next Page' })[0]).toBeEnabled();
            });

            test('Next Page advances to the next section and scrolls to top', async () => {
                render(<BlogPages post="JnJ_Ruleset" />);
                await screen.findByText('intro text');

                fireEvent.click(screen.getAllByRole('button', { name: 'Next Page' })[0]);

                expect(screen.getByRole('heading', { name: 'Advanced Topics' })).toBeInTheDocument();
                expect(screen.getByText('content')).toBeInTheDocument();
                expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
            });

            test('Next Page becomes disabled on the last section', async () => {
                render(<BlogPages post="JnJ_Ruleset" />);
                await screen.findByText('intro text');
                fireEvent.click(screen.getAllByRole('button', { name: 'Next Page' })[0]);

                expect(screen.getAllByRole('button', { name: 'Next Page' })[0]).toBeDisabled();
            });

            test('Previous Page returns to the prior section', async () => {
                render(<BlogPages post="JnJ_Ruleset" />);
                await screen.findByText('intro text');
                fireEvent.click(screen.getAllByRole('button', { name: 'Next Page' })[0]);

                fireEvent.click(screen.getAllByRole('button', { name: 'Previous Page' })[0]);

                expect(screen.getByRole('heading', { name: 'Getting Started' })).toBeInTheDocument();
                expect(screen.getAllByRole('button', { name: 'Previous Page' })[0]).toBeDisabled();
            });
        });

        describe('summary sidebar', () => {
            test('is hidden until hovered, and hides again on mouse-out', async () => {
                const { container } = render(<BlogPages post="JnJ_Ruleset" />);
                await screen.findByText('intro text');
                expect(screen.queryByText('Pages:')).not.toBeInTheDocument();

                fireEvent.mouseOver(sidebarOf(container));
                expect(screen.getByText('Pages:')).toBeInTheDocument();

                fireEvent.mouseOut(sidebarOf(container));
                expect(screen.queryByText('Pages:')).not.toBeInTheDocument();
            });

            test('opens on focus and closes on blur too', async () => {
                const { container } = render(<BlogPages post="JnJ_Ruleset" />);
                await screen.findByText('intro text');

                fireEvent.focus(sidebarOf(container));
                expect(screen.getByText('Pages:')).toBeInTheDocument();

                fireEvent.blur(sidebarOf(container));
                expect(screen.queryByText('Pages:')).not.toBeInTheDocument();
            });

            test('lists every section header except the very first (cover) one, each with its own subheaders', async () => {
                const { container } = render(<BlogPages post="JnJ_Ruleset" />);
                await screen.findByText('intro text');
                fireEvent.mouseOver(sidebarOf(container));

                expect(screen.queryByRole('button', { name: 'Welcome' })).not.toBeInTheDocument();
                expect(screen.getAllByRole('button', { name: 'Getting Started' }).length).toBeGreaterThan(0);
                expect(screen.getAllByRole('button', { name: 'Advanced Topics' }).length).toBeGreaterThan(0);
                expect(screen.getByText('- Step One')).toBeInTheDocument();
                expect(screen.getByText('- Step Two')).toBeInTheDocument();
                expect(screen.getByText('- Deep Dive')).toBeInTheDocument();
            });

            test('a subheader link points at a slug built from its own text', async () => {
                const { container } = render(<BlogPages post="JnJ_Ruleset" />);
                await screen.findByText('intro text');
                fireEvent.mouseOver(sidebarOf(container));

                expect(screen.getByText('- Deep Dive')).toHaveAttribute('href', '#deep-div');
            });

            test('clicking a sidebar header jumps the main view to that section', async () => {
                const { container } = render(<BlogPages post="JnJ_Ruleset" />);
                await screen.findByText('intro text');
                fireEvent.mouseOver(sidebarOf(container));

                const buttons = screen.getAllByRole('button', { name: 'Advanced Topics' });
                fireEvent.click(buttons[buttons.length - 1]);

                expect(screen.getByText('content')).toBeInTheDocument();
            });
        });
    });
});
