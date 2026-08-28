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

/* eslint-disable testing-library/no-container, testing-library/no-node-access --
   a few tests below check inline style / presence-absence on plain,
   non-interactive layout divs (.CharacterPage-masthead background,
   .CharacterPage-masthead-subline) - no accessible role/text to query them
   by, so container access is the only way. */
// eslint-disable-next-line import/first
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { CharacterPageNavigation } from '../../src/components/CharacterPageNavigation';

const characterPage = { character_id: 'char-1', userId: 'owner-1', character_name: 'Aria', navigation_color: '#ff0000' };

beforeEach(() => {
    mockDoc.mockImplementation((_db, ...path) => ({ __doc: path }));
    mockUpdateDoc.mockResolvedValue(undefined);
    window.alert = jest.fn();
});

afterEach(() => {
    delete window.alert;
});

describe('CharacterPageNavigation', () => {
    describe('name and subline', () => {
        test('shows the character name, or "Unnamed Character" if blank', () => {
            render(<CharacterPageNavigation characterPage={characterPage} userId="owner-1" />);
            expect(screen.getByText('Aria')).toBeInTheDocument();

            render(<CharacterPageNavigation characterPage={{ ...characterPage, character_name: '' }} userId="owner-1" />);
            expect(screen.getByText('Unnamed Character')).toBeInTheDocument();
        });

        test('prefers class_name over class when both are set', () => {
            render(<CharacterPageNavigation characterPage={{ ...characterPage, class_name: 'Crusader Tank v3', class: 'Fighter' }} userId="owner-1" />);
            expect(screen.getByText('Crusader Tank v3')).toBeInTheDocument();
            expect(screen.queryByText('Fighter')).not.toBeInTheDocument();
        });

        test('falls back to class when class_name is absent', () => {
            render(<CharacterPageNavigation characterPage={{ ...characterPage, class: 'Fighter' }} userId="owner-1" />);
            expect(screen.getByText('Fighter')).toBeInTheDocument();
        });

        test('the literal placeholder value "class" is treated as no class at all', () => {
            const { container } = render(<CharacterPageNavigation characterPage={{ ...characterPage, class: 'class' }} userId="owner-1" />);
            expect(container.querySelector('.CharacterPage-masthead-subline')).not.toBeInTheDocument();
        });

        test('joins class and player name with a middot separator when both are present', () => {
            render(<CharacterPageNavigation characterPage={{ ...characterPage, class: 'Fighter', player_name: 'Sam' }} userId="owner-1" />);
            // RTL's default text matcher normalizes whitespace (including the
            // \xa0 the component actually renders) down to single spaces.
            expect(screen.getByText('Fighter · Player: Sam')).toBeInTheDocument();
        });

        test('shows just the player name when there is no class', () => {
            render(<CharacterPageNavigation characterPage={{ ...characterPage, player_name: 'Sam' }} userId="owner-1" />);
            expect(screen.getByText('Player: Sam')).toBeInTheDocument();
        });

        test('renders no subline at all when neither class nor player name is present', () => {
            const { container } = render(<CharacterPageNavigation characterPage={characterPage} userId="owner-1" />);
            expect(container.querySelector('.CharacterPage-masthead-subline')).not.toBeInTheDocument();
        });
    });

    describe('avatar', () => {
        test('shows the portrait image when portrait_url is set', () => {
            render(<CharacterPageNavigation characterPage={{ ...characterPage, portrait_url: 'https://example.com/p.png' }} userId="owner-1" />);
            expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/p.png');
        });

        test('shows a placeholder icon when there is no portrait', () => {
            render(<CharacterPageNavigation characterPage={characterPage} userId="owner-1" />);
            expect(screen.queryByRole('img')).not.toBeInTheDocument();
        });
    });

    describe('masthead background', () => {
        test('the gradient uses the character\'s navigation_color', () => {
            const { container } = render(<CharacterPageNavigation characterPage={characterPage} userId="owner-1" />);
            expect(container.querySelector('.CharacterPage-masthead')).toHaveStyle({
                background: 'linear-gradient(135deg, #ff0000 0%, #1a1622 72%)',
            });
        });
    });

    describe('write permissions', () => {
        test('the owner sees the avatar edit badge', () => {
            render(<CharacterPageNavigation characterPage={characterPage} userId="owner-1" />);
            expect(screen.getByRole('button', { name: 'Change portrait' })).toBeInTheDocument();
        });

        test('an unrelated signed-in user does not see the edit badge', () => {
            render(<CharacterPageNavigation characterPage={characterPage} userId="stranger-1" />);
            expect(screen.queryByRole('button', { name: 'Change portrait' })).not.toBeInTheDocument();
        });
    });

    describe('uploading a new portrait thumbnail', () => {
        test('selecting a file uploads it and saves the link as portrait_url, same field CharacterPortrait.js writes to', async () => {
            mockUploadImageToImgur.mockResolvedValue('https://i.imgur.com/new.png');
            render(<CharacterPageNavigation characterPage={characterPage} userId="owner-1" />);
            const file = new File(['content'], 'portrait.png', { type: 'image/png' });

            fireEvent.change(screen.getByLabelText('Portrait image file'), { target: { files: [file] } });

            await waitFor(() => expect(mockUpdateDoc).toHaveBeenCalled());
            expect(mockUpdateDoc).toHaveBeenCalledWith({ __doc: ['characters', 'char-1'] }, { portrait_url: 'https://i.imgur.com/new.png' });
        });
    });

    test('renders the navigation color picker button', () => {
        render(<CharacterPageNavigation characterPage={characterPage} userId="owner-1" />);
        expect(screen.getByRole('button', { name: 'palette.svg' })).toBeInTheDocument();
    });
});
