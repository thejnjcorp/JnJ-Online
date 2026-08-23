import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = '(max-width: 640px)';

// The character page's mobile layout (design/character-page-v2) needs actual
// DOM differences in a few places - a fixed bottom tab bar instead of a pill
// row, Skills & Flaws as a slide-up drawer instead of a persistent sidebar,
// a restructured Inventory - not just a CSS reflow of the same markup. This
// is the one query those places share.
export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_BREAKPOINT).matches);

    useEffect(() => {
        const mediaQueryList = window.matchMedia(MOBILE_BREAKPOINT);
        const handleChange = (event) => setIsMobile(event.matches);
        mediaQueryList.addEventListener('change', handleChange);
        return () => mediaQueryList.removeEventListener('change', handleChange);
    }, []);

    return isMobile;
}
