// Action text reads best left-aligned, but the pages that show it (the character
// sheet especially) centre their text - so each place an action's text is shown
// sets its own alignment. Nothing in a component test can see that.
const fs = require('node:fs');
const path = require('node:path');

const styles = name => fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'styles', name), 'utf8');

function rule(css, selector) {
    const start = css.indexOf(`${selector} {`);
    if (start === -1) throw new Error(`no rule for ${selector}`);
    return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
}

describe('action text alignment', () => {
    test.each([
        ['CombatActionList.scss', '.CombatActionListCard-description'],
        ['CombatActionList.scss', '.CombatActionListCard-meta-lines'],
        ['SkillsAndFlaws.scss', '.SkillsAndFlaws-feat-description'],
        ['SkillsAndFlaws.scss', '.SkillsAndFlaws-description'],
    ])('%s: %s is left-aligned rather than following the centred page', (file, selector) => {
        expect(rule(styles(file), selector)).toContain('text-align: left');
    });
});
