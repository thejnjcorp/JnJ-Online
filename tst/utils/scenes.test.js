import { defaultCalendar } from '../../src/utils/calendar';
import {
    SCENE_TEMPLATES, calendarIsElsewhere, sceneDate, sceneDateText, sceneEventFields, sessionDatesText, advanceRun, blockedBeatIds, completeBeat, conditionChoices, conditionState, copyBeats, cueRound, isCombatPaused, isCueDue, beatMinutes, beatState, branchLinkPatches, buildTimeline, estimateMinutes, formatClock, groupArcs, jumpRun,
    newBeat, newScene, optionState, orderAfter, pauseRun, playedScenes, runElapsedMs, sessionState, sessionStats, settleDecision,
    sceneToOpen, splitParagraphs, startRun, timeGoalText, timelinePips, withoutUndefined,
} from '../../src/utils/scenes';

const scene = (id, fields = {}) => ({ ...newScene({ sessionId: 's1', name: id, order: 0, ...fields }), id });

function decisionScenes() {
    const decision = { ...newBeat('decision'), id: 'd1', question: '', options: [{ id: 'oa', label: 'Front', sceneId: 'a' }, { id: 'ob', label: 'Stage', sceneId: 'b' }] };
    return [
        scene('intro', { order: 1, status: 'completed' }),
        scene('split', { order: 2, beats: [decision] }),
        scene('a', { branch: { fromSceneId: 'split', optionId: 'oa' } }),
        scene('b', { branch: { fromSceneId: 'split', optionId: 'ob' } }),
        scene('outro', { order: 3 }),
    ];
}

describe('beats and estimates', () => {
    test('narration is timed by its length, everything else by its own minutes', () => {
        expect(beatMinutes({ type: 'narration', text: '' })).toBe(0);
        expect(beatMinutes({ type: 'narration', text: 'one two three' })).toBe(1);
        expect(beatMinutes({ type: 'narration', text: Array(450).fill('word').join(' ') })).toBe(3);
        expect(beatMinutes({ type: 'combat', minutes: 25 })).toBe(25);
        expect(beatMinutes({ type: 'cue', minutes: 'x' })).toBe(0);
    });

    test('a scene adds its beats up', () => {
        expect(estimateMinutes({ beats: [{ type: 'combat', minutes: 20 }, { type: 'cue', minutes: 5 }] })).toBe(25);
        expect(estimateMinutes({})).toBe(0);
    });

    test('splits read-aloud text into paragraphs', () => {
        expect(splitParagraphs('one\n\n two \n\n\nthree')).toEqual(['one', 'two', 'three']);
        expect(splitParagraphs('')).toEqual([]);
    });

    test('describes a time goal', () => {
        expect(timeGoalText({ timeMin: 30, timeMax: 50 })).toBe('30–50 min');
        expect(timeGoalText({ timeMin: 8, timeMax: null })).toBe('8 min');
        expect(timeGoalText({ timeMin: 8, timeMax: 8 })).toBe('8 min');
        expect(timeGoalText({})).toBe('No goal set');
    });

    test('a new decision beat starts with two empty options and a new beat of each type has the fields its editor needs', () => {
        expect(newBeat('decision').options).toHaveLength(2);
        expect(newBeat('combat')).toMatchObject({ encounterId: '', mapId: '', minutes: 20 });
        expect(newBeat('narration')).toMatchObject({ text: '' });
        expect(newBeat('npc')).toMatchObject({ npcName: '', behaviors: '' });
        expect(newBeat('check')).toMatchObject({ skill: '' });
        expect(newBeat('cue')).toMatchObject({ trigger: '' });
        expect(new Set([newBeat().id, newBeat().id]).size).toBe(2);
    });
});

