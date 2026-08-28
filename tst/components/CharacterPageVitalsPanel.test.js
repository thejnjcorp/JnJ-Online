jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockDoc = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
}));

jest.mock('../../src/components/CharacterPortrait', () => ({
    CharacterPortrait: ({ characterPage, userId }) => <div>Portrait-stub:{characterPage.character_id}:{userId}</div>,
}));
jest.mock('../../src/components/Statuses', () => ({
    Statuses: ({ characterPage, userId }) => <div>Statuses-stub:{characterPage.character_id}:{userId}</div>,
}));

// eslint-disable-next-line import/first
import { render, screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/first
import { CharacterPageVitalsPanel } from '../../src/components/CharacterPageVitalsPanel';

// experience_points=0 -> level 1, where ArmorClass passes through the base
// stat unmodified (see CharacterStatCalculator's level-1 case).
const characterPageLayoutLive = {
    character_id: 'char-1', userId: 'owner-1',
    experience_points: 0, base_armor_class: 12, base_hit_modifier: 2, base_damage_modifier: 0,
    base_damage_dice: 1, base_damage_dice_type: 1, base_healing_dice_type: 1,
    current_health: 20, maximum_health: 25, temporary_health: 0, hardness: 5,
    strength_stat: 10, dexterity_stat: 11, intelligence_stat: 12, charisma_stat: 13,
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

describe('CharacterPageVitalsPanel', () => {
    test('shows the initial health, AC, XP, hardness, and ability scores', () => {
        render(<CharacterPageVitalsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);
        const [currentHp, maxHp, tempHp, xp, hardness, str, dex, int, cha] = screen.getAllByRole('spinbutton');
        expect(currentHp).toHaveValue(20);
        expect(maxHp).toHaveValue(25);
        expect(tempHp).toHaveValue(0);
        expect(xp).toHaveValue(0);
        expect(hardness).toHaveValue(5);
        expect(str).toHaveValue(10);
        expect(dex).toHaveValue(11);
        expect(int).toHaveValue(12);
        expect(cha).toHaveValue(13);
        expect(screen.getByText('12')).toBeInTheDocument(); // AC
    });

    test('renders the Statuses and CharacterPortrait children with the character and user', () => {
        render(<CharacterPageVitalsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);
        expect(screen.getByText('Statuses-stub:char-1:owner-1')).toBeInTheDocument();
        expect(screen.getByText('Portrait-stub:char-1:owner-1')).toBeInTheDocument();
    });

    describe('health bar fill', () => {
        function fillWidth(container) {
            // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- the fill bar's width is a purely visual inline style with no accessible text/role
            return container.querySelector('.CharacterPage-vitals-health-bar-fill').style.width;
        }

        test('is proportional to current/max health', () => {
            const { container } = render(<CharacterPageVitalsPanel characterPageLayoutLive={{ ...characterPageLayoutLive, current_health: 10, maximum_health: 20 }} userId="owner-1" />);
            expect(fillWidth(container)).toBe('50%');
        });

        test('clamps to 100% when current exceeds max', () => {
            const { container } = render(<CharacterPageVitalsPanel characterPageLayoutLive={{ ...characterPageLayoutLive, current_health: 999, maximum_health: 20 }} userId="owner-1" />);
            expect(fillWidth(container)).toBe('100%');
        });

        test('is 0% when maximum health is 0', () => {
            const { container } = render(<CharacterPageVitalsPanel characterPageLayoutLive={{ ...characterPageLayoutLive, current_health: 5, maximum_health: 0 }} userId="owner-1" />);
            expect(fillWidth(container)).toBe('0%');
        });
    });

    describe('temp HP styling', () => {
        test('adds the temp-hp class when temporary_health is positive', () => {
            const { container } = render(<CharacterPageVitalsPanel characterPageLayoutLive={{ ...characterPageLayoutLive, temporary_health: 5 }} userId="owner-1" />);
            // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- verifying a conditional wrapper class, no accessible text/role carries this
            expect(container.querySelector('.CharacterPage-vitals-temp-hp')).toBeInTheDocument();
        });

        test('omits it when temporary_health is 0', () => {
            const { container } = render(<CharacterPageVitalsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);
            // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- verifying a conditional wrapper class, no accessible text/role carries this
            expect(container.querySelector('.CharacterPage-vitals-temp-hp')).not.toBeInTheDocument();
        });
    });

    describe('write permissions', () => {
        test('inputs are disabled with no userId', () => {
            render(<CharacterPageVitalsPanel characterPageLayoutLive={characterPageLayoutLive} userId={undefined} />);
            screen.getAllByRole('spinbutton').forEach(input => expect(input).toBeDisabled());
        });

        test('inputs are enabled for the owner', () => {
            render(<CharacterPageVitalsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);
            screen.getAllByRole('spinbutton').forEach(input => expect(input).toBeEnabled());
        });

        test('inputs are enabled for a co-writer even if not the owner', () => {
            render(<CharacterPageVitalsPanel characterPageLayoutLive={{ ...characterPageLayoutLive, canWrite: ['co-writer-1'] }} userId="co-writer-1" />);
            screen.getAllByRole('spinbutton').forEach(input => expect(input).toBeEnabled());
        });
    });

    describe('editing a stat', () => {
        test('typing updates the field immediately, before the write fires', () => {
            render(<CharacterPageVitalsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);
            fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { name: 'current_health', value: '15' } });
            expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(15);
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        test('writes the new value to Firestore after the debounce delay', () => {
            jest.useFakeTimers();
            render(<CharacterPageVitalsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);

            fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { name: 'current_health', value: '15' } });
            jest.advanceTimersByTime(500);

            expect(mockDoc).toHaveBeenCalledWith({}, 'characters', 'char-1');
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { current_health: 15 });
        });

        test('editing an ability score writes to its own field', () => {
            jest.useFakeTimers();
            render(<CharacterPageVitalsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);
            const strengthInput = screen.getAllByRole('spinbutton')[5];

            fireEvent.change(strengthInput, { target: { name: 'strength_stat', value: '16' } });
            jest.advanceTimersByTime(500);

            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { strength_stat: 16 });
        });

        test('clearing a field to blank does not write', () => {
            jest.useFakeTimers();
            render(<CharacterPageVitalsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);

            fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { name: 'current_health', value: '' } });
            jest.advanceTimersByTime(500);

            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        test('a failed write is alerted', () => {
            jest.useFakeTimers();
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            render(<CharacterPageVitalsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);

            fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { name: 'current_health', value: '15' } });
            jest.advanceTimersByTime(500);

            return Promise.resolve().then(() => expect(window.alert).toHaveBeenCalled());
        });
    });

    describe('status delta badges', () => {
        test('no badge when no passive status effect applies to a stat', () => {
            render(<CharacterPageVitalsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);
            expect(screen.queryByText('+2')).not.toBeInTheDocument();
        });

        test('shows a signed badge for hardness and the affected ability score when a passive status is active', () => {
            const withStatus = {
                ...characterPageLayoutLive,
                statuses: [{ effects: [{ stat: 'hardness', delta: 2, trigger: 'passive' }, { stat: 'strength_stat', delta: -3, trigger: 'passive' }], stacks: 1 }],
            };
            render(<CharacterPageVitalsPanel characterPageLayoutLive={withStatus} userId="owner-1" />);
            expect(screen.getByText('+2')).toBeInTheDocument();
            expect(screen.getByText('-3')).toBeInTheDocument();
        });

        test('a passive effect on AC feeds into the displayed (adjusted) armor class', () => {
            const withStatus = { ...characterPageLayoutLive, statuses: [{ effects: [{ stat: 'base_armor_class', delta: 3, trigger: 'passive' }], stacks: 1 }] };
            render(<CharacterPageVitalsPanel characterPageLayoutLive={withStatus} userId="owner-1" />);
            expect(screen.getByText('15')).toBeInTheDocument();
        });
    });

    test('when the live doc changes externally, local scores reset to the new values', () => {
        const { rerender } = render(<CharacterPageVitalsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);
        rerender(<CharacterPageVitalsPanel characterPageLayoutLive={{ ...characterPageLayoutLive, current_health: 1 }} userId="owner-1" />);
        expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(1);
    });

    describe('tooltips', () => {
        test('renders without the optional tooltips flag', () => {
            expect(() => render(<CharacterPageVitalsPanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />)).not.toThrow();
        });

        test('renders without crashing when characterPageLayoutLive.tooltips is true', () => {
            expect(() => render(<CharacterPageVitalsPanel characterPageLayoutLive={{ ...characterPageLayoutLive, tooltips: true }} userId="owner-1" />)).not.toThrow();
        });
    });
});
