jest.mock('../../src/utils/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), doc: jest.fn(), addDoc: jest.fn(), deleteDoc: jest.fn(), onSnapshot: jest.fn(), serverTimestamp: jest.fn() }));

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MapImageTokenToolbar } from '../../src/components/MapImageTokenToolbar';
import { IMAGE_TOKEN_SIZES, MAX_IMAGE_TOKENS } from '../../src/utils/mapImageTokens';
import { DRAG_TYPE } from '../../src/utils/tokenLibrary';

const mockUpload = jest.fn();
jest.mock('../../src/utils/imgurUploader', () => ({ uploadImageToImgur: (...args) => mockUpload(...args) }));

const mockUseTokenLibrary = jest.fn();
jest.mock('../../src/utils/useTokenLibrary', () => ({ useTokenLibrary: (...args) => mockUseTokenLibrary(...args) }));

const token = (id, extra = {}) => ({ id, image: 'https://example.com/fire.png', label: 'Fire', x: 0.3, y: 0.2, size: 0.07, ...extra });
const size = key => IMAGE_TOKEN_SIZES.find(option => option.key === key).value;

const libraryToken = (id, extra = {}) => ({ id, image: 'AbC1d2E.png', label: 'Fire', size: 0.12, ...extra });
let library;

function setup(extra = {}, props = {}) {
    const imageTokens = { tokens: [], full: false, selected: null, add: jest.fn(), resize: jest.fn(), copy: jest.fn(), remove: jest.fn(), ...extra };
    render(<MapImageTokenToolbar imageTokens={imageTokens} userId="director-1" {...props} />);
    return imageTokens;
}
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Add image token' }));
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
    window.alert = jest.fn();
    library = { tokens: [], loaded: true, full: false, save: jest.fn(), remove: jest.fn() };
    mockUseTokenLibrary.mockImplementation(() => library);
});

afterEach(() => {
    delete window.alert;
});

