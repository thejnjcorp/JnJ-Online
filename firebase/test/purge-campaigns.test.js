// Seeds the Firestore emulator with a due-for-deletion campaign (plus a
// linked character, and a control campaign that's NOT due), runs the actual
// purge script as a subprocess against that same emulator, then asserts the
// due campaign is gone, its character is unlinked (not deleted), and the
// control campaign survives untouched.
//
// Run via: npm run firebase:purge:test
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

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

async function main() {
    initializeApp({ projectId: 'jnj-online' });
    const db = getFirestore();

    const past = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
    const future = Timestamp.fromMillis(Date.now() + 29 * 24 * 60 * 60 * 1000);

    const dueCampaign = await db.collection('campaigns').add({
        campaign_name: 'Due For Purge',
        director_uid: 'bob',
        canWrite: ['bob'],
        archived: true,
        scheduledDeletionAt: past,
    });
    const linkedCharacter = await db.collection('characters').add({
        character_name: 'Orphan Candidate',
        playerId: 'alice',
        campaign: dueCampaign.id,
    });
    const survivingCampaign = await db.collection('campaigns').add({
        campaign_name: 'Not Due Yet',
        director_uid: 'bob',
        canWrite: ['bob'],
        archived: true,
        scheduledDeletionAt: future,
    });

    execFileSync('node', [path.join(__dirname, '..', 'scripts', 'purge-campaigns.js')], {
        env: process.env,
        stdio: 'inherit',
    });

    await check('the due campaign is deleted', async () => {
        const snap = await dueCampaign.get();
        assert.equal(snap.exists, false);
    });

    await check("the due campaign's character survives, unlinked rather than deleted", async () => {
        const snap = await linkedCharacter.get();
        assert.equal(snap.exists, true);
        assert.equal(snap.data().campaign, undefined);
        assert.equal(snap.data().character_name, 'Orphan Candidate');
    });

    await check('a campaign not yet due for deletion is untouched', async () => {
        const snap = await survivingCampaign.get();
        assert.equal(snap.exists, true);
        assert.equal(snap.data().campaign_name, 'Not Due Yet');
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
