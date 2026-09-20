jest.mock('../../src/utils/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), updateDoc: jest.fn(), serverTimestamp: jest.fn(), deleteField: jest.fn(), Timestamp: {} }));

const mockArchive = jest.fn();
const mockUnarchive = jest.fn();
const mockSchedule = jest.fn();
const mockCancel = jest.fn();
jest.mock('../../src/utils/characterArchive', () => ({
    ...jest.requireActual('../../src/utils/characterArchive'),
    archiveCharacter: (...args) => mockArchive(...args),
    unarchiveCharacter: (...args) => mockUnarchive(...args),
    scheduleCharacterDeletion: (...args) => mockSchedule(...args),
    cancelCharacterDeletion: (...args) => mockCancel(...args),
}));

// eslint-disable-next-line import/first
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
// eslint-disable-next-line import/first
import { ArchivedCharacterBanner, CharacterDangerZone } from '../../src/components/CharacterDangerZone';

const character = (extra = {}) => ({ character_id: 'char-1', character_name: 'Aria', playerId: 'alice', admins: ['alice'], canWrite: ['alice', 'bob'], ...extra });
const scheduledFor = new Date(2026, 9, 21);

beforeEach(() => {
    [mockArchive, mockUnarchive, mockSchedule, mockCancel].forEach(mock => mock.mockResolvedValue(undefined));
    window.alert = jest.fn();
});

afterEach(() => {
    delete window.alert;
});

describe('CharacterDangerZone', () => {
    describe('who sees it', () => {
        test('the character\'s player', () => {
            render(<CharacterDangerZone character={character()} userId="alice"/>);
            expect(screen.getByRole('heading', { name: 'Danger Zone' })).toBeInTheDocument();
        });

        test('a doc admin who is not the player', () => {
            render(<CharacterDangerZone character={character({ admins: ['alice', 'carol'] })} userId="carol"/>);
            expect(screen.getByRole('heading', { name: 'Danger Zone' })).toBeInTheDocument();
        });

        test('nobody else: not a director who can write the sheet, not a stranger, not a signed-out visitor', () => {
            const { container, rerender } = render(<CharacterDangerZone character={character()} userId="bob"/>);
            expect(container).toBeEmptyDOMElement();
            rerender(<CharacterDangerZone character={character()} userId="mallory"/>);
            expect(container).toBeEmptyDOMElement();
            rerender(<CharacterDangerZone character={character()} userId={undefined}/>);
            expect(container).toBeEmptyDOMElement();
        });
    });

    describe('an active character', () => {
        test('can be archived, and nothing else is offered', async () => {
            render(<CharacterDangerZone character={character()} userId="alice"/>);
            expect(screen.queryByRole('button', { name: 'Unarchive' })).not.toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Schedule Deletion' })).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
            await waitFor(() => expect(mockArchive).toHaveBeenCalledWith('char-1'));
        });
    });

    describe('an archived character', () => {
        test('can be unarchived, or have its deletion scheduled - but not archived again', async () => {
            render(<CharacterDangerZone character={character({ archived: true })} userId="alice"/>);
            expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Unarchive' }));
            await waitFor(() => expect(mockUnarchive).toHaveBeenCalledWith('char-1'));
        });

        test('scheduling deletion asks first, naming the character and the time it has', () => {
            render(<CharacterDangerZone character={character({ archived: true })} userId="alice"/>);
            fireEvent.click(screen.getByRole('button', { name: 'Schedule Deletion' }));

            const dialog = screen.getByRole('dialog', { name: 'Schedule deletion' });
            expect(within(dialog).getByText(/"Aria" will be permanently deleted in 30 days/)).toBeInTheDocument();
            expect(mockSchedule).not.toHaveBeenCalled();
        });

        test('confirming schedules it and closes the dialog', async () => {
            render(<CharacterDangerZone character={character({ archived: true })} userId="alice"/>);
            fireEvent.click(screen.getByRole('button', { name: 'Schedule Deletion' }));
            fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Schedule Deletion' }));

            await waitFor(() => expect(mockSchedule).toHaveBeenCalledWith('char-1'));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        test('cancelling the dialog, its scrim or Escape schedules nothing', () => {
            render(<CharacterDangerZone character={character({ archived: true })} userId="alice"/>);
            fireEvent.click(screen.getByRole('button', { name: 'Schedule Deletion' }));
            fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Schedule Deletion' }));
            fireEvent.click(screen.getByRole('button', { name: 'Close' }));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Schedule Deletion' }));
            fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(mockSchedule).not.toHaveBeenCalled();
        });

        test('one with a deletion scheduled can have it cancelled, and is not offered scheduling again', async () => {
            render(<CharacterDangerZone character={character({ archived: true, scheduledDeletionAt: { toDate: () => scheduledFor } })} userId="alice"/>);
            expect(screen.queryByRole('button', { name: 'Schedule Deletion' })).not.toBeInTheDocument();
            expect(screen.getByText(/cancels the scheduled deletion/)).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Cancel Deletion' }));
            await waitFor(() => expect(mockCancel).toHaveBeenCalledWith('char-1'));
        });
    });

    test('says so when a change cannot be saved', async () => {
        mockArchive.mockRejectedValue(new Error('permission-denied'));
        render(<CharacterDangerZone character={character()} userId="alice"/>);
        fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
        await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.any(Error)));
    });
});

describe('ArchivedCharacterBanner', () => {
    test('says an archived character is archived, and when it is to be deleted', () => {
        const { rerender } = render(<ArchivedCharacterBanner character={character({ archived: true })}/>);
        expect(screen.getByRole('status')).toHaveTextContent('This character is archived');
        expect(screen.getByRole('status')).not.toHaveTextContent('deletion');

        rerender(<ArchivedCharacterBanner character={character({ archived: true, scheduledDeletionAt: { toDate: () => scheduledFor } })}/>);
        expect(screen.getByRole('status')).toHaveTextContent('permanent deletion on October 21, 2026');
    });

    test('is not there for a character that is not archived', () => {
        const { container } = render(<ArchivedCharacterBanner character={character()}/>);
        expect(container).toBeEmptyDOMElement();
    });
});
