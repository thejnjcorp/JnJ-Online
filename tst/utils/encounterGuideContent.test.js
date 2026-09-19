import { GUIDE_SECTIONS } from '../../src/utils/encounterGuideContent';
import { ENCOUNTER_TIERS, OBJECTIVE_LOADS, ROLE_BENCHMARKS, rangeText } from '../../src/utils/encounterGuide';

const tables = section => section.blocks.filter(block => block.type === 'table');
const find = title => GUIDE_SECTIONS.flatMap(section => section.blocks).find(block => block.title === title);

describe('the guide\'s cheat sheet content', () => {
    test('is split into the guide\'s five groups of sections, each with a unique key and something in it', () => {
        expect(GUIDE_SECTIONS.map(section => section.key)).toEqual(['stats', 'damage', 'budgets', 'steps', 'objectives']);
        GUIDE_SECTIONS.forEach(section => {
            expect(section.label).toBeTruthy();
            expect(section.blocks.length).toBeGreaterThan(0);
        });
    });

    test('every table row has a cell for every column', () => {
        GUIDE_SECTIONS.forEach(section => tables(section).forEach(block => {
            block.rows.forEach(row => expect({ table: block.title, cells: row.length }).toEqual({ table: block.title, cells: block.columns.length }));
        }));
    });

    test('no table repeats a row (rows are keyed by their text)', () => {
        GUIDE_SECTIONS.forEach(section => tables(section).forEach(block => {
            const keys = block.rows.map(row => row.join('|'));
            expect(new Set(keys).size).toBe(keys.length);
        }));
    });

    test('every callout and text block has its words', () => {
        GUIDE_SECTIONS.flatMap(section => section.blocks).forEach(block => {
            if (block.type === 'callout') { expect(block.title).toBeTruthy(); expect(block.text).toBeTruthy(); }
            if (block.type === 'text') expect(block.paragraphs.every(Boolean)).toBe(true);
        });
    });

    test('the benchmark table is built from the role benchmarks the builder checks against', () => {
        const rows = find('1. Quick Enemy Benchmark Bank').rows;
        expect(rows.map(row => row[0])).toEqual(['GOON', 'REGULAR', 'VETERAN', 'ELITE', 'BOSS (SET PIECE)']);
        expect(rows[0]).toEqual(['GOON', '1-5', '13-14', '+4 to +5', '3, 2, 1, 1', 'd4+1']);
        expect(rows[4].slice(1, 3)).toEqual([rangeText(ROLE_BENCHMARKS['Set Piece'].hp), rangeText(ROLE_BENCHMARKS['Set Piece'].ac)]);
    });

    test('a Captain has no row in the benchmark table, as in the guide', () => {
        expect(find('1. Quick Enemy Benchmark Bank').rows.flat().join(' ')).not.toMatch(/captain/i);
    });

    test('the guide\'s Boss is named for the Set Piece tier where the guide says Boss / Captain', () => {
        expect(GUIDE_SECTIONS.flatMap(section => section.blocks).filter(block => block.type === 'table').flatMap(block => block.rows).map(row => row[0])).toContain('Boss (Set Piece) / Captain');
    });

    test('the EHP and action tables come from the tiers the builder checks against', () => {
        expect(find('4. Effective HP (EHP) Bank').rows).toEqual(ENCOUNTER_TIERS.map(tier => [tier.label, rangeText(tier.ehp), tier.rounds]));
        expect(find('5. Enemy Action Economy Bank').rows.map(row => row[0])).toEqual(ENCOUNTER_TIERS.map(tier => tier.label));
        expect(find('5. Enemy Action Economy Bank').rows[3][1]).toBe('8-10, then change through waves');
    });

    test('the objective tax table comes from the objective loads', () => {
        expect(find('7. Secondary Objective Action Tax').rows).toEqual(OBJECTIVE_LOADS.map(load => [load.label, load.partyActions, load.adjustment]));
    });

    test('has the guide\'s numbered sections', () => {
        ['2. Damage Bank', '3. AC Bank', '6. The Encounter-Building Algorithm', '8. Secondary Objective Toolkit', '10. Example: Cemetery Necromantic Anchors', '11. The "What Am I Paying For?" Rule']
            .forEach(title => expect(find(title)).toBeDefined());
        expect(find('6. The Encounter-Building Algorithm').rows).toHaveLength(8);
        expect(find('8. Secondary Objective Toolkit').rows).toHaveLength(10);
    });
});
