// Seeds the Firestore emulator with characters covering every case the inventory
// migration handles - hand-typed cards in the backpack and the pocket, the same card on
// two of one player's characters, one already an item, one with no title, one with no
// inventory at all - runs the actual migration script as a subprocess against that same
// emulator, then asserts what changed and what was left alone. Also exercises --dry-run
// and a second run.
//
// Run via: npm run firebase:migrate-inventory:test
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

function runMigration(extraArgs = []) {
    execFileSync('node', [path.join(__dirname, '..', 'scripts', 'migrate-inventory-to-items.js'), ...extraArgs], {
        env: process.env,
        stdio: 'inherit',
    });
}

async function main() {
    initializeApp({ projectId: 'jnj-online' });
    const db = getFirestore();

    const card = (id, title, content, status) => ({ id, title, content, status, index: 0 });
    const aria = await db.collection('characters').add({
        character_name: 'Aria', playerId: 'alice', admins: ['alice'], canWrite: ['alice', 'dir'], canRead: ['alice', 'bob', 'dir'],
        inventory: [card('c1', 'Rusty Key', 'Opens something.', '1'), card('c2', 'Lantern', 'Burns oil.', '2')],
        inventory_pocket: [card('c3', 'Lucky Coin', '', 'Pocket')],
        current_health: 9,
    });
    const ariaTwin = await db.collection('characters').add({
        character_name: 'Aria Two', playerId: 'alice', admins: ['alice'], canWrite: ['alice'], canRead: ['alice'],
        inventory: [card('d1', 'Rusty Key', 'Opens something.', '1')], inventory_pocket: [],
    });
    const done = await db.collection('characters').add({
        character_name: 'Done', playerId: 'bob', admins: ['bob'], canWrite: ['bob'], canRead: ['bob'],
        inventory: [{ id: 'e1', item_id: 'existing-item', title: 'Torch', quantity: 4, status: '1', index: 0 }], inventory_pocket: [],
    });
    const untitled = await db.collection('characters').add({
        character_name: 'Untitled', playerId: 'cara', admins: ['cara'], canWrite: ['cara'], canRead: ['cara'],
        inventory: [{ id: 'u1', content: 'no title here', status: '1', index: 0 }, card('u2', 'Real Thing', '', '2')], inventory_pocket: [],
    });
    const empty = await db.collection('characters').add({ character_name: 'Empty', playerId: 'dee' });

    const snapshot = async ref => (await ref.get()).data();

    // ---- dry run ----
    runMigration(['--dry-run']);
    await check('a dry run writes nothing', async () => {
        assert.equal((await db.collection('items').get()).size, 0);
        assert.equal((await snapshot(aria)).inventory[0].item_id, undefined);
    });

    // ---- the real run ----
    runMigration();

    await check('each hand-typed card becomes an entry that refers to a new item, in the same slot with the same id', async () => {
        const data = await snapshot(aria);
        assert.deepEqual(data.inventory.map(entry => [entry.id, entry.title, entry.quantity, entry.status, entry.index]), [['c1', 'Rusty Key', 1, '1', 0], ['c2', 'Lantern', 1, '2', 0]]);
        assert.equal(data.inventory_pocket[0].status, 'Pocket');
        assert.equal(data.inventory_pocket[0].title, 'Lucky Coin');
        data.inventory.concat(data.inventory_pocket).forEach(entry => assert.equal(typeof entry.item_id, 'string'));
        assert.ok(!('content' in data.inventory[0]));
    });

    await check('the item made has the card\'s name and description, is private, and belongs to the player', async () => {
        const entry = (await snapshot(aria)).inventory[0];
        const item = (await db.collection('items').doc(entry.item_id).get()).data();
        assert.equal(item.item_name, 'Rusty Key');
        assert.equal(item.item_description, 'Opens something.');
        assert.equal(item.isPublic, false);
        assert.deepEqual(item.canWrite, ['alice']);
        assert.deepEqual(item.admins, ['alice']);
        assert.deepEqual(item.tags, []);
        assert.equal(item.item_image, '');
    });

    await check('everyone who could read the character can read the item, so the party can see it', async () => {
        const entry = (await snapshot(aria)).inventory[0];
        const item = (await db.collection('items').doc(entry.item_id).get()).data();
        assert.deepEqual([...item.canRead].sort(), ['alice', 'bob', 'dir']);
    });

    await check('the same card on two of one player\'s characters shares one item', async () => {
        const first = (await snapshot(aria)).inventory[0].item_id;
        const second = (await snapshot(ariaTwin)).inventory[0].item_id;
        assert.equal(first, second);
    });

    await check('a different card is a different item; five cards made four items', async () => {
        const data = await snapshot(aria);
        assert.notEqual(data.inventory[0].item_id, data.inventory[1].item_id);
        // Rusty Key (shared), Lantern, Lucky Coin, Real Thing
        assert.equal((await db.collection('items').get()).size, 4);
    });

    await check('an entry that is already an item is left exactly as it was', async () => {
        assert.deepEqual((await snapshot(done)).inventory, [{ id: 'e1', item_id: 'existing-item', title: 'Torch', quantity: 4, status: '1', index: 0 }]);
    });

    await check('an entry with no title is left as it is, and the rest of that character\'s inventory still converts', async () => {
        const data = await snapshot(untitled);
        assert.equal(data.inventory[0].item_id, undefined);
        assert.equal(data.inventory[0].content, 'no title here');
        assert.equal(typeof data.inventory[1].item_id, 'string');
    });

    await check('a character with no inventory, and everything else about a character, is untouched', async () => {
        const data = await snapshot(empty);
        assert.equal(data.inventory, undefined);
        assert.equal((await snapshot(aria)).current_health, 9);
    });

    await check('running it again changes nothing more', async () => {
        const before = (await db.collection('items').get()).size;
        const sheet = JSON.stringify(await snapshot(aria));
        runMigration();
        assert.equal((await db.collection('items').get()).size, before);
        assert.equal(JSON.stringify(await snapshot(aria)), sheet);
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
