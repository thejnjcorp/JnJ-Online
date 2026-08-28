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
import { CharacterPageAbilityScorePanel } from '../../src/components/CharacterPageAbilityScorePanel';

const characterPageLayoutLive = {
    character_id: 'char-1', userId: 'owner-1',
    strength_stat: 10, dexterity_stat: 12, intelligence_stat: 8, charisma_stat: 14,
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

describe('CharacterPageAbilityScorePanel', () => {
    test('shows the initial ability scores', () => {
        render(<CharacterPageAbilityScorePanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);
        expect(screen.getByDisplayValue('10')).toBeInTheDocument();
        expect(screen.getByDisplayValue('12')).toBeInTheDocument();
        expect(screen.getByDisplayValue('8')).toBeInTheDocument();
        expect(screen.getByDisplayValue('14')).toBeInTheDocument();
    });

    describe('write permissions', () => {
        test('inputs are disabled with no userId', () => {
            render(<CharacterPageAbilityScorePanel characterPageLayoutLive={characterPageLayoutLive} userId={undefined} />);
            screen.getAllByRole('spinbutton').forEach(input => expect(input).toBeDisabled());
        });

        test('inputs are disabled for a userId that is neither the owner nor a co-writer', () => {
            render(<CharacterPageAbilityScorePanel characterPageLayoutLive={characterPageLayoutLive} userId="stranger-1" />);
            screen.getAllByRole('spinbutton').forEach(input => expect(input).toBeDisabled());
        });

        test('inputs are enabled for the owner', () => {
            render(<CharacterPageAbilityScorePanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);
            screen.getAllByRole('spinbutton').forEach(input => expect(input).toBeEnabled());
        });

        test('inputs are enabled for a co-writer even if not the owner', () => {
            render(<CharacterPageAbilityScorePanel characterPageLayoutLive={{ ...characterPageLayoutLive, canWrite: ['co-writer-1'] }} userId="co-writer-1" />);
            screen.getAllByRole('spinbutton').forEach(input => expect(input).toBeEnabled());
        });
    });

    describe('editing a score', () => {
        test('typing updates the field immediately, before the write fires', () => {
            render(<CharacterPageAbilityScorePanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);
            fireEvent.change(screen.getByDisplayValue('10'), { target: { name: 'strength_stat', value: '15' } });
            expect(screen.getByDisplayValue('15')).toBeInTheDocument();
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        test('writes the new value to Firestore after the debounce delay', () => {
            jest.useFakeTimers();
            render(<CharacterPageAbilityScorePanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);

            fireEvent.change(screen.getByDisplayValue('10'), { target: { name: 'strength_stat', value: '15' } });
            jest.advanceTimersByTime(500);

            expect(mockDoc).toHaveBeenCalledWith({}, 'characters', 'char-1');
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { strength_stat: 15 });
        });

        test('rapid edits within the debounce window collapse into a single write of the final value', () => {
            jest.useFakeTimers();
            render(<CharacterPageAbilityScorePanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);

            const strengthInput = screen.getAllByRole('spinbutton')[0];
            fireEvent.change(strengthInput, { target: { name: 'strength_stat', value: '11' } });
            jest.advanceTimersByTime(300);
            fireEvent.change(strengthInput, { target: { name: 'strength_stat', value: '12' } });
            jest.advanceTimersByTime(300);
            fireEvent.change(strengthInput, { target: { name: 'strength_stat', value: '13' } });
            jest.advanceTimersByTime(500);

            expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { strength_stat: 13 });
        });

        test('clearing a field to blank does not write', () => {
            jest.useFakeTimers();
            render(<CharacterPageAbilityScorePanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);

            fireEvent.change(screen.getByDisplayValue('10'), { target: { name: 'strength_stat', value: '' } });
            jest.advanceTimersByTime(500);

            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        test('editing one score does not affect the others', () => {
            jest.useFakeTimers();
            render(<CharacterPageAbilityScorePanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);

            fireEvent.change(screen.getByDisplayValue('10'), { target: { name: 'strength_stat', value: '20' } });
            jest.advanceTimersByTime(500);

            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { strength_stat: 20 });
            expect(mockUpdateDoc).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ dexterity_stat: expect.anything() }));
        });

        test('a failed write is alerted', () => {
            jest.useFakeTimers();
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            render(<CharacterPageAbilityScorePanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);

            fireEvent.change(screen.getByDisplayValue('10'), { target: { name: 'strength_stat', value: '15' } });
            jest.advanceTimersByTime(500);

            return Promise.resolve().then(() => expect(window.alert).toHaveBeenCalled());
        });
    });

    test('when the live doc changes externally, local scores reset to the new values', () => {
        const { rerender } = render(<CharacterPageAbilityScorePanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />);
        rerender(<CharacterPageAbilityScorePanel characterPageLayoutLive={{ ...characterPageLayoutLive, strength_stat: 99 }} userId="owner-1" />);
        expect(screen.getByDisplayValue('99')).toBeInTheDocument();
    });

    describe('tooltips', () => {
        test('renders without the optional tooltips flag', () => {
            expect(() => render(<CharacterPageAbilityScorePanel characterPageLayoutLive={characterPageLayoutLive} userId="owner-1" />)).not.toThrow();
        });

        test('renders without crashing when characterPageLayoutLive.tooltips is true', () => {
            expect(() => render(<CharacterPageAbilityScorePanel characterPageLayoutLive={{ ...characterPageLayoutLive, tooltips: true }} userId="owner-1" />)).not.toThrow();
        });
    });
});
