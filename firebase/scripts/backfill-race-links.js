// One-time migration for the Races catalog (see src/components/RacePage.js):
//
//  1. Races that predate visibility (no `public` field - today only the
//     hand-seeded ones like Kobold) are marked as admin-curated Defaults:
//     public: true, isDefault: true, plus `actions: [feat]` so the editor and
//     versioning have a list to work with. The old `feat` field is kept.
//     firestore.rules only lets people read races that are public or that
//     they can read/write, so until this runs such races are unreadable.
//
//  2. Characters without a `race_version` are pinned to the race they were
//     built from, so their sheets read that race live (see
//     src/utils/useClassVersion.js) instead of from the copy made at creation:
//       - race_version: the race's current version (`version`, or 1)
//       - race_actions: the saved copy the sheet falls back to - the
//                       character's own `race_feat` when it has one (the class
//                       link migration split it out), else the race's actions
//       - race_id:      only when missing/placeholder on the character and the
//                       race could be found by `race_name` instead
//
// The race is found by `race_id` when that names a real race, otherwise by
// exact name - and only when that leaves exactly one candidate. Characters
// whose race can't be found or is ambiguous are left alone on their saved
// copy and listed in the report. A character's own `actions`/`race_feat`
// fields are never touched, and characters that already have `race_version`
// are skipped, so this is safe to re-run.
//
// Runs via the Admin SDK (bypasses firestore.rules). Pass --dry-run to report
// without writing. Test locally with `npm run firebase:backfill-race-links:test`.
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

function raceActionsOf(race) {
    return race.actions ?? (race.feat ? [race.feat] : []);
}

function findRace(character, racesById, racesByName) {
    if (isRealId(character.race_id) && racesById.has(character.race_id)) {
        return { status: 'linked', id: character.race_id, data: racesById.get(character.race_id) };
    }
    const name = character.race_name;
    if (!name) return { status: 'unmatched', reason: 'no race id or race name on the character' };

    const candidates = racesByName.get(name) || [];
    if (candidates.length === 1) return { status: 'linked', id: candidates[0].id, data: candidates[0].data };
    if (candidates.length === 0) return { status: 'unmatched', reason: `no race named "${name}"` };
    return { status: 'ambiguous', reason: `${candidates.length} races named "${name}"` };
}

async function commitInBatches(db, updates) {
    for (let i = 0; i < updates.length; i += 500) {
        const batch = db.batch();
        updates.slice(i, i + 500).forEach(({ ref, update }) => batch.update(ref, update));
        await batch.commit();
    }
}

async function main() {
    if (DRY_RUN) console.log('--dry-run: no writes will be made.\n');
    const db = initDb();

    const raceDocs = (await db.collection('races').get()).docs;
    const raceUpdates = [];
    const racesById = new Map();
    const racesByName = new Map();
    for (const doc of raceDocs) {
        const race = doc.data();
        let current = race;
        if (race.public === undefined) {
            const update = { public: true, isDefault: true };
            if (race.actions === undefined) update.actions = raceActionsOf(race);
            console.log(`${DRY_RUN ? '[dry run] ' : ''}race ${doc.id} (${race.name}) -> Default (public, isDefault)` +
                (update.actions ? `, ${update.actions.length} action(s) copied from feat` : ''));
            raceUpdates.push({ ref: doc.ref, update });
            current = { ...race, ...update };
        }
        racesById.set(doc.id, current);
        if (!racesByName.has(current.name)) racesByName.set(current.name, []);
        racesByName.get(current.name).push({ id: doc.id, data: current });
    }

    const characters = (await db.collection('characters').get()).docs;
    const summary = { alreadyLinked: 0, linked: 0, unmatched: [], ambiguous: [] };
    const characterUpdates = [];

    for (const doc of characters) {
        const character = doc.data();
        if (Number.isInteger(character.race_version)) {
            summary.alreadyLinked++;
            continue;
        }
        const label = `${doc.id} (${character.character_name || 'unnamed'})`;
        const match = findRace(character, racesById, racesByName);
        if (match.status === 'unmatched') { summary.unmatched.push(`${label}: ${match.reason}`); continue; }
        if (match.status === 'ambiguous') { summary.ambiguous.push(`${label}: ${match.reason}`); continue; }

        const update = {
            race_version: match.data.version ?? 1,
            race_actions: character.race_feat ? [character.race_feat] : raceActionsOf(match.data),
        };
        if (character.race_id !== match.id) update.race_id = match.id;

        console.log(`${DRY_RUN ? '[dry run] ' : ''}${label} -> race ${match.id} v${update.race_version}` +
            (update.race_id ? ' (race_id repaired)' : '') +
            `, ${update.race_actions.length} saved race action(s)`);
        characterUpdates.push({ ref: doc.ref, update });
        summary.linked++;
    }

    if (!DRY_RUN) {
        await commitInBatches(db, raceUpdates);
        await commitInBatches(db, characterUpdates);
    }

    console.log(`\n${raceUpdates.length} race(s) ${DRY_RUN ? 'would be marked' : 'marked'} Default.`);
    console.log(`${characters.length} character(s): ${summary.alreadyLinked} already linked, ` +
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
