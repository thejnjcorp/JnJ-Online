import { applyClassToCharacter, canAdministerCharacter, characterClassName, classToCharacterFields, isLinkedToClass, isLinkedToRace, raceActionsOf, raceToCharacterFields, resolveCharacter, savedActions, savedRaceActions } from '../../src/utils/characterClass';

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

describe('resolveCharacter and levels', () => {
    const byLevel = {
        class_id: 'monk', class_version: 1, base_armor_class: 14, base_hit_modifier: 5, base_damage_modifier: 2,
        actions: [{ actionName: 'Start' }, { actionName: 'Fleetfoot', actionLevel: 3 }, { actionName: 'Ultimate', actionLevel: 6 }],
    };
    const names = character => character.actions.map(action => action.actionName);

    test('an action stays hidden until the character reaches its Level', () => {
        expect(names(resolveCharacter({ ...byLevel, experience_points: 0 }))).toEqual(['Start']);
        expect(names(resolveCharacter({ ...byLevel, experience_points: 2000 }))).toEqual(['Start', 'Fleetfoot']);
        expect(names(resolveCharacter({ ...byLevel, experience_points: 5000 }))).toEqual(['Start', 'Fleetfoot', 'Ultimate']);
    });

    test('an action with no Level is always there, and a Level that is not a number counts as 1', () => {
        expect(names(resolveCharacter({ actions: [{ actionName: 'A' }, { actionName: 'B', actionLevel: 'x' }], experience_points: 0 }))).toEqual(['A', 'B']);
    });

    test('a live class\'s actions are hidden by level too, along with racial ones', () => {
        const live = { ...byLevel, experience_points: 0 };
        const resolved = resolveCharacter(live, { actions: [{ actionName: 'Live' }, { actionName: 'Later', actionLevel: 2 }] }, { actions: [{ actionName: 'Race', actionLevel: 2 }] });
        expect(names(resolved)).toEqual(['Live']);
    });

    test('nothing changes for a character with no level-gated actions and no bonuses', () => {
        const plain = { class_id: 'monk', actions: [{ actionName: 'Start' }], experience_points: 0 };
        expect(resolveCharacter(plain)).toBe(plain);
    });

    test('claimed level-up bonuses are added to the stats they change, without touching the doc', () => {
        const doc = { ...byLevel, experience_points: 0, level_bonuses: { armor_class: 2, hit_modifier: 1, damage_modifier: -1 } };
        const resolved = resolveCharacter(doc);
        expect(resolved).toMatchObject({ base_armor_class: 16, base_hit_modifier: 6, base_damage_modifier: 1 });
        expect(doc.base_armor_class).toBe(14);
    });

    test('bonuses are added to the live class\'s values, not the saved copy\'s', () => {
        const doc = { ...byLevel, experience_points: 0, level_bonuses: { armor_class: 1 } };
        expect(resolveCharacter(doc, { base_armor_class: 20, actions: [] }).base_armor_class).toBe(21);
    });

    test('a bonus of 0, or a stat that is only a direct field, changes nothing', () => {
        const doc = { ...byLevel, experience_points: 0, level_bonuses: { armor_class: 0, maximum_health: 5 }, actions: [] };
        expect(resolveCharacter(doc)).toBe(doc);
    });

    test('takes the class\'s level rewards live, and keeps the saved copy for a class that has none', () => {
        const withSaved = { ...byLevel, experience_points: 0, level_rewards: [{ id: 'old' }] };
        expect(resolveCharacter(withSaved, { level_rewards: [{ id: 'new' }], actions: [] }).level_rewards).toEqual([{ id: 'new' }]);
        expect(resolveCharacter(withSaved, { actions: [] }).level_rewards).toEqual([{ id: 'old' }]);
    });

    test('tolerates there being no character yet', () => {
        expect(resolveCharacter(undefined)).toBeUndefined();
    });
});

