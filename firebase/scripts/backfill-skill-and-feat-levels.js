// One-time migration for the Feats/Skills-and-Flaws rework: Feats now carry a
// 1-3 tier (see featTierOf, src/utils/classActions.js) and Skills/Flaws now
// carry a named "level" with a fixed roleplay modifier instead of a plain 1-3
// degree (see levelOf, src/utils/skillsAndFlaws.js).
//
// Neither app.js nor firestore.rules actually require this to have run first
// - both read functions already fall back at read time (a feat with no tier
// shows tier 1; a skill/flaw with no level but an old degree shows the level
// that degree maps onto) - so this is a data-quality cleanup, safe to run
// whenever, not a blocking step in the deploy order.
//
// For every class/race action with category "feat" and no `tier`, sets
// tier: 1. For every character's skills_and_flaws entry with no `level`, sets
// level from its old numeric `degree` (1->the first level, 2->the second,
// 3->the third; nothing ever reaches the fourth, Ultimate/PTSD, since the old
// scale topped out at 3). Nothing is deleted - `degree` is left in place -
// and an entry that already has a `level` is left alone, so this is safe to
// re-run.
//
// Runs via the Admin SDK (bypasses firestore.rules). Pass --dry-run to report
// without writing. Test locally with `npm run firebase:backfill-skill-and-feat-levels:test`.
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const DRY_RUN = process.argv.includes('--dry-run');

const SKILL_LEVELS = ['general', 'trained', 'specialized', 'ultimate'];
const FLAW_LEVELS = ['minor', 'flaw', 'major', 'ptsd'];

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

function levelFromDegree(entry) {
    const levels = entry.isSkill ? SKILL_LEVELS : FLAW_LEVELS;
    const degree = Number.isInteger(entry.degree) ? entry.degree : 1;
    return levels[Math.min(Math.max(degree, 1), levels.length) - 1];
}

// Adds tier: 1 to every feat action missing one; returns { next, count } (count
// 0 and next === actions when nothing in it needed changing).
function tieredActions(actions) {
    if (!Array.isArray(actions)) return { next: actions, count: 0 };
    let count = 0;
    const next = actions.map(action => {
        if (action?.category !== 'feat' || action.tier !== undefined) return action;
        count++;
        return { ...action, tier: 1 };
    });
    return { next, count };
}

async function backfillActions(db, collectionName, summary) {
    const docs = (await db.collection(collectionName).get()).docs;
    const updates = [];
    for (const doc of docs) {
        const { next, count } = tieredActions(doc.data().actions);
        if (count === 0) continue;
        console.log(`${DRY_RUN ? '[dry run] ' : ''}${collectionName}/${doc.id}: ${count} feat(s) set to tier 1`);
        updates.push({ ref: doc.ref, update: { actions: next } });
        summary.tiered += count;
    }
    if (!DRY_RUN) for (const { ref, update } of updates) await ref.update(update);
    summary.docsTouched += updates.length;
}

async function backfillCharacters(db, summary) {
    const docs = (await db.collection('characters').get()).docs;
    const updates = [];
    for (const doc of docs) {
        const data = doc.data();
        const entries = data.skills_and_flaws;
        if (!Array.isArray(entries) || entries.length === 0) continue;
        let count = 0;
        const next = entries.map(entry => {
            if (entry.level) return entry;
            count++;
            return { ...entry, level: levelFromDegree(entry) };
        });
        if (count === 0) continue;
        console.log(`${DRY_RUN ? '[dry run] ' : ''}characters/${doc.id} (${data.character_name || 'unnamed'}): ${count} skill/flaw(s) given a level`);
        updates.push({ ref: doc.ref, update: { skills_and_flaws: next } });
        summary.leveled += count;
    }
    if (!DRY_RUN) for (const { ref, update } of updates) await ref.update(update);
    summary.charactersTouched += updates.length;
}

async function main() {
    if (DRY_RUN) console.log('--dry-run: no writes will be made.\n');
    const db = initDb();

    const summary = { tiered: 0, docsTouched: 0, leveled: 0, charactersTouched: 0 };
    await backfillActions(db, 'classes', summary);
    await backfillActions(db, 'races', summary);
    await backfillCharacters(db, summary);

    console.log(`\n${summary.tiered} feat(s) across ${summary.docsTouched} class/race doc(s) ${DRY_RUN ? 'would be' : 'were'} set to tier 1.`);
    console.log(`${summary.leveled} skill/flaw(s) across ${summary.charactersTouched} character(s) ${DRY_RUN ? 'would be' : 'were'} given a level.`);
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
