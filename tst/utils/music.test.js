import { SEEK_COOLDOWN_MS, SYNC_TOLERANCE, correction, expectedPosition, parseVideoId, pausedMusic, resumedMusic, startedMusic, withLoop } from '../../src/utils/music';

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
