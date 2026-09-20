import { render, screen } from '@testing-library/react';
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
});
