const mockMapProps = [];
jest.mock('../../src/utils/DraggableElements/PostListCombatMap.tsx', () => ({
    PostListContentCombatMap: props => {
        mockMapProps.push(props);
        return <div>CombatMap-stub:{props.campaignId}:{props.activeMap?.map_id}:{props.entities.length}</div>;
    },
}));

// eslint-disable-next-line import/first
import { render, screen, fireEvent, act } from '@testing-library/react';
// eslint-disable-next-line import/first
import { CombatMapPeek } from '../../src/components/CombatMapPeek';

const activeMap = { map_id: 'map-1' };

function setup() {
    render(<CombatMapPeek campaignId="camp-1" activeMap={activeMap} entities={[{ id: 'a' }, { id: 'b' }]} userId="player-1" />);
    return {
        icon: screen.getByRole('button', { name: 'Combat map' }),
        wrapper: document.querySelector('.CombatMapPeek'),
    };
}

const hover = wrapper => fireEvent.mouseEnter(wrapper);
const leave = (wrapper, buttons = 0) => fireEvent.mouseLeave(wrapper, { buttons });
const settle = ms => act(() => { jest.advanceTimersByTime(ms); });
const panel = () => screen.queryByRole('region', { name: 'Combat map' });

beforeEach(() => {
    jest.useFakeTimers();
    mockMapProps.length = 0;
});

afterEach(() => {
    jest.useRealTimers();
});

describe('CombatMapPeek', () => {
    test('is just a map icon until you point at it', () => {
        const { icon } = setup();
        expect(icon).toHaveAttribute('aria-expanded', 'false');
        expect(panel()).not.toBeInTheDocument();
        expect(screen.queryByText(/CombatMap-stub/)).not.toBeInTheDocument();
    });

    test('hovering the icon slides the combat map out, after a moment', () => {
        const { icon, wrapper } = setup();
        hover(wrapper);
        expect(panel()).not.toBeInTheDocument(); // not for a mouse just passing over
        settle(150);

        expect(panel()).toBeInTheDocument();
        expect(icon).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('CombatMap-stub:camp-1:map-1:2')).toBeInTheDocument();
    });

    test('the map is the campaign\'s, with the active map, who is in the fight, and who is looking', () => {
        const { wrapper } = setup();
        hover(wrapper);
        settle(150);
        expect(mockMapProps.at(-1)).toMatchObject({ campaignId: 'camp-1', activeMap, userId: 'player-1', noActiveMapMessage: "The director hasn't set an active combat map yet." });
    });

    test('moving off it tucks the map away, after a moment', () => {
        const { wrapper } = setup();
        hover(wrapper);
        settle(150);

        leave(wrapper);
        expect(panel()).toBeInTheDocument();
        settle(300);

        expect(panel()).not.toBeInTheDocument();
    });

    test('moving off and straight back keeps it open', () => {
        const { wrapper } = setup();
        hover(wrapper);
        settle(150);

        leave(wrapper);
        settle(100);
        hover(wrapper);
        settle(400);

        expect(panel()).toBeInTheDocument();
    });

    test('a mouse that only brushes past never opens it', () => {
        const { wrapper } = setup();
        hover(wrapper);
        settle(50);
        leave(wrapper);
        settle(500);
        expect(panel()).not.toBeInTheDocument();
    });

    test('leaving with the mouse button held (dragging a token) does not close it', () => {
        const { wrapper } = setup();
        hover(wrapper);
        settle(150);

        leave(wrapper, 1);
        settle(1000);

        expect(panel()).toBeInTheDocument();
    });

    test('clicking the icon pins it open, so it stays when the mouse leaves', () => {
        const { icon, wrapper } = setup();
        fireEvent.click(icon);
        expect(panel()).toBeInTheDocument();

        leave(wrapper);
        settle(1000);

        expect(panel()).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Close the combat map' })).toBeInTheDocument();
    });

    test('clicking the icon again, or the close button, unpins it', () => {
        const { icon } = setup();
        fireEvent.click(icon);
        fireEvent.click(icon);
        expect(panel()).not.toBeInTheDocument();

        fireEvent.click(icon);
        fireEvent.click(screen.getByRole('button', { name: 'Close the combat map' }));
        expect(panel()).not.toBeInTheDocument();
    });

    test('Escape closes it, hovered or pinned', () => {
        const { icon, wrapper } = setup();
        hover(wrapper);
        settle(150);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(panel()).not.toBeInTheDocument();

        fireEvent.click(icon);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(panel()).not.toBeInTheDocument();
    });

    test('a hover-only map has no close button (moving away closes it)', () => {
        const { wrapper } = setup();
        hover(wrapper);
        settle(150);
        expect(screen.queryByRole('button', { name: 'Close the combat map' })).not.toBeInTheDocument();
    });

    test('with no active map it says so, instead of a map', () => {
        render(<CombatMapPeek campaignId="camp-1" activeMap={undefined} entities={[]} userId="player-1" />);
        fireEvent.click(screen.getAllByRole('button', { name: 'Combat map' })[0]);
        expect(mockMapProps.at(-1).activeMap).toBeUndefined();
        expect(mockMapProps.at(-1).noActiveMapMessage).toMatch(/hasn't set an active combat map/);
    });
});
