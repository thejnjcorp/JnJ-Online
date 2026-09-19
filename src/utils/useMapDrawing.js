import { useMemo, useState } from 'react';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { COLORS, SIZES, drawingFullness, validStrokes } from './mapDrawing';

// A map's drawing: the strokes saved on it, and - for someone who can edit the
// map (the director) - the tools to add to it. Everyone else just sees the strokes.
//
// Each finished stroke is one small write, added to the map doc's `strokes`
// list; undo, erase and clear rewrite the list. The map doc is already listened
// to for the combat map (useCampaignMaps), so a stroke reaches players through
// that with nothing more to subscribe to - when the pen is lifted, not while it
// moves, since Firestore can't take a write for every point.
export function useMapDrawing(map, userId) {
    const canDraw = Boolean(userId && map?.map_id && map.canWrite?.includes(userId));
    const [active, setActive] = useState(false);
    const [tool, setTool] = useState('pen');
    const [color, setColor] = useState(COLORS[0].value);
    const [size, setSize] = useState(SIZES[1].value);
    const strokes = useMemo(() => validStrokes(map?.strokes), [map?.strokes]);
    const fullness = drawingFullness(strokes);

    const mapDoc = () => doc(db, 'maps', map.map_id);
    const save = changes => updateDoc(mapDoc(), changes).catch(error => alert("Couldn't save the drawing: " + error.message));

    return {
        canDraw,
        strokes,
        fullness,
        full: fullness >= 1,
        drawing: canDraw && active,
        active,
        setActive,
        tool,
        setTool,
        color,
        setColor,
        size,
        setSize,
        addStroke: stroke => save({ strokes: arrayUnion(stroke) }),
        eraseStrokes: ids => save({ strokes: strokes.filter(stroke => !ids.includes(stroke.id)) }),
        undo: () => strokes.length > 0 && save({ strokes: strokes.slice(0, -1) }),
        clear: () => {
            if (strokes.length === 0 || !window.confirm('Clear everything drawn on this map? Everyone will stop seeing it.')) return;
            save({ strokes: [] });
        },
    };
}
