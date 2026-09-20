jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockOnSnapshot = jest.fn();
const mockUpdateDoc = jest.fn();
const mockAddDoc = jest.fn();
// What the party doc's tracker is right now, and what gets saved to it (the party
// module runs each change against it, as its transaction does).
let mockTracker = [];
const mockSaveTracker = jest.fn();
const mockSubscribeParty = jest.fn();
jest.mock('../../src/utils/party', () => ({
    subscribeParty: (...args) => mockSubscribeParty(...args),
    updateCombatTracker: async (campaignId, change) => {
        const next = change(mockTracker);
        if (next) await mockSaveTracker(campaignId, next);
    },
}));
jest.mock('firebase/firestore', () => ({
    doc: (...args) => ({ __doc: args.slice(1) }),
    onSnapshot: (...args) => mockOnSnapshot(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
    arrayUnion: value => ({ __arrayUnion: value }),
    collection: (_db, ...path) => ({ __collection: path }),
    addDoc: (...args) => mockAddDoc(...args),
    deleteDoc: jest.fn(),
    serverTimestamp: () => '__serverTimestamp__',
}));

// The map itself (image sizing, drag and drop) is out of scope here: a stand-in
// that hands its overlay a size, like the real one does once the image loads,
// and records what zoneLayout it was given.
const mockAbstractProps = [];
jest.mock('../../src/utils/DraggableElements/Post.ts', () => ({
    PostListContentAbstract: props => {
        mockAbstractProps.push(props);
        return <div data-testid="map">{props.overlay({ width: 1000, height: 500 })}</div>;
    },
}));

// eslint-disable-next-line import/first
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react';
// eslint-disable-next-line import/first
import { PostListContentCombatMap } from '../../src/utils/DraggableElements/PostListCombatMap.tsx';
// eslint-disable-next-line import/first
import { slotPosition, zoneRects } from '../../src/utils/mapTokens';

const stroke = id => ({ id, color: '#e53935', size: 0.006, points: [0.1, 0.1, 0.4, 0.2] });
const zone = (name, x) => ({ id: name, name, x, y: 10, width: 100, height: 80 });
const activeMap = (extra = {}) => ({ map_id: 'map-1', link: 'map.png', zones: [zone('Zone 1', 10), zone('Zone 2', 200)], canWrite: ['director-1'], strokes: [stroke('a')], ...extra });

beforeEach(() => {
    mockAbstractProps.length = 0;
    mockUpdateDoc.mockReset();
    mockSaveTracker.mockReset();
    mockTracker = [];
    mockOnSnapshot.mockImplementation(() => jest.fn());
    mockSubscribeParty.mockReset();
    mockSubscribeParty.mockImplementation(() => jest.fn());
});

// The combat_tracker arrives from the party doc's snapshot.
const withTracker = tracker => {
    mockTracker = tracker;
    mockSubscribeParty.mockImplementation((_campaignId, listener) => {
        listener({ party: { combat_tracker: tracker }, loaded: true, error: null });
        return jest.fn();
    });
};
const post = (id, status, index) => ({ id, title: id, content: '', status, index });

describe('PostListContentCombatMap keeping the tracker in step with the fight', () => {
    const entities = [{ id: 'a', title: 'Aria', kind: 'player' }, { id: 'b', title: 'Bram', kind: 'enemy' }];
    const rects = zoneRects([zone('Zone 1', 10), zone('Zone 2', 200)]);
    const placed = (id, title, status, index, n) => ({ id, title, content: '', status, index, ...slotPosition(rects[status === 'Zone 1' ? 0 : 1], n) });

    test('with a map, new combatants go in its first zone, each with a spot to stand in', () => {
        withTracker([]);
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} entities={entities} userId="director-1" canEdit />);
        expect(mockSaveTracker).toHaveBeenCalledWith('camp-1', [
            { id: 'a', title: 'Aria', content: '', status: 'Zone 1', index: 0, ...slotPosition(rects[0], 0) },
            { id: 'b', title: 'Bram', content: '', status: 'Zone 1', index: 1, ...slotPosition(rects[0], 1) },
        ]);
    });

    test('with no map chosen by the director, they share one Combatants column (no spots: there is no map)', () => {
        withTracker([]);
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={undefined} entities={entities} userId="director-1" canEdit noMap />);
        expect(mockSaveTracker).toHaveBeenCalledWith('camp-1', [
            { id: 'a', title: 'Aria', content: '', status: 'Combatants', index: 0 },
            { id: 'b', title: 'Bram', content: '', status: 'Combatants', index: 1 },
        ]);
    });

    test('unselecting the map brings everyone out of the zones into that column', () => {
        withTracker([post('a', 'Zone 2', 0), post('b', 'Zone 1', 0)]);
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={undefined} entities={entities} userId="director-1" canEdit noMap />);
        expect(mockSaveTracker).toHaveBeenCalledWith('camp-1', [post('a', 'Combatants', 0), post('b', 'Combatants', 1)]);
    });

    test('choosing a map again puts everyone in its first zone, on spots', () => {
        withTracker([post('a', 'Combatants', 0), post('b', 'Combatants', 1)]);
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} entities={entities} userId="director-1" canEdit />);
        expect(mockSaveTracker).toHaveBeenCalledWith('camp-1', [placed('a', 'a', 'Zone 1', 0, 0), placed('b', 'b', 'Zone 1', 1, 1)]);
    });

    test('someone who cannot write the campaign only watches: nothing is written', () => {
        withTracker([]);
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} entities={entities} userId="player-1" />);
        expect(mockSaveTracker).not.toHaveBeenCalled();
    });

    test('a map that is still loading is not the same as no map: nothing is moved', () => {
        withTracker([post('a', 'Zone 2', 0)]);
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={undefined} entities={entities} userId="director-1" canEdit />);
        expect(mockSaveTracker).not.toHaveBeenCalled();
    });

    test('nothing is written when the tracker is already right', () => {
        withTracker([placed('a', 'a', 'Zone 2', 0, 0), placed('b', 'b', 'Zone 1', 0, 0)]);
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} entities={entities} userId="director-1" canEdit />);
        expect(mockSaveTracker).not.toHaveBeenCalled();
    });

    test('a failed write is logged, not thrown', async () => {
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        mockSaveTracker.mockRejectedValue(new Error('permission-denied'));
        withTracker([]);
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} entities={entities} userId="director-1" canEdit />);
        await waitFor(() => expect(log).toHaveBeenCalledWith("Couldn't update the combat tracker: Error: permission-denied"));
        log.mockRestore();
    });

    test('with no map the message says there is none', () => {
        withTracker([]);
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={undefined} entities={[]} userId="director-1" canEdit noMap />);
        expect(screen.getByText(/No active map selected/)).toBeInTheDocument();
    });
});

