import {
    createJSONFile,
    updateJSONFile,
    getJSONFile,
    listFiles,
    deleteJSONFile,
    watchFile,
} from '../../src/utils/googleDriveFunctions';

// This jsdom version's Blob/File implementation doesn't implement
// Blob#arrayBuffer(), unlike every real browser - polyfilled here so
// uploadFileToDrive's real upload step can actually run under test. This is
// a test-environment gap, not something to work around in the app itself.
// Deliberately NOT FileReader-based: FileReader's onload here fires on an
// unpredictable later macrotask, which made flushPromises() below flaky.
// The tests only care that *an* ArrayBuffer reaches the upload XHR, not its
// exact byte content, so a plain already-resolved Promise is both correct
// enough and, being a native microtask, reliably done by the time
// flushPromises()'s setTimeout(0) macrotask runs.
// (Runs at module-evaluation time, before any test executes, so import
// hoisting ahead of it doesn't matter - it's in place well before
// googleDriveFunctions.js's uploadFileToDrive ever actually calls it.)
if (typeof Blob.prototype.arrayBuffer !== 'function') {
    Blob.prototype.arrayBuffer = function () {
        return Promise.resolve(new ArrayBuffer(this.size || 0));
    };
}

const PARENT_FOLDER_ID = '1W7tEkctOTWMjjsq8Y5090fL7lkqaboJY';

