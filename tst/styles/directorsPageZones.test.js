// What the Director's Page line view's stylesheet has to do that no component test can see.
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'styles', 'DirectorsPage.scss'), 'utf8');

function rule(selector) {
    const start = css.indexOf(`${selector} {`);
    if (start === -1) throw new Error(`no rule for ${selector}`);
    return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
}

describe('the line view\'s zones', () => {
    test('each zone\'s list fills its card, so an empty zone still has somewhere to drop someone (a list with nobody in it has no height of its own)', () => {
        expect(rule('.DirectorsPage-zone-card')).toContain('display: flex');
        expect(rule('.DirectorsPage-zone-card')).toContain('flex-direction: column');
        expect(rule('.DirectorsPage-zone-chips')).toContain('flex: 1 1 auto');
        expect(rule('.DirectorsPage-zone-chips')).toMatch(/min-height: \d/);
    });

    test('the chips inside stay plain blocks, which is what keeps their width tied to the zone\'s', () => {
        expect(rule('.DirectorsPage-zone-chips')).toContain('display: block');
    });

    test('a defeated enemy is dimmed and struck through on its card and its chip', () => {
        expect(rule('.DirectorsPage-entity-card-defeated')).toContain('opacity');
        expect(css).toContain('.DirectorsPage-entity-card-defeated {');
        expect(css.slice(css.indexOf('.DirectorsPage-entity-card-defeated {'))).toContain('line-through');
        expect(rule('.DirectorsPage-entity-chip-defeated')).toContain('opacity');
    });
});
