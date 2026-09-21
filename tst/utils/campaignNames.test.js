import { campaignNameMap, campaignSuffix } from '../../src/utils/campaignNames';

describe('campaignNameMap', () => {
    test('maps each campaign\'s id to its name', () => {
        expect(campaignNameMap([{ id: 'a', campaign_name: 'The Iron Vale' }, { id: 'b', campaign_name: 'Solo' }])).toEqual({ a: 'The Iron Vale', b: 'Solo' });
    });

    test('is empty for no campaigns', () => {
        expect(campaignNameMap([])).toEqual({});
    });
});

describe('campaignSuffix', () => {
    const names = { a: 'The Iron Vale' };

    test('follows a character\'s class with the campaign it is in', () => {
        expect(campaignSuffix(names, 'a')).toBe(' · The Iron Vale');
    });

    test('is nothing for a character in no campaign', () => {
        expect(campaignSuffix(names, undefined)).toBe('');
        expect(campaignSuffix(names, '')).toBe('');
    });

    test('is nothing - not the raw id - for a campaign the viewer cannot see', () => {
        expect(campaignSuffix(names, 'S4t04LhkYrN3wAzPvYgq')).toBe('');
    });

    test('is nothing for a campaign that has no name', () => {
        expect(campaignSuffix({ a: undefined }, 'a')).toBe('');
    });
});
