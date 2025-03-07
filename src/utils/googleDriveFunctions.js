const parentFolderId = '1W7tEkctOTWMjjsq8Y5090fL7lkqaboJY';

export async function createJSONFile(json, access_token, filename) {
    const jsonString = JSON.stringify(json);
    const file = new File([jsonString], filename, {type: 'application/json'});

    return await uploadFileToDrive(file, access_token);
}

export async function updateJSONFile(json, access_token, filename, fileId) {
    const jsonString = JSON.stringify(json);
    const file = new File([jsonString], filename, {type: 'application/json'});

    return await uploadFileToDrive(file, access_token, true, fileId);
}

export async function getJSONFile(fileId) {
    const response = await window.gapi.client.drive.files.get({
        'fileId': fileId,
        'alt': 'media'
    });
    return response.result;
}

export async function listFiles() {
    const response = await window.gapi.client.drive.files.list({
        'q': `'${parentFolderId}' in parents and trashed = false`,
    });
    return response.result.files;
}

export async function deleteJSONFile(fileId) {
    await window.gapi.client.drive.files.delete({
        "fileId": fileId
    })
}

export async function watchFile(fileId, characterPageUrl) {
    const channelId = crypto.randomUUID();
    const channel = {
        id: channelId,
        type: 'web_hook',
        address: characterPageUrl
    };
    const response = await window.gapi.client.drive.files.watch({
        'fileId': fileId,
        'resource': channel
    });
    return response;
}

function uploadFileToDrive(file, access_token, fileIdExists = false, fileId) {
    return new Promise(function (resolve, reject) {
        // https://stackoverflow.com/questions/46160511/how-to-upload-files-to-google-drive-using-gapi-and-resumable-uploads
        const initResumable = new XMLHttpRequest();
        if (fileIdExists) {
            // https://github.com/RickMohr/jsGoogleDriveDemo/blob/main/index.html
            initResumable.open('PATCH', 'https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=resumable', true);
        } else {
            initResumable.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', true);
        }
        initResumable.setRequestHeader('Authorization', 'Bearer ' + access_token);
        initResumable.setRequestHeader('Content-Type', 'application/json');
        initResumable.setRequestHeader('X-Upload-Content-Length', file.size);
        initResumable.setRequestHeader('X-Upload-Content-Type', file.type);

        initResumable.onreadystatechange = function() {
            if(initResumable.readyState === XMLHttpRequest.DONE && initResumable.status === 200) {
                const locationUrl = initResumable.getResponseHeader('Location');
                const reader = new FileReader();
                reader.onload = (e) => {
                const uploadResumable = new XMLHttpRequest();
                uploadResumable.open('PUT', locationUrl, true);
                uploadResumable.setRequestHeader('Content-Type', file.type);
                uploadResumable.setRequestHeader('X-Upload-Content-Type', file.type);
                uploadResumable.onreadystatechange = function() {
                    if(uploadResumable.readyState === XMLHttpRequest.DONE && uploadResumable.status === 200) {
                        console.log(uploadResumable.response);
                        resolve(uploadResumable.response);
                    }
                };
                uploadResumable.send(reader.result);
                };
                reader.readAsArrayBuffer(file);
            }
        };

        initResumable.onerror = function() {
            reject({
                status: this.status,
                statusText: initResumable.statusText
            });
        }

        const payloadJSON = {
            'name': file.name,
            'mimeType': file.type,
            'Content-Type': file.type,
            'Content-Length': file.size
        };

        if(!fileIdExists) payloadJSON.parents = [parentFolderId];
        initResumable.send(JSON.stringify(payloadJSON));
    });
}