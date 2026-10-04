import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { Attachments, BeatRail, CallCheck, DueCues, MusicCueCard, PausedCombatNote, RulingCard, WaitingOn, railState } from '../../src/components/SceneRunnerParts';
import { BEAT_TYPES } from '../../src/utils/scenes';

const beat = (id, type, fields = {}) => ({ id, type, title: id, ...fields });
const sceneOf = (beats, run = { currentBeatId: beats[0].id, doneBeatIds: [] }) => ({ id: 's', beats, run });

describe('how a beat shows on the rail', () => {
    const fight = beat('f', 'combat', { started: true });
    const cue = beat('c', 'cue', { trigger: 'Round 2' });

    test('a cue comes due by the round of a fight that has been started', () => {
        const scene = sceneOf([beat('n', 'narration'), fight, cue]);
        expect(railState(scene, [scene], cue, 1)).toBe('upcoming');
        expect(railState(scene, [scene], cue, 2)).toBe('due');
        const noFight = sceneOf([beat('n', 'narration'), { ...fight, started: false }, cue]);
        expect(railState(noFight, [noFight], cue, 2)).toBe('upcoming');
    });

    test('a fight that was left is paused, and a beat on a path not taken is not taken', () => {
        const scene = sceneOf([beat('n', 'narration'), fight], { currentBeatId: 'n', doneBeatIds: [] });
        expect(railState(scene, [scene], fight, 1)).toBe('paused');
        const decision = { id: 'split', beats: [{ id: 'd', type: 'decision', chosenOptionId: 'b', options: [] }] };
        const gated = beat('g', 'cue', { onlyIf: { sceneId: 'split', beatId: 'd', optionId: 'a' } });
        const here = sceneOf([beat('n', 'narration'), gated]);
        expect(railState(here, [here, decision], gated, 1)).toBe('skipped');
        expect(railState(here, [here, decision], here.beats[0], 1)).toBe('now');
    });
});

describe('BeatRail', () => {
    test('lists each beat with where it stands, and the round a running fight is in', () => {
        const fight = beat('f', 'combat', { started: true, title: 'The fight' });
        const cue = beat('c', 'cue', { trigger: 'Round 2', title: 'Refresher' });
        const scene = sceneOf([fight, cue], { currentBeatId: 'f', doneBeatIds: [] });
        const onJump = jest.fn();
        render(<BeatRail scene={scene} scenes={[scene]} beats={scene.beats} combatTurn={{ round: 2, activeName: 'Interrogator' }} addOpen={false}
            onToggleAdd={jest.fn()} onJump={onJump} onAdd={jest.fn()} addTypes={BEAT_TYPES}/>);
        expect(screen.getByText('Now · Combat')).toBeInTheDocument();
        expect(screen.getByText("Round 2, Interrogator's turn")).toBeInTheDocument();
        expect(screen.getByText('Due now · Cue')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /2 · Refresher/ }));
        expect(onJump).toHaveBeenCalledWith('c');
    });

    test('adds a beat on the fly of the type picked', () => {
        const scene = sceneOf([beat('a', 'cue')]);
        const onAdd = jest.fn();
        render(<BeatRail scene={scene} scenes={[scene]} beats={scene.beats} combatTurn={null} addOpen onToggleAdd={jest.fn()} onJump={jest.fn()} onAdd={onAdd} addTypes={BEAT_TYPES}/>);
        fireEvent.click(screen.getByRole('menuitem', { name: 'Check' }));
        expect(onAdd).toHaveBeenCalledWith('check');
    });
});

