// The reading settings must adjust pages without overriding a layout decision a
// page already made. A width cap with normal specificity beats a page's own
// `max-width` (that is how the Account page's centred column was once lost
// whenever a text setting was on), so the caps that are meant to be fallbacks
// are wrapped in :where(), which has zero specificity.
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'styles', 'Accessibility.scss'), 'utf8');

// [selector, body] for every rule block that declares a max-width.
function maxWidthRules() {
    const rules = [];
    const pattern = /([^{}]+)\{([^{}]*)\}/g;
    let match;
    while ((match = pattern.exec(css)) !== null) {
        if (/(^|\s|;)max-width:/.test(match[2])) rules.push([match[1].replace(/\/\*[\s\S]*?\*\//g, '').trim(), match[2].trim()]);
    }
    return rules;
}

describe('Accessibility.scss width caps', () => {
    const rules = maxWidthRules();

    test('finds the width caps', () => {
        expect(rules.length).toBeGreaterThanOrEqual(3);
    });

    test('the page-root and form-control caps are zero-specificity, so a page\'s own max-width wins', () => {
        const fallbacks = rules.filter(([selector]) => selector.includes('.App-body') || selector.includes('input, select, textarea'));
        expect(fallbacks).toHaveLength(2);
        fallbacks.forEach(([selector]) => expect(selector).toMatch(/^:where\(html\.A11y-text-adapt\) :where\(/));
    });

    test('the only other max-width is the tab strip, which has none of its own to lose', () => {
        const others = rules.filter(([selector]) => !selector.includes('.App-body') && !selector.includes('input, select, textarea'));
        expect(others.map(([selector]) => selector)).toEqual(['html.A11y-text-adapt .TabContainer .TabContainer-tabs']);
    });
});
