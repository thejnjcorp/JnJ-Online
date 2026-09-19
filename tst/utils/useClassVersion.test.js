import { renderHook, waitFor, act } from '@testing-library/react';

const mockResolveClassVersion = jest.fn();
jest.mock('../../src/utils/classVersions', () => ({
    resolveClassVersion: (...args) => mockResolveClassVersion(...args),
}));
const mockResolveRaceVersion = jest.fn();
jest.mock('../../src/utils/raceVersions', () => ({
    resolveRaceVersion: (...args) => mockResolveRaceVersion(...args),
}));

// eslint-disable-next-line import/first
import { useClassVersion, useRaceVersion, useResolvedCharacters } from '../../src/utils/useClassVersion';

const monk = { class_name: 'Monk', base_armor_class: 16, actions: [{ actionName: 'Fleetfoot' }] };

describe('useClassVersion', () => {
    test('a character with no pinned version is "unlinked" and reads nothing', () => {
        const { result } = renderHook(() => useClassVersion('monk', undefined));

        expect(result.current.status).toBe('unlinked');
        expect(mockResolveClassVersion).not.toHaveBeenCalled();
    });

    test('the placeholder class id ("id") is treated as unlinked too', () => {
        const { result } = renderHook(() => useClassVersion('id', 1));
        expect(result.current.status).toBe('unlinked');
        expect(mockResolveClassVersion).not.toHaveBeenCalled();
    });

    test('loads the pinned version: loading first, then ready with the class and the latest version number', async () => {
        mockResolveClassVersion.mockResolvedValue({ data: monk, version: 2, latestVersion: 4 });

        const { result } = renderHook(() => useClassVersion('monk', 2));

        expect(result.current.status).toBe('loading');
        await waitFor(() => expect(result.current.status).toBe('ready'));
        expect(result.current.classData).toEqual(monk);
        expect(result.current.latestVersion).toBe(4);
        expect(mockResolveClassVersion).toHaveBeenCalledWith('monk', 2);
    });

    test('a class that cannot be read falls back instead of throwing', async () => {
        mockResolveClassVersion.mockRejectedValue(new Error('permission-denied'));

        const { result } = renderHook(() => useClassVersion('monk', 2));

        await waitFor(() => expect(result.current.status).toBe('fallback'));
        expect(result.current.classData).toBeNull();
    });

    test('switching to another pinned version loads that one', async () => {
        mockResolveClassVersion.mockResolvedValue({ data: monk, version: 1, latestVersion: 2 });
        const { result, rerender } = renderHook(({ version }) => useClassVersion('monk', version), { initialProps: { version: 1 } });
        await waitFor(() => expect(result.current.status).toBe('ready'));

        rerender({ version: 2 });

        await waitFor(() => expect(mockResolveClassVersion).toHaveBeenLastCalledWith('monk', 2));
        await waitFor(() => expect(result.current.status).toBe('ready'));
    });
});

describe('useRaceVersion', () => {
    const kobold = { name: 'Kobold', actions: [{ actionName: 'Pack Tactics' }] };

    test('a character with no pinned race version is "unlinked" and reads nothing', () => {
        const { result } = renderHook(() => useRaceVersion('kobold', undefined));

        expect(result.current.status).toBe('unlinked');
        expect(mockResolveRaceVersion).not.toHaveBeenCalled();
    });

    test('loads the pinned race version and the latest version number', async () => {
        mockResolveRaceVersion.mockResolvedValue({ data: kobold, version: 1, latestVersion: 3 });

        const { result } = renderHook(() => useRaceVersion('kobold', 1));

        expect(result.current.status).toBe('loading');
        await waitFor(() => expect(result.current.status).toBe('ready'));
        expect(result.current.raceData).toEqual(kobold);
        expect(result.current.latestVersion).toBe(3);
        expect(mockResolveRaceVersion).toHaveBeenCalledWith('kobold', 1);
        expect(mockResolveClassVersion).not.toHaveBeenCalled();
    });

    test('a race that cannot be read falls back', async () => {
        mockResolveRaceVersion.mockRejectedValue(new Error('permission-denied'));

        const { result } = renderHook(() => useRaceVersion('kobold', 1));

        await waitFor(() => expect(result.current.status).toBe('fallback'));
        expect(result.current.raceData).toBeNull();
    });
});

