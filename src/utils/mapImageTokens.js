// Image tokens on the combat map: a director's pictures of obstacles and items
// (fire, trees, pillars, holes...), shown to everyone.
//
// Like the drawing, they belong to the map, not the fight: each is
// { id, image, label, x, y, size } in the map doc's `image_tokens` list, they are
// tied to no zone, and only someone who can edit the map moves them. `x` and `y`
// are the picture's centre in "map widths" (x runs 0 to 1 across the map, y 0 to
// height/width down it) and `size` is its width in the same unit, so it lines up
// and scales at any size the map is shown at.

import { round } from './mapTokens';

export const IMAGE_TOKEN_SIZES = [
    { key: 'small', label: 'Small', value: 0.04 },
    { key: 'medium', label: 'Medium', value: 0.07 },
    { key: 'large', label: 'Large', value: 0.12 },
    { key: 'huge', label: 'Huge', value: 0.2 },
];

export const DEFAULT_IMAGE_TOKEN_SIZE = IMAGE_TOKEN_SIZES[1].value;

// Each is a link and a few numbers, so this is nowhere near the map doc's 1 MiB
// limit; it is there so a map stays readable, not to protect the document.
export const MAX_IMAGE_TOKENS = 60;
export const MAX_LABEL_LENGTH = 40;
export const MAX_IMAGE_URL_LENGTH = 500;

// How far (in map widths) a copy is put from the token it was copied from, and how
// far a keyboard arrow moves one.
export const COPY_OFFSET = 0.03;
export const KEY_STEP = 0.02;

// A web link to a picture: only http(s), so nothing else is ever set as an image's
// source.
export function isImageUrl(value) {
    if (typeof value !== 'string' || value.length === 0 || value.length > MAX_IMAGE_URL_LENGTH) return false;
    try {
        const { protocol } = new URL(value);
        return protocol === 'https:' || protocol === 'http:';
    } catch {
        return false;
    }
}

// The saved image tokens, as far as the doc can be trusted: anything not shaped
// like one is left out rather than breaking the map.
export function validImageTokens(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(token => token
        && typeof token.id === 'string'
        && isImageUrl(token.image)
        && Number.isFinite(token.x)
        && Number.isFinite(token.y)
        && Number.isFinite(token.size)
        && token.size > 0);
}

// A point kept on the map: its centre can reach the edge, no further.
export const clampToMap = (point, aspect) => ({
    x: round(Math.min(1, Math.max(0, point.x))),
    y: round(Math.min(aspect, Math.max(0, point.y))),
});

export function newImageToken({ image, label = '', size = DEFAULT_IMAGE_TOKEN_SIZE }, at) {
    return {
        id: crypto.randomUUID(),
        image: image.trim(),
        label: label.trim().slice(0, MAX_LABEL_LENGTH),
        x: round(at.x),
        y: round(at.y),
        size,
    };
}

const change = (tokens, id, edit) => tokens.map(token => (token.id === id ? { ...token, ...edit } : token));

export const moveImageToken = (tokens, id, point, aspect) => change(tokens, id, clampToMap(point, aspect));

export const resizeImageToken = (tokens, id, size) => change(tokens, id, { size });

export const removeImageToken = (tokens, id) => tokens.filter(token => token.id !== id);

// A copy of a token a little way from it - for a row of trees or a scatter of
// rubble - added after it (so above it). `id` is the copy's.
export function copyImageToken(tokens, id, aspect) {
    const original = tokens.find(token => token.id === id);
    if (!original) return { tokens, id: null };
    const copy = { ...original, id: crypto.randomUUID(), ...clampToMap({ x: original.x + COPY_OFFSET, y: original.y + COPY_OFFSET }, aspect) };
    return { tokens: [...tokens, copy], id: copy.id };
}
