import {
    filterActions, filterOptions, isFilterActive, namedTags, newCustomTag, snapshotTag, sortActions, tagAppliesToClass, tagKey, tagsForClass, visibilityLabel,
} from '../../src/utils/tags';

const fire = { id: 't-fire', tagInfo: 'Fire', tagColor: '#f00', textColor: '#fff', tagDescription: 'Burns' };
const melee = { id: 't-melee', tagInfo: 'Melee', tagColor: '#00f', textColor: '#fff' };
const onAction = (tag, extra = {}) => ({ id: `on-${tag.id}`, tagId: tag.id, tagInfo: tag.tagInfo, tagColor: tag.tagColor, textColor: tag.textColor, ...extra });

const actions = [
    { actionName: 'Slash', category: 'action', actionCost: 2, tags: [onAction(melee)] },
    { actionName: 'Fireball', category: 'action', actionCost: 3, tags: [onAction(fire)] },
    { actionName: 'Flame Guard', category: 'reaction', actionCost: 0, tags: [onAction(fire), onAction(melee)] },
    { actionName: 'Toughness', category: 'passive', actionCost: 0 },
    { actionName: 'Ambush', category: 'action', actionCost: 1, tags: [{ id: 'x', tagInfo: '  sneaky ' }] },
    { actionName: 'Second Wind', category: 'feat', actionCost: 0, tags: [{ id: 'blank', tagInfo: '' }] },
];
const names = list => list.map(action => action.actionName);

describe('tagKey', () => {
    test('is the catalog id when there is one, else the label without case or padding', () => {
        expect(tagKey({ tagId: 't1', tagInfo: 'Fire' })).toBe('t1');
        expect(tagKey({ tagInfo: '  Fire ' })).toBe('fire');
        expect(tagKey({ tagInfo: 'FIRE' })).toBe(tagKey({ tagInfo: 'fire' }));
    });
});

describe('namedTags', () => {
    test('leaves out a tag that has no label yet', () => {
        expect(namedTags(actions[5])).toEqual([]);
        expect(namedTags(actions[4])).toHaveLength(1);
        expect(namedTags({})).toEqual([]);
        expect(namedTags(undefined)).toEqual([]);
    });
});

describe('snapshotTag / newCustomTag', () => {
    test('copies what a sheet shows, remembers the catalog entry, and gets its own id', () => {
        const copy = snapshotTag(fire);
        expect(copy).toMatchObject({ tagId: 't-fire', tagInfo: 'Fire', tagColor: '#f00', textColor: '#fff', tagDescription: 'Burns' });
        expect(copy.id).not.toBe('t-fire');
        expect(snapshotTag(fire).id).not.toBe(copy.id);
    });

    test('fills in a missing description and label so it can be saved', () => {
        expect(snapshotTag({ id: 'x' })).toMatchObject({ tagInfo: '', tagDescription: '' });
    });

    test('a custom tag starts blank with readable default colours and no catalog id', () => {
        const tag = newCustomTag();
        expect(tag).toMatchObject({ tagInfo: '', tagColor: '#61dafb', textColor: '#1b1b1f' });
        expect(tag).not.toHaveProperty('tagId');
    });
});

describe('tagAppliesToClass / tagsForClass', () => {
    const catalog = [
        { id: 'a', tagInfo: 'Zeta', classes: [] },
        { id: 'b', tagInfo: 'Alpha' },
        { id: 'c', tagInfo: 'Monk only', classes: ['Monk'] },
        { id: 'd', tagInfo: 'Gunslinger only', classes: ['Gunslinger'] },
        { id: 'e', tagInfo: 'Default one', isDefault: true, classes: [] },
    ];

    test('a tag with no classes is for any class; one with classes only for those', () => {
        expect(tagAppliesToClass(catalog[0], 'Monk')).toBe(true);
        expect(tagAppliesToClass(catalog[1], undefined)).toBe(true);
        expect(tagAppliesToClass(catalog[2], 'Monk')).toBe(true);
        expect(tagAppliesToClass(catalog[2], 'Gunslinger')).toBe(false);
        expect(tagAppliesToClass(catalog[2], undefined)).toBe(false);
    });

    test('a class is offered general tags and its own, defaults first then alphabetical', () => {
        expect(tagsForClass(catalog, 'Monk').map(tag => tag.id)).toEqual(['e', 'b', 'c', 'a']);
    });

    test('a class with no name yet only sees general tags', () => {
        expect(tagsForClass(catalog, '').map(tag => tag.id)).toEqual(['e', 'b', 'a']);
    });

    test('does not reorder or change the catalog it was given', () => {
        const before = catalog.map(tag => tag.id);
        tagsForClass(catalog, 'Monk');
        expect(catalog.map(tag => tag.id)).toEqual(before);
    });
});

