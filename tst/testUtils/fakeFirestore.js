// A small in-memory stand-in for the parts of Firestore that transactions use, so the
// modules that move things between several documents can be tested end to end.
//
//   const store = fakeFirestore({ 'characters/aria': { inventory: [] } });
//   jest.mock('firebase/firestore', () => store.module());      // (hoisted; see callers)
//
// `refs` are { __path: 'characters/aria' } - what the mocked doc() returns.
export function fakeFirestore(initial = {}) {
    const docs = new Map(Object.entries(initial).map(([path, data]) => [path, structuredClone(data)]));
    const writes = [];
    let failNext = null;

    const snapshotOf = path => ({
        exists: () => docs.has(path),
        data: () => (docs.has(path) ? structuredClone(docs.get(path)) : undefined),
        id: path.split('/').at(-1),
    });

    const transaction = {
        get: async ref => snapshotOf(ref.__path),
        set: (ref, data, options) => {
            writes.push({ op: 'set', path: ref.__path, data, options });
            docs.set(ref.__path, options?.merge ? { ...(docs.get(ref.__path) || {}), ...structuredClone(data) } : structuredClone(data));
        },
        update: (ref, data) => {
            if (!docs.has(ref.__path)) throw new Error('No document to update: ' + ref.__path);
            writes.push({ op: 'update', path: ref.__path, data });
            docs.set(ref.__path, { ...docs.get(ref.__path), ...structuredClone(data) });
        },
    };

    return {
        docs,
        writes,
        get: path => docs.get(path),
        set: (path, data) => docs.set(path, structuredClone(data)),
        failNextTransaction: error => { failNext = error; },
        docRef: (_db, ...path) => ({ __path: path.join('/') }),
        runTransaction: async (_db, fn) => {
            if (failNext) { const error = failNext; failNext = null; throw error; }
            // a transaction's writes only count if it finishes: run on a copy, keep it on success
            const before = new Map([...docs].map(([path, data]) => [path, structuredClone(data)]));
            const writesBefore = writes.length;
            try {
                return await fn(transaction);
            } catch (error) {
                docs.clear();
                before.forEach((data, path) => docs.set(path, data));
                writes.length = writesBefore;
                throw error;
            }
        },
    };
}
