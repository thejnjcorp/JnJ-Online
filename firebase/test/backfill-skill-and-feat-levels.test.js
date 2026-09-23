// Seeds the Firestore emulator with a class and a race that each have a feat
// missing its tier (plus one already tiered, and one non-feat action, which
// must be left alone), and a character with skills/flaws saved before levels
// existed (plus one already leveled) - runs the actual migration script as a
// subprocess against that same emulator, then asserts what changed and what
// was left alone. Also exercises --dry-run and re-running it.
//
// Run via: npm run firebase:backfill-skill-and-feat-levels:test
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
    execFileSync('node', [path.join(__dirname, '..', 'scripts', 'backfill-skill-and-feat-levels.js'), ...extraArgs], {
        env: process.env,
        stdio: 'inherit',
    });
}

async function main() {
    initializeApp({ projectId: 'jnj-online' });
    const db = getFirestore();

    const fighter = await db.collection('classes').add({
        class_name: 'Fighter',
        actions: [
            { actionName: 'Untiered Feat', category: 'feat' },
            { actionName: 'Already Tiered', category: 'feat', tier: 3 },
            { actionName: 'Power Attack', category: 'action' },
        ],
    });
    const kobold = await db.collection('races').add({
        name: 'Kobold',
        actions: [{ actionName: 'Mild Fire', category: 'feat' }],
    });
    const character = await db.collection('characters').add({
        character_name: 'Aria',
        skills_and_flaws: [
            { name: 'Steady Hands', degree: 2, isSkill: true, description: '' }, // -> trained
            { name: 'Cracks Under Pressure', degree: 1, isSkill: false, description: '' }, // -> minor
            { name: 'Already Leveled', level: 'ultimate', isSkill: true, description: '' },
        ],
    });
    const noSkills = await db.collection('characters').add({ character_name: 'Bram' });

    console.log('Dry run (must not write anything):');
    runMigration(['--dry-run']);
    await check('--dry-run leaves the class untouched', async () => {
        const actions = (await fighter.get()).data().actions;
        assert.equal(actions[0].tier, undefined);
    });
    await check('--dry-run leaves the character untouched', async () => {
        const entries = (await character.get()).data().skills_and_flaws;
        assert.equal(entries[0].level, undefined);
    });

    console.log('\nReal run:');
    runMigration();

    await check('an untiered feat is set to tier 1', async () => {
        const actions = (await fighter.get()).data().actions;
        assert.equal(actions.find(a => a.actionName === 'Untiered Feat').tier, 1);
    });
    await check('an already-tiered feat keeps its tier', async () => {
        const actions = (await fighter.get()).data().actions;
        assert.equal(actions.find(a => a.actionName === 'Already Tiered').tier, 3);
    });
    await check('a non-feat action is not given a tier', async () => {
        const actions = (await fighter.get()).data().actions;
        assert.equal(actions.find(a => a.actionName === 'Power Attack').tier, undefined);
    });
    await check("a race's feat is tiered too", async () => {
        const actions = (await kobold.get()).data().actions;
        assert.equal(actions.find(a => a.actionName === 'Mild Fire').tier, 1);
    });

    await check('an old numeric skill degree maps onto the matching named level', async () => {
        const entries = (await character.get()).data().skills_and_flaws;
        assert.equal(entries.find(e => e.name === 'Steady Hands').level, 'trained');
    });
    await check('an old numeric flaw degree maps onto the matching named level', async () => {
        const entries = (await character.get()).data().skills_and_flaws;
        assert.equal(entries.find(e => e.name === 'Cracks Under Pressure').level, 'minor');
    });
    await check('an already-leveled entry is left alone', async () => {
        const entries = (await character.get()).data().skills_and_flaws;
        assert.equal(entries.find(e => e.name === 'Already Leveled').level, 'ultimate');
    });
    await check('the old degree is kept, not deleted', async () => {
        const entries = (await character.get()).data().skills_and_flaws;
        assert.equal(entries.find(e => e.name === 'Steady Hands').degree, 2);
    });
    await check('a character with no skills/flaws at all is left alone, not crashed on', async () => {
        assert.equal((await noSkills.get()).data().skills_and_flaws, undefined);
    });

    console.log('\nRe-run (must be idempotent):');
    runMigration();
    await check('running it again changes nothing further', async () => {
        const actions = (await fighter.get()).data().actions;
        assert.equal(actions.find(a => a.actionName === 'Untiered Feat').tier, 1);
        const entries = (await character.get()).data().skills_and_flaws;
        assert.equal(entries.find(e => e.name === 'Steady Hands').level, 'trained');
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