describe('a session\'s timeline', () => {
    test('puts a decision straight after the scene that ends in it, with its paths and where they rejoin', () => {
        const scenes = decisionScenes();
        const items = buildTimeline(scenes, 's1');
        expect(items.map(item => item.kind)).toEqual(['scene', 'scene', 'decision', 'scene']);
        const decision = items[2];
        expect(decision.paths.map(path => [path.letter, path.scene.id, path.state])).toEqual([['A', 'a', 'possible'], ['B', 'b', 'possible']]);
        expect(items.map(item => item.scene.id)).toEqual(['intro', 'split', 'split', 'outro']);
    });

    test('branch scenes and benched scenes are not on the main line, and other sessions are left out', () => {
        const scenes = [...decisionScenes(), scene('benched', { benched: true }), scene('other', { sessionId: 's2' })];
        expect(buildTimeline(scenes, 's1').filter(item => item.kind === 'scene').map(item => item.scene.id)).toEqual(['intro', 'split', 'outro']);
    });

    test('scenes come in the order they happen, whatever order they were made in', () => {
        const scenes = [scene('late', { order: 9 }), scene('early', { order: 1 })];
        expect(buildTimeline(scenes, 's1').map(item => item.scene.id)).toEqual(['early', 'late']);
    });

    test('a decided decision knows which path was taken and which was not', () => {
        const scenes = decisionScenes();
        scenes[1].beats[0].chosenOptionId = 'ob';
        const [, , decision] = buildTimeline(scenes, 's1');
        expect(decision.paths.map(path => path.state)).toEqual(['skipped', 'taken']);
        expect(optionState(scenes[1].beats[0], { id: 'oa' })).toBe('skipped');
    });

    test('a decision whose path has no scene yet still shows the path', () => {
        const scenes = decisionScenes().filter(item => item.id !== 'b');
        const [, , decision] = buildTimeline(scenes, 's1');
        expect(decision.paths[1].scene).toBeNull();
    });

    test('played scenes leave out the paths not taken', () => {
        const scenes = decisionScenes();
        scenes[1].beats[0].chosenOptionId = 'oa';
        expect(playedScenes(scenes, 's1').map(item => item.id)).toEqual(['intro', 'split', 'a', 'outro']);
    });

    test('a session is now while a scene is active, played once everything has run, otherwise planned', () => {
        const scenes = [scene('one', { status: 'completed', order: 1 }), scene('two', { status: 'ready', order: 2 })];
        expect(sessionState(scenes, 's1')).toBe('planned');
        scenes[1].status = 'active';
        expect(sessionState(scenes, 's1')).toBe('now');
        scenes[1].status = 'completed';
        expect(sessionState(scenes, 's1')).toBe('played');
        expect(sessionState([], 's1')).toBe('planned');
    });

    test('counts scenes, decisions and the scenes that didn\'t happen', () => {
        const scenes = decisionScenes();
        scenes[3].status = 'skipped';
        expect(sessionStats(scenes, 's1')).toEqual({ scenes: 3, decisions: 1, didntHappen: 1 });
    });

    test('one pip per scene and decision, in order', () => {
        const scenes = decisionScenes();
        expect(timelinePips(scenes, 's1').map(pip => pip.state)).toEqual(['done', 'planned', 'decision', 'planned', 'planned', 'planned']);
    });

    test('groups sessions into arcs in order, joining neighbours with the same arc', () => {
        const groups = groupArcs([{ id: 'c', number: 3, arc: 'Two' }, { id: 'a', number: 1, arc: 'One' }, { id: 'b', number: 2, arc: 'One' }, { id: 'd', number: 4 }]);
        expect(groups.map(group => [group.arc, group.sessions.map(session => session.id)])).toEqual([['One', ['a', 'b']], ['Two', ['c']], ['', ['d']]]);
    });
});

describe('ordering', () => {
    const scenes = [scene('a', { order: 10 }), scene('b', { order: 20 })];
    test('puts a new scene between its neighbours, first, or last', () => {
        expect(orderAfter(scenes, 's1', 'a')).toBe(15);
        expect(orderAfter(scenes, 's1', 'b')).toBe(1020);
        expect(orderAfter(scenes, 's1', null)).toBeLessThan(10);
        expect(orderAfter(scenes, 's1', 'missing')).toBe(1020);
        expect(orderAfter([], 's1', 'x')).toBe(1000);
    });
});

