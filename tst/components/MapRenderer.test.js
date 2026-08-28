jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockDoc = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
}));

// eslint-disable-next-line import/first
import { render, screen, fireEvent, act } from '@testing-library/react';
// eslint-disable-next-line import/first
import { MapRenderer } from '../../src/components/MapRenderer';

const baseMap = { map_id: 'map-1', link: 'map.png', canWrite: ['owner-1'], zones: [] };

function edit(map = baseMap, userId = 'owner-1') {
    render(<MapRenderer map={map} userId={userId} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
}

beforeEach(() => {
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockUpdateDoc.mockResolvedValue(undefined);
    window.alert = jest.fn();
    window.confirm = jest.fn(() => true);
});

afterEach(() => {
    delete window.alert;
    delete window.confirm;
});

describe('MapRenderer', () => {
    test('shows the map image', () => {
        render(<MapRenderer map={baseMap} userId="owner-1" />);
        expect(screen.getByAltText('map')).toHaveAttribute('src', 'map.png');
    });

    test('no Edit button (or any editing UI) without write access', () => {
        render(<MapRenderer map={baseMap} userId="stranger-1" />);
        expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    });

    test('Edit toggles into and out of editing mode', () => {
        render(<MapRenderer map={baseMap} userId="owner-1" />);
        fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
        expect(screen.getByRole('button', { name: 'Stop Editing' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add Zone' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Stop Editing' }));
        expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Add Zone' })).not.toBeInTheDocument();
    });

    describe('zones', () => {
        test('Add Zone creates zones named sequentially', () => {
            edit();
            fireEvent.click(screen.getByRole('button', { name: 'Add Zone' }));
            expect(screen.getByDisplayValue('Zone 1')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Add Zone' }));
            expect(screen.getByDisplayValue('Zone 2')).toBeInTheDocument();
        });

        test('the zone counter continues from the highest existing "Zone N" name, not the current count', () => {
            const map = { ...baseMap, zones: [{ id: 'z1', name: 'Zone 3', x: 0, y: 0, width: 50, height: 50 }] };
            edit(map);
            fireEvent.click(screen.getByRole('button', { name: 'Add Zone' }));
            expect(screen.getByDisplayValue('Zone 4')).toBeInTheDocument();
        });

        test('Clear Zones is hidden when there are no zones', () => {
            edit();
            expect(screen.queryByRole('button', { name: 'Clear Zones' })).not.toBeInTheDocument();
        });

        test('Remove Zone does nothing when no zone is selected', () => {
            const map = { ...baseMap, zones: [{ id: 'z1', name: 'Zone 1', x: 0, y: 0, width: 50, height: 50 }] };
            edit(map);
            fireEvent.click(screen.getByRole('button', { name: 'Remove Zone' }));
            expect(screen.getByDisplayValue('Zone 1')).toBeInTheDocument();
        });

        test('selecting a zone (via mousedown on its name field) then Remove Zone removes just that zone', () => {
            const map = { ...baseMap, zones: [
                { id: 'z1', name: 'Zone 1', x: 0, y: 0, width: 50, height: 50 },
                { id: 'z2', name: 'Zone 2', x: 0, y: 0, width: 50, height: 50 },
            ] };
            edit(map);
            fireEvent.mouseDown(screen.getByDisplayValue('Zone 1'));

            fireEvent.click(screen.getByRole('button', { name: 'Remove Zone' }));

            expect(screen.queryByDisplayValue('Zone 1')).not.toBeInTheDocument();
            expect(screen.getByDisplayValue('Zone 2')).toBeInTheDocument();
        });

        test('Clear Zones, confirmed, removes every zone', () => {
            const map = { ...baseMap, zones: [{ id: 'z1', name: 'Zone 1', x: 0, y: 0, width: 50, height: 50 }] };
            edit(map);
            fireEvent.click(screen.getByRole('button', { name: 'Clear Zones' }));
            expect(screen.queryByDisplayValue('Zone 1')).not.toBeInTheDocument();
        });

        test('Clear Zones, declined, leaves the zones untouched', () => {
            window.confirm = jest.fn(() => false);
            const map = { ...baseMap, zones: [{ id: 'z1', name: 'Zone 1', x: 0, y: 0, width: 50, height: 50 }] };
            edit(map);
            fireEvent.click(screen.getByRole('button', { name: 'Clear Zones' }));
            expect(screen.getByDisplayValue('Zone 1')).toBeInTheDocument();
        });

        test('renaming a zone updates its displayed name', () => {
            const map = { ...baseMap, zones: [{ id: 'z1', name: 'Zone 1', x: 0, y: 0, width: 50, height: 50 }] };
            edit(map);
            fireEvent.change(screen.getByDisplayValue('Zone 1'), { target: { value: 'Ambush Point' } });
            expect(screen.getByDisplayValue('Ambush Point')).toBeInTheDocument();
        });

        test('the zone name field is disabled outside editing mode', () => {
            const map = { ...baseMap, zones: [{ id: 'z1', name: 'Zone 1', x: 0, y: 0, width: 50, height: 50 }] };
            render(<MapRenderer map={map} userId="owner-1" />);
            expect(screen.getByDisplayValue('Zone 1')).toBeDisabled();
        });

        test('resize handles only appear while editing', () => {
            const map = { ...baseMap, zones: [{ id: 'z1', name: 'Zone 1', x: 0, y: 0, width: 50, height: 50 }] };
            render(<MapRenderer map={map} userId="owner-1" />);
            expect(screen.queryByRole('button', { name: /Resize zone/ })).not.toBeInTheDocument();
        });

        test('a resize handle grows the zone via the keyboard, in the direction it represents', () => {
            const map = { ...baseMap, zones: [{ id: 'z1', name: 'Zone 1', x: 0, y: 0, width: 50, height: 50 }] };
            edit(map);
            const nameInput = screen.getByDisplayValue('Zone 1');
            expect(nameInput).toHaveStyle({ width: '40px' }); // zone.width(50) - 10

            fireEvent.keyDown(screen.getByRole('button', { name: 'Resize zone from right' }), { key: 'ArrowRight' });

            expect(nameInput).toHaveStyle({ width: '45px' }); // 50 + RESIZE_STEP(5) - 10
        });

        test('an unrecognized key on a resize handle does nothing', () => {
            const map = { ...baseMap, zones: [{ id: 'z1', name: 'Zone 1', x: 0, y: 0, width: 50, height: 50 }] };
            edit(map);
            const nameInput = screen.getByDisplayValue('Zone 1');

            fireEvent.keyDown(screen.getByRole('button', { name: 'Resize zone from right' }), { key: 'Enter' });

            expect(nameInput).toHaveStyle({ width: '40px' });
        });
    });

    describe('border color picker', () => {
        test('opens and closes via the color-picker toggle button', () => {
            edit();
            expect(screen.queryByRole('button', { name: 'set color' })).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'colorpicker.svg' }));
            expect(screen.getByRole('button', { name: 'set color' })).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'colorpicker.svg' }));
            expect(screen.queryByRole('button', { name: 'set color' })).not.toBeInTheDocument();
        });

        test('opening it closes the text-color picker, and vice versa', () => {
            edit();
            fireEvent.click(screen.getByRole('button', { name: 'Text Color' }));
            expect(screen.getAllByRole('button', { name: 'set color' })).toHaveLength(1);

            fireEvent.click(screen.getByRole('button', { name: 'colorpicker.svg' }));

            expect(screen.getAllByRole('button', { name: 'set color' })).toHaveLength(1);
        });

        test('the quick-select swatch plus "set color" applies the map\'s existing border color to the zones, and closes the panel', () => {
            const map = { ...baseMap, borderColor: 'blue', zones: [{ id: 'z1', name: 'Zone 1', x: 0, y: 0, width: 50, height: 50 }] };
            const { container } = render(<MapRenderer map={map} userId="owner-1" />);
            fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
            fireEvent.click(screen.getByRole('button', { name: 'colorpicker.svg' }));

            // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- the swatch's own current color has no accessible text, only an inline background style
            fireEvent.click(container.querySelector('.MapRenderer-colorpicker-quick-select-button'));
            fireEvent.click(screen.getByRole('button', { name: 'set color' }));

            expect(screen.queryByRole('button', { name: 'set color' })).not.toBeInTheDocument();
            // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- the zone box's border color has no accessible text, only an inline style
            expect(container.querySelector('.MapRenderer-zone')).toHaveStyle({ borderColor: 'blue' });
        });
    });

    describe('text color picker', () => {
        test('opens and closes via the Text Color button', () => {
            edit();
            fireEvent.click(screen.getByRole('button', { name: 'Text Color' }));
            expect(screen.getByRole('button', { name: 'set color' })).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Text Color' }));
            expect(screen.queryByRole('button', { name: 'set color' })).not.toBeInTheDocument();
        });

        test('the quick-select swatch plus "set color" applies the map\'s existing zone text color', () => {
            const map = { ...baseMap, zoneTextColor: 'black', zones: [{ id: 'z1', name: 'Zone 1', x: 0, y: 0, width: 50, height: 50 }] };
            const { container } = render(<MapRenderer map={map} userId="owner-1" />);
            fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
            fireEvent.click(screen.getByRole('button', { name: 'Text Color' }));

            // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- the swatch's own current color has no accessible text, only an inline background style
            fireEvent.click(container.querySelector('.MapRenderer-colorpicker-quick-select-button'));
            fireEvent.click(screen.getByRole('button', { name: 'set color' }));

            expect(screen.getByDisplayValue('Zone 1')).toHaveStyle({ color: 'rgb(0, 0, 0)' });
        });
    });

    describe('Save Map', () => {
        test('writes the map document with border color, text color, and zones', async () => {
            const map = { ...baseMap, zones: [{ id: 'z1', name: 'Zone 1', x: 0, y: 0, width: 50, height: 50 }] };
            edit(map);

            fireEvent.click(screen.getByRole('button', { name: 'Save Map' }));

            expect(mockDoc).toHaveBeenCalledWith({}, 'maps', 'map-1');
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['maps', 'map-1'] }, {
                borderColor: 'red', zoneTextColor: 'white', zones: [{ id: 'z1', name: 'Zone 1', x: 0, y: 0, width: 50, height: 50 }],
            });
            await screen.findByRole('button', { name: 'Edit' }); // isEditing(false) on success
            expect(window.alert).toHaveBeenCalledWith('Map saved successfully!');
        });

        test('a failed save is alerted and editing mode stays open', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            edit();

            fireEvent.click(screen.getByRole('button', { name: 'Save Map' }));

            await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
            expect(window.alert).toHaveBeenCalledWith('Failed to save map: offline');
            expect(screen.getByRole('button', { name: 'Stop Editing' })).toBeInTheDocument();
            consoleSpy.mockRestore();
        });
    });
});
