import { applyClassToCharacter, isLinkedToClass, isLinkedToRace, raceActionsOf, resolveCharacter, savedActions, savedRaceActions } from '../../src/utils/characterClass';

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

describe('isLinkedToRace', () => {
    test('needs an integer race_version and a real race_id', () => {
        expect(isLinkedToRace({ race_id: 'kobold', race_version: 1 })).toBe(true);
        expect(isLinkedToRace({ race_id: 'kobold' })).toBe(false);
        expect(isLinkedToRace({ race_version: 1 })).toBe(false);
        expect(isLinkedToRace({ race_id: 'id', race_version: 1 })).toBe(false);
        expect(isLinkedToRace(undefined)).toBe(false);
    });
});

describe('raceActionsOf', () => {
    test('uses the actions list, falling back to the older single feat, or nothing', () => {
        expect(raceActionsOf({ actions: [raceFeat] })).toEqual([raceFeat]);
        expect(raceActionsOf({ feat: raceFeat })).toEqual([raceFeat]);
        expect(raceActionsOf({ name: 'Featless' })).toEqual([]);
        expect(raceActionsOf(null)).toEqual([]);
    });
});

describe('savedRaceActions', () => {
    test('prefers race_actions, falls back to the legacy race_feat, or nothing', () => {
        expect(savedRaceActions({ race_actions: [raceFeat], race_feat: { actionName: 'x' } })).toEqual([raceFeat]);
        expect(savedRaceActions({ race_feat: raceFeat })).toEqual([raceFeat]);
        expect(savedRaceActions({})).toEqual([]);
    });
});

describe('resolveCharacter with races', () => {
    const raceData = { name: 'Kobold Prime', actions: [{ actionName: 'Pack Tactics' }, { actionName: 'Fleetfoot' }] };
    const raced = { ...linked, race_feat: undefined, race_id: 'kobold', race_version: 1, race_name: 'Kobold', race_actions: [raceFeat] };

    test('a linked race with data loaded replaces the saved race actions and sets the race name', () => {
        const result = resolveCharacter(raced, classData, raceData);
        expect(result.race_name).toBe('Kobold Prime');
        expect(result.actions.map(a => a.actionName)).toEqual(['Fleetfoot', 'Unpoachable', 'Pack Tactics']);
    });

    test('a linked race that could not be loaded keeps the saved race actions', () => {
        const result = resolveCharacter(raced, classData, null);
        expect(result.race_name).toBe('Kobold');
        expect(result.actions.map(a => a.actionName)).toEqual(['Fleetfoot', 'Unpoachable', 'Mild Fire']);
    });

    test('a live race works even when the class is unlinked or unreadable', () => {
        const result = resolveCharacter(raced, null, raceData);
        expect(result.actions.map(a => a.actionName)).toEqual(['Old action', 'Pack Tactics', 'Fleetfoot']);
    });

    test('race data is ignored for a character not linked to a race', () => {
        const result = resolveCharacter({ ...raced, race_version: undefined }, classData, raceData);
        expect(result.race_name).toBe('Kobold');
        expect(result.actions.map(a => a.actionName)).toEqual(['Fleetfoot', 'Unpoachable', 'Mild Fire']);
    });

    test('a race with no actions contributes none', () => {
        const result = resolveCharacter(raced, classData, { name: 'Plain' });
        expect(result.actions.map(a => a.actionName)).toEqual(['Fleetfoot', 'Unpoachable']);
    });
});
