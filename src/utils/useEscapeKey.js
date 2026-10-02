import { useEffect } from 'react';

// Calls `onEscape` when Escape is pressed, for as long as the component is on screen -
// how a popup closes from the keyboard. Listens on the document rather than on the popup
// itself, so it works wherever focus happens to be (a popup is not a place focus is
// guaranteed to stay) and the popup's own element needs no key handler.
export function useEscapeKey(onEscape) {
    useEffect(() => {
        const onKeyDown = event => {
            if (event.key === 'Escape') onEscape();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onEscape]);
}
