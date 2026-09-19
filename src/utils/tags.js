// Tags: the labels on an action (Fire, Melee, Reaction...).
//
// A tag on an action is a copy - { id, tagId?, tagInfo, tagColor, textColor,
// tagDescription } - so a sheet shows it without ever reading the catalog. When
// it was picked from the catalog, `tagId` says which one; a tag typed in on the
// action itself (every tag before the catalog existed) has none.

import { getActionCategory } from './classActions';

export const ACTION_CATEGORIES = [
    { key: 'feat', label: 'Feat' },
    { key: 'passive', label: 'Passive' },
    { key: 'reaction', label: 'Reaction' },
    { key: 'action', label: 'Action' },
];

export const SORTS = [
    { key: 'default', label: 'Class order' },
    { key: 'cost', label: 'AP cost' },
    { key: 'name', label: 'Name (A-Z)' },
    { key: 'tag', label: 'Tag' },
];

const labelOf = tag => (tag?.tagInfo || '').trim();

// What makes two tags the same one: the catalog entry, or - for a tag typed in
// on an action - its label, ignoring case.
export const tagKey = tag => tag.tagId || labelOf(tag).toLowerCase();

// The tags on an action that show a label. A blank one (a tag just added, not
// yet named) is nothing to see or filter by.
export const namedTags = action => (action?.tags || []).filter(tag => labelOf(tag) !== '');

// A copy of a catalog tag for putting on an action.
export function snapshotTag(catalogTag) {
    return {
        id: crypto.randomUUID(),
        tagId: catalogTag.id,
        tagInfo: catalogTag.tagInfo || '',
        tagColor: catalogTag.tagColor,
        textColor: catalogTag.textColor,
        tagDescription: catalogTag.tagDescription || '',
    };
}

// A tag typed in on the action itself, not from the catalog.
export const newCustomTag = () => ({ id: crypto.randomUUID(), tagInfo: '', tagColor: '#61dafb', textColor: '#1b1b1f', tagDescription: '' });

export const tagAppliesToClass = (tag, className) => !tag.classes?.length || Boolean(className && tag.classes.includes(className));

export function visibilityLabel(tag) {
    if (tag.isDefault) return 'Default';
    if (tag.public) return 'Public';
    return 'Private';
}

// Which tags a catalog can offer: a class only sees tags for any class and
// tags scoped to it. Default tags come first, then alphabetical.
export function tagsForClass(catalog, className) {
    return catalog
        .filter(tag => tagAppliesToClass(tag, className))
        .sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)) || labelOf(a).localeCompare(labelOf(b)));
}

// The choices for filtering a set of actions: the categories and the tags that
// at least one of them has.
export function filterOptions(actions) {
    const present = new Set(actions.map(getActionCategory));
    const tags = new Map();
    actions.forEach(action => namedTags(action).forEach(tag => {
        if (!tags.has(tagKey(tag))) tags.set(tagKey(tag), { key: tagKey(tag), label: labelOf(tag), tagColor: tag.tagColor, textColor: tag.textColor });
    }));
    return {
        categories: ACTION_CATEGORIES.filter(category => present.has(category.key)),
        tags: [...tags.values()].sort((a, b) => a.label.localeCompare(b.label)),
    };
}

export const isFilterActive = filter => filter.categories.length > 0 || filter.tags.length > 0;

// Actions of any chosen category that have any chosen tag. Choosing nothing in
// a group leaves that group out of it, so "Reaction" + "Fire" is fire reactions.
export function filterActions(actions, filter) {
    return actions.filter(action => {
        const inCategory = filter.categories.length === 0 || filter.categories.includes(getActionCategory(action));
        const hasTag = filter.tags.length === 0 || namedTags(action).some(tag => filter.tags.includes(tagKey(tag)));
        return inCategory && hasTag;
    });
}

const byName = (a, b) => (a.actionName || '').localeCompare(b.actionName || '');
const firstTagLabel = action => namedTags(action).map(labelOf).sort((a, b) => a.localeCompare(b))[0];

// A sorted copy. Ties keep the order they came in (Array.sort is stable).
export function sortActions(actions, sortKey) {
    const sorted = [...actions];
    if (sortKey === 'cost') sorted.sort((a, b) => (Number(a.actionCost) || 0) - (Number(b.actionCost) || 0));
    else if (sortKey === 'name') sorted.sort(byName);
    else if (sortKey === 'tag') {
        sorted.sort((a, b) => {
            const first = firstTagLabel(a);
            const second = firstTagLabel(b);
            if (first === undefined && second === undefined) return byName(a, b);
            if (first === undefined) return 1;
            if (second === undefined) return -1;
            return first.localeCompare(second) || byName(a, b);
        });
    }
    return sorted;
}
