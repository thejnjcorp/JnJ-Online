// What the image tokens' stylesheet has to do that no component test can see.
const fs = require('node:fs');
const path = require('node:path');

const read = name => fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'styles', name), 'utf8');
const css = read('MapImageTokens.scss');

function rule(selector, source = css) {
    const start = source.indexOf(`${selector} {`);
    if (start === -1) throw new Error(`no rule for ${selector}`);
    return source.slice(source.indexOf('{', start) + 1, source.indexOf('}', start));
}
const zIndex = (selector, source) => Number(/z-index: (\d+)/.exec(rule(selector, source))[1]);

describe('the image tokens\' stylesheet', () => {
    test('the layer covers the map and lets clicks through; only a token someone can edit takes the pointer', () => {
        expect(rule('.MapImageTokens')).toContain('inset: 0');
        expect(rule('.MapImageTokens')).toContain('pointer-events: none');
        expect(rule('.MapImageToken')).toContain('pointer-events: none');
        expect(rule('.MapImageToken-editable')).toContain('pointer-events: auto');
    });

    test('they are above the map but under the drawing and under the combatants, so a fire never hides a token', () => {
        expect(zIndex('.MapImageTokens')).toBeLessThan(zIndex('.MapDrawing', read('MapDrawing.scss')));
        expect(zIndex('.MapDrawing', read('MapDrawing.scss'))).toBeLessThan(zIndex('.MapTokens', read('MapTokens.scss')));
        expect(zIndex('.MapImageTokens')).toBeGreaterThan(0);
    });

    test('a picture is centred on its spot, as wide as its size, and as tall as its shape needs', () => {
        expect(rule('.MapImageToken')).toContain('translate(-50%, -50%)');
        expect(rule('.MapImageToken-image')).toContain('width: 100%');
        expect(rule('.MapImageToken-image')).toContain('height: auto');
    });

    test('while a library token is dragged over the map the layer takes the drop, and otherwise it lets clicks through', () => {
        expect(rule('.MapImageTokens-droppable')).toContain('pointer-events: auto');
        expect(css.indexOf('.MapImageTokens-droppable {')).toBeGreaterThan(css.indexOf('.MapImageTokens {'));
    });

    test('a library token\'s picture does not take the drag from the button that carries it', () => {
        expect(rule('.MapImageTokenToolbar-token-image')).toContain('pointer-events: none');
    });

    test('dragging one with a finger does not scroll the page', () => {
        expect(rule('.MapImageToken-editable')).toContain('touch-action: none');
    });

    test('the selected one is outlined', () => {
        expect(rule('.MapImageToken-selected')).toContain('outline');
    });
});
