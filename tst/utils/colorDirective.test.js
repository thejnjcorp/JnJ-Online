import { isSafeColor, splitColorDirectives } from '../../src/utils/colorDirective';

describe('isSafeColor', () => {
    test('a hex color, 3/6/8 digits, is safe', () => {
        expect(isSafeColor('#f00')).toBe(true);
        expect(isSafeColor('#ff0000')).toBe(true);
        expect(isSafeColor('#ff0000ff')).toBe(true);
    });

    test('a bare named color is safe', () => {
        expect(isSafeColor('red')).toBe(true);
        expect(isSafeColor('cornflowerblue')).toBe(true);
    });

    test('anything with punctuation, parentheses, or a url is not safe', () => {
        expect(isSafeColor('red; background: url(x)')).toBe(false);
        expect(isSafeColor('rgb(255,0,0)')).toBe(false);
        expect(isSafeColor('javascript:alert(1)')).toBe(false);
        expect(isSafeColor('')).toBe(false);
    });

    test('not a string is not safe', () => {
        expect(isSafeColor(undefined)).toBe(false);
        expect(isSafeColor(null)).toBe(false);
        expect(isSafeColor(5)).toBe(false);
    });
});

describe('splitColorDirectives', () => {
    test('a string with no color directive comes back as itself, in a single-item array', () => {
        expect(splitColorDirectives('Plain **markdown** text.')).toEqual(['Plain **markdown** text.']);
    });

    test('not a string comes back as itself, in a single-item array', () => {
        expect(splitColorDirectives(undefined)).toEqual([undefined]);
        expect(splitColorDirectives(null)).toEqual([null]);
    });

    test('a single colored run in the middle splits into before/colored/after', () => {
        const result = splitColorDirectives('Before :color[danger]{color="#ff0000"} after.');
        expect(result).toEqual(['Before ', { text: 'danger', color: '#ff0000' }, ' after.']);
    });

    test('a colored run at the very start or end has no empty string either side', () => {
        expect(splitColorDirectives(':color[danger]{color=red} after.')).toEqual([{ text: 'danger', color: 'red' }, ' after.']);
        expect(splitColorDirectives('Before :color[danger]{color=red}')).toEqual(['Before ', { text: 'danger', color: 'red' }]);
    });

    test('multiple colored runs each split out', () => {
        const result = splitColorDirectives(':color[red]{color=red} and :color[blue]{color=blue}.');
        expect(result).toEqual([{ text: 'red', color: 'red' }, ' and ', { text: 'blue', color: 'blue' }, '.']);
    });

    test('single or unquoted color values both parse', () => {
        expect(splitColorDirectives(":color[x]{color='#00ff00'}")).toEqual([{ text: 'x', color: '#00ff00' }]);
        expect(splitColorDirectives(':color[x]{color=#00ff00}')).toEqual([{ text: 'x', color: '#00ff00' }]);
    });

    test('an unsafe or malformed color value falls back to plain text, markup stripped', () => {
        expect(splitColorDirectives(':color[danger]{color="rgb(255,0,0)"}')).toEqual(['danger']);
        expect(splitColorDirectives(':color[danger]{color="red; background:url(x)"}')).toEqual(['danger']);
    });

    test('markdown inside the colored text is preserved as text, for the caller to render', () => {
        expect(splitColorDirectives(':color[**bold** danger]{color=red}')).toEqual([{ text: '**bold** danger', color: 'red' }]);
    });
});
