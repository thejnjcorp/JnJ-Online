const mockUpdate = jest.fn();
const mockReset = jest.fn();
let mockContext;
jest.mock('../../src/utils/AccessibilityContext', () => ({
    useAccessibility: () => mockContext,
}));

// eslint-disable-next-line import/first
import { render, screen, fireEvent, within } from '@testing-library/react';
// eslint-disable-next-line import/first
import { AccessibilitySettings } from '../../src/components/AccessibilitySettings';
// eslint-disable-next-line import/first
import { DEFAULT_SETTINGS } from '../../src/utils/accessibility';

beforeEach(() => {
    mockContext = { settings: { ...DEFAULT_SETTINGS }, saveState: 'idle', update: mockUpdate, reset: mockReset };
    document.head.querySelectorAll('link[data-a11y-font]').forEach(link => link.remove());
});

describe('AccessibilitySettings', () => {
    test('shows the section with its four groups of options', () => {
        render(<AccessibilitySettings/>);

        expect(screen.getByRole('heading', { name: 'Reading & vision' })).toBeInTheDocument();
        expect(screen.getByRole('radiogroup', { name: 'Text size' })).toBeInTheDocument();
        expect(screen.getByRole('radiogroup', { name: 'Font' })).toBeInTheDocument();
        ['Roomier spacing', 'Plain text', 'High contrast', 'Reduce motion'].forEach(name => {
            expect(screen.getByRole('checkbox', { name: new RegExp(name) })).toBeInTheDocument();
        });
    });

    test('marks the current text size and font as selected', () => {
        mockContext.settings = { ...DEFAULT_SETTINGS, textScale: 1.5, font: 'lexend' };
        render(<AccessibilitySettings/>);

        expect(screen.getByRole('radio', { name: '150%' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('radio', { name: '100%' })).toHaveAttribute('aria-checked', 'false');
        expect(screen.getByRole('radio', { name: 'Lexend' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('radio', { name: 'Default' })).toHaveAttribute('aria-checked', 'false');
    });

    test('picking a text size or font updates just that setting', () => {
        render(<AccessibilitySettings/>);

        fireEvent.click(screen.getByRole('radio', { name: '200%' }));
        expect(mockUpdate).toHaveBeenLastCalledWith({ textScale: 2 });

        fireEvent.click(screen.getByRole('radio', { name: 'OpenDyslexic' }));
        expect(mockUpdate).toHaveBeenLastCalledWith({ font: 'opendyslexic' });
    });

    test('each font is previewed in its own typeface, the default one is left alone', () => {
        render(<AccessibilitySettings/>);
        expect(screen.getByRole('radio', { name: 'Atkinson Hyperlegible' }).style.fontFamily).toContain('Atkinson Hyperlegible');
        expect(screen.getByRole('radio', { name: 'Default' }).style.fontFamily).toBe('');
    });

    test('opening the section loads the fonts so they can be previewed (and nothing else does)', () => {
        render(<AccessibilitySettings/>);
        expect(Array.from(document.head.querySelectorAll('link[data-a11y-font]')).map(link => link.getAttribute('data-a11y-font')).sort())
            .toEqual(['atkinson', 'lexend', 'opendyslexic']);
    });

    test('toggles reflect their state and flip it when clicked', () => {
        mockContext.settings = { ...DEFAULT_SETTINGS, contrast: true };
        render(<AccessibilitySettings/>);

        expect(screen.getByRole('checkbox', { name: /High contrast/ })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: /Plain text/ })).not.toBeChecked();

        fireEvent.click(screen.getByRole('checkbox', { name: /Plain text/ }));
        expect(mockUpdate).toHaveBeenLastCalledWith({ plainText: true });
        fireEvent.click(screen.getByRole('checkbox', { name: /High contrast/ }));
        expect(mockUpdate).toHaveBeenLastCalledWith({ contrast: false });
    });

    test('every toggle explains itself', () => {
        render(<AccessibilitySettings/>);
        expect(screen.getByText('More space between lines, letters and words.')).toBeInTheDocument();
        expect(screen.getByText('No ALL-CAPS labels and no italics.')).toBeInTheDocument();
    });

    test('Reset is disabled while everything is at the default, and works once something has changed', () => {
        const { rerender } = render(<AccessibilitySettings/>);
        expect(screen.getByRole('button', { name: 'Reset to defaults' })).toBeDisabled();

        mockContext = { ...mockContext, settings: { ...DEFAULT_SETTINGS, spacing: true } };
        rerender(<AccessibilitySettings/>);
        fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));

        expect(mockReset).toHaveBeenCalled();
    });

    test('shows a sample paragraph so the change can be judged in place', () => {
        render(<AccessibilitySettings/>);
        const preview = screen.getByText('Preview').parentElement;
        expect(within(preview).getByText(/Make a Strength Save/)).toBeInTheDocument();
    });

    test.each([
        ['idle', ''],
        ['saving', 'Saving…'],
        ['saved', /Saved to your account/],
        ['error', /Couldn't save to your account/],
    ])('the %s save state is announced politely', (saveState, expected) => {
        mockContext.saveState = saveState;
        render(<AccessibilitySettings/>);
        const status = screen.getByRole('status');
        expect(status).toHaveAttribute('aria-live', 'polite');
        if (expected === '') expect(status).toBeEmptyDOMElement();
        else expect(status).toHaveTextContent(expected);
    });
});
