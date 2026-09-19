import { applyClassToCharacter, isLinkedToClass, resolveCharacter, savedActions } from '../../src/utils/characterClass';

const raceFeat = { actionName: 'Mild Fire', category: 'feat' };
const classData = {
    class_name: 'Monk', class_type: 'Crit Hunter', description: 'Live lore',
    base_armor_class: 16, base_hit_modifier: 7, base_healing_dice_type: 2,
    actions: [{ actionName: 'Fleetfoot' }, { actionName: 'Unpoachable' }],
};
const linked = {
    character_id: 'char-1', class_id: 'monk', class_version: 2, character_name: 'Kodi',
    class_name: 'Monk', base_armor_class: 14, base_hit_modifier: 5, current_health: 7,
    actions: [{ actionName: 'Old action' }], race_feat: raceFeat,
};

describe('isLinkedToClass', () => {
    test('needs both a real class id and an integer pinned version', () => {
        expect(isLinkedToClass(linked)).toBe(true);
        expect(isLinkedToClass({ ...linked, class_version: undefined })).toBe(false);
        expect(isLinkedToClass({ ...linked, class_version: '2' })).toBe(false);
        expect(isLinkedToClass({ ...linked, class_id: undefined })).toBe(false);
        expect(isLinkedToClass({ ...linked, class_id: '' })).toBe(false);
    });

    test("CharacterPageLayout.json's placeholder class_id (\"id\") does not count as a class", () => {
        expect(isLinkedToClass({ ...linked, class_id: 'id' })).toBe(false);
    });

    test('is safe on nothing at all', () => {
        expect(isLinkedToClass(undefined)).toBe(false);
    });
});

describe('savedActions', () => {
    test('appends the race feat when it is not already among the saved actions', () => {
        expect(savedActions({ actions: [{ actionName: 'A' }], race_feat: raceFeat })).toEqual([{ actionName: 'A' }, raceFeat]);
    });

    test('does not duplicate a race feat already merged into a legacy character\'s actions', () => {
        const actions = [{ actionName: 'A' }, raceFeat];
        expect(savedActions({ actions, race_feat: raceFeat })).toEqual(actions);
    });

    test('with no actions or race feat, returns an empty list', () => {
        expect(savedActions({})).toEqual([]);
    });
});

describe('applyClassToCharacter', () => {
    test('replaces the class-derived fields with the live class, keeping the race feat', () => {
        const result = applyClassToCharacter(linked, classData);

        expect(result.actions).toEqual([...classData.actions, raceFeat]);
        expect(result.base_armor_class).toBe(16);
        expect(result.base_hit_modifier).toBe(7);
        expect(result.base_healing_dice_type).toBe(2);
        expect(result.class_type).toBe('Crit Hunter');
        expect(result.class_description).toBe('Live lore');
    });

    test('leaves character state and identity alone', () => {
        const result = applyClassToCharacter(linked, classData);

        expect(result.current_health).toBe(7);
        expect(result.character_id).toBe('char-1');
        expect(result.character_name).toBe('Kodi');
    });

    test('does not mutate the character it was given', () => {
        const before = structuredClone(linked);
        applyClassToCharacter(linked, classData);
        expect(linked).toEqual(before);
    });

    test('a field the class does not define keeps the character\'s value', () => {
        const result = applyClassToCharacter(linked, { actions: [] });
        expect(result.base_armor_class).toBe(14);
        expect(result.class_name).toBe('Monk');
    });

    test('with no race feat, the actions are exactly the class\'s', () => {
        const { race_feat, ...noRaceFeat } = linked;
        expect(applyClassToCharacter(noRaceFeat, classData).actions).toEqual(classData.actions);
    });

    test('with no class data, returns the character unchanged', () => {
        expect(applyClassToCharacter(linked, null)).toBe(linked);
    });
});

describe('resolveCharacter', () => {
    test('a linked character with its class loaded gets the live class', () => {
        expect(resolveCharacter(linked, classData).base_armor_class).toBe(16);
    });

    test('a linked character whose class could not be loaded falls back to its saved copy plus the race feat', () => {
        const result = resolveCharacter(linked, null);
        expect(result.base_armor_class).toBe(14);
        expect(result.actions).toEqual([{ actionName: 'Old action' }, raceFeat]);
    });

    test('a legacy (unlinked) character is returned as-is even if class data is supplied', () => {
        const legacy = { character_id: 'old', class_name: 'Fighter', actions: [{ actionName: 'Stab' }] };
        expect(resolveCharacter(legacy, classData)).toBe(legacy);
    });
});
