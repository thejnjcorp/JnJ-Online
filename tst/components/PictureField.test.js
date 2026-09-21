const mockUpload = jest.fn();
jest.mock('../../src/utils/imgurUploader', () => ({ uploadImageToImgur: (...args) => mockUpload(...args) }));

// eslint-disable-next-line import/first
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/first
import { PictureField } from '../../src/components/PictureField';

const draw = (props = {}) => {
    const onChange = jest.fn();
    const view = render(<PictureField name="Rust Bandit" value="" onChange={onChange} {...props}/>);
    return { ...view, onChange };
};
const preview = () => document.querySelector('.EnemyPage-picture-token');

describe('PictureField', () => {
    test('with no picture the preview shows the initials of the name', () => {
        draw();
        expect(preview()).toHaveTextContent('RB');
        expect(preview().querySelector('img')).toBeNull();
    });

    test('shows a picture from a link as it is, and an Imgur hash from Imgur', () => {
        const { rerender } = draw({ value: 'https://example.com/a.png' });
        expect(preview().querySelector('img')).toHaveAttribute('src', 'https://example.com/a.png');
        rerender(<PictureField name="x" value="AbC1d2E.png" onChange={jest.fn()}/>);
        expect(preview().querySelector('img')).toHaveAttribute('src', 'https://i.imgur.com/AbC1d2E.png');
        expect(screen.getByLabelText('Picture link')).toHaveValue('https://i.imgur.com/AbC1d2E.png');
    });

    test('typing a link reports it', () => {
        const { onChange } = draw();
        fireEvent.change(screen.getByLabelText('Picture link'), { target: { value: 'https://example.com/a.png' } });
        expect(onChange).toHaveBeenCalledWith('https://example.com/a.png');
    });

    test('is round like a token by default, and square for something that is not one', () => {
        const { rerender } = draw();
        expect(preview()).not.toHaveClass('EnemyPage-picture-token-square');
        rerender(<PictureField name="x" value="" onChange={jest.fn()} square/>);
        expect(preview()).toHaveClass('EnemyPage-picture-token-square');
    });

    test('marks the link as invalid, under the id the page\'s problem list jumps to, when there is an error', () => {
        draw({ error: 'Use a web link.' });
        expect(screen.getByLabelText('Picture link')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('Picture link')).toHaveAttribute('data-problem', 'field-portrait_url');
        expect(screen.getByText('Use a web link.')).toBeInTheDocument();
    });

    test('a page can name the field for its own problem list', () => {
        draw({ error: 'Nope.', fieldId: 'field-item_image' });
        expect(screen.getByLabelText('Picture link')).toHaveAttribute('data-problem', 'field-item_image');
    });

    test('uploads a file and reports the link it was put at', async () => {
        mockUpload.mockResolvedValue('https://i.imgur.com/UpLoad1.jpg');
        const { onChange } = draw();
        fireEvent.change(screen.getByLabelText('Or upload one'), { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } });
        await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://i.imgur.com/UpLoad1.jpg'));
    });

    test('says it is uploading, and cannot take another meanwhile', async () => {
        let finish;
        mockUpload.mockReturnValue(new Promise(resolve => { finish = resolve; }));
        draw();
        fireEvent.change(screen.getByLabelText('Or upload one'), { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } });
        expect(await screen.findByRole('status')).toHaveTextContent('Uploading');
        expect(screen.getByLabelText('Or upload one')).toBeDisabled();
        finish(null);
        await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    });

    test('an upload that fails is alerted, and reports nothing', async () => {
        window.alert = jest.fn();
        mockUpload.mockRejectedValue(new Error('network down'));
        const { onChange } = draw();
        fireEvent.change(screen.getByLabelText('Or upload one'), { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } });
        await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Couldn't upload the picture: network down"));
        expect(onChange).not.toHaveBeenCalled();
        delete window.alert;
    });

    test('a picture that will not load says so, goes back to initials, and is tried again with a new link', () => {
        const { rerender } = draw({ value: 'https://example.com/gone.png' });
        fireEvent.error(preview().querySelector('img'));
        expect(screen.getByRole('alert')).toHaveTextContent("didn't load");
        expect(preview()).toHaveTextContent('RB');
        fireEvent.change(screen.getByLabelText('Picture link'), { target: { value: 'https://example.com/other.png' } });
        rerender(<PictureField name="Rust Bandit" value="https://example.com/other.png" onChange={jest.fn()}/>);
        expect(preview().querySelector('img')).not.toBeNull();
    });

    test('it can be taken off', () => {
        const { onChange } = draw({ value: 'https://example.com/a.png' });
        fireEvent.click(screen.getByRole('button', { name: 'Remove picture' }));
        expect(onChange).toHaveBeenCalledWith('');
    });

    test('read-only shows the picture but offers no way to change it', () => {
        draw({ value: 'https://example.com/a.png', readOnly: true });
        expect(screen.getByLabelText('Picture link')).toBeDisabled();
        expect(screen.queryByLabelText('Or upload one')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Remove picture' })).not.toBeInTheDocument();
    });
});
