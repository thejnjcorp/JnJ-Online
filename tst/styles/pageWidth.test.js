// The card-grid pages use the whole screen (their grids add columns as it
// widens) rather than a 1200px column. These guard the pieces that make that
// work, since none of it is visible to a unit test of the components.
const fs = require('node:fs');
const path = require('node:path');

const styles = name => fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'styles', name), 'utf8');

// The declarations of the first rule whose selector is exactly `selector`.
function rule(css, selector) {
    const start = css.indexOf(`${selector} {`);
    if (start === -1) throw new Error(`no rule for ${selector}`);
    return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
}

describe('page width', () => {
    test.each([
        ['Characters.scss', '.Character-page'],
        ['Campaigns.scss', '.Campaigns-page'],
        ['CampaignPage.scss', '.CampaignPage'],
        ['ClassListPage.scss', '.ClassListPage-inner'],
        ['StatusListPage.scss', '.StatusListPage-inner'],
        ['CampaignClassesPage.scss', '.CampaignClassesPage-inner'],
    ])('%s: %s uses the wide limit and the fluid gutter, not the 1200px column', (file, selector) => {
        const body = rule(styles(file), selector);
        expect(body).toContain('max-width: var(--jnj-content-max-wide)');
        expect(body).toContain('var(--jnj-gutter-wide)');
        expect(body).not.toContain('--jnj-content-max)');
    });

    test('the wide limit is only an ultra-wide guard rail, and the gutter is the old 24px up to 1200px wide', () => {
        const theme = styles('themes/BaseTheme.scss');
        expect(theme).toMatch(/--jnj-content-max-wide:\s*2400px/);
        expect(theme).toMatch(/--jnj-gutter-wide:\s*clamp\(var\(--jnj-space-5\), calc\(var\(--jnj-space-5\) \+ \(100vw - 1200px\) \/ 20\), var\(--jnj-space-8\)\)/);
        expect(theme).toMatch(/--jnj-space-5:\s*24px/);
    });

    test('the wrappers around /characters and /campaigns/... are full width', () => {
        expect(rule(styles('Characters.scss'), '.Characters-shell')).toContain('width: 100%');
        expect(rule(styles('Campaigns.scss'), '.Campaigns-shell')).toContain('width: 100%');
    });

    test('the campaign actions row wraps instead of forcing a sideways scroll on a phone', () => {
        expect(rule(styles('CampaignPage.scss'), '.CampaignPage-actions')).toContain('flex-wrap: wrap');
    });

    test('the pages deliberately left as a centred column still are', () => {
        ['AccountPage.scss', 'ClassPage.scss', 'Homepage.scss'].forEach(file => expect(styles(file)).toContain('max-width: var(--jnj-content-max)'));
    });
});
