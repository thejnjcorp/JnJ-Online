import { classFormReducer, navigateFormDataKey } from '../../src/utils/classFormReducer';

describe('navigateFormDataKey', () => {
    test('an array-indexed key creates the array and item if missing, and always descends into it', () => {
        const root = {};
        const next = navigateFormDataKey(root, 'actions[0]', false);
        expect(root.actions).toEqual([{}]);
        expect(next).toBe(root.actions[0]);
    });

    test('an array-indexed key descends into an existing item without overwriting it', () => {
        const root = { actions: [{ actionName: 'Fireball' }] };
        const next = navigateFormDataKey(root, 'actions[0]', false);
        expect(next).toBe(root.actions[0]);
        expect(next.actionName).toBe('Fireball');
    });

    test('an array-indexed key descends even when isLast is true (no special-casing for arrays)', () => {
        const root = {};
        const next = navigateFormDataKey(root, 'actions[0]', true);
        expect(next).toBe(root.actions[0]);
    });

    test('a plain key creates the nested object if missing and descends when not last', () => {
        const root = {};
        const next = navigateFormDataKey(root, 'metadata', false);
        expect(root.metadata).toEqual({});
        expect(next).toBe(root.metadata);
    });

    test('a plain key when isLast stays on the current object rather than descending', () => {
        const root = {};
        const next = navigateFormDataKey(root, 'tagInfo', true);
        expect(next).toBe(root);
        expect(root.tagInfo).toEqual({}); // still initialized, just not descended into
    });
});

describe('classFormReducer', () => {
    test('SET_FORM_DATA merges the payload over existing state', () => {
        const state = { visibility: 'private', class_name: 'Old' };
        const result = classFormReducer(state, { type: 'SET_FORM_DATA', payload: { class_name: 'New' } });
        expect(result).toEqual({ visibility: 'private', class_name: 'New' });
    });

    test('a flat field name (no array/dot path) sets that property directly', () => {
        const result = classFormReducer({ class_name: 'Old' }, { name: 'class_name', value: 'New' });
        expect(result).toEqual({ class_name: 'New' });
    });

    test('a single array-indexed path creates the array and sets the field on that item', () => {
        const result = classFormReducer({}, { name: 'actions[0].actionName', value: 'Fireball' });
        expect(result).toEqual({ actions: [{ actionName: 'Fireball' }] });
    });

    test('a nested array-of-arrays path (tags inside an action) creates every intermediate level', () => {
        const result = classFormReducer({}, { name: 'actions[0].tags[0].tagInfo', value: 'Fire' });
        expect(result).toEqual({ actions: [{ tags: [{ tagInfo: 'Fire' }] }] });
    });

    test('updating one array item leaves sibling items and other fields on the same item untouched', () => {
        const state = {
            actions: [
                { actionName: 'Fireball', actionCost: 1 },
                { actionName: 'Ice Bolt', actionCost: 2 },
            ],
        };
        const result = classFormReducer(state, { name: 'actions[0].actionName', value: 'Fire Bolt' });
        expect(result.actions[0]).toEqual({ actionName: 'Fire Bolt', actionCost: 1 });
        expect(result.actions[1]).toEqual({ actionName: 'Ice Bolt', actionCost: 2 });
    });

    test('returns a new top-level object, but a nested array/object path mutates the shared nested reference in place', () => {
        // { ...state } is a shallow copy, and navigateFormDataKey descends into
        // (rather than cloning) an array/object that already exists, so the
        // final assignment lands on the SAME nested object the original state
        // was pointing at. The top-level identity change is enough for
        // useReducer to trigger a re-render, but code holding onto the old
        // state object (e.g. a "revert to saved snapshot" copy) can see this
        // mutation too unless it deep-clones first - see ClassPage.js's
        // handleEditClick, which uses structuredClone() for exactly that reason.
        const state = { actions: [{ actionName: 'Fireball' }] };
        const result = classFormReducer(state, { name: 'actions[0].actionName', value: 'Changed' });
        expect(result).not.toBe(state);
        expect(result.actions).toBe(state.actions);
        expect(state.actions[0].actionName).toBe('Changed');
    });

    test('setting a second field on an existing array item preserves the first', () => {
        let state = classFormReducer({}, { name: 'actions[0].actionName', value: 'Fireball' });
        state = classFormReducer(state, { name: 'actions[0].actionCost', value: 3 });
        expect(state.actions[0]).toEqual({ actionName: 'Fireball', actionCost: 3 });
    });

    test('a dotted name with no array index anywhere in it is NOT nested - arrayRegex requires at least one [n], so it is set as one literal flat key', () => {
        const result = classFormReducer({}, { name: 'metadata.note', value: 'hello' });
        expect(result).toEqual({ 'metadata.note': 'hello' });
    });
});