describe('DueCues', () => {
    test('shows the cues that have come due in the fight, to open or mark done where they are', () => {
        const fight = beat('f', 'combat', { started: true });
        const cue = beat('c', 'cue', { trigger: 'Round 2', title: 'Round 2 refresher', text: 'Saph shows up.' });
        const other = beat('o', 'cue', { trigger: 'Round 3', title: 'Round 3 refresher' });
        const scene = sceneOf([fight, cue, other], { currentBeatId: 'f', doneBeatIds: [] });
        const onOpen = jest.fn();
        const onDone = jest.fn();
        render(<DueCues scene={scene} scenes={[scene]} current={fight} combatTurn={{ round: 2 }} onOpen={onOpen} onDone={onDone}/>);
        expect(screen.getByText('Round 2 refresher')).toBeInTheDocument();
        expect(screen.getByText('Saph shows up.')).toBeInTheDocument();
        expect(screen.queryByText('Round 3 refresher')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Open cue' }));
        expect(onOpen).toHaveBeenCalledWith('c');
        fireEvent.click(screen.getByRole('button', { name: 'Mark done' }));
        expect(onDone).toHaveBeenCalledWith('c');
    });
});

describe('PausedCombatNote', () => {
    const fight = beat('f', 'combat', { started: true });
    const flashback = beat('n', 'narration');

    test('away from a fight in the middle of it, says where it was left and offers the way back', () => {
        const scene = sceneOf([fight, flashback], { currentBeatId: 'n', doneBeatIds: [] });
        const onReturn = jest.fn();
        render(<PausedCombatNote scene={scene} current={flashback} combatTurn={{ round: 2 }} onReturn={onReturn}/>);
        expect(screen.getByText(/Combat is paused at Round 2/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Return to combat' }));
        expect(onReturn).toHaveBeenCalledWith('f');
    });

    test('is not there in the fight itself, or when no fight was started', () => {
        const scene = sceneOf([fight, flashback], { currentBeatId: 'f', doneBeatIds: [] });
        const { container, rerender } = render(<PausedCombatNote scene={scene} current={fight} combatTurn={null} onReturn={jest.fn()}/>);
        expect(container).toBeEmptyDOMElement();
        const idle = sceneOf([{ ...fight, started: false }, flashback], { currentBeatId: 'n', doneBeatIds: [] });
        rerender(<PausedCombatNote scene={idle} current={flashback} combatTurn={null} onReturn={jest.fn()}/>);
        expect(container).toBeEmptyDOMElement();
    });
});

describe('RulingCard and WaitingOn', () => {
    test('a ruling can be switched off, and back on', () => {
        const onToggle = jest.fn();
        const { rerender } = render(<RulingCard beat={beat('f', 'combat', { ruling: 'The sound system gives -1.' })} onToggle={onToggle}/>);
        expect(screen.getByText('The sound system gives -1.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Active' }));
        expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'f' }), false);
        rerender(<RulingCard beat={beat('f', 'combat', { ruling: 'x', rulingActive: false })} onToggle={onToggle}/>);
        fireEvent.click(screen.getByRole('button', { name: 'Off' }));
        expect(onToggle).toHaveBeenLastCalledWith(expect.anything(), true);
    });

    test('a cue that waits on someone has a box ticked while it still does, and none when it waits on no one', () => {
        const onChange = jest.fn();
        const { container, rerender } = render(<WaitingOn beat={beat('c', 'cue', { waitingOn: "Leon's roleplay" })} onChange={onChange}/>);
        const box = screen.getByRole('checkbox', { name: "Waiting on Leon's roleplay" });
        expect(box).toBeChecked();
        fireEvent.click(box);
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'c' }), false);
        rerender(<WaitingOn beat={beat('c', 'cue', { waitingOn: 'x', waiting: false })} onChange={onChange}/>);
        expect(screen.getByRole('checkbox')).not.toBeChecked();
        rerender(<WaitingOn beat={beat('c', 'cue')} onChange={onChange}/>);
        expect(container).toBeEmptyDOMElement();
    });
});

describe('Attachments', () => {
    test('shows the NPCs and checks attached to a beat along with it', () => {
        render(<Attachments beat={beat('n', 'narration', { attachments: [
            { id: 'a1', kind: 'npc', npcName: 'Snotty Bully', behaviors: '6 year old kid\nPelts snowballs' },
            { id: 'a2', kind: 'check', skill: 'Dexterity', dc: '12', text: 'Dodge the snowball' },
        ] })}/>);
        expect(screen.getByText('Snotty Bully')).toBeInTheDocument();
        expect(screen.getByText('Pelts snowballs')).toBeInTheDocument();
        expect(screen.getByText('Dexterity · DC 12')).toBeInTheDocument();
    });
});