describe('MapImageTokenToolbar', () => {
    describe('adding one', () => {
        test('the form is hidden until asked for, and the button says whether it is open', () => {
            setup();
            expect(screen.queryByLabelText('Picture link')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Add image token' })).toHaveAttribute('aria-pressed', 'false');
            open();
            expect(screen.getByLabelText('Picture link')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Add image token' })).toHaveAttribute('aria-pressed', 'true');
            open();
            expect(screen.queryByLabelText('Picture link')).not.toBeInTheDocument();
        });

        test('places the picture with its name and size, then closes and clears', () => {
            const imageTokens = setup();
            open();
            type('Picture link', 'https://example.com/tree.png');
            type('Name (optional)', 'Old oak');
            fireEvent.click(within(screen.getByRole('group', { name: 'Size' })).getByRole('button', { name: 'Large' }));
            fireEvent.click(screen.getByRole('button', { name: 'Place on map' }));

            expect(imageTokens.add).toHaveBeenCalledWith({ image: 'https://example.com/tree.png', label: 'Old oak', size: size('large') });
            expect(screen.queryByLabelText('Picture link')).not.toBeInTheDocument();
            open();
            expect(screen.getByLabelText('Picture link')).toHaveValue('');
            expect(screen.getByLabelText('Name (optional)')).toHaveValue('');
        });

        test('is medium unless another size is picked', () => {
            const imageTokens = setup();
            open();
            expect(within(screen.getByRole('group', { name: 'Size' })).getByRole('button', { name: 'Medium' })).toHaveAttribute('aria-pressed', 'true');
            type('Picture link', 'https://example.com/tree.png');
            fireEvent.click(screen.getByRole('button', { name: 'Place on map' }));
            expect(imageTokens.add).toHaveBeenCalledWith(expect.objectContaining({ size: size('medium') }));
        });

        test('cannot be placed without a link, or with something that is not a web link', () => {
            const imageTokens = setup();
            open();
            const place = screen.getByRole('button', { name: 'Place on map' });
            expect(place).toBeDisabled();
            type('Picture link', 'javascript:alert(1)');
            expect(place).toBeDisabled();
            expect(screen.getByText(/isn't a web link to a picture/)).toBeInTheDocument();
            expect(screen.queryByAltText('Preview')).not.toBeInTheDocument();
            fireEvent.click(place);
            expect(imageTokens.add).not.toHaveBeenCalled();
        });

        test('shows a preview of a link that will do', () => {
            setup();
            open();
            type('Picture link', 'https://example.com/tree.png');
            expect(screen.getByAltText('Preview')).toHaveAttribute('src', 'https://example.com/tree.png');
            expect(screen.queryByText(/isn't a web link/)).not.toBeInTheDocument();
        });

        test('the name is kept short', () => {
            setup();
            open();
            expect(screen.getByLabelText('Name (optional)')).toHaveAttribute('maxLength', '40');
        });

        test('cannot be placed when the map is full', () => {
            setup({ full: true });
            open();
            type('Picture link', 'https://example.com/tree.png');
            expect(screen.getByRole('button', { name: 'Place on map' })).toBeDisabled();
            expect(screen.getByRole('alert')).toHaveTextContent(`${MAX_IMAGE_TOKENS} image tokens`);
        });
    });

    describe('the token library', () => {
        test('listens to the director\'s library only while the panel is open', () => {
            setup();
            expect(mockUseTokenLibrary).toHaveBeenLastCalledWith('director-1', false);
            open();
            expect(mockUseTokenLibrary).toHaveBeenLastCalledWith('director-1', true);
        });

        test('says so when nothing is saved yet, and while it is still loading', () => {
            setup();
            open();
            expect(within(screen.getByRole('region', { name: 'Token library' })).getByText(/Nothing saved yet/)).toBeInTheDocument();
        });

        test('while loading it says that instead', () => {
            library.loaded = false;
            setup();
            open();
            expect(within(screen.getByRole('region', { name: 'Token library' })).getByText('Loading...')).toBeInTheDocument();
        });

        test('shows each saved token as a picture, named, loading an Imgur hash from Imgur', () => {
            library.tokens = [libraryToken('a'), libraryToken('b', { image: 'https://example.com/tree.png', label: '' })];
            setup();
            open();
            const fire = screen.getByRole('button', { name: 'Place Fire' });
            expect(within(fire).getByText('Fire')).toBeInTheDocument();
            expect(fire.querySelector('img')).toHaveAttribute('src', 'https://i.imgur.com/AbC1d2E.png');
            expect(screen.getByRole('button', { name: 'Place image token' }).querySelector('img')).toHaveAttribute('src', 'https://example.com/tree.png');
        });

        test('pressing one places it with its own name and size', () => {
            library.tokens = [libraryToken('a')];
            const imageTokens = setup();
            open();
            fireEvent.click(screen.getByRole('button', { name: 'Place Fire' }));
            expect(imageTokens.add).toHaveBeenCalledWith({ image: 'AbC1d2E.png', label: 'Fire', size: 0.12 });
        });

        test('cannot place one when the map is full', () => {
            library.tokens = [libraryToken('a')];
            const imageTokens = setup({ full: true });
            open();
            const button = screen.getByRole('button', { name: 'Place Fire' });
            expect(button).toHaveAttribute('aria-disabled', 'true');
            expect(button).toHaveAttribute('draggable', 'false');
            fireEvent.click(button);
            fireEvent.keyDown(button, { key: 'Enter' });
            expect(imageTokens.add).not.toHaveBeenCalled();
        });

        test('can be placed from the keyboard, with Enter or Space', () => {
            library.tokens = [libraryToken('a')];
            const imageTokens = setup();
            open();
            const button = screen.getByRole('button', { name: 'Place Fire' });
            fireEvent.keyDown(button, { key: 'Enter' });
            fireEvent.keyDown(button, { key: ' ' });
            fireEvent.keyDown(button, { key: 'a' });
            expect(imageTokens.add).toHaveBeenCalledTimes(2);
        });

        test('a token can be taken out of the library', () => {
            library.tokens = [libraryToken('a')];
            setup();
            open();
            fireEvent.click(screen.getByRole('button', { name: 'Remove Fire from library' }));
            expect(library.remove).toHaveBeenCalledWith('a');
        });

        test('dragging one carries its picture, name and size, and tells the map a drag has begun and ended', () => {
            library.tokens = [libraryToken('a')];
            const onDragging = jest.fn();
            setup({}, { onDragging });
            open();
            const button = screen.getByRole('button', { name: 'Place Fire' });
            expect(button).toHaveAttribute('draggable', 'true');
            const dataTransfer = { setData: jest.fn(), effectAllowed: '' };

            fireEvent.dragStart(button, { dataTransfer });
            expect(dataTransfer.setData).toHaveBeenCalledWith(DRAG_TYPE, JSON.stringify({ image: 'AbC1d2E.png', label: 'Fire', size: 0.12 }));
            expect(onDragging).toHaveBeenLastCalledWith(true);

            fireEvent.dragEnd(button);
            expect(onDragging).toHaveBeenLastCalledWith(false);
        });

        test('says when the library is full', () => {
            library.tokens = [libraryToken('a')];
            library.full = true;
            setup();
            open();
            expect(screen.getByRole('alert')).toHaveTextContent('100 tokens');
        });

        test('a token that is placed is saved to the library, by default, as its hash', () => {
            const imageTokens = setup();
            open();
            type('Picture link', 'https://i.imgur.com/AbC1d2E.gif');
            type('Name (optional)', 'Fire');
            fireEvent.click(screen.getByRole('button', { name: 'Place on map' }));
            expect(imageTokens.add).toHaveBeenCalledWith({ image: 'AbC1d2E.gif', label: 'Fire', size: size('medium') });
            expect(library.save).toHaveBeenCalledWith({ image: 'AbC1d2E.gif', label: 'Fire', size: size('medium') });
        });

        test('a link from anywhere else is saved as the link', () => {
            setup();
            open();
            type('Picture link', 'https://example.com/tree.png');
            fireEvent.click(screen.getByRole('button', { name: 'Place on map' }));
            expect(library.save).toHaveBeenCalledWith(expect.objectContaining({ image: 'https://example.com/tree.png' }));
        });

        test('unticking "Save to my library" places it without saving it', () => {
            const imageTokens = setup();
            open();
            fireEvent.click(screen.getByRole('checkbox', { name: 'Save to my library' }));
            type('Picture link', 'https://example.com/tree.png');
            fireEvent.click(screen.getByRole('button', { name: 'Place on map' }));
            expect(imageTokens.add).toHaveBeenCalled();
            expect(library.save).not.toHaveBeenCalled();
        });

        test('one already in the library is not saved a second time', () => {
            library.tokens = [libraryToken('a')];
            const imageTokens = setup();
            open();
            type('Picture link', 'https://i.imgur.com/AbC1d2E.png');
            fireEvent.click(screen.getByRole('button', { name: 'Place on map' }));
            expect(imageTokens.add).toHaveBeenCalled();
            expect(library.save).not.toHaveBeenCalled();
        });

        test('a full library is not saved to, but the token is still placed', () => {
            library.full = true;
            const imageTokens = setup();
            open();
            type('Picture link', 'https://example.com/tree.png');
            fireEvent.click(screen.getByRole('button', { name: 'Place on map' }));
            expect(imageTokens.add).toHaveBeenCalled();
            expect(library.save).not.toHaveBeenCalled();
        });

        test('the preview shows an Imgur link as the picture it points to', () => {
            setup();
            open();
            type('Picture link', 'https://i.imgur.com/AbC1d2E.png');
            expect(screen.getByAltText('Preview')).toHaveAttribute('src', 'https://i.imgur.com/AbC1d2E.png');
        });
    });

    describe('uploading a picture', () => {
        const file = new File(['x'], 'fire.png', { type: 'image/png' });
        const upload = () => fireEvent.change(screen.getByLabelText('Or upload one'), { target: { files: [file] } });

        test('fills in the link with where it was put', async () => {
            mockUpload.mockResolvedValue('https://i.imgur.com/fire.png');
            setup();
            open();
            upload();
            await waitFor(() => expect(screen.getByLabelText('Picture link')).toHaveValue('https://i.imgur.com/fire.png'));
            expect(mockUpload).toHaveBeenCalledWith(file);
            expect(screen.getByRole('button', { name: 'Place on map' })).toBeEnabled();
        });

        test('says it is uploading, and cannot be placed or uploaded to again meanwhile', async () => {
            let finish;
            mockUpload.mockReturnValue(new Promise(resolve => { finish = resolve; }));
            setup();
            open();
            type('Picture link', 'https://example.com/tree.png');
            upload();
            expect(await screen.findByRole('status')).toHaveTextContent('Uploading');
            expect(screen.getByRole('button', { name: 'Place on map' })).toBeDisabled();
            expect(screen.getByLabelText('Or upload one')).toBeDisabled();
            finish('https://i.imgur.com/fire.png');
            await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
        });

        test('leaves the link alone when the upload did not work', async () => {
            mockUpload.mockResolvedValue(null);
            setup();
            open();
            type('Picture link', 'https://example.com/tree.png');
            upload();
            await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
            expect(screen.getByLabelText('Picture link')).toHaveValue('https://example.com/tree.png');
        });

        test('says so when the upload throws', async () => {
            mockUpload.mockRejectedValue(new Error('network down'));
            setup();
            open();
            upload();
            await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Couldn't upload the image: network down"));
            expect(screen.getByLabelText('Or upload one')).toBeEnabled();
        });
    });

    describe('the selected token', () => {
        test('has nothing to change when none is selected', () => {
            setup({ tokens: [token('a')] });
            expect(screen.queryByRole('group', { name: 'Selected image token' })).not.toBeInTheDocument();
        });

        test('is named, with its size marked and the means to change it, copy it and remove it', () => {
            const imageTokens = setup({ tokens: [token('a'), token('b', { label: '' })], selected: 'a' });
            const group = screen.getByRole('group', { name: 'Selected image token' });
            expect(within(group).getByText('Fire')).toBeInTheDocument();
            expect(within(group).getByRole('button', { name: 'Medium' })).toHaveAttribute('aria-pressed', 'true');
            expect(within(group).getByRole('button', { name: 'Small' })).toHaveAttribute('aria-pressed', 'false');

            fireEvent.click(within(group).getByRole('button', { name: 'Huge' }));
            fireEvent.click(within(group).getByRole('button', { name: 'Copy' }));
            fireEvent.click(within(group).getByRole('button', { name: 'Remove' }));
            expect(imageTokens.resize).toHaveBeenCalledWith('a', size('huge'));
            expect(imageTokens.copy).toHaveBeenCalledWith('a');
            expect(imageTokens.remove).toHaveBeenCalledWith('a');
        });

        test('one with no name is called what it is', () => {
            setup({ tokens: [token('b', { label: '' })], selected: 'b' });
            expect(within(screen.getByRole('group', { name: 'Selected image token' })).getByText('Image token')).toBeInTheDocument();
        });

        test('cannot be copied when the map is full, but can still be removed', () => {
            setup({ tokens: [token('a')], selected: 'a', full: true });
            const group = screen.getByRole('group', { name: 'Selected image token' });
            expect(within(group).getByRole('button', { name: 'Copy' })).toBeDisabled();
            expect(within(group).getByRole('button', { name: 'Remove' })).toBeEnabled();
        });
    });
});
