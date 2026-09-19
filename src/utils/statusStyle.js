// How a status looks and what type it is.
//
// A status has a type (`polarity` in the data): Buff, Debuff, Neutral, or Token.
// A Token has no mechanics of its own - it is a marker a class's actions and
// lore refer to, like a Monk's stance - so it never changes stats, grants an
// action, or counts down. Each type has a default colour; a status can override
// it with its own `color` (a #rrggbb hex).

export const STATUS_TYPES = [
    { key: 'buff', label: 'Buff' },
    { key: 'debuff', label: 'Debuff' },
    { key: 'neutral', label: 'Neutral' },
    { key: 'token', label: 'Token', hint: 'A marker with no mechanical effect of its own - for things a class refers to, like a stance. It changes no stats, grants no action and never counts down.' },
];

export const isToken = status => status?.polarity === 'token';

export const typeLabel = polarity => STATUS_TYPES.find(type => type.key === polarity)?.label || 'Neutral';

export const isHexColor = value => /^#[0-9a-f]{6}$/i.test(value || '');

// Dark or white text, whichever contrasts more with the colour (WCAG relative
// luminance; 0.179 is where the two contrast ratios are equal).
export function readableOn(hex) {
    const channel = start => {
        const value = parseInt(hex.slice(start, start + 2), 16) / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
    return luminance > 0.179 ? '#1b1b1f' : '#ffffff';
}

// The inline style that gives a chip or card its own colour, or nothing when the
// status uses its type's default. Pair with `statusColorClass`.
export function statusColorStyle(status) {
    if (!isHexColor(status?.color)) return undefined;
    return { '--status-color': status.color, '--status-on-color': readableOn(status.color) };
}

export const statusColorClass = (status, base) => (isHexColor(status?.color) ? `${base}-custom` : '');
