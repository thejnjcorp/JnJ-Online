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

    console.log('\nStatus catalog (statuses collection, backs the new Add Status dialog):');

    await check('a signed-in user can create a status preset', async () => {
        await testEnv.clearFirestore();
        const alice = testEnv.authenticatedContext('alice');
        await assertSucceeds(
            addDoc(collection(alice.firestore(), 'statuses'), {
                name: 'Haste',
                polarity: 'buff',
                defaultStacks: 2,
                description: 'Gain a single action for a certain number of rounds.',
                effect: { stat: 'action_points', delta: 1, trigger: 'turn_start' },
                classes: [],
                canWrite: ['alice'],
            })
        );
    });

    await check('a signed-out visitor cannot create a status preset', async () => {
        await testEnv.clearFirestore();
        const anon = testEnv.unauthenticatedContext();
        await assertFails(
            addDoc(collection(anon.firestore(), 'statuses'), { name: 'Should Fail' })
        );
    });

    await check('any signed-in user can read a public status', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'statuses', 'haste'), {
                name: 'Haste',
                polarity: 'buff',
                public: true,
                canRead: [],
                canWrite: ['bob'],
            });
        });
        const alice = testEnv.authenticatedContext('alice');
        await assertSucceeds(getDoc(doc(alice.firestore(), 'statuses', 'haste')));
    });

    console.log('\nStatus visibility (public / creator-locked / campaign-locked):');

    await check('a non-listed user cannot read a creator-locked (private) status', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'statuses', 'secret'), {
                name: 'Homebrew Curse',
                public: false,
                canRead: ['bob'],
                canWrite: ['bob'],
            });
        });
        const mallory = testEnv.authenticatedContext('mallory');
        await assertFails(getDoc(doc(mallory.firestore(), 'statuses', 'secret')));
    });

    await check('the creator can always read their own private status', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'statuses', 'secret'), {
                name: 'Homebrew Curse',
                public: false,
                canRead: ['bob'],
                canWrite: ['bob'],
            });
        });
        const bob = testEnv.authenticatedContext('bob');
        await assertSucceeds(getDoc(doc(bob.firestore(), 'statuses', 'secret')));
    });

    await check('a campaign member listed in canRead can read a campaign-locked status', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'statuses', 'orto-only'), {
                name: 'Rift Sickness',
                public: false,
                campaignId: 'camp1',
                // Snapshotted from campaign camp1's canRead+canWrite at save
                // time (see StatusPage.js) - not a live campaign lookup.
                canRead: ['bob', 'alice'],
                canWrite: ['bob'],
            });
        });
        const alice = testEnv.authenticatedContext('alice');
        await assertSucceeds(getDoc(doc(alice.firestore(), 'statuses', 'orto-only')));
    });

    await check('someone outside that campaign cannot read the campaign-locked status', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'statuses', 'orto-only'), {
                name: 'Rift Sickness',
                public: false,
                campaignId: 'camp1',
                canRead: ['bob', 'alice'],
                canWrite: ['bob'],
            });
        });
        const mallory = testEnv.authenticatedContext('mallory');
        await assertFails(getDoc(doc(mallory.firestore(), 'statuses', 'orto-only')));
    });

    await check('a plain unfiltered list query only returns statuses the requester can read', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'statuses', 'public-one'), {
                name: 'Haste', public: true, canRead: [], canWrite: ['bob'],
            });
            await setDoc(doc(adminCtx.firestore(), 'statuses', 'private-one'), {
                name: 'Homebrew Curse', public: false, canRead: ['bob'], canWrite: ['bob'],
            });
        });
        const mallory = testEnv.authenticatedContext('mallory');
        const snap = await getDocs(query(collection(mallory.firestore(), 'statuses'), where('public', '==', true)));
        // The point here isn't just "this succeeds" (assertSucceeds covers
        // that) - it's confirming the query returns exactly the public doc
        // and silently omits the private one, rather than the whole
        // unfiltered collection scan getting rejected outright the way an
        // unconstrained query against a get()-based rule can be. See the
        // comment on the statuses match block in firestore.rules.
        if (snap.docs.length !== 1 || snap.docs[0].id !== 'public-one') {
            throw new Error(`expected exactly [public-one], got [${snap.docs.map(d => d.id).join(', ')}]`);
        }
    });

    console.log('\nAdmin-only default statuses (isDefault):');

    const ADMIN_UID = 'wmJQbIlzX9RydXFmh3DzSBpIqHa2';

    await check('a non-admin cannot create a status with isDefault: true', async () => {
        await testEnv.clearFirestore();
        const mallory = testEnv.authenticatedContext('mallory');
        await assertFails(
            addDoc(collection(mallory.firestore(), 'statuses'), {
                name: 'Self-Promoted Default', isDefault: true, public: true, canRead: [], canWrite: ['mallory'],
            })
        );
    });

    await check('a non-admin can still create a regular (non-default) pool status', async () => {
        await testEnv.clearFirestore();
        const mallory = testEnv.authenticatedContext('mallory');
        await assertSucceeds(
            addDoc(collection(mallory.firestore(), 'statuses'), {
                name: 'Homebrew Curse', isDefault: false, public: true, canRead: [], canWrite: ['mallory'],
            })
        );
    });

    await check('the admin account can create a default status', async () => {
        await testEnv.clearFirestore();
        const admin = testEnv.authenticatedContext(ADMIN_UID);
        await assertSucceeds(
            addDoc(collection(admin.firestore(), 'statuses'), {
                name: 'Haste', isDefault: true, public: true, canRead: [], canWrite: [ADMIN_UID],
            })
        );
    });

    await check('a non-admin author cannot promote their own status to isDefault later', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'statuses', 'homebrew'), {
                name: 'Homebrew Curse', isDefault: false, public: true, canRead: [], canWrite: ['mallory'],
            });
        });
        const mallory = testEnv.authenticatedContext('mallory');
        await assertFails(
            updateDoc(doc(mallory.firestore(), 'statuses', 'homebrew'), { isDefault: true })
        );
    });

    await check('a non-author cannot edit someone else\'s status preset', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'statuses', 'haste'), {
                name: 'Haste',
                polarity: 'buff',
                canWrite: ['bob'],
            });
        });
        const mallory = testEnv.authenticatedContext('mallory');
        await assertFails(
            updateDoc(doc(mallory.firestore(), 'statuses', 'haste'), { name: 'Hijacked' })
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
