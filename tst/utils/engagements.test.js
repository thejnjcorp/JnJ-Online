import { engage, engagedGroups, engagedWith, engagementLinks, settleDrop, settleEngagements } from '../../src/utils/engagements';

const post = (id, status, index, fields = {}) => ({ id, title: id.toUpperCase(), content: '', status, index, ...fields });
const order = (posts, zone) => posts.filter(candidate => candidate.status === zone).sort((a, b) => a.index - b.index).map(candidate => candidate.id);

describe('engage', () => {
    test('puts two together in the target\'s zone, the one dragged last, in an engagement of their own', () => {
        const posts = [post('a', 'Zone 1', 0), post('b', 'Zone 1', 1), post('c', 'Zone 2', 0), post('d', 'Zone 1', 2)];
        const next = engage(posts, 'c', 'a');
        const a = next.find(candidate => candidate.id === 'a');
        const c = next.find(candidate => candidate.id === 'c');
        expect(a.engagement).toBeTruthy();
        expect(c).toMatchObject({ status: 'Zone 1', engagement: a.engagement });
        expect(order(next, 'Zone 1')).toEqual(['a', 'c', 'b', 'd']);
        expect(next.find(candidate => candidate.id === 'b').engagement).toBeUndefined();
    });

    test('anyone dragged onto a member of an engagement joins it, after the others in it', () => {
        const base = engage([post('a', 'Z', 0), post('b', 'Z', 1), post('c', 'Z', 2)], 'b', 'a');
        const next = engage(base, 'c', 'a');
        expect(order(next, 'Z')).toEqual(['a', 'b', 'c']);
        expect(new Set(next.map(candidate => candidate.engagement)).size).toBe(1);
    });

    test('someone taken out of an engagement of two by joining another leaves the first dismissed', () => {
        const first = engage([post('a', 'Z', 0), post('b', 'Z', 1), post('c', 'Z', 2), post('d', 'Z', 3)], 'b', 'a');
        const next = engage(first, 'c', 'd');
        const both = engage(next, 'a', 'd');
        // a left a+b, so b is alone again, and a is with c and d
        expect(both.find(candidate => candidate.id === 'b').engagement).toBeUndefined();
        expect(both.filter(candidate => candidate.engagement).map(candidate => candidate.id).sort()).toEqual(['a', 'c', 'd']);
    });

    test('does nothing for someone who is not there, or dropped on themselves', () => {
        const posts = [post('a', 'Z', 0)];
        expect(engage(posts, 'a', 'a')).toBe(posts);
        expect(engage(posts, 'a', 'nobody')).toBe(posts);
        expect(engage(posts, 'nobody', 'a')).toBe(posts);
    });
});

describe('settleEngagements', () => {
    test('leaves a tracker whose engagements are fine exactly as it is', () => {
        const posts = [post('a', 'Z', 0, { engagement: 'e' }), post('b', 'Z', 1, { engagement: 'e' }), post('c', 'Z', 2)];
        expect(settleEngagements(posts)).toBe(posts);
        expect(settleEngagements([])).toEqual([]);
        expect(settleEngagements(null)).toEqual([]);
    });

    test('dismisses an engagement that is down to one, putting them back in the zone\'s own list', () => {
        const next = settleEngagements([post('a', 'Z', 0, { engagement: 'e' }), post('b', 'Z', 1)]);
        expect(next[0]).not.toHaveProperty('engagement');
    });

    test('an engagement whose members are in different zones is dismissed in each', () => {
        const next = settleEngagements([post('a', 'Z1', 0, { engagement: 'e' }), post('b', 'Z2', 0, { engagement: 'e' })]);
        expect(next.some(candidate => candidate.engagement)).toBe(false);
    });

    test('brings the members of an engagement together where its first member stood, and numbers the zone again', () => {
        const next = settleEngagements([post('a', 'Z', 0, { engagement: 'e' }), post('x', 'Z', 1), post('b', 'Z', 2, { engagement: 'e' })]);
        expect(order(next, 'Z')).toEqual(['a', 'b', 'x']);
        expect(next.map(candidate => candidate.index).sort()).toEqual([0, 1, 2]);
    });
});

