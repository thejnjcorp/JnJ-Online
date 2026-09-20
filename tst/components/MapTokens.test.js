import { render, screen, fireEvent } from '@testing-library/react';
import { MapTokens } from '../../src/components/MapTokens';
import { TOKEN_SIZE, zoneRects } from '../../src/utils/mapTokens';

// a 1000px wide map, 500px tall (aspect 0.5): 1 map width = 1000px. Zones on the 500px reference map:
// "Left" is 0 to 0.4 across and 0 to 0.4 down; "Right" is 0.5 to 0.9 across and 0 to 0.4 down.
const rects = zoneRects([{ name: 'Left', x: 0, y: 0, width: 200, height: 200 }, { name: 'Right', x: 250, y: 0, width: 200, height: 200 }]);
const tokens = [
    { id: 'a', title: 'Aria Vale', kind: 'player', x: 0.2, y: 0.2 },
    { id: 'b', title: 'Rust Bandit', kind: 'enemy', image: 'bandit.png', x: 0.7, y: 0.2 },
];

function setup(props = {}) {
    const onMove = jest.fn();
    const view = render(<MapTokens tokens={tokens} rects={rects} aspect={0.5} canMove onMove={onMove} {...props} />);
    const layer = view.container.querySelector('.MapTokens');
    layer.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 500, right: 1000, bottom: 500, x: 0, y: 0 });
    const token = name => screen.getByRole('button', { name: new RegExp(`^${name}`) });
    const pointer = (element, type, x, y, extra = {}) => fireEvent(element, Object.assign(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, ...extra }), { pointerId: 1, pointerType: 'mouse' }));
    const drag = (name, from, to) => {
        const element = token(name);
        pointer(element, 'pointerdown', from[0], from[1], { button: 0 });
        pointer(element, 'pointermove', to[0], to[1]);
        return element;
    };
    return { ...view, layer, onMove, token, pointer, drag };
}