describe('visibilityLabel', () => {
    test.each([
        [{ isDefault: true, public: true }, 'Default'],
        [{ public: true }, 'Public'],
        [{ public: false }, 'Private'],
        [{}, 'Private'],
    ])('%j is %s', (tag, label) => expect(visibilityLabel(tag)).toBe(label));
});

describe('filterOptions', () => {
    test('offers the categories and tags that some action has, tags alphabetical and counted once', () => {
        const options = filterOptions(actions);
        expect(options.categories.map(category => category.key)).toEqual(['feat', 'passive', 'reaction', 'action']);
        expect(options.tags.map(tag => tag.label)).toEqual(['Fire', 'Melee', 'sneaky']);
        expect(options.tags.map(tag => tag.key)).toEqual(['t-fire', 't-melee', 'sneaky']);
    });

    test('no tags and one category for a plain class, and nothing at all for no actions', () => {
        expect(filterOptions([{ actionName: 'A', category: 'action' }])).toMatchObject({ categories: [{ key: 'action' }], tags: [] });
        expect(filterOptions([])).toEqual({ categories: [], tags: [] });
    });

    test('carries a tag\'s colours for its chip', () => {
        expect(filterOptions(actions).tags[0]).toMatchObject({ tagColor: '#f00', textColor: '#fff' });
    });

    test('a legacy action with only a Reaction tag counts as a reaction', () => {
        const legacy = [{ actionName: 'Old', tags: [{ tagInfo: 'Reaction' }] }];
        expect(filterOptions(legacy).categories.map(category => category.key)).toEqual(['reaction']);
    });
});

describe('filterActions / isFilterActive', () => {
    const filter = (categories = [], tags = []) => ({ categories, tags });

    test('no filter keeps everything, and is not active', () => {
        expect(names(filterActions(actions, filter()))).toEqual(names(actions));
        expect(isFilterActive(filter())).toBe(false);
        expect(isFilterActive(filter(['action']))).toBe(true);
        expect(isFilterActive(filter([], ['fire']))).toBe(true);
    });

    test('a tag keeps actions that have it, however many other tags they have', () => {
        expect(names(filterActions(actions, filter([], ['t-fire'])))).toEqual(['Fireball', 'Flame Guard']);
    });

    test('several tags keep actions with any of them', () => {
        expect(names(filterActions(actions, filter([], ['t-fire', 't-melee'])))).toEqual(['Slash', 'Fireball', 'Flame Guard']);
    });

    test('a category keeps that kind of action', () => {
        expect(names(filterActions(actions, filter(['reaction'])))).toEqual(['Flame Guard']);
        expect(names(filterActions(actions, filter(['feat', 'passive'])))).toEqual(['Toughness', 'Second Wind']);
    });

    test('a category and a tag together keep only what matches both', () => {
        expect(names(filterActions(actions, filter(['action'], ['t-fire'])))).toEqual(['Fireball']);
        expect(filterActions(actions, filter(['passive'], ['t-fire']))).toEqual([]);
    });

    test('finds a tag typed in on the action by its label', () => {
        expect(names(filterActions(actions, filter([], ['sneaky'])))).toEqual(['Ambush']);
    });

    test('an action with no tags is never kept by a tag filter', () => {
        expect(names(filterActions(actions, filter([], ['t-melee'])))).not.toContain('Toughness');
    });
});

describe('sortActions', () => {
    test('class order (and any unknown sort) leaves the order alone, without changing the list given', () => {
        const before = names(actions);
        expect(names(sortActions(actions, 'default'))).toEqual(before);
        expect(names(sortActions(actions, 'nonsense'))).toEqual(before);
        expect(names(actions)).toEqual(before);
    });

    test('by cost, cheapest first, ties in class order', () => {
        expect(names(sortActions(actions, 'cost'))).toEqual(['Flame Guard', 'Toughness', 'Second Wind', 'Ambush', 'Slash', 'Fireball']);
    });

    test('by name, A to Z', () => {
        expect(names(sortActions(actions, 'name'))).toEqual(['Ambush', 'Fireball', 'Flame Guard', 'Second Wind', 'Slash', 'Toughness']);
    });

    test('by tag, alphabetically by an action\'s first tag, untagged last (by name)', () => {
        expect(names(sortActions(actions, 'tag'))).toEqual(['Fireball', 'Flame Guard', 'Slash', 'Ambush', 'Second Wind', 'Toughness']);
    });

    test('a missing cost counts as free', () => {
        expect(names(sortActions([{ actionName: 'B', actionCost: 1 }, { actionName: 'A' }], 'cost'))).toEqual(['A', 'B']);
    });
});
