// What the combat map's stylesheet has to do to put its tools beside it.
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'styles', 'CombatMap.scss'), 'utf8');
const from = css.indexOf('.CombatMap-beside {');
const beside = css.slice(from);

function rule(selector, source = beside) {
    const start = source.indexOf(`${selector} {`);
    if (start === -1) throw new Error(`no rule for ${selector}`);
    return source.slice(source.indexOf('{', start) + 1, source.indexOf('}', start));
}

describe('the combat map with its tools beside it', () => {
    test('by default - a narrow screen - the tools stack above the map', () => {
        expect(rule('.CombatMap-beside')).toContain('flex-direction: column');
    });

    test('on a wide screen they go down its left side', () => {
        const wide = beside.slice(beside.indexOf('@media (min-width'));
        expect(wide).toMatch(/@media \(min-width: \d+px\)/);
        expect(rule('.CombatMap-beside', wide)).toContain('flex-direction: row');
    });

    test('the map area takes the room the column leaves, and can shrink, so the map is sized to what is left', () => {
        expect(rule('.CombatMap-beside-map')).toContain('flex: 1 1 0%');
        expect(rule('.CombatMap-beside-map')).toContain('min-width: 0');
        expect(rule('.CombatMap-beside-map')).toContain('min-height: 0');
        expect(rule('.CombatMap-beside')).toContain('min-height: 0');
    });

    test('the column keeps its width, and scrolls on its own if the tools outgrow the screen', () => {
        expect(rule('.CombatMap-sidebar')).toContain('overflow-y: auto');
        expect(rule('.CombatMap-sidebar')).toContain('flex: none');
        const wide = beside.slice(beside.indexOf('@media (min-width'));
        expect(rule('.CombatMap-sidebar', wide)).toMatch(/width: \d+rem/);
    });

    test('in the column each toolbar\'s controls stack, and its inputs fill it', () => {
        const wide = beside.slice(beside.indexOf('@media (min-width'));
        expect(wide).toContain('.MapDrawingToolbar');
        expect(wide).toContain('.MapImageTokenToolbar');
        expect(wide).toContain('flex-direction: column');
        expect(wide).toContain('width: 100%');
    });

    test('and they do not wrap: a column that wraps starts a second column beside the first, hiding half the form', () => {
        const wide = beside.slice(beside.indexOf('@media (min-width'));
        expect(wide).toContain('flex-wrap: nowrap');
    });
});
