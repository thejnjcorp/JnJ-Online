// Runs the common-items seed against the Firestore emulator: what it makes, that a
// second run adds nothing, that something already edited is never overwritten, that
// --dry-run writes nothing, and that --owner gives the items to someone else.
//
// Run via: npm run firebase:seed-items:test
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

const run = (extraArgs = []) => execFileSync('node', [path.join(__dirname, '..', 'scripts', 'seed-common-items.js'), ...extraArgs], { env: process.env, stdio: 'inherit' });

async function main() {
    initializeApp({ projectId: 'jnj-online' });
    const db = getFirestore();
    const items = async () => (await db.collection('items').get()).docs.map(doc => ({ id: doc.id, ...doc.data() }));

    run(['--dry-run']);
    await check('a dry run writes nothing', async () => {
        assert.equal((await items()).length, 0);
    });

    run();
    await check('makes the everyday gear, each a public item with a name, a description and tags', async () => {
        const made = await items();
        assert.ok(made.length >= 15);
        made.forEach(item => {
            assert.equal(item.isPublic, true);
            assert.ok(item.item_name.length > 0 && item.item_name.length <= 60);
            assert.ok(item.item_description.length > 0);
            assert.ok(item.tags.length > 0);
            assert.equal(item.item_image, '');
            assert.deepEqual(item.canRead, []);
        });
        ['Torch', 'Rations', 'Rope (50 ft)', 'Dagger'].forEach(name => assert.ok(made.some(item => item.item_name === name), name));
    });

    await check('they belong to the app admin, who can edit them', async () => {
        const [first] = await items();
        assert.deepEqual(first.canWrite, ['wmJQbIlzX9RydXFmh3DzSBpIqHa2']);
        assert.deepEqual(first.admins, ['wmJQbIlzX9RydXFmh3DzSBpIqHa2']);
    });

    await check('names are unique and tags are lower-case, like an item made by hand', async () => {
        const made = await items();
        assert.equal(new Set(made.map(item => item.item_name)).size, made.length);
        made.forEach(item => item.tags.forEach(tag => assert.equal(tag, tag.toLowerCase())));
    });

    await check('running it again adds nothing, and never overwrites an item that has been edited', async () => {
        const before = await items();
        const torch = before.find(item => item.item_name === 'Torch');
        await db.collection('items').doc(torch.id).update({ item_description: 'Edited by a table.' });
        run();
        const after = await items();
        assert.equal(after.length, before.length);
        assert.equal(after.find(item => item.id === torch.id).item_description, 'Edited by a table.');
    });

    await check('something deleted is put back on the next run, and only that', async () => {
        const before = await items();
        const rope = before.find(item => item.item_name === 'Rope (50 ft)');
        await db.collection('items').doc(rope.id).delete();
        run();
        const after = await items();
        assert.equal(after.length, before.length);
        assert.ok(after.some(item => item.item_name === 'Rope (50 ft)'));
    });

    await check('--owner gives them to someone else', async () => {
        const all = await db.collection('items').get();
        await Promise.all(all.docs.map(doc => doc.ref.delete()));
        run(['--owner=someone-else']);
        (await items()).forEach(item => {
            assert.deepEqual(item.canWrite, ['someone-else']);
            assert.deepEqual(item.admins, ['someone-else']);
        });
    });

    if (failures > 0) {
        console.log(`\n${failures} test(s) failed.`);
        process.exitCode = 1;
    } else {
        console.log('\nAll tests passed.');
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
