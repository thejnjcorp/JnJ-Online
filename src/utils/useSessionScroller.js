import { useCallback, useEffect, useRef, useState } from 'react';

// Which of the session cards a sideways-scrolling row is showing right now, and the ways to move it:
// to a session, or a screenful either way. `ids` are the sessions in the order the cards are laid out.
// Where nothing has a size (before the first layout, or in a test) every session counts as showing.
export function useSessionScroller(ids) {
    const scroller = useRef(null);
    const cards = useRef(new Map());
    const [range, setRange] = useState({ first: 0, last: Math.max(ids.length - 1, 0), atStart: true, atEnd: true });
    const idsKey = ids.join('|');

    const measure = useCallback(() => {
        const el = scroller.current;
        if (!el || el.clientWidth === 0) return;
        const left = el.scrollLeft;
        const right = left + el.clientWidth;
        let first = -1;
        let last = -1;
        ids.forEach((id, index) => {
            const card = cards.current.get(id);
            if (!card) return;
            if (card.offsetLeft + card.offsetWidth > left + 1 && card.offsetLeft < right - 1) {
                if (first < 0) first = index;
                last = index;
            }
        });
        const next = { first: Math.max(first, 0), last: Math.max(last, 0), atStart: left <= 1, atEnd: right >= el.scrollWidth - 1 };
        setRange(previous => (previous.first === next.first && previous.last === next.last && previous.atStart === next.atStart && previous.atEnd === next.atEnd ? previous : next));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idsKey]);

    useEffect(() => {
        measure();
        const el = scroller.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, [measure]);

    const register = useCallback(id => node => {
        if (node) cards.current.set(id, node);
        else cards.current.delete(id);
    }, []);

    const scrollToSession = useCallback((id, behavior = 'smooth') => {
        const el = scroller.current;
        const card = cards.current.get(id);
        if (el && card) el.scrollTo?.({ left: Math.max(0, card.offsetLeft - 16), behavior });
    }, []);

    const scrollByPage = useCallback(direction => {
        const el = scroller.current;
        if (el) el.scrollBy?.({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
    }, []);

    return { scroller, register, range, measure, scrollToSession, scrollByPage };
}
