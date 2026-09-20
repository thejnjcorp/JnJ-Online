// What the tokens' stylesheet has to do that no component test can see.
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'styles', 'MapTokens.scss'), 'utf8');

function rule(selector) {
    const start = css.indexOf(`${selector} {`);
    if (start === -1) throw new Error(`no rule for ${selector}`);
    return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
}

describe('the map tokens\' stylesheet', () => {
    test('the layer covers the map and lets clicks through to what is under it; only tokens take the pointer', () => {
        expect(rule('.MapTokens')).toContain('inset: 0');
        expect(rule('.MapTokens')).toContain('pointer-events: none');
        expect(rule('.MapToken')).toContain('pointer-events: auto');
    });

    test('tokens are above the drawing, and stop the browser scrolling or panning when one is dragged with a finger', () => {
        expect(rule('.MapTokens')).toMatch(/z-index: 7/);
        expect(rule('.MapToken')).toContain('touch-action: none');
    });

    test('a token is a circle centred on its spot', () => {
        expect(rule('.MapToken')).toContain('border-radius: 50%');
        expect(rule('.MapToken')).toContain('translate(-50%, -50%)');
    });

    test('names are hidden until you point at, focus or drag the token, so a crowded zone is not a tangle of labels', () => {
        expect(rule('.MapToken-name')).toContain('display: none');
        expect(css).toMatch(/\.MapToken:hover,[\s\S]*?\.MapToken:focus-visible,[\s\S]*?\.MapToken-dragging \{[\s\S]*?\.MapToken-name \{\s*display: block/);
    });

    test('each side has its own colour', () => {
        ['player', 'ally', 'enemy', 'neutral'].forEach(kind => expect(css).toContain(`.MapToken-${kind} {`));
    });
    test('a defeated token is greyed out and crossed through, but not made a different size or removed', () => {
        expect(rule('.MapToken-defeated')).toContain('grayscale');
        expect(rule('.MapToken-defeated')).toContain('opacity');
        expect(css).toContain('.MapToken-defeated {');
        expect(css.slice(css.indexOf('.MapToken-defeated {'))).toContain('&::after');
    });

    test('the selected token is outlined', () => {
        expect(rule('.MapToken-selected')).toContain('outline');
    });
});
