// Guards the "Text size" setting: it works by scaling the root font size, so a
// font size written in px would quietly stop responding to it. Every font size
// in the stylesheets has to be rem-based (or a token that is).
const fs = require('node:fs');
const path = require('node:path');

const STYLES = path.join(__dirname, '..', '..', 'src');

function stylesheets(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return stylesheets(full);
        return /\.(scss|css)$/.test(entry.name) ? [full] : [];
    });
}

const files = stylesheets(STYLES);

describe('stylesheet font sizes', () => {
    test('finds the app stylesheets', () => {
        expect(files.length).toBeGreaterThan(20);
    });

    test('none is written in px', () => {
        const offenders = files.flatMap(file =>
            fs.readFileSync(file, 'utf8').split('\n')
                .map((line, index) => ({ line, number: index + 1 }))
                .filter(({ line }) => /font-size:\s*[\d.]+px/.test(line))
                .map(({ number, line }) => `${path.relative(STYLES, file)}:${number}: ${line.trim()}`));
        expect(offenders).toEqual([]);
    });

    test('every calc()/viewport-unit font size is multiplied by the text scale, except the 404 heading', () => {
        const offenders = files.flatMap(file =>
            fs.readFileSync(file, 'utf8').split('\n')
                .map((line, index) => ({ line, number: index + 1 }))
                .filter(({ line }) => /font-size:\s*(calc\(|[\d.]+(vw|vh|vmin|vmax|pt))/.test(line))
                .filter(({ line }) => !line.includes('--jnj-text-scale'))
                .map(({ number, line }) => `${path.relative(STYLES, file)}:${number}: ${line.trim()}`));
        // A 10vh decorative numeral, not reading text.
        expect(offenders).toEqual(['styles/InvalidPage.scss:2: font-size: 10vh;']);
    });

    test('the app-wide fluid size is multiplied by the text scale (otherwise most pages would ignore the setting)', () => {
        const app = fs.readFileSync(path.join(STYLES, 'styles', 'App.scss'), 'utf8');
        expect(app).toContain('font-size: calc((10px + 2vmin) * var(--jnj-text-scale, 1));');
    });

    test('the root font size reads the text scale, and is exactly the browser default when it is 1', () => {
        const index = fs.readFileSync(path.join(STYLES, 'styles', 'index.scss'), 'utf8');
        expect(index).toMatch(/html\s*{\s*font-size:\s*calc\(100% \* var\(--jnj-text-scale, 1\)\);\s*}/);
    });

    test('no component sets a numeric (px) inline fontSize', () => {
        const components = fs.readdirSync(path.join(STYLES, 'components')).filter(name => /\.(js|jsx|tsx?)$/.test(name));
        const offenders = components.filter(name => /fontSize:\s*\d/.test(fs.readFileSync(path.join(STYLES, 'components', name), 'utf8')));
        expect(offenders).toEqual([]);
    });
});
