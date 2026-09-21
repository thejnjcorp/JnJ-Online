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

async function main() {
    if (DRY_RUN) console.log('--dry-run: no writes will be made.\n');
    const db = initDb();

    const characters = (await db.collection('characters').get()).docs;
    const itemsByKey = new Map(); // owner|title|description -> the item's id, so repeats share one
    const summary = { charactersChanged: 0, converted: 0, itemsMade: 0, alreadyItems: 0, skipped: [] };
    const work = [];

    for (const doc of characters) {
        const character = doc.data();
        const owner = character.playerId || character.userId || (character.admins || [])[0] || '';
        const readers = [...new Set([owner, ...(character.canRead || []), ...(character.canWrite || [])].filter(Boolean))];
        const update = {};
        const label = `${doc.id} (${character.character_name || 'unnamed'})`;

        for (const listName of LISTS) {
            const list = Array.isArray(character[listName]) ? character[listName] : null;
            if (!list) continue;
            let changed = false;
            const next = list.map(entry => {
                if (isItemEntry(entry)) { summary.alreadyItems++; return entry; }
                const name = clean(entry?.title).slice(0, MAX_ITEM_NAME);
                if (!name) {
                    summary.skipped.push(`${label}: an entry in ${listName} has no title`);
                    return entry;
                }
                const description = typeof entry.content === 'string' ? entry.content : '';
                const key = `${owner}|${name}|${description}`;
                let made = itemsByKey.get(key);
                if (made) {
                    // shared with another of this player's characters: everyone who can read either can read it
                    made.data.canRead = [...new Set([...made.data.canRead, ...readers])];
                }
                if (!made) {
                    const itemRef = db.collection('items').doc();
                    made = {
                        ref: itemRef,
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
                }
                const itemRef = made.ref;
                changed = true;
                summary.converted++;
                console.log(`${DRY_RUN ? '[dry run] ' : ''}${label}: "${name}" (${listName}, slot ${entry.status ?? '?'}) -> item ${itemRef.id}`);
                return { id: entry.id, item_id: itemRef.id, title: name, quantity: 1, status: entry.status, index: entry.index ?? 0 };
            });
            if (changed) update[listName] = next;
        }
        if (Object.keys(update).length > 0) {
            summary.charactersChanged++;
            work.push({ ref: doc.ref, data: update, update: true });
        }
    }

    if (!DRY_RUN) {
        // items first, so a character never refers to an item that isn't there yet
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
