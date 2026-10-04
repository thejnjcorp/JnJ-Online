import { SEEK_COOLDOWN_MS, SYNC_TOLERANCE, correction, cueLink, cueRunsItself, expectedPosition, musicForCue, newMusicCue, parseVideoId, pausedMusic, resumedMusic, startedMusic, withLoop } from '../../src/utils/music';

const ID = 'dQw4w9WgXcQ';

describe('parseVideoId', () => {
    test.each([
        [`https://www.youtube.com/watch?v=${ID}`],
        [`https://youtube.com/watch?v=${ID}&t=42s&list=abc`],
        [`https://music.youtube.com/watch?v=${ID}&si=xyz`],
        [`https://m.youtube.com/watch?v=${ID}`],
        [`https://youtu.be/${ID}?si=abc`],
        [`https://www.youtube.com/embed/${ID}`],
        [`https://www.youtube.com/shorts/${ID}`],
        [`youtube.com/watch?v=${ID}`],
        [`  ${ID}  `],
    ])('finds the video in %s', input => {
        expect(parseVideoId(input)).toBe(ID);
    });

    test.each([[''], [undefined], ['hello there'], ['https://example.com/watch?v=' + ID], ['https://www.youtube.com/watch?v=short'], ['https://www.youtube.com/playlist?list=PL123']])('finds none in %p', input => {
        expect(parseVideoId(input)).toBeNull();
    });
});

describe('expectedPosition', () => {
    test('a playing song is where it was plus the time since, and a paused one stays where it was', () => {
        expect(expectedPosition({ state: 'playing', position: 10, anchorAt: 1000 }, 31000)).toBe(40);
        expect(expectedPosition({ state: 'paused', position: 10, anchorAt: 1000 }, 99000)).toBe(10);
    });

    test('is the start for no music, and never before where it was (a clock a little behind)', () => {
        expect(expectedPosition(null, 5000)).toBe(0);
        expect(expectedPosition({ state: 'playing', position: 10, anchorAt: 5000 }, 4000)).toBe(10);
    });

    test('a looping song comes round again, and one that does not loop stops at its end', () => {
        const song = { state: 'playing', position: 0, anchorAt: 0, loop: true };
        expect(expectedPosition(song, 250000, 100)).toBe(50);
        expect(expectedPosition({ ...song, loop: false }, 250000, 100)).toBe(100);
        expect(expectedPosition(song, 250000)).toBe(250);
    });
});

describe('what the director does', () => {
    test('starting a song begins it at the start, looping unless told not to', () => {
        expect(startedMusic(ID, {}, 5)).toEqual({ videoId: ID, state: 'playing', position: 0, anchorAt: 5, loop: true });
        expect(startedMusic(ID, { loop: false }, 5).loop).toBe(false);
    });

    test('pausing keeps where it had got to, and resuming goes on from there', () => {
        const song = startedMusic(ID, {}, 1000);
        const paused = pausedMusic(song, 31000);
        expect(paused).toMatchObject({ state: 'paused', position: 30, anchorAt: 31000 });
        const resumed = resumedMusic(paused, 100000);
        expect(resumed).toMatchObject({ state: 'playing', position: 30, anchorAt: 100000 });
        expect(expectedPosition(resumed, 110000)).toBe(40);
    });

    test('pausing a paused song, or resuming a playing one, or neither with no song, changes nothing', () => {
        const song = startedMusic(ID, {}, 0);
        const paused = pausedMusic(song, 1000);
        expect(pausedMusic(paused, 2000)).toBe(paused);
        expect(resumedMusic(song, 2000)).toBe(song);
        expect(pausedMusic(null, 1)).toBeNull();
        expect(resumedMusic(null, 1)).toBeNull();
    });

    test('looping can be switched on and off', () => {
        expect(withLoop(startedMusic(ID, {}, 0), false).loop).toBe(false);
        expect(withLoop(null, true)).toBeNull();
    });
});

describe('correction', () => {
    const now = 100000;

    test('is where the song is, when a player is further out than the tolerance in either direction', () => {
        expect(correction({ expected: 60, actual: 0, now })).toBe(60);
        expect(correction({ expected: 60, actual: 60 + SYNC_TOLERANCE + 1, now })).toBe(60);
    });

    test('is nothing for a player that is close enough', () => {
        expect(correction({ expected: 60, actual: 61.5, now })).toBeNull();
        expect(correction({ expected: 60, actual: 60 - SYNC_TOLERANCE, now })).toBeNull();
    });

    test('lets a player that has just jumped arrive before it is judged again', () => {
        expect(correction({ expected: 60, actual: 0, now, lastSeekAt: now - SEEK_COOLDOWN_MS + 1 })).toBeNull();
        expect(correction({ expected: 60, actual: 0, now, lastSeekAt: now - SEEK_COOLDOWN_MS })).toBe(60);
    });

    test('is nothing when either position is not known yet', () => {
        expect(correction({ expected: 60, actual: undefined, now })).toBeNull();
        expect(correction({ expected: NaN, actual: 5, now })).toBeNull();
    });
});

describe('music cues on a beat', () => {
    const play = { action: 'play', videoId: ID, loop: true, auto: true };

    test('a new cue plays a song, looping, by itself - or stops the music, by itself', () => {
        expect(newMusicCue('play')).toEqual({ action: 'play', videoId: '', loop: true, auto: true });
        expect(newMusicCue('stop')).toEqual({ action: 'stop', auto: true });
    });

    test('the link of a cue is that of its song, and nothing before there is one', () => {
        expect(cueLink(play)).toBe(`https://youtu.be/${ID}`);
        expect(cueLink({ action: 'play', videoId: '' })).toBe('');
        expect(cueLink(undefined)).toBe('');
        expect(parseVideoId(cueLink(play))).toBe(ID);
    });

    test('a cue runs itself unless told not to, and there is nothing to run without one', () => {
        expect(cueRunsItself(play)).toBe(true);
        expect(cueRunsItself({ action: 'stop' })).toBe(true);
        expect(cueRunsItself({ ...play, auto: false })).toBe(false);
        expect(cueRunsItself(undefined)).toBe(false);
    });

    test('playing starts the song from the start, looping unless the cue says not to', () => {
        expect(musicForCue(play, null, 5)).toEqual({ videoId: ID, state: 'playing', position: 0, anchorAt: 5, loop: true });
        expect(musicForCue({ ...play, loop: false }, null, 5).loop).toBe(false);
    });

    test('playing replaces another song, and starts one that was paused over', () => {
        expect(musicForCue(play, { videoId: 'zzzzzzzzzzz', state: 'playing' }, 5).videoId).toBe(ID);
        expect(musicForCue(play, { videoId: ID, state: 'paused', position: 40 }, 5)).toMatchObject({ state: 'playing', position: 0 });
    });

    test('playing the song that is already playing leaves it going, rather than starting it over', () => {
        const going = { videoId: ID, state: 'playing', position: 0, anchorAt: 1, loop: true };
        expect(musicForCue(play, going, 5)).toBe(going);
    });

    test('stopping stops whatever is playing', () => {
        expect(musicForCue({ action: 'stop' }, { videoId: ID, state: 'playing' }, 5)).toBeNull();
    });

    test('a cue with no song chosen changes nothing', () => {
        const going = { videoId: ID, state: 'playing' };
        expect(musicForCue({ action: 'play', videoId: '' }, going, 5)).toBe(going);
        expect(musicForCue({ action: 'play', videoId: '' }, undefined, 5)).toBeNull();
    });
});
