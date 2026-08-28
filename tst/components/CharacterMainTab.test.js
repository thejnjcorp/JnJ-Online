jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockDoc = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
}));

const mockUseIsMobile = jest.fn();
jest.mock('../../src/utils/useIsMobile', () => ({ useIsMobile: () => mockUseIsMobile() }));

const mockUseCampaignMaps = jest.fn();
const mockUseCombatEntities = jest.fn();
jest.mock('../../src/utils/useCampaignCombat', () => ({
    useCampaignMaps: (...args) => mockUseCampaignMaps(...args),
    useCombatEntities: (...args) => mockUseCombatEntities(...args),
}));

jest.mock('../../src/utils/DraggableElements/PostListInventory.tsx', () => ({
    PostListContentInventory: ({ characterId, campaignCharacterList }) => <div>Inventory-stub:{characterId}:{campaignCharacterList.length}</div>,
}));
jest.mock('../../src/utils/DraggableElements/PostListInventoryPocket.tsx', () => ({
    PostListContentInventoryPocket: ({ characterId }) => <div>Pocket-stub:{characterId}</div>,
}));
jest.mock('../../src/utils/DraggableElements/PostListCombat.tsx', () => ({
    PostListContentCombat: ({ campaignId }) => <div>Combat-stub:{campaignId}</div>,
}));
jest.mock('../../src/utils/DraggableElements/PostListCombatMap.tsx', () => ({
    PostListContentCombatMap: ({ campaignId, activeMap, entities }) => <div>CombatMap-stub:{campaignId}:{activeMap?.map_id}:{entities.length}</div>,
}));

// eslint-disable-next-line import/first
import { screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/first
import { CharacterMainTab } from '../../src/components/CharacterMainTab';
// eslint-disable-next-line import/first
import { renderWithRouter as render } from '../testUtils/renderWithRouter';

const characterPage = {
    character_id: 'char-1', userId: 'owner-1', campaign: 'camp-1',
    actions: [
        { actionName: 'Stab', actionCost: 1, category: 'action', toHitBool: true, toHit: 2 },
        { actionName: 'Big Slam', actionCost: 3, category: 'action', toHitBool: true, toHit: 2 },
        { actionName: 'Tough Skin', actionCost: 0, category: 'passive', toHitBool: false, difficultyClass: 'Dex,0' },
    ],
    action_points: 2,
    experience_points: 0,
    base_armor_class: 12, base_hit_modifier: 2, base_damage_modifier: 0,
    base_damage_dice: 1, base_damage_dice_type: 6, base_healing_dice_type: 4,
    description: '', class_description: 'A frontline tank.', notes: '',
};

function goToTab(name) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(name + '$') }));
}

function circleButtons() {
    return screen.getAllByRole('button', { name: /^circle/ });
}

beforeEach(() => {
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockUpdateDoc.mockResolvedValue(undefined);
    mockUseIsMobile.mockReturnValue(false);
    mockUseCampaignMaps.mockReturnValue({ activeMap: null });
    mockUseCombatEntities.mockReturnValue([]);
    window.alert = jest.fn();
});

afterEach(() => {
    delete window.alert;
    jest.useRealTimers();
});

