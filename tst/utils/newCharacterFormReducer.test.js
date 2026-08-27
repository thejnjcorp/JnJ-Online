import { newCharacterFormReducer } from '../../src/utils/newCharacterFormReducer';

describe('newCharacterFormReducer', () => {
    test('SET_FORM_DATA merges the payload over existing state', () => {
        const state = { character_name: 'Old', class_id: 'c1' };
        const result = newCharacterFormReducer(state, { type: 'SET_FORM_DATA', payload: { character_name: 'New' } });
        expect(result).toEqual({ character_name: 'New', class_id: 'c1' });
    });

    test('any other event sets a single field by name/value', () => {
        const result = newCharacterFormReducer({ character_name: 'Old' }, { name: 'character_name', value: 'New' });
        expect(result).toEqual({ character_name: 'New' });
    });

    test('does not mutate the original state object', () => {
        const state = { character_name: 'Old' };
        const result = newCharacterFormReducer(state, { name: 'character_name', value: 'New' });
        expect(result).not.toBe(state);
        expect(state.character_name).toBe('Old');
    });

    test('is structurally identical to statusFormReducer (same simple set/merge shape, kept as separate exports per component)', () => {
        const state = { a: 1 };
        const event = { name: 'a', value: 2 };
        // eslint-disable-next-line global-require
        const { statusFormReducer } = require('../../src/utils/statusFormReducer');
        expect(newCharacterFormReducer(state, event)).toEqual(statusFormReducer(state, event));
    });
});