describe('CallCheck', () => {
    const players = [{ id: 'c1', name: 'Leon' }, { id: 'c2', name: 'Floyd' }];

    test('picks who rolls, then what, and asks them', async () => {
        const onAsk = jest.fn().mockResolvedValue(undefined);
        render(<CallCheck players={players} onAsk={onAsk}/>);
        const panel = screen.getByRole('region', { name: 'Call a check' });
        expect(within(panel).getByRole('button', { name: 'Dexterity' })).toBeDisabled();
        fireEvent.click(within(panel).getByRole('button', { name: 'Leon' }));
        fireEvent.click(within(panel).getByRole('button', { name: 'Floyd' }));
        fireEvent.click(within(panel).getByRole('button', { name: 'Dexterity' }));
        await waitFor(() => expect(onAsk).toHaveBeenCalledWith(['c1', 'c2'], 'Dexterity'));
        expect(await within(panel).findByText('Asked Leon, Floyd for a Dexterity roll.')).toBeInTheDocument();
    });

    test('anything else can be typed in', async () => {
        const onAsk = jest.fn().mockResolvedValue(undefined);
        render(<CallCheck players={players} onAsk={onAsk}/>);
        fireEvent.click(screen.getByRole('button', { name: 'Leon' }));
        fireEvent.change(screen.getByLabelText('Another skill'), { target: { value: 'Attention to detail' } });
        fireEvent.click(screen.getByRole('button', { name: 'Ask Leon for a roll' }));
        await waitFor(() => expect(onAsk).toHaveBeenCalledWith(['c1'], 'Attention to detail'));
        await waitFor(() => expect(screen.getByLabelText('Another skill')).toHaveValue(''));
    });

    test('says so when the ask fails, and is not there with no players', async () => {
        window.alert = jest.fn();
        const onAsk = jest.fn().mockRejectedValue(new Error('offline'));
        const { container, rerender } = render(<CallCheck players={players} onAsk={onAsk}/>);
        fireEvent.click(screen.getByRole('button', { name: 'Leon' }));
        fireEvent.click(screen.getByRole('button', { name: 'Strength' }));
        await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Couldn't ask for the roll: offline"));
        rerender(<CallCheck players={[]} onAsk={onAsk}/>);
        expect(container).toBeEmptyDOMElement();
        delete window.alert;
    });
});

describe('MusicCueCard', () => {
    const cue = { action: 'play', videoId: 'abcdefghijk', loop: true, auto: true };

    test('says what it plays, that it happens by itself, and plays it now when asked', () => {
        const onPlay = jest.fn();
        render(<MusicCueCard cue={cue} onPlay={onPlay}/>);
        expect(screen.getByText('Play a song')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'https://youtu.be/abcdefghijk' })).toHaveAttribute('href', 'https://youtu.be/abcdefghijk');
        expect(screen.getByText('Happens when the beat begins.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Play now' }));
        expect(onPlay).toHaveBeenCalledWith(cue);
    });

    test('one that waits for the director says so', () => {
        render(<MusicCueCard cue={{ ...cue, auto: false }} onPlay={() => {}}/>);
        expect(screen.getByText('Waits for you.')).toBeInTheDocument();
    });

    test('a stop cue stops the music', () => {
        const onPlay = jest.fn();
        render(<MusicCueCard cue={{ action: 'stop', auto: true }} onPlay={onPlay}/>);
        expect(screen.getByText('Stop the music')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Stop now' }));
        expect(onPlay).toHaveBeenCalledWith({ action: 'stop', auto: true });
    });

    test('with no song chosen yet there is nothing to play', () => {
        render(<MusicCueCard cue={{ action: 'play', videoId: '', auto: true }} onPlay={() => {}}/>);
        expect(screen.getByText(/No song chosen yet/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Play now' })).toBeDisabled();
    });
});
