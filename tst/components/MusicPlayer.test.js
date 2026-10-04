// A stand-in for YouTube's player that records what it is told and lets the test say what it is up to.
const mockPlayers = [];
jest.mock('../../src/utils/youtubePlayer', () => {
    class FakePlayer {
        constructor(host, options) {
            this.options = options;
            this.state = -1;
            this.time = 0;
            this.duration = 200;
            this.video = { video_id: options.videoId, title: 'Tavern Theme' };
            this.calls = [];
            this.destroyed = false;
            mockPlayers.push(this);
        }
        getVideoData() { return this.video; }
        getCurrentTime() { return this.time; }
        getPlayerState() { return this.state; }
        getDuration() { return this.duration; }
        seekTo(seconds) { this.calls.push(['seekTo', seconds]); this.time = seconds; }
        playVideo() { this.calls.push(['play']); }
        pauseVideo() { this.calls.push(['pause']); }
        loadVideoById(options) { this.calls.push(['load', options]); this.video = { video_id: options.videoId }; }
        cueVideoById(options) { this.calls.push(['cue', options]); this.video = { video_id: options.videoId }; }
        setVolume(volume) { this.calls.push(['volume', volume]); }
        mute() { this.calls.push(['mute']); }
        unMute() { this.calls.push(['unmute']); }
        destroy() { this.destroyed = true; }
    }
    return {
        ...jest.requireActual('../../src/utils/youtubePlayer'),
        loadYouTubeApi: () => Promise.resolve({ Player: FakePlayer }),
    };
});

// eslint-disable-next-line import/first
import { act, render, screen } from '@testing-library/react';
// eslint-disable-next-line import/first
import { MusicPlayer } from '../../src/components/MusicPlayer';
// eslint-disable-next-line import/first
import { PLAYER_STATE } from '../../src/utils/youtubePlayer';

const NOW = 1_000_000;
// started 90 seconds ago, 10 seconds into the song when it was: so it is 100 seconds in now
const song = (fields = {}) => ({ videoId: 'abcdefghijk', state: 'playing', position: 10, anchorAt: NOW - 90000, loop: true, ...fields });
const last = () => mockPlayers.at(-1);
const calls = name => last().calls.filter(call => call[0] === name);
const seeks = () => calls('seekTo').map(call => call[1]);

async function show(music, props = {}) {
    const view = render(<MusicPlayer music={music} {...props}/>);
    await act(async () => {});
    return view;
}
const ready = () => act(() => last().options.events.onReady());
const stateIs = state => act(() => { last().state = state; last().options.events.onStateChange({ data: state }); });
const tick = ms => act(() => jest.advanceTimersByTime(ms));

beforeEach(() => {
    mockPlayers.length = 0;
    jest.useFakeTimers().setSystemTime(NOW);
});
afterEach(() => jest.useRealTimers());

