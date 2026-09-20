import { isCampaignArchived, withoutArchivedCampaigns } from '../../src/utils/campaignArchive';

describe('isCampaignArchived', () => {
    test('is when the archived flag is set; campaigns from before the flag existed are not', () => {
        expect(isCampaignArchived({ archived: true })).toBe(true);
        expect(isCampaignArchived({ archived: true, scheduledDeletionAt: {} })).toBe(true);
        expect(isCampaignArchived({ archived: false })).toBe(false);
        expect(isCampaignArchived({})).toBe(false);
        expect(isCampaignArchived(undefined)).toBe(false);
    });
});

describe('withoutArchivedCampaigns', () => {
    test('keeps the rest in order, including campaigns with no flag at all', () => {
        const list = [{ id: 'a' }, { id: 'b', archived: true }, { id: 'c', archived: false }, { id: 'd', archived: true, scheduledDeletionAt: {} }];
        expect(withoutArchivedCampaigns(list).map(c => c.id)).toEqual(['a', 'c']);
        expect(withoutArchivedCampaigns([])).toEqual([]);
    });

    test('does not change what it was given', () => {
        const list = [{ id: 'a', archived: true }];
        withoutArchivedCampaigns(list);
        expect(list).toEqual([{ id: 'a', archived: true }]);
    });
});