describe('deciding', () => {
    test('records the choice and marks every other path\'s scene as not happening, keeping it on the bench', () => {
        const scenes = decisionScenes();
        const result = settleDecision(scenes[1], 'd1', 'oa', scenes);
        expect(result.beats[0].chosenOptionId).toBe('oa');
        expect(result.patches).toEqual({ b: { status: 'skipped', benched: true } });
        expect(result.takenSceneId).toBe('a');
        expect(result.discardIds).toEqual([]);
    });

    test('or lists them to throw away', () => {
        const scenes = decisionScenes();
        const result = settleDecision(scenes[1], 'd1', 'ob', scenes, { keepSkipped: false });
        expect(result.patches).toEqual({ a: { status: 'skipped' } });
        expect(result.discardIds).toEqual(['a']);
    });

    test('does nothing for a beat that is not there', () => {
        const scenes = decisionScenes();
        expect(settleDecision(scenes[1], 'nope', 'oa', scenes)).toBeNull();
    });
});

describe('branch links', () => {
    test('a scene an option leads to becomes a path of that decision, one no option leads to goes back to the main line', () => {
        const scenes = decisionScenes().map(item => item.id === 'b' ? { ...item, branch: null } : item);
        const edited = scenes[1];
        const beats = [{ ...edited.beats[0], options: [{ id: 'oa', sceneId: 'a' }, { id: 'ob', sceneId: 'b' }] }];
        expect(branchLinkPatches(edited, beats, scenes)).toEqual({ b: { branch: { fromSceneId: 'split', optionId: 'ob' }, sessionId: 's1' } });

        const dropped = [{ ...edited.beats[0], options: [{ id: 'oa', sceneId: 'a' }] }];
        expect(branchLinkPatches(edited, dropped, decisionScenes())).toEqual({ b: { branch: null } });
    });

    test('changes nothing when the links already match, and a scene cannot lead to itself', () => {
        const scenes = decisionScenes();
        expect(branchLinkPatches(scenes[1], scenes[1].beats, scenes)).toEqual({});
        const self = [{ ...scenes[1].beats[0], options: [{ id: 'oa', sceneId: 'split' }] }];
        expect(branchLinkPatches(scenes[1], self, scenes).split).toBeUndefined();
    });
});

describe('running a scene', () => {
    const beats = [{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }];

    test('starts at the first beat not done and counts time from now', () => {
        expect(startRun({ beats }, 1000)).toEqual({ startedAt: 1000, accumulatedMs: 0, currentBeatId: 'b1', doneBeatIds: [] });
        expect(startRun({ beats, run: { accumulatedMs: 500, doneBeatIds: ['b1'], currentBeatId: '' } }, 2000)).toMatchObject({ currentBeatId: 'b2', accumulatedMs: 500 });
        expect(startRun({ beats: [] }, 1).currentBeatId).toBe('');
    });

    test('pausing banks the time so far, and elapsed time adds it to the running stretch', () => {
        const paused = pauseRun({ startedAt: 1000, accumulatedMs: 500 }, 4000);
        expect(paused).toEqual({ startedAt: null, accumulatedMs: 3500 });
        expect(runElapsedMs({ startedAt: 1000, accumulatedMs: 500 }, 2000)).toBe(1500);
        expect(runElapsedMs(paused, 9999)).toBe(3500);
        expect(runElapsedMs(null)).toBe(0);
        expect(pauseRun({ startedAt: null, accumulatedMs: 5 })).toEqual({ startedAt: null, accumulatedMs: 5 });
    });

    test('formats a clock', () => {
        expect(formatClock(0)).toBe('0:00');
        expect(formatClock(18 * 60000 + 40000)).toBe('18:40');
    });

    test('moving on marks the beat done and goes to the next one, then to nothing', () => {
        let run = { currentBeatId: 'b1', doneBeatIds: [] };
        run = advanceRun({ beats, run });
        expect(run).toEqual({ currentBeatId: 'b2', doneBeatIds: ['b1'] });
        run = advanceRun({ beats, run });
        run = advanceRun({ beats, run });
        expect(run.currentBeatId).toBe('');
        expect(run.doneBeatIds).toEqual(['b1', 'b2', 'b3']);
    });

    test('going back to a beat skipped earlier is picked up after the last one', () => {
        const run = advanceRun({ beats, run: { currentBeatId: 'b3', doneBeatIds: ['b2'] } });
        expect(run.currentBeatId).toBe('b1');
    });

    test('a beat is done, now, or upcoming, and the director can jump to any', () => {
        const run = { currentBeatId: 'b2', doneBeatIds: ['b1'] };
        expect(beats.map(beat => beatState({ run }, beat))).toEqual(['done', 'now', 'upcoming']);
        expect(jumpRun({ run }, 'b3')).toEqual({ currentBeatId: 'b3', doneBeatIds: ['b1'] });
        expect(beatState({}, beats[0])).toBe('upcoming');
    });
});

