// The item database.
//
// An item (`items` collection) says what a thing is: a torch, a rope, a magic
// dagger. It is written once and inventories only refer to it (see inventory.js), so
// common gear is shared instead of retyped on every sheet. Who can read and edit it
// works like the bestiary's enemies: `isPublic` ones are for everyone, the rest for
// whoever is in `canRead` / `canWrite`, and `admins` can change that.
//
//   { item_name, item_description, item_image (an image ref - see imageRefs.js),
//     tags: [string], isPublic, canRead: [uid], canWrite: [uid], admins: [uid] }

import { imageRef } from './imageRefs';

export const MAX_ITEM_NAME = 60;
export const MAX_ITEM_DESCRIPTION = 4000;
export const MAX_ITEM_TAGS = 10;
export const MAX_TAG_LENGTH = 24;

export const newItem = () => ({ item_name: '', item_description: '', item_image: '', tags: [], isPublic: false });

const isBlank = value => typeof value !== 'string' || value.trim() === '';

// Tags as they are kept: trimmed, single-spaced, lower-case (so "Weapon" and "weapon"
// are one tag), no blanks, no repeats, none too long, and no more than an item may
// have.
export function normalizeTags(tags) {
    const seen = new Set();
    const kept = [];
    (Array.isArray(tags) ? tags : []).forEach(tag => {
        if (typeof tag !== 'string') return;
        const cleaned = tag.trim().replace(/\s+/g, ' ').toLowerCase().slice(0, MAX_TAG_LENGTH).trim();
        if (cleaned === '' || seen.has(cleaned)) return;
        seen.add(cleaned);
        kept.push(cleaned);
    });
    return kept.slice(0, MAX_ITEM_TAGS);
}

// Messages by field, and `problems` (in page order) for the summary list - the same
// shape as validateEnemy's.
export function validateItem(item) {
    const fields = {};
    const problems = [];
    const add = (id, field, label, message) => {
        fields[field] = message;
        problems.push({ id, label, message });
    };

    if (isBlank(item.item_name)) add('field-item_name', 'item_name', 'Name', 'Give the item a name.');
    else if (item.item_name.trim().length > MAX_ITEM_NAME) add('field-item_name', 'item_name', 'Name', `Keep the name to ${MAX_ITEM_NAME} characters.`);
    if (typeof item.item_description === 'string' && item.item_description.length > MAX_ITEM_DESCRIPTION) {
        add('field-item_description', 'item_description', 'Description', `Keep the description to ${MAX_ITEM_DESCRIPTION} characters.`);
    }
    if (!isBlank(item.item_image) && !imageRef(item.item_image)) add('field-item_image', 'item_image', 'Picture', 'Use a web link to a picture, starting with https://.');
    if (Array.isArray(item.tags) && item.tags.some(tag => typeof tag === 'string' && tag.trim().length > MAX_TAG_LENGTH)) {
        add('field-tags', 'tags', 'Tags', `Keep each tag to ${MAX_TAG_LENGTH} characters.`);
    }
    return { fields, problems, valid: problems.length === 0 };
}

export const NO_ITEM_ERRORS = Object.freeze({ fields: {}, problems: [], valid: true });

// What an item's form saves: its trimmed name, its description, its picture (an
// Imgur link kept as just its hash; nothing usable as nothing) and its tags. Who can
// read and write it is set by the page.
export function itemDocFields(form) {
    return {
        item_name: (form.item_name || '').trim(),
        item_description: form.item_description || '',
        item_image: imageRef(form.item_image) ?? '',
        tags: normalizeTags(form.tags),
        isPublic: Boolean(form.isPublic),
    };
}

// Whether an item matches what is typed in a search box (its name or description,
// ignoring case) and the tag picked to filter by (none: any).
export function itemMatches(item, search = '', tag = '') {
    const needle = search.trim().toLowerCase();
    if (tag && !(item.tags || []).includes(tag)) return false;
    if (!needle) return true;
    return `${item.item_name || ''} ${item.item_description || ''}`.toLowerCase().includes(needle);
}

// Every tag used across some items, alphabetically, for a filter to offer.
export const tagsOf = items => [...new Set(items.flatMap(item => item.tags || []))].sort((a, b) => a.localeCompare(b));

export const sortItems = items => [...items].sort((a, b) => (a.item_name || '').localeCompare(b.item_name || ''));
