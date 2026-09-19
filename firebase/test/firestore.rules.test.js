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
const { collection, addDoc, doc, setDoc, getDoc, getDocs, query, where, or, updateDoc, deleteDoc, arrayUnion, writeBatch } = require('firebase/firestore');

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
                admins: ['alice'],
            })
        );
    });

    console.log('\nCreation is restricted to the person creating (admins field):');

    await check('a signed-in user cannot create a campaign without listing themselves as an admin', async () => {
        await testEnv.clearFirestore();
        const alice = testEnv.authenticatedContext('alice');
        await assertFails(
            addDoc(collection(alice.firestore(), 'campaigns'), {
                campaign_name: 'No Admins Field',
                director_name: 'Alice',
                director_uid: 'alice',
                canWrite: ['alice'],
                // admins deliberately omitted
            })
        );
    });

    await check('a signed-in user cannot name someone else as director_uid on a campaign they create', async () => {
        await testEnv.clearFirestore();
        const alice = testEnv.authenticatedContext('alice');
        await assertFails(
            addDoc(collection(alice.firestore(), 'campaigns'), {
                campaign_name: 'Impersonation Attempt',
                director_name: 'Bob',
                director_uid: 'bob', // not alice, the actual creator
                canWrite: ['alice'],
                admins: ['alice'],
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
            admins: ['alice'],
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

    console.log('\nCampaign list queries (Campaigns.js / Homepage.js) - regression for reads hitting request.resource:');

    // permissionFieldsUnchanged()/archiveFieldsUnchanged() used to reference
    // request.resource, which doesn't exist on a get/list - that made the
    // canWrite half of these or() queries unprovable, so the whole query was
    // rejected and nobody's campaign list loaded (including a player their
    // director had just added via canRead).
    await check('a player added by their director sees the campaign in the Campaigns page query', async () => {
        await testEnv.clearFirestore();
        const dir = testEnv.authenticatedContext('dir');
        const newbie = testEnv.authenticatedContext('newbie');
        const ref = await addDoc(collection(dir.firestore(), 'campaigns'), {
            campaign_name: 'New Campaign', director_name: 'Dir', director_uid: 'dir',
            canWrite: ['dir'], admins: ['dir'],
        });
        await updateDoc(doc(dir.firestore(), 'campaigns', ref.id), {
            canRead: arrayUnion('newbie'),
            players: arrayUnion({ name: 'Newbie', uid: 'newbie' }),
        });
        const snap = await assertSucceeds(getDocs(query(collection(newbie.firestore(), 'campaigns'),
            or(where('canRead', 'array-contains', 'newbie'), where('canWrite', 'array-contains', 'newbie')))));
        if (snap.size !== 1) throw new Error('expected 1 campaign, got ' + snap.size);
    });

    await check('a director (canWrite only, not in canRead) can list their own campaigns', async () => {
        await testEnv.clearFirestore();
        const dir = testEnv.authenticatedContext('dir');
        await addDoc(collection(dir.firestore(), 'campaigns'), {
            campaign_name: 'Mine', director_name: 'Dir', director_uid: 'dir',
            canWrite: ['dir'], admins: ['dir'],
        });
        const snap = await assertSucceeds(getDocs(query(collection(dir.firestore(), 'campaigns'),
            or(where('canRead', 'array-contains', 'dir'), where('canWrite', 'array-contains', 'dir')))));
        if (snap.size !== 1) throw new Error('expected 1 campaign, got ' + snap.size);
    });

    await check('the Homepage dashboard queries (characters and campaigns, with a canWrite branch) both succeed', async () => {
        await testEnv.clearFirestore();
        const dir = testEnv.authenticatedContext('dir');
        await assertSucceeds(getDocs(query(collection(dir.firestore(), 'characters'), or(
            where('playerId', '==', 'dir'),
            where('canRead', 'array-contains', 'dir'),
            where('canWrite', 'array-contains', 'dir')
        ))));
        await assertSucceeds(getDocs(query(collection(dir.firestore(), 'campaigns'), or(
            where('canRead', 'array-contains', 'dir'),
            where('canWrite', 'array-contains', 'dir')
        ))));
    });

    console.log('\nArchive / schedule deletion (CampaignPage.js Danger Zone, admin-only):');

    await check('the director, who is also a doc admin, can archive their own campaign', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'campaigns', 'camp1'), {
                campaign_name: 'Bob\'s Campaign',
                director_uid: 'bob',
                canRead: ['bob'],
                canWrite: ['bob'],
                admins: ['bob'],
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
                admins: ['bob'],
            });
        });
        const mallory = testEnv.authenticatedContext('mallory');
        await assertFails(
            updateDoc(doc(mallory.firestore(), 'campaigns', 'camp1'), { archived: true })
        );
    });

    await check('a director who is not a doc admin (a legacy campaign predating the admins field) cannot archive', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'campaigns', 'camp1'), {
                campaign_name: 'Bob\'s Campaign',
                director_uid: 'bob',
                canRead: ['bob'],
                canWrite: ['bob'],
                // admins deliberately omitted
            });
        });
        const bob = testEnv.authenticatedContext('bob');
        await assertFails(
            updateDoc(doc(bob.firestore(), 'campaigns', 'camp1'), { archived: true })
        );
    });

    await check('a plain canWrite collaborator (not the director, not a doc admin) cannot archive, but can still edit other fields', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'campaigns', 'camp1'), {
                campaign_name: 'Bob\'s Campaign',
                director_uid: 'bob',
                canRead: ['bob', 'alice'],
                canWrite: ['bob', 'alice'],
                admins: ['bob'],
            });
        });
        const alice = testEnv.authenticatedContext('alice');
        await assertFails(
            updateDoc(doc(alice.firestore(), 'campaigns', 'camp1'), { archived: true })
        );
        await assertSucceeds(
            updateDoc(doc(alice.firestore(), 'campaigns', 'camp1'), { campaign_name: 'Renamed by Alice' })
        );
    });

    await check('the director, who is also a doc admin, can schedule and then cancel a deletion', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'campaigns', 'camp1'), {
                campaign_name: 'Bob\'s Campaign',
                director_uid: 'bob',
                canRead: ['bob'],
                canWrite: ['bob'],
                admins: ['bob'],
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
                admins: ['alice'],
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

    await check('the author can delete their own status', async () => {
        // Regression test: request.resource is null on delete, and the
        // isDefault write guard used to access request.resource.data
        // unconditionally, throwing on every delete regardless of who
        // requested it - found by hand while cleaning up test data through
        // this exact rule shape. See the comment on the statuses match
        // block in firestore.rules.
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'statuses', 'disposable'), {
                name: 'Disposable Test Status', isDefault: false, public: true, canRead: [], canWrite: ['bob'],
            });
        });
        const bob = testEnv.authenticatedContext('bob');
        await assertSucceeds(deleteDoc(doc(bob.firestore(), 'statuses', 'disposable')));
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
                name: 'Self-Promoted Default', isDefault: true, public: true, canRead: [], canWrite: ['mallory'], admins: ['mallory'],
            })
        );
    });

    await check('a non-admin can still create a regular (non-default) pool status', async () => {
        await testEnv.clearFirestore();
        const mallory = testEnv.authenticatedContext('mallory');
        await assertSucceeds(
            addDoc(collection(mallory.firestore(), 'statuses'), {
                name: 'Homebrew Curse', isDefault: false, public: true, canRead: [], canWrite: ['mallory'], admins: ['mallory'],
            })
        );
    });

    await check('the admin account can create a default status', async () => {
        await testEnv.clearFirestore();
        const admin = testEnv.authenticatedContext(ADMIN_UID);
        await assertSucceeds(
            addDoc(collection(admin.firestore(), 'statuses'), {
                name: 'Haste', isDefault: true, public: true, canRead: [], canWrite: [ADMIN_UID], admins: [ADMIN_UID],
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

    console.log('\nClass catalog (classes collection, mirrors the statuses model above):');

    await check('a signed-in user can create a class', async () => {
        await testEnv.clearFirestore();
        const alice = testEnv.authenticatedContext('alice');
        await assertSucceeds(
            addDoc(collection(alice.firestore(), 'classes'), {
                class_name: 'Warden',
                class_type: 'Attrionist',
                author: 'alice',
                public: true,
                isDefault: false,
                canRead: [],
                canWrite: ['alice'],
                admins: ['alice'],
            })
        );
    });

    await check('a signed-out visitor cannot create a class', async () => {
        await testEnv.clearFirestore();
        const anon = testEnv.unauthenticatedContext();
        await assertFails(
            addDoc(collection(anon.firestore(), 'classes'), { class_name: 'Should Fail' })
        );
    });

    await check('any signed-in user can read a public (pool) class', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'classes', 'warden'), {
                class_name: 'Warden', public: true, isDefault: false, canRead: [], canWrite: ['bob'],
            });
        });
        const alice = testEnv.authenticatedContext('alice');
        await assertSucceeds(getDoc(doc(alice.firestore(), 'classes', 'warden')));
    });

    await check('the author can delete their own class', async () => {
        // Same request.resource-is-null-on-delete regression as statuses
        // above - this collection mirrors that write rule exactly.
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'classes', 'disposable'), {
                class_name: 'Disposable Test Class', isDefault: false, public: true, canRead: [], canWrite: ['bob'],
            });
        });
        const bob = testEnv.authenticatedContext('bob');
        await assertSucceeds(deleteDoc(doc(bob.firestore(), 'classes', 'disposable')));
    });

    await check('a non-listed user cannot read a private class', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'classes', 'homebrew'), {
                class_name: 'Ashwake Cultist', public: false, canRead: ['bob'], canWrite: ['bob'],
            });
        });
        const mallory = testEnv.authenticatedContext('mallory');
        await assertFails(getDoc(doc(mallory.firestore(), 'classes', 'homebrew')));
    });

    await check('the creator can always read their own private class', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'classes', 'homebrew'), {
                class_name: 'Ashwake Cultist', public: false, canRead: ['bob'], canWrite: ['bob'],
            });
        });
        const bob = testEnv.authenticatedContext('bob');
        await assertSucceeds(getDoc(doc(bob.firestore(), 'classes', 'homebrew')));
    });

    await check('a plain unfiltered list query only returns classes the requester can read', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'classes', 'public-one'), {
                class_name: 'Warden', public: true, canRead: [], canWrite: ['bob'],
            });
            await setDoc(doc(adminCtx.firestore(), 'classes', 'private-one'), {
                class_name: 'Ashwake Cultist', public: false, canRead: ['bob'], canWrite: ['bob'],
            });
        });
        const mallory = testEnv.authenticatedContext('mallory');
        const snap = await getDocs(query(collection(mallory.firestore(), 'classes'), where('public', '==', true)));
        if (snap.docs.length !== 1 || snap.docs[0].id !== 'public-one') {
            throw new Error(`expected exactly [public-one], got [${snap.docs.map(d => d.id).join(', ')}]`);
        }
    });

    console.log('\nAdmin-only default classes (isDefault):');

    await check('a non-admin cannot create a class with isDefault: true', async () => {
        await testEnv.clearFirestore();
        const mallory = testEnv.authenticatedContext('mallory');
        await assertFails(
            addDoc(collection(mallory.firestore(), 'classes'), {
                class_name: 'Self-Promoted Default', isDefault: true, public: true, canRead: [], canWrite: ['mallory'], admins: ['mallory'],
            })
        );
    });

    await check('a non-admin can still create a regular (non-default) pool class', async () => {
        await testEnv.clearFirestore();
        const mallory = testEnv.authenticatedContext('mallory');
        await assertSucceeds(
            addDoc(collection(mallory.firestore(), 'classes'), {
                class_name: 'Ashwake Cultist', isDefault: false, public: true, canRead: [], canWrite: ['mallory'], admins: ['mallory'],
            })
        );
    });

    await check('the admin account can create a default class', async () => {
        await testEnv.clearFirestore();
        const admin = testEnv.authenticatedContext(ADMIN_UID);
        await assertSucceeds(
            addDoc(collection(admin.firestore(), 'classes'), {
                class_name: 'Warden', isDefault: true, public: true, canRead: [], canWrite: [ADMIN_UID], admins: [ADMIN_UID],
            })
        );
    });

    await check('a non-admin author cannot promote their own class to isDefault later', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'classes', 'homebrew'), {
                class_name: 'Ashwake Cultist', isDefault: false, public: true, canRead: [], canWrite: ['mallory'],
            });
        });
        const mallory = testEnv.authenticatedContext('mallory');
        await assertFails(
            updateDoc(doc(mallory.firestore(), 'classes', 'homebrew'), { isDefault: true })
        );
    });

    await check('a non-author cannot edit someone else\'s class', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'classes', 'warden'), {
                class_name: 'Warden',
                canWrite: ['bob'],
            });
        });
        const mallory = testEnv.authenticatedContext('mallory');
        await assertFails(
            updateDoc(doc(mallory.firestore(), 'classes', 'warden'), { class_name: 'Hijacked' })
        );
    });

    console.log('\nCharacter creation (characters collection - previously had no ownership check at all):');

    await check('a signed-in user can create their own character', async () => {
        await testEnv.clearFirestore();
        const alice = testEnv.authenticatedContext('alice');
        await assertSucceeds(
            addDoc(collection(alice.firestore(), 'characters'), {
                character_name: 'Aria',
                playerId: 'alice',
                canWrite: ['alice'],
                canRead: [],
                admins: ['alice'],
            })
        );
    });

    await check('a signed-in user cannot create a character with someone else\'s playerId', async () => {
        await testEnv.clearFirestore();
        const alice = testEnv.authenticatedContext('alice');
        await assertFails(
            addDoc(collection(alice.firestore(), 'characters'), {
                character_name: 'Impersonation Attempt',
                playerId: 'bob', // not alice, the actual creator
                canWrite: ['alice'],
                canRead: [],
                admins: ['alice'],
            })
        );
    });

    await check('a signed-in user cannot create a character without listing themselves as an admin', async () => {
        await testEnv.clearFirestore();
        const alice = testEnv.authenticatedContext('alice');
        await assertFails(
            addDoc(collection(alice.firestore(), 'characters'), {
                character_name: 'No Admins Field',
                playerId: 'alice',
                canWrite: ['alice'],
                canRead: [],
                // admins deliberately omitted
            })
        );
    });

    await check('a signed-out visitor cannot create a character', async () => {
        await testEnv.clearFirestore();
        const anon = testEnv.unauthenticatedContext();
        await assertFails(
            addDoc(collection(anon.firestore(), 'characters'), { character_name: 'Should Fail' })
        );
    });

    console.log('\nMap and race creation (previously had no ownership check at all):');

    await check('a signed-in user cannot create a map without listing themselves as an admin', async () => {
        await testEnv.clearFirestore();
        const alice = testEnv.authenticatedContext('alice');
        await assertFails(
            addDoc(collection(alice.firestore(), 'maps'), {
                link: 'https://example.com/map.png',
                canWrite: ['alice'],
                zones: [],
                // admins deliberately omitted
            })
        );
    });

    await check('a signed-in user can create a map when they list themselves as admin', async () => {
        await testEnv.clearFirestore();
        const alice = testEnv.authenticatedContext('alice');
        await assertSucceeds(
            addDoc(collection(alice.firestore(), 'maps'), {
                link: 'https://example.com/map.png',
                canWrite: ['alice'],
                admins: ['alice'],
                zones: [],
            })
        );
    });

    await check('a signed-in user cannot create a race without listing themselves as an admin', async () => {
        await testEnv.clearFirestore();
        const alice = testEnv.authenticatedContext('alice');
        await assertFails(
            addDoc(collection(alice.firestore(), 'races'), {
                name: 'Should Fail',
                canWrite: ['alice'],
                // admins deliberately omitted
            })
        );
    });

    console.log('\nDocument admins vs. plain canWrite collaborators (permission fields are admin-only):');

    await check('a plain canWrite collaborator (not an admin) can still edit ordinary content', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'campaigns', 'camp1'), {
                campaign_name: 'Shared Campaign',
                director_uid: 'bob',
                canRead: ['bob', 'alice'],
                canWrite: ['bob', 'alice'],
                admins: ['bob'],
            });
        });
        const alice = testEnv.authenticatedContext('alice');
        await assertSucceeds(
            updateDoc(doc(alice.firestore(), 'campaigns', 'camp1'), { campaign_name: 'Renamed Campaign' })
        );
    });

    await check('a plain canWrite collaborator cannot grant themselves broader canRead access', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'campaigns', 'camp1'), {
                campaign_name: 'Shared Campaign',
                director_uid: 'bob',
                canRead: ['bob', 'alice'],
                canWrite: ['bob', 'alice'],
                admins: ['bob'],
            });
        });
        const alice = testEnv.authenticatedContext('alice');
        await assertFails(
            updateDoc(doc(alice.firestore(), 'campaigns', 'camp1'), { canRead: ['bob', 'alice', 'mallory'] })
        );
    });

    await check('a plain canWrite collaborator cannot add themselves to admins', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'campaigns', 'camp1'), {
                campaign_name: 'Shared Campaign',
                director_uid: 'bob',
                canRead: ['bob', 'alice'],
                canWrite: ['bob', 'alice'],
                admins: ['bob'],
            });
        });
        const alice = testEnv.authenticatedContext('alice');
        await assertFails(
            updateDoc(doc(alice.firestore(), 'campaigns', 'camp1'), { admins: ['bob', 'alice'] })
        );
    });

    await check('a document admin can change canRead, canWrite, and admins', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'classes', 'warden'), {
                class_name: 'Warden',
                canWrite: ['bob'],
                canRead: [],
                admins: ['bob'],
            });
        });
        const bob = testEnv.authenticatedContext('bob');
        await assertSucceeds(
            updateDoc(doc(bob.firestore(), 'classes', 'warden'), { canWrite: ['bob', 'alice'], admins: ['bob', 'alice'] })
        );
    });

    console.log('\nClass versions (classes/{id}/versions - immutable snapshots of superseded versions):');

    async function seedClassWithVersion({ isPublic }) {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'classes', 'monk'), {
                class_name: 'Monk', version: 2, public: isPublic, isDefault: false,
                canWrite: ['bob'], canRead: isPublic ? [] : ['bob'], admins: ['bob'],
            });
            await setDoc(doc(adminCtx.firestore(), 'classes', 'monk', 'versions', '1'), {
                class_name: 'Monk', version: 1,
            });
        });
    }

    await check('any signed-in user can read a version of a public class', async () => {
        await seedClassWithVersion({ isPublic: true });
        const alice = testEnv.authenticatedContext('alice');
        await assertSucceeds(getDoc(doc(alice.firestore(), 'classes', 'monk', 'versions', '1')));
    });

    await check('an outsider cannot read a version of a private class, but its writer can', async () => {
        await seedClassWithVersion({ isPublic: false });
        const mallory = testEnv.authenticatedContext('mallory');
        const bob = testEnv.authenticatedContext('bob');
        await assertFails(getDoc(doc(mallory.firestore(), 'classes', 'monk', 'versions', '1')));
        await assertSucceeds(getDoc(doc(bob.firestore(), 'classes', 'monk', 'versions', '1')));
    });

    await check('listing the versions subcollection works for a class the user can read', async () => {
        await seedClassWithVersion({ isPublic: true });
        const alice = testEnv.authenticatedContext('alice');
        await assertSucceeds(getDocs(collection(alice.firestore(), 'classes', 'monk', 'versions')));
    });

    await check('a signed-out visitor cannot read a version', async () => {
        await seedClassWithVersion({ isPublic: true });
        const anon = testEnv.unauthenticatedContext();
        await assertFails(getDoc(doc(anon.firestore(), 'classes', 'monk', 'versions', '1')));
    });

    await check('a class writer can create a version snapshot; a non-writer cannot', async () => {
        await seedClassWithVersion({ isPublic: true });
        const bob = testEnv.authenticatedContext('bob');
        const mallory = testEnv.authenticatedContext('mallory');
        await assertSucceeds(setDoc(doc(bob.firestore(), 'classes', 'monk', 'versions', '2'), { class_name: 'Monk', version: 2 }));
        await assertFails(setDoc(doc(mallory.firestore(), 'classes', 'monk', 'versions', '3'), { class_name: 'Monk', version: 3 }));
    });

    await check('a version snapshot is immutable - even its writer cannot update or delete it', async () => {
        await seedClassWithVersion({ isPublic: true });
        const bob = testEnv.authenticatedContext('bob');
        await assertFails(updateDoc(doc(bob.firestore(), 'classes', 'monk', 'versions', '1'), { class_name: 'Tampered' }));
        await assertFails(deleteDoc(doc(bob.firestore(), 'classes', 'monk', 'versions', '1')));
    });

    await check('publishing (snapshot + bump in one transaction-style batch) works for a writer', async () => {
        await seedClassWithVersion({ isPublic: true });
        const bob = testEnv.authenticatedContext('bob');
        const batch = writeBatch(bob.firestore());
        batch.set(doc(bob.firestore(), 'classes', 'monk', 'versions', '2'), { class_name: 'Monk', version: 2 });
        batch.update(doc(bob.firestore(), 'classes', 'monk'), { version: 3, versionNotes: 'Rebalanced' });
        await assertSucceeds(batch.commit());
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
