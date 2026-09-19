import { STATUS_TYPES, isHexColor, isToken, readableOn, statusColorClass, statusColorStyle, typeLabel } from '../../src/utils/statusStyle';

describe('status types', () => {
    test('are Buff, Debuff, Neutral and Token, in that order', () => {
        expect(STATUS_TYPES.map(type => type.key)).toEqual(['buff', 'debuff', 'neutral', 'token']);
    });

    test('isToken is true only for the token type', () => {
        expect(isToken({ polarity: 'token' })).toBe(true);
        expect(isToken({ polarity: 'buff' })).toBe(false);
        expect(isToken({})).toBe(false);
        expect(isToken(undefined)).toBe(false);
    });

    test('typeLabel names a type, and falls back to Neutral', () => {
        expect(typeLabel('token')).toBe('Token');
        expect(typeLabel('debuff')).toBe('Debuff');
        expect(typeLabel(undefined)).toBe('Neutral');
    });
});

describe('status colors', () => {
    test('isHexColor accepts only #rrggbb', () => {
        expect(isHexColor('#a1B2c3')).toBe(true);
        expect(isHexColor('#abc')).toBe(false);
        expect(isHexColor('red')).toBe(false);
        expect(isHexColor('')).toBe(false);
        expect(isHexColor(null)).toBe(false);
    });

    test('readableOn picks dark text on light colors and white on dark ones', () => {
        expect(readableOn('#ffffff')).toBe('#1b1b1f');
        expect(readableOn('#f5a623')).toBe('#1b1b1f');
        expect(readableOn('#000000')).toBe('#ffffff');
        expect(readableOn('#7c4dff')).toBe('#ffffff');
        expect(readableOn('#1abc9c')).toBe('#1b1b1f'); // mid-tones: dark reads better than white
        expect(readableOn('#c9453f')).toBe('#ffffff');
    });

    test('a status with a color gets the inline variables and the custom class', () => {
        const status = { color: '#f5a623' };
        expect(statusColorStyle(status)).toEqual({ '--status-color': '#f5a623', '--status-on-color': '#1b1b1f' });
        expect(statusColorClass(status, 'Chip')).toBe('Chip-custom');
    });

    test('a status without one (or with a bad one) uses its type default: no style, no class', () => {
        [{}, { color: '' }, { color: null }, { color: 'blue' }, undefined].forEach(status => {
            expect(statusColorStyle(status)).toBeUndefined();
            expect(statusColorClass(status, 'Chip')).toBe('');
        });
    });
});
