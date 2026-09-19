jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockOnSnapshot = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...args) => ({ __doc: args.slice(1) }),
    onSnapshot: (...args) => mockOnSnapshot(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
    arrayUnion: value => ({ __arrayUnion: value }),
}));

// The map itself (image sizing, drag and drop) is out of scope here: a stand-in
// that hands its overlay a size, like the real one does once the image loads,
// and records what zoneLayout it was given.
const mockAbstractProps = [];
jest.mock('../../src/utils/DraggableElements/Post.ts', () => ({
    PostListContentAbstract: props => {
        mockAbstractProps.push(props);
        return <div data-testid="map">{props.overlay({ width: 1000, height: 500 })}</div>;
    },
}));

// eslint-disable-next-line import/first
import { render, screen } from '@testing-library/react';
// eslint-disable-next-line import/first
import { PostListContentCombatMap } from '../../src/utils/DraggableElements/PostListCombatMap.tsx';

const stroke = id => ({ id, color: '#e53935', size: 0.006, points: [0.1, 0.1, 0.4, 0.2] });
const zone = (name, x) => ({ id: name, name, x, y: 10, width: 100, height: 80 });
const activeMap = (extra = {}) => ({ map_id: 'map-1', link: 'map.png', zones: [zone('Zone 1', 10), zone('Zone 2', 200)], canWrite: ['director-1'], strokes: [stroke('a')], ...extra });

beforeEach(() => {
    mockAbstractProps.length = 0;
    mockOnSnapshot.mockImplementation(() => jest.fn());
});

describe('PostListContentCombatMap drawing', () => {
    test('everyone sees what has been drawn over the map, without any tools', () => {
        const { container } = render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} userId="player-1" />);
        expect(container.querySelectorAll('.MapDrawing-stroke')).toHaveLength(1);
        expect(screen.queryByRole('toolbar', { name: 'Map drawing tools' })).not.toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Map drawing' })).not.toHaveClass('MapDrawing-active');
    });

    test('someone who can edit the map gets the drawing tools', () => {
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} userId="director-1" />);
        expect(screen.getByRole('toolbar', { name: 'Map drawing tools' })).toBeInTheDocument();
    });

    test('without a signed-in user there are no tools', () => {
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} />);
        expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    });

    test('the drawing is sized to the map: in map widths, as tall as the map is', () => {
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} userId="player-1" />);
        expect(screen.getByRole('img', { name: 'Map drawing' })).toHaveAttribute('viewBox', '0 0 1 0.5');
    });

    test('with no active map there is only the message', () => {
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={undefined} userId="director-1" />);
        expect(screen.getByText(/No active map selected/)).toBeInTheDocument();
        expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    });

    test('a stroke drawn while the map is open does not disturb the zones: the same zone list is passed on', () => {
        const { rerender } = render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} userId="player-1" />);
        const first = mockAbstractProps[mockAbstractProps.length - 1].zoneLayout;

        // the map doc comes back with another stroke - and its zone fields in another order
        const reordered = activeMap({
            strokes: [stroke('a'), stroke('b')],
            zones: [{ height: 80, width: 100, y: 10, x: 10, name: 'Zone 1', id: 'Zone 1' }, { height: 80, width: 100, y: 10, x: 200, name: 'Zone 2', id: 'Zone 2' }],
        });
        rerender(<PostListContentCombatMap campaignId="camp-1" activeMap={reordered} userId="player-1" />);

        expect(mockAbstractProps[mockAbstractProps.length - 1].zoneLayout).toBe(first);
    });

    test('but a zone that really moved does change the zone list', () => {
        const { rerender } = render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} userId="player-1" />);
        const first = mockAbstractProps[mockAbstractProps.length - 1].zoneLayout;

        rerender(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap({ zones: [zone('Zone 1', 50), zone('Zone 2', 200)] })} userId="player-1" />);

        expect(mockAbstractProps[mockAbstractProps.length - 1].zoneLayout).not.toBe(first);
    });
});