describe('settleDrop', () => {
    const group = () => [post('a', 'Z', 0, { engagement: 'e' }), post('b', 'Z', 1, { engagement: 'e' }), post('c', 'Z', 2, { engagement: 'e' }), post('d', 'Z', 3)];

    test('someone dropped between two members of an engagement is in it', () => {
        const dropped = [post('a', 'Z', 0, { engagement: 'e' }), post('d', 'Z', 1), post('b', 'Z', 2, { engagement: 'e' }), post('c', 'Z', 3)];
        const next = settleDrop(dropped, 'd');
        expect(next.find(candidate => candidate.id === 'd').engagement).toBe('e');
    });

    test('a member dropped outside it has left it, and an engagement left with one is dismissed', () => {
        const dropped = group().map(candidate => (candidate.id === 'd' ? { ...candidate, index: 0 } : { ...candidate, index: candidate.index + 1 }));
        const next = settleDrop(dropped.map(candidate => (candidate.id === 'a' ? { ...candidate, index: 4 } : candidate)), 'a');
        expect(next.find(candidate => candidate.id === 'a')).not.toHaveProperty('engagement');
        expect(next.filter(candidate => candidate.engagement).map(candidate => candidate.id).sort()).toEqual(['b', 'c']);
        const two = [post('a', 'Z', 1, { engagement: 'e' }), post('b', 'Z', 0, { engagement: 'e' }), post('c', 'Z', 2)];
        expect(settleDrop(two, 'a').some(candidate => candidate.engagement)).toBe(false);
    });

    test('a member dropped between two of its own stays in it', () => {
        const dropped = [post('b', 'Z', 0, { engagement: 'e' }), post('a', 'Z', 1, { engagement: 'e' }), post('c', 'Z', 2, { engagement: 'e' })];
        const next = settleDrop(dropped, 'a');
        expect(next).toBe(dropped);
    });

    test('someone dropped in the plain list, away from any engagement, is not in one', () => {
        const posts = [post('a', 'Z', 0), post('b', 'Z', 1)];
        expect(settleDrop(posts, 'a')).toBe(posts);
        expect(settleDrop(posts, 'nobody')).toBe(posts);
    });
});

describe('engagedWith', () => {
    test('names the others in the same engagement, and nobody for someone who is not in one', () => {
        const posts = engage([post('a', 'Z', 0), post('b', 'Z', 1), post('c', 'Z', 2)], 'b', 'a');
        expect(engagedWith(posts, 'a')).toEqual(['B']);
        expect(engagedWith(posts, 'c')).toEqual([]);
        expect(engagedWith(posts, 'nobody')).toEqual([]);
    });
});

describe('engagedGroups', () => {
    test('are the tokens engaged with each other, one group to an engagement, and not someone whose partner has no token', () => {
        const tokens = [{ id: 'a', engagement: 'e1' }, { id: 'b', engagement: 'e1' }, { id: 'c' }, { id: 'd', engagement: 'e2' }, { id: 'e', engagement: 'e3' }, { id: 'f', engagement: 'e3' }];
        expect(engagedGroups(tokens).map(group => [group.id, group.members.map(member => member.id)])).toEqual([['e1', ['a', 'b']], ['e3', ['e', 'f']]]);
        expect(engagedGroups([])).toEqual([]);
    });
});

describe('engagementLinks', () => {
    test('two are joined by one line, and nothing is joined to itself', () => {
        expect(engagementLinks([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toEqual([[0, 1]]);
        expect(engagementLinks([{ x: 0, y: 0 }])).toEqual([]);
    });

    test('several are tied together by the shortest lines, so a row is a chain rather than a web', () => {
        const row = [{ x: 0, y: 0 }, { x: 0.3, y: 0 }, { x: 0.1, y: 0 }, { x: 0.2, y: 0 }];
        expect(engagementLinks(row)).toEqual([[0, 2], [2, 3], [3, 1]]);
    });
});
