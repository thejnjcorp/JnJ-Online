// One-time migration: sets the new `admins` field (see firestore.rules) on
// every existing document that predates it, across every collection that
// gained an admin-gated create/permission-write rule.
//
// Why this is needed: firestore.rules now only lets a document's admins
// change its own canRead/canWrite/admins fields - a plain canWrite
// collaborator can still edit ordinary content, but not who else can
// read/write/administer it. A document with no `admins` field has nobody
// in that tier, which silently breaks anything that resaves
// canRead/canWrite on existing data - concretely, StatusPage.js's
// documented "editing a campaign-locked status re-copies the campaign's
// current membership into canRead" refresh flow, for every status that
// existed before this migration ran.
//
// Backfill values, chosen to exactly preserve what was already possible
// the moment before this migration runs (not to expand or narrow it):
//   - campaigns:            admins = [director_uid]  (the pre-existing,
//                            still-unrestricted owner field)
//   - characters:           admins = [playerId]      (same idea)
//   - classes/statuses/races/maps: admins = canWrite  (these collections
//                            never had a dedicated owner field - before this
//                            migration, ANY canWrite holder could already
//                            freely change canRead/canWrite/admins on them,
//                            so admins = canWrite is the only backfill that
//                            doesn't take capability away from someone who
//                            already had it)
//
// A document that already has an `admins` field (created after the rules
// change, or already migrated) is left untouched - safe to re-run.
//
// Runs via the Admin SDK, which bypasses firestore.rules entirely (this is
// server-side maintenance, not a user-initiated write). Pass --dry-run to
// report what would change without writing anything. Locally test via
// `npm run firebase:backfill-admins:test` against the emulator first.
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const DRY_RUN = process.argv.includes('--dry-run');

// [collectionName, ownerFieldName-or-null]. A null owner field means "no
// dedicated owner field on this collection - fall back to canWrite".
const COLLECTIONS = [
    ['campaigns', 'director_uid'],
    ['characters', 'playerId'],
    ['classes', null],
    ['statuses', null],
    ['races', null],
    ['maps', null],
];

function initDb() {
    // FIRESTORE_EMULATOR_HOST (set by `firebase emulators:exec`) makes the
    // Admin SDK talk to the local emulator instead of production - no real
    // credentials needed for that path, which is how this script is tested.
    if (process.env.FIRESTORE_EMULATOR_HOST) {
        initializeApp({ projectId: 'jnj-online' });
    } else {
        initializeApp({ credential: applicationDefault() });
    }
    return getFirestore();
}

function computeAdmins(data, ownerField) {
    const owner = ownerField ? data[ownerField] : null;
    if (owner) return [owner];
    if (Array.isArray(data.canWrite) && data.canWrite.length > 0) return data.canWrite;
    // No owner field and no canWrite either - nothing to preserve access
    // for, but every document should still end up with at least an empty
    // admins field so future admin-management code has something to work
    // with rather than needing yet another "field might not exist" check.
    return [];
}

async function backfillCollection(db, collectionName, ownerField) {
    const snap = await db.collection(collectionName).get();
    const toUpdate = snap.docs.filter((doc) => !('admins' in doc.data()));

    console.log(`${collectionName}: ${snap.size} document(s), ${toUpdate.length} missing admins`);
    if (toUpdate.length === 0) return { collectionName, updated: 0 };

    if (DRY_RUN) {
        toUpdate.forEach((doc) => {
            console.log(`  [dry run] ${collectionName}/${doc.id} -> admins: ${JSON.stringify(computeAdmins(doc.data(), ownerField))}`);
        });
        return { collectionName, updated: toUpdate.length };
    }

    // Firestore batches cap at 500 writes - chunk defensively even though no
    // collection here is expected to be anywhere near that size yet.
    for (let i = 0; i < toUpdate.length; i += 500) {
        const batch = db.batch();
        toUpdate.slice(i, i + 500).forEach((doc) => {
            batch.update(doc.ref, { admins: computeAdmins(doc.data(), ownerField) });
        });
        await batch.commit();
    }
    return { collectionName, updated: toUpdate.length };
}

async function main() {
    if (DRY_RUN) console.log('--dry-run: no writes will be made.\n');
    const db = initDb();

    const results = [];
    for (const [collectionName, ownerField] of COLLECTIONS) {
        results.push(await backfillCollection(db, collectionName, ownerField));
    }

    const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
    console.log(`\n${DRY_RUN ? 'Would update' : 'Updated'} ${totalUpdated} document(s) total.`);
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
