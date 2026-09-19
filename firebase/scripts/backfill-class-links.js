// One-time migration: links every existing character to the class it was
// built from, so character sheets read that class live (see
// src/utils/useClassVersion.js) instead of from the copy made at creation.
//
// For each character without a `class_version` it sets:
//   - class_version: the class's current version (`version`, or 1 for a class
//     that has never been versioned)
//   - class_id:      only when missing/placeholder ("id") on the character
//                    and the class could be found by name instead
//   - race_feat:     the character's race feat, split out of `actions` (new
//                    characters keep it in its own field so a live class can
//                    replace `actions` without dropping it)
//
// The class is found by `class_id` when that names a real class, otherwise by
// exact class name (plus author, when the character has one) - and only when
// that leaves exactly one candidate. Characters whose class can't be found or
// is ambiguous are left alone on their saved copy and listed in the report.
//
// A character's own `actions`/`base_*`/`class_*` fields are never touched:
// they stay as the saved copy the sheet falls back to if the class can't be
// read. Characters that already have `class_version` are skipped, so this is
// safe to re-run.
//
// Runs via the Admin SDK (bypasses firestore.rules). Pass --dry-run to report
// without writing. Test locally with `npm run firebase:backfill-class-links:test`.
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const DRY_RUN = process.argv.includes('--dry-run');

function initDb() {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
        initializeApp({ projectId: 'jnj-online' });
    } else {
        // projectId is pinned because Application Default Credentials from
        // `gcloud auth application-default login` don't carry one, and the
        // SDK then fails with "Unable to detect a Project Id".
        initializeApp({ credential: applicationDefault(), projectId: 'jnj-online' });
    }
    return getFirestore();
}

function isRealId(value) {
    return typeof value === 'string' && value !== '' && value !== 'id';
}

function legacyClassName(character) {
    const name = character.class_name || character.class;
    return name && name !== 'class' ? name : null;
}

function findClass(character, classesById, classesByName) {
    if (isRealId(character.class_id) && classesById.has(character.class_id)) {
        return { status: 'linked', id: character.class_id, data: classesById.get(character.class_id) };
    }
    const name = legacyClassName(character);
    if (!name) return { status: 'unmatched', reason: 'no class id or class name on the character' };

    let candidates = classesByName.get(name) || [];
    if (candidates.length > 1 && character.author) {
        const sameAuthor = candidates.filter(candidate => candidate.data.author === character.author);
        if (sameAuthor.length > 0) candidates = sameAuthor;
    }
    if (candidates.length === 1) return { status: 'linked', id: candidates[0].id, data: candidates[0].data };
    if (candidates.length === 0) return { status: 'unmatched', reason: `no class named "${name}"` };
    return { status: 'ambiguous', reason: `${candidates.length} classes named "${name}"` };
}

function findRaceFeat(character, racesById) {
    const race = isRealId(character.race_id) ? racesById.get(character.race_id) : null;
    if (!race?.feat) return null;
    const saved = (character.actions || []).find(action => action.actionName === race.feat.actionName);
    return saved || race.feat;
}

async function main() {
    if (DRY_RUN) console.log('--dry-run: no writes will be made.\n');
    const db = initDb();

    const classesById = new Map();
    const classesByName = new Map();
    (await db.collection('classes').get()).docs.forEach(doc => {
        classesById.set(doc.id, doc.data());
        const name = doc.data().class_name;
        if (!classesByName.has(name)) classesByName.set(name, []);
        classesByName.get(name).push({ id: doc.id, data: doc.data() });
    });
    const racesById = new Map((await db.collection('races').get()).docs.map(doc => [doc.id, doc.data()]));

    const characters = (await db.collection('characters').get()).docs;
    const summary = { alreadyLinked: 0, linked: 0, unmatched: [], ambiguous: [] };
    const updates = [];

    for (const doc of characters) {
        const character = doc.data();
        if (Number.isInteger(character.class_version)) {
            summary.alreadyLinked++;
            continue;
        }
        const label = `${doc.id} (${character.character_name || 'unnamed'})`;
        const match = findClass(character, classesById, classesByName);
        if (match.status === 'unmatched') { summary.unmatched.push(`${label}: ${match.reason}`); continue; }
        if (match.status === 'ambiguous') { summary.ambiguous.push(`${label}: ${match.reason}`); continue; }

        const update = { class_version: match.data.version ?? 1 };
        if (!isRealId(character.class_id) || character.class_id !== match.id) update.class_id = match.id;
        const raceFeat = findRaceFeat(character, racesById);
        if (raceFeat) update.race_feat = raceFeat;

        const classActionNames = new Set((match.data.actions || []).map(action => action.actionName));
        const stale = (character.actions || []).filter(action =>
            !classActionNames.has(action.actionName) && action.actionName !== raceFeat?.actionName);

        console.log(`${DRY_RUN ? '[dry run] ' : ''}${label} -> class ${match.id} v${update.class_version}` +
            (update.class_id ? ' (class_id repaired)' : '') +
            (raceFeat ? `, race feat "${raceFeat.actionName}"` : ''));
        if (stale.length > 0) {
            console.log(`    note: ${stale.length} saved action(s) not in the current class (kept on the saved copy): ${stale.map(a => a.actionName).join(', ')}`);
        }
        updates.push({ ref: doc.ref, update });
        summary.linked++;
    }

    if (!DRY_RUN) {
        for (let i = 0; i < updates.length; i += 500) {
            const batch = db.batch();
            updates.slice(i, i + 500).forEach(({ ref, update }) => batch.update(ref, update));
            await batch.commit();
        }
    }

    console.log(`\n${characters.length} character(s): ${summary.alreadyLinked} already linked, ` +
        `${summary.linked} ${DRY_RUN ? 'would be linked' : 'linked'}, ` +
        `${summary.unmatched.length} unmatched, ${summary.ambiguous.length} ambiguous.`);
    summary.unmatched.forEach(line => console.log(`  unmatched: ${line}`));
    summary.ambiguous.forEach(line => console.log(`  ambiguous: ${line}`));
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
