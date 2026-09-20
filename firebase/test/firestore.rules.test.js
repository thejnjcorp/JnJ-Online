// Exercises firestore.rules against the Firestore emulator using the same
// modular client SDK calls the app actually makes (see
// src/components/NewCampaignPage.js), rather than reasoning about the rules
// text statically. Run via:
//   npm run firebase:test:rules
// which wraps this in `firebase emulators:exec` so the emulator is started
// fresh, this script runs against it, and it's torn down afterward - nothing
// here touches the real project.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { collection, addDoc, doc, setDoc, getDoc, getDocs, query, where, or, updateDoc, deleteDoc, arrayUnion, writeBatch, runTransaction } = require('firebase/firestore');

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

    console.log('\nRace catalog (races collection, same model as classes):');

    await check('a signed-in user can create a pool race, a signed-out visitor cannot', async () => {
        await testEnv.clearFirestore();
        const alice = testEnv.authenticatedContext('alice');
        const anon = testEnv.unauthenticatedContext();
        await assertSucceeds(addDoc(collection(alice.firestore(), 'races'), {
            name: 'Elf', author: 'alice', public: true, isDefault: false, canRead: [], canWrite: ['alice'], admins: ['alice'], actions: [],
        }));
        await assertFails(addDoc(collection(anon.firestore(), 'races'), { name: 'Should Fail' }));
    });

    await check('a non-admin cannot create a Default race or promote their own race to one; the admin account can create one', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'races', 'homebrew'), {
                name: 'Homebrew', isDefault: false, public: true, canRead: [], canWrite: ['mallory'],
            });
        });
        const mallory = testEnv.authenticatedContext('mallory');
        const admin = testEnv.authenticatedContext(ADMIN_UID);
        await assertFails(addDoc(collection(mallory.firestore(), 'races'), {
            name: 'Self-Promoted', isDefault: true, public: true, canRead: [], canWrite: ['mallory'], admins: ['mallory'],
        }));
        await assertFails(updateDoc(doc(mallory.firestore(), 'races', 'homebrew'), { isDefault: true }));
        await assertSucceeds(addDoc(collection(admin.firestore(), 'races'), {
            name: 'Kobold', isDefault: true, public: true, canRead: [], canWrite: [ADMIN_UID], admins: [ADMIN_UID],
        }));
    });

    await check('a public race is readable by any signed-in user; a private one only by its readers/writers', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'races', 'pool'), { name: 'Elf', public: true, canRead: [], canWrite: ['bob'] });
            await setDoc(doc(adminCtx.firestore(), 'races', 'secret'), { name: 'Secret', public: false, canRead: ['carol'], canWrite: ['bob'] });
        });
        const mallory = testEnv.authenticatedContext('mallory');
        await assertSucceeds(getDoc(doc(mallory.firestore(), 'races', 'pool')));
        await assertFails(getDoc(doc(mallory.firestore(), 'races', 'secret')));
        await assertSucceeds(getDoc(doc(testEnv.authenticatedContext('carol').firestore(), 'races', 'secret')));
        await assertSucceeds(getDoc(doc(testEnv.authenticatedContext('bob').firestore(), 'races', 'secret')));
    });

    await check('a race with no visibility fields at all (an unmigrated legacy doc) is not readable', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'races', 'kobold'), { name: 'Kobold', feat: { actionName: 'Mild Fire' } });
        });
        await assertFails(getDoc(doc(testEnv.authenticatedContext('alice').firestore(), 'races', 'kobold')));
    });

    await check('the app\'s scoped list query (public, or readable/writable by me) is accepted and returns only readable races', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'races', 'pool'), { name: 'Elf', public: true, canRead: [], canWrite: ['bob'] });
            await setDoc(doc(adminCtx.firestore(), 'races', 'mine'), { name: 'Mine', public: false, canRead: ['alice'], canWrite: ['alice'] });
            await setDoc(doc(adminCtx.firestore(), 'races', 'theirs'), { name: 'Theirs', public: false, canRead: ['bob'], canWrite: ['bob'] });
        });
        const alice = testEnv.authenticatedContext('alice');
        const snap = await getDocs(query(collection(alice.firestore(), 'races'),
            or(where('public', '==', true), where('canRead', 'array-contains', 'alice'), where('canWrite', 'array-contains', 'alice'))));
        const ids = snap.docs.map(d => d.id).sort();
        if (ids.join(',') !== 'mine,pool') throw new Error(`expected [mine, pool], got [${ids.join(', ')}]`);
    });

    await check('an unscoped list of the races collection is rejected outright', async () => {
        await testEnv.clearFirestore();
        await assertFails(getDocs(collection(testEnv.authenticatedContext('alice').firestore(), 'races')));
    });

    await check('a non-author cannot edit someone else\'s race', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'races', 'elf'), { name: 'Elf', public: true, canWrite: ['bob'] });
        });
        await assertFails(updateDoc(doc(testEnv.authenticatedContext('mallory').firestore(), 'races', 'elf'), { name: 'Hijacked' }));
    });

    await check('a plain canWrite collaborator cannot grant write access; a doc admin can', async () => {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'races', 'elf'), {
                name: 'Elf', public: true, canRead: [], canWrite: ['bob', 'carol'], admins: ['bob'],
            });
        });
        await assertFails(updateDoc(doc(testEnv.authenticatedContext('carol').firestore(), 'races', 'elf'), { canWrite: ['bob', 'carol', 'mallory'] }));
        await assertSucceeds(updateDoc(doc(testEnv.authenticatedContext('bob').firestore(), 'races', 'elf'), { canWrite: ['bob', 'carol', 'dave'] }));
    });

    console.log('\nRace versions (races/{id}/versions - immutable snapshots):');

    async function seedRaceWithVersion({ isPublic }) {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'races', 'kobold'), {
                name: 'Kobold', version: 2, public: isPublic, isDefault: false,
                canWrite: ['bob'], canRead: isPublic ? [] : ['bob'], admins: ['bob'],
            });
            await setDoc(doc(adminCtx.firestore(), 'races', 'kobold', 'versions', '1'), { name: 'Kobold', version: 1 });
        });
    }

    await check('anyone signed in can read and list versions of a public race; only its readers can for a private one', async () => {
        await seedRaceWithVersion({ isPublic: true });
        const alice = testEnv.authenticatedContext('alice');
        await assertSucceeds(getDoc(doc(alice.firestore(), 'races', 'kobold', 'versions', '1')));
        await assertSucceeds(getDocs(collection(alice.firestore(), 'races', 'kobold', 'versions')));

        await seedRaceWithVersion({ isPublic: false });
        await assertFails(getDoc(doc(testEnv.authenticatedContext('mallory').firestore(), 'races', 'kobold', 'versions', '1')));
        await assertSucceeds(getDoc(doc(testEnv.authenticatedContext('bob').firestore(), 'races', 'kobold', 'versions', '1')));
    });

    await check('a race writer can create a version snapshot, a non-writer cannot, and a snapshot can never be changed or deleted', async () => {
        await seedRaceWithVersion({ isPublic: true });
        const bob = testEnv.authenticatedContext('bob');
        await assertSucceeds(setDoc(doc(bob.firestore(), 'races', 'kobold', 'versions', '2'), { name: 'Kobold', version: 2 }));
        await assertFails(setDoc(doc(testEnv.authenticatedContext('mallory').firestore(), 'races', 'kobold', 'versions', '3'), { name: 'Kobold', version: 3 }));
        await assertFails(updateDoc(doc(bob.firestore(), 'races', 'kobold', 'versions', '1'), { name: 'Tampered' }));
        await assertFails(deleteDoc(doc(bob.firestore(), 'races', 'kobold', 'versions', '1')));
    });

    await check('publishing (snapshot + bump in one batch) works for a race writer', async () => {
        await seedRaceWithVersion({ isPublic: true });
        const bob = testEnv.authenticatedContext('bob');
        const batch = writeBatch(bob.firestore());
        batch.set(doc(bob.firestore(), 'races', 'kobold', 'versions', '2'), { name: 'Kobold', version: 2 });
        batch.update(doc(bob.firestore(), 'races', 'kobold'), { version: 3, versionNotes: 'More scales' });
        await assertSucceeds(batch.commit());
    });

    console.log('\nDirector notes (campaigns/{id}/notes - directors only, never players):');

    async function seedCampaignWithNote() {
        await testEnv.clearFirestore();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'campaigns', 'camp1'), {
                campaign_name: 'Iron Vale', director_uid: 'dir', canWrite: ['dir', 'codir'], canRead: ['dir', 'codir', 'player'], admins: ['dir'],
            });
            await setDoc(doc(adminCtx.firestore(), 'campaigns', 'camp1', 'notes', 'n1'), { title: 'Secret plot', body: 'The mayor is the lich.', order: 1 });
        });
    }

    await check('the director can read, create, edit and delete notes', async () => {
        await seedCampaignWithNote();
        const dir = testEnv.authenticatedContext('dir');
        await assertSucceeds(getDoc(doc(dir.firestore(), 'campaigns', 'camp1', 'notes', 'n1')));
        await assertSucceeds(addDoc(collection(dir.firestore(), 'campaigns', 'camp1', 'notes'), { title: 'New', body: '', order: 2 }));
        await assertSucceeds(updateDoc(doc(dir.firestore(), 'campaigns', 'camp1', 'notes', 'n1'), { body: 'Edited' }));
        await assertSucceeds(deleteDoc(doc(dir.firestore(), 'campaigns', 'camp1', 'notes', 'n1')));
    });

    await check('a co-director (canWrite) and a campaign doc admin have the same access', async () => {
        await seedCampaignWithNote();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await updateDoc(doc(adminCtx.firestore(), 'campaigns', 'camp1'), { admins: ['dir', 'boss'] });
        });
        await assertSucceeds(getDoc(doc(testEnv.authenticatedContext('codir').firestore(), 'campaigns', 'camp1', 'notes', 'n1')));
        await assertSucceeds(updateDoc(doc(testEnv.authenticatedContext('boss').firestore(), 'campaigns', 'camp1', 'notes', 'n1'), { body: 'x' }));
    });

    await check('a player in the campaign cannot read, list, write or delete the notes', async () => {
        await seedCampaignWithNote();
        const player = testEnv.authenticatedContext('player');
        await assertFails(getDoc(doc(player.firestore(), 'campaigns', 'camp1', 'notes', 'n1')));
        await assertFails(getDocs(collection(player.firestore(), 'campaigns', 'camp1', 'notes')));
        await assertFails(addDoc(collection(player.firestore(), 'campaigns', 'camp1', 'notes'), { title: 'x', body: '', order: 3 }));
        await assertFails(updateDoc(doc(player.firestore(), 'campaigns', 'camp1', 'notes', 'n1'), { body: 'x' }));
        await assertFails(deleteDoc(doc(player.firestore(), 'campaigns', 'camp1', 'notes', 'n1')));
    });

    await check('a stranger and a signed-out visitor cannot read the notes either', async () => {
        await seedCampaignWithNote();
        await assertFails(getDoc(doc(testEnv.authenticatedContext('stranger').firestore(), 'campaigns', 'camp1', 'notes', 'n1')));
        await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'campaigns', 'camp1', 'notes', 'n1')));
    });

    await check('the director can list the whole notebook (the query the page runs is provable)', async () => {
        await seedCampaignWithNote();
        const snap = await getDocs(collection(testEnv.authenticatedContext('dir').firestore(), 'campaigns', 'camp1', 'notes'));
        if (snap.size !== 1) throw new Error(`expected 1 note, got ${snap.size}`);
    });

    await check('notes of one campaign are not reachable through another campaign the person directs', async () => {
        await seedCampaignWithNote();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'campaigns', 'camp2'), { campaign_name: 'Other', director_uid: 'other', canWrite: ['other'], canRead: ['other'], admins: ['other'] });
        });
        await assertFails(getDoc(doc(testEnv.authenticatedContext('other').firestore(), 'campaigns', 'camp1', 'notes', 'n1')));
    });

    console.log('\nTag catalog (tags collection, the labels an author puts on actions):');

    const seedTags = () => testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        await testEnv.clearFirestore();
        await setDoc(doc(adminCtx.firestore(), 'tags', 'fire'), { tagInfo: 'Fire', public: true, isDefault: false, canRead: [], canWrite: ['bob', 'carol'], admins: ['bob'], classes: [] });
        await setDoc(doc(adminCtx.firestore(), 'tags', 'secret'), { tagInfo: 'Homebrew', public: false, isDefault: false, canRead: ['bob'], canWrite: ['bob'], admins: ['bob'], classes: [] });
    });

    await check('a signed-in user can create a tag, as its own admin', async () => {
        await testEnv.clearFirestore();
        const alice = testEnv.authenticatedContext('alice');
        await assertSucceeds(addDoc(collection(alice.firestore(), 'tags'), {
            tagInfo: 'Fire', tagColor: '#ff0000', textColor: '#ffffff', tagDescription: 'Deals fire damage', classes: ['Monk'],
            public: true, isDefault: false, canRead: [], canWrite: ['alice'], admins: ['alice'],
        }));
    });

    await check('a tag cannot be created without listing the creator as an admin', async () => {
        await testEnv.clearFirestore();
        const alice = testEnv.authenticatedContext('alice');
        await assertFails(addDoc(collection(alice.firestore(), 'tags'), { tagInfo: 'Fire', public: true, canWrite: ['alice'] }));
    });

    await check('a signed-out visitor cannot create or read tags', async () => {
        await seedTags();
        const anon = testEnv.unauthenticatedContext();
        await assertFails(addDoc(collection(anon.firestore(), 'tags'), { tagInfo: 'Nope' }));
        await assertFails(getDoc(doc(anon.firestore(), 'tags', 'fire')));
    });

    await check('any signed-in user can read a public tag', async () => {
        await seedTags();
        await assertSucceeds(getDoc(doc(testEnv.authenticatedContext('alice').firestore(), 'tags', 'fire')));
    });

    await check('a private tag is readable by its creator but not by anyone else', async () => {
        await seedTags();
        await assertSucceeds(getDoc(doc(testEnv.authenticatedContext('bob').firestore(), 'tags', 'secret')));
        await assertFails(getDoc(doc(testEnv.authenticatedContext('mallory').firestore(), 'tags', 'secret')));
    });

    await check('the catalog list query (public, or readable, or writable) is allowed and returns only what the viewer can see', async () => {
        await seedTags();
        const mallory = testEnv.authenticatedContext('mallory');
        const snap = await assertSucceeds(getDocs(query(collection(mallory.firestore(), 'tags'),
            or(where('public', '==', true), where('canRead', 'array-contains', 'mallory'), where('canWrite', 'array-contains', 'mallory')))));
        if (snap.docs.map(d => d.id).join() !== 'fire') throw new Error('expected only the public tag, got ' + snap.docs.map(d => d.id).join());
    });

    await check('an unfiltered scan of the catalog is refused', async () => {
        await seedTags();
        await assertFails(getDocs(collection(testEnv.authenticatedContext('mallory').firestore(), 'tags')));
    });

    await check('an author can edit and delete their own tag; someone else cannot', async () => {
        await seedTags();
        const bob = testEnv.authenticatedContext('bob');
        await assertSucceeds(updateDoc(doc(bob.firestore(), 'tags', 'fire'), { tagInfo: 'Flame' }));
        await assertFails(updateDoc(doc(testEnv.authenticatedContext('mallory').firestore(), 'tags', 'fire'), { tagInfo: 'Hijacked' }));
        await assertFails(deleteDoc(doc(testEnv.authenticatedContext('mallory').firestore(), 'tags', 'fire')));
        await assertSucceeds(deleteDoc(doc(bob.firestore(), 'tags', 'fire')));
    });

    await check('a co-writer who is not an admin cannot change who can read, write or administer a tag; an admin can', async () => {
        await seedTags();
        await assertFails(updateDoc(doc(testEnv.authenticatedContext('carol').firestore(), 'tags', 'fire'), { canWrite: ['bob', 'carol', 'mallory'] }));
        await assertSucceeds(updateDoc(doc(testEnv.authenticatedContext('carol').firestore(), 'tags', 'fire'), { tagInfo: 'Flame' }));
        await assertSucceeds(updateDoc(doc(testEnv.authenticatedContext('bob').firestore(), 'tags', 'fire'), { canWrite: ['bob', 'carol', 'dave'] }));
    });

    await check('a non-admin cannot create a default tag, or promote their own to one later', async () => {
        await seedTags();
        const mallory = testEnv.authenticatedContext('mallory');
        await assertFails(addDoc(collection(mallory.firestore(), 'tags'), {
            tagInfo: 'Self-Promoted', isDefault: true, public: true, canRead: [], canWrite: ['mallory'], admins: ['mallory'],
        }));
        await assertFails(updateDoc(doc(testEnv.authenticatedContext('carol').firestore(), 'tags', 'fire'), { isDefault: true }));
        await assertFails(updateDoc(doc(testEnv.authenticatedContext('bob').firestore(), 'tags', 'fire'), { isDefault: true }));
    });

    await check('the admin account can create a default tag', async () => {
        await testEnv.clearFirestore();
        const admin = testEnv.authenticatedContext(ADMIN_UID);
        await assertSucceeds(addDoc(collection(admin.firestore(), 'tags'), {
            tagInfo: 'Melee', isDefault: true, public: true, canRead: [], canWrite: [ADMIN_UID], admins: [ADMIN_UID], classes: [],
        }));
    });

    console.log('\nBestiary (enemies collection) and encounters:');

    const seedEnemies = () => testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        await testEnv.clearFirestore();
        await setDoc(doc(adminCtx.firestore(), 'enemies', 'goon'), { enemy_name: 'Rust Bandit', enemy_type: 'Goon', public: false, canRead: ['dm'], canWrite: ['dm', 'co'], admins: ['dm'] });
        await setDoc(doc(adminCtx.firestore(), 'enemies', 'shared'), { enemy_name: 'Wolf', enemy_type: 'Regular', public: true, canRead: [], canWrite: ['dm'], admins: ['dm'] });
    });

    await check('a signed-in user can create an enemy as its own admin; a signed-out visitor cannot', async () => {
        await testEnv.clearFirestore();
        await assertSucceeds(addDoc(collection(testEnv.authenticatedContext('dm').firestore(), 'enemies'), {
            enemy_name: 'Rust Bandit', enemy_type: 'Goon', public: false, canRead: ['dm'], canWrite: ['dm'], admins: ['dm'],
        }));
        await assertFails(addDoc(collection(testEnv.unauthenticatedContext().firestore(), 'enemies'), { enemy_name: 'Nope' }));
        await assertFails(addDoc(collection(testEnv.authenticatedContext('dm').firestore(), 'enemies'), { enemy_name: 'No admin', canWrite: ['dm'] }));
    });

    await check('a private enemy is readable only by the people it is shared with; a public one by any signed-in user', async () => {
        await seedEnemies();
        await assertSucceeds(getDoc(doc(testEnv.authenticatedContext('dm').firestore(), 'enemies', 'goon')));
        await assertFails(getDoc(doc(testEnv.authenticatedContext('stranger').firestore(), 'enemies', 'goon')));
        await assertSucceeds(getDoc(doc(testEnv.authenticatedContext('stranger').firestore(), 'enemies', 'shared')));
        await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'enemies', 'shared')));
    });

    await check('the bestiary list query (public, or readable, or writable) is allowed; an unfiltered scan is not', async () => {
        await seedEnemies();
        const stranger = testEnv.authenticatedContext('stranger');
        const snap = await assertSucceeds(getDocs(query(collection(stranger.firestore(), 'enemies'),
            or(where('public', '==', true), where('canRead', 'array-contains', 'stranger'), where('canWrite', 'array-contains', 'stranger')))));
        if (snap.docs.map(d => d.id).join() !== 'shared') throw new Error('expected only the public enemy, got ' + snap.docs.map(d => d.id).join());
        await assertFails(getDocs(collection(stranger.firestore(), 'enemies')));
    });

    await check('writers can edit and delete an enemy, others cannot, and only an admin can change who has access', async () => {
        await seedEnemies();
        await assertSucceeds(updateDoc(doc(testEnv.authenticatedContext('co').firestore(), 'enemies', 'goon'), { level: 2 }));
        await assertFails(updateDoc(doc(testEnv.authenticatedContext('co').firestore(), 'enemies', 'goon'), { canWrite: ['dm', 'co', 'x'] }));
        await assertFails(updateDoc(doc(testEnv.authenticatedContext('stranger').firestore(), 'enemies', 'shared'), { level: 9 }));
        await assertFails(deleteDoc(doc(testEnv.authenticatedContext('stranger').firestore(), 'enemies', 'shared')));
        await assertSucceeds(updateDoc(doc(testEnv.authenticatedContext('dm').firestore(), 'enemies', 'goon'), { canWrite: ['dm', 'co', 'x'] }));
        await assertSucceeds(deleteDoc(doc(testEnv.authenticatedContext('dm').firestore(), 'enemies', 'goon')));
    });

    const seedEncounter = () => testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        await testEnv.clearFirestore();
        await setDoc(doc(adminCtx.firestore(), 'campaigns', 'camp1'), { campaign_name: 'C', director_uid: 'dir', canWrite: ['dir', 'codir'], canRead: ['dir', 'codir', 'player'], admins: ['dir'] });
        await setDoc(doc(adminCtx.firestore(), 'campaigns', 'camp1', 'encounters', 'e1'), { name: 'Ambush', roster: [] });
    });

    await check('the director and a co-director can read, create, edit, list and delete encounters', async () => {
        await seedEncounter();
        for (const uid of ['dir', 'codir']) {
            const db = testEnv.authenticatedContext(uid).firestore();
            await assertSucceeds(getDoc(doc(db, 'campaigns', 'camp1', 'encounters', 'e1')));
            await assertSucceeds(getDocs(collection(db, 'campaigns', 'camp1', 'encounters')));
            await assertSucceeds(updateDoc(doc(db, 'campaigns', 'camp1', 'encounters', 'e1'), { name: 'Ambush 2' }));
            await assertSucceeds(addDoc(collection(db, 'campaigns', 'camp1', 'encounters'), { name: 'New' }));
        }
        await assertSucceeds(deleteDoc(doc(testEnv.authenticatedContext('dir').firestore(), 'campaigns', 'camp1', 'encounters', 'e1')));
    });

    await check('players, strangers and signed-out visitors cannot see or change encounters (the players must not read the ambush)', async () => {
        await seedEncounter();
        for (const ctx of [testEnv.authenticatedContext('player'), testEnv.authenticatedContext('stranger'), testEnv.unauthenticatedContext()]) {
            const db = ctx.firestore();
            await assertFails(getDoc(doc(db, 'campaigns', 'camp1', 'encounters', 'e1')));
            await assertFails(getDocs(collection(db, 'campaigns', 'camp1', 'encounters')));
            await assertFails(updateDoc(doc(db, 'campaigns', 'camp1', 'encounters', 'e1'), { name: 'x' }));
            await assertFails(addDoc(collection(db, 'campaigns', 'camp1', 'encounters'), { name: 'x' }));
        }
    });

    console.log('\nThe party doc (campaigns/{id}/party/main), shared by everyone in the campaign:');

    const seedParty = () => testEnv.withSecurityRulesDisabled(async (adminCtx) => {
        await testEnv.clearFirestore();
        await setDoc(doc(adminCtx.firestore(), 'campaigns', 'camp1'), { campaign_name: 'C', director_uid: 'dir', canWrite: ['dir', 'codir'], canRead: ['dir', 'codir', 'player', 'player2'], admins: ['dir'] });
        await setDoc(doc(adminCtx.firestore(), 'campaigns', 'camp1', 'party', 'main'), { combat_tracker: [{ id: 'character:a', title: 'Aria', status: 'Gate', index: 0, x: 0.1, y: 0.1 }] });
    });
    const partyRef = db => doc(db, 'campaigns', 'camp1', 'party', 'main');

    await check('players can read the party doc and move a token in it', async () => {
        await seedParty();
        for (const uid of ['player', 'player2']) {
            const db = testEnv.authenticatedContext(uid).firestore();
            await assertSucceeds(getDoc(partyRef(db)));
            await assertSucceeds(updateDoc(partyRef(db), { combat_tracker: [{ id: 'character:a', title: 'Aria', status: 'Courtyard', index: 0, x: 0.4, y: 0.2 }] }));
        }
    });

    await check('the director and a co-director can read and write it too', async () => {
        await seedParty();
        for (const uid of ['dir', 'codir']) {
            const db = testEnv.authenticatedContext(uid).firestore();
            await assertSucceeds(getDoc(partyRef(db)));
            await assertSucceeds(updateDoc(partyRef(db), { combat_tracker: [] }));
        }
    });

    await check('the party doc is created on the first write, by anyone in the campaign', async () => {
        await seedParty();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => { await deleteDoc(doc(adminCtx.firestore(), 'campaigns', 'camp1', 'party', 'main')); });
        await assertSucceeds(setDoc(partyRef(testEnv.authenticatedContext('player').firestore()), { combat_tracker: [] }, { merge: true }));
    });

    const readPartyAsAdmin = async () => {
        let data;
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => { data = (await getDoc(partyRef(adminCtx.firestore()))).data(); });
        return data;
    };

    // The app changes the party doc the way updateParty (src/utils/party.js) does: read it and
    // write the change back inside a transaction, merging into the doc (which creates it the first time).
    const changeInTransaction = (db, change) => runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(partyRef(db));
        transaction.set(partyRef(db), change(snapshot.exists() ? snapshot.data() : {}), { merge: true });
    });

    await check('a player moves their token the way the app does: a transaction that reads the party doc and merges the change', async () => {
        await seedParty();
        const db = testEnv.authenticatedContext('player').firestore();
        await assertSucceeds(changeInTransaction(db, party => ({ combat_tracker: party.combat_tracker.map(post => ({ ...post, status: 'Courtyard', x: 0.5 })) })));
        const saved = await readPartyAsAdmin();
        assert.equal(saved.combat_tracker[0].status, 'Courtyard');
    });

    await check('the first transaction creates the party doc, and merging leaves other fields (inventory, notes) alone', async () => {
        await seedParty();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => { await setDoc(partyRef(adminCtx.firestore()), { inventory: ['rope'], notes: 'camp at dusk' }); });
        await assertSucceeds(changeInTransaction(testEnv.authenticatedContext('dir').firestore(), () => ({ combat_tracker: [] })));
        const kept = await readPartyAsAdmin();
        assert.deepEqual(kept, { inventory: ['rope'], notes: 'camp at dusk', combat_tracker: [] });

        await testEnv.withSecurityRulesDisabled(async (adminCtx) => { await deleteDoc(partyRef(adminCtx.firestore())); });
        await assertSucceeds(changeInTransaction(testEnv.authenticatedContext('player').firestore(), () => ({ combat_tracker: [] })));
    });

    await check('a new campaign\'s creator can make its party doc straight after making the campaign (as NewCampaignPage does)', async () => {
        await testEnv.clearFirestore();
        const alice = testEnv.authenticatedContext('alice').firestore();
        const created = await addDoc(collection(alice, 'campaigns'), { campaign_name: 'New', director_name: 'Alice', director_uid: 'alice', canWrite: ['alice'], admins: ['alice'] });
        const ref = doc(alice, 'campaigns', created.id, 'party', 'main');
        await assertSucceeds(runTransaction(alice, async (transaction) => {
            const snapshot = await transaction.get(ref);
            if (!snapshot.exists()) transaction.set(ref, { combat_tracker: [] });
        }));
        await assertSucceeds(getDoc(ref));
    });

    await check('a player opening an older campaign can make its missing party doc, and a second person making it does not overwrite the first', async () => {
        await seedParty();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => { await deleteDoc(partyRef(adminCtx.firestore())); });
        const ensure = (db) => runTransaction(db, async (transaction) => {
            const snapshot = await transaction.get(partyRef(db));
            if (!snapshot.exists()) transaction.set(partyRef(db), { combat_tracker: [] });
        });
        await assertSucceeds(ensure(testEnv.authenticatedContext('player').firestore()));
        await assertSucceeds(updateDoc(partyRef(testEnv.authenticatedContext('player').firestore()), { inventory: ['rope'] }));
        await assertSucceeds(ensure(testEnv.authenticatedContext('player2').firestore()));
        assert.deepEqual(await readPartyAsAdmin(), { combat_tracker: [], inventory: ['rope'] });
    });

    await check('a transaction by a stranger is refused', async () => {
        await seedParty();
        await assertFails(changeInTransaction(testEnv.authenticatedContext('stranger').firestore(), () => ({ combat_tracker: [] })));
    });

    await check('a campaign admin who is not otherwise listed can use it', async () => {
        await seedParty();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => { await updateDoc(doc(adminCtx.firestore(), 'campaigns', 'camp1'), { admins: ['dir', 'boss'] }); });
        await assertSucceeds(updateDoc(partyRef(testEnv.authenticatedContext('boss').firestore()), { combat_tracker: [] }));
    });

    await check('strangers and signed-out visitors cannot read or write the party doc', async () => {
        await seedParty();
        for (const ctx of [testEnv.authenticatedContext('stranger'), testEnv.unauthenticatedContext()]) {
            const db = ctx.firestore();
            await assertFails(getDoc(partyRef(db)));
            await assertFails(updateDoc(partyRef(db), { combat_tracker: [] }));
            await assertFails(setDoc(partyRef(db), { combat_tracker: [] }));
            await assertFails(deleteDoc(partyRef(db)));
        }
    });

    await check('someone in another campaign cannot use this one\'s party doc', async () => {
        await seedParty();
        await testEnv.withSecurityRulesDisabled(async (adminCtx) => {
            await setDoc(doc(adminCtx.firestore(), 'campaigns', 'camp2'), { campaign_name: 'Other', director_uid: 'dir2', canWrite: ['dir2'], canRead: ['dir2', 'other-player'], admins: ['dir2'] });
        });
        await assertFails(getDoc(partyRef(testEnv.authenticatedContext('other-player').firestore())));
        await assertFails(updateDoc(partyRef(testEnv.authenticatedContext('dir2').firestore()), { combat_tracker: [] }));
    });

    await check('a party doc under a campaign that does not exist cannot be reached', async () => {
        await seedParty();
        await assertFails(getDoc(doc(testEnv.authenticatedContext('player').firestore(), 'campaigns', 'no-such-campaign', 'party', 'main')));
    });

    await check('the party doc does not open up the campaign doc itself: a player still cannot write that', async () => {
        await seedParty();
        const db = testEnv.authenticatedContext('player').firestore();
        await assertFails(updateDoc(doc(db, 'campaigns', 'camp1'), { active_map: 'x' }));
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