// A controllable fake XMLHttpRequest - jsdom's real one would attempt an
// actual network request, which this test environment can't (and shouldn't)
// make. Each instance is recorded so a test can grab it and drive its
// onreadystatechange/onerror callbacks manually to simulate a response.
class FakeXHR {
    constructor() {
        this.readyState = 0;
        this.status = 0;
        this.statusText = '';
        this.requestHeaders = {};
        this._responseHeaders = {};
        FakeXHR.instances.push(this);
    }
    open(method, url) {
        this.method = method;
        this.url = url;
    }
    setRequestHeader(name, value) {
        this.requestHeaders[name] = value;
    }
    send(body) {
        this.body = body;
    }
    getResponseHeader(name) {
        return this._responseHeaders[name];
    }
    respond(status, { headers = {}, response } = {}) {
        this.status = status;
        this.readyState = FakeXHR.DONE;
        this._responseHeaders = headers;
        this.response = response;
        this.onreadystatechange?.();
    }
    triggerError(status = 0, statusText = '') {
        this.status = status;
        this.statusText = statusText;
        this.onerror?.call(this);
    }
}
FakeXHR.DONE = 4;
FakeXHR.instances = [];

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('googleDriveFunctions', () => {
    let originalXHR;

    beforeEach(() => {
        FakeXHR.instances = [];
        originalXHR = global.XMLHttpRequest;
        global.XMLHttpRequest = FakeXHR;
        window.gapi = {
            client: {
                drive: {
                    files: {
                        get: jest.fn(),
                        list: jest.fn(),
                        delete: jest.fn(),
                        watch: jest.fn(),
                    },
                },
            },
        };
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        global.XMLHttpRequest = originalXHR;
        delete window.gapi;
    });

    describe('getJSONFile', () => {
        test('requests the file with alt=media and returns the parsed result', async () => {
            window.gapi.client.drive.files.get.mockResolvedValue({ result: { name: 'data.json' } });

            const result = await getJSONFile('file-1');

            expect(window.gapi.client.drive.files.get).toHaveBeenCalledWith({ fileId: 'file-1', alt: 'media' });
            expect(result).toEqual({ name: 'data.json' });
        });
    });

    describe('listFiles', () => {
        test('queries for non-trashed files inside the app\'s parent folder', async () => {
            window.gapi.client.drive.files.list.mockResolvedValue({ result: { files: [{ id: 'f1' }] } });

            const result = await listFiles();

            expect(window.gapi.client.drive.files.list).toHaveBeenCalledWith({
                q: `'${PARENT_FOLDER_ID}' in parents and trashed = false`,
            });
            expect(result).toEqual([{ id: 'f1' }]);
        });
    });

    describe('deleteJSONFile', () => {
        test('deletes the file by id', async () => {
            window.gapi.client.drive.files.delete.mockResolvedValue({});
            await deleteJSONFile('file-1');
            expect(window.gapi.client.drive.files.delete).toHaveBeenCalledWith({ fileId: 'file-1' });
        });
    });

    describe('watchFile', () => {
        test('registers a web_hook channel pointed at the given character page URL and returns the raw response', async () => {
            const watchResponse = { result: { resourceId: 'r1' } };
            window.gapi.client.drive.files.watch.mockResolvedValue(watchResponse);

            const result = await watchFile('file-1', 'https://example.com/characters/abc');

            expect(window.gapi.client.drive.files.watch).toHaveBeenCalledWith({
                fileId: 'file-1',
                resource: expect.objectContaining({
                    type: 'web_hook',
                    address: 'https://example.com/characters/abc',
                    id: expect.any(String),
                }),
            });
            // watchFile returns the whole response, unlike get/list which unwrap .result
            expect(result).toBe(watchResponse);
        });

        test('uses a different channel id on each call', async () => {
            window.gapi.client.drive.files.watch.mockResolvedValue({});
            await watchFile('file-1', 'https://example.com/a');
            await watchFile('file-1', 'https://example.com/b');

            const [firstCall, secondCall] = window.gapi.client.drive.files.watch.mock.calls;
            expect(firstCall[0].resource.id).not.toBe(secondCall[0].resource.id);
        });
    });

    describe('createJSONFile / updateJSONFile (resumable upload over XHR)', () => {
        test('createJSONFile POSTs to the create endpoint (no fileId) and includes parents in the metadata payload', async () => {
            const promise = createJSONFile({ hello: 'world' }, 'token-1', 'sheet.json');
            await flushPromises();

            expect(FakeXHR.instances).toHaveLength(1);
            const initXHR = FakeXHR.instances[0];
            expect(initXHR.method).toBe('POST');
            expect(initXHR.url).toBe('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable');
            expect(initXHR.requestHeaders.Authorization).toBe('Bearer token-1');

            const payload = JSON.parse(initXHR.body);
            expect(payload).toEqual(expect.objectContaining({
                name: 'sheet.json',
                mimeType: 'application/json',
                parents: [PARENT_FOLDER_ID],
            }));

            // resolve the init request, then the follow-up PUT, so the promise settles
            initXHR.respond(200, { headers: { Location: 'https://upload.example.com/resumable-session' } });
            await flushPromises();
            const uploadXHR = FakeXHR.instances[1];
            uploadXHR.respond(200, { response: 'ok' });

            await expect(promise).resolves.toBe('ok');
        });

        test('updateJSONFile PATCHes the specific fileId endpoint and omits parents from the metadata payload', async () => {
            const promise = updateJSONFile({ hello: 'world' }, 'token-1', 'sheet.json', 'existing-file-id');
            await flushPromises();

            const initXHR = FakeXHR.instances[0];
            expect(initXHR.method).toBe('PATCH');
            expect(initXHR.url).toBe('https://www.googleapis.com/upload/drive/v3/files/existing-file-id?uploadType=resumable');

            const payload = JSON.parse(initXHR.body);
            expect(payload.parents).toBeUndefined();

            initXHR.respond(200, { headers: { Location: 'https://upload.example.com/resumable-session-2' } });
            await flushPromises();
            FakeXHR.instances[1].respond(200, { response: 'updated' });

            await expect(promise).resolves.toBe('updated');
        });

        test('sends the actual file bytes to the Location URL returned by the init request', async () => {
            const promise = createJSONFile({ a: 1 }, 'token-1', 'sheet.json');
            await flushPromises();

            FakeXHR.instances[0].respond(200, { headers: { Location: 'https://upload.example.com/session-xyz' } });
            await flushPromises();

            const uploadXHR = FakeXHR.instances[1];
            expect(uploadXHR.method).toBe('PUT');
            expect(uploadXHR.url).toBe('https://upload.example.com/session-xyz');
            expect(uploadXHR.requestHeaders['Content-Type']).toBe('application/json');
            // the uploaded body is the file's actual bytes (an ArrayBuffer), not the metadata JSON
            expect(uploadXHR.body).toBeInstanceOf(ArrayBuffer);

            uploadXHR.respond(200, { response: 'ok' });
            await promise;
        });

        test('rejects with an Error (carrying status/statusText) when the init request errors out', async () => {
            const promise = createJSONFile({ a: 1 }, 'token-1', 'sheet.json');
            await flushPromises();

            FakeXHR.instances[0].triggerError(500, 'Internal Server Error');

            await expect(promise).rejects.toThrow('Failed to upload file to Google Drive');
            await expect(promise).rejects.toMatchObject({ status: 500, statusText: 'Internal Server Error' });
        });

        test('does not resolve or reject while the init request is still in progress (readyState never reaches DONE)', async () => {
            const promise = createJSONFile({ a: 1 }, 'token-1', 'sheet.json');
            await flushPromises();

            const initXHR = FakeXHR.instances[0];
            initXHR.readyState = 2; // HEADERS_RECEIVED, not DONE
            initXHR.status = 200;
            initXHR.onreadystatechange?.();
            await flushPromises();

            expect(FakeXHR.instances).toHaveLength(1); // no follow-up PUT started yet

            // clean up so the test doesn't leave a dangling unresolved promise
            initXHR.respond(200, { headers: { Location: 'https://upload.example.com/late' } });
            await flushPromises();
            FakeXHR.instances[1].respond(200, { response: 'ok' });
            await promise;
        });

        test('does not resolve while the follow-up upload request is still in progress or fails with a non-200 status', async () => {
            const promise = createJSONFile({ a: 1 }, 'token-1', 'sheet.json');
            await flushPromises();

            FakeXHR.instances[0].respond(200, { headers: { Location: 'https://upload.example.com/late' } });
            await flushPromises();

            const uploadXHR = FakeXHR.instances[1];
            // mid-transfer: readyState changes but not to DONE yet
            uploadXHR.readyState = 3;
            uploadXHR.status = 200;
            uploadXHR.onreadystatechange?.();
            // DONE, but a non-200 status (uploadFileToDrive has no explicit
            // failure path for this - it just never resolves, matching its
            // onerror-only error handling)
            uploadXHR.readyState = FakeXHR.DONE;
            uploadXHR.status = 500;
            uploadXHR.onreadystatechange?.();
            await flushPromises();

            let settled = false;
            promise.then(() => { settled = true; });
            await flushPromises();
            expect(settled).toBe(false);

            // clean up so the test doesn't leave a dangling unresolved promise
            uploadXHR.respond(200, { response: 'ok' });
            await promise;
        });
    });
});
