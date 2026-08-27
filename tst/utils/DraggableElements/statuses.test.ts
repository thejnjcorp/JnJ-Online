import { getPostsByStatus } from '../../../src/utils/DraggableElements/statuses.ts';
import type { Post } from '../../../src/utils/DraggableElements/Post.ts';

function post(overrides: Partial<Post>): Post {
    return { id: 1, title: '', content: '', status: 'todo', index: 0, ...overrides };
}

describe('getPostsByStatus', () => {
    test('every declared status gets an entry, even with zero matching posts', () => {
        const result = getPostsByStatus([], ['todo', 'doing', 'done']);
        expect(result).toEqual({ todo: [], doing: [], done: [] });
    });

    test('posts are grouped under their own status', () => {
        const posts = [
            post({ id: 1, status: 'todo' }),
            post({ id: 2, status: 'done' }),
            post({ id: 3, status: 'todo' }),
        ];
        const result = getPostsByStatus(posts, ['todo', 'done']);
        expect(result.todo.map(p => p.id)).toEqual([1, 3]);
        expect(result.done.map(p => p.id)).toEqual([2]);
    });

    test('each status column is sorted ascending by index', () => {
        const posts = [
            post({ id: 1, status: 'todo', index: 2 }),
            post({ id: 2, status: 'todo', index: 0 }),
            post({ id: 3, status: 'todo', index: 1 }),
        ];
        const result = getPostsByStatus(posts, ['todo']);
        expect(result.todo.map(p => p.id)).toEqual([2, 3, 1]);
    });

    test('a post whose status was not in the declared list gets its own column added dynamically', () => {
        const posts = [post({ id: 1, status: 'archived' })];
        const result = getPostsByStatus(posts, ['todo']);
        expect(result).toEqual({ todo: [], archived: [post({ id: 1, status: 'archived' })] });
    });

    test('multiple posts sharing an undeclared status all land in the same dynamically-created column', () => {
        const posts = [
            post({ id: 1, status: 'archived', index: 0 }),
            post({ id: 2, status: 'archived', index: 1 }),
        ];
        const result = getPostsByStatus(posts, ['todo']);
        expect(result.archived.map(p => p.id)).toEqual([1, 2]);
    });

    test('quirk: a dynamically-added column (status not in the declared list) is never sorted, unlike declared columns', () => {
        // The final sort pass only iterates the `statuses` argument, so a
        // column that only exists because a post's status wasn't declared
        // never gets touched by it - documenting this so a future change to
        // the sort step doesn't accidentally start relying on it being sorted.
        const posts = [
            post({ id: 1, status: 'archived', index: 5 }),
            post({ id: 2, status: 'archived', index: 1 }),
        ];
        const result = getPostsByStatus(posts, ['todo']);
        expect(result.archived.map(p => p.id)).toEqual([1, 2]); // insertion order, NOT sorted by index
    });

    test('an empty statuses list with posts still buckets everything dynamically', () => {
        const posts = [post({ id: 1, status: 'todo' })];
        const result = getPostsByStatus(posts, []);
        expect(result).toEqual({ todo: [post({ id: 1, status: 'todo' })] });
    });

    test('does not mutate the input posts array', () => {
        const posts = [post({ id: 1, status: 'todo', index: 2 }), post({ id: 2, status: 'todo', index: 1 })];
        const original = [...posts];
        getPostsByStatus(posts, ['todo']);
        expect(posts).toEqual(original);
    });
});
