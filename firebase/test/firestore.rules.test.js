// Exercises firestore.rules against the Firestore emulator using the same
// modular client SDK calls the app actually makes (see
// src/components/NewCampaignPage.js), rather than reasoning about the rules
// text statically. Run via:
//   npm run firebase:test:rules
// which wraps this in `firebase emulators:exec` so the emulator is started
// fresh, this script runs against it, and it's torn down afterward - nothing
// here touches the real project.
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { collection, addDoc, doc, setDoc, getDoc, getDocs, query, where, updateDoc } = require('firebase/firestore');

const PROJECT_ID = 'jnj-online';
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
    const testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
            rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8'),
        },
    });

    console.log('Campaign creation (the bug reported in this session):');

    await check('a signed-in user can create a new campaign via addDoc', async () => {
        await testEnv.clearFirestore();
        const alice = testEnv.authenticatedContext('alice');
        await assertSucceeds(
            addDoc(collection(alice.firestore(), 'campaigns'), {
                campaign_name: 'Test Campaign',
                director_name: 'Alice',
                director_uid: 'alice',
                canWrite: ['alice'],
            })
        );
    });

    console.log('\nWhat happens right after creation (CampaignPage.js navigates here immediately):');

    await check('the creator can list characters in the campaign they just made', async () => {
        await testEnv.clearFirestore();
        const alice = testEnv.authenticatedContext('alice');
        const docRef = await addDoc(collection(alice.firestore(), 'campaigns'), {
            campaign_name: 'Test Campaign',
            director_name: 'Alice',
            director_uid: 'alice',
            canWrite: ['alice'],
        });
        // Mirrors CampaignPage.js's getCharacterList: a `where` query, not a
        // single-document get - this is the operation under suspicion, since
        // Firestore can reject an entire list/query as unprovable when a rule
        // branch does a cross-document get() (see inCampaign() in the rules),
        // even when the query would return zero results.
        await assertSucceeds(
            getDocs(query(collection(alice.firestore(), 'characters'), where('campaign', '==', docRef.id)))
        );
    });

    await check('a signed-out visitor cannot create a campaign', async () => {
        await testEnv.clearFirestore();
        const anon = testEnv.unauthenticatedContext();
        await assertFails(
            addDoc(collection(anon.firestore(), 'campaigns'), {
                campaign_name: 'Should Fail',
            })
        );
    });

    console.log('\nCampaign read/write (existing behavior, as a regression check):');

    await check('a non-member cannot read a campaign they have no access to', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'campaigns', 'camp1'), {
                campaign_name: 'Private Campaign',
                director_uid: 'bob',
                canRead: ['bob'],
                canWrite: ['bob'],
            });
        });
        const mallory = testEnv.authenticatedContext('mallory');
        await assertFails(getDoc(doc(mallory.firestore(), 'campaigns', 'camp1')));
    });

    await check('a listed canRead player can read the campaign', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'campaigns', 'camp1'), {
                campaign_name: 'Shared Campaign',
                director_uid: 'bob',
                canRead: ['bob', 'alice'],
                canWrite: ['bob'],
            });
        });
        const alice = testEnv.authenticatedContext('alice');
        await assertSucceeds(getDoc(doc(alice.firestore(), 'campaigns', 'camp1')));
    });

    console.log('\nArchive / schedule deletion (CampaignPage.js Danger Zone):');

    await check('the director can archive their own campaign', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'campaigns', 'camp1'), {
                campaign_name: 'Bob\'s Campaign',
                director_uid: 'bob',
                canRead: ['bob'],
                canWrite: ['bob'],
            });
        });
        const bob = testEnv.authenticatedContext('bob');
        await assertSucceeds(
            updateDoc(doc(bob.firestore(), 'campaigns', 'camp1'), { archived: true })
        );
    });

    await check('a non-member cannot archive someone else\'s campaign', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'campaigns', 'camp1'), {
                campaign_name: 'Bob\'s Campaign',
                director_uid: 'bob',
                canRead: ['bob'],
                canWrite: ['bob'],
            });
        });
        const mallory = testEnv.authenticatedContext('mallory');
        await assertFails(
            updateDoc(doc(mallory.firestore(), 'campaigns', 'camp1'), { archived: true })
        );
    });

    await check('the director can schedule and then cancel a deletion', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'campaigns', 'camp1'), {
                campaign_name: 'Bob\'s Campaign',
                director_uid: 'bob',
                canRead: ['bob'],
                canWrite: ['bob'],
                archived: true,
            });
        });
        const bob = testEnv.authenticatedContext('bob');
        const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await assertSucceeds(
            updateDoc(doc(bob.firestore(), 'campaigns', 'camp1'), { scheduledDeletionAt: future })
        );
        await assertSucceeds(
            updateDoc(doc(bob.firestore(), 'campaigns', 'camp1'), { scheduledDeletionAt: null })
        );
    });

    await testEnv.cleanup();

    if (failures > 0) {
        console.log(`\n${failures} test(s) failed.`);
        process.exitCode = 1;
    } else {
        console.log('\nAll tests passed.');
    }
}

main().catch(err => {
    console.error(err);
    process.exitCode = 1;
});
