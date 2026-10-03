import { act, render, screen } from '@testing-library/react';

// A stand-in for drag and drop that hands the test the list's own onDragEnd, to call with whatever
// a drag ended as, and shows whether each zone's list can be dropped onto.
let mockOnDragEnd;
jest.mock('@hello-pangea/dnd', () => ({
    DragDropContext: ({ onDragEnd, children }) => {
        mockOnDragEnd = onDragEnd;
        return <div>{children}</div>;
    },
    Droppable: ({ droppableId, isCombineEnabled, children }) => children({ innerRef: () => {}, droppableProps: { 'data-combine': String(Boolean(isCombineEnabled)), 'data-testid': `list-${droppableId}` }, placeholder: null }, { isDraggingOver: false }),
    Draggable: ({ draggableId, children }) => children({ innerRef: () => {}, draggableProps: {}, dragHandleProps: {} }, { isDragging: false, combineTargetFor: null, draggableId }),
}));

// eslint-disable-next-line import/first
import { PostListContentAbstract } from '../../src/utils/DraggableElements/PostListContentAbstract.tsx';

const post = (id, status, index, fields = {}) => ({ id, title: id.toUpperCase(), content: '', status, index, ...fields });
const Card = ({ post: item }) => <span>{item.title}</span>;

const dragEnd = result => act(() => mockOnDragEnd(result));
const draw = (posts, props = {}) => {
    const updatePosts = jest.fn();
    render(<PostListContentAbstract inputStatuses={['Zone 1', 'Zone 2']} usePosts={() => ({ posts, loading: false })} updatePosts={updatePosts} PostCardComponent={Card} {...props}/>);
    return updatePosts;
};
const combine = (id, onto) => ({ draggableId: id, combine: { draggableId: onto, droppableId: 'Zone 1' }, source: { droppableId: 'Zone 2', index: 0 }, destination: null, mode: 'FLUID', type: 'DEFAULT', reason: 'DROP' });
const drop = (id, from, to) => ({ draggableId: id, source: { droppableId: from.zone, index: from.index }, destination: { droppableId: to.zone, index: to.index }, mode: 'FLUID', type: 'DEFAULT', reason: 'DROP' });

describe('PostListContentAbstract engagements', () => {
    test('without them a zone\'s list is not one to drop onto, and dropping onto someone does nothing', () => {
        const updatePosts = draw([post('a', 'Zone 1', 0), post('b', 'Zone 2', 0)]);
        expect(screen.getByTestId('list-Zone 1')).toHaveAttribute('data-combine', 'false');
        dragEnd(combine('b', 'a'));
        expect(updatePosts).not.toHaveBeenCalled();
    });

    describe('with them', () => {
        test('a zone\'s list can be dropped onto', () => {
            draw([post('a', 'Zone 1', 0)], { engagements: true });
            expect(screen.getByTestId('list-Zone 1')).toHaveAttribute('data-combine', 'true');
        });

        test('dropping someone onto another engages them, in the other\'s zone', () => {
            const updatePosts = draw([post('a', 'Zone 1', 0), post('b', 'Zone 2', 0)], { engagements: true });
            dragEnd(combine('b', 'a'));
            const saved = updatePosts.mock.calls[0][0];
            const [a, b] = ['a', 'b'].map(id => saved.find(item => item.id === id));
            expect(b).toMatchObject({ status: 'Zone 1' });
            expect(a.engagement).toBeTruthy();
            expect(b.engagement).toBe(a.engagement);
            // and it is drawn as a tile of its own straight away
            expect(screen.getByRole('group', { name: 'Engaged: A, B' })).toBeInTheDocument();
        });

        test('only someone who may be moved can engage', () => {
            const updatePosts = draw([post('a', 'Zone 1', 0), post('b', 'Zone 2', 0)], { engagements: true, canMovePost: item => item.id === 'a' });
            dragEnd(combine('b', 'a'));
            expect(updatePosts).not.toHaveBeenCalled();
            dragEnd(combine('a', 'b'));
            expect(updatePosts).toHaveBeenCalledTimes(1);
        });

        test('nothing is done when nothing can be dragged', () => {
            const updatePosts = draw([post('a', 'Zone 1', 0), post('b', 'Zone 2', 0)], { engagements: true, readOnly: true });
            dragEnd(combine('b', 'a'));
            expect(updatePosts).not.toHaveBeenCalled();
        });

        test('taking someone out of an engagement into the zone\'s list leaves it, and the one left alone is back in the list', () => {
            const updatePosts = draw([post('a', 'Zone 1', 0, { engagement: 'e' }), post('b', 'Zone 1', 1, { engagement: 'e' }), post('c', 'Zone 1', 2)], { engagements: true });
            dragEnd(drop('a', { zone: 'Zone 1', index: 0 }, { zone: 'Zone 1', index: 2 }));
            const saved = updatePosts.mock.calls[0][0];
            expect(saved.some(item => item.engagement)).toBe(false);
            expect(screen.queryByRole('group')).not.toBeInTheDocument();
        });

        test('dropping someone between two who are engaged brings them in', () => {
            const updatePosts = draw([post('a', 'Zone 1', 0, { engagement: 'e' }), post('b', 'Zone 1', 1, { engagement: 'e' }), post('c', 'Zone 2', 0)], { engagements: true });
            dragEnd(drop('c', { zone: 'Zone 2', index: 0 }, { zone: 'Zone 1', index: 1 }));
            const saved = updatePosts.mock.calls[0][0];
            expect(saved.every(item => item.engagement === 'e')).toBe(true);
            expect(screen.getByRole('group', { name: 'Engaged: A, C, B' })).toBeInTheDocument();
        });

        test('an ordinary move, with nobody engaged, is written as before', () => {
            const updatePosts = draw([post('a', 'Zone 1', 0), post('b', 'Zone 2', 0)], { engagements: true });
            dragEnd(drop('b', { zone: 'Zone 2', index: 0 }, { zone: 'Zone 1', index: 1 }));
            expect(updatePosts.mock.calls[0][0].find(item => item.id === 'b')).toMatchObject({ status: 'Zone 1', index: 1 });
        });
    });
});