describe('PostListContentCombatMap tokens', () => {
    const entities = [{ id: 'a', title: 'Aria Vale', kind: 'player', image: 'aria.png' }, { id: 'b', title: 'Rust Bandit', kind: 'enemy' }];
    // Zone 1 is at (10, 10) 100 x 80 on the 500px map: 0.02..0.22 across, 0.02..0.18 down; Zone 2 at 0.4..0.8
    const tracker = () => [{ ...post('a', 'Zone 1', 0), x: 0.1, y: 0.1 }, { ...post('b', 'Zone 2', 0), x: 0.5, y: 0.1 }];
    const layer = () => document.querySelector('.MapTokens');
    // the stand-in map is 1000 wide and 500 tall: 1 map width = 1000px
    const mockLayerBox = () => { layer().getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 500, right: 1000, bottom: 500, x: 0, y: 0 }); };
    const tokenOf = name => screen.getByRole('button', { name: new RegExp(`^${name}`) });
    const pointer = (element, type, x, y, extra = {}) => fireEvent(element, Object.assign(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, ...extra }), { pointerId: 1, pointerType: 'mouse' }));

    test('each combatant with a place is a token on the map, named for them and the zone they are in', () => {
        withTracker(tracker());
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} entities={entities} userId="player-1" />);
        expect(screen.getAllByRole('button').map(button => button.getAttribute('aria-label'))).toEqual(['Aria Vale, Zone 1', 'Rust Bandit, Zone 2']);
    });

    test('a portrait shows if there is one, and initials if not', () => {
        withTracker(tracker());
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} entities={entities} userId="player-1" />);
        expect(tokenOf('Aria Vale').querySelector('img')).toHaveAttribute('src', 'aria.png');
        expect(within(tokenOf('Rust Bandit')).getByText('RB')).toBeInTheDocument();
    });

    test('they are coloured by side', () => {
        withTracker(tracker());
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} entities={entities} userId="player-1" />);
        expect(tokenOf('Aria Vale')).toHaveClass('MapToken-player');
        expect(tokenOf('Rust Bandit')).toHaveClass('MapToken-enemy');
    });

    test('someone who has not been given a place yet is not shown', () => {
        withTracker([...tracker(), post('c', 'Zone 1', 1)]);
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} entities={[...entities, { id: 'c', title: 'Cass', kind: 'ally' }]} userId="player-1" />);
        expect(screen.getAllByRole('button')).toHaveLength(2);
    });

    test('someone in the tracker who is not in the fight is not shown, and there are no cards in the zones', () => {
        withTracker([...tracker(), { ...post('gone', 'Zone 1', 2), x: 0.1, y: 0.1 }]);
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} entities={entities} userId="player-1" />);
        expect(screen.getAllByRole('button')).toHaveLength(2);
        expect(mockAbstractProps.at(-1).usePosts().posts).toEqual([]);
    });

    test('a director can move anyone\'s token', () => {
        withTracker(tracker());
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} entities={entities} userId="director-1" canEdit />);
        expect(tokenOf('Aria Vale')).toHaveClass('MapToken-movable');
        expect(tokenOf('Rust Bandit')).toHaveClass('MapToken-movable');
    });

    describe('a player moving their own token', () => {
        const owned = [{ ...entities[0], ownerIds: ['player-1'] }, { id: 'c', title: 'Bram Holt', kind: 'player', ownerIds: ['player-2'] }, entities[1]];
        const trackerWithBram = () => [...tracker(), { ...post('c', 'Zone 1', 1), x: 0.15, y: 0.1 }];
        const show = (userId = 'player-1') => render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} entities={owned} userId={userId} />);

        test('can move their character\'s token, and only theirs', () => {
            withTracker(trackerWithBram());
            show();
            expect(tokenOf('Aria Vale')).toHaveClass('MapToken-movable');
            expect(tokenOf('Bram Holt')).not.toHaveClass('MapToken-movable'); // another player's
            expect(tokenOf('Rust Bandit')).not.toHaveClass('MapToken-movable'); // an enemy
        });

        test('someone who can write the character (a co-owner) moves it too', () => {
            withTracker(trackerWithBram());
            show('player-2');
            expect(tokenOf('Bram Holt')).toHaveClass('MapToken-movable');
            expect(tokenOf('Aria Vale')).not.toHaveClass('MapToken-movable');
        });

        test('writes the move to the party doc, only changing their own token', () => {
            withTracker(trackerWithBram());
            show();
            mockLayerBox();
            const token = tokenOf('Aria Vale');

            pointer(token, 'pointerdown', 100, 100, { button: 0 });
            pointer(token, 'pointermove', 550, 100);
            pointer(token, 'pointerup', 550, 100);

            expect(mockSaveTracker).toHaveBeenCalledTimes(1);
            const [campaignId, saved] = mockSaveTracker.mock.calls[0];
            expect(campaignId).toBe('camp-1');
            expect(saved.find(p => p.id === 'a')).toMatchObject({ status: 'Zone 2', x: 0.55 });
            expect(saved.find(p => p.id === 'b')).toEqual(trackerWithBram().find(p => p.id === 'b'));
            expect(saved.find(p => p.id === 'c')).toEqual(trackerWithBram().find(p => p.id === 'c'));
        });

        test('does not touch who is in the fight: a player never syncs the tracker', () => {
            withTracker([]);
            show();
            expect(mockSaveTracker).not.toHaveBeenCalled();
        });

        test('someone who is not a player in the party, and not the owner, cannot', () => {
            withTracker(trackerWithBram());
            show('stranger');
            expect(document.querySelectorAll('.MapToken-movable')).toHaveLength(0);
        });

        test('nobody is movable with no signed-in user', () => {
            withTracker(trackerWithBram());
            render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} entities={owned} />);
            expect(document.querySelectorAll('.MapToken-movable')).toHaveLength(0);
        });
    });

    test('dragging one to another zone writes its new spot and zone', () => {
        withTracker(tracker());
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} entities={entities} userId="director-1" canEdit />);
        mockLayerBox();
        const token = tokenOf('Aria Vale');
        expect(token).toHaveClass('MapToken-movable');

        pointer(token, 'pointerdown', 100, 100, { button: 0 });
        pointer(token, 'pointermove', 550, 100);
        pointer(token, 'pointerup', 550, 100);

        expect(mockSaveTracker).toHaveBeenCalledTimes(1);
        const [, saved] = mockSaveTracker.mock.calls[0];
        expect(saved.find(p => p.id === 'a')).toMatchObject({ status: 'Zone 2', x: 0.55, y: 0.1, index: 1 });
        expect(saved.find(p => p.id === 'b')).toMatchObject({ status: 'Zone 2', x: 0.5, y: 0.1 }); // the others are as they were
    });

    test('dropping one outside every zone leaves it where it was', () => {
        withTracker(tracker());
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} entities={entities} userId="director-1" canEdit />);
        mockLayerBox();
        const token = tokenOf('Aria Vale');

        pointer(token, 'pointerdown', 100, 100, { button: 0 });
        pointer(token, 'pointermove', 330, 300);
        pointer(token, 'pointerup', 330, 300);

        expect(mockSaveTracker).not.toHaveBeenCalled();
    });

    test('a move that goes on the map\'s edge is kept inside it', () => {
        withTracker([{ ...post('a', 'Zone 1', 0), x: 0.1, y: 0.1 }]);
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap({ zones: [{ id: 'z', name: 'Whole map', x: 0, y: 0, width: 500, height: 250 }] })} entities={entities} userId="director-1" canEdit />);
        mockLayerBox();
        const token = tokenOf('Aria Vale');

        pointer(token, 'pointerdown', 100, 100, { button: 0 });
        pointer(token, 'pointermove', 5000, -500);
        pointer(token, 'pointerup', 5000, -500);

        const moved = mockSaveTracker.mock.calls.at(-1)[1].find(p => p.id === 'a');
        expect(moved.x).toBe(1);
        expect(moved.y).toBe(0);
    });

    test('a token moved by someone else is moved on this map too', () => {
        let push;
        mockSubscribeParty.mockImplementation((_campaignId, listener) => {
            push = tracker => listener({ party: { combat_tracker: tracker }, loaded: true, error: null });
            push(tracker());
            return jest.fn();
        });
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} entities={entities} userId="player-1" />);
        expect(tokenOf('Aria Vale').style.left).toBe('10%');

        act(() => push([{ ...post('a', 'Zone 2', 0), x: 0.6, y: 0.1 }, { ...post('b', 'Zone 2', 0), x: 0.5, y: 0.1 }]));

        expect(tokenOf('Aria Vale').style.left).toBe('60%');
        expect(tokenOf('Aria Vale')).toHaveAccessibleName('Aria Vale, Zone 2');
    });

    describe('a token dropped somewhere stays there while the move is saved', () => {
        // the tracker as the party doc's listener delivers it, pushed by hand
        let push;
        const listen = initial => {
            mockTracker = initial;
            mockSubscribeParty.mockImplementation((_campaignId, listener) => {
                push = tracker => listener({ party: { combat_tracker: tracker }, loaded: true, error: null });
                push(initial);
                return jest.fn();
            });
        };
        const dropAria = () => {
            mockLayerBox();
            const token = tokenOf('Aria Vale');
            pointer(token, 'pointerdown', 100, 100, { button: 0 });
            pointer(token, 'pointermove', 550, 100);
            pointer(token, 'pointerup', 550, 100);
        };
        const aria = () => tokenOf('Aria Vale');
        const leftOf = element => parseFloat(element.style.left);
        const draw = () => render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} entities={entities} userId="director-1" canEdit />);

        test('from the moment it is dropped, even though the tracker still has the old spot (a transaction is not reflected until the server confirms it)', () => {
            listen(tracker());
            draw();
            expect(leftOf(aria())).toBeCloseTo(10);

            dropAria();

            expect(leftOf(aria())).toBeCloseTo(55); // not back at 10%
            expect(aria()).toHaveAccessibleName('Aria Vale, Zone 2');
        });

        test('and stays there when the tracker then shows it there: no jump', () => {
            listen(tracker());
            draw();
            dropAria();

            act(() => push(tracker().map(p => (p.id === 'a' ? { ...p, status: 'Zone 2', x: 0.55, y: 0.1 } : p))));

            expect(leftOf(aria())).toBeCloseTo(55);
        });

        test('an update to some other token while it is waiting does not send it back', () => {
            listen(tracker());
            draw();
            dropAria();

            act(() => push(tracker().map(p => (p.id === 'b' ? { ...p, x: 0.6, y: 0.15 } : p)))); // Rust Bandit moved; Aria not yet

            expect(leftOf(aria())).toBeCloseTo(55);
            expect(leftOf(tokenOf('Rust Bandit'))).toBeCloseTo(60);
        });

        test('once the tracker has caught up, later moves of it (by someone else) are followed', () => {
            listen(tracker());
            draw();
            dropAria();
            act(() => push(tracker().map(p => (p.id === 'a' ? { ...p, status: 'Zone 2', x: 0.55, y: 0.1 } : p))));

            act(() => push(tracker().map(p => (p.id === 'a' ? { ...p, status: 'Zone 2', x: 0.7, y: 0.1 } : p))));

            expect(leftOf(aria())).toBeCloseTo(70);
        });

        test('if someone else moved it in the meantime, that is where it is', () => {
            listen(tracker());
            draw();
            dropAria();

            act(() => push(tracker().map(p => (p.id === 'a' ? { ...p, status: 'Zone 2', x: 0.75, y: 0.15 } : p))));

            expect(leftOf(aria())).toBeCloseTo(75);
        });

        test('if the move cannot be saved, it goes back, and says so', async () => {
            const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
            mockSaveTracker.mockRejectedValue(new Error('offline'));
            listen(tracker());
            draw();

            dropAria();
            expect(leftOf(aria())).toBeCloseTo(55);

            await waitFor(() => expect(leftOf(aria())).toBeCloseTo(10));
            expect(alert).toHaveBeenCalledWith("Couldn't move the token: Error: offline");
            alert.mockRestore();
        });

        test('if the tracker never shows it, it is let go after a while rather than held there forever', () => {
            jest.useFakeTimers();
            listen(tracker());
            draw();
            dropAria();
            expect(leftOf(aria())).toBeCloseTo(55);

            act(() => { jest.advanceTimersByTime(9000); });

            expect(leftOf(aria())).toBeCloseTo(10);
            jest.useRealTimers();
        });

        test('dropping it again straight away holds it at the new spot, not the first', () => {
            listen(tracker());
            draw();
            dropAria();

            const token = aria();
            pointer(token, 'pointerdown', 550, 100, { button: 0 });
            pointer(token, 'pointermove', 580, 100);
            pointer(token, 'pointerup', 580, 100);

            expect(leftOf(aria())).toBeCloseTo(58);
            act(() => push(tracker().map(p => (p.id === 'a' ? { ...p, status: 'Zone 2', x: 0.55, y: 0.1 } : p)))); // the first drop's echo arrives
            expect(leftOf(aria())).toBeCloseTo(58);
        });

        test('nothing is held for a token nobody has moved', () => {
            listen(tracker());
            draw();
            expect(leftOf(aria())).toBeCloseTo(10);
            act(() => push(tracker().map(p => (p.id === 'a' ? { ...p, x: 0.15 } : p))));
            expect(leftOf(aria())).toBeCloseTo(15);
        });
    });

    test('no tokens without a map', () => {
        withTracker(tracker());
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={undefined} entities={entities} userId="director-1" canEdit noMap />);
        expect(document.querySelector('.MapTokens')).not.toBeInTheDocument();
    });
});

