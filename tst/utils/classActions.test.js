import { ACTION_USAGES, FEAT_TIER_RANGE, featTierOf, getActionCategory, getActionUsage, isCombatAction, isReactionAction, isRoleplayAction, usageBadge } from '../../src/utils/classActions';

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

describe('where an action is used', () => {
    test('is combat, roleplay or both', () => {
        expect(ACTION_USAGES.map(usage => usage.key)).toEqual(['combat', 'roleplay', 'both']);
    });

    test('an action with no usage (every action from before it existed) is a combat action', () => {
        expect(getActionUsage({})).toBe('combat');
        expect(getActionUsage(undefined)).toBe('combat');
        expect(getActionUsage({ usage: 'something else' })).toBe('combat');
        expect(getActionUsage({ usage: null })).toBe('combat');
    });

    test('an explicit usage is used', () => {
        expect(getActionUsage({ usage: 'roleplay' })).toBe('roleplay');
        expect(getActionUsage({ usage: 'both' })).toBe('both');
        expect(getActionUsage({ usage: 'combat' })).toBe('combat');
    });

    test.each([
        [undefined, true, false],
        ['combat', true, false],
        ['roleplay', false, true],
        ['both', true, true],
    ])('usage %p: in combat=%p, in roleplay=%p', (usage, combat, roleplay) => {
        expect(isCombatAction({ usage })).toBe(combat);
        expect(isRoleplayAction({ usage })).toBe(roleplay);
    });

    test('only roleplay and both are worth a badge next to an action\'s name', () => {
        expect(usageBadge({})).toBeNull();
        expect(usageBadge({ usage: 'combat' })).toBeNull();
        expect(usageBadge({ usage: 'roleplay' })).toBe('Roleplay');
        expect(usageBadge({ usage: 'both' })).toBe('Combat + Roleplay');
    });
});

describe('featTierOf', () => {
    test('is a real, in-range tier as-is', () => {
        expect(featTierOf({ tier: 1 })).toBe(1);
        expect(featTierOf({ tier: 3 })).toBe(3);
    });

    test('a feat saved before tiers existed defaults to the lowest tier', () => {
        expect(featTierOf({})).toBe(FEAT_TIER_RANGE.min);
        expect(featTierOf(undefined)).toBe(FEAT_TIER_RANGE.min);
    });

    test('an out-of-range or non-numeric tier also falls back to the lowest tier', () => {
        expect(featTierOf({ tier: 0 })).toBe(FEAT_TIER_RANGE.min);
        expect(featTierOf({ tier: 4 })).toBe(FEAT_TIER_RANGE.min);
        expect(featTierOf({ tier: 1.5 })).toBe(FEAT_TIER_RANGE.min);
        expect(featTierOf({ tier: 'two' })).toBe(FEAT_TIER_RANGE.min);
    });
});

describe('isReactionAction', () => {
    test('is true for the reaction category, including one only marked by its legacy tag', () => {
        expect(isReactionAction({ category: 'reaction' })).toBe(true);
        expect(isReactionAction({ tags: [{ tagInfo: 'Reaction' }] })).toBe(true);
    });

    test('is false for anything else', () => {
        expect(isReactionAction({ category: 'action' })).toBe(false);
        expect(isReactionAction({ category: 'passive' })).toBe(false);
        expect(isReactionAction({ category: 'feat' })).toBe(false);
        expect(isReactionAction({})).toBe(false);
    });
});
