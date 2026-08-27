import { statusFormReducer } from '../../src/utils/statusFormReducer';

describe('statusFormReducer', () => {
    test('SET_FORM_DATA merges the payload over existing state', () => {
        const state = { name: 'Old', polarity: 'buff' };
        const result = statusFormReducer(state, { type: 'SET_FORM_DATA', payload: { name: 'New' } });
        expect(result).toEqual({ name: 'New', polarity: 'buff' });
    });

    test('any other event sets a single field by name/value, unlike classFormReducer this never nests', () => {
        const result = statusFormReducer({ name: 'Old' }, { name: 'name', value: 'New' });
        expect(result).toEqual({ name: 'New' });
    });

    test('a field name containing brackets is still just a literal key (no dotted-path parsing here)', () => {
        const result = statusFormReducer({}, { name: 'effects[0].delta', value: 5 });
        expect(result).toEqual({ 'effects[0].delta': 5 });
    });

    test('does not mutate the original state object', () => {
        const state = { name: 'Old' };
        const result = statusFormReducer(state, { name: 'name', value: 'New' });
        expect(result).not.toBe(state);
        expect(state.name).toBe('Old');
    });

    test('SET_FORM_DATA with an empty payload is a no-op copy of state', () => {
        const state = { name: 'Old' };
        expect(statusFormReducer(state, { type: 'SET_FORM_DATA', payload: {} })).toEqual(state);
    });
});
