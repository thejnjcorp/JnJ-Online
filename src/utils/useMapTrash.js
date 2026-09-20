import { useMemo, useRef, useState } from 'react';

// The state behind a map's trash can (see MapTrashCan.js): whether a token that can
// be thrown away is being carried (so the can shows), and whether it is over the
// can (so the can lights up). The layers that carry tokens get `trash` - they tell
// it when a drag starts and ends, and ask it whether the pointer is over the can -
// and the can gets `ref`, `carrying` and `hot`.
export function useMapTrash() {
    const ref = useRef(null);
    const [state, setState] = useState({ carrying: false, hot: false });

    const trash = useMemo(() => ({
        carry: carrying => setState(current => (current.carrying === carrying ? current : { carrying, hot: carrying ? current.hot : false })),
        hot: hot => setState(current => (current.hot === hot ? current : { ...current, hot })),
        // whether a point (a pointer's clientX, clientY) is over the can, which only has a size while it is showing
        hit: (x, y) => {
            const box = ref.current?.getBoundingClientRect();
            return Boolean(box && box.width > 0 && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom);
        },
    }), []);

    return { ref, trash, carrying: state.carrying, hot: state.hot };
}