test('withoutUndefined drops undefined at every depth but keeps null and other values', () => {
    expect(withoutUndefined({ a: undefined, b: null, c: [{ d: undefined, e: 1 }], f: new Date(5) })).toEqual({ b: null, c: [{ e: 1 }], f: new Date(5) });
});

describe('sceneToOpen', () => {
    const list = () => [
        scene('done', { sessionId: 's1', order: 1, status: 'completed', beats: [{ ...newBeat('cue'), id: 'a' }] }),
        scene('empty', { sessionId: 's1', order: 2 }),
        scene('next', { sessionId: 's1', order: 3, beats: [{ ...newBeat('cue'), id: 'b' }] }),
        scene('elsewhere', { sessionId: 's2', order: 1 }),
    ];

    test('prefers the scene you were last in, then the one being run', () => {
        const scenes = list();
        expect(sceneToOpen(scenes, { lastId: 'next' }).id).toBe('next');
        scenes[3].status = 'active';
        expect(sceneToOpen(scenes, { lastId: 'gone' }).id).toBe('elsewhere');
        expect(sceneToOpen(scenes, { lastId: 'done' }).id).toBe('done');
    });

    test('otherwise the next one still to do in that session - to build, even an empty one; to run, one with beats', () => {
        const scenes = list();
        expect(sceneToOpen(scenes, { sessionId: 's1', view: 'build' }).id).toBe('empty');
        expect(sceneToOpen(scenes, { sessionId: 's1', view: 'run' }).id).toBe('next');
    });

    test('with no session, the first scene to do anywhere; when everything is done, the first scene; none at all, null', () => {
        const scenes = list();
        expect(sceneToOpen(scenes, {}).id).toBe('elsewhere');
        const finished = scenes.map(item => ({ ...item, status: 'completed' }));
        expect(sceneToOpen(finished, { sessionId: 's1' }).id).toBe('done');
        expect(sceneToOpen([], {})).toBeNull();
    });

    test('benched scenes are not offered', () => {
        const scenes = [scene('b', { benched: true, order: 1 }), scene('m', { order: 2 })];
        expect(sceneToOpen(scenes, {}).id).toBe('m');
    });
});

describe('cues that come due', () => {
    test('a cue\'s round is the number after "round" in when it comes due', () => {
        expect(cueRound({ trigger: 'Round 2' })).toBe(2);
        expect(cueRound({ trigger: 'round 3 refresher' })).toBe(3);
        expect(cueRound({ trigger: 'Between rounds' })).toBeNull();
        expect(cueRound({})).toBeNull();
        expect(cueRound(null)).toBeNull();
    });

    test('it is due once that round is here, and only a cue with a round is ever due', () => {
        const cue = { type: 'cue', trigger: 'Round 2' };
        expect(isCueDue(cue, 1)).toBe(false);
        expect(isCueDue(cue, 2)).toBe(true);
        expect(isCueDue(cue, 5)).toBe(true);
        expect(isCueDue({ type: 'cue', trigger: '' }, 5)).toBe(false);
        expect(isCueDue({ type: 'narration', trigger: 'Round 1' }, 5)).toBe(false);
    });
});