describe('CharacterMainTab', () => {
    describe('Roleplay tab (default)', () => {
        test('shows the background description, falling back to the class description when unset', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            expect(screen.getByDisplayValue('A frontline tank.')).toBeInTheDocument();
        });

        test('prefers the character\'s own description once set', () => {
            render(<CharacterMainTab characterPage={{ ...characterPage, description: 'My own story.' }} userId="owner-1" />);
            expect(screen.getByDisplayValue('My own story.')).toBeInTheDocument();
            expect(screen.queryByDisplayValue('A frontline tank.')).not.toBeInTheDocument();
        });

        test('the textareas are disabled without write permissions', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="stranger-1" />);
            screen.getAllByRole('textbox').forEach(box => expect(box).toBeDisabled());
        });

        test('typing updates immediately, then writes to Firestore after the debounce delay', () => {
            jest.useFakeTimers();
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            const notesBox = screen.getByDisplayValue(''); // notes starts blank

            fireEvent.change(notesBox, { target: { name: 'notes', value: 'Loves cats.' } });
            expect(screen.getByDisplayValue('Loves cats.')).toBeInTheDocument();
            expect(mockUpdateDoc).not.toHaveBeenCalled();

            jest.advanceTimersByTime(1000);
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { notes: 'Loves cats.' });
        });

        test('a failed write is alerted', () => {
            jest.useFakeTimers();
            mockUpdateDoc.mockRejectedValue(new Error('offline'));
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);

            fireEvent.change(screen.getByDisplayValue(''), { target: { name: 'notes', value: 'Loves cats.' } });
            jest.advanceTimersByTime(1000);

            return Promise.resolve().then(() => expect(window.alert).toHaveBeenCalled());
        });
    });

    describe('Combat tab', () => {
        test('shows a filled circle per spent action point, out of 4', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Combat');
            // Scoped to the action-point pips specifically - CombatActionList
            // renders its own "circle" alt-text icons for cost pips, which
            // would otherwise also match these queries.
            expect(screen.getAllByAltText('circleFilled').filter(img => img.className.includes('CharacterMainTab-circle'))).toHaveLength(2);
            expect(screen.getAllByAltText('circle').filter(img => img.className.includes('CharacterMainTab-circle'))).toHaveLength(2);
            expect(screen.getByText(/2 \/ 4 available/)).toBeInTheDocument();
        });

        test('the hint to click a circle only appears with write permissions', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Combat');
            expect(screen.getByText(/click a circle to spend/)).toBeInTheDocument();
        });

        test('no hint, and disabled circle buttons, without write permissions', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="stranger-1" />);
            goToTab('Combat');
            expect(screen.queryByText(/click a circle to spend/)).not.toBeInTheDocument();
            circleButtons().forEach(b => expect(b).toBeDisabled());
        });

        test('clicking a circle sets action_points to that circle\'s number', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Combat');

            fireEvent.click(circleButtons()[2]); // the 3rd circle

            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { action_points: 3 });
        });

        test('partitions actions into Passives, Available, and Unavailable by cost and category', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Combat');
            expect(screen.getByText('Passives')).toBeInTheDocument();
            expect(screen.getByText('Available Actions')).toBeInTheDocument();
            expect(screen.getByText(/Unavailable/)).toBeInTheDocument();
            expect(screen.getByText('Tough Skin')).toBeInTheDocument();
            expect(screen.getByText('Stab')).toBeInTheDocument(); // costs 1, <= 2 available points
            expect(screen.getByText('Big Slam')).toBeInTheDocument(); // costs 3, > 2 available points
        });
    });

    describe('Inventory tab', () => {
        test('desktop shows one inventory column plus a pocket', () => {
            mockUseIsMobile.mockReturnValue(false);
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" characterList={[{ character_id: 'char-2' }]} />);
            goToTab('Inventory');
            expect(screen.getByText('Inventory-stub:char-1:1')).toBeInTheDocument();
            expect(screen.getByText('Pocket-stub:char-1')).toBeInTheDocument();
            expect(screen.queryByText('Relics')).not.toBeInTheDocument();
        });

        test('mobile shows separate Relics, Backpack, and Pocket sections', () => {
            mockUseIsMobile.mockReturnValue(true);
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Inventory');
            expect(screen.getByText('Relics')).toBeInTheDocument();
            expect(screen.getByText('Backpack')).toBeInTheDocument();
            expect(screen.getByText('Pocket')).toBeInTheDocument();
            expect(screen.getAllByText(/Inventory-stub:char-1/)).toHaveLength(2); // relics + backpack
        });
    });

    describe('Combat Map tab', () => {
        test('a character with no campaign shows a join/create prompt instead of the map', () => {
            render(<CharacterMainTab characterPage={{ ...characterPage, campaign: null }} userId="owner-1" />);
            goToTab('Combat Map');
            expect(screen.getByText("This character isn't part of a campaign yet.")).toBeInTheDocument();
            expect(screen.getByRole('link', { name: /Join or create a campaign/ })).toHaveAttribute('href', '/campaigns');
        });

        test('a character with a campaign shows the inline combat list, scoped to that campaign', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Combat Map');
            expect(screen.getByText('Combat-stub:camp-1')).toBeInTheDocument();
        });

        test('Open Combat Map opens a full-screen overlay with the active map and combat entities', () => {
            mockUseCampaignMaps.mockReturnValue({ activeMap: { map_id: 'map-1' } });
            mockUseCombatEntities.mockReturnValue([{ id: 'character:char-1', title: 'Aria' }]);
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Combat Map');

            fireEvent.click(screen.getByRole('button', { name: /Open Combat Map/ }));

            expect(screen.getByText('CombatMap-stub:camp-1:map-1:1')).toBeInTheDocument();
        });

        test('the overlay closes via its own close button', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Combat Map');
            fireEvent.click(screen.getByRole('button', { name: /Open Combat Map/ }));
            expect(screen.getByText(/CombatMap-stub/)).toBeInTheDocument();

            // Both the scrim and the floating × button share the accessible
            // name "Close" (aria-label overrides the × glyph's own text) -
            // the floating one is the second in DOM order.
            fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[1]);

            expect(screen.queryByText(/CombatMap-stub/)).not.toBeInTheDocument();
        });

        test('the overlay also closes via clicking the scrim', () => {
            render(<CharacterMainTab characterPage={characterPage} userId="owner-1" />);
            goToTab('Combat Map');
            fireEvent.click(screen.getByRole('button', { name: /Open Combat Map/ }));

            fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);

            expect(screen.queryByText(/CombatMap-stub/)).not.toBeInTheDocument();
        });
    });
});
