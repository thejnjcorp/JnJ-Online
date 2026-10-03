/* eslint-disable testing-library/no-node-access -- the scrolling row and the strip's bar have no role or text to find them by */
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ScenesCampaignView } from '../../src/components/ScenesCampaignView';

const session = (id, number, extra = {}) => ({ id, number, ...extra });
const scene = (id, sessionId, status, extra = {}) => ({ id, sessionId, name: `Scene ${id}`, status, order: 1, beats: [], ...extra });

const sessions = [session('s1', 1, { arc: 'Arc 1' }), session('s2', 2, { arc: 'Arc 1' }), session('s3', 3, { arc: 'Arc 2' }), session('s4', 4, { arc: 'Arc 2' })];
const scenes = [scene('a', 's1', 'completed'), scene('b', 's2', 'active'), scene('c', 's2', 'ready', { order: 2 }), scene('d', 's3', 'ready')];

function setup(props = {}) {
    const handlers = { onOpenSession: jest.fn(), onNewSession: jest.fn(), onNewScene: jest.fn() };
    render(<ScenesCampaignView sessions={sessions} scenes={scenes} {...handlers} {...props}/>);
    return handlers;
}

// a row of 4 cards 100 wide in a frame 250 wide, scrolled by `left`
function layout(left = 0) {
    const row = screen.getByRole('button', { name: 'Scroll to later sessions' }).parentElement.firstChild;
    Object.defineProperty(row, 'clientWidth', { configurable: true, value: 250 });
    Object.defineProperty(row, 'scrollWidth', { configurable: true, value: 400 });
    row.scrollLeft = left;
    row.scrollTo = jest.fn();
    row.scrollBy = jest.fn();
    ['s1', 's2', 's3', 's4'].forEach((id, index) => {
        const card = screen.getByRole('button', { name: new RegExp(`Session ${index + 1},`) });
        Object.defineProperty(card, 'offsetLeft', { configurable: true, value: index * 100 });
        Object.defineProperty(card, 'offsetWidth', { configurable: true, value: 100 });
    });
    fireEvent.scroll(row);
    return row;
}

describe('the sessions row', () => {
    test('has every session as a card, under the heading of its arc', () => {
        setup();
        expect(screen.getByRole('heading', { name: 'Arc 1 · Sessions 1–2' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Arc 2 · Sessions 3–4' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Session 2, Now' })).toBeInTheDocument();
    });

    test('the session being played lists its scenes by name; the others show marks', () => {
        setup();
        expect(within(screen.getByRole('button', { name: 'Session 2, Now' })).getByText('Scene b')).toBeInTheDocument();
        expect(within(screen.getByRole('button', { name: 'Session 1, Played' })).queryByText('Scene a')).not.toBeInTheDocument();
    });

    test('clicking a card zooms into it', () => {
        const { onOpenSession } = setup();
        fireEvent.click(screen.getByRole('button', { name: 'Session 3, Planned' }));
        expect(onOpenSession).toHaveBeenCalledWith('s3');
    });

    test('the arrows scroll the row a screenful either way, and the one at the end it has reached is off', () => {
        setup();
        const row = layout(0);
        expect(screen.getByRole('button', { name: 'Scroll to earlier sessions' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Scroll to later sessions' }));
        expect(row.scrollBy).toHaveBeenCalledWith({ left: 200, behavior: 'smooth' });
        layout(150);
        expect(screen.getByRole('button', { name: 'Scroll to earlier sessions' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Scroll to later sessions' })).toBeDisabled();
    });
});

describe('the whole campaign strip', () => {
    // (jsdom has no pointer events: a mouse event of that name stands in)
    const pointer = (element, type, x, extra) => fireEvent(element, Object.assign(new MouseEvent(type, { bubbles: true, clientX: x, ...extra }), { pointerId: 1 }));
    const strip = () => screen.getByRole('region', { name: 'Whole campaign' });

    test('is a block for each session, coloured by how far it has got, with its number under it', () => {
        setup();
        const blocks = within(strip()).getAllByRole('button');
        expect(blocks.map(block => block.className)).toEqual([
            'Scenes-minimap-block Scenes-minimap-block-played',
            'Scenes-minimap-block Scenes-minimap-block-now',
            'Scenes-minimap-block Scenes-minimap-block-planned',
            'Scenes-minimap-block Scenes-minimap-block-empty',
        ]);
        expect(within(strip()).getByText('2')).toHaveClass('Scenes-minimap-now');
    });

    test('says which sessions the row is showing, and frames them', () => {
        setup();
        layout(0);
        expect(within(strip()).getByText('Showing sessions 1–3 of 4. Drag the frame to move.')).toBeInTheDocument();
        layout(150);
        expect(within(strip()).getByText('Showing sessions 2–4 of 4. Drag the frame to move.')).toBeInTheDocument();
    });

    test('dragging along it moves the row to the session under the pointer', () => {
        setup();
        const row = layout(0);
        const bar = within(strip()).getAllByRole('button')[0].parentElement;
        bar.getBoundingClientRect = () => ({ left: 0, width: 400 });
        pointer(bar, 'pointerdown', 390, { button: 0, buttons: 1 });
        // the frame holds 3 of the 4, so the last it can start from is the second
        expect(row.scrollTo).toHaveBeenLastCalledWith({ left: 84, behavior: 'auto' });
        pointer(bar, 'pointermove', 10, { buttons: 1 });
        expect(row.scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'auto' });
    });

    test('a block can be used from the keyboard to go to its session', () => {
        setup();
        const row = layout(0);
        fireEvent.click(within(strip()).getByRole('button', { name: 'Show Session 4' }));
        expect(row.scrollTo).toHaveBeenLastCalledWith({ left: 284, behavior: 'smooth' });
    });

    test('is left out for a campaign with one session', () => {
        setup({ sessions: [sessions[0]] });
        expect(screen.queryByRole('region', { name: 'Whole campaign' })).not.toBeInTheDocument();
    });
});