describe('finishing and skipping beats', () => {
    const run = { currentBeatId: 'a', doneBeatIds: [] };
    const sc = { beats: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], run };

    test('a beat can be finished without going to it, once', () => {
        expect(completeBeat(sc, 'b').doneBeatIds).toEqual(['b']);
        expect(completeBeat({ ...sc, run: { ...run, doneBeatIds: ['b'] } }, 'b').doneBeatIds).toEqual(['b']);
        expect(completeBeat({ beats: [] }, 'x').doneBeatIds).toEqual(['x']);
    });

    test('moving on passes over the beats it is told to', () => {
        expect(advanceRun(sc, ['b']).currentBeatId).toBe('c');
        expect(advanceRun(sc).currentBeatId).toBe('b');
        expect(advanceRun(sc, ['b', 'c']).currentBeatId).toBe('');
    });

    test('a fight that was started and is not the beat being run is paused', () => {
        const fight = { id: 'f', type: 'combat', started: true };
        expect(isCombatPaused({ beats: [fight], run: { currentBeatId: 'x', doneBeatIds: [] } }, fight)).toBe(true);
        expect(isCombatPaused({ beats: [fight], run: { currentBeatId: 'f', doneBeatIds: [] } }, fight)).toBe(false);
        expect(isCombatPaused({ beats: [fight], run: { currentBeatId: 'x', doneBeatIds: ['f'] } }, fight)).toBe(false);
        expect(isCombatPaused({ beats: [], run: {} }, { id: 'f', type: 'combat' })).toBe(false);
    });
});

describe('only runs if', () => {
    const [intro, split] = decisionScenes();
    const scenes = [intro, split];
    const target = scene('target', { beats: [] });

    test('the choices are every option of every decision in the session, worded as the decision and the option', () => {
        expect(conditionChoices([...scenes, target], target)).toEqual([
            expect.objectContaining({ key: 'split:d1:oa', sceneId: 'split', beatId: 'd1', optionId: 'oa', label: 'After split = Front' }),
            expect.objectContaining({ key: 'split:d1:ob', label: 'After split = Stage' }),
        ]);
        expect(conditionChoices(scenes, split)).toEqual([]);
        expect(conditionChoices(scenes, { id: 'z', sessionId: 'elsewhere' })).toEqual([]);
    });

    test('a condition is open until its decision is made, then met or unmet', () => {
        const condition = { sceneId: 'split', beatId: 'd1', optionId: 'oa' };
        expect(conditionState(null, scenes)).toBe('open');
        expect(conditionState(condition, scenes)).toBe('open');
        expect(conditionState({ ...condition, sceneId: 'gone' }, scenes)).toBe('open');
        const decided = chosen => scenes.map(item => (item.id === 'split' ? { ...item, beats: item.beats.map(beat => ({ ...beat, chosenOptionId: chosen })) } : item));
        expect(conditionState(condition, decided('oa'))).toBe('met');
        expect(conditionState(condition, decided('ob'))).toBe('unmet');
    });

    test('the beats that will not run are the ones whose path was not taken', () => {
        const decided = scenes.map(item => (item.id === 'split' ? { ...item, beats: item.beats.map(beat => ({ ...beat, chosenOptionId: 'ob' })) } : item));
        const beats = [
            { id: 'x', onlyIf: { sceneId: 'split', beatId: 'd1', optionId: 'oa' } },
            { id: 'y', onlyIf: { sceneId: 'split', beatId: 'd1', optionId: 'ob' } },
            { id: 'z' },
        ];
        expect(blockedBeatIds({ beats }, decided)).toEqual(['x']);
        expect(blockedBeatIds({ beats }, scenes)).toEqual([]);
        expect(blockedBeatIds({}, scenes)).toEqual([]);
    });
});