describe('PostListContentCombatMap drawing', () => {
    test('everyone sees what has been drawn over the map, without any tools', () => {
        const { container } = render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} userId="player-1" />);
        expect(container.querySelectorAll('.MapDrawing-stroke')).toHaveLength(1);
        expect(screen.queryByRole('toolbar', { name: 'Map drawing tools' })).not.toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Map drawing' })).not.toHaveClass('MapDrawing-active');
    });

    test('someone who can edit the map gets the drawing tools', () => {
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} userId="director-1" />);
        expect(screen.getByRole('toolbar', { name: 'Map drawing tools' })).toBeInTheDocument();
    });

    test('without a signed-in user there are no tools', () => {
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} />);
        expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    });

    test('the drawing is sized to the map: in map widths, as tall as the map is', () => {
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} userId="player-1" />);
        expect(screen.getByRole('img', { name: 'Map drawing' })).toHaveAttribute('viewBox', '0 0 1 0.5');
    });

    test('with no active map there is only the message', () => {
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={undefined} userId="director-1" />);
        expect(screen.getByText(/No active map selected/)).toBeInTheDocument();
        expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    });

    test('a stroke drawn while the map is open does not disturb the zones: the same zone list is passed on', () => {
        const { rerender } = render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} userId="player-1" />);
        const first = mockAbstractProps[mockAbstractProps.length - 1].zoneLayout;

        // the map doc comes back with another stroke - and its zone fields in another order
        const reordered = activeMap({
            strokes: [stroke('a'), stroke('b')],
            zones: [{ height: 80, width: 100, y: 10, x: 10, name: 'Zone 1', id: 'Zone 1' }, { height: 80, width: 100, y: 10, x: 200, name: 'Zone 2', id: 'Zone 2' }],
        });
        rerender(<PostListContentCombatMap campaignId="camp-1" activeMap={reordered} userId="player-1" />);

        expect(mockAbstractProps[mockAbstractProps.length - 1].zoneLayout).toBe(first);
    });

    test('but a zone that really moved does change the zone list', () => {
        const { rerender } = render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} userId="player-1" />);
        const first = mockAbstractProps[mockAbstractProps.length - 1].zoneLayout;

        rerender(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap({ zones: [zone('Zone 1', 50), zone('Zone 2', 200)] })} userId="player-1" />);

        expect(mockAbstractProps[mockAbstractProps.length - 1].zoneLayout).not.toBe(first);
    });
});

