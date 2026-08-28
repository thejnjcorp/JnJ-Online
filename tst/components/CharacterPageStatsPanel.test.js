jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockDoc = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
}));

// eslint-disable-next-line import/first
import { render, screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/first
import { CharacterPageStatsPanel } from '../../src/components/CharacterPageStatsPanel';

// experience_points=0 -> level 1, where ArmorClass passes through the base
// stat unmodified (see CharacterStatCalculator's level-1 case), keeping the
// expected AC simple to reason about here.
const characterPageLayoutLive = {
    character_id: 'char-1', userId: 'owner-1',
    experience_points: 0, base_armor_class: 12, base_hit_modifier: 2, base_damage_modifier: 0,
    base_damage_dice: 1, base_damage_dice_type: 1, base_healing_dice_type: 1,
    current_health: 20, maximum_health: 25, temporary_health: 0, hardness: 5,
};

beforeEach(() => {
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockUpdateDoc.mockResolvedValue(undefined);
    window.alert = jest.fn();
});

afterEach(() => {
    delete window.alert;
    jest.useRealTimers();
});

describe('CharacterPageStatsPanel', () => {
    test('shows the initial health, XP, and hardness values', () => {
        render(<CharacterPageStatsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);
        // Input order: current health, max health, temp health, XP, hardness.
        const [current, max, temp, xp, hardness] = screen.getAllByRole('spinbutton');
        expect(current).toHaveValue(20);
        expect(max).toHaveValue(25);
        expect(temp).toHaveValue(0);
        expect(xp).toHaveValue(0);
        expect(hardness).toHaveValue(5);
    });

    test('shows the computed armor class', () => {
        render(<CharacterPageStatsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);
        expect(screen.getByText('12')).toBeInTheDocument();
    });

    describe('temporary HP styling', () => {
        test('adds the yellow temp-hp class when temporary_health is positive', () => {
            const { container } = render(<CharacterPageStatsPanel characterPageLayoutLive={{ ...characterPageLayoutLive, temporary_health: 5 }} userId="owner-1" />);
            // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- verifying a conditional wrapper class, no accessible text/role carries this
            expect(container.querySelector('.CharacterPage-stats-temp-hp-yellow')).toBeInTheDocument();
        });

        test('omits it when temporary_health is 0', () => {
            const { container } = render(<CharacterPageStatsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);
            // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- verifying a conditional wrapper class, no accessible text/role carries this
            expect(container.querySelector('.CharacterPage-stats-temp-hp-yellow')).not.toBeInTheDocument();
        });
    });

    describe('write permissions', () => {
        test('inputs are disabled with no userId', () => {
            render(<CharacterPageStatsPanel characterPageLayoutLive={characterPageLayoutLive} userId={undefined} />);
            screen.getAllByRole('spinbutton').forEach(input => expect(input).toBeDisabled());
        });

        test('inputs are disabled for a userId that is neither the owner nor a co-writer', () => {
            render(<CharacterPageStatsPanel characterPageLayoutLive={characterPageLayoutLive} userId="stranger-1" />);
            screen.getAllByRole('spinbutton').forEach(input => expect(input).toBeDisabled());
        });

        test('inputs are enabled for the owner', () => {
            render(<CharacterPageStatsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);
            screen.getAllByRole('spinbutton').forEach(input => expect(input).toBeEnabled());
        });

        test('inputs are enabled for a co-writer even if not the owner', () => {
            render(<CharacterPageStatsPanel characterPageLayoutLive={{ ...characterPageLayoutLive, canWrite: ['co-writer-1'] }} userId="co-writer-1" />);
            screen.getAllByRole('spinbutton').forEach(input => expect(input).toBeEnabled());
        });
    });

    describe('editing a stat', () => {
        test('typing updates the field immediately, before the write fires', () => {
            render(<CharacterPageStatsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);
            fireEvent.change(screen.getByDisplayValue('20'), { target: { name: 'current_health', value: '15' } });
            expect(screen.getByDisplayValue('15')).toBeInTheDocument();
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        test('writes the new value to Firestore after the debounce delay', () => {
            jest.useFakeTimers();
            render(<CharacterPageStatsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);

            fireEvent.change(screen.getByDisplayValue('20'), { target: { name: 'current_health', value: '15' } });
            jest.advanceTimersByTime(500);

            expect(mockDoc).toHaveBeenCalledWith({}, 'characters', 'char-1');
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { current_health: 15 });
        });

        test('rapid edits within the debounce window collapse into a single write of the final value', () => {
            jest.useFakeTimers();
            render(<CharacterPageStatsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);
            const hpInput = screen.getByDisplayValue('20');

            fireEvent.change(hpInput, { target: { name: 'current_health', value: '18' } });
            jest.advanceTimersByTime(300);
            fireEvent.change(hpInput, { target: { name: 'current_health', value: '17' } });
            jest.advanceTimersByTime(300);
            fireEvent.change(hpInput, { target: { name: 'current_health', value: '16' } });
            jest.advanceTimersByTime(500);

            expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { current_health: 16 });
        });

        test('clearing a field to blank does not write', () => {
            jest.useFakeTimers();
            render(<CharacterPageStatsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);

            fireEvent.change(screen.getByDisplayValue('20'), { target: { name: 'current_health', value: '' } });
            jest.advanceTimersByTime(500);

            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        test('editing hardness writes to its own field, independent of health', () => {
            jest.useFakeTimers();
            render(<CharacterPageStatsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);

            fireEvent.change(screen.getByDisplayValue('5'), { target: { name: 'hardness', value: '8' } });
            jest.advanceTimersByTime(500);

            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { hardness: 8 });
        });

        test('a failed write is alerted', () => {
            jest.useFakeTimers();
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            render(<CharacterPageStatsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);

            fireEvent.change(screen.getByDisplayValue('20'), { target: { name: 'current_health', value: '15' } });
            jest.advanceTimersByTime(500);

            return Promise.resolve().then(() => expect(window.alert).toHaveBeenCalled());
        });
    });

    test('when the live doc changes externally, local scores reset to the new values', () => {
        const { rerender } = render(<CharacterPageStatsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);
        rerender(<CharacterPageStatsPanel characterPageLayoutLive={{ ...characterPageLayoutLive, current_health: 1 }} userId="owner-1" />);
        expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    });

    describe('tooltips', () => {
        test('renders without the optional tooltips flag', () => {
            expect(() => render(<CharacterPageStatsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />)).not.toThrow();
        });

        test('renders without crashing when characterPageLayoutLive.tooltips is true', () => {
            expect(() => render(<CharacterPageStatsPanel characterPageLayoutLive={{ ...characterPageLayoutLive, tooltips: true }} userId="owner-1" />)).not.toThrow();
        });
    });
});
