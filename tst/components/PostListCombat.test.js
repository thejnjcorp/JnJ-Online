jest.mock('../../src/utils/firebase', () => ({ db: {} }));

let mockTracker = [];
const mockSaveTracker = jest.fn();
const mockSubscribeParty = jest.fn();
jest.mock('../../src/utils/party', () => ({
    subscribeParty: (...args) => mockSubscribeParty(...args),
    updateCombatTracker: async (campaignId, change) => {
        const next = change(mockTracker);
        if (next) await mockSaveTracker(campaignId, next);
    },
}));

const mockAbstractProps = [];
jest.mock('../../src/utils/DraggableElements/Post.ts', () => ({
    PostListContentAbstract: props => {
        mockAbstractProps.push(props);
        return <div>Line-stub</div>;
    },
}));

// eslint-disable-next-line import/first
import { render, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { PostListContentCombat } from '../../src/utils/DraggableElements/PostListCombat.tsx';
// eslint-disable-next-line import/first
import { zoneRects } from '../../src/utils/mapTokens';

const rects = zoneRects([{ name: 'Zone 1', x: 10, y: 10, width: 200, height: 200 }, { name: 'Zone 2', x: 250, y: 10, width: 200, height: 200 }]);
const at = (id, status, index, x, y) => ({ id, title: id, content: '', status, index, x, y });
const last = () => mockAbstractProps[mockAbstractProps.length - 1];

beforeEach(() => {
    mockAbstractProps.length = 0;
    mockSaveTracker.mockReset();
    mockSaveTracker.mockResolvedValue(undefined);
    mockSubscribeParty.mockReset();
    mockTracker = [at('a', 'Zone 1', 0, 0.1, 0.1), at('b', 'Zone 2', 0, 0.7, 0.22)];
    mockSubscribeParty.mockImplementation((_campaignId, listener) => {
        listener({ party: { combat_tracker: mockTracker }, loaded: true, error: null });
        return jest.fn();
    });
    window.alert = jest.fn();
});

afterEach(() => {
    delete window.alert;
});

describe('PostListContentCombat', () => {
    test('lists the tracker from the party doc, and follows it', () => {
        render(<PostListContentCombat campaignId="camp-1" inputStatuses={['Zone 1', 'Zone 2']}/>);
        expect(mockSubscribeParty).toHaveBeenCalledWith('camp-1', expect.any(Function));
        expect(last().usePosts()).toEqual({ posts: mockTracker, loading: false });
    });

    test('passes on who can be dragged: nobody when read-only, or only some', () => {
        const canMovePost = jest.fn();
        render(<PostListContentCombat campaignId="camp-1" inputStatuses={[]} readOnly canMovePost={canMovePost}/>);
        expect(last().readOnly).toBe(true);
        expect(last().canMovePost).toBe(canMovePost);
    });

    test('is draggable by default', () => {
        render(<PostListContentCombat campaignId="camp-1" inputStatuses={[]}/>);
        expect(last().readOnly).toBe(false);
    });

    describe('dragging someone to another zone', () => {
        test('writes their new zone and place in the line, and puts their token in the middle of that zone', async () => {
            render(<PostListContentCombat campaignId="camp-1" inputStatuses={['Zone 1', 'Zone 2']} rects={rects}/>);
            mockTracker = [at('a', 'Zone 1', 0, 0.1, 0.1), at('b', 'Zone 2', 0, 0.9, 0.4)]; // b is not in the middle
            last().updatePosts([at('a', 'Zone 2', 1, 0.1, 0.1), at('b', 'Zone 2', 0, 0.9, 0.4)]);

            await waitFor(() => expect(mockSaveTracker).toHaveBeenCalled());
            const [campaignId, saved] = mockSaveTracker.mock.calls[0];
            expect(campaignId).toBe('camp-1');
            const a = saved.find(p => p.id === 'a');
            expect(a).toMatchObject({ status: 'Zone 2', index: 1 });
            expect(a.x).toBeCloseTo(0.7, 3);
            expect(a.y).toBeCloseTo(0.22, 3);
            expect(saved.find(p => p.id === 'b')).toEqual(mockTracker[1]);
        });

        test('shifts them right when someone is in the middle already', async () => {
            render(<PostListContentCombat campaignId="camp-1" inputStatuses={['Zone 1', 'Zone 2']} rects={rects}/>);
            last().updatePosts([at('a', 'Zone 2', 1), at('b', 'Zone 2', 0)]);
            await waitFor(() => expect(mockSaveTracker).toHaveBeenCalled());
            const a = mockSaveTracker.mock.calls[0][1].find(p => p.id === 'a');
            expect(a.x).toBeGreaterThan(0.7);
            expect(a.y).toBeCloseTo(0.22, 3);
        });

        test('works from the tracker as it is when the write happens, so a move made meanwhile is kept', async () => {
            render(<PostListContentCombat campaignId="camp-1" inputStatuses={['Zone 1', 'Zone 2']} rects={rects}/>);
            const stale = last().updatePosts;
            mockTracker = [at('a', 'Zone 1', 0, 0.1, 0.1), at('b', 'Zone 2', 0, 0.7, 0.22), at('late', 'Zone 1', 1, 0.2, 0.2)];
            stale([at('a', 'Zone 2', 1), at('b', 'Zone 2', 0)]);
            await waitFor(() => expect(mockSaveTracker).toHaveBeenCalled());
            expect(mockSaveTracker.mock.calls[0][1].map(p => p.id)).toEqual(['a', 'b', 'late']);
        });

        test('with no map there is no position to give, only the zone', async () => {
            render(<PostListContentCombat campaignId="camp-1" inputStatuses={['Combatants']}/>);
            last().updatePosts([at('a', 'Other', 0), at('b', 'Zone 2', 0)]);
            await waitFor(() => expect(mockSaveTracker).toHaveBeenCalled());
            const a = mockSaveTracker.mock.calls[0][1].find(p => p.id === 'a');
            expect(a).toMatchObject({ status: 'Other', x: 0.1, y: 0.1 });
        });

        test('says so when it cannot be saved', async () => {
            mockSaveTracker.mockRejectedValue(new Error('permission-denied'));
            render(<PostListContentCombat campaignId="camp-1" inputStatuses={['Zone 1', 'Zone 2']} rects={rects}/>);
            last().updatePosts([at('a', 'Zone 2', 1), at('b', 'Zone 2', 0)]);
            await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Couldn't move them: Error: permission-denied"));
        });
    });
});
