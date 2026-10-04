// YouTube's own embedded player, through its IFrame API (https://developers.google.com/youtube/iframe_api_reference).
// The API is a script that is fetched once, the first time anything wants a player.

export const PLAYER_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

let loading = null;

export function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (!loading) {
        loading = new Promise((resolve, reject) => {
            const previous = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                previous?.();
                resolve(window.YT);
            };
            const script = document.createElement('script');
            script.src = 'https://www.youtube.com/iframe_api';
            script.async = true;
            script.onerror = () => {
                loading = null;
                reject(new Error("Couldn't load YouTube's player"));
            };
            document.head.append(script);
        });
    }
    return loading;
}
