jest.mock('../../src/utils/firebase', () => ({ auth: {}, db: {} }));

const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockAddDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    addDoc: (...args) => mockAddDoc(...args),
    collection: (...path) => ({ __collection: path.slice(1) }),
    serverTimestamp: () => 'NOW',
    doc: (...path) => ({ __doc: path.slice(1) }),
    getDoc: (...args) => mockGetDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
    deleteDoc: (...args) => mockDeleteDoc(...args),
}));

const mockUpdateCombatTracker = jest.fn();
jest.mock('../../src/utils/party', () => ({
    addTrackerPosts: jest.requireActual('../../src/utils/party').addTrackerPosts,
    partyDoc: id => ({ __party: id }),
    updateCombatTracker: (...args) => mockUpdateCombatTracker(...args),
}));

let mockState;
const mockCreateSession = jest.fn();
const mockUpdateSession = jest.fn();
const mockCreateScene = jest.fn();
const mockUpdateScene = jest.fn();
const mockDeleteScene = jest.fn();
jest.mock('../../src/utils/useScenes', () => ({
    useScenes: () => ({
        ...mockState,
        createSession: mockCreateSession, updateSession: mockUpdateSession,
        createScene: mockCreateScene, updateScene: mockUpdateScene, deleteScene: mockDeleteScene,
    }),
}));

// The encounter list and editor are the pages they always were (EncountersPage, EncounterPage) -
// here only the way the scenes framework hosts them matters.
jest.mock('../../src/components/EncountersPage', () => ({
    EncountersPage: ({ campaignId, onOpen }) => <div>EncountersPage-stub:{campaignId}<button type="button" onClick={() => onOpen('enc-9')}>Open encounter</button></div>,
}));
jest.mock('../../src/components/EncounterPage', () => ({
    EncounterPage: ({ campaignId, encounterId, onBack }) => <div>EncounterPage-stub:{campaignId}:{encounterId}<button type="button" onClick={onBack}>Back to encounters</button></div>,
}));

// the party's own tabs are tested with the party page; here only that the popup hosts them, on the tab it is told
jest.mock('../../src/components/PartySpace', () => ({
    PartySpace: ({ campaignId, tab, onTab }) => <div>PartySpace-stub:{campaignId}:{tab}<button type="button" onClick={() => onTab('notes')}>Go to notes</button></div>,
}));

let mockEncounters;
jest.mock('../../src/utils/useEncounters', () => ({ useEncounters: () => ({ encounters: mockEncounters, status: 'ready' }) }));

// eslint-disable-next-line import/first
import { screen, fireEvent, waitFor, within, act } from '@testing-library/react';
// eslint-disable-next-line import/first
import { ScenesTab } from '../../src/components/ScenesTab';
// eslint-disable-next-line import/first
import { renderWithRouter } from '../testUtils/renderWithRouter';
// eslint-disable-next-line import/first
import { newBeat, newScene } from '../../src/utils/scenes';

const scene = (id, fields = {}) => ({ ...newScene({ sessionId: 's1', name: id, order: 0 }), id, ...fields });
const beat = (id, type, fields = {}) => ({ ...newBeat(type), id, ...fields });

function decisionFixture() {
    return [
        scene('intro', { name: 'Intro', order: 1, status: 'completed', premise: 'Kal is tied up', beats: [beat('i1', 'narration', { title: 'Setup', text: 'One.\n\nTwo.' })] }),
        scene('split', {
            name: 'Split', order: 2,
            beats: [beat('d1', 'decision', { title: 'Where now?', options: [{ id: 'oa', label: 'Front door', sceneId: 'a' }, { id: 'ob', label: 'Stage', sceneId: 'b' }] })],
        }),
        scene('a', { name: 'Front', branch: { fromSceneId: 'split', optionId: 'oa' }, beats: [beat('a1', 'cue', { title: 'Do it' })] }),
        scene('b', { name: 'Stage run', branch: { fromSceneId: 'split', optionId: 'ob' } }),
        scene('outro', { name: 'Outro', order: 3 }),
    ];
}

const sessions = [
    { id: 's1', number: 1, arc: 'Arc 1', inWorldDate: 'Dec 15', order: 1 },
    { id: 's2', number: 2, arc: 'Arc 1', order: 2 },
];

function renderTab({ route = '/directors/camp-1', renderCombat = () => ({ main: <div>Combat-stub</div>, aside: <div>Enemies-stub</div> }), onSceneEnded, maps = [], campaignInfo = { enemy_list: [], active_map: null } } = {}) {
    return renderWithRouter(<ScenesTab campaignId="camp-1" campaignInfo={campaignInfo} maps={maps} renderCombat={renderCombat} onSceneEnded={onSceneEnded}
        header={<div>Header-stub</div>} renderSidebar={view => <div>Sidebar-stub:{view}</div>}
        renderMaps={() => <div>Maps-stub</div>} renderNotes={() => <div>Notes-stub</div>}/>, { route });
}

beforeEach(() => {
    mockState = { sessions, scenes: decisionFixture(), status: 'ready' };
    mockEncounters = [];
    mockCreateSession.mockResolvedValue('s3');
    mockUpdateSession.mockResolvedValue(undefined);
    mockCreateScene.mockResolvedValue('new-scene');
    mockUpdateScene.mockResolvedValue(undefined);
    mockDeleteScene.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    mockUpdateCombatTracker.mockResolvedValue(undefined);
    window.alert = jest.fn();
    window.confirm = jest.fn(() => true);
});

afterEach(() => {
    jest.clearAllMocks();
    delete window.alert;
    delete window.confirm;
});

