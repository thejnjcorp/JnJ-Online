// Seeds the Firestore emulator with documents across every collection the
// migration touches - some missing `admins` (the case under test), one
// already carrying it (must be left untouched) - runs the actual migration
// script as a subprocess against that same emulator, then asserts the
// backfilled values match what each collection's documents already allowed
// before the migration ran. Also exercises --dry-run separately to confirm
// it makes no writes.
//
// Run via: npm run firebase:backfill-admins:test
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
    execFileSync('node', [path.join(__dirname, '..', 'scripts', 'backfill-admins.js'), ...extraArgs], {
        env: process.env,
        stdio: 'inherit',
    });
}

async function main() {
    initializeApp({ projectId: 'jnj-online' });
    const db = getFirestore();

    const campaign = await db.collection('campaigns').add({
        campaign_name: 'Legacy Campaign', director_uid: 'bob', canWrite: ['bob'],
    });
    const character = await db.collection('characters').add({
        character_name: 'Legacy Character', playerId: 'alice', canWrite: ['alice', 'bob'],
    });
    const klass = await db.collection('classes').add({
        class_name: 'Legacy Class', canWrite: ['alice', 'bob'],
    });
    const status = await db.collection('statuses').add({
        name: 'Legacy Status', canWrite: ['alice'],
    });
    const noOwnerNoWrite = await db.collection('races').add({
        name: 'Orphaned Race',
    });
    const alreadyMigrated = await db.collection('statuses').add({
        name: 'Already Migrated', canWrite: ['bob'], admins: ['carol'],
    });

    // Dry run first - asserting it changed nothing before the real run,
    // otherwise the "already migrated left untouched" check below would
    // pass trivially even if --dry-run were silently writing anyway.
    runMigration(['--dry-run']);
    await check('--dry-run makes no writes', async () => {
        const snap = await campaign.get();
        assert.equal('admins' in snap.data(), false);
    });

    runMigration();

    await check('a campaign backfills admins to [director_uid]', async () => {
        const snap = await campaign.get();
        assert.deepEqual(snap.data().admins, ['bob']);
    });

    await check('a character backfills admins to [playerId]', async () => {
        const snap = await character.get();
        assert.deepEqual(snap.data().admins, ['alice']);
    });

    await check('a class (no owner field) backfills admins to the full canWrite array', async () => {
        const snap = await klass.get();
        assert.deepEqual(snap.data().admins, ['alice', 'bob']);
    });

    await check('a status (no owner field) backfills admins to canWrite', async () => {
        const snap = await status.get();
        assert.deepEqual(snap.data().admins, ['alice']);
    });

    await check('a document with neither an owner field nor canWrite backfills to an empty array', async () => {
        const snap = await noOwnerNoWrite.get();
        assert.deepEqual(snap.data().admins, []);
    });

    await check('a document that already has admins is left untouched, not overwritten', async () => {
        const snap = await alreadyMigrated.get();
        assert.deepEqual(snap.data().admins, ['carol']);
    });

    if (failures > 0) {
        console.log(`\n${failures} test(s) failed.`);
        process.exitCode = 1;
    } else {
        console.log('\nAll tests passed.');
    }
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