describe('templates, and copying what is attached', () => {
    test('each template makes fresh beats every time, of the type it says', () => {
        SCENE_TEMPLATES.forEach(template => {
            const first = template.beats();
            const second = template.beats();
            expect(first.length).toBeGreaterThan(0);
            expect(first[0].id).not.toBe(second[0].id);
            expect(['roleplay', 'combat', 'mixed']).toContain(template.type);
        });
        expect(SCENE_TEMPLATES.find(template => template.key === 'combat').beats().some(beat => beat.type === 'combat')).toBe(true);
    });

    test('copied beats get new ids for what is attached to them, and keep their conditions', () => {
        const [copy] = copyBeats([{ id: 'a', type: 'narration', onlyIf: { sceneId: 's', beatId: 'b', optionId: 'o' }, attachments: [{ id: 'att', kind: 'npc', npcName: 'Bully' }] }]);
        expect(copy.attachments).toEqual([{ id: expect.not.stringMatching(/^att$/), kind: 'npc', npcName: 'Bully' }]);
        expect(copy.onlyIf).toEqual({ sceneId: 's', beatId: 'b', optionId: 'o' });
    });
});

describe('a scene\'s day on the calendar', () => {
    const calendar = defaultCalendar();
    const dated = (fields = {}) => ({ sessionId: 's1', name: 'Fire', premise: 'The warehouse burns', date: { year: 1, month: 11, day: 21 }, ...fields });

    test('the date is there when the calendar has that day, and not when it does not', () => {
        expect(sceneDate(dated(), calendar)).toEqual({ year: 1, month: 11, day: 21 });
        expect(sceneDate(dated({ date: { year: 1, month: 1, day: 30 } }), calendar)).toBeNull();
        expect(sceneDate(dated({ date: null }), calendar)).toBeNull();
        expect(sceneDate(undefined, calendar)).toBeNull();
    });

    test('shows as the calendar writes it, or not at all', () => {
        expect(sceneDateText(dated(), calendar)).toBe('21 December, year 1');
        expect(sceneDateText(dated({ date: { year: 1, month: 1, day: 30 } }), calendar)).toBe('');
        expect(sceneDateText(dated({ date: null }), calendar)).toBe('');
    });

    test('a session covers the days of its scenes, as one day or from the first to the last', () => {
        const scenes = [
            dated(), dated({ date: { year: 1, month: 11, day: 19 } }), dated({ sessionId: 's2', date: { year: 3, month: 0, day: 1 } }), dated({ date: null }),
        ];
        expect(sessionDatesText(scenes, 's1', calendar)).toBe('19 December, year 1 - 21 December, year 1');
        expect(sessionDatesText([scenes[0]], 's1', calendar)).toBe('21 December, year 1');
        expect(sessionDatesText(scenes, 's2', calendar)).toBe('1 January, year 3');
        expect(sessionDatesText(scenes, 's9', calendar)).toBe('');
    });

    test('the calendar is elsewhere when today is another day than the scene\'s', () => {
        expect(calendarIsElsewhere(dated(), calendar)).toBe(true);
        expect(calendarIsElsewhere(dated({ date: { year: 1, month: 0, day: 1 } }), calendar)).toBe(false);
        expect(calendarIsElsewhere(dated({ date: null }), calendar)).toBe(false);
    });

    test('what goes on the calendar for a scene is its name, what it was about and its day, tagged Scene', () => {
        expect(sceneEventFields(dated(), calendar)).toEqual({
            title: 'Fire', description: 'The warehouse burns', category: 'Scene', year: 1, month: 11, day: 21, recurrence: 'none',
        });
        expect(sceneEventFields(dated({ name: '', premise: '' }), calendar)).toMatchObject({ title: 'Untitled scene', description: '' });
        expect(sceneEventFields(dated({ name: 'x'.repeat(200) }), calendar).title).toHaveLength(80);
        expect(sceneEventFields(dated({ date: null }), calendar)).toBeNull();
    });

    test('a new scene has no date', () => {
        expect(newScene().date).toBeNull();
    });
});
