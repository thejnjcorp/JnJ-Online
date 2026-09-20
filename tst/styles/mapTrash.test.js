// What the trash can's stylesheet has to do that no component test can see.
const fs = require('node:fs');
const path = require('node:path');

const read = name => fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'styles', name), 'utf8');
const css = read('MapTrash.scss');

function rule(selector, source = css) {
    const start = source.indexOf(`${selector} {`);
    if (start === -1) throw new Error(`no rule for ${selector}`);
    return source.slice(source.indexOf('{', start) + 1, source.indexOf('}', start));
}
const zIndex = (selector, source) => Number(/z-index: (\d+)/.exec(rule(selector, source))[1]);

describe('the trash can\'s stylesheet', () => {
    test('it has no size - so nothing can be dropped on it - until a token is being carried', () => {
        expect(rule('.MapTrash')).toContain('display: none');
        expect(rule('.MapTrash-visible')).toContain('display: flex');
    });

    test('it never takes the pointer, so it cannot get in the way of dragging', () => {
        expect(rule('.MapTrash')).toContain('pointer-events: none');
    });

    test('it sits in the map\'s corner, above every layer, so a token dragged there does not hide it', () => {
        expect(rule('.MapTrash')).toContain('position: absolute');
        expect(rule('.MapTrash')).toMatch(/right: \d+px/);
        expect(rule('.MapTrash')).toMatch(/bottom: \d+px/);
        expect(zIndex('.MapTrash')).toBeGreaterThan(zIndex('.MapTokens', read('MapTokens.scss')));
    });

    test('it changes look when the token is over it', () => {
        expect(rule('.MapTrash-hot')).toContain('background');
    });
});
