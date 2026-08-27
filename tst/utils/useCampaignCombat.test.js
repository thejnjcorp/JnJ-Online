import { renderHook, act } from '@testing-library/react';

jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockOnSnapshot = jest.fn();
const mockQuery = jest.fn();
const mockCollection = jest.fn();
const mockWhere = jest.fn();
const mockDocumentId = jest.fn();

jest.mock('firebase/firestore', () => ({
    collection: (...args) => mockCollection(...args),
    documentId: (...args) => mockDocumentId(...args),
    onSnapshot: (...args) => mockOnSnapshot(...args),
    query: (...args) => mockQuery(...args),
    where: (...args) => mockWhere(...args),
}));

// eslint-disable-next-line import/first
import { useCampaignMaps, useCombatEntities } from '../../src/utils/useCampaignCombat';

// jest.config.js sets resetMocks:true, which wipes mock implementations
// (not just call history) before every single test - so the defaults these
// mocks need are set up fresh here rather than inline in the jest.fn(impl)
// calls above, which would only survive the very first test.
beforeEach(() => {
    mockQuery.mockImplementation((...args) => ({ __query: args }));
    mockCollection.mockImplementation((_db, name) => ({ __collection: name }));
    mockWhere.mockImplementation((...args) => ({ __where: args }));
    mockDocumentId.mockImplementation(() => '__documentId__');
    mockOnSnapshot.mockImplementation(() => jest.fn());
});

describe('useCombatEntities', () => {
    test('returns an empty list when there are no characters or NPCs', () => {
        const { result } = renderHook(() => useCombatEntities([], {}));
        expect(result.current).toEqual([]);
    });

    test('prefixes player characters with "character:" using character_id, titled by character_name', () => {
        const characterList = [{ character_id: 'c1', character_name: 'Aria' }];
        const { result } = renderHook(() => useCombatEntities(characterList, {}));
        expect(result.current).toEqual([{ id: 'character:c1', title: 'Aria' }]);
    });

    test('merges ally, enemy, and neutral NPC lists, each prefixed with "npc:" using id, titled by enemy_name', () => {
        const campaignInfo = {
            ally_combat_npc_list: [{ id: 'a1', enemy_name: 'Ally One' }],
            enemy_list: [{ id: 'e1', enemy_name: 'Enemy One' }],
            neutral_combat_npc_list: [{ id: 'n1', enemy_name: 'Neutral One' }],
        };
        const { result } = renderHook(() => useCombatEntities([], campaignInfo));
        expect(result.current).toEqual([
            { id: 'npc:a1', title: 'Ally One' },
            { id: 'npc:e1', title: 'Enemy One' },
            { id: 'npc:n1', title: 'Neutral One' },
        ]);
    });

    test('missing NPC list fields default to empty rather than throwing', () => {
        const { result } = renderHook(() => useCombatEntities([], {}));
        expect(result.current).toEqual([]);
    });

    test('combines characters and every NPC category together, in a fixed order', () => {
        const characterList = [{ character_id: 'c1', character_name: 'Aria' }];
        const campaignInfo = {
            ally_combat_npc_list: [{ id: 'a1', enemy_name: 'Ally' }],
            enemy_list: [{ id: 'e1', enemy_name: 'Enemy' }],
            neutral_combat_npc_list: [{ id: 'n1', enemy_name: 'Neutral' }],
        };
        const { result } = renderHook(() => useCombatEntities(characterList, campaignInfo));
        expect(result.current.map(e => e.id)).toEqual(['character:c1', 'npc:a1', 'npc:e1', 'npc:n1']);
    });

    test('memoizes: the same result reference is returned across a re-render with unchanged inputs', () => {
        const characterList = [{ character_id: 'c1', character_name: 'Aria' }];
        const campaignInfo = {};
        const { result, rerender } = renderHook(
            ({ characterList, campaignInfo }) => useCombatEntities(characterList, campaignInfo),
            { initialProps: { characterList, campaignInfo } }
        );
        const first = result.current;
        rerender({ characterList, campaignInfo });
        expect(result.current).toBe(first);
    });
});

describe('useCampaignMaps', () => {
    test('with no map ids on the campaign, maps stays empty and Firestore is never queried', () => {
        const { result } = renderHook(() => useCampaignMaps({}));
        expect(result.current.maps).toEqual([]);
        expect(result.current.activeMap).toBeUndefined();
        expect(mockOnSnapshot).not.toHaveBeenCalled();
    });

    test('subscribes with an "in" query over the campaign\'s map ids', () => {
        renderHook(() => useCampaignMaps({ maps: ['map1', 'map2'] }));
        expect(mockCollection).toHaveBeenCalledWith({}, 'maps');
        expect(mockWhere).toHaveBeenCalledWith('__documentId__', 'in', ['map1', 'map2']);
        expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    });

    test('maps state updates from the onSnapshot callback, id taken from doc.id as map_id', () => {
        let capturedCallback;
        mockOnSnapshot.mockImplementation((_query, _opts, callback) => {
            capturedCallback = callback;
            return jest.fn();
        });

        const { result } = renderHook(() => useCampaignMaps({ maps: ['map1'] }));

        act(() => {
            capturedCallback({
                docs: [{ id: 'map1', data: () => ({ name: 'Arena' }) }],
            });
        });

        expect(result.current.maps).toEqual([{ map_id: 'map1', name: 'Arena' }]);
    });

    test('activeMap resolves the map whose map_id matches campaignInfo.active_map', () => {
        let capturedCallback;
        mockOnSnapshot.mockImplementation((_query, _opts, callback) => {
            capturedCallback = callback;
            return jest.fn();
        });

        const { result } = renderHook(() => useCampaignMaps({ maps: ['map1', 'map2'], active_map: 'map2' }));

        act(() => {
            capturedCallback({
                docs: [
                    { id: 'map1', data: () => ({ name: 'Arena' }) },
                    { id: 'map2', data: () => ({ name: 'Dungeon' }) },
                ],
            });
        });

        expect(result.current.activeMap).toEqual({ map_id: 'map2', name: 'Dungeon' });
    });

    test('activeMap is undefined when active_map does not match any loaded map', () => {
        let capturedCallback;
        mockOnSnapshot.mockImplementation((_query, _opts, callback) => {
            capturedCallback = callback;
            return jest.fn();
        });

        const { result } = renderHook(() => useCampaignMaps({ maps: ['map1'], active_map: 'does-not-exist' }));

        act(() => {
            capturedCallback({ docs: [{ id: 'map1', data: () => ({}) }] });
        });

        expect(result.current.activeMap).toBeUndefined();
    });

    test('unsubscribes the previous listener when the map id list changes', () => {
        const unsubscribeFirst = jest.fn();
        const unsubscribeSecond = jest.fn();
        mockOnSnapshot
            .mockImplementationOnce(() => unsubscribeFirst)
            .mockImplementationOnce(() => unsubscribeSecond);

        const { rerender, unmount } = renderHook(
            ({ campaignInfo }) => useCampaignMaps(campaignInfo),
            { initialProps: { campaignInfo: { maps: ['map1'] } } }
        );
        expect(unsubscribeFirst).not.toHaveBeenCalled();

        rerender({ campaignInfo: { maps: ['map2'] } });
        expect(unsubscribeFirst).toHaveBeenCalledTimes(1);

        unmount();
        expect(unsubscribeSecond).toHaveBeenCalledTimes(1);
    });
});
