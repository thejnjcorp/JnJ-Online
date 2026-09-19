// Runs the class-status publisher against the Firestore emulator: creating
// the set from scratch, refreshing one that has drifted, leaving a same-named
// status scoped to another class alone, re-running, and --dry-run. Also
// checks every status in the data file is shaped the way the app expects.
//
// Run via: npm run firebase:publish-class-statuses:test
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const wanted = require('../data/class-statuses');

const ADMIN_UID = 'wmJQbIlzX9RydXFmh3DzSBpIqHa2';
// Mirrors STATUS_STAT_DEFINITIONS in src/utils/statusEffects.js.
const PASSIVE_STATS = ['base_armor_class', 'base_hit_modifier', 'base_damage_modifier', 'hardness', 'strength_stat', 'dexterity_stat', 'intelligence_stat', 'charisma_stat'];

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

function runScript(extraArgs = []) {
    return spawnSync('node', [path.join(__dirname, '..', 'scripts', 'publish-class-statuses.js'), ...extraArgs], {
        env: process.env,
        stdio: 'inherit',
    }).status;
}

async function main() {
    initializeApp({ projectId: 'jnj-online' });
    const db = getFirestore();
    const all = async () => (await db.collection('statuses').get()).docs;
    const named = async (name) => (await all()).filter(doc => doc.data().name === name);

    console.log('The data file:');
    await check('every status is well formed and scoped to the Monk', async () => {
        assert.equal(wanted.length, 12);
        assert.equal(new Set(wanted.map(s => s.name)).size, wanted.length);
        for (const s of wanted) {
            assert.ok(s.name && s.description, s.name);
            assert.ok(['buff', 'debuff', 'neutral'].includes(s.polarity), s.name);
            assert.ok(Number.isInteger(s.defaultStacks) && s.defaultStacks >= 0 && s.defaultStacks <= 9, s.name);
            assert.deepEqual(s.classes, ['Monk'], s.name);
            assert.equal(s.decaysPerTurn, false, s.name);
            assert.equal(s.grantedAction, null, s.name);
            s.effects.forEach(effect => {
                assert.ok(PASSIVE_STATS.includes(effect.stat), s.name);
                assert.equal(effect.trigger, 'passive', s.name);
                assert.equal(effect.mode, 'flat', s.name);
                assert.equal(typeof effect.delta, 'number', s.name);
            });
        }
    });

    // A Warden-scoped status that happens to share a name must never be touched.
    const wardenToken = await db.collection('statuses').add({
        name: 'Critical Token', description: 'Warden version', polarity: 'buff', defaultStacks: 1,
        classes: ['Warden'], effects: [], decaysPerTurn: false, grantedAction: null,
        public: true, isDefault: true, canRead: [], canWrite: ['someone'], admins: ['someone'],
    });
    // A Monk status whose text has drifted, and whose visibility differs from a fresh create.
    const driftedFlair = await db.collection('statuses').add({
        name: 'Flair Token', description: 'Stale text', polarity: 'debuff', defaultStacks: 3,
        classes: ['Monk'], effects: [], decaysPerTurn: false, grantedAction: null,
        public: true, isDefault: false, canRead: [], canWrite: ['owner'], admins: ['owner'],
    });

    console.log('\nDry run (must not write anything):');
    assert.equal(runScript(['--dry-run']), 0);
    await check('--dry-run creates and changes nothing', async () => {
        assert.equal((await all()).length, 2);
        assert.equal((await driftedFlair.get()).data().description, 'Stale text');
    });

    console.log('\nReal run:');
    assert.equal(runScript(), 0);
    await check('the missing statuses are created (11 new + the drifted one refreshed)', async () => {
        assert.equal((await all()).length, 2 + 11);
        for (const s of wanted) {
            const matches = (await named(s.name)).filter(doc => doc.data().classes.includes('Monk'));
            assert.equal(matches.length, 1, s.name);
        }
    });

    await check('new statuses are public admin Defaults with admin ownership', async () => {
        const [doc] = (await named('Stance: Heartstealer'));
        const data = doc.data();
        assert.equal(data.public, true);
        assert.equal(data.isDefault, true);
        assert.equal(data.campaignId, null);
        assert.deepEqual(data.canRead, []);
        assert.deepEqual(data.canWrite, [ADMIN_UID]);
        assert.deepEqual(data.admins, [ADMIN_UID]);
        assert.deepEqual(data.classes, ['Monk']);
    });

    await check('the Heartstealer Unlock carries the +1 to hit as a passive effect', async () => {
        const [doc] = await named('Unlock: Heartstealer');
        assert.deepEqual(doc.data().effects, [{ stat: 'base_hit_modifier', trigger: 'passive', mode: 'flat', delta: 1 }]);
    });

    await check('a drifted status has its content refreshed but keeps its own permissions', async () => {
        const data = (await driftedFlair.get()).data();
        assert.equal(data.description, wanted.find(s => s.name === 'Flair Token').description);
        assert.equal(data.polarity, 'buff');
        assert.equal(data.defaultStacks, 1);
        assert.equal(data.isDefault, false);
        assert.deepEqual(data.admins, ['owner']);
    });

    await check("a same-named status scoped to another class is left alone", async () => {
        const data = (await wardenToken.get()).data();
        assert.equal(data.description, 'Warden version');
        assert.deepEqual(data.classes, ['Warden']);
    });

    console.log('\nRe-run (must be idempotent):');
    assert.equal(runScript(), 0);
    await check('running it again creates and changes nothing', async () => {
        assert.equal((await all()).length, 13);
    });

    console.log('\nAmbiguous match:');
    await db.collection('statuses').add({ ...wanted[0], public: true, isDefault: true, canRead: [], canWrite: [], admins: [] });
    const status = runScript();
    await check('two statuses with the same name and class are reported and fail the run', async () => {
        assert.equal(status, 1);
        assert.equal((await all()).length, 14);
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
