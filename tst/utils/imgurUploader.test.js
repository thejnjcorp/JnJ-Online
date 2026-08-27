import { uploadImageToImgur } from '../../src/utils/imgurUploader';

function jsonResponse(body) {
    return { json: () => Promise.resolve(body) };
}

describe('uploadImageToImgur', () => {
    const originalClientId = process.env.REACT_APP_IMGUR_CLIENT_ID;

    beforeEach(() => {
        process.env.REACT_APP_IMGUR_CLIENT_ID = 'test-client-id';
        global.fetch = jest.fn();
        window.alert = jest.fn();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        process.env.REACT_APP_IMGUR_CLIENT_ID = originalClientId;
        delete global.fetch;
        delete window.alert;
        jest.restoreAllMocks();
    });

    test('a successful upload on the first try returns the link, alerts success, and calls fetch exactly once', async () => {
        global.fetch.mockResolvedValue(jsonResponse({ success: true, data: { link: 'https://i.imgur.com/abc.png' } }));

        const result = await uploadImageToImgur(new Blob());

        expect(result).toBe('https://i.imgur.com/abc.png');
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(window.alert).toHaveBeenCalledWith('Image uploaded successfully: https://i.imgur.com/abc.png');
    });

    test('posts to the Imgur upload endpoint with a Client-ID auth header built from REACT_APP_IMGUR_CLIENT_ID', async () => {
        global.fetch.mockResolvedValue(jsonResponse({ success: true, data: { link: 'x' } }));

        await uploadImageToImgur(new Blob());

        expect(global.fetch).toHaveBeenCalledWith(
            'https://api.imgur.com/3/image/',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    Authorization: 'Client-ID test-client-id',
                    Accept: 'application/json',
                }),
            })
        );
    });

    test('sends the file as a "image" field in the request body FormData', async () => {
        global.fetch.mockResolvedValue(jsonResponse({ success: true, data: { link: 'x' } }));
        // A real File (as a file-picker/drag-drop input would provide), not a
        // bare Blob: FormData.append() only preserves the exact reference for
        // an already-named File - a nameless Blob gets spec-wrapped into a
        // new File on append, so `.get()` would return a different object.
        const file = new File(['content'], 'test.png');

        await uploadImageToImgur(file);

        const body = global.fetch.mock.calls[0][1].body;
        // Asserted as booleans rather than `expect(body).toBeInstanceOf(...)`/
        // `.toBe(file)` directly: on failure, Jest's pretty-printer tries to
        // deep-clone the FormData/Blob for the diff, which crashes the whole
        // worker (a native V8 assertion failure) in this jsdom/Node
        // combination - a test-environment bug, not something under test.
        expect(body instanceof FormData).toBe(true);
        expect(body.get('image') === file).toBe(true);
    });

    test('retries after a failed attempt and succeeds on the second try', async () => {
        global.fetch
            .mockResolvedValueOnce(jsonResponse({ success: false, data: { error: 'rate limited' } }))
            .mockResolvedValueOnce(jsonResponse({ success: true, data: { link: 'https://i.imgur.com/retry.png' } }));

        const result = await uploadImageToImgur(new Blob());

        expect(result).toBe('https://i.imgur.com/retry.png');
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test('gives up and returns null after exactly 3 failed attempts, alerting failure', async () => {
        global.fetch.mockResolvedValue(jsonResponse({ success: false, data: { error: 'server error' } }));

        const result = await uploadImageToImgur(new Blob());

        expect(result).toBeNull();
        expect(global.fetch).toHaveBeenCalledTimes(3);
        expect(window.alert).toHaveBeenCalledWith('Image upload failed after 3 attempts. Please try again later.');
    });

    test('does not alert the failure message after a successful retry (only the success alert fires)', async () => {
        global.fetch
            .mockResolvedValueOnce(jsonResponse({ success: false, data: { error: 'rate limited' } }))
            .mockResolvedValueOnce(jsonResponse({ success: true, data: { link: 'x' } }));

        await uploadImageToImgur(new Blob());

        expect(window.alert).toHaveBeenCalledTimes(1);
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('successfully'));
    });
});
