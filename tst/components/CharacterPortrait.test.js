jest.mock('../../src/utils/firebase', () => ({ db: {} }));

const mockDoc = jest.fn();
const mockUpdateDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
    doc: (...args) => mockDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
}));

const mockUploadImageToImgur = jest.fn();
jest.mock('../../src/utils/imgurUploader', () => ({
    uploadImageToImgur: (...args) => mockUploadImageToImgur(...args),
}));

// eslint-disable-next-line import/first
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { CharacterPortrait } from '../../src/components/CharacterPortrait';

const characterPage = { character_id: 'char-1', userId: 'owner-1' };

beforeEach(() => {
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockUpdateDoc.mockResolvedValue(undefined);
    window.alert = jest.fn();
});

afterEach(() => {
    delete window.alert;
});

describe('CharacterPortrait', () => {
    test('shows a placeholder when there is no portrait yet', () => {
        render(<CharacterPortrait characterPage={characterPage} userId="owner-1" />);
        expect(screen.getByText('No portrait yet')).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    test('shows the portrait image when portrait_url is set', () => {
        render(<CharacterPortrait characterPage={{ ...characterPage, portrait_url: 'https://example.com/p.png' }} userId="owner-1" />);
        expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/p.png');
        expect(screen.queryByText('No portrait yet')).not.toBeInTheDocument();
    });

    describe('write permissions', () => {
        test('the owner sees the edit button', () => {
            render(<CharacterPortrait characterPage={characterPage} userId="owner-1" />);
            expect(screen.getByRole('button', { name: 'Change portrait' })).toBeInTheDocument();
        });

        test('a user listed in canWrite also sees the edit button', () => {
            render(<CharacterPortrait characterPage={{ ...characterPage, canWrite: ['friend-1'] }} userId="friend-1" />);
            expect(screen.getByRole('button', { name: 'Change portrait' })).toBeInTheDocument();
        });

        test('an unrelated signed-in user does not see the edit button', () => {
            render(<CharacterPortrait characterPage={characterPage} userId="stranger-1" />);
            expect(screen.queryByRole('button', { name: 'Change portrait' })).not.toBeInTheDocument();
        });

        test('no userId (signed out) does not see the edit button', () => {
            render(<CharacterPortrait characterPage={characterPage} userId="" />);
            expect(screen.queryByRole('button', { name: 'Change portrait' })).not.toBeInTheDocument();
        });
    });

    describe('uploading a new portrait', () => {
        test('selecting a file uploads it to Imgur and saves the returned link as portrait_url', async () => {
            mockUploadImageToImgur.mockResolvedValue('https://i.imgur.com/new.png');
            render(<CharacterPortrait characterPage={characterPage} userId="owner-1" />);
            const file = new File(['content'], 'portrait.png', { type: 'image/png' });

            fireEvent.change(screen.getByLabelText('Portrait image file'), { target: { files: [file] } });

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
            expect(mockUploadImageToImgur).toHaveBeenCalledWith(file);
            expect(mockDoc).toHaveBeenCalledWith({}, 'characters', 'char-1');
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { portrait_url: 'https://i.imgur.com/new.png' });
        });

        test('disables the edit button while the upload is in progress', async () => {
            let resolveUpload;
            mockUploadImageToImgur.mockReturnValue(new Promise((resolve) => { resolveUpload = resolve; }));
            render(<CharacterPortrait characterPage={characterPage} userId="owner-1" />);
            const file = new File(['content'], 'portrait.png', { type: 'image/png' });

            fireEvent.change(screen.getByLabelText('Portrait image file'), { target: { files: [file] } });

            await waitFor(() => expect(screen.getByRole('button', { name: 'Change portrait' })).toBeDisabled());

            resolveUpload('https://i.imgur.com/new.png');
            await waitFor(() => expect(screen.getByRole('button', { name: 'Change portrait' })).not.toBeDisabled());
        });

        test('a failed Imgur upload (null link) does not touch Firestore', async () => {
            mockUploadImageToImgur.mockResolvedValue(null);
            render(<CharacterPortrait characterPage={characterPage} userId="owner-1" />);
            const file = new File(['content'], 'portrait.png', { type: 'image/png' });

            fireEvent.change(screen.getByLabelText('Portrait image file'), { target: { files: [file] } });

            await waitFor(() => expect(screen.getByRole('button', { name: 'Change portrait' })).not.toBeDisabled());
            expect(mockUpdateDoc).not.toHaveBeenCalled();
        });

        test('an error during upload/save is alerted and does not leave the button stuck disabled', async () => {
            mockUploadImageToImgur.mockRejectedValue(new Error('network down'));
            render(<CharacterPortrait characterPage={characterPage} userId="owner-1" />);
            const file = new File(['content'], 'portrait.png', { type: 'image/png' });

            fireEvent.change(screen.getByLabelText('Portrait image file'), { target: { files: [file] } });

            await waitFor(() => expect(window.alert).toHaveBeenCalled());
            expect(screen.getByRole('button', { name: 'Change portrait' })).not.toBeDisabled();
        });

        test('selecting no file (dialog cancelled) does not attempt an upload', () => {
            render(<CharacterPortrait characterPage={characterPage} userId="owner-1" />);

            fireEvent.change(screen.getByLabelText('Portrait image file'), { target: { files: [] } });

            expect(mockUploadImageToImgur).not.toHaveBeenCalled();
        });
    });
});
