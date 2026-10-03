import { render, screen, within } from '@testing-library/react';
import { DragDropContext } from '@hello-pangea/dnd';
import { PostColumn } from '../../src/utils/DraggableElements/PostColumn.tsx';

const Card = ({ post, readOnly }) => <div data-testid={post.id} data-readonly={String(Boolean(readOnly))}>{post.title}</div>;
const posts = [
    { id: 'character:a', title: 'Aria', content: '', status: 'Zone 1', index: 0 },
    { id: 'character:b', title: 'Bram', content: '', status: 'Zone 1', index: 1 },
    { id: 'npc:g', title: 'Goblin', content: '', status: 'Zone 1', index: 2 },
];

const draw = props => render(<DragDropContext onDragEnd={() => {}}><PostColumn status="Zone 1" posts={posts} PostCardComponent={Card} {...props}/></DragDropContext>);
const readOnly = id => screen.getByTestId(id).getAttribute('data-readonly');

describe('PostColumn', () => {
    test('every card can be dragged by default', () => {
        draw();
        posts.forEach(post => expect(readOnly(post.id)).toBe('false'));
    });

    test('read-only makes every card undraggable', () => {
        draw({ readOnly: true });
        posts.forEach(post => expect(readOnly(post.id)).toBe('true'));
    });

    test('with a canMovePost, only the cards it says yes to can be dragged', () => {
        draw({ canMovePost: post => post.id === 'character:a' });
        expect(readOnly('character:a')).toBe('false');
        expect(readOnly('character:b')).toBe('true');
        expect(readOnly('npc:g')).toBe('true');
    });

    test('read-only wins over canMovePost', () => {
        draw({ readOnly: true, canMovePost: () => true });
        posts.forEach(post => expect(readOnly(post.id)).toBe('true'));
    });

    describe('engagements', () => {
        const engaged = [
            { id: 'character:a', title: 'Aria', content: '', status: 'Zone 1', index: 0 },
            { id: 'character:b', title: 'Bram', content: '', status: 'Zone 1', index: 1, engagement: 'e1' },
            { id: 'npc:g', title: 'Goblin', content: '', status: 'Zone 1', index: 2, engagement: 'e1' },
            { id: 'npc:h', title: 'Hob', content: '', status: 'Zone 1', index: 3 },
        ];

        test('the people engaged with each other are in a tile of their own, the rest in the zone\'s own list', () => {
            draw({ posts: engaged });
            const tile = screen.getByRole('group', { name: 'Engaged: Bram, Goblin' });
            expect(within(tile).getByTestId('character:b')).toBeInTheDocument();
            expect(within(tile).getByTestId('npc:g')).toBeInTheDocument();
            expect(within(tile).queryByTestId('character:a')).not.toBeInTheDocument();
            expect(screen.getByTestId('character:a')).toBeInTheDocument();
            expect(screen.getByTestId('npc:h')).toBeInTheDocument();
            expect(screen.getAllByRole('group')).toHaveLength(1);
        });

        test('with nobody engaged there is no tile', () => {
            draw();
            expect(screen.queryByRole('group')).not.toBeInTheDocument();
        });

        test('two engagements next to each other are two tiles', () => {
            draw({ posts: [{ ...engaged[0], engagement: 'e0' }, { ...engaged[1], index: 1, engagement: 'e0' }, { ...engaged[2], index: 2, engagement: undefined }, { ...engaged[3], index: 3, engagement: 'e1' }, { id: 'npc:i', title: 'Imp', content: '', status: 'Zone 1', index: 4, engagement: 'e1' }] });
            expect(screen.getAllByRole('group').map(group => group.getAttribute('aria-label'))).toEqual(['Engaged: Aria, Bram', 'Engaged: Hob, Imp']);
        });

        test('uses the class it is given for the tile', () => {
            draw({ posts: engaged, className: { postEngagement: 'My-tile' } });
            expect(screen.getByRole('group')).toHaveClass('My-tile');
        });
    });
});
