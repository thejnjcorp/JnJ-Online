import { chosenColor, colorTint } from '../../src/utils/entityColor';

describe('chosenColor', () => {
    test('is a #rrggbb colour, in lower case', () => {
        expect(chosenColor('#00ff85')).toBe('#00ff85');
        expect(chosenColor('#00FF85')).toBe('#00ff85');
    });

    test('is empty for none, or for something that is not a colour', () => {
        ['', undefined, null, 'green', '#fff', '#12345', '#gggggg', 42].forEach(value => expect(chosenColor(value)).toBe(''));
    });
});

describe('colorTint', () => {
    test('is the colour as a see-through fill', () => {
        expect(colorTint('#ff7a1f')).toBe('rgba(255, 122, 31, 0.13)');
        expect(colorTint('#000000', 0.5)).toBe('rgba(0, 0, 0, 0.5)');
    });

    test('is nothing for something that is not a colour', () => {
        expect(colorTint('orange')).toBeUndefined();
        expect(colorTint(undefined)).toBeUndefined();
    });
});
