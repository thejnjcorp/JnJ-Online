import {
    getGoogleSheetCells,
    updateGoogleSheetCells,
    getGoogleSheetCellsTargeted,
} from '../../src/utils/googleSheetCellFunctions';

describe('googleSheetCellFunctions', () => {
    let sheetsValues;

    beforeEach(() => {
        sheetsValues = {
            get: jest.fn(),
            update: jest.fn(),
            batchGet: jest.fn(),
        };
        window.gapi = { client: { sheets: { spreadsheets: { values: sheetsValues } } } };
    });

    afterEach(() => {
        delete window.gapi;
    });

    describe('getGoogleSheetCells', () => {
        test('requests the given range and returns just the values', async () => {
            sheetsValues.get.mockResolvedValue({ result: { values: [['a', 'b'], ['c', 'd']] } });

            const result = await getGoogleSheetCells('sheet-key', 'Sheet1', 'A1', 'B2');

            expect(sheetsValues.get).toHaveBeenCalledWith({
                spreadsheetId: 'sheet-key',
                range: 'Sheet1!A1:B2',
            });
            expect(result).toEqual([['a', 'b'], ['c', 'd']]);
        });
    });

    describe('updateGoogleSheetCells', () => {
        test('sends the given values with RAW input option and the access token', async () => {
            sheetsValues.update.mockResolvedValue({});

            await updateGoogleSheetCells('sheet-key', 'Sheet1', 'A1', 'B2', [['x', 'y']], 'token-123');

            expect(sheetsValues.update).toHaveBeenCalledWith({
                spreadsheetId: 'sheet-key',
                range: 'Sheet1!A1:B2',
                valueInputOption: 'RAW',
                access_token: 'token-123',
                resource: { values: [['x', 'y']] },
            });
        });
    });

    describe('getGoogleSheetCellsTargeted', () => {
        test('builds one range per target cell, all prefixed with the sheet name', async () => {
            sheetsValues.batchGet.mockResolvedValue({ result: { valueRanges: [] } });

            await getGoogleSheetCellsTargeted('sheet-key', 'Sheet1', ['A1', 'C3']);

            expect(sheetsValues.batchGet).toHaveBeenCalledWith({
                spreadsheetId: 'sheet-key',
                ranges: ['Sheet1!A1', 'Sheet1!C3'],
            });
        });

        test('flattens every range\'s values into one single array', async () => {
            sheetsValues.batchGet.mockResolvedValue({
                result: {
                    valueRanges: [
                        { values: [['a']] },
                        { values: [['b'], ['c']] },
                    ],
                },
            });

            const result = await getGoogleSheetCellsTargeted('sheet-key', 'Sheet1', ['A1', 'B1:B2']);

            expect(result).toEqual(['a', 'b', 'c']);
        });

        test('a target cell with an undefined values result does not throw, but does surface as a literal undefined entry (.flat() only unwraps arrays, it does not drop falsy values)', () => {
            sheetsValues.batchGet.mockResolvedValue({
                result: { valueRanges: [{ values: [['a']] }, { values: undefined }] },
            });

            return expect(getGoogleSheetCellsTargeted('sheet-key', 'Sheet1', ['A1', 'B1']))
                .resolves.toEqual(['a', undefined]);
        });
    });
});