describe('ScenesTab', () => {
    test('shows a loading message, then an error if the scenes can\'t be read', () => {
        mockState = { ...mockState, status: 'loading' };
        const { unmount } = renderTab();
        expect(screen.getByRole('status')).toHaveTextContent('Loading scenes…');
        unmount();
        mockState = { ...mockState, status: 'error' };
        renderTab();
        expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load the scenes");
    });

    describe('campaign view (every session)', () => {
        test('lists the sessions under their arc with state, date and counts', () => {
            renderTab();
            expect(screen.getByRole('heading', { name: 'Arc 1 · Sessions 1–2' })).toBeInTheDocument();
            const card = screen.getByRole('button', { name: 'Session 1, Planned' });
            expect(within(card).getByText('In-world Dec 15')).toBeInTheDocument();
            expect(within(card).getByText(/3 scenes planned · 1 decision/)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Session 2, Planned' })).toHaveTextContent('No scenes yet');
        });

        test('says so when nothing is planned and offers a new session', () => {
            mockState = { sessions: [], scenes: [], status: 'ready' };
            renderTab();
            expect(screen.getByText(/Nothing planned yet/)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: '+ New Scene' })).toBeDisabled();
        });

        test('+ New Session creates the next session and zooms into it', async () => {
            mockCreateSession.mockImplementation(async () => {
                mockState = { ...mockState, sessions: [...sessions, { id: 's3', number: 3, order: 3 }] };
                return 's3';
            });
            renderTab();
            fireEvent.click(screen.getByRole('button', { name: '+ New Session' }));
            await waitFor(() => expect(mockCreateSession).toHaveBeenCalledWith({}));
            expect(await screen.findByRole('heading', { name: 'Session 3' })).toBeInTheDocument();
        });

        test('a failed new session is alerted', async () => {
            mockCreateSession.mockRejectedValue(new Error('offline'));
            renderTab();
            fireEvent.click(screen.getByRole('button', { name: '+ New Session' }));
            await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Couldn't create the session: offline"));
        });

        test('Jump to now goes to the session with a live scene', () => {
            mockState = { ...mockState, scenes: decisionFixture().map(item => item.id === 'outro' ? { ...item, sessionId: 's2', status: 'active' } : item) };
            renderTab();
            fireEvent.click(screen.getByRole('button', { name: 'Jump to now' }));
            expect(screen.getByRole('heading', { name: 'Session 2' })).toBeInTheDocument();
        });

        test('clicking a session zooms in on its scenes', () => {
            renderTab();
            fireEvent.click(screen.getByRole('button', { name: 'Session 1, Planned' }));
            expect(screen.getByRole('heading', { name: 'Session 1' })).toBeInTheDocument();
            expect(screen.getByText('Intro')).toBeInTheDocument();
        });
    });

    describe('the whole campaign and moving between sessions', () => {
        test('the campaign view ends with a strip of every session, one block each', () => {
            renderTab();
            const strip = screen.getByRole('region', { name: 'Whole campaign' });
            expect(within(strip).getAllByRole('button')).toHaveLength(sessions.length);
            expect(within(strip).getByRole('button', { name: 'Show Session 2' })).toBeInTheDocument();
            expect(within(strip).getByText(/Drag the frame to move/)).toBeInTheDocument();
        });

        test('with one session there is no strip to show', () => {
            mockState = { ...mockState, sessions: [sessions[0]] };
            renderTab();
            expect(screen.queryByRole('region', { name: 'Whole campaign' })).not.toBeInTheDocument();
        });

        test('arrows in a session\'s strip go to the session before and after it, and stop at the ends', () => {
            renderTab({ route: '/directors/camp-1?session=s1' });
            expect(screen.getByRole('button', { name: 'Previous sessions' })).toBeDisabled();
            fireEvent.click(screen.getByRole('button', { name: 'Next sessions' }));
            expect(screen.getByRole('heading', { name: 'Session 2' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Next sessions' })).toBeDisabled();
            fireEvent.click(screen.getByRole('button', { name: 'Previous sessions' }));
            expect(screen.getByRole('heading', { name: 'Session 1' })).toBeInTheDocument();
        });
    });

    describe('session view', () => {
        const open = () => renderTab({ route: '/directors/camp-1?session=s1' });

        test('lists the scenes in order with a decision and its paths after the scene that ends in it', () => {
            open();
            expect(screen.getByText('Intro')).toBeInTheDocument();
            expect(screen.getByText('Kal is tied up')).toBeInTheDocument();
            expect(screen.getByText('Where now?')).toBeInTheDocument();
            expect(screen.getByText('A · Front door')).toBeInTheDocument();
            expect(screen.getByText('B · Stage')).toBeInTheDocument();
            expect(screen.getByText('Not decided yet · only one path will run')).toBeInTheDocument();
            expect(screen.getByText('Outro')).toBeInTheDocument();
        });

        test('groups scenes under an episode heading', () => {
            mockState = { ...mockState, scenes: decisionFixture().map(item => item.id === 'intro' || item.id === 'split' ? { ...item, episode: 'Episode 2' } : item) };
            open();
            expect(screen.getAllByText('Episode 2')).toHaveLength(1);
        });

        test('back to the campaign, and across to another session', () => {
            open();
            fireEvent.click(screen.getByRole('button', { name: 'Session 2' }));
            expect(screen.getByRole('heading', { name: 'Session 2' })).toBeInTheDocument();
            expect(screen.getByText(/No scenes in this session yet/)).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: /Campaign$/ }));
            expect(screen.getByRole('heading', { name: 'Scenes' })).toBeInTheDocument();
        });

        test('a live scene gets a resume banner', () => {
            mockState = { ...mockState, scenes: decisionFixture().map(item => item.id === 'outro' ? { ...item, status: 'active', beats: [beat('o1', 'cue')], run: { currentBeatId: 'o1', doneBeatIds: [] } } : item) };
            open();
            expect(screen.getByText('Live · beat 1 of 1')).toBeInTheDocument();
        });

        test('Session settings saves a changed name, arc and date on blur, and nothing if left alone', () => {
            open();
            fireEvent.click(screen.getByRole('button', { name: 'Session settings' }));
            const arc = screen.getByDisplayValue('Arc 1');
            fireEvent.blur(arc);
            expect(mockUpdateSession).not.toHaveBeenCalled();
            fireEvent.change(arc, { target: { value: ' Arc 9 ' } });
            fireEvent.blur(arc);
            expect(mockUpdateSession).toHaveBeenCalledWith('s1', { arc: 'Arc 9' });
            fireEvent.change(screen.getByPlaceholderText('Optional'), { target: { value: 'The Fire' } });
            fireEvent.blur(screen.getByPlaceholderText('Optional'));
            expect(mockUpdateSession).toHaveBeenCalledWith('s1', { name: 'The Fire' });
            fireEvent.change(screen.getByDisplayValue('Dec 15'), { target: { value: 'Dec 16' } });
            fireEvent.blur(screen.getByDisplayValue('Dec 16'));
            expect(mockUpdateSession).toHaveBeenCalledWith('s1', { inWorldDate: 'Dec 16' });
        });

        test('Edit opens the builder and Run opens the runner for a scene with beats', () => {
            open();
            fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[1]);
            expect(screen.getByRole('textbox', { name: 'Scene name' })).toHaveValue('Split');
        });

        test('Run is only offered for a scene that has beats', () => {
            open();
            expect(screen.getAllByRole('button', { name: 'Run' }).length).toBeGreaterThan(0);
            // eslint-disable-next-line testing-library/no-node-access -- a scene row is a plain container with no role or name to query by
            const outroRow = screen.getByText('Outro').closest('.Scenes-scene-row');
            expect(within(outroRow).queryByRole('button', { name: 'Run' })).not.toBeInTheDocument();
        });

        describe('the ••• menu', () => {
            const menuOf = name => { fireEvent.click(screen.getByRole('button', { name: `More options for ${name}` })); return screen.getByRole('menu'); };

            test('Duplicate copies the scene with new beat ids right after it', async () => {
                open();
                fireEvent.click(within(menuOf('Intro')).getByRole('menuitem', { name: 'Duplicate' }));
                await waitFor(() => expect(mockCreateScene).toHaveBeenCalled());
                const fields = mockCreateScene.mock.calls[0][0];
                expect(fields).toMatchObject({ name: 'Intro (copy)', sessionId: 's1', premise: 'Kal is tied up' });
                expect(fields.beats[0].id).not.toBe('i1');
                expect(fields.order).toBeGreaterThan(1);
                expect(fields.order).toBeLessThan(2);
            });

            test('Move to the bench keeps the scene but takes it off the timeline', async () => {
                open();
                fireEvent.click(within(menuOf('Intro')).getByRole('menuitem', { name: 'Move to the bench' }));
                await waitFor(() => expect(mockUpdateScene).toHaveBeenCalledWith('intro', { benched: true, branch: null }));
            });

            test('Delete asks first, and does nothing if declined', async () => {
                window.confirm.mockReturnValueOnce(false);
                open();
                fireEvent.click(within(menuOf('Outro')).getByRole('menuitem', { name: 'Delete' }));
                expect(mockDeleteScene).not.toHaveBeenCalled();
                fireEvent.click(within(menuOf('Outro')).getByRole('menuitem', { name: 'Delete' }));
                await waitFor(() => expect(mockDeleteScene).toHaveBeenCalledWith('outro'));
            });

            test('a failed delete is alerted', async () => {
                mockDeleteScene.mockRejectedValue(new Error('denied'));
                open();
                fireEvent.click(within(menuOf('Outro')).getByRole('menuitem', { name: 'Delete' }));
                await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Couldn't delete the scene: denied"));
            });
        });

        describe('a decided decision', () => {
            const decided = () => {
                mockState = {
                    ...mockState,
                    scenes: decisionFixture().map(item => {
                        if (item.id === 'split') return { ...item, beats: [{ ...item.beats[0], chosenOptionId: 'oa' }] };
                        if (item.id === 'b') return { ...item, status: 'skipped' };
                        return item;
                    }),
                };
                open();
            };

            test('shows which path was taken and offers to keep or discard the one that didn\'t happen', async () => {
                decided();
                expect(screen.getByText('Decided: Front door')).toBeInTheDocument();
                expect(screen.getByText('Taken')).toBeInTheDocument();
                expect(screen.getByText("Didn't happen")).toBeInTheDocument();
                fireEvent.click(screen.getByRole('button', { name: 'Keep for later' }));
                await waitFor(() => expect(mockUpdateScene).toHaveBeenCalledWith('b', { benched: true }));
                fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
                await waitFor(() => expect(mockDeleteScene).toHaveBeenCalledWith('b'));
                // the decision forgets the scene that was thrown away
                expect(mockUpdateScene).toHaveBeenCalledWith('split', expect.objectContaining({ beats: expect.any(Array) }));
            });
        });

        describe('the bench', () => {
            const benched = () => {
                mockState = { ...mockState, scenes: [...decisionFixture(), scene('kept', { name: 'Kept', benched: true, status: 'skipped', branch: { fromSceneId: 'split', optionId: 'ob' } })] };
                open();
            };

            test('lists benched scenes and brings one back to the end of this session', async () => {
                benched();
                // eslint-disable-next-line testing-library/no-node-access -- a scene row is a plain container with no role or name to query by
                const row = screen.getByText('Kept').closest('.Scenes-bench-row');
                fireEvent.click(within(row).getByRole('button', { name: 'Bring back' }));
                await waitFor(() => expect(mockUpdateScene).toHaveBeenCalledWith('kept', expect.objectContaining({ benched: false, branch: null, status: 'draft', sessionId: 's1' })));
                expect(mockUpdateScene.mock.calls.find(call => call[0] === 'kept')[1].order).toBeGreaterThan(3);
            });

            test('or discards it', async () => {
                benched();
                // eslint-disable-next-line testing-library/no-node-access -- a scene row is a plain container with no role or name to query by
                fireEvent.click(within(screen.getByText('Kept').closest('.Scenes-bench-row')).getByRole('button', { name: 'Discard' }));
                await waitFor(() => expect(mockDeleteScene).toHaveBeenCalledWith('kept'));
            });
        });
    });

    describe('New Scene', () => {
        const openDialog = () => {
            renderTab({ route: '/directors/camp-1?session=s1' });
            fireEvent.click(screen.getAllByRole('button', { name: '+ New Scene' })[0]);
            return screen.getByRole('dialog', { name: 'New Scene' });
        };

        test('Create needs a name', () => {
            const dialog = openDialog();
            expect(within(dialog).getByRole('button', { name: /Create/ })).toBeDisabled();
        });

        test('creates the scene at the end of the session with the type, date and time goal, then opens it in the builder', async () => {
            const dialog = openDialog();
            fireEvent.change(within(dialog).getByPlaceholderText('e.g. Aftermath'), { target: { value: 'Aftermath' } });
            fireEvent.click(within(dialog).getByRole('button', { name: 'Combat' }));
            fireEvent.change(within(dialog).getByPlaceholderText('e.g. Dec 21'), { target: { value: 'Dec 21' } });
            fireEvent.change(within(dialog).getByPlaceholderText('e.g. 8'), { target: { value: '8' } });
            fireEvent.change(within(dialog).getByPlaceholderText('e.g. 12'), { target: { value: '12' } });

            fireEvent.click(within(dialog).getByRole('button', { name: /Create/ }));

            await waitFor(() => expect(mockCreateScene).toHaveBeenCalled());
            expect(mockCreateScene.mock.calls[0][0]).toMatchObject({ sessionId: 's1', name: 'Aftermath', type: 'combat', inWorldDate: 'Dec 21', timeMin: 8, timeMax: 12 });
            expect(mockCreateScene.mock.calls[0][0].order).toBeGreaterThan(3);
            expect(await screen.findByRole('textbox', { name: 'Scene name' })).toBeInTheDocument();
        });

        test('can place the new scene after a chosen scene, or first', async () => {
            const dialog = openDialog();
            fireEvent.change(within(dialog).getByPlaceholderText('e.g. Aftermath'), { target: { value: 'Between' } });
            fireEvent.change(within(dialog).getByDisplayValue('At the end'), { target: { value: 'intro' } });
            fireEvent.click(within(dialog).getByRole('button', { name: /Create/ }));
            await waitFor(() => expect(mockCreateScene).toHaveBeenCalled());
            expect(mockCreateScene.mock.calls[0][0].order).toBeGreaterThan(1);
            expect(mockCreateScene.mock.calls[0][0].order).toBeLessThan(2);
        });

        test('first puts it before everything', async () => {
            const dialog = openDialog();
            fireEvent.change(within(dialog).getByPlaceholderText('e.g. Aftermath'), { target: { value: 'Prologue' } });
            fireEvent.change(within(dialog).getByDisplayValue('At the end'), { target: { value: 'first' } });
            fireEvent.click(within(dialog).getByRole('button', { name: /Create/ }));
            await waitFor(() => expect(mockCreateScene).toHaveBeenCalled());
            expect(mockCreateScene.mock.calls[0][0].order).toBeLessThan(1);
        });

        test('duplicating copies another scene\'s premise and beats', async () => {
            const dialog = openDialog();
            fireEvent.change(within(dialog).getByPlaceholderText('e.g. Aftermath'), { target: { value: 'Copy' } });
            fireEvent.click(within(dialog).getByRole('button', { name: 'Duplicate scene' }));
            expect(within(dialog).getByRole('button', { name: /Create/ })).toBeDisabled();
            fireEvent.change(within(dialog).getByRole('combobox', { name: 'Scene to duplicate' }), { target: { value: 'intro' } });
            fireEvent.click(within(dialog).getByRole('button', { name: /Create/ }));
            await waitFor(() => expect(mockCreateScene).toHaveBeenCalled());
            const fields = mockCreateScene.mock.calls[0][0];
            expect(fields.premise).toBe('Kal is tied up');
            expect(fields.beats).toHaveLength(1);
            expect(fields.beats[0].id).not.toBe('i1');
        });

        test('Cancel and Escape close it without creating anything', () => {
            const dialog = openDialog();
            fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            openDialog();
            fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(mockCreateScene).not.toHaveBeenCalled();
        });

        test('a failed create is alerted and the dialog stays', async () => {
            mockCreateScene.mockRejectedValue(new Error('denied'));
            const dialog = openDialog();
            fireEvent.change(within(dialog).getByPlaceholderText('e.g. Aftermath'), { target: { value: 'X' } });
            fireEvent.click(within(dialog).getByRole('button', { name: /Create/ }));
            await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Couldn't create the scene: denied"));
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        test('from the campaign view with no session yet, one is made first', async () => {
            mockState = { sessions: [], scenes: [], status: 'ready' };
            mockCreateSession.mockImplementation(async () => {
                mockState = { ...mockState, sessions: [{ id: 's1', number: 1, order: 1 }] };
                return 's1';
            });
            renderTab();
            fireEvent.click(screen.getByRole('button', { name: '+ New Session' }));
            await screen.findByRole('heading', { name: 'Session 1' });
        });
    });

    describe('deciding', () => {
        const openDecision = () => {
            renderTab({ route: '/directors/camp-1?session=s1' });
            fireEvent.click(screen.getByRole('button', { name: 'Decide…' }));
            return screen.getByRole('dialog', { name: 'Which way did the party go?' });
        };

        test('lists the paths, preselects the first, and confirming records it, marks the other as not happening and benches it', async () => {
            const dialog = openDecision();
            expect(within(dialog).getByText('A · Front door')).toBeInTheDocument();
            expect(within(dialog).getByText(/Front is queued as the next scene/)).toBeInTheDocument();
            expect(within(dialog).getByText(/Stage run is marked "Didn't happen"/)).toBeInTheDocument();

            fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm: Front door' }));

            await waitFor(() => expect(mockUpdateScene).toHaveBeenCalledWith('b', { status: 'skipped', benched: true }));
            expect(mockUpdateScene).toHaveBeenCalledWith('split', { beats: [expect.objectContaining({ id: 'd1', chosenOptionId: 'oa' })] });
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        });

        test('picking the other path and discarding throws the unchosen scene away', async () => {
            const dialog = openDecision();
            fireEvent.click(within(dialog).getByRole('button', { name: /B · Stage/ }));
            fireEvent.click(within(dialog).getByLabelText('Discard'));
            fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm: Stage' }));
            await waitFor(() => expect(mockDeleteDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1', 'scenes', 'a'] }));
            expect(mockUpdateScene).toHaveBeenCalledWith('split', { beats: [expect.objectContaining({ chosenOptionId: 'ob' })] });
        });

        test('Not yet closes it without changing anything', () => {
            const dialog = openDecision();
            fireEvent.click(within(dialog).getByRole('button', { name: 'Not yet' }));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(mockUpdateScene).not.toHaveBeenCalled();
        });

        test('a path the party invented on the spot becomes a new option with its own scene, and can be chosen', async () => {
            mockCreateScene.mockResolvedValue('improv');
            const dialog = openDecision();
            fireEvent.click(within(dialog).getByRole('button', { name: /The party did something else/ }));
            fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name the new path' }), { target: { value: 'Burn it all down' } });
            fireEvent.click(within(dialog).getByRole('button', { name: 'Add path' }));

            await waitFor(() => expect(mockCreateScene).toHaveBeenCalledWith(expect.objectContaining({ name: 'Burn it all down', sessionId: 's1' })));
            await waitFor(() => expect(mockUpdateScene.mock.calls.find(call => call[0] === 'split')).toBeTruthy());
            const saved = mockUpdateScene.mock.calls.find(call => call[0] === 'split')[1].beats[0];
            expect(saved.options).toHaveLength(3);
            expect(saved.options[2]).toMatchObject({ label: 'Burn it all down', sceneId: 'improv' });
            // the new scene is made as a path of that option from the start, so it never sits on the main line
            expect(mockCreateScene).toHaveBeenCalledWith(expect.objectContaining({ branch: { fromSceneId: 'split', optionId: saved.options[2].id } }));
        });

        test('a failed decision is alerted and the dialog stays open', async () => {
            mockUpdateScene.mockRejectedValue(new Error('denied'));
            const dialog = openDecision();
            fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm: Front door' }));
            await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Couldn't save the decision: denied"));
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });

    describe('Build Scene', () => {
        const build = (id = 'intro') => renderTab({ route: `/directors/camp-1?view=build&scene=${id}` });

        test('with no scene chosen, opens the next one still to do rather than asking you to pick', () => {
            renderTab({ route: '/directors/camp-1?view=build' });
            // the intro is completed, so it is the second scene (the one that ends in a decision)
            expect(screen.getByRole('textbox', { name: 'Scene name' })).toHaveValue('Split');
        });

        test('with no scenes at all, offers to make the first', async () => {
            mockState = { sessions: [], scenes: [], status: 'ready' };
            mockCreateSession.mockImplementation(async () => {
                mockState = { ...mockState, sessions: [{ id: 's1', number: 1, order: 1 }] };
                return 's1';
            });
            renderTab({ route: '/directors/camp-1?view=build' });
            expect(screen.getByText(/There are no scenes to build yet/)).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Make the first one' }));
            expect(await screen.findByRole('dialog', { name: 'New Scene' })).toBeInTheDocument();
        });

        test('Build Scene from the timeline opens the scene you were last in, even in another session', () => {
            renderTab({ route: '/directors/camp-1?session=s1' });
            fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[4]);
            expect(screen.getByRole('textbox', { name: 'Scene name' })).toHaveValue('Outro');
            fireEvent.click(screen.getByRole('button', { name: 'Session 1' }));
            fireEvent.click(screen.getByRole('button', { name: 'Build Scene' }));
            expect(screen.getByRole('textbox', { name: 'Scene name' })).toHaveValue('Outro');
        });

        test('Build Scene with nothing opened yet goes to the next scene to do in the session you are looking at', () => {
            renderTab({ route: '/directors/camp-1?session=s1' });
            fireEvent.click(screen.getByRole('button', { name: 'Build Scene' }));
            expect(screen.getByRole('textbox', { name: 'Scene name' })).toHaveValue('Split');
        });

        test('shows the scene\'s name, premise, beats and settings', () => {
            build();
            expect(screen.getByRole('textbox', { name: 'Scene name' })).toHaveValue('Intro');
            expect(screen.getByDisplayValue('Kal is tied up')).toBeInTheDocument();
            expect(screen.getByRole('textbox', { name: 'Beat title' })).toHaveValue('Setup');
            expect(screen.getByRole('textbox', { name: 'Narration text' })).toHaveValue('One.\n\nTwo.');
            expect(screen.getByText(/~1 min read aloud/)).toBeInTheDocument();
        });

        test('edits are saved after a pause with only what changed, and Save Draft saves right away', async () => {
            build();
            fireEvent.change(screen.getByRole('textbox', { name: 'Scene name' }), { target: { value: 'The Intro' } });
            expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes…');
            fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
            await waitFor(() => expect(mockUpdateScene).toHaveBeenCalledWith('intro', { name: 'The Intro', status: 'draft' }));
            await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('All changes saved'));
        });

        test('Mark Ready sets the status', async () => {
            build();
            fireEvent.click(screen.getByRole('button', { name: 'Mark Ready' }));
            await waitFor(() => expect(mockUpdateScene).toHaveBeenCalledWith('intro', { status: 'ready' }));
        });

        test('a scene with no beats can\'t be marked ready or run', () => {
            build('outro');
            expect(screen.getByRole('button', { name: 'Mark Ready' })).toBeDisabled();
            expect(screen.getByRole('button', { name: /Run This Scene/ })).toBeDisabled();
            expect(screen.getByText(/No beats yet/)).toBeInTheDocument();
        });

        test('Run This Scene saves, then opens the runner', async () => {
            build();
            fireEvent.change(screen.getByRole('textbox', { name: 'Scene name' }), { target: { value: 'Changed' } });
            fireEvent.click(screen.getByRole('button', { name: /Run This Scene/ }));
            await waitFor(() => expect(mockUpdateScene).toHaveBeenCalledWith('intro', { name: 'Changed' }));
            expect(await screen.findByRole('button', { name: 'Start scene' })).toBeInTheDocument();
        });

        test('a failed save is said, not hidden', async () => {
            mockUpdateScene.mockRejectedValue(new Error('offline'));
            build();
            fireEvent.change(screen.getByRole('textbox', { name: 'Scene name' }), { target: { value: 'x' } });
            fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
            await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent("Couldn't save"));
        });

        test('setting the scene type, date, episode and time goal', async () => {
            build();
            fireEvent.click(within(screen.getByRole('group', { name: 'Scene type' })).getByRole('button', { name: 'Combat' }));
            fireEvent.change(screen.getByLabelText('In-world date'), { target: { value: 'Dec 22' } });
            fireEvent.change(screen.getByLabelText('Episode'), { target: { value: 'Episode 3' } });
            fireEvent.change(screen.getByLabelText('Goal from (min)'), { target: { value: '30' } });
            fireEvent.change(screen.getByLabelText('to (min)'), { target: { value: '50' } });
            expect(screen.getByText('Time goal: 30–50 min')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
            await waitFor(() => expect(mockUpdateScene).toHaveBeenCalledWith('intro', expect.objectContaining({ type: 'combat', inWorldDate: 'Dec 22', episode: 'Episode 3', timeMin: 30, timeMax: 50 })));
        });

        describe('beats', () => {
            const addBeat = name => {
                fireEvent.click(screen.getByRole('button', { name: /Add beat/ }));
                fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: new RegExp(name) }));
            };
            const savedBeats = async () => {
                fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
                await waitFor(() => expect(mockUpdateScene).toHaveBeenCalled());
                return mockUpdateScene.mock.calls.find(call => call[1].beats)[1].beats;
            };

            test.each([
                ['Narration', 'narration'], ['NPC', 'npc'], ['Check', 'check'], ['Combat', 'combat'], ['Cue', 'cue'], ['Decision', 'decision'],
            ])('adds a %s beat', async (label, type) => {
                build('outro');
                addBeat(label);
                const beats = await savedBeats();
                expect(beats).toHaveLength(1);
                expect(beats[0].type).toBe(type);
            });

            test('each kind of beat can be filled in', async () => {
                build('outro');
                addBeat('NPC');
                fireEvent.change(screen.getByLabelText('NPC name'), { target: { value: 'Snotty' } });
                fireEvent.change(screen.getByLabelText('Voice and behaviors (one per line)'), { target: { value: 'Rude\nLoud' } });
                addBeat('Check');
                fireEvent.change(screen.getByLabelText('Skill or stat'), { target: { value: 'Dex' } });
                fireEvent.change(screen.getByLabelText('DC'), { target: { value: '12' } });
                fireEvent.change(screen.getByLabelText('What happens on a success or a failure'), { target: { value: 'Slips' } });
                addBeat('Cue');
                fireEvent.change(screen.getByLabelText('Note to yourself'), { target: { value: 'Steer them' } });
                fireEvent.change(screen.getByLabelText('Comes due (optional)'), { target: { value: 'Round 2' } });
                addBeat('Narration');
                fireEvent.change(screen.getByLabelText('Narrator'), { target: { value: 'Jonah' } });
                fireEvent.change(screen.getByRole('textbox', { name: 'Narration text' }), { target: { value: 'Hello there' } });
                const beats = await savedBeats();
                expect(beats[0]).toMatchObject({ npcName: 'Snotty', behaviors: 'Rude\nLoud' });
                expect(beats[1]).toMatchObject({ skill: 'Dex', dc: '12', text: 'Slips' });
                expect(beats[2]).toMatchObject({ text: 'Steer them', trigger: 'Round 2' });
                expect(beats[3]).toMatchObject({ narrator: 'Jonah', text: 'Hello there' });
                expect(screen.getByText('Snotty · beat 1')).toBeInTheDocument();
            });

            test('a combat beat picks a map and an encounter and shows their zones and roster', async () => {
                mockEncounters = [{ id: 'e1', name: 'Ambush', roster: [{ enemy: { enemy_name: 'Goblin' }, count: 3 }] }];
                renderTab({ route: '/directors/camp-1?view=build&scene=outro', maps: [{ map_id: 'm1', zones: [{ name: 'Gate' }, { name: 'Yard' }] }, { map_id: 'm2', zones: [] }] });
                addBeat('Combat');
                expect(screen.getByText('Pick a map to see its zones.')).toBeInTheDocument();
                fireEvent.change(screen.getByLabelText('Map'), { target: { value: 'm1' } });
                fireEvent.change(screen.getByLabelText('Encounter'), { target: { value: 'e1' } });
                fireEvent.change(screen.getByLabelText('Ruling (pinned while running)'), { target: { value: 'Sound -1' } });
                fireEvent.change(screen.getByLabelText('Time (min)'), { target: { value: '25' } });
                expect(screen.getByText('Gate')).toBeInTheDocument();
                expect(screen.getByText('Goblin ×3')).toBeInTheDocument();
                fireEvent.change(screen.getByLabelText('Map'), { target: { value: 'm2' } });
                expect(screen.getByText(/This map has no zones yet/)).toBeInTheDocument();
                const beats = await savedBeats();
                expect(beats[0]).toMatchObject({ encounterId: 'e1', mapId: 'm2', ruling: 'Sound -1', minutes: 25 });
            });

            test('a combat beat with no encounter or enemies says what to do', () => {
                mockEncounters = [{ id: 'e1', name: 'Empty', roster: [] }];
                build('outro');
                addBeat('Combat');
                expect(screen.getByText(/Pick an encounter to stage/)).toBeInTheDocument();
                fireEvent.change(screen.getByLabelText('Encounter'), { target: { value: 'e1' } });
                expect(screen.getByText('This encounter has no enemies yet.')).toBeInTheDocument();
            });

            test('beats can be moved, duplicated, deleted, collapsed and expanded', async () => {
                build();
                addBeat('Cue');
                fireEvent.change(screen.getAllByRole('textbox', { name: 'Beat title' })[1], { target: { value: 'Second' } });
                // move the second beat up
                fireEvent.click(screen.getByRole('button', { name: 'More options for beat 2' }));
                fireEvent.click(screen.getByRole('menuitem', { name: 'Move up' }));
                expect(screen.getAllByRole('textbox', { name: 'Beat title' })[0]).toHaveValue('Second');
                // duplicate it
                fireEvent.click(screen.getByRole('button', { name: 'More options for beat 1' }));
                fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
                expect(screen.getAllByRole('textbox', { name: 'Beat title' })).toHaveLength(3);
                // delete one
                fireEvent.click(screen.getByRole('button', { name: 'More options for beat 3' }));
                fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
                expect(screen.getAllByRole('textbox', { name: 'Beat title' })).toHaveLength(2);
                // collapse and expand
                fireEvent.click(screen.getByRole('button', { name: 'Collapse beat 1' }));
                expect(screen.getAllByRole('textbox', { name: 'Beat title' })).toHaveLength(1);
                fireEvent.click(screen.getByRole('button', { name: 'Expand beat 1' }));
                expect(screen.getAllByRole('textbox', { name: 'Beat title' })).toHaveLength(2);
            });

            test('the first beat can\'t move up and the last can\'t move down', () => {
                build();
                fireEvent.click(screen.getByRole('button', { name: 'More options for beat 1' }));
                expect(screen.getByRole('menuitem', { name: 'Move up' })).toBeDisabled();
                expect(screen.getByRole('menuitem', { name: 'Move down' })).toBeDisabled();
            });

            test('a cue starts collapsed, showing its title and note', () => {
                mockState = { ...mockState, scenes: [scene('cues', { beats: [beat('c1', 'cue', { title: 'Round 2', text: 'Saph arrives', trigger: 'Round 2' })] })] };
                renderTab({ route: '/directors/camp-1?view=build&scene=cues' });
                expect(screen.queryByRole('textbox', { name: 'Beat title' })).not.toBeInTheDocument();
                expect(screen.getByText('Saph arrives')).toBeInTheDocument();
            });

            test('a beat\'s minutes feed the time estimate', () => {
                mockState = { ...mockState, scenes: [scene('timed', { beats: [beat('c1', 'check', { title: 'Roll', minutes: 5 })] })] };
                renderTab({ route: '/directors/camp-1?view=build&scene=timed' });
                expect(screen.getByText('Beats add up to about 5 min.')).toBeInTheDocument();
                fireEvent.change(screen.getByLabelText('Minutes for beat 1'), { target: { value: '9' } });
                expect(screen.getByText('Beats add up to about 9 min.')).toBeInTheDocument();
            });
        });

        describe('a decision beat', () => {
            test('shows its options and where each leads, and saving keeps the linked scenes in step', async () => {
                build('split');
                expect(screen.getByRole('textbox', { name: 'Decision question' })).toHaveValue('Where now?');
                expect(screen.getByLabelText('Option A leads to')).toHaveValue('a');
                expect(screen.getByLabelText('Option B leads to')).toHaveValue('b');
                // point B at the outro instead: the stage run goes back to the main line, the outro becomes a path
                fireEvent.change(screen.getByLabelText('Option B leads to'), { target: { value: 'outro' } });
                fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
                await waitFor(() => expect(mockUpdateScene).toHaveBeenCalledWith('outro', { branch: { fromSceneId: 'split', optionId: 'ob' }, sessionId: 's1' }));
                expect(mockUpdateScene).toHaveBeenCalledWith('b', { branch: null });
            });

            test('Build it now makes a scene for an option that has none and links it', async () => {
                mockCreateScene.mockResolvedValue('built');
                build('split');
                fireEvent.change(screen.getByLabelText('Option B leads to'), { target: { value: '' } });
                fireEvent.click(screen.getByRole('button', { name: 'Build it now' }));
                await waitFor(() => expect(mockCreateScene).toHaveBeenCalledWith(expect.objectContaining({ name: 'Stage', sessionId: 's1', branch: { fromSceneId: 'split', optionId: 'ob' } })));
                fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
                await waitFor(() => expect(mockUpdateScene).toHaveBeenCalledWith('split', expect.objectContaining({ beats: [expect.objectContaining({ options: [expect.anything(), expect.objectContaining({ sceneId: 'built' })] })] })));
            });

            test('options can be added and removed (never below two), and the method and rejoin point set', async () => {
                build('split');
                expect(screen.queryByRole('button', { name: 'Remove option A' })).not.toBeInTheDocument();
                fireEvent.click(screen.getByRole('button', { name: '+ Add option' }));
                expect(screen.getByLabelText('Option C label')).toBeInTheDocument();
                fireEvent.click(screen.getByRole('button', { name: 'Remove option C' }));
                expect(screen.queryByLabelText('Option C label')).not.toBeInTheDocument();
                fireEvent.click(screen.getByRole('button', { name: 'Random table (d6)' }));
                fireEvent.change(screen.getByLabelText('Paths rejoin at'), { target: { value: 'outro' } });
                fireEvent.change(screen.getByLabelText('Option A label'), { target: { value: 'Kick the door' } });
                fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
                await waitFor(() => expect(mockUpdateScene).toHaveBeenCalled());
                const saved = mockUpdateScene.mock.calls.find(call => call[0] === 'split' && call[1].beats)[1].beats[0];
                expect(saved).toMatchObject({ method: 'random', rejoinSceneId: 'outro' });
                expect(saved.options[0].label).toBe('Kick the door');
            });

            test('the side panel says what path a branch scene belongs to, and what a scene ends with', () => {
                build('a');
                expect(screen.getByText('This scene is a path of a decision in')).toBeInTheDocument();
                fireEvent.click(screen.getByRole('button', { name: 'Split' }));
                expect(screen.getByRole('textbox', { name: 'Scene name' })).toHaveValue('Split');
                expect(screen.getByText('Decision: Where now?')).toBeInTheDocument();
            });
        });

        test('the back link returns to the session\'s timeline', () => {
            build();
            fireEvent.click(screen.getByRole('button', { name: 'Session 1' }));
            expect(screen.getByRole('heading', { name: 'Session 1' })).toBeInTheDocument();
        });
    });

    describe('Run Scene', () => {
        const live = (fields = {}) => {
            const beats = [beat('b1', 'narration', { title: 'Setup', text: 'Para one.\n\nPara two.', narrator: 'Jonah' }), beat('b2', 'cue', { title: 'Refresher', text: 'Saph shows up' }), beat('b3', 'npc', { title: 'Bully', npcName: 'Snotty', behaviors: 'Rude\nLoud' })];
            mockState = {
                ...mockState,
                scenes: [scene('run', { name: 'Run me', status: 'active', timeMin: 30, timeMax: 50, beats, run: { startedAt: Date.now(), accumulatedMs: 0, currentBeatId: 'b1', doneBeatIds: [] }, ...fields }), ...decisionFixture().filter(item => item.id === 'intro')],
            };
        };
        const run = (id = 'run', props = {}) => renderTab({ route: `/directors/camp-1?view=run&scene=${id}`, ...props });

        test('with no scene live, offers the next one that has beats to start', () => {
            renderTab({ route: '/directors/camp-1?view=run' });
            expect(screen.getByRole('heading', { name: 'Split' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Start scene' })).toBeInTheDocument();
        });

        test('with no scene chosen, opens the one that is live', () => {
            live();
            renderTab({ route: '/directors/camp-1?view=run' });
            expect(screen.getByRole('heading', { name: 'Run me' })).toBeInTheDocument();
        });

        test('a scene not yet started offers to start it, pausing any other live scene', async () => {
            mockState = { ...mockState, scenes: decisionFixture().map(item => item.id === 'outro' ? { ...item, status: 'active', run: { startedAt: 5, accumulatedMs: 0 } } : item) };
            run('intro');
            fireEvent.click(screen.getByRole('button', { name: 'Start scene' }));
            await waitFor(() => expect(mockUpdateScene).toHaveBeenCalledWith('intro', { status: 'active', run: expect.objectContaining({ currentBeatId: 'i1', startedAt: expect.any(Number) }) }));
            expect(mockUpdateScene).toHaveBeenCalledWith('outro', { status: 'ready', run: expect.objectContaining({ startedAt: null }) });
        });

        test('a scene with no beats can\'t be started', () => {
            run('outro');
            expect(screen.getByRole('button', { name: 'Start scene' })).toBeDisabled();
            expect(screen.getByText(/no beats yet/)).toBeInTheDocument();
        });

        test('a scene that was already run is resumed, and can go back to the builder', () => {
            mockState = { ...mockState, scenes: decisionFixture().map(item => item.id === 'intro' ? { ...item, run: { doneBeatIds: ['i1'], accumulatedMs: 1000 } } : item) };
            run('intro');
            expect(screen.getByText(/has been run/)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Resume scene' })).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Edit in Build Scene' }));
            expect(screen.getByRole('textbox', { name: 'Scene name' })).toBeInTheDocument();
        });

        test('shows the live scene: where it is, the clock against the goal, the beat rail and the current beat', () => {
            live();
            run();
            expect(screen.getByText('Live · Beat 1 of 3')).toBeInTheDocument();
            expect(screen.getByText('of 30–50 min')).toBeInTheDocument();
            expect(screen.getByLabelText('Time elapsed')).toHaveTextContent(/^0:0\d$/);
            const rail = screen.getByRole('navigation', { name: 'Beats' });
            expect(within(rail).getByText('Now · Narration')).toBeInTheDocument();
            expect(within(rail).getAllByText(/Upcoming/)).toHaveLength(2);
            expect(screen.getByText('Narrator: Jonah')).toBeInTheDocument();
        });

        test('a narration is read a paragraph at a time and its text size can be changed', () => {
            live();
            run();
            expect(screen.getByText('Para one.')).toBeInTheDocument();
            expect(screen.getByText('paragraph 1 of 2')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Larger text' }));
            expect(screen.getByText('Para one.')).toHaveStyle({ fontSize: '24px' });
            fireEvent.click(screen.getByRole('button', { name: 'Smaller text' }));
            expect(screen.getByText('Para one.')).toHaveStyle({ fontSize: '20px' });
            fireEvent.click(screen.getByRole('button', { name: 'Mark read & show next paragraph' }));
            expect(screen.getByText('Para two.')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'All read' })).toBeDisabled();
        });

        test('the text size stops at its smallest and largest', () => {
            live();
            run();
            for (let i = 0; i < 6; i += 1) fireEvent.click(screen.getByRole('button', { name: 'Larger text' }));
            expect(screen.getByRole('button', { name: 'Larger text' })).toBeDisabled();
            for (let i = 0; i < 6; i += 1) fireEvent.click(screen.getByRole('button', { name: 'Smaller text' }));
            expect(screen.getByRole('button', { name: 'Smaller text' })).toBeDisabled();
        });

        test('a narration with nothing written says so', () => {
            live({ beats: [beat('b1', 'narration', { title: 'Empty' })], run: { startedAt: 1, accumulatedMs: 0, currentBeatId: 'b1', doneBeatIds: [] } });
            run();
            expect(screen.getByText(/nothing written for this narration/)).toBeInTheDocument();
        });

        test('Next beat marks the beat done and moves on, and the last beat leaves nothing to run', async () => {
            live();
            run();
            fireEvent.click(screen.getByRole('button', { name: 'Next beat →' }));
            await waitFor(() => expect(mockUpdateScene).toHaveBeenCalledWith('run', { run: expect.objectContaining({ currentBeatId: 'b2', doneBeatIds: ['b1'] }) }));
        });

        test('a cue shows its note and Mark done moves on', async () => {
            live({ run: { startedAt: 1, accumulatedMs: 0, currentBeatId: 'b2', doneBeatIds: ['b1'] } });
            run();
            expect(screen.getByText('Saph shows up')).toBeInTheDocument();
            expect(screen.getByText('Director only')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Mark done' }));
            await waitFor(() => expect(mockUpdateScene).toHaveBeenCalledWith('run', { run: expect.objectContaining({ currentBeatId: 'b3' }) }));
        });

        test('an NPC beat lists its behaviors, and a check beat its skill, DC and ruling', () => {
            live({ run: { startedAt: 1, accumulatedMs: 0, currentBeatId: 'b3', doneBeatIds: [] } });
            const { unmount } = run();
            expect(screen.getByText('Snotty')).toBeInTheDocument();
            expect(screen.getByText('Rude')).toBeInTheDocument();
            expect(screen.queryByText('Up next')).not.toBeInTheDocument();
            unmount();
            live({ beats: [beat('c1', 'check', { title: 'Sneak', skill: 'Dex', dc: '12', text: 'Slips past' })], run: { startedAt: 1, accumulatedMs: 0, currentBeatId: 'c1', doneBeatIds: [] } });
            run();
            expect(screen.getByText('Dex · DC 12')).toBeInTheDocument();
            expect(screen.getByText('Slips past')).toBeInTheDocument();
        });

        test('clicking a beat in the rail jumps to it', async () => {
            live();
            run();
            fireEvent.click(within(screen.getByRole('navigation', { name: 'Beats' })).getByRole('button', { name: /3 · Bully/ }));
            await waitFor(() => expect(mockUpdateScene).toHaveBeenCalledWith('run', { run: expect.objectContaining({ currentBeatId: 'b3' }) }));
        });

        test.each([['Cue', 'cue'], ['Combat', 'combat'], ['Narration', 'narration']])('+ Add beat on the fly offers a %s beat, put right after the current one, and jumps to it', async (label, type) => {
            live();
            run();
            fireEvent.click(screen.getByRole('button', { name: '+ Add beat on the fly' }));
            fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: label }));
            await waitFor(() => expect(mockUpdateScene).toHaveBeenCalled());
            const patch = mockUpdateScene.mock.calls[0][1];
            expect(patch.beats.map(item => item.id)[0]).toBe('b1');
            expect(patch.beats[1]).toMatchObject({ type, title: `Improvised ${label.toLowerCase()}` });
            expect(patch.run.currentBeatId).toBe(patch.beats[1].id);
            expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        });

        test('the clock can be paused and resumed', async () => {
            live();
            run();
            fireEvent.click(screen.getByRole('button', { name: 'Pause clock' }));
            await waitFor(() => expect(mockUpdateScene).toHaveBeenCalledWith('run', { run: expect.objectContaining({ startedAt: null }) }));
        });

        test('a paused scene says so and resumes its clock', async () => {
            live({ run: { startedAt: null, accumulatedMs: 65000, currentBeatId: 'b1', doneBeatIds: [] } });
            run();
            expect(screen.getByText('Paused · Beat 1 of 3')).toBeInTheDocument();
            expect(screen.getByLabelText('Time elapsed')).toHaveTextContent('1:05');
            fireEvent.click(screen.getByRole('button', { name: 'Resume clock' }));
            await waitFor(() => expect(mockUpdateScene).toHaveBeenCalledWith('run', { run: expect.objectContaining({ startedAt: expect.any(Number), accumulatedMs: 65000 }) }));
        });

        test('with no time goal there is nothing to measure against', () => {
            live({ timeMin: null, timeMax: null });
            run();
            expect(screen.getByText('no time goal')).toBeInTheDocument();
        });

        test('the clock ticks while it runs', () => {
            jest.useFakeTimers();
            try {
                live();
                run();
                act(() => { jest.advanceTimersByTime(3000); });
                expect(screen.getByLabelText('Time elapsed')).not.toHaveTextContent('0:00');
            } finally {
                jest.useRealTimers();
            }
        });

        test('the scratchpad saves to the beat when you leave it, only if it changed', async () => {
            live();
            run();
            const pad = screen.getByRole('textbox', { name: 'Director scratchpad' });
            fireEvent.blur(pad);
            expect(mockUpdateScene).not.toHaveBeenCalled();
            fireEvent.change(pad, { target: { value: 'Let Leon throw first' } });
            fireEvent.blur(pad);
            await waitFor(() => expect(mockUpdateScene).toHaveBeenCalledWith('run', { beats: expect.arrayContaining([expect.objectContaining({ id: 'b1', notes: 'Let Leon throw first' })]) }));
        });

        test('End Scene completes it and returns to the session', async () => {
            live();
            run();
            fireEvent.click(screen.getByRole('button', { name: 'End Scene' }));
            await waitFor(() => expect(mockUpdateScene).toHaveBeenCalledWith('run', { status: 'completed', run: expect.objectContaining({ startedAt: null }) }));
            expect(await screen.findByRole('heading', { name: 'Session 1' })).toBeInTheDocument();
        });

        test('ending the scene tells the page, so what lasted only for the scene can end with it', async () => {
            const onSceneEnded = jest.fn();
            live();
            run('run', { onSceneEnded });
            fireEvent.click(screen.getByRole('button', { name: 'End Scene' }));
            await waitFor(() => expect(onSceneEnded).toHaveBeenCalledTimes(1));
        });

        test('with every beat done, offers to end the scene', () => {
            live({ run: { startedAt: 1, accumulatedMs: 0, currentBeatId: '', doneBeatIds: ['b1', 'b2', 'b3'] } });
            run();
            expect(screen.getByText('Every beat is done.')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Next beat →' })).toBeDisabled();
        });

        test('Switch Scene pauses this one and starts the other', async () => {
            live();
            mockState.scenes.push(scene('other', { name: 'Other', beats: [beat('o1', 'cue', { title: 'Hi' })] }));
            run();
            fireEvent.change(screen.getByRole('combobox', { name: 'Switch scene' }), { target: { value: 'other' } });
            await waitFor(() => expect(mockUpdateScene).toHaveBeenCalledWith('other', { status: 'active', run: expect.objectContaining({ currentBeatId: 'o1' }) }));
            expect(mockUpdateScene).toHaveBeenCalledWith('run', { status: 'ready', run: expect.objectContaining({ startedAt: null }) });
            expect(await screen.findByRole('heading', { name: 'Other' })).toBeInTheDocument();
        });

        describe('a decision beat', () => {
            const decisionRun = () => {
                live({
                    beats: [beat('d1', 'decision', { title: 'Which way?', options: [{ id: 'oa', label: 'Left', sceneId: 'intro' }, { id: 'ob', label: 'Right', sceneId: '' }] })],
                    run: { startedAt: 1, accumulatedMs: 0, currentBeatId: 'd1', doneBeatIds: [] },
                });
                run();
            };

            test('lists the options and opens the decision popup', () => {
                decisionRun();
                expect(screen.getByText('A · Left')).toBeInTheDocument();
                expect(screen.getByText('B · Right')).toBeInTheDocument();
                fireEvent.click(screen.getByRole('button', { name: 'Decide the path…' }));
                expect(screen.getByRole('dialog', { name: 'Which way did the party go?' })).toBeInTheDocument();
            });
        });

        describe('a combat beat', () => {
            const combatRun = (beatFields = {}, extra = {}) => {
                live({
                    beats: [beat('c1', 'combat', { title: 'The fight', encounterId: 'e1', mapId: 'm1', ruling: 'Sound system: -1 to all', ...beatFields })],
                    run: { startedAt: 1, accumulatedMs: 0, currentBeatId: 'c1', doneBeatIds: [] },
                });
                return renderTab({ route: '/directors/camp-1?view=run&scene=run', maps: [{ map_id: 'm1', zones: [{ name: 'Gate' }, { name: 'Yard' }] }], ...extra });
            };

            test('embeds the combat tracker, puts the enemies in a column of their own, and pins the ruling', () => {
                combatRun();
                expect(screen.getByText('Combat-stub')).toBeInTheDocument();
                expect(within(screen.getByRole('complementary', { name: 'Enemies' })).getByText('Enemies-stub')).toBeInTheDocument();
                expect(screen.getByText('Sound system: -1 to all')).toBeInTheDocument();
            });

            test('Start combat sets the map, stages the encounter onto the fight and the tracker, and remembers it was started', async () => {
                mockGetDoc.mockImplementation(async ref => ref.__party
                    ? { exists: () => true, data: () => ({ combat_tracker: [] }) }
                    : { exists: () => true, data: () => ({ roster: [{ enemy: { enemy_name: 'Goblin', maximum_health: 5 }, count: 2, zone: 'Yard' }] }) });
                combatRun({}, { campaignInfo: { enemy_list: [], active_map: null } });
                fireEvent.click(screen.getByRole('button', { name: /Start combat/ }));
                await waitFor(() => expect(mockUpdateScene).toHaveBeenCalledWith('run', { beats: [expect.objectContaining({ id: 'c1', started: true })] }));
                expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['campaigns', 'camp-1'] }, { active_map: 'm1' });
                const enemyUpdate = mockUpdateDoc.mock.calls.find(call => call[1].enemy_list)[1];
                expect(enemyUpdate.enemy_list).toHaveLength(2);
                expect(mockUpdateCombatTracker).toHaveBeenCalled();
                const posts = mockUpdateCombatTracker.mock.calls[0][1]([]);
                expect(posts).toHaveLength(2);
                expect(posts[0].status).toBe('Yard');
            });

            test('staging again asks first, and does nothing if declined', async () => {
                window.confirm.mockReturnValueOnce(false);
                combatRun({ started: true });
                fireEvent.click(screen.getByRole('button', { name: 'Stage the encounter again' }));
                await waitFor(() => expect(window.confirm).toHaveBeenCalled());
                expect(mockGetDoc).not.toHaveBeenCalled();
                expect(mockUpdateScene).not.toHaveBeenCalled();
            });

            test('an encounter that has since been deleted is said, not staged', async () => {
                mockGetDoc.mockResolvedValue({ exists: () => false });
                combatRun();
                fireEvent.click(screen.getByRole('button', { name: /Start combat/ }));
                await waitFor(() => expect(window.alert).toHaveBeenCalledWith("That encounter doesn't exist any more."));
                expect(mockUpdateScene).not.toHaveBeenCalled();
            });

            test('a failure starting combat is alerted', async () => {
                mockUpdateDoc.mockRejectedValue(new Error('denied'));
                combatRun();
                fireEvent.click(screen.getByRole('button', { name: /Start combat/ }));
                await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Couldn't start the combat: denied"));
            });

            test('a map alone is set without staging anything, and with neither there is no button', async () => {
                const { unmount } = combatRun({ encounterId: '' });
                fireEvent.click(screen.getByRole('button', { name: /Start combat/ }));
                await waitFor(() => expect(mockUpdateScene).toHaveBeenCalled());
                expect(mockGetDoc).not.toHaveBeenCalled();
                unmount();
                combatRun({ encounterId: '', mapId: '' });
                expect(screen.queryByRole('button', { name: /Start combat/ })).not.toBeInTheDocument();
            });

            test('the ruling stays pinned on the beats after the fight', () => {
                live({
                    beats: [beat('c1', 'combat', { title: 'The fight', ruling: 'Sound system: -1' }), beat('n1', 'narration', { title: 'After', text: 'Done.' })],
                    run: { startedAt: 1, accumulatedMs: 0, currentBeatId: 'n1', doneBeatIds: ['c1'] },
                });
                run();
                expect(screen.getByText('Sound system: -1')).toBeInTheDocument();
            });
        });
    });

    describe('Maps and Notes', () => {
        test('are one click from the timeline, and open in a popup over it that closes again', () => {
            renderTab();
            fireEvent.click(screen.getByRole('button', { name: 'Maps' }));
            expect(within(screen.getByRole('dialog', { name: 'Maps' })).getByText('Maps-stub')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Close Maps' }));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
            expect(within(screen.getByRole('dialog', { name: 'Notes' })).getByText('Notes-stub')).toBeInTheDocument();
            fireEvent.keyDown(document.body, { key: 'Escape' });
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        test('the scrim closes the popup too, and they are there from the builder and the runner as well', () => {
            renderTab({ route: '/directors/camp-1?view=build&scene=intro' });
            fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
            fireEvent.click(screen.getByRole('button', { name: 'Close' }));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        test('a combat beat in the builder opens the maps popup', () => {
            mockState = { ...mockState, scenes: [scene('fight', { beats: [beat('c1', 'combat', { title: 'The fight' })] })] };
            renderTab({ route: '/directors/camp-1?view=build&scene=fight' });
            fireEvent.click(screen.getByRole('button', { name: 'Browse maps & edit zones' }));
            expect(screen.getByRole('dialog', { name: 'Maps' })).toBeInTheDocument();
        });

        test('the runner has its own Notes button, as the mockup does', () => {
            mockState = { ...mockState, scenes: [scene('fight', { status: 'active', beats: [beat('c1', 'cue', { title: 'Hi' })], run: { startedAt: 1, accumulatedMs: 0, currentBeatId: 'c1', doneBeatIds: [] } })] };
            renderTab({ route: '/directors/camp-1?view=run&scene=fight' });
            fireEvent.click(screen.getAllByRole('button', { name: 'Notes' })[1]);
            expect(screen.getByRole('dialog', { name: 'Notes' })).toBeInTheDocument();
        });

        test('and so does the combat bar while running a fight', () => {
            mockState = {
                ...mockState,
                scenes: [scene('fight', { status: 'active', beats: [beat('c1', 'combat', { title: 'The fight' })], run: { startedAt: 1, accumulatedMs: 0, currentBeatId: 'c1', doneBeatIds: [] } })],
            };
            renderTab({ route: '/directors/camp-1?view=run&scene=fight' });
            fireEvent.click(screen.getByRole('button', { name: 'Browse maps' }));
            expect(screen.getByRole('dialog', { name: 'Maps' })).toBeInTheDocument();
        });
    });

    describe('the frame', () => {
        test('the page\'s header goes above the nav and its sidebar beside the scenes, in every view', () => {
            renderTab();
            expect(screen.getByText('Header-stub')).toBeInTheDocument();
            expect(screen.getByRole('complementary', { name: 'The party' })).toHaveTextContent('Sidebar-stub:scenes');
            fireEvent.click(screen.getByRole('button', { name: 'Build Scene' }));
            expect(screen.getByText('Sidebar-stub:build')).toBeInTheDocument();
        });
    });

    describe('Encounters', () => {
        test('open in a popup from the nav: the list first, then one encounter, and back to the list', () => {
            renderTab();
            fireEvent.click(screen.getByRole('button', { name: 'Encounters' }));
            const dialog = screen.getByRole('dialog', { name: 'Encounters' });
            expect(within(dialog).getByText('EncountersPage-stub:camp-1')).toBeInTheDocument();
            fireEvent.click(within(dialog).getByRole('button', { name: 'Open encounter' }));
            expect(within(dialog).getByText('EncounterPage-stub:camp-1:enc-9')).toBeInTheDocument();
            fireEvent.click(within(dialog).getByRole('button', { name: 'Back to encounters' }));
            expect(within(dialog).getByText('EncountersPage-stub:camp-1')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Close Encounters' }));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        test('the combat view can open them too', () => {
            mockState = {
                ...mockState,
                scenes: [scene('fight', { status: 'active', beats: [beat('c1', 'combat', { title: 'The fight' })], run: { startedAt: 1, accumulatedMs: 0, currentBeatId: 'c1', doneBeatIds: [] } })],
            };
            renderTab({ route: '/directors/camp-1?view=run&scene=fight', renderCombat: api => ({ main: <button type="button" onClick={() => api.openPanel('encounters')}>Combat-encounters</button>, aside: null }) });
            fireEvent.click(screen.getByRole('button', { name: 'Combat-encounters' }));
            expect(screen.getByRole('dialog', { name: 'Encounters' })).toBeInTheDocument();
        });

        describe('from a combat beat in the builder', () => {
            const build = () => {
                mockEncounters = [{ id: 'e1', name: 'Ambush', roster: [] }];
                mockState = { ...mockState, scenes: [scene('fight', { beats: [beat('c1', 'combat', { title: 'The fight', encounterId: 'e1' }), beat('c2', 'combat', { title: 'Another' })] })] };
                renderTab({ route: '/directors/camp-1?view=build&scene=fight' });
            };

            test('Edit roster opens the chosen encounter', () => {
                build();
                fireEvent.click(screen.getAllByRole('button', { name: 'Edit roster' })[0]);
                expect(screen.getByText('EncounterPage-stub:camp-1:e1')).toBeInTheDocument();
            });

            test('+ New encounter makes an empty one, links it to the beat and opens it', async () => {
                mockAddDoc.mockResolvedValue({ id: 'enc-new' });
                build();
                fireEvent.click(screen.getByRole('button', { name: '+ New encounter' }));
                expect(await screen.findByText('EncounterPage-stub:camp-1:enc-new')).toBeInTheDocument();
                expect(mockAddDoc).toHaveBeenCalledWith({ __collection: ['campaigns', 'camp-1', 'encounters'] }, expect.objectContaining({ name: 'Another', roster: [], stagedIds: [] }));
                fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
                await waitFor(() => expect(mockUpdateScene).toHaveBeenCalledWith('fight', expect.objectContaining({ beats: expect.arrayContaining([expect.objectContaining({ id: 'c2', encounterId: 'enc-new' })]) })));
            });
        });
    });

    describe('the sections', () => {
        test('Build Scene and Run Scene with nothing chosen say what to do, and a live scene is marked', () => {
            mockState = { ...mockState, scenes: decisionFixture().map(item => item.id === 'intro' ? { ...item, status: 'active', run: { startedAt: 1, accumulatedMs: 0, currentBeatId: 'i1', doneBeatIds: [] } } : item) };
            renderTab();
            expect(screen.getByLabelText('a scene is live')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: /Run Scene/ }));
            expect(screen.getByRole('heading', { name: 'Intro' })).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Build Scene' }));
            expect(screen.getByRole('textbox', { name: 'Scene name' })).toHaveValue('Intro');
            fireEvent.click(screen.getByRole('button', { name: 'Scenes' }));
            expect(screen.getByRole('heading', { name: 'Session 1' })).toBeInTheDocument();
        });

        test('with no scenes, the Build and Run sections say there is nothing to open', () => {
            mockState = { ...mockState, scenes: [] };
            renderTab();
            fireEvent.click(screen.getByRole('button', { name: 'Build Scene' }));
            expect(screen.getByText(/There are no scenes to build yet/)).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: /Run Scene/ }));
            expect(screen.getByText(/There are no scenes to run yet/)).toBeInTheDocument();
        });
    });
});
        test('the Party button, next to Notes, opens the party inventory and notes in a popup, and remembers its tab', () => {
            renderTab();
            fireEvent.click(screen.getByRole('button', { name: 'Party' }));
            const popup = screen.getByRole('dialog', { name: 'Party' });
            expect(within(popup).getByText('PartySpace-stub:camp-1:inventory')).toBeInTheDocument();
            fireEvent.click(within(popup).getByRole('button', { name: 'Go to notes' }));
            expect(within(popup).getByText('PartySpace-stub:camp-1:notes')).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Close Party' }));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Party' }));
            expect(screen.getByText('PartySpace-stub:camp-1:notes')).toBeInTheDocument();
        });