describe('MusicPlayer', () => {
    test('makes a player for the video, without its controls', async () => {
        await show(song());
        expect(last().options.videoId).toBe('abcdefghijk');
        expect(last().options.playerVars).toMatchObject({ controls: 0 });
    });

    test('once ready, plays from where the song is by now, not from the start', async () => {
        await show(song());
        await ready();
        expect(seeks()).toEqual([100]);
        expect(calls('play')).toHaveLength(1);
    });

    test('a paused song is held where it was, not played', async () => {
        await show(song({ state: 'paused', position: 33 }));
        await ready();
        expect(seeks()).toEqual([33]);
        expect(calls('pause')).toHaveLength(1);
        expect(calls('play')).toHaveLength(0);
    });

    test('reports what is playing', async () => {
        const onTitle = jest.fn();
        await show(song(), { onTitle });
        await ready();
        await stateIs(PLAYER_STATE.PLAYING);
        expect(onTitle).toHaveBeenCalledWith('Tavern Theme');
    });

    describe('keeping in step', () => {
        // where the song is, in seconds
        const songAt = () => 100 + (Date.now() - NOW) / 1000;
        // playing in step for a few seconds, so it has had time to arrive after its first jump
        const playingInStep = async () => {
            await show(song());
            await ready();
            last().time = songAt();
            await stateIs(PLAYER_STATE.PLAYING);
            for (let second = 0; second < 4; second++) {
                last().time = songAt();
                await tick(1000);
            }
            last().calls.length = 0;
        };

        test('leaves a player alone that is close enough', async () => {
            await playingInStep();
            last().time = songAt() + 1.2; // a second or two off: not worth jumping for
            await tick(1000);
            expect(seeks()).toEqual([]);
        });

        test('jumps a player that has fallen behind to where the song is', async () => {
            await playingInStep();
            last().time = 40; // behind by about a minute
            await tick(1000);
            expect(seeks()).toEqual([songAt()]);
        });

        test('does not keep jumping while it arrives', async () => {
            await playingInStep();
            last().time = 40;
            await tick(1000); // jumps
            last().time = 40; // has not got there yet
            await tick(1000);
            await tick(1000);
            expect(seeks()).toHaveLength(1);
            last().time = 40;
            await tick(2000); // and judged again once it has had its time
            expect(seeks()).toHaveLength(2);
        });

        test('a player held back by an ad is put right the moment the video starts', async () => {
            await show(song());
            await ready();
            // the ad plays (the player says it is playing, but not where the song is), then the video begins at its start
            await stateIs(PLAYER_STATE.PLAYING);
            await tick(1000);
            last().calls.length = 0;
            last().time = 0;
            await stateIs(PLAYER_STATE.PLAYING);
            await tick(700);
            expect(seeks()).toEqual([expect.closeTo(102, 0)]);
        });

        test('does not judge a player that is not playing yet - an ad, a buffering - by where it says it is', async () => {
            await show(song());
            await ready();
            last().calls.length = 0;
            last().state = PLAYER_STATE.BUFFERING;
            last().time = 0;
            await tick(1000);
            expect(seeks()).toEqual([]);
        });

        test('starts a player again that has stopped though the song is playing', async () => {
            await playingInStep();
            last().state = PLAYER_STATE.PAUSED;
            await tick(1000);
            expect(calls('play')).toHaveLength(1);
        });

        test('goes round again at the end of a looping song, and stays at the end of one that does not loop', async () => {
            await show(song());
            await ready();
            last().calls.length = 0;
            await stateIs(PLAYER_STATE.ENDED);
            expect(calls('play')).toHaveLength(1);
            expect(seeks()).toHaveLength(1);
            last().calls.length = 0;
        });

        test('a song that does not loop is left alone when it ends', async () => {
            await show(song({ loop: false }));
            await ready();
            last().calls.length = 0;
            await stateIs(PLAYER_STATE.ENDED);
            expect(last().calls).toEqual([]);
        });
    });

    describe('when the director changes the music', () => {
        test('pausing holds it where it was', async () => {
            const { rerender } = await show(song());
            await ready();
            last().time = 100;
            last().calls.length = 0;
            rerender(<MusicPlayer music={song({ state: 'paused', position: 100, anchorAt: NOW })}/>);
            expect(calls('pause')).toHaveLength(1);
        });

        test('resuming plays on from there without a jump when it is already in step', async () => {
            const { rerender } = await show(song({ state: 'paused', position: 100, anchorAt: NOW }));
            await ready();
            last().time = 100;
            last().calls.length = 0;
            rerender(<MusicPlayer music={song({ state: 'playing', position: 100, anchorAt: NOW })}/>);
            expect(calls('play')).toHaveLength(1);
            expect(seeks()).toEqual([]);
        });

        test('another video is loaded at where it is', async () => {
            const { rerender } = await show(song());
            await ready();
            rerender(<MusicPlayer music={song({ videoId: 'zzzzzzzzzzz', position: 0, anchorAt: NOW - 5000 })}/>);
            expect(calls('load')).toEqual([['load', { videoId: 'zzzzzzzzzzz', startSeconds: 5 }]]);
        });

        test('the same song started over goes back to its start', async () => {
            const { rerender } = await show(song());
            await ready();
            last().time = 100;
            last().calls.length = 0;
            rerender(<MusicPlayer music={song({ position: 0, anchorAt: NOW })}/>);
            expect(seeks()).toEqual([0]);
        });
    });

    describe('this player\'s own settings', () => {
        test('its volume and mute are applied', async () => {
            const { rerender } = await show(song(), { volume: 35 });
            await ready();
            rerender(<MusicPlayer music={song()} volume={35} muted/>);
            expect(calls('volume').at(-1)).toEqual(['volume', 35]);
            expect(calls('mute')).toHaveLength(1);
            rerender(<MusicPlayer music={song()} volume={35} muted={false}/>);
            expect(calls('unmute')).toHaveLength(1);
        });
    });

    describe('when it cannot play', () => {
        test('a browser that will not start the sound without a tap asks for one, which starts it', async () => {
            await show(song());
            await ready();
            await act(() => last().options.events.onAutoplayBlocked());
            last().calls.length = 0;
            act(() => screen.getByRole('button', { name: 'Tap to join the music' }).click());
            expect(calls('play').length).toBeGreaterThan(0);
            expect(screen.queryByRole('button', { name: 'Tap to join the music' })).not.toBeInTheDocument();
        });

        test('the tap is not asked for once it is playing', async () => {
            await show(song());
            await ready();
            await act(() => last().options.events.onAutoplayBlocked());
            await stateIs(PLAYER_STATE.PLAYING);
            expect(screen.queryByRole('button', { name: 'Tap to join the music' })).not.toBeInTheDocument();
        });

        test('a video that cannot be embedded says so', async () => {
            await show(song());
            await ready();
            await act(() => last().options.events.onError({ data: 101 }));
            expect(screen.getByRole('alert')).toHaveTextContent("owner doesn't allow it");
        });
    });

    test('lets go of the player when it goes', async () => {
        const { unmount } = await show(song());
        const player = last();
        unmount();
        expect(player.destroyed).toBe(true);
    });
});