describe('useResolvedCharacters', () => {
    const linked = (id, classId, version) => ({ character_id: id, class_id: classId, class_version: version, base_armor_class: 10, actions: [] });

    test('reads each distinct (class, version) once, however many characters share it', async () => {
        mockResolveClassVersion.mockResolvedValue({ data: monk });
        const characters = [linked('a', 'monk', 1), linked('b', 'monk', 1), linked('c', 'monk', 2)];

        const { result } = renderHook(() => useResolvedCharacters(characters));

        await waitFor(() => expect(result.current.map(c => c.base_armor_class)).toEqual([16, 16, 16]));
        expect(mockResolveClassVersion).toHaveBeenCalledTimes(2);
    });

    test('returns the characters in the same order, resolved against their own class', async () => {
        mockResolveClassVersion.mockImplementation(async (classId) => ({ data: { base_armor_class: classId === 'monk' ? 16 : 12, actions: [] } }));
        const characters = [linked('a', 'monk', 1), linked('b', 'fighter', 1)];

        const { result } = renderHook(() => useResolvedCharacters(characters));

        await waitFor(() => expect(result.current.map(c => c.base_armor_class)).toEqual([16, 12]));
        expect(result.current.map(c => c.character_id)).toEqual(['a', 'b']);
    });

    test('legacy characters pass through untouched and trigger no reads', () => {
        const legacy = { character_id: 'old', class_name: 'Fighter', actions: [{ actionName: 'Stab' }] };

        const { result } = renderHook(() => useResolvedCharacters([legacy]));

        expect(result.current[0]).toBe(legacy);
        expect(mockResolveClassVersion).not.toHaveBeenCalled();
    });

    test('a class that cannot be read keeps that character on its saved copy, and is not retried', async () => {
        mockResolveClassVersion.mockRejectedValue(new Error('denied'));
        const characters = [linked('a', 'private-class', 1)];

        const { result, rerender } = renderHook(() => useResolvedCharacters(characters));
        await waitFor(() => expect(mockResolveClassVersion).toHaveBeenCalledTimes(1));
        await act(async () => {}); // let the rejection settle into state
        rerender();

        expect(result.current[0].base_armor_class).toBe(10);
        expect(mockResolveClassVersion).toHaveBeenCalledTimes(1);
    });

    test('resolves races too, reading each distinct (race, version) once', async () => {
        mockResolveClassVersion.mockResolvedValue({ data: monk });
        mockResolveRaceVersion.mockResolvedValue({ data: { name: 'Kobold Renamed', actions: [{ actionName: 'Pack Tactics', category: 'feat' }] } });
        const withRace = (id) => ({ ...linked(id, 'monk', 1), race_id: 'kobold', race_version: 1, race_name: 'Kobold', race_actions: [] });

        const { result } = renderHook(() => useResolvedCharacters([withRace('a'), withRace('b')]));

        await waitFor(() => expect(result.current.map(c => c.race_name)).toEqual(['Kobold Renamed', 'Kobold Renamed']));
        expect(result.current[0].actions.map(a => a.actionName)).toEqual(['Fleetfoot', 'Pack Tactics']);
        expect(mockResolveRaceVersion).toHaveBeenCalledTimes(1);
    });

    test('an empty or missing list is fine', () => {
        expect(renderHook(() => useResolvedCharacters([])).result.current).toEqual([]);
        expect(renderHook(() => useResolvedCharacters(undefined)).result.current).toEqual([]);
    });
});
