// Seeds the Firestore emulator with classes covering every case the class
// publisher handles - a never-versioned class, an already versioned one, one
// that already matches, one whose name is shared with a private class, and a
// class that doesn't exist yet - runs the actual script as a subprocess
// against that same emulator, then asserts what was published, created and
// left alone. Also exercises --dry-run, re-running, and an ambiguous name.
//
// Run via: npm run firebase:publish-class-updates:test
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const updates = require('../data/class-updates');

const byName = Object.fromEntries(updates.map(entry => [entry.class_name, entry]));

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
    return spawnSync('node', [path.join(__dirname, '..', 'scripts', 'publish-class-updates.js'), ...extraArgs], {
        env: process.env,
        stdio: 'inherit',
    }).status;
}

async function main() {
    initializeApp({ projectId: 'jnj-online' });
    const db = getFirestore();

    const adminFields = { public: true, isDefault: true, canRead: [], canWrite: ['admin-uid'], admins: ['admin-uid'] };
    const oldMonk = await db.collection('classes').add({
        ...adminFields, class_name: 'Monk', author: 'Jonah', class_type: 'Crit Hunter', base_healing_dice_type: 2,
        base_armor_class: 15, description: 'Old lore', actions: [{ actionName: 'Old Action' }],
    });
    const oldOverqualified = await db.collection('classes').add({
        ...adminFields, class_name: 'Overqualified', author: 'Jonah', class_type: 'Snowballer',
        version: 3, versionNotes: 'Third cut', base_armor_class: 14, actions: [{ actionName: 'Old' }],
    });
    const currentGunslinger = await db.collection('classes').add({
        ...adminFields, class_name: 'Gunslinger', author: 'Jonah', class_type: 'Manipulator', version: 2,
        ...byName.Gunslinger.content,
    });
    const defaultSeer = await db.collection('classes').add({
        ...adminFields, class_name: 'The Seer', author: 'Jonah', class_type: 'Manipulator', actions: [],
    });
    const privateSeer = await db.collection('classes').add({
        public: false, isDefault: false, canRead: ['someone'], canWrite: ['someone'], admins: ['someone'],
        class_name: 'The Seer', author: 'Someone Else', actions: [{ actionName: 'Mine' }],
    });

    const versionsOf = async (ref) => (await ref.collection('versions').get()).docs.map(d => d.id).sort();

    console.log('Dry run (must not write anything):');
    assert.equal(runScript(['--dry-run']), 0);
    await check('--dry-run changes no class and creates no Magus', async () => {
        assert.equal((await oldMonk.get()).data().version, undefined);
        assert.deepEqual(await versionsOf(oldMonk), []);
        assert.equal((await db.collection('classes').where('class_name', '==', 'Magus').get()).size, 0);
    });

    console.log('\nReal run:');
    assert.equal(runScript(), 0);

    await check('a never-versioned class is published as v2, with the old content frozen as v1', async () => {
        const data = (await oldMonk.get()).data();
        assert.equal(data.version, 2);
        assert.equal(data.versionNotes, byName.Monk.versionNotes);
        assert.ok(data.publishedAt);
        assert.deepEqual(data.actions, byName.Monk.content.actions);
        assert.equal(data.base_armor_class, 16);
        const v1 = (await oldMonk.collection('versions').doc('1').get()).data();
        assert.equal(v1.version, 1);
        assert.equal(v1.base_armor_class, 15);
        assert.deepEqual(v1.actions, [{ actionName: 'Old Action' }]);
        assert.equal(v1.description, 'Old lore');
    });

    await check("only the write-up's fields change: class type, healing dice, visibility and admins are left alone", async () => {
        const data = (await oldMonk.get()).data();
        assert.equal(data.class_type, 'Crit Hunter');
        assert.equal(data.base_healing_dice_type, 2);
        assert.equal(data.public, true);
        assert.equal(data.isDefault, true);
        assert.deepEqual(data.admins, ['admin-uid']);
    });

    await check('the snapshot never carries permission or visibility fields', async () => {
        const v1 = (await oldMonk.collection('versions').doc('1').get()).data();
        ['public', 'isDefault', 'canRead', 'canWrite', 'admins'].forEach(field => assert.ok(!(field in v1), field));
    });

    await check('an already versioned class moves from v3 to v4 and freezes v3', async () => {
        const data = (await oldOverqualified.get()).data();
        assert.equal(data.version, 4);
        assert.deepEqual(await versionsOf(oldOverqualified), ['3']);
        const v3 = (await oldOverqualified.collection('versions').doc('3').get()).data();
        assert.equal(v3.versionNotes, 'Third cut');
        assert.equal(v3.base_armor_class, 14);
    });

    await check('a class that already matches the write-up is skipped (no new version)', async () => {
        assert.equal((await currentGunslinger.get()).data().version, 2);
        assert.deepEqual(await versionsOf(currentGunslinger), []);
    });

    await check('a name shared with someone\'s private class updates only the admin Default', async () => {
        assert.equal((await defaultSeer.get()).data().version, 2);
        const untouched = (await privateSeer.get()).data();
        assert.equal(untouched.version, undefined);
        assert.deepEqual(untouched.actions, [{ actionName: 'Mine' }]);
    });

    await check('a missing class (Magus) is created as a public admin Default at v1', async () => {
        const snap = await db.collection('classes').where('class_name', '==', 'Magus').get();
        assert.equal(snap.size, 1);
        const data = snap.docs[0].data();
        assert.equal(data.version, 1);
        assert.equal(data.isDefault, true);
        assert.equal(data.public, true);
        assert.equal(data.class_type, 'Attrionist');
        assert.equal(data.author, 'Jonah');
        assert.deepEqual(data.admins, ['wmJQbIlzX9RydXFmh3DzSBpIqHa2']);
        assert.equal(data.actions.length, byName.Magus.content.actions.length);
    });

    await check('every action is well formed: a name, a category, a cost, and either a to-hit or a DC', async () => {
        for (const entry of updates) {
            for (const action of entry.content.actions) {
                const where = `${entry.class_name} / ${action.actionName}`;
                assert.ok(action.actionName, where);
                assert.ok(['feat', 'passive', 'reaction', 'action'].includes(action.category), where);
                assert.ok(Number.isInteger(action.actionCost) && action.actionCost >= 0 && action.actionCost <= 3, where);
                if (action.toHitBool) assert.equal(typeof action.toHit, 'number', where);
                else assert.match(action.difficultyClass, /^\w+,-?\d+$/, where);
                if (action.actionType !== 'standard') assert.ok(Number.isInteger(action.actionTypeCount), where);
                assert.ok(!JSON.stringify(action).includes('undefined'), where);
                assert.ok(action.description.length > 0, where);
            }
        }
    });

    console.log('\nRe-run (must be idempotent):');
    assert.equal(runScript(), 0);
    await check('running it again publishes and creates nothing further', async () => {
        assert.equal((await oldMonk.get()).data().version, 2);
        assert.deepEqual(await versionsOf(oldMonk), ['1']);
        assert.equal((await oldOverqualified.get()).data().version, 4);
        assert.equal((await db.collection('classes').where('class_name', '==', 'Magus').get()).size, 1);
    });

    console.log('\nAmbiguous name:');
    await db.collection('classes').add({ ...adminFields, class_name: 'Monk', author: 'Copycat', actions: [] });
    const status = runScript();
    await check('two Default classes with the same name are reported, left alone, and fail the run', async () => {
        assert.equal(status, 1);
        assert.equal((await oldMonk.get()).data().version, 2);
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