describe('classToCharacterFields', () => {
    const classDoc = {
        id: 'class-1', class_name: 'Monk', class_type: 'Crit Hunter', description: 'Lore', version: 3, actions: [{ actionName: 'Fleetfoot' }],
        base_armor_class: 16, level_rewards: [{ id: 'r' }],
        canWrite: ['a'], canRead: ['b'], admins: ['c'], author: 'Jonah', public: true, isDefault: true, visibility: 'public', versionNotes: 'n', publishedAt: 't',
    };

    test('copies what makes it the class, pinned to its current version', () => {
        expect(classToCharacterFields(classDoc)).toEqual({
            class_id: 'class-1', class_name: 'Monk', class_type: 'Crit Hunter', class_description: 'Lore', class_version: 3,
            actions: [{ actionName: 'Fleetfoot' }], base_armor_class: 16, level_rewards: [{ id: 'r' }],
        });
    });

    test('never copies the class\'s permissions or publishing details onto a character', () => {
        const fields = classToCharacterFields(classDoc);
        ['canWrite', 'canRead', 'admins', 'author', 'public', 'isDefault', 'visibility', 'version', 'versionNotes', 'publishedAt', 'id', 'description'].forEach(key => expect(fields).not.toHaveProperty(key));
    });

    test('a class with no description, version or actions still yields values Firestore will accept', () => {
        expect(classToCharacterFields({ id: 'c', class_name: 'X' })).toEqual({ class_id: 'c', class_name: 'X', class_description: '', class_version: 1, actions: [] });
    });
});

describe('raceToCharacterFields', () => {
    test('pins the race to its version with its actions', () => {
        expect(raceToCharacterFields({ id: 'r1', name: 'Kobold', version: 2, actions: [{ actionName: 'Mild Fire' }] })).toEqual({
            race_id: 'r1', race_name: 'Kobold', race_version: 2, race_actions: [{ actionName: 'Mild Fire' }],
        });
    });

    test('an old race with a single feat and no version', () => {
        expect(raceToCharacterFields({ id: 'r1', name: 'Kobold', feat: raceFeat })).toEqual({ race_id: 'r1', race_name: 'Kobold', race_version: 1, race_actions: [raceFeat] });
    });
});

describe('canAdministerCharacter', () => {
    const character = { playerId: 'player', admins: ['player', 'friend'] };
    const campaign = { director_uid: 'dm', canWrite: ['dm', 'co-dm'], admins: ['dm'] };

    test.each([
        ['the player', 'player', true],
        ['a character admin the player added', 'friend', true],
        ['the campaign director', 'dm', true],
        ['a co-director', 'co-dm', true],
        ['another player', 'stranger', false],
        ['someone signed out', '', false],
        ['someone signed out (undefined)', undefined, false],
    ])('%s', (_who, userId, allowed) => {
        expect(canAdministerCharacter(character, campaign, userId)).toBe(allowed);
    });

    test('works while the campaign has not loaded, and for a character with a legacy userId field', () => {
        expect(canAdministerCharacter(character, undefined, 'stranger')).toBe(false);
        expect(canAdministerCharacter(character, undefined, 'player')).toBe(true);
        expect(canAdministerCharacter({ userId: 'old-owner' }, {}, 'old-owner')).toBe(true);
    });
});

describe('characterClassName', () => {
    test('is the class\'s name saved on a character made since classes were reworked, which has no older `class` field', () => {
        expect(characterClassName({ class_id: 'magus', class_name: 'Magus' })).toBe('Magus');
    });

    test('is the older `class` text on a character from before that', () => {
        expect(characterClassName({ class: 'Chef' })).toBe('Chef');
    });

    test('prefers the class\'s name when a character has both', () => {
        expect(characterClassName({ class: 'Old Name', class_name: 'Magus' })).toBe('Magus');
    });

    test('is empty, not "undefined", for a character with neither', () => {
        expect(characterClassName({})).toBe('');
        expect(characterClassName(undefined)).toBe('');
    });
});