describe('PostListContentCombatMap image tokens', () => {
    const fire = { id: 'fire', image: 'https://example.com/fire.png', label: 'Fire', x: 0.3, y: 0.1, size: 0.07 };
    const tree = { id: 'tree', image: 'https://example.com/tree.png', label: 'Tree', x: 0.7, y: 0.2, size: 0.12 };
    const withTokens = (...tokens) => activeMap({ image_tokens: tokens });
    const imageLayer = () => document.querySelector('.MapImageTokens');
    const mockLayerBox = () => { imageLayer().getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 500, right: 1000, bottom: 500, x: 0, y: 0 }); };
    const pointer = (element, type, x, y, extra = {}) => fireEvent(element, Object.assign(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, ...extra }), { pointerId: 1, pointerType: 'mouse' }));
    const savedTokens = () => mockUpdateDoc.mock.calls[mockUpdateDoc.mock.calls.length - 1][1].image_tokens;

    beforeEach(() => {
        mockUpdateDoc.mockResolvedValue(undefined);
        mockAddDoc.mockResolvedValue({ id: 'saved' });
        withTracker([]);
    });

    test('everyone sees them as pictures, and they are tied to no zone', () => {
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={withTokens(fire, tree)} userId="player-1" />);
        expect(screen.getByAltText('Fire')).toHaveAttribute('src', 'https://example.com/fire.png');
        expect(screen.getByAltText('Tree')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Fire' })).not.toBeInTheDocument();
        expect(screen.queryByRole('toolbar', { name: 'Map image tokens' })).not.toBeInTheDocument();
    });

    test('a map with none, or with junk in the field, shows none and is fine', () => {
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap({ image_tokens: [{ id: 'x', image: 'javascript:alert(1)', x: 0, y: 0, size: 0.1 }, 'junk'] })} userId="player-1" />);
        expect(imageLayer()).toBeEmptyDOMElement();
    });

    test('a player cannot move them, whoever they are', () => {
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={withTokens(fire)} userId="player-1" canEdit />);
        expect(screen.queryByRole('button', { name: 'Fire' })).not.toBeInTheDocument();
    });

    test('someone who can edit the map gets the toolbar, and each token can be pressed', () => {
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={withTokens(fire)} userId="director-1" />);
        expect(screen.getByRole('toolbar', { name: 'Map image tokens' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Fire' })).toBeInTheDocument();
    });

    test('with no map there is no toolbar', () => {
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={undefined} userId="director-1" />);
        expect(screen.queryByRole('toolbar', { name: 'Map image tokens' })).not.toBeInTheDocument();
    });

    test('adding one puts it in the middle of the map, as the map is shaped', () => {
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={withTokens()} userId="director-1" />);
        fireEvent.click(screen.getByRole('button', { name: 'Add image token' }));
        fireEvent.change(screen.getByLabelText('Picture link'), { target: { value: 'https://example.com/pillar.png' } });
        fireEvent.change(screen.getByLabelText('Name (optional)'), { target: { value: 'Pillar' } });
        fireEvent.click(screen.getByRole('button', { name: 'Place on map' }));

        expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['maps', 'map-1'] }, { image_tokens: { __arrayUnion: expect.objectContaining({ image: 'https://example.com/pillar.png', label: 'Pillar', x: 0.5, y: 0.25 }) } });
    });

    test('a new token placed is kept in the director\'s library, as its Imgur hash, and placed as that hash', () => {
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={withTokens()} userId="director-1" />);
        fireEvent.click(screen.getByRole('button', { name: 'Add image token' }));
        fireEvent.change(screen.getByLabelText('Picture link'), { target: { value: 'https://i.imgur.com/AbC1d2E.png' } });
        fireEvent.change(screen.getByLabelText('Name (optional)'), { target: { value: 'Pillar' } });
        fireEvent.click(screen.getByRole('button', { name: 'Place on map' }));

        expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['maps', 'map-1'] }, { image_tokens: { __arrayUnion: expect.objectContaining({ image: 'AbC1d2E.png', label: 'Pillar' }) } });
        expect(mockAddDoc).toHaveBeenCalledWith({ __collection: ['players', 'director-1', 'tokens'] }, expect.objectContaining({ image: 'AbC1d2E.png', label: 'Pillar' }));
    });

    describe('dragging a token from the library onto the map', () => {
        const saved = { id: 'lib-1', image: 'AbC1d2E.png', label: 'Fire', size: 0.12 };
        const openLibrary = () => {
            mockOnSnapshot.mockImplementation((_ref, onNext) => {
                if (_ref?.__collection?.[0] === 'players') onNext({ docs: [{ id: saved.id, data: () => ({ image: saved.image, label: saved.label, size: saved.size }) }] });
                return jest.fn();
            });
            render(<PostListContentCombatMap campaignId="camp-1" activeMap={withTokens()} userId="director-1" />);
            fireEvent.click(screen.getByRole('button', { name: 'Add image token' }));
        };
        const carry = () => {
            const dataTransfer = { types: [], data: {}, effectAllowed: '', dropEffect: '' };
            dataTransfer.setData = (type, value) => { dataTransfer.data[type] = value; dataTransfer.types = Object.keys(dataTransfer.data); };
            dataTransfer.getData = type => dataTransfer.data[type];
            return dataTransfer;
        };

        test('pressing one places it in the middle of the map', () => {
            openLibrary();
            fireEvent.click(screen.getByRole('button', { name: 'Place Fire' }));
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['maps', 'map-1'] }, { image_tokens: { __arrayUnion: expect.objectContaining({ image: 'AbC1d2E.png', label: 'Fire', size: 0.12, x: 0.5, y: 0.25 }) } });
        });

        test('the map takes a drop only once a drag has begun, and stops when it ends', () => {
            openLibrary();
            expect(imageLayer()).not.toHaveClass('MapImageTokens-droppable');
            const dataTransfer = carry();
            fireEvent.dragStart(screen.getByRole('button', { name: 'Place Fire' }), { dataTransfer });
            expect(imageLayer()).toHaveClass('MapImageTokens-droppable');
            fireEvent.dragEnd(screen.getByRole('button', { name: 'Place Fire' }));
            expect(imageLayer()).not.toHaveClass('MapImageTokens-droppable');
        });

        test('dropping it puts it where it was let go, and the map stops waiting for a drop', () => {
            openLibrary();
            mockLayerBox();
            const dataTransfer = carry();
            fireEvent.dragStart(screen.getByRole('button', { name: 'Place Fire' }), { dataTransfer });
            fireEvent(imageLayer(), Object.assign(new MouseEvent('drop', { bubbles: true, cancelable: true, clientX: 700, clientY: 200 }), { dataTransfer })); // jsdom's drag events ignore coordinates

            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['maps', 'map-1'] }, { image_tokens: { __arrayUnion: expect.objectContaining({ image: 'AbC1d2E.png', label: 'Fire', size: 0.12, x: 0.7, y: 0.2 }) } });
            expect(imageLayer()).not.toHaveClass('MapImageTokens-droppable');
        });

        test('while drawing, it does not take a drop', () => {
            openLibrary();
            fireEvent.click(screen.getByRole('button', { name: 'Draw on map' }));
            fireEvent.dragStart(screen.getByRole('button', { name: 'Place Fire' }), { dataTransfer: carry() });
            expect(imageLayer()).not.toHaveClass('MapImageTokens-droppable');
        });
    });

    test('dragging one saves where it was let go, leaving the others', () => {
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={withTokens(fire, tree)} userId="director-1" />);
        mockLayerBox();
        const button = screen.getByRole('button', { name: 'Fire' });
        pointer(button, 'pointerdown', 300, 100, { button: 0 });
        pointer(button, 'pointermove', 800, 300);
        pointer(button, 'pointerup', 800, 300);

        expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['maps', 'map-1'] }, { image_tokens: [{ ...fire, x: 0.8, y: 0.3 }, tree] });
    });

    test('it is not tied to any zone: dropped outside every one it stays put', () => {
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={withTokens(fire)} userId="director-1" />);
        mockLayerBox();
        const button = screen.getByRole('button', { name: 'Fire' });
        pointer(button, 'pointerdown', 300, 100, { button: 0 });
        pointer(button, 'pointermove', 950, 480); // no zone there
        pointer(button, 'pointerup', 950, 480);
        expect(savedTokens()).toEqual([{ ...fire, x: 0.95, y: 0.48 }]);
        expect(mockSaveTracker).not.toHaveBeenCalled();
    });

    test('selecting one lets it be resized, copied and removed from the toolbar', () => {
        const view = (tokens) => <PostListContentCombatMap campaignId="camp-1" activeMap={withTokens(...tokens)} userId="director-1" />;
        const { rerender } = render(view([fire, tree]));
        mockLayerBox();
        pointer(screen.getByRole('button', { name: 'Tree' }), 'pointerdown', 700, 200, { button: 0 });
        pointer(screen.getByRole('button', { name: 'Tree' }), 'pointerup', 700, 200);
        const group = () => screen.getByRole('group', { name: 'Selected image token' });

        fireEvent.click(within(group()).getByRole('button', { name: 'Small' }));
        expect(savedTokens()).toEqual([fire, { ...tree, size: 0.04 }]);
        rerender(view(savedTokens())); // the map doc as the save leaves it

        fireEvent.click(within(group()).getByRole('button', { name: 'Copy' }));
        expect(savedTokens()).toHaveLength(3);
        expect(savedTokens()[2]).toMatchObject({ image: tree.image, label: 'Tree', size: 0.04, x: 0.73, y: 0.23 });
        rerender(view(savedTokens()));

        // the copy is the one selected now
        fireEvent.click(within(group()).getByRole('button', { name: 'Remove' }));
        expect(savedTokens()).toEqual([fire, { ...tree, size: 0.04 }]);
    });

    test('while drawing, they are pictures only, so the pen is not interrupted', () => {
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={withTokens(fire)} userId="director-1" />);
        fireEvent.click(screen.getByRole('button', { name: 'Draw on map' }));
        expect(screen.queryByRole('button', { name: 'Fire' })).not.toBeInTheDocument();
        expect(screen.getByAltText('Fire')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Stop drawing' }));
        expect(screen.getByRole('button', { name: 'Fire' })).toBeInTheDocument();
    });

    test('a token another director removed is no longer selected', () => {
        const { rerender } = render(<PostListContentCombatMap campaignId="camp-1" activeMap={withTokens(fire, tree)} userId="director-1" />);
        pointer(screen.getByRole('button', { name: 'Tree' }), 'pointerdown', 700, 200, { button: 0 });
        expect(screen.getByRole('group', { name: 'Selected image token' })).toBeInTheDocument();
        rerender(<PostListContentCombatMap campaignId="camp-1" activeMap={withTokens(fire)} userId="director-1" />);
        expect(screen.queryByRole('group', { name: 'Selected image token' })).not.toBeInTheDocument();
    });
});

