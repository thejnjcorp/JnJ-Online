// Creates (or refreshes) the class-specific statuses in
// firebase/data/class-statuses.js - currently the Monk's Ignatious Shift
// Tokens, Stances and Unlocks.
//
// Each is matched by name among the statuses scoped to the same class:
//   - not found: created as a public admin-curated Default (isDefault), so
//     every campaign offers it - and, being scoped to the class by name, only
//     on sheets of that class - with no subscription step.
//   - found but different: its content is refreshed in place (name,
//     description, polarity, stacks, effects...). Permissions and visibility
//     are left alone.
//   - found and identical: skipped, so this is safe to re-run.
//
// Statuses already added to a character are copies and aren't touched.
//
// Runs via the Admin SDK (bypasses firestore.rules). Pass --dry-run to report
// without writing. Test locally with `npm run firebase:publish-class-statuses:test`.
const assert = require('node:assert/strict');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const statuses = require('../data/class-statuses');

const DRY_RUN = process.argv.includes('--dry-run');
const ADMIN_UID = 'wmJQbIlzX9RydXFmh3DzSBpIqHa2';

function initDb() {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
        initializeApp({ projectId: 'jnj-online' });
    } else {
        initializeApp({ credential: applicationDefault(), projectId: 'jnj-online' });
    }
    return getFirestore();
}

function sameContent(current, wanted) {
    return Object.entries(wanted).every(([key, value]) => {
        try {
            assert.deepStrictEqual(current[key], value);
            return true;
        } catch {
            return false;
        }
    });
}

async function main() {
    if (DRY_RUN) console.log('--dry-run: no writes will be made.\n');
    const db = initDb();
    const prefix = DRY_RUN ? '[dry run] ' : '';
    const problems = [];
    const summary = { created: 0, updated: 0, upToDate: 0 };

    for (const wanted of statuses) {
        const snap = await db.collection('statuses').where('name', '==', wanted.name).get();
        const matches = snap.docs.filter(doc => (doc.data().classes || []).some(name => wanted.classes.includes(name)));

        if (matches.length > 1) {
            problems.push(`${wanted.name}: ${matches.length} statuses share this name and class (${matches.map(doc => doc.id).join(', ')})`);
            continue;
        }

        if (matches.length === 0) {
            console.log(`${prefix}${wanted.name}: not found -> creating (${wanted.classes.join(', ')})`);
            if (!DRY_RUN) {
                await db.collection('statuses').add({
                    ...wanted,
                    public: true,
                    isDefault: true,
                    canRead: [],
                    campaignId: null,
                    canWrite: [ADMIN_UID],
                    admins: [ADMIN_UID],
                });
            }
            summary.created++;
            continue;
        }

        const doc = matches[0];
        if (sameContent(doc.data(), wanted)) {
            console.log(`${wanted.name} (${doc.id}): already up to date, skipped`);
            summary.upToDate++;
            continue;
        }
        console.log(`${prefix}${wanted.name} (${doc.id}): content differs -> updating`);
        if (!DRY_RUN) await doc.ref.update(wanted);
        summary.updated++;
    }

    console.log(`\n${summary.created} ${DRY_RUN ? 'to create' : 'created'}, ` +
        `${summary.updated} ${DRY_RUN ? 'to update' : 'updated'}, ${summary.upToDate} already up to date, ` +
        `${problems.length} problem(s).`);
    problems.forEach(line => console.log(`  problem: ${line}`));
    if (problems.length > 0) process.exitCode = 1;
}

main()
    .then(() => process.exit(process.exitCode ?? 0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
