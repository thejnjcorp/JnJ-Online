import { useMemo, useState } from 'react';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { MAX_IMAGE_TOKENS, copyImageToken, moveImageToken, newImageToken, removeImageToken, resizeImageToken, validImageTokens } from './mapImageTokens';

// A map's image tokens: what is saved on it, and - for someone who can edit the map
// (the director, the same people who can draw on it) - the means to add, move,
// resize, copy and remove them. Everyone else just sees them.
//
// Each is a small write to the map doc's `image_tokens` list, which reaches
// players through the map doc that is already listened to for the combat map
// (useCampaignMaps). These are ordinary writes, so the map shows a change at
// once, before the server has confirmed it.
//
// Where a token goes depends on the map's shape, so the methods that place one
// take the map's `aspect` (its height over its width).
export function useMapImageTokens(map, userId) {
    const canEdit = Boolean(userId && map?.map_id && map.canWrite?.includes(userId));
    const [selectedId, setSelectedId] = useState(null);
    const tokens = useMemo(() => validImageTokens(map?.image_tokens), [map?.image_tokens]);
    // a token that has been removed (by anyone) is no longer selected
    const selected = tokens.some(token => token.id === selectedId) ? selectedId : null;

    const save = changes => updateDoc(doc(db, 'maps', map.map_id), changes).catch(error => alert("Couldn't save the image token: " + error.message));

    return {
        canEdit,
        tokens,
        full: tokens.length >= MAX_IMAGE_TOKENS,
        selected,
        select: setSelectedId,
        // put a new one in the middle of the map, selected, ready to be dragged
        add: (fields, aspect) => {
            if (!canEdit || tokens.length >= MAX_IMAGE_TOKENS) return null;
            const token = newImageToken(fields, { x: 0.5, y: aspect / 2 });
            save({ image_tokens: arrayUnion(token) });
            setSelectedId(token.id);
            return token.id;
        },
        move: (id, point, aspect) => save({ image_tokens: moveImageToken(tokens, id, point, aspect) }),
        resize: (id, size) => save({ image_tokens: resizeImageToken(tokens, id, size) }),
        remove: id => {
            setSelectedId(null);
            return save({ image_tokens: removeImageToken(tokens, id) });
        },
        copy: (id, aspect) => {
            if (tokens.length >= MAX_IMAGE_TOKENS) return;
            const copied = copyImageToken(tokens, id, aspect);
            if (!copied.id) return;
            save({ image_tokens: copied.tokens });
            setSelectedId(copied.id);
        },
    };
}
