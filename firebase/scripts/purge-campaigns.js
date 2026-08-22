// Hard-deletes campaigns whose 30-day deletion grace period (set by a
// director clicking "Schedule Deletion" in CampaignPage.js) has passed.
//
// Characters belonging to a purged campaign are NOT deleted - they're
// unlinked (their `campaign` field is removed) so a player's character sheet
// survives even if their director lets the campaign's grace period lapse.
//
// Runs via the Admin SDK, which bypasses firestore.rules entirely (this is
// server-side cleanup, not a user-initiated write), so none of this needs
// (or should get) a rules change. Invoked by
// .github/workflows/purge-campaigns.yml on a daily schedule, and locally via
// `npm run firebase:purge:test` against the emulator for testing.
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');

function initDb() {
    // FIRESTORE_EMULATOR_HOST (set by `firebase emulators:exec`) makes the
    // Admin SDK talk to the local emulator instead of production - no real
    // credentials needed for that path, which is how this script is tested.
    if (process.env.FIRESTORE_EMULATOR_HOST) {
        initializeApp({ projectId: 'jnj-online' });
    } else {
        initializeApp({ credential: applicationDefault() });
    }
    return getFirestore();
}

async function purgeCampaign(db, campaignDoc) {
    const campaignId = campaignDoc.id;
    const campaignName = campaignDoc.data().campaign_name || '(unnamed)';

    const charactersSnap = await db.collection('characters').where('campaign', '==', campaignId).get();

    console.log(`  campaign "${campaignName}" (${campaignId}): ${charactersSnap.size} character(s) to unlink`);

    const batch = db.batch();
    charactersSnap.docs.forEach((characterDoc) => {
        batch.update(characterDoc.ref, { campaign: FieldValue.delete() });
    });
    batch.delete(campaignDoc.ref);
    await batch.commit();
}

async function main() {
    const db = initDb();
    const now = Timestamp.now();

    const dueSnap = await db.collection('campaigns').where('scheduledDeletionAt', '<=', now).get();

    if (dueSnap.empty) {
        console.log('No campaigns are due for deletion.');
        return;
    }

    console.log(`${dueSnap.size} campaign(s) due for deletion:`);
    for (const campaignDoc of dueSnap.docs) {
        await purgeCampaign(db, campaignDoc);
    }
    console.log('Done.');
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
