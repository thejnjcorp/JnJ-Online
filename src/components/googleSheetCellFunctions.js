export async function getGoogleSheetCells(spreadsheetKey, sheetName, startCell, endCell) {
    try {
        const response = await window.gapi.client.sheets.spreadsheets.values.get({
            'spreadsheetId': spreadsheetKey,
            'range': sheetName + '!' + startCell + ':' + endCell
        })
        return response.result.values;
    } catch(res) {
        return [];
    }
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