export async function getGoogleSheetCells(spreadsheetKey, sheetName, startCell, endCell) {
    const response = await window.gapi.client.sheets.spreadsheets.values.get({
        'spreadsheetId': spreadsheetKey,
        'range': sheetName + '!' + startCell + ':' + endCell
    })
    return response.result.values;
}

export async function updateGoogleSheetCells(spreadsheetKey, sheetName, startCell, endCell, values, accessToken) {
    await window.gapi.client.sheets.spreadsheets.values.update({
        'spreadsheetId': spreadsheetKey,
        'range': sheetName + '!' + startCell + ':' + endCell,
        'valueInputOption': 'RAW',
        'access_token': accessToken,
        'resource': {
            'values': values
        }
    })
}

export async function getGoogleSheetCellsTargeted(spreadsheetKey, sheetName, targetCells) {
    const response = await window.gapi.client.sheets.spreadsheets.values.batchGet({
        'spreadsheetId': spreadsheetKey,
        'ranges': targetCells.map((value) => sheetName + "!" + value)
    })
    return response.result.valueRanges.map(valueRanges => valueRanges.values).flat(2);
}