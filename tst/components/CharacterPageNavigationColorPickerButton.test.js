jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockDoc = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
}));

// react-colorful's real picker needs pointer-drag gestures on a gradient
// canvas to pick a color, which isn't practical to simulate in jsdom -
// stubbed as a plain text input so a new color can be set with fireEvent.change.
jest.mock('react-colorful', () => ({
    HexColorPicker: ({ color, onChange }) => (
        <input aria-label="hex color" value={color} onChange={(e) => onChange(e.target.value)} />
    ),
}));

jest.mock('react-tooltip', () => ({
    Tooltip: (props) => <div data-testid="tooltip" data-content={props.content} />,
}));

// eslint-disable-next-line import/first
import { render, screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/first
import { CharacterPageNavigationColorPickerButton } from '../../src/components/CharacterPageNavigationColorPickerButton';

const characterPageLayoutLive = { character_id: 'char-1', navigation_color: '#ff0000' };

beforeEach(() => {
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockUpdateDoc.mockResolvedValue(undefined);
    window.alert = jest.fn();
});

afterEach(() => {
    delete window.alert;
});

describe('CharacterPageNavigationColorPickerButton', () => {
    test('the color picker panel is closed by default', () => {
        render(<CharacterPageNavigationColorPickerButton characterPageLayoutLive={characterPageLayoutLive} />);
        expect(screen.queryByLabelText('hex color')).not.toBeInTheDocument();
    });

    test('clicking the palette button opens the picker panel, pre-seeded with the character\'s current navigation_color', () => {
        render(<CharacterPageNavigationColorPickerButton characterPageLayoutLive={characterPageLayoutLive} />);

        fireEvent.click(screen.getByRole('button', { name: 'palette.svg' })); // the mocked SVG icon's accessible name comes from CRA's test-transform stub, which renders the filename as its content

        expect(screen.getByLabelText('hex color')).toHaveValue('#ff0000');
    });

    test('clicking the scrim closes the panel without saving', () => {
        render(<CharacterPageNavigationColorPickerButton characterPageLayoutLive={characterPageLayoutLive} />);
        fireEvent.click(screen.getByRole('button', { name: 'palette.svg' }));

        fireEvent.click(screen.getByRole('button', { name: 'Close' }));

        expect(screen.queryByLabelText('hex color')).not.toBeInTheDocument();
        expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    test('clicking Cancel closes the panel without saving', () => {
        render(<CharacterPageNavigationColorPickerButton characterPageLayoutLive={characterPageLayoutLive} />);
        fireEvent.click(screen.getByRole('button', { name: 'palette.svg' }));

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByLabelText('hex color')).not.toBeInTheDocument();
        expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    test('picking a new color and clicking Set Color saves it to the character doc and closes the panel', () => {
        render(<CharacterPageNavigationColorPickerButton characterPageLayoutLive={characterPageLayoutLive} />);
        fireEvent.click(screen.getByRole('button', { name: 'palette.svg' }));

        fireEvent.change(screen.getByLabelText('hex color'), { target: { value: '#00ff00' } });
        fireEvent.click(screen.getByRole('button', { name: 'Set Color' }));

        expect(mockDoc).toHaveBeenCalledWith({}, 'characters', 'char-1');
        expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { navigation_color: '#00ff00' });
        expect(screen.queryByLabelText('hex color')).not.toBeInTheDocument();
    });

    test('a failed save is alerted', async () => {
        mockUpdateDoc.mockRejectedValue(new Error('offline'));
        render(<CharacterPageNavigationColorPickerButton characterPageLayoutLive={characterPageLayoutLive} />);
        fireEvent.click(screen.getByRole('button', { name: 'palette.svg' }));

        fireEvent.click(screen.getByRole('button', { name: 'Set Color' }));

        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(window.alert).toHaveBeenCalled();
    });

    test('renders no tooltip when the character has not opted into tooltips', () => {
        render(<CharacterPageNavigationColorPickerButton characterPageLayoutLive={characterPageLayoutLive} />);
        expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
    });

    test('renders the "Customize color" tooltip when the character has tooltips enabled', () => {
        render(<CharacterPageNavigationColorPickerButton characterPageLayoutLive={{ ...characterPageLayoutLive, tooltips: true }} />);
        expect(screen.getByTestId('tooltip')).toHaveAttribute('data-content', 'Customize color');
    });
});
