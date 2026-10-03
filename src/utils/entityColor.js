import { isHexColor } from './statusStyle';

// The colour someone picked for a character or an enemy - to outline its card and its token so it
// can be told from the others - or '' if none was picked (or what is stored is not a colour), in
// which case it keeps the colour its side has.
export const chosenColor = value => (isHexColor(value) ? value.toLowerCase() : '');

// The colour as a see-through fill (a tint for a card's background): rgba from a #rrggbb colour.
export function colorTint(hex, alpha = 0.13) {
    if (!isHexColor(hex)) return undefined;
    const channel = start => Number.parseInt(hex.slice(start, start + 2), 16);
    return `rgba(${channel(1)}, ${channel(3)}, ${channel(5)}, ${alpha})`;
}
