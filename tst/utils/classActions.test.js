import { getActionCategory } from '../../src/utils/classActions';

describe('getActionCategory', () => {
    test('prefers an explicit category field over any tag-based inference', () => {
        expect(getActionCategory({ category: 'reaction', tags: [{ tagInfo: 'Feat' }] })).toBe('reaction');
    });

    test.each([
        ['Feat', 'feat'],
        ['Passive', 'passive'],
        ['Reaction', 'reaction'],
    ])('legacy action with a %s tag and no category falls back to %s', (tagInfo, expected) => {
        expect(getActionCategory({ tags: [{ tagInfo }] })).toBe(expected);
    });

    test('a legacy action with none of the special tags defaults to "action"', () => {
        expect(getActionCategory({ tags: [{ tagInfo: 'Something Else' }] })).toBe('action');
    });

    test('an action with no category and no tags defaults to "action"', () => {
        expect(getActionCategory({})).toBe('action');
        expect(getActionCategory({ tags: [] })).toBe('action');
    });

    test('checks tags in priority order: Feat beats Passive beats Reaction when multiple are present', () => {
        expect(getActionCategory({ tags: [{ tagInfo: 'Reaction' }, { tagInfo: 'Passive' }, { tagInfo: 'Feat' }] })).toBe('feat');
        expect(getActionCategory({ tags: [{ tagInfo: 'Reaction' }, { tagInfo: 'Passive' }] })).toBe('passive');
    });

    test('an explicit falsy category (empty string) is treated as absent and falls through to tag inference', () => {
        expect(getActionCategory({ category: '', tags: [{ tagInfo: 'Feat' }] })).toBe('feat');
    });
});
