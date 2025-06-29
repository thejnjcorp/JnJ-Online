// returns the Imgur image link after uploading an image to Imgur
export async function uploadImageToImgur(file) {
    const clientId = process.env.REACT_APP_IMGUR_CLIENT_ID,
        auth = "Client-ID " + clientId;
    const formData = new FormData();
    formData.append('image', file);
    var numTries = 0;

    while (true) {
        numTries++;
        const res = await fetch("https://api.imgur.com/3/image/", {
            method: "POST",
            body: formData,
            headers: {
                Authorization: auth,
                Accept: "application/json",
            },
        });

        const data = await res.json();
        console.log(data);
        if (data.success) {
            console.log("Image uploaded successfully:", data.data.link);
            alert("Image uploaded successfully: " + data.data.link);
            return data.data.link;
        } else {
            console.error("Image upload failed:", data.data.error);
            console.log("Number of tries remaining: " + (3 - numTries));
        }
        if (numTries >= 3) {
            alert("Image upload failed after 3 attempts. Please try again later.");
            return null;
        }
    }
}