describe('PostListContentCombatMap enemies: defeating them and taking them off the map', () => {
    const entities = [
        { id: 'character:a', title: 'Aria Vale', kind: 'player', ownerIds: ['player-1'] },
        { id: 'npc:goblin', title: 'Goblin 1', kind: 'enemy', defeated: false },
        { id: 'npc:ally', title: 'Friendly Bear', kind: 'ally' },
    ];
    const tracker = () => [
        { ...post('character:a', 'Zone 1', 0), x: 0.1, y: 0.1 },
        { ...post('npc:goblin', 'Zone 2', 0), x: 0.5, y: 0.1 },
        { ...post('npc:ally', 'Zone 2', 1), x: 0.6, y: 0.1 },
    ];
    const fire = { id: 'fire', image: 'https://example.com/fire.png', label: 'Fire', x: 0.3, y: 0.1, size: 0.07 };
    const tokenLayer = () => document.querySelector('.MapTokens');
    const trashCan = () => document.querySelector('.MapTrash');
    const mockBoxes = () => {
        const box = { left: 0, top: 0, width: 1000, height: 500, right: 1000, bottom: 500, x: 0, y: 0 };
        tokenLayer().getBoundingClientRect = () => box;
        document.querySelector('.MapImageTokens').getBoundingClientRect = () => box;
        // the can, bottom right of the map, 80 x 60
        trashCan().getBoundingClientRect = () => ({ left: 900, top: 430, width: 80, height: 60, right: 980, bottom: 490, x: 900, y: 430 });
    };
    const pointer = (element, type, x, y, extra = {}) => fireEvent(element, Object.assign(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, ...extra }), { pointerId: 1, pointerType: 'mouse' }));
    const enemyToken = () => screen.getByRole('button', { name: /^Goblin 1/ });
    const drawMap = (props = {}, map = activeMap()) => render(<PostListContentCombatMap campaignId="camp-1" activeMap={map} entities={entities} userId="director-1" canEdit {...props} />);

    beforeEach(() => {
        mockUpdateDoc.mockResolvedValue(undefined);
        withTracker(tracker());
    });

    describe('marking one defeated', () => {
        test('a defeated enemy\'s token is crossed through, and says so', () => {
            const view = render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} entities={entities.map(e => (e.id === 'npc:goblin' ? { ...e, defeated: true } : e))} userId="player-1" />);
            const token = within(view.container).getByRole('button', { name: /^Goblin 1/ });
            expect(token).toHaveClass('MapToken-defeated');
            expect(token).toHaveAccessibleName('Goblin 1, Zone 2, defeated');
        });

        test('everyone sees it, not just the director', () => {
            render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} entities={entities.map(e => (e.id === 'npc:goblin' ? { ...e, defeated: true } : e))} userId="player-1" />);
            expect(enemyToken()).toHaveClass('MapToken-defeated');
        });

        test('pressing an enemy\'s token shows what a director can do with it', () => {
            const onSetDefeated = jest.fn();
            drawMap({ onSetDefeated, onRemoveEntity: jest.fn() });
            expect(screen.queryByRole('toolbar', { name: 'Selected combatant' })).not.toBeInTheDocument();

            pointer(enemyToken(), 'pointerdown', 500, 100, { button: 0 });
            pointer(enemyToken(), 'pointerup', 500, 100);

            const toolbar = screen.getByRole('toolbar', { name: 'Selected combatant' });
            expect(within(toolbar).getByText('Goblin 1')).toBeInTheDocument();
            expect(enemyToken()).toHaveClass('MapToken-selected');

            fireEvent.click(within(toolbar).getByRole('button', { name: 'Mark defeated' }));
            expect(onSetDefeated).toHaveBeenCalledWith('npc:goblin', true);
        });

        test('a defeated one offers to be revived', () => {
            const onSetDefeated = jest.fn();
            const view = render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} entities={entities.map(e => (e.id === 'npc:goblin' ? { ...e, defeated: true } : e))} userId="director-1" canEdit onSetDefeated={onSetDefeated} />);
            pointer(within(view.container).getByRole('button', { name: /^Goblin 1/ }), 'pointerdown', 500, 100, { button: 0 });
            fireEvent.click(screen.getByRole('button', { name: 'Revive' }));
            expect(onSetDefeated).toHaveBeenCalledWith('npc:goblin', false);
        });

        test('taking it out of the fight from the toolbar gives the enemy', () => {
            const onRemoveEntity = jest.fn();
            drawMap({ onRemoveEntity, onSetDefeated: jest.fn() });
            pointer(enemyToken(), 'pointerdown', 500, 100, { button: 0 });
            fireEvent.click(screen.getByRole('button', { name: 'Remove from fight' }));
            expect(onRemoveEntity).toHaveBeenCalledWith(expect.objectContaining({ id: 'npc:goblin', title: 'Goblin 1' }));
        });

        test('players\' tokens, and allies\', cannot be selected for it', () => {
            drawMap({ onSetDefeated: jest.fn(), onRemoveEntity: jest.fn() });
            pointer(screen.getByRole('button', { name: /^Aria Vale/ }), 'pointerdown', 100, 100, { button: 0 });
            pointer(screen.getByRole('button', { name: /^Friendly Bear/ }), 'pointerdown', 600, 100, { button: 0 });
            expect(screen.queryByRole('toolbar', { name: 'Selected combatant' })).not.toBeInTheDocument();
        });

        test('with no means to do anything, there is no toolbar and tokens are not selectable', () => {
            drawMap();
            pointer(enemyToken(), 'pointerdown', 500, 100, { button: 0 });
            expect(screen.queryByRole('toolbar', { name: 'Selected combatant' })).not.toBeInTheDocument();
            expect(enemyToken()).not.toHaveAttribute('aria-pressed');
        });

        test('someone who cannot edit the map gets none of it, even given the means', () => {
            render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} entities={entities} userId="player-1" onSetDefeated={jest.fn()} onRemoveEntity={jest.fn()} />);
            expect(enemyToken()).not.toHaveAttribute('aria-pressed');
            expect(screen.queryByRole('toolbar', { name: 'Selected combatant' })).not.toBeInTheDocument();
        });

        test('selecting an enemy deselects an image token, and the other way round', () => {
            drawMap({ onSetDefeated: jest.fn(), onRemoveEntity: jest.fn() }, activeMap({ image_tokens: [fire] }));
            pointer(screen.getByRole('button', { name: 'Fire' }), 'pointerdown', 300, 100, { button: 0 });
            pointer(screen.getByRole('button', { name: 'Fire' }), 'pointerup', 300, 100);
            expect(screen.getByRole('group', { name: 'Selected image token' })).toBeInTheDocument();

            pointer(enemyToken(), 'pointerdown', 500, 100, { button: 0 });
            expect(screen.getByRole('toolbar', { name: 'Selected combatant' })).toBeInTheDocument();
            expect(screen.queryByRole('group', { name: 'Selected image token' })).not.toBeInTheDocument();

            pointer(screen.getByRole('button', { name: 'Fire' }), 'pointerdown', 300, 100, { button: 0 });
            expect(screen.queryByRole('toolbar', { name: 'Selected combatant' })).not.toBeInTheDocument();
        });

        test('an enemy that leaves the fight is no longer selected', () => {
            const props = { onSetDefeated: jest.fn(), onRemoveEntity: jest.fn() };
            const { rerender } = drawMap(props);
            pointer(enemyToken(), 'pointerdown', 500, 100, { button: 0 });
            expect(screen.getByRole('toolbar', { name: 'Selected combatant' })).toBeInTheDocument();
            rerender(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} entities={entities.filter(e => e.id !== 'npc:goblin')} userId="director-1" canEdit {...props} />);
            expect(screen.queryByRole('toolbar', { name: 'Selected combatant' })).not.toBeInTheDocument();
        });

        test('while drawing, tokens are not selectable, so the pen is not interrupted', () => {
            drawMap({ onSetDefeated: jest.fn(), onRemoveEntity: jest.fn() });
            fireEvent.click(screen.getByRole('button', { name: 'Draw on map' }));
            expect(enemyToken()).not.toHaveAttribute('aria-pressed');
        });
    });

    describe('the trash can', () => {
        test('is not showing until something that can be thrown away is picked up, and goes away when it is put down', () => {
            drawMap({ onRemoveEntity: jest.fn() });
            mockBoxes();
            expect(trashCan()).not.toHaveClass('MapTrash-visible');

            pointer(enemyToken(), 'pointerdown', 500, 100, { button: 0 });
            expect(trashCan()).toHaveClass('MapTrash-visible');

            pointer(enemyToken(), 'pointerup', 500, 100);
            expect(trashCan()).not.toHaveClass('MapTrash-visible');
        });

        test('lights up when the pointer is over it', () => {
            drawMap({ onRemoveEntity: jest.fn() });
            mockBoxes();
            pointer(enemyToken(), 'pointerdown', 500, 100, { button: 0 });
            pointer(enemyToken(), 'pointermove', 400, 200);
            expect(trashCan()).not.toHaveClass('MapTrash-hot');
            pointer(enemyToken(), 'pointermove', 940, 460);
            expect(trashCan()).toHaveClass('MapTrash-hot');
            pointer(enemyToken(), 'pointermove', 400, 200);
            expect(trashCan()).not.toHaveClass('MapTrash-hot');
        });

        test('an enemy let go over it is taken out of the fight, and its token is not moved', () => {
            const onRemoveEntity = jest.fn();
            drawMap({ onRemoveEntity });
            mockBoxes();
            pointer(enemyToken(), 'pointerdown', 500, 100, { button: 0 });
            pointer(enemyToken(), 'pointermove', 940, 460);
            pointer(enemyToken(), 'pointerup', 940, 460);

            expect(onRemoveEntity).toHaveBeenCalledWith(expect.objectContaining({ id: 'npc:goblin' }));
            expect(mockSaveTracker).not.toHaveBeenCalled();
            expect(trashCan()).not.toHaveClass('MapTrash-visible');
        });

        test('let go anywhere else it is moved as usual', () => {
            const onRemoveEntity = jest.fn();
            drawMap({ onRemoveEntity });
            mockBoxes();
            pointer(enemyToken(), 'pointerdown', 500, 100, { button: 0 });
            pointer(enemyToken(), 'pointermove', 150, 100);
            pointer(enemyToken(), 'pointerup', 150, 100);
            expect(onRemoveEntity).not.toHaveBeenCalled();
            expect(mockSaveTracker).toHaveBeenCalled();
        });

        test('a player\'s character cannot be thrown away: no can appears, and letting go there does nothing', () => {
            const onRemoveEntity = jest.fn();
            drawMap({ onRemoveEntity });
            mockBoxes();
            const aria = screen.getByRole('button', { name: /^Aria Vale/ });
            pointer(aria, 'pointerdown', 100, 100, { button: 0 });
            expect(trashCan()).not.toHaveClass('MapTrash-visible');
            pointer(aria, 'pointermove', 940, 460);
            pointer(aria, 'pointerup', 940, 460);
            expect(onRemoveEntity).not.toHaveBeenCalled();
        });

        test('nor an ally', () => {
            const onRemoveEntity = jest.fn();
            drawMap({ onRemoveEntity });
            mockBoxes();
            const bear = screen.getByRole('button', { name: /^Friendly Bear/ });
            pointer(bear, 'pointerdown', 600, 100, { button: 0 });
            expect(trashCan()).not.toHaveClass('MapTrash-visible');
        });

        test('with no means to take an enemy out of the fight, an enemy cannot be thrown away either', () => {
            drawMap({ onSetDefeated: jest.fn() });
            mockBoxes();
            pointer(enemyToken(), 'pointerdown', 500, 100, { button: 0 });
            expect(trashCan()).not.toHaveClass('MapTrash-visible');
        });

        test('an image token let go over it is deleted from the map', () => {
            drawMap({}, activeMap({ image_tokens: [fire, { ...fire, id: 'tree', label: 'Tree', x: 0.7 }] }));
            mockBoxes();
            const token = screen.getByRole('button', { name: 'Fire' });
            pointer(token, 'pointerdown', 300, 100, { button: 0 });
            expect(trashCan()).toHaveClass('MapTrash-visible');
            pointer(token, 'pointermove', 940, 460);
            pointer(token, 'pointerup', 940, 460);

            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['maps', 'map-1'] }, { image_tokens: [{ ...fire, id: 'tree', label: 'Tree', x: 0.7 }] });
        });

        test('an image token let go anywhere else is moved, not deleted', () => {
            drawMap({}, activeMap({ image_tokens: [fire] }));
            mockBoxes();
            const token = screen.getByRole('button', { name: 'Fire' });
            pointer(token, 'pointerdown', 300, 100, { button: 0 });
            pointer(token, 'pointermove', 500, 200);
            pointer(token, 'pointerup', 500, 200);
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['maps', 'map-1'] }, { image_tokens: [{ ...fire, x: 0.5, y: 0.2 }] });
        });

        test('someone who cannot edit the map has no way to throw anything away', () => {
            render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap({ image_tokens: [fire] })} entities={entities} userId="player-1" onRemoveEntity={jest.fn()} />);
            expect(screen.queryByRole('button', { name: 'Fire' })).not.toBeInTheDocument();
            pointer(enemyToken(), 'pointerdown', 500, 100, { button: 0 });
            expect(trashCan()).not.toHaveClass('MapTrash-visible');
        });
    });
});

