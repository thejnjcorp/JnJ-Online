// Fills the item database with the everyday gear every table ends up needing - a
// torch, rations, a rope, a basic weapon - as public items, so nobody has to type
// them out and everyone's inventory refers to the same one (see src/utils/items.js).
//
// They are written plainly, with no game numbers: a table that wants its own stats can
// edit them (they belong to the account named by --owner, the app admin by default) or
// make its own. Each carries a `seed_key`, so running this again only adds what is
// missing and never duplicates or overwrites something that has been edited.
//
// Runs via the Admin SDK (bypasses firestore.rules). Pass --dry-run to report without
// writing, and --owner=<uid> to give the items to someone else. Test locally with
// `npm run firebase:seed-items:test`.
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const DRY_RUN = process.argv.includes('--dry-run');
const APP_ADMIN_UID = 'wmJQbIlzX9RydXFmh3DzSBpIqHa2';
const ownerArgument = process.argv.find(argument => argument.startsWith('--owner='));
const OWNER = ownerArgument ? ownerArgument.slice('--owner='.length) : APP_ADMIN_UID;

const COMMON_ITEMS = [
    { key: 'torch', name: 'Torch', description: 'A wooden brand wrapped in oiled cloth. Burns for about an hour and lights a small area.', tags: ['light', 'tool'] },
    { key: 'lantern', name: 'Lantern', description: 'A hooded lantern that burns a flask of oil. Lights a wider area than a torch and survives a breeze.', tags: ['light', 'tool'] },
    { key: 'oil-flask', name: 'Flask of Oil', description: 'Fuel for a lantern. Burns if lit and thrown.', tags: ['consumable', 'light'] },
    { key: 'tinderbox', name: 'Tinderbox', description: 'Flint, steel and dry tinder for lighting a fire.', tags: ['tool'] },
    { key: 'rations', name: 'Rations', description: 'A day of dried meat, hard cheese and travel bread.', tags: ['food', 'consumable'] },
    { key: 'waterskin', name: 'Waterskin', description: 'A leather skin that holds a day of water.', tags: ['tool', 'food'] },
    { key: 'rope', name: 'Rope (50 ft)', description: 'Fifty feet of sturdy hemp rope.', tags: ['tool'] },
    { key: 'bedroll', name: 'Bedroll', description: 'A blanket and ground cloth for sleeping rough.', tags: ['tool'] },
    { key: 'backpack', name: 'Backpack', description: 'A canvas pack with straps, for carrying the rest.', tags: ['tool'] },
    { key: 'crowbar', name: 'Crowbar', description: 'An iron bar for prying open crates, doors and the occasional coffin.', tags: ['tool'] },
    { key: 'thieves-tools', name: "Thieves' Tools", description: 'Picks, a small file and a set of wires for opening locks quietly.', tags: ['tool'] },
    { key: 'healing-potion', name: 'Healing Potion', description: 'A small red vial. Drunk, it closes wounds.', tags: ['consumable', 'potion'] },
    { key: 'dagger', name: 'Dagger', description: 'A short blade for close work. Light enough to throw.', tags: ['weapon', 'melee'] },
    { key: 'shortsword', name: 'Shortsword', description: 'A one-handed blade for close quarters.', tags: ['weapon', 'melee'] },
    { key: 'longsword', name: 'Longsword', description: 'A well-balanced one-handed blade, or two-handed for a harder swing.', tags: ['weapon', 'melee'] },
    { key: 'quarterstaff', name: 'Quarterstaff', description: 'A length of hardwood, as good for walking as for fighting.', tags: ['weapon', 'melee'] },
    { key: 'shortbow', name: 'Shortbow', description: 'A light bow, easy to carry and to loose from horseback.', tags: ['weapon', 'ranged'] },
    { key: 'arrows', name: 'Arrows (20)', description: 'A quiver of twenty arrows.', tags: ['weapon', 'ranged', 'consumable'] },
    { key: 'shield', name: 'Shield', description: 'A wooden shield, rimmed with iron, carried on the arm.', tags: ['armor'] },
    { key: 'leather-armor', name: 'Leather Armor', description: 'Boiled and stitched leather. Light and quiet.', tags: ['armor'] },
];

function initDb() {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
        initializeApp({ projectId: 'jnj-online' });
    } else {
        initializeApp({ credential: applicationDefault(), projectId: 'jnj-online' });
    }
    return getFirestore();
}

async function main() {
    if (DRY_RUN) console.log('--dry-run: no writes will be made.\n');
    const db = initDb();

    const existing = new Set((await db.collection('items').where('seed_key', '!=', '').get()).docs.map(doc => doc.data().seed_key));
    const missing = COMMON_ITEMS.filter(item => !existing.has(item.key));

    missing.forEach(item => console.log(`${DRY_RUN ? '[dry run] ' : ''}adding "${item.name}" (${item.tags.join(', ')})`));

    if (!DRY_RUN) {
        const batch = db.batch();
        missing.forEach(item => batch.set(db.collection('items').doc(), {
            item_name: item.name,
            item_description: item.description,
            item_image: '',
            tags: item.tags,
            isPublic: true,
            canRead: [],
            canWrite: [OWNER],
            admins: [OWNER],
            seed_key: item.key,
        }));
        if (missing.length > 0) await batch.commit();
    }

    console.log(`\n${COMMON_ITEMS.length} common item(s): ${COMMON_ITEMS.length - missing.length} already there, ${missing.length} ${DRY_RUN ? 'would be added' : 'added'}.`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
