// Seeds the Firestore emulator with classes, races and characters covering
// every case the class-link migration handles - a character with a real
// class_id, one with the placeholder "id" that has to be matched by name, an
// ambiguous name, an unknown class, and one that's already linked - runs the
// actual migration script as a subprocess against that same emulator, then
// asserts what changed and what was left alone. Also exercises --dry-run.
//
// Run via: npm run firebase:backfill-class-links:test
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
    execFileSync('node', [path.join(__dirname, '..', 'scripts', 'backfill-class-links.js'), ...extraArgs], {
        env: process.env,
        stdio: 'inherit',
    });
}

async function main() {
    initializeApp({ projectId: 'jnj-online' });
    const db = getFirestore();

    const fighter = await db.collection('classes').add({
        class_name: 'Fighter', author: 'Jonah',
        actions: [{ actionName: 'Power Attack' }],
    });
    const monk = await db.collection('classes').add({
        class_name: 'Monk', author: 'Jonah', version: 3,
        actions: [{ actionName: 'Fleetfoot' }],
    });
    await db.collection('classes').add({ class_name: 'Twin', author: 'A', actions: [] });
    await db.collection('classes').add({ class_name: 'Twin', author: 'B', actions: [] });
    const kobold = await db.collection('races').add({
        name: 'Kobold', feat: { actionName: 'Mild Fire', description: 'Puff of flame' },
    });

    const savedRaceFeat = { actionName: 'Mild Fire', description: 'Puff of flame (character copy)' };
    const linkable = await db.collection('characters').add({
        character_name: 'Linkable', class_id: fighter.id, race_id: kobold.id,
        actions: [{ actionName: 'Power Attack' }, { actionName: 'Old Renamed Action' }, savedRaceFeat],
    });
    const placeholder = await db.collection('characters').add({
        character_name: 'Placeholder', class_id: 'id', class_name: 'Monk', author: 'Jonah', actions: [],
    });
    const ambiguous = await db.collection('characters').add({
        character_name: 'Ambiguous', class_name: 'Twin', actions: [],
    });
    const unknown = await db.collection('characters').add({
        character_name: 'Unknown', class_name: 'Necromancer', actions: [],
    });
    const alreadyLinked = await db.collection('characters').add({
        character_name: 'Already Linked', class_id: fighter.id, class_version: 2, actions: [],
    });

    console.log('Dry run (must not write anything):');
    runMigration(['--dry-run']);
    await check('--dry-run leaves every character untouched', async () => {
        const data = (await linkable.get()).data();
        assert.equal(data.class_version, undefined);
        assert.equal(data.race_feat, undefined);
    });

    console.log('\nReal run:');
    runMigration();

    await check('a character with a real class_id is pinned to the class version (1 when the class was never versioned)', async () => {
        assert.equal((await linkable.get()).data().class_version, 1);
    });

    await check("the character's own copy of the race feat is split out into race_feat", async () => {
        assert.deepEqual((await linkable.get()).data().race_feat, savedRaceFeat);
    });

    await check("the character's saved actions are left untouched as the fallback copy", async () => {
        assert.equal((await linkable.get()).data().actions.length, 3);
    });

    await check('a placeholder class_id is repaired by matching the class name + author, and pinned to that class\'s current version', async () => {
        const data = (await placeholder.get()).data();
        assert.equal(data.class_id, monk.id);
        assert.equal(data.class_version, 3);
    });

    await check('an ambiguous class name is left alone', async () => {
        assert.equal((await ambiguous.get()).data().class_version, undefined);
    });

    await check('an unknown class is left alone', async () => {
        assert.equal((await unknown.get()).data().class_version, undefined);
    });

    await check('a character that is already linked is not changed', async () => {
        assert.equal((await alreadyLinked.get()).data().class_version, 2);
    });

    console.log('\nRe-run (must be idempotent):');
    runMigration();
    await check('running it again changes nothing further', async () => {
        assert.equal((await linkable.get()).data().class_version, 1);
        assert.equal((await placeholder.get()).data().class_version, 3);
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
