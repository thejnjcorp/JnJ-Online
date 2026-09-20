// The Combat tab's action points stay in view while the actions scroll past. That
// depends on stylesheet details no component test can see, so they are guarded here.
const fs = require('node:fs');
const path = require('node:path');

const styles = name => fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'styles', name), 'utf8');

function rule(css, selector) {
    const start = css.indexOf(`${selector} {`);
    if (start === -1) throw new Error(`no rule for ${selector}`);
    return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
}

describe('sticky action points', () => {
    const css = styles('CharacterMainTab.scss');

    test('the bar is sticky, opaque, and above the cards scrolling under it', () => {
        const body = rule(css, '.CharacterMainTab-action-points');
        expect(body).toContain('position: sticky');
        expect(body).toMatch(/top: calc\(-1 \* var\(--jnj-space-5\)\)/); // flush with the top of the right column, past its padding
        expect(body).toMatch(/background-color: var\(--jnj-color-bg-raised\)/);
        expect(body).toMatch(/z-index: \d+/);
    });

    test('on phones the page itself scrolls, so it sticks at 0 in a single compact row', () => {
        const phone = css.slice(css.indexOf('@media (max-width: 640px)'));
        const body = rule(phone, '.CharacterMainTab-action-points');
        expect(body).toContain('top: 0');
        expect(body).not.toContain('flex-wrap');
        expect(rule(phone, '.CharacterMainTab-ap-short')).toContain('display: inline');
    });

    test('the statuses ride in the same sticky bar, in a row that scrolls rather than growing without limit', () => {
        expect(rule(css, '.CharacterMainTab-action-points')).toContain('flex-direction: column');
        const strip = rule(css, '.CharacterMainTab-status-strip');
        expect(strip).toMatch(/max-height: [\d.]+rem/);
        expect(strip).toContain('overflow-y: auto');
    });

    test('on phones the statuses are one row that scrolls sideways', () => {
        const phone = css.slice(css.indexOf('@media (max-width: 640px)'));
        const strip = rule(phone, '.CharacterMainTab-status-strip');
        expect(strip).toContain('flex-wrap: nowrap');
        expect(strip).toContain('overflow-x: auto');
    });

    test('the reaction sits in the same row, and on phones the row stays one line, the count is for screen readers only, and the map peek is left out', () => {
        expect(rule(css, '.CharacterMainTab-ap-row')).toContain('flex-wrap: wrap');
        const phone = css.slice(css.indexOf('@media (max-width: 640px)'));
        expect(rule(phone, '.CharacterMainTab-ap-row')).toContain('flex-wrap: nowrap');
        expect(rule(phone, '.CharacterMainTab-action-points-label')).toContain('clip: rect(0 0 0 0)');
        expect(rule(styles('CombatMapPeek.scss').slice(styles('CombatMapPeek.scss').indexOf('@media (max-width: 640px)')), '.CombatMapPeek')).toContain('display: none');
    });

    test('the tab content wrapper stops being a scroll container for tabs that ask (or sticky has nowhere to go)', () => {
        expect(rule(styles('TabContainer.scss'), '.TabContainer-content.TabContainer-content-unclipped')).toContain('overflow: visible');
    });
});
