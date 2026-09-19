// Seeds the Firestore emulator with races and characters covering every case
// the race migration handles - a legacy race with no visibility fields, one
// that's already public, a character with a real race_id (with and without
// its own race_feat copy), one matched by race_name, an ambiguous name, an
// unknown race, and one that's already linked - runs the actual migration
// script as a subprocess against that same emulator, then asserts what
// changed and what was left alone. Also exercises --dry-run.
//
// Run via: npm run firebase:backfill-race-links:test
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let failures = 0;
async function check(name, fn) {
    try {
        await fn();
        console.log(`  ok - ${name}`);
    } catch (e) {
        failures++;
        console.log(`  FAIL - ${name}`);
        console.log(`    ${e.message}`);
    }
}

function runMigration(extraArgs = []) {
    execFileSync('node', [path.join(__dirname, '..', 'scripts', 'backfill-race-links.js'), ...extraArgs], {
        env: process.env,
        stdio: 'inherit',
    });
}

async function main() {
    initializeApp({ projectId: 'jnj-online' });
    const db = getFirestore();

    const koboldFeat = { actionName: 'Mild Fire', description: 'Puff of flame' };
    const kobold = await db.collection('races').add({ name: 'Kobold', feat: koboldFeat });
    const elf = await db.collection('races').add({
        name: 'Elf', public: true, isDefault: false, version: 2, actions: [{ actionName: 'Keen Senses' }],
        canWrite: ['someone'],
    });
    await db.collection('races').add({ name: 'Twin', public: true, actions: [] });
    await db.collection('races').add({ name: 'Twin', public: true, actions: [] });

    const savedFeat = { actionName: 'Mild Fire', description: 'Puff of flame (character copy)' };
    const withRaceFeat = await db.collection('characters').add({
        character_name: 'With Race Feat', race_id: kobold.id, race_name: 'Kobold', race_feat: savedFeat,
        actions: [{ actionName: 'Stab' }],
    });
    const legacyMerged = await db.collection('characters').add({
        character_name: 'Legacy Merged', race_id: kobold.id, actions: [{ actionName: 'Stab' }, savedFeat],
    });
    const byName = await db.collection('characters').add({
        character_name: 'By Name', race_id: 'id', race_name: 'Elf', actions: [],
    });
    const ambiguous = await db.collection('characters').add({ character_name: 'Ambiguous', race_name: 'Twin', actions: [] });
    const unknown = await db.collection('characters').add({ character_name: 'Unknown', race_name: 'Beholder', actions: [] });
    const raceless = await db.collection('characters').add({ character_name: 'Raceless', actions: [] });
    const alreadyLinked = await db.collection('characters').add({
        character_name: 'Already Linked', race_id: elf.id, race_version: 1, race_actions: [], actions: [],
    });

    console.log('Dry run (must not write anything):');
    runMigration(['--dry-run']);
    await check('--dry-run leaves races and characters untouched', async () => {
        assert.equal((await kobold.get()).data().public, undefined);
        assert.equal((await withRaceFeat.get()).data().race_version, undefined);
    });

    console.log('\nReal run:');
    runMigration();

    await check('a legacy race with no visibility becomes a public Default, with its feat copied into actions and feat kept', async () => {
        const data = (await kobold.get()).data();
        assert.equal(data.public, true);
        assert.equal(data.isDefault, true);
        assert.deepEqual(data.actions, [koboldFeat]);
        assert.deepEqual(data.feat, koboldFeat);
    });

    await check('a race that already has visibility is not changed', async () => {
        const data = (await elf.get()).data();
        assert.equal(data.isDefault, false);
        assert.deepEqual(data.canWrite, ['someone']);
    });

    await check("a character's own race_feat becomes its saved race_actions, pinned to the race's version (1 when never versioned)", async () => {
        const data = (await withRaceFeat.get()).data();
        assert.equal(data.race_version, 1);
        assert.deepEqual(data.race_actions, [savedFeat]);
    });

    await check("a legacy character with the feat merged into actions gets the race's actions as its saved copy", async () => {
        const data = (await legacyMerged.get()).data();
        assert.equal(data.race_version, 1);
        assert.deepEqual(data.race_actions, [koboldFeat]);
    });

    await check("the character's own actions and race_feat are left untouched", async () => {
        const data = (await withRaceFeat.get()).data();
        assert.deepEqual(data.actions, [{ actionName: 'Stab' }]);
        assert.deepEqual(data.race_feat, savedFeat);
    });

    await check('a placeholder race_id is repaired by race name and pinned to that race\'s current version', async () => {
        const data = (await byName.get()).data();
        assert.equal(data.race_id, elf.id);
        assert.equal(data.race_version, 2);
        assert.deepEqual(data.race_actions, [{ actionName: 'Keen Senses' }]);
    });

    await check('an ambiguous name, an unknown race and a raceless character are left alone', async () => {
        for (const ref of [ambiguous, unknown, raceless]) {
            assert.equal((await ref.get()).data().race_version, undefined);
        }
    });

    await check('a character that is already linked is not changed', async () => {
        const data = (await alreadyLinked.get()).data();
        assert.equal(data.race_version, 1);
        assert.deepEqual(data.race_actions, []);
    });

    console.log('\nRe-run (must be idempotent):');
    runMigration();
    await check('running it again changes nothing further', async () => {
        assert.equal((await withRaceFeat.get()).data().race_version, 1);
        assert.equal((await byName.get()).data().race_version, 2);
        assert.deepEqual((await kobold.get()).data().actions, [koboldFeat]);
    });

    if (failures > 0) {
        console.log(`\n${failures} test(s) failed.`);
        process.exit(1);
    }
    console.log('\nAll tests passed.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
