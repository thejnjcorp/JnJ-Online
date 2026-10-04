import { useState } from 'react';
import { useParty } from '../utils/useParty';
import { changeMusic } from '../utils/party';
import { parseVideoId, pausedMusic, resumedMusic, startedMusic, withLoop } from '../utils/music';
import { MusicPlayer } from './MusicPlayer';
import '../styles/Music.scss';

const VOLUME_KEY = 'jnj-music-volume';

// How loud this person likes the music, kept in their browser.
function savedVolume() {
    try {
        const value = Number(window.localStorage.getItem(VOLUME_KEY));
        return Number.isFinite(value) && value > 0 && value <= 100 ? value : 60;
    } catch {
        return 60;
    }
}

function saveVolume(volume) {
    try {
        window.localStorage.setItem(VOLUME_KEY, String(volume));
    } catch { /* it just is not remembered */ }
}

const report = action => error => alert(`Couldn't ${action}: ${error}`);

// The director's side: paste a YouTube link and play it, then pause, resume, loop or stop it.
function DirectorControls({ campaignId, music }) {
    const [link, setLink] = useState('');
    const [loop, setLoop] = useState(true);
    const [problem, setProblem] = useState('');

    function play(event) {
        event.preventDefault();
        const id = parseVideoId(link);
        if (!id) {
            setProblem("That doesn't look like a YouTube link.");
            return;
        }
        setProblem('');
        setLink('');
        changeMusic(campaignId, () => startedMusic(id, { loop })).catch(report('start the music'));
    }

    return <div className="MusicDock-director">
        <form className="MusicDock-form" onSubmit={play}>
            <input type="text" aria-label="YouTube link" placeholder="Paste a YouTube link" value={link} onChange={event => setLink(event.target.value)}/>
            <button type="submit" className="Scenes-button Scenes-button-primary Scenes-button-small" disabled={link.trim() === ''}>Play</button>
        </form>
        {problem && <p className="MusicDock-problem" role="alert">{problem}</p>}
        <div className="MusicDock-row">
            {music && (music.state === 'playing'
                ? <button type="button" className="Scenes-button Scenes-button-small" onClick={() => changeMusic(campaignId, current => pausedMusic(current, Date.now())).catch(report('pause the music'))}>Pause for everyone</button>
                : <button type="button" className="Scenes-button Scenes-button-small" onClick={() => changeMusic(campaignId, current => resumedMusic(current, Date.now())).catch(report('resume the music'))}>Resume for everyone</button>)}
            {music && <button type="button" className="Scenes-button Scenes-button-small" onClick={() => changeMusic(campaignId, () => null).catch(report('stop the music'))}>Stop</button>}
            <label className="MusicDock-loop">
                <input type="checkbox" checked={music ? Boolean(music.loop) : loop} onChange={event => {
                    // read now: the change is made later, inside a transaction, when the box has settled on what it shows
                    const { checked } = event.target;
                    setLoop(checked);
                    if (music) changeMusic(campaignId, current => withLoop(current, checked)).catch(report('change the music'));
                }}/>
                <span>Loop</span>
            </label>
        </div>
    </div>;
}

// The party's music, in a card in the corner of the screen. Everyone in the campaign sees what the
// director is playing and hears it in step with the others, with a volume of their own and the
// way to leave it; the director also has the way to start, pause and stop it for everyone. With
// nothing playing, only the director sees it.
export function MusicDock({ campaignId, isDirector = false }) {
    const { party } = useParty(campaignId);
    const music = party.music ?? null;
    const [volume, setVolume] = useState(savedVolume);
    const [muted, setMuted] = useState(false);
    const [left, setLeft] = useState(false);
    const [title, setTitle] = useState('');
    // the player starts over (and so catches up) when this changes
    const [resyncs, setResyncs] = useState(0);
    const [open, setOpen] = useState(false);

    if (!music && !isDirector) return null;
    if (!music && !open) return <button type="button" className="MusicDock-open" onClick={() => setOpen(true)}>&#9834; Music</button>;

    return <section className="MusicDock" aria-label="Party music">
        <div className="MusicDock-head">
            <strong>&#9834; Party music</strong>
            {music && <span className="Scenes-muted MusicDock-title">{[title, music.state === 'paused' && 'paused'].filter(Boolean).join(' · ')}</span>}
            {!music && <button type="button" className="Scenes-icon-button" aria-label="Close the music controls" onClick={() => setOpen(false)}>&times;</button>}
        </div>
        {music && !left && <MusicPlayer key={resyncs} music={music} volume={volume} muted={muted} onTitle={setTitle}/>}
        {music && left && <p className="Scenes-muted">You've left the music.</p>}
        {music && <div className="MusicDock-row">
            {left
                ? <button type="button" className="Scenes-button Scenes-button-small" onClick={() => setLeft(false)}>Rejoin</button>
                : <>
                    <input type="range" min="0" max="100" aria-label="Music volume" value={volume} onChange={event => { setVolume(Number(event.target.value)); saveVolume(Number(event.target.value)); }}/>
                    <button type="button" className="Scenes-button Scenes-button-small" aria-pressed={muted} onClick={() => setMuted(value => !value)}>{muted ? 'Unmute' : 'Mute'}</button>
                    <button type="button" className="Scenes-button Scenes-button-small" onClick={() => setResyncs(value => value + 1)}>Resync</button>
                    <button type="button" className="Scenes-button Scenes-button-small" onClick={() => setLeft(true)}>Leave</button>
                </>}
        </div>}
        {isDirector && <DirectorControls campaignId={campaignId} music={music}/>}
    </section>;
}
