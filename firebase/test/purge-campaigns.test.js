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

    // characters archived by their player: one past its grace period (with a
    // sub-collection, to be sure nothing is left behind), one still inside it, one
    // archived but with no deletion scheduled, and one belonging to the due campaign
    const dueCharacter = await db.collection('characters').add({
        character_name: 'Retired For Good',
        playerId: 'alice',
        archived: true,
        scheduledDeletionAt: past,
    });
    await dueCharacter.collection('notes').add({ text: 'left behind?' });
    const waitingCharacter = await db.collection('characters').add({
        character_name: 'Still In The Grace Period',
        playerId: 'alice',
        archived: true,
        scheduledDeletionAt: future,
    });
    const archivedCharacter = await db.collection('characters').add({
        character_name: 'Just Archived',
        playerId: 'alice',
        archived: true,
    });
    const dueInDueCampaign = await db.collection('characters').add({
        character_name: 'Due In A Due Campaign',
        playerId: 'alice',
        campaign: dueCampaign.id,
        archived: true,
        scheduledDeletionAt: past,
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

    await check('a character past its grace period is deleted, with what was stored under it', async () => {
        assert.equal((await dueCharacter.get()).exists, false);
        assert.equal((await dueCharacter.collection('notes').get()).size, 0);
    });

    await check('a character due on the same day as its campaign is deleted, not just unlinked', async () => {
        assert.equal((await dueInDueCampaign.get()).exists, false);
    });

    await check('a character still inside its grace period is untouched', async () => {
        const snap = await waitingCharacter.get();
        assert.equal(snap.exists, true);
        assert.equal(snap.data().archived, true);
    });

    await check('an archived character with no deletion scheduled is untouched', async () => {
        const snap = await archivedCharacter.get();
        assert.equal(snap.exists, true);
        assert.equal(snap.data().scheduledDeletionAt, undefined);
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
