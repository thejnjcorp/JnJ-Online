let mockParty = {};
jest.mock('../../src/utils/useParty', () => ({ useParty: () => ({ party: mockParty, loaded: true }) }));
const mockChangeMusic = jest.fn();
jest.mock('../../src/utils/party', () => ({ changeMusic: (...args) => mockChangeMusic(...args) }));
const mockPlayerProps = [];
jest.mock('../../src/components/MusicPlayer', () => ({
    MusicPlayer: props => {
        mockPlayerProps.push(props);
        return <div>Player-stub:{props.music.videoId}:{props.volume}:{String(props.muted)}<button type="button" onClick={() => props.onTitle('Tavern Theme')}>Name it</button></div>;
    },
}));

// eslint-disable-next-line import/first
import { render, screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/first
import { MusicDock } from '../../src/components/MusicDock';

const ID = 'dQw4w9WgXcQ';
const playing = (fields = {}) => ({ videoId: ID, state: 'playing', position: 0, anchorAt: 1000, loop: true, ...fields });
const lastPlayer = () => mockPlayerProps.at(-1);
// what a change the dock asked for would make of the music as it stands
const outcome = (current, call = mockChangeMusic.mock.calls.at(-1)) => call[1](current);

beforeEach(() => {
    mockParty = {};
    mockPlayerProps.length = 0;
    mockChangeMusic.mockReset();
    mockChangeMusic.mockResolvedValue(undefined);
    window.localStorage.clear();
    window.alert = jest.fn();
});
afterEach(() => { delete window.alert; });

describe('MusicDock', () => {
    describe('for a player', () => {
        test('shows nothing while there is no music', () => {
            const { container } = render(<MusicDock campaignId="camp-1"/>);
            expect(container).toBeEmptyDOMElement();
        });

        test('plays what the director is playing, and offers no way to change it', () => {
            mockParty = { music: playing() };
            render(<MusicDock campaignId="camp-1"/>);
            expect(screen.getByText(`Player-stub:${ID}:60:false`)).toBeInTheDocument();
            expect(screen.queryByLabelText('YouTube link')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: /for everyone/ })).not.toBeInTheDocument();
        });

        test('says what is playing, and when it is paused', () => {
            mockParty = { music: playing({ state: 'paused' }) };
            render(<MusicDock campaignId="camp-1"/>);
            fireEvent.click(screen.getByRole('button', { name: 'Name it' }));
            expect(screen.getByText('Tavern Theme · paused')).toBeInTheDocument();
        });

        test('the volume is their own, and is kept for next time', () => {
            mockParty = { music: playing() };
            const { unmount } = render(<MusicDock campaignId="camp-1"/>);
            fireEvent.change(screen.getByLabelText('Music volume'), { target: { value: '25' } });
            expect(lastPlayer().volume).toBe(25);
            unmount();
            render(<MusicDock campaignId="camp-1"/>);
            expect(lastPlayer().volume).toBe(25);
        });

        test('can mute it for themselves', () => {
            mockParty = { music: playing() };
            render(<MusicDock campaignId="camp-1"/>);
            fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
            expect(lastPlayer().muted).toBe(true);
            fireEvent.click(screen.getByRole('button', { name: 'Unmute' }));
            expect(lastPlayer().muted).toBe(false);
        });

        test('can leave the music and rejoin it, without it changing for anyone else', () => {
            mockParty = { music: playing() };
            render(<MusicDock campaignId="camp-1"/>);
            fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
            expect(screen.queryByText(/Player-stub/)).not.toBeInTheDocument();
            expect(screen.getByText("You've left the music.")).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Rejoin' }));
            expect(screen.getByText(/Player-stub/)).toBeInTheDocument();
            expect(mockChangeMusic).not.toHaveBeenCalled();
        });

        test('can start the player over to catch up with the others', () => {
            mockParty = { music: playing() };
            render(<MusicDock campaignId="camp-1"/>);
            const before = mockPlayerProps.length;
            fireEvent.click(screen.getByRole('button', { name: 'Resync' }));
            expect(mockPlayerProps.length).toBeGreaterThan(before);
        });

        test('a browser that will not keep a volume is fine', () => {
            const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
            const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
            mockParty = { music: playing() };
            render(<MusicDock campaignId="camp-1"/>);
            fireEvent.change(screen.getByLabelText('Music volume'), { target: { value: '30' } });
            expect(lastPlayer().volume).toBe(30);
            getItem.mockRestore();
            setItem.mockRestore();
        });
    });

    describe('for the director', () => {
        const director = () => render(<MusicDock campaignId="camp-1" isDirector/>);

        test('is a small button until opened, with nothing playing', () => {
            director();
            expect(screen.queryByLabelText('YouTube link')).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: /Music/ }));
            expect(screen.getByLabelText('YouTube link')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Close the music controls' }));
            expect(screen.queryByLabelText('YouTube link')).not.toBeInTheDocument();
        });

        test('pastes a link and plays it for everyone, looping unless told not to', () => {
            director();
            fireEvent.click(screen.getByRole('button', { name: /Music/ }));
            fireEvent.change(screen.getByLabelText('YouTube link'), { target: { value: `https://music.youtube.com/watch?v=${ID}&si=x` } });
            fireEvent.click(screen.getByRole('button', { name: 'Play' }));
            expect(mockChangeMusic).toHaveBeenCalledWith('camp-1', expect.any(Function));
            expect(outcome(null)).toMatchObject({ videoId: ID, state: 'playing', position: 0, loop: true });
            expect(screen.getByLabelText('YouTube link')).toHaveValue('');
        });

        test('plays without looping when Loop is switched off first', () => {
            director();
            fireEvent.click(screen.getByRole('button', { name: /Music/ }));
            fireEvent.click(screen.getByRole('checkbox', { name: 'Loop' }));
            fireEvent.change(screen.getByLabelText('YouTube link'), { target: { value: ID } });
            fireEvent.click(screen.getByRole('button', { name: 'Play' }));
            expect(outcome(null).loop).toBe(false);
        });

        test('says so when what was pasted is not a YouTube link, and plays nothing', () => {
            director();
            fireEvent.click(screen.getByRole('button', { name: /Music/ }));
            fireEvent.change(screen.getByLabelText('YouTube link'), { target: { value: 'https://example.com/song' } });
            fireEvent.click(screen.getByRole('button', { name: 'Play' }));
            expect(screen.getByRole('alert')).toHaveTextContent("doesn't look like a YouTube link");
            expect(mockChangeMusic).not.toHaveBeenCalled();
        });

        test('Play is there only once there is something pasted', () => {
            director();
            fireEvent.click(screen.getByRole('button', { name: /Music/ }));
            expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
        });

        test('hears it too, and can pause it for everyone from where it has got to', () => {
            mockParty = { music: playing({ anchorAt: 1000 }) };
            render(<MusicDock campaignId="camp-1" isDirector/>);
            expect(screen.getByText(/Player-stub/)).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Pause for everyone' }));
            const paused = outcome(playing({ anchorAt: Date.now() - 20000 }));
            expect(paused.state).toBe('paused');
            expect(paused.position).toBeCloseTo(20, 0);
        });

        test('can resume a paused song for everyone', () => {
            mockParty = { music: playing({ state: 'paused', position: 42 }) };
            render(<MusicDock campaignId="camp-1" isDirector/>);
            fireEvent.click(screen.getByRole('button', { name: 'Resume for everyone' }));
            expect(outcome(mockParty.music)).toMatchObject({ state: 'playing', position: 42 });
        });

        test('can stop it for everyone', () => {
            mockParty = { music: playing() };
            render(<MusicDock campaignId="camp-1" isDirector/>);
            fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
            expect(outcome(mockParty.music)).toBeNull();
        });

        test('can switch looping on and off while it plays', () => {
            mockParty = { music: playing() };
            render(<MusicDock campaignId="camp-1" isDirector/>);
            expect(screen.getByRole('checkbox', { name: 'Loop' })).toBeChecked();
            fireEvent.click(screen.getByRole('checkbox', { name: 'Loop' }));
            expect(outcome(mockParty.music).loop).toBe(false);
        });

        test('says so when it cannot be changed', async () => {
            mockChangeMusic.mockRejectedValue(new Error('offline'));
            mockParty = { music: playing() };
            render(<MusicDock campaignId="camp-1" isDirector/>);
            fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
            await screen.findByText(/Player-stub/);
            await Promise.resolve();
            await Promise.resolve();
            expect(window.alert).toHaveBeenCalledWith("Couldn't stop the music: Error: offline");
        });
    });
});