describe('PostListContentCombatMap with its tools beside it', () => {
    const entities = [{ id: 'npc:goblin', title: 'Goblin 1', kind: 'enemy' }];
    const tracker = () => [{ ...post('npc:goblin', 'Zone 1', 0), x: 0.1, y: 0.1 }];
    const sidebar = () => screen.queryByRole('complementary', { name: 'Map tools' });
    const draw = (props = {}, userId = 'director-1') => render(<PostListContentCombatMap campaignId="camp-1" activeMap={activeMap()} entities={entities} userId={userId} canEdit={userId === 'director-1'} {...props} />);

    beforeEach(() => withTracker(tracker()));

    test('a director\'s tools are in a column beside the map, and the map is in its own area next to it', () => {
        draw({ toolbarsBeside: true });
        expect(sidebar()).toBeInTheDocument();
        expect(within(sidebar()).getByRole('toolbar', { name: 'Map drawing tools' })).toBeInTheDocument();
        expect(within(sidebar()).getByRole('toolbar', { name: 'Map image tokens' })).toBeInTheDocument();
        expect(screen.getByTestId('map').closest('.CombatMap-beside-map')).not.toBeNull();
        expect(sidebar().closest('.CombatMap-beside')).toBe(screen.getByTestId('map').closest('.CombatMap-beside'));
        expect(within(sidebar()).queryByTestId('map')).not.toBeInTheDocument();
    });

    test('the tools that come and go - a selected combatant\'s - appear in the column too', () => {
        draw({ toolbarsBeside: true, onSetDefeated: jest.fn(), onRemoveEntity: jest.fn() });
        fireEvent(screen.getByRole('button', { name: /^Goblin 1/ }), Object.assign(new MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100, button: 0 }), { pointerId: 1, pointerType: 'mouse' }));
        expect(within(sidebar()).getByRole('toolbar', { name: 'Selected combatant' })).toBeInTheDocument();
    });

    test('without it the tools are above the map, as they always were', () => {
        draw();
        expect(sidebar()).not.toBeInTheDocument();
        expect(document.querySelector('.CombatMap-beside')).toBeNull();
        expect(screen.getByRole('toolbar', { name: 'Map drawing tools' })).toBeInTheDocument();
    });

    test('someone with no tools gets just the map, with no empty column', () => {
        draw({ toolbarsBeside: true }, 'player-1');
        expect(sidebar()).not.toBeInTheDocument();
        expect(document.querySelector('.CombatMap-beside')).toBeNull();
        expect(screen.getByTestId('map')).toBeInTheDocument();
    });

    test('selecting something does not rebuild the map: the layout stays as it was', () => {
        draw({ toolbarsBeside: true, onSetDefeated: jest.fn(), onRemoveEntity: jest.fn() });
        const map = screen.getByTestId('map');
        fireEvent(screen.getByRole('button', { name: /^Goblin 1/ }), Object.assign(new MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100, button: 0 }), { pointerId: 1, pointerType: 'mouse' }));
        expect(screen.getByTestId('map')).toBe(map);
    });

    test('with no active map there is only the message, whatever the layout', () => {
        render(<PostListContentCombatMap campaignId="camp-1" activeMap={undefined} entities={[]} userId="director-1" canEdit toolbarsBeside />);
        expect(screen.getByText(/No active map selected/)).toBeInTheDocument();
        expect(sidebar()).not.toBeInTheDocument();
    });
});