describe('MapTokens', () => {
    describe('showing the tokens', () => {
        test('puts each at its spot, as a share of the map, sized in map widths', () => {
            const { token } = setup();
            expect(token('Aria Vale').style.left).toBe('20%');
            expect(token('Aria Vale').style.top).toBe('40%'); // y is in map widths: 0.2 of the width is 0.4 of a map half as tall
            expect(token('Aria Vale').style.width).toBe(`${TOKEN_SIZE * 100}%`);
        });

        test('names each for who it is and the zone it is in', () => {
            const { token } = setup();
            expect(token('Aria Vale')).toHaveAccessibleName('Aria Vale, Left');
            expect(token('Rust Bandit')).toHaveAccessibleName('Rust Bandit, Right');
        });

        test('one outside every zone is named without one', () => {
            setup({ tokens: [{ id: 'x', title: 'Lost', kind: 'ally', x: 0.45, y: 0.45 }] });
            expect(screen.getByRole('button', { name: 'Lost' })).toBeInTheDocument();
        });

        test('shows the portrait when there is one, and the initials when there is not', () => {
            const { token } = setup();
            expect(token('Rust Bandit').querySelector('img')).toHaveAttribute('src', 'bandit.png');
            expect(token('Aria Vale')).toHaveTextContent('AV');
        });

        test('writes the name under each, and colours it by side', () => {
            const { token } = setup();
            expect(token('Aria Vale').querySelector('.MapToken-name')).toHaveTextContent('Aria Vale');
            expect(token('Aria Vale')).toHaveClass('MapToken-player');
            expect(token('Rust Bandit')).toHaveClass('MapToken-enemy');
        });

        test('one of no known side is neutral', () => {
            setup({ tokens: [{ id: 'x', title: 'Odd', x: 0.2, y: 0.2 }] });
            expect(screen.getByRole('button', { name: /^Odd/ })).toHaveClass('MapToken-neutral');
        });

        test('a nameless one is still there', () => {
            setup({ tokens: [{ id: 'x', title: '', x: 0.2, y: 0.2 }] });
            expect(screen.getByRole('button', { name: /^Combatant/ })).toHaveTextContent('?');
        });

        test('with nobody on the map it is an empty layer', () => {
            const { layer } = setup({ tokens: [] });
            expect(layer.children).toHaveLength(0);
        });
    });

    describe('who can move them', () => {
        test('nobody, unless allowed: they cannot be picked up, and are not in the tab order', () => {
            const { token, onMove, drag, pointer } = setup({ canMove: false });
            expect(token('Aria Vale')).not.toHaveClass('MapToken-movable');
            expect(token('Aria Vale')).toHaveAttribute('tabindex', '-1');

            const element = drag('Aria Vale', [200, 200], [700, 200]);
            pointer(element, 'pointerup', 700, 200);

            expect(onMove).not.toHaveBeenCalled();
            expect(token('Aria Vale').style.left).toBe('20%');
        });

        test('someone allowed can, and the tokens can be tabbed to', () => {
            const { token } = setup();
            expect(token('Aria Vale')).toHaveClass('MapToken-movable');
            expect(token('Aria Vale')).toHaveAttribute('tabindex', '0');
        });
    });

    describe('dragging', () => {
        test('follows the pointer, keeping hold of the token where it was grabbed', () => {
            const { token, drag } = setup();
            drag('Aria Vale', [220, 205], [420, 405]); // grabbed 20px right of and 5px below its centre (200, 200)
            expect(token('Aria Vale').style.left).toBe('40%'); // 420 - 20 = 400px across
            expect(token('Aria Vale').style.top).toBe('80%'); // 405 - 5 = 400px down: 0.4 of the width, 0.8 of a half-height map
        });

        test('is marked while it is dragged', () => {
            const { token, drag } = setup();
            drag('Aria Vale', [200, 200], [300, 200]);
            expect(token('Aria Vale')).toHaveClass('MapToken-dragging');
        });

        test('lights up the zone it is over', () => {
            const { layer, drag } = setup();
            expect(layer.querySelector('.MapTokens-zone-highlight')).not.toBeInTheDocument();

            drag('Aria Vale', [200, 200], [700, 200]);

            const highlight = layer.querySelector('.MapTokens-zone-highlight');
            expect(highlight.style.left).toBe('50%');
            expect(highlight.style.width).toBe('40%');
            expect(highlight.style.height).toBe('80%'); // 0.4 of the width is 0.8 of the map's height
        });

        test('over no zone, it is faded, and nothing is lit', () => {
            const { token, layer, drag } = setup();
            drag('Aria Vale', [200, 200], [450, 200]);
            expect(token('Aria Vale')).toHaveClass('MapToken-outside');
            expect(layer.querySelector('.MapTokens-zone-highlight')).not.toBeInTheDocument();
        });

        test('letting go over a zone reports the token, where it is now and the zone', () => {
            const { drag, pointer, onMove } = setup();
            const element = drag('Aria Vale', [200, 200], [700, 200]);
            pointer(element, 'pointerup', 700, 200);
            expect(onMove).toHaveBeenCalledWith('a', { x: 0.7, y: 0.2 }, 'Right');
        });

        test('moving within its zone reports the same zone', () => {
            const { drag, pointer, onMove } = setup();
            const element = drag('Aria Vale', [200, 200], [250, 220]);
            pointer(element, 'pointerup', 250, 220);
            expect(onMove).toHaveBeenCalledWith('a', { x: 0.25, y: 0.22 }, 'Left');
        });

        test('letting go outside every zone reports nothing, and the token goes back', () => {
            const { token, drag, pointer, onMove } = setup();
            const element = drag('Aria Vale', [200, 200], [450, 200]);
            pointer(element, 'pointerup', 450, 200);
            expect(onMove).not.toHaveBeenCalled();
            expect(token('Aria Vale').style.left).toBe('20%');
            expect(token('Aria Vale')).not.toHaveClass('MapToken-dragging');
        });

        test('a click that hardly moves is not a move', () => {
            const { drag, pointer, onMove } = setup();
            const element = drag('Aria Vale', [200, 200], [201, 201]);
            pointer(element, 'pointerup', 201, 201);
            expect(onMove).not.toHaveBeenCalled();
        });

        test('cannot be dragged off the map: it stops at the edge', () => {
            const single = setup({ tokens: [{ id: 'e', title: 'Edge', x: 0.2, y: 0.1 }], rects: zoneRects([{ name: 'All', x: 0, y: 0, width: 500, height: 250 }]) });
            const element = single.drag('Edge', [200, 50], [5000, -500]);
            single.pointer(element, 'pointerup', 5000, -500);
            expect(single.onMove).toHaveBeenCalledWith('e', { x: 1, y: 0 }, 'All');
        });

        test('a right-click does not pick it up', () => {
            const { token, pointer, onMove } = setup();
            pointer(token('Aria Vale'), 'pointerdown', 200, 200, { button: 2 });
            pointer(token('Aria Vale'), 'pointermove', 700, 200);
            pointer(token('Aria Vale'), 'pointerup', 700, 200);
            expect(onMove).not.toHaveBeenCalled();
        });

        test('a cancelled drag (a touch taken over by the browser) drops it where it was', () => {
            const { token, drag, pointer, onMove } = setup();
            const element = drag('Aria Vale', [200, 200], [700, 200]);
            pointer(element, 'pointercancel', 700, 200);
            expect(token('Aria Vale').style.left).toBe('20%');
            expect(onMove).not.toHaveBeenCalled();
        });

        test('moving the mouse over a token that is not being dragged does nothing', () => {
            const { token, pointer, onMove } = setup();
            pointer(token('Aria Vale'), 'pointermove', 700, 200);
            pointer(token('Aria Vale'), 'pointerup', 700, 200);
            expect(onMove).not.toHaveBeenCalled();
        });
    });

    describe('the arrow keys', () => {
        test('nudge the focused token, reporting each step', () => {
            const { token, onMove } = setup();
            fireEvent.keyDown(token('Aria Vale'), { key: 'ArrowRight' });
            expect(onMove).toHaveBeenLastCalledWith('a', { x: 0.22, y: 0.2 }, 'Left');

            fireEvent.keyDown(token('Aria Vale'), { key: 'ArrowDown' });
            expect(onMove).toHaveBeenLastCalledWith('a', { x: 0.2, y: 0.22 }, 'Left');
        });

        test('a step out of every zone is not taken', () => {
            const { token, onMove } = setup({ tokens: [{ id: 'a', title: 'Aria Vale', kind: 'player', x: 0.39, y: 0.2 }] });
            fireEvent.keyDown(token('Aria Vale'), { key: 'ArrowRight' });
            expect(onMove).not.toHaveBeenCalled();
        });

        test('a step over the map\'s edge stops at it', () => {
            const { token, onMove } = setup({ tokens: [{ id: 'a', title: 'Aria Vale', kind: 'player', x: 0.01, y: 0.2 }] });
            fireEvent.keyDown(token('Aria Vale'), { key: 'ArrowLeft' });
            expect(onMove).toHaveBeenCalledWith('a', { x: 0, y: 0.2 }, 'Left');
        });

        test('other keys, and anyone not allowed to move it, do nothing', () => {
            const first = setup();
            fireEvent.keyDown(first.token('Aria Vale'), { key: 'a' });
            expect(first.onMove).not.toHaveBeenCalled();
        });

        test('are ignored when the token cannot be moved', () => {
            const { token, onMove } = setup({ canMove: false });
            fireEvent.keyDown(token('Aria Vale'), { key: 'ArrowRight' });
            expect(onMove).not.toHaveBeenCalled();
        });
    });
    describe('defeated enemies', () => {
        const goblin = { id: 'g', title: 'Goblin 1', kind: 'enemy', x: 0.7, y: 0.2, defeated: true };

        test('are greyed out and crossed through, and their name says so', () => {
            const { token } = setup({ tokens: [goblin, tokens[0]] });
            expect(token('Goblin 1')).toHaveClass('MapToken-defeated');
            expect(token('Goblin 1')).toHaveAccessibleName('Goblin 1, Right, defeated');
        });

        test('a token that is not defeated is not', () => {
            const { token } = setup({ tokens: [{ ...goblin, defeated: false }] });
            expect(token('Goblin 1')).not.toHaveClass('MapToken-defeated');
            expect(token('Goblin 1')).toHaveAccessibleName('Goblin 1, Right');
        });

        test('are still where they fell, and can still be moved', () => {
            const { token, drag, pointer, onMove } = setup({ tokens: [goblin] });
            drag('Goblin 1', [700, 200], [400, 100]);
            pointer(token('Goblin 1'), 'pointerup', 400, 100);
            expect(token('Goblin 1').style.left).toBe('70%');
            expect(onMove).toHaveBeenCalledWith('g', { x: 0.4, y: 0.1 }, 'Left');
        });
    });

    describe('selecting a token', () => {
        const npc = { id: 'g', title: 'Goblin 1', kind: 'enemy', x: 0.7, y: 0.2, selectable: true };

        test('pressing one that can be selected selects it', () => {
            const onSelect = jest.fn();
            const { token, pointer } = setup({ tokens: [npc], onSelect });
            pointer(token('Goblin 1'), 'pointerdown', 700, 200, { button: 0 });
            expect(onSelect).toHaveBeenCalledWith('g');
        });

        test('the selected one is marked', () => {
            const { token } = setup({ tokens: [npc, tokens[0]], selected: 'g' });
            expect(token('Goblin 1')).toHaveClass('MapToken-selected');
            expect(token('Goblin 1')).toHaveAttribute('aria-pressed', 'true');
            expect(token('Aria Vale')).not.toHaveClass('MapToken-selected');
        });

        test('a token that cannot be selected (a player\'s) is not a toggle and does not select', () => {
            const onSelect = jest.fn();
            const { token, pointer } = setup({ onSelect });
            expect(token('Aria Vale')).not.toHaveAttribute('aria-pressed');
            pointer(token('Aria Vale'), 'pointerdown', 200, 200, { button: 0 });
            expect(onSelect).not.toHaveBeenCalled();
        });

        test('a right click does not select', () => {
            const onSelect = jest.fn();
            const { token, pointer } = setup({ tokens: [npc], onSelect });
            pointer(token('Goblin 1'), 'pointerdown', 700, 200, { button: 2 });
            expect(onSelect).not.toHaveBeenCalled();
        });
    });

    describe('dropping a token on the trash can', () => {
        const npc = { id: 'g', title: 'Goblin 1', kind: 'enemy', x: 0.7, y: 0.2, trashable: true };
        const fakeTrash = (over = false) => ({ carry: jest.fn(), hot: jest.fn(), hit: jest.fn(() => over) });

        test('a token that can be thrown away shows the can as soon as it is picked up', () => {
            const trash = fakeTrash();
            const { token, pointer } = setup({ tokens: [npc], trash });
            pointer(token('Goblin 1'), 'pointerdown', 700, 200, { button: 0 });
            expect(trash.carry).toHaveBeenCalledWith(true);
        });

        test('one that cannot (a player\'s) does not', () => {
            const trash = fakeTrash();
            const { token, pointer } = setup({ trash });
            pointer(token('Aria Vale'), 'pointerdown', 200, 200, { button: 0 });
            pointer(token('Aria Vale'), 'pointermove', 400, 100);
            pointer(token('Aria Vale'), 'pointerup', 400, 100);
            expect(trash.carry).not.toHaveBeenCalled();
            expect(trash.hit).not.toHaveBeenCalled();
        });

        test('the can lights up as the pointer goes over it, going by where the pointer is', () => {
            const trash = fakeTrash(true);
            const { token, pointer } = setup({ tokens: [npc], trash });
            pointer(token('Goblin 1'), 'pointerdown', 700, 200, { button: 0 });
            pointer(token('Goblin 1'), 'pointermove', 950, 480);
            expect(trash.hit).toHaveBeenCalledWith(950, 480);
            expect(trash.hot).toHaveBeenLastCalledWith(true);
        });

        test('let go over the can, it is thrown away and does not move', () => {
            const trash = fakeTrash(true);
            const onTrash = jest.fn();
            const { token, pointer, onMove } = setup({ tokens: [npc], trash, onTrash });
            pointer(token('Goblin 1'), 'pointerdown', 700, 200, { button: 0 });
            pointer(token('Goblin 1'), 'pointermove', 400, 100);
            pointer(token('Goblin 1'), 'pointerup', 950, 480);

            expect(onTrash).toHaveBeenCalledWith('g');
            expect(onMove).not.toHaveBeenCalled();
            expect(trash.carry).toHaveBeenLastCalledWith(false);
            expect(trash.hot).toHaveBeenLastCalledWith(false);
        });

        test('let go anywhere else it is moved as usual, and the can goes away', () => {
            const trash = fakeTrash(false);
            const onTrash = jest.fn();
            const { token, pointer, onMove } = setup({ tokens: [npc], trash, onTrash });
            pointer(token('Goblin 1'), 'pointerdown', 700, 200, { button: 0 });
            pointer(token('Goblin 1'), 'pointermove', 400, 100);
            pointer(token('Goblin 1'), 'pointerup', 400, 100);

            expect(onTrash).not.toHaveBeenCalled();
            expect(onMove).toHaveBeenCalledWith('g', { x: 0.4, y: 0.1 }, 'Left');
            expect(trash.carry).toHaveBeenLastCalledWith(false);
        });

        test('a token dragged over the can is not faded as if it were about to snap back, even outside every zone', () => {
            const trash = fakeTrash(true);
            const { token, pointer } = setup({ tokens: [npc], trash });
            pointer(token('Goblin 1'), 'pointerdown', 700, 200, { button: 0 });
            pointer(token('Goblin 1'), 'pointermove', 450, 450); // outside every zone
            expect(token('Goblin 1')).not.toHaveClass('MapToken-outside');
        });

        test('a drag that is cancelled puts the can away', () => {
            const trash = fakeTrash();
            const { token, pointer } = setup({ tokens: [npc], trash });
            pointer(token('Goblin 1'), 'pointerdown', 700, 200, { button: 0 });
            pointer(token('Goblin 1'), 'pointercancel', 700, 200);
            expect(trash.carry).toHaveBeenLastCalledWith(false);
        });

        test('with no trash can there is nothing to drop on, and dragging works as before', () => {
            const { token, pointer, onMove } = setup({ tokens: [npc] });
            pointer(token('Goblin 1'), 'pointerdown', 700, 200, { button: 0 });
            pointer(token('Goblin 1'), 'pointermove', 400, 100);
            pointer(token('Goblin 1'), 'pointerup', 400, 100);
            expect(onMove).toHaveBeenCalled();
        });
    });
});
