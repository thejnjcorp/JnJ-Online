// How the app refers to a picture it has stored: an "image ref".
//
// A picture uploaded through Imgur (see imgurUploader.js) lives at
// https://i.imgur.com/<hash>.<extension>, so all that is worth keeping is
// "<hash>.<extension>" - shorter to store, and it doesn't tie the data to a
// link. The extension stays because it is the format: an animated fire is a .gif,
// and asking for it as a .png would give a still. A picture from anywhere else
// (a link pasted in) is kept as the whole web link. Either way `imageSrc` turns a
// ref back into something an <img> can load.

export const IMGUR_HOST = 'https://i.imgur.com/';

// Imgur ids are 5 to 7 letters and digits today; some room is left.
const IMGUR_HASH = '[A-Za-z0-9]{5,12}';
const IMGUR_REF = new RegExp(`^${IMGUR_HASH}\\.[A-Za-z0-9]{3,5}$`);
const IMGUR_LINK = new RegExp(`^https?://(?:i\\.)?imgur\\.com/(${IMGUR_HASH}\\.[A-Za-z0-9]{3,5})$`, 'i');

export const MAX_IMAGE_URL_LENGTH = 500;

// A web link to a picture: only http(s), so nothing else is ever set as an image's
// source.
export function isWebUrl(value) {
    if (typeof value !== 'string' || value.length === 0 || value.length > MAX_IMAGE_URL_LENGTH) return false;
    try {
        const { protocol } = new URL(value);
        return protocol === 'https:' || protocol === 'http:';
    } catch {
        return false;
    }
}

export const isImgurRef = value => typeof value === 'string' && IMGUR_REF.test(value);

// Whether `value` is something that can be stored as a picture.
export const isImageRef = value => isImgurRef(value) || isWebUrl(value);

// What to store for whatever was typed, pasted or uploaded: an Imgur link (or a
// bare "hash.ext") becomes just the hash, any other web link stays as it is, and
// anything else is null.
export function imageRef(input) {
    if (typeof input !== 'string') return null;
    const text = input.trim();
    const imgur = IMGUR_LINK.exec(text);
    if (imgur) return imgur[1];
    if (isImgurRef(text)) return text;
    return isWebUrl(text) ? text : null;
}

// The address to load a stored picture from.
export const imageSrc = ref => (isImgurRef(ref) ? IMGUR_HOST + ref : ref);
