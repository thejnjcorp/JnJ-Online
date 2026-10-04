import { useEffect, useRef, useState } from 'react';
import { PLAYER_STATE, loadYouTubeApi } from '../utils/youtubePlayer';
import { correction, expectedPosition } from '../utils/music';
import '../styles/Music.scss';

const CHECK_EVERY_MS = 1000;
// After the player says it is playing, give it a moment to report where it is before checking.
const SETTLE_MS = 600;

// YouTube's reasons a video will not play in an embedded player.
const ERROR_TEXT = {
    100: "That video can't be found.",
    101: "That video's owner doesn't allow it to be played here.",
    150: "That video's owner doesn't allow it to be played here.",
};

// The party's song, in YouTube's own player (kept in view - YouTube asks that - and without
// the controls, so nobody scrubs out of step). It plays wherever the song is by now, and keeps
// it so: every second it looks at where its player is against where the song should be, and
// jumps if it is more than a couple of seconds out. That is also what puts a player right
// after an ad: the ad holds it back, and the moment the video starts it is brought to where
// everyone else is (see `correction` in music.js).
//
// `music` is what is saved (see music.js); `volume` is 0-100 and `muted` is this player's own.
// `onTitle(title)` is told what is playing.
export function MusicPlayer({ music, volume = 100, muted = false, onTitle }) {
    const hostRef = useRef(null);
    const playerRef = useRef(null);
    const readyRef = useRef(false);
    const durationRef = useRef(0);
    const lastSeekRef = useRef(0);
    const musicRef = useRef(music);
    musicRef.current = music;
    const onTitleRef = useRef(onTitle);
    onTitleRef.current = onTitle;
    // the browser would not start the sound without a tap, or YouTube would not play the video
    const [blocked, setBlocked] = useState(false);
    const [error, setError] = useState('');

    const where = () => expectedPosition(musicRef.current, Date.now(), durationRef.current);

    // Put the player where the song is and playing or paused as it is. A different video is loaded;
    // the same one is only jumped if it is out of step, so that, say, a song looping on does not stutter.
    function apply() {
        const player = playerRef.current;
        const song = musicRef.current;
        if (!player || !readyRef.current || !song) return;
        if (player.getVideoData?.().video_id !== song.videoId) {
            setError('');
            durationRef.current = 0;
            lastSeekRef.current = Date.now();
            if (song.state === 'playing') player.loadVideoById({ videoId: song.videoId, startSeconds: where() });
            else player.cueVideoById({ videoId: song.videoId, startSeconds: song.position || 0 });
            return;
        }
        const target = correction({ expected: where(), actual: player.getCurrentTime(), now: Date.now() });
        if (target !== null) {
            player.seekTo(target, true);
            lastSeekRef.current = Date.now();
        }
        if (song.state === 'playing') player.playVideo();
        else player.pauseVideo();
    }

    // Is the player behind (or ahead of) the song? Jump to where it is, unless it has only just jumped.
    function check(lastSeekAt = lastSeekRef.current) {
        const player = playerRef.current;
        const song = musicRef.current;
        if (!player || !readyRef.current || song?.state !== 'playing' || player.getPlayerState() !== PLAYER_STATE.PLAYING) return;
        const target = correction({ expected: where(), actual: player.getCurrentTime(), now: Date.now(), lastSeekAt });
        if (target === null) return;
        player.seekTo(target, true);
        lastSeekRef.current = Date.now();
    }

    function handleState(state) {
        const player = playerRef.current;
        if (state === PLAYER_STATE.PLAYING) {
            setBlocked(false);
            const video = player.getVideoData?.() || {};
            // while an ad plays the player may report the ad's length, so only a length that is the song's is kept
            if (video.video_id === musicRef.current?.videoId && player.getDuration() > 0) durationRef.current = player.getDuration();
            if (video.title) onTitleRef.current?.(video.title);
            // it may have just come out of an ad, or a stall: straight to where the song is
            setTimeout(() => check(0), SETTLE_MS);
        } else if (state === PLAYER_STATE.ENDED && musicRef.current?.loop && musicRef.current.state === 'playing') {
            player.seekTo(where(), true);
            player.playVideo();
        }
    }

    // the player itself, made once
    useEffect(() => {
        let cancelled = false;
        let player = null;
        loadYouTubeApi().then(YT => {
            if (cancelled || !hostRef.current) return;
            const host = document.createElement('div');
            hostRef.current.append(host);
            player = new YT.Player(host, {
                width: '100%',
                height: '100%',
                videoId: musicRef.current.videoId,
                playerVars: { controls: 0, disablekb: 1, fs: 0, modestbranding: 1, rel: 0, playsinline: 1 },
                events: {
                    onReady: () => { readyRef.current = true; apply(); },
                    onStateChange: event => handleState(event.data),
                    onAutoplayBlocked: () => setBlocked(true),
                    onError: event => setError(ERROR_TEXT[event.data] || "That video can't be played here."),
                },
            });
            playerRef.current = player;
        }).catch(() => setError("Couldn't load YouTube's player."));
        return () => {
            cancelled = true;
            readyRef.current = false;
            playerRef.current = null;
            try { player?.destroy(); } catch { /* the frame is already gone */ }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // whenever the song changes (or is started over, paused, resumed)
    useEffect(apply, [music.videoId, music.state, music.anchorAt, music.position, music.loop]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const player = playerRef.current;
        if (!player || !readyRef.current) return;
        player.setVolume(volume);
        if (muted) player.mute();
        else player.unMute();
    }, [volume, muted, music.videoId]);

    // keep in step as the song goes on, and start it again if the player has let go of it
    useEffect(() => {
        const timer = setInterval(() => {
            const player = playerRef.current;
            if (!player || !readyRef.current || musicRef.current?.state !== 'playing') return;
            if (player.getPlayerState() === PLAYER_STATE.PLAYING) check();
            else if (!blocked && [PLAYER_STATE.PAUSED, PLAYER_STATE.CUED].includes(player.getPlayerState())) player.playVideo();
        }, CHECK_EVERY_MS);
        return () => clearInterval(timer);
    }, [blocked]); // eslint-disable-line react-hooks/exhaustive-deps

    return <div className="MusicPlayer">
        <div className="MusicPlayer-frame" ref={hostRef}/>
        {error && <p className="MusicPlayer-error" role="alert">{error}</p>}
        {blocked && !error && <button type="button" className="MusicPlayer-join" onClick={() => { setBlocked(false); apply(); playerRef.current?.playVideo(); }}>Tap to join the music</button>}
    </div>;
}
