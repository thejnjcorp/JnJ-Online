// Music for the whole party. The director picks a YouTube video and plays, pauses or stops it;
// what is saved (on the campaign's party doc, as `music`) is only what everyone needs to
// play the same thing at the same place:
//
//   { videoId, state: 'playing' | 'paused', position, anchorAt, loop }
//
// `position` is where in the video it was (in seconds) at `anchorAt` (the director's clock, in
// ms). A playing song is therefore `position` plus the time since `anchorAt`, which each player
// works out for themselves - nothing is streamed, and nobody has to keep writing as the song
// goes on. Stopped is no `music` at all.
//
// Each player's own YouTube player is its own: an ad can hold one back for half a minute, a
// connection can stutter. `correction` says when one has fallen out of step with where the
// song is by now, so it can jump to it (see MusicPlayer.js) - in particular the moment it
// gets past an ad.

// Further out of step than this (seconds) is worth jumping for; less is not noticed.
export const SYNC_TOLERANCE = 2;
// After jumping, wait this long (ms) before judging the player again: it needs a moment to arrive.
export const SEEK_COOLDOWN_MS = 3000;

const VIDEO_ID = /^[\w-]{11}$/;

// The video id in whatever was pasted: a youtube.com or music.youtube.com watch link, a youtu.be
// link, an embed or shorts link, or the id itself. Null when there is none.
export function parseVideoId(input) {
    const text = String(input || '').trim();
    if (VIDEO_ID.test(text)) return text;
    let url;
    try {
        url = new URL(text.includes('://') ? text : `https://${text}`);
    } catch {
        return null;
    }
    const host = url.hostname.replace(/^(www|m|music)\./, '');
    let id = null;
    if (host === 'youtu.be') id = url.pathname.split('/')[1];
    else if (host === 'youtube.com') id = url.searchParams.get('v') || (/^\/(embed|shorts|live)\//.test(url.pathname) ? url.pathname.split('/')[2] : null);
    return VIDEO_ID.test(id || '') ? id : null;
}

// Where in the video it should be now. `duration` (seconds, if known) is what lets a looping
// song come round again, and stops one that does not loop at its end.
export function expectedPosition(music, now, duration = 0) {
    if (!music) return 0;
    const elapsed = music.state === 'playing' ? Math.max(0, now - music.anchorAt) / 1000 : 0;
    const position = (Number(music.position) || 0) + elapsed;
    if (!Number.isFinite(duration) || duration <= 0) return position;
    return music.loop ? position % duration : Math.min(position, duration);
}

export const startedMusic = (videoId, { loop = true } = {}, now = Date.now()) => ({ videoId, state: 'playing', position: 0, anchorAt: now, loop });

export function pausedMusic(music, now, duration = 0) {
    if (music?.state !== 'playing') return music;
    return { ...music, state: 'paused', position: expectedPosition(music, now, duration), anchorAt: now };
}

export function resumedMusic(music, now) {
    if (music?.state !== 'paused') return music;
    return { ...music, state: 'playing', anchorAt: now };
}

// The same song, looping or not.
export const withLoop = (music, loop) => (music ? { ...music, loop } : music);

// Where to jump to, if this player should: it is more than the tolerance away from where the
// song is, and has not just jumped (`lastSeekAt`, ms). Null when it is close enough, or when
// either position is not known yet.
export function correction({ expected, actual, now, lastSeekAt = 0 }) {
    if (!Number.isFinite(expected) || !Number.isFinite(actual)) return null;
    if (now - lastSeekAt < SEEK_COOLDOWN_MS) return null;
    return Math.abs(expected - actual) > SYNC_TOLERANCE ? expected : null;
}
