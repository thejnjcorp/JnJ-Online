import { updatePostStatusSwap, updateUnorderedPosts } from '../../../src/utils/DraggableElements/PostListContentAbstract.tsx';

const relic1 = { id: 'a', title: 'Sword', content: '', status: 'Relic 1', index: 0 };
const relic2 = { id: 'b', title: 'Shield', content: '', status: 'Relic 2', index: 0 };

describe('updatePostStatusSwap', () => {
    test('reassigns .status on both posts when swapping two occupied slots', () => {
        const postsByStatus = { 'Relic 1': [relic1], 'Relic 2': [relic2] };

        const result = updatePostStatusSwap(
            relic1,
            { status: 'Relic 1', index: 0 },
            { status: 'Relic 2', index: 0 },
            postsByStatus
        );

        expect(result['Relic 2']).toEqual([{ ...relic1, status: 'Relic 2', index: 0 }]);
        expect(result['Relic 1']).toEqual([{ ...relic2, status: 'Relic 1', index: 0 }]);
    });

    test('moves into an empty slot, leaving the source slot empty', () => {
        const postsByStatus = { 'Relic 1': [relic1], 'Relic 2': [] };

        const result = updatePostStatusSwap(
            relic1,
            { status: 'Relic 1', index: 0 },
            { status: 'Relic 2', index: 0 },
            postsByStatus
        );

        expect(result['Relic 2']).toEqual([{ ...relic1, status: 'Relic 2', index: 0 }]);
        expect(result['Relic 1']).toEqual([]);
    });

    test('the swapped result persists correctly via updateUnorderedPosts - this is what a real Firestore write sends', () => {
        const postsByStatus = { 'Relic 1': [relic1], 'Relic 2': [relic2] };
        const unorderedPosts = [relic1, relic2];

        const newPostStatus = updatePostStatusSwap(
            relic1,
            { status: 'Relic 1', index: 0 },
            { status: 'Relic 2', index: 0 },
            postsByStatus
        );

        const persisted = updateUnorderedPosts(
            unorderedPosts,
            newPostStatus,
            { status: 'Relic 1', index: 0 },
            { status: 'Relic 2', index: 0 }
        );

        expect(persisted.find(post => post.id === 'a').status).toBe('Relic 2');
        expect(persisted.find(post => post.id === 'b').status).toBe('Relic 1');
    });
});
