import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { isImageRef } from './imageRefs';
import { DEFAULT_IMAGE_TOKEN_SIZE, MAX_LABEL_LENGTH } from './mapImageTokens';

// A director's library of pictures to put on maps - fire, trees, pillars - kept
// with their account so they can be reused on any map in any campaign, rather than
// found and pasted in again each time. Each is { image, label, size } (an image
// ref - see imageRefs.js - what it is called, and the size it is placed at) in
// players/{userId}/tokens; only its owner can read or write them (see
// firestore.rules).
export const MAX_LIBRARY_TOKENS = 100;

// The MIME type a library token is dragged with, to be dropped on a map.
export const DRAG_TYPE = 'application/x-jnj-image-token';

export const libraryCollection = userId => collection(db, 'players', userId, 'tokens');

// The saved tokens, as far as the docs can be trusted, oldest first (then by name,
// for those saved together).
export function validLibraryTokens(docs) {
    return docs
        .filter(item => item && typeof item.id === 'string' && isImageRef(item.image))
        .slice()
        .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0) || String(a.label || '').localeCompare(String(b.label || '')));
}

export function saveToLibrary(userId, { image, label = '', size = DEFAULT_IMAGE_TOKEN_SIZE }) {
    return addDoc(libraryCollection(userId), {
        image,
        label: label.trim().slice(0, MAX_LABEL_LENGTH),
        size,
        createdAt: serverTimestamp(),
    });
}

export const removeFromLibrary = (userId, tokenId) => deleteDoc(doc(db, 'players', userId, 'tokens', tokenId));

// What a token carries when it is dragged off the palette.
export const dragPayload = token => JSON.stringify({ image: token.image, label: token.label || '', size: token.size });

// The token to place from what a drop carried, or null if it isn't one - anything
// dropped from elsewhere is checked, not trusted.
export function readDragPayload(text) {
    try {
        const { image, label, size } = JSON.parse(text);
        if (!isImageRef(image) || !Number.isFinite(size) || size <= 0) return null;
        return { image, label: typeof label === 'string' ? label : '', size };
    } catch {
        return null;
    }
}
