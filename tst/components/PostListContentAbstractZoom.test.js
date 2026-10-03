import { render, screen, fireEvent, act } from '@testing-library/react';
import { PostListContentAbstract } from '../../src/utils/DraggableElements/PostListContentAbstract.tsx';

// The image is 1000 x 500 and the frame 400 x 400: fitted, the map is 400 wide and 200 tall.
let observed;
beforeEach(() => {
    global.ResizeObserver = class {
        constructor(callback) { observed = callback; }
        observe() {}
        disconnect() {}
    };
});

// (stable, like the real thing's: a new array each render would never settle)
const POSTS = [];
const STATUSES = ['Zone 1'];
const ZONES = [{ name: 'Zone 1', x: 0, y: 0, width: 100, height: 100 }];
const usePosts = () => ({ posts: POSTS, loading: false });

function renderMap(zoom) {
    render(<PostListContentAbstract inputStatuses={STATUSES} usePosts={usePosts} updatePosts={() => {}}
        backgroundImage="map.png" zoneLayout={ZONES} zoom={zoom}/>);
    const img = screen.getByRole('img', { name: 'combat map' });
    Object.defineProperty(img, 'naturalWidth', { value: 1000 });
    Object.defineProperty(img, 'naturalHeight', { value: 500 });
    fireEvent.load(img);
    act(() => observed([{ contentRect: { width: 400, height: 400 } }]));
    return img;
}

// the frame is the image's wrapper's wrapper
// eslint-disable-next-line testing-library/no-node-access
const frameOf = img => img.parentElement.parentElement;

describe('PostListContentAbstract zoom', () => {
    test('a map at 1 is fitted whole to its frame, which does not scroll', () => {
        const img = renderMap(1);
        expect(img).toHaveStyle({ width: '400px', height: '200px' });
        expect(frameOf(img)).toHaveStyle({ overflow: 'hidden' });
    });

    test('a bigger map is that many times the size, and the frame scrolls around it', () => {
        const img = renderMap(2);
        expect(img).toHaveStyle({ width: '800px', height: '400px' });
        expect(frameOf(img)).toHaveStyle({ overflow: 'auto' });
    });

    test('a smaller one is drawn smaller, inside the frame', () => {
        expect(renderMap(0.5)).toHaveStyle({ width: '200px', height: '100px' });
    });
});
