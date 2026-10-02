// One-time migration: turns every character's hand-typed inventory cards (a title and a
// description, sorted into slots) into entries that refer to items in the item database
// (see src/utils/items.js and src/utils/inventory.js).
//
// For each entry in a character's `inventory` and `inventory_pocket` that has no
// `item_id` and has a title, it:
//   - creates a private item in `items`: the title as its name, the description as its
//     description, readable by the character's player and everyone who can already read
//     the character (so the party can see it), writable and administered by the
//     character's player;
//   - replaces the entry with { id, item_id, title, quantity: 1, status, index }, keeping
//     its id and its slot, so the sheet looks the same.
// The same title and description on the same player's characters share one item, readable
// by everyone who can read any of those characters. Entries
// with an `item_id` are left alone, and an entry with no title is reported and left, so
// this is safe to re-run.
//
// Runs via the Admin SDK (bypasses firestore.rules). Pass --dry-run to report without
// writing. Test locally with `npm run firebase:migrate-inventory:test`.
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const DRY_RUN = process.argv.includes('--dry-run');
const LISTS = ['inventory', 'inventory_pocket'];
const MAX_ITEM_NAME = 60;

function initDb() {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
        initializeApp({ projectId: 'jnj-online' });
    } else {
        initializeApp({ credential: applicationDefault(), projectId: 'jnj-online' });
    }
    return getFirestore();
}

const isItemEntry = entry => typeof entry?.item_id === 'string' && entry.item_id !== '';
const clean = value => (typeof value === 'string' ? value.trim() : '');

// The item a free-text entry becomes. Entries with the same owner, title and description share
// one item, readable by everyone who can read any of the characters that hold it.
function itemFor(name, description, { db, owner, readers, itemsByKey, work, summary }) {
    const key = `${owner}|${name}|${description}`;
    const existing = itemsByKey.get(key);
    if (existing) {
        existing.data.canRead = [...new Set([...existing.data.canRead, ...readers])];
        return existing;
    }
    const made = {
        ref: db.collection('items').doc(),
        data: {
            item_name: name,
            item_description: description,
            item_image: '',
            tags: [],
            isPublic: false,
            canRead: readers,
            canWrite: owner ? [owner] : [],
            admins: owner ? [owner] : [],
            migrated_from: 'inventory',
        },
    };
    itemsByKey.set(key, made);
    work.push(made);
    summary.itemsMade++;
    return made;
}

// One inventory entry: already an item entry (left as it is), untitled (skipped and
// reported), or converted to an entry that refers to an item.
function convertEntry(entry, listName, context) {
    const { label, summary } = context;
    if (isItemEntry(entry)) {
        summary.alreadyItems++;
        return { entry, changed: false };
    }
    const name = clean(entry?.title).slice(0, MAX_ITEM_NAME);
    if (!name) {
        summary.skipped.push(`${label}: an entry in ${listName} has no title`);
        return { entry, changed: false };
    }
    const description = typeof entry.content === 'string' ? entry.content : '';
    const made = itemFor(name, description, context);
    summary.converted++;
    console.log(`${DRY_RUN ? '[dry run] ' : ''}${label}: "${name}" (${listName}, slot ${entry.status ?? '?'}) -> item ${made.ref.id}`);
    return { entry: { id: entry.id, item_id: made.ref.id, title: name, quantity: 1, status: entry.status, index: entry.index ?? 0 }, changed: true };
}

// The inventory lists of one character that have something to convert, as an update.
function convertCharacter(doc, shared) {
    const character = doc.data();
    const owner = character.playerId || character.userId || (character.admins || [])[0] || '';
    const readers = [...new Set([owner, ...(character.canRead || []), ...(character.canWrite || [])].filter(Boolean))];
    const label = `${doc.id} (${character.character_name || 'unnamed'})`;
    const context = { ...shared, owner, readers, label };
    const update = {};
    for (const listName of LISTS) {
        if (!Array.isArray(character[listName])) continue;
        const results = character[listName].map(entry => convertEntry(entry, listName, context));
        if (results.some(result => result.changed)) update[listName] = results.map(result => result.entry);
    }
    return update;
}

// Items first, so a character never refers to an item that isn't there yet.
async function commitWork(db, work) {
    const items = work.filter(entry => !entry.update);
    const sheets = work.filter(entry => entry.update);
    for (const group of [items, sheets]) {
        for (let i = 0; i < group.length; i += 400) {
            const batch = db.batch();
            group.slice(i, i + 400).forEach(({ ref, data, update }) => (update ? batch.update(ref, data) : batch.set(ref, data)));
            await batch.commit();
        }
    }
}

async function main() {
    if (DRY_RUN) console.log('--dry-run: no writes will be made.\n');
    const db = initDb();

    const characters = (await db.collection('characters').get()).docs;
    const itemsByKey = new Map(); // owner|title|description -> the item's id, so repeats share one
    const summary = { charactersChanged: 0, converted: 0, itemsMade: 0, alreadyItems: 0, skipped: [] };
    const work = [];

    for (const doc of characters) {
        const update = convertCharacter(doc, { db, itemsByKey, work, summary });
        if (Object.keys(update).length > 0) {
            summary.charactersChanged++;
            work.push({ ref: doc.ref, data: update, update: true });
        }
    }

    if (!DRY_RUN) await commitWork(db, work);

    console.log(`\n${characters.length} character(s): ${summary.charactersChanged} ${DRY_RUN ? 'would change' : 'changed'}, ` +
        `${summary.converted} entr${summary.converted === 1 ? 'y' : 'ies'} ${DRY_RUN ? 'would become' : 'became'} items ` +
        `(${summary.itemsMade} item${summary.itemsMade === 1 ? '' : 's'} ${DRY_RUN ? 'would be made' : 'made'}), ` +
        `${summary.alreadyItems} already items.`);
    summary.skipped.forEach(line => console.log(`  skipped: ${line}`));
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
