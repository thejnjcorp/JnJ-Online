// Publishes the class write-ups in firebase/data/class-updates.js.
//
// For each entry it looks the class up by name:
//   - found: publishes the entry as a NEW VERSION, exactly as the class page's
//     "Publish" button does. The class as it stands is frozen as
//     classes/{id}/versions/{n}, then the class doc is updated with the new
//     content and version n+1 (plus the changelog note). Characters stay pinned
//     to the version they use until someone switches them. Only the fields the
//     write-up states are written; visibility, admins, class type etc. are left
//     alone.
//   - not found: creates it as a public admin-curated Default at version 1
//     (only when the entry has a `create` block - i.e. Magus).
//   - found but already matching the entry: skipped, so this is safe to re-run.
//
// A name that matches several classes is narrowed to the admin-curated
// Defaults; if that still isn't exactly one, it is reported and left alone.
//
// Runs via the Admin SDK (bypasses firestore.rules). Pass --dry-run to report
// without writing. Test locally with `npm run firebase:publish-class-updates:test`.
const assert = require('node:assert/strict');
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const updates = require('../data/class-updates');

const DRY_RUN = process.argv.includes('--dry-run');
const ADMIN_UID = 'wmJQbIlzX9RydXFmh3DzSBpIqHa2';

// Mirrors NON_CONTENT_FIELDS in src/utils/versionedDocs.js: permission and
// visibility belong to the class as a whole, never to one version.
const NON_CONTENT_FIELDS = ['id', 'public', 'isDefault', 'canRead', 'canWrite', 'admins', 'visibility'];

function initDb() {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
        initializeApp({ projectId: 'jnj-online' });
    } else {
        initializeApp({ credential: applicationDefault(), projectId: 'jnj-online' });
    }
    return getFirestore();
}

function versionOf(data) {
    return data.version ?? 1;
}

function docContent(data) {
    return Object.fromEntries(
        Object.entries(data).filter(([key, value]) => !NON_CONTENT_FIELDS.includes(key) && value !== undefined)
    );
}

function matchesContent(current, content) {
    return Object.entries(content).every(([key, value]) => {
        try {
            assert.deepStrictEqual(current[key], value);
            return true;
        } catch {
            return false;
        }
    });
}

async function findClass(db, className) {
    const snap = await db.collection('classes').where('class_name', '==', className).get();
    let candidates = snap.docs;
    if (candidates.length > 1) {
        const defaults = candidates.filter(doc => doc.data().isDefault === true);
        if (defaults.length > 0) candidates = defaults;
    }
    return candidates;
}

async function publish(db, ref, entry) {
    return db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        const current = snap.data();
        const currentVersion = versionOf(current);
        transaction.set(ref.collection('versions').doc(String(currentVersion)), {
            ...docContent(current),
            version: currentVersion,
        });
        transaction.update(ref, {
            ...entry.content,
            version: currentVersion + 1,
            versionNotes: entry.versionNotes,
            publishedAt: FieldValue.serverTimestamp(),
        });
        return currentVersion + 1;
    });
}

async function main() {
    if (DRY_RUN) console.log('--dry-run: no writes will be made.\n');
    const db = initDb();
    const prefix = DRY_RUN ? '[dry run] ' : '';
    const problems = [];
    const summary = { published: 0, created: 0, upToDate: 0 };

    for (const entry of updates) {
        const matches = await findClass(db, entry.class_name);

        if (matches.length > 1) {
            problems.push(`${entry.class_name}: ${matches.length} classes share this name (${matches.map(doc => doc.id).join(', ')})`);
            continue;
        }

        if (matches.length === 0) {
            if (!entry.create) {
                problems.push(`${entry.class_name}: no such class, and the entry doesn't say how to create one`);
                continue;
            }
            console.log(`${prefix}${entry.class_name}: not found -> creating as a Default at v1, ${entry.content.actions.length} action(s)`);
            if (!DRY_RUN) {
                await db.collection('classes').add({
                    ...entry.create,
                    ...entry.content,
                    version: 1,
                    versionNotes: entry.versionNotes,
                    publishedAt: FieldValue.serverTimestamp(),
                    public: true,
                    isDefault: true,
                    canRead: [],
                    canWrite: [ADMIN_UID],
                    admins: [ADMIN_UID],
                });
            }
            summary.created++;
            continue;
        }

        const doc = matches[0];
        const current = doc.data();
        if (matchesContent(current, entry.content)) {
            console.log(`${entry.class_name} (${doc.id}): already up to date at v${versionOf(current)}, skipped`);
            summary.upToDate++;
            continue;
        }

        const from = versionOf(current);
        console.log(`${prefix}${entry.class_name} (${doc.id}): v${from} -> v${from + 1}, ` +
            `${(current.actions || []).length} -> ${entry.content.actions.length} action(s)`);
        if (!DRY_RUN) await publish(db, doc.ref, entry);
        summary.published++;
    }

    console.log(`\n${summary.published} ${DRY_RUN ? 'to publish' : 'published'}, ` +
        `${summary.created} ${DRY_RUN ? 'to create' : 'created'}, ${summary.upToDate} already up to date, ` +
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
