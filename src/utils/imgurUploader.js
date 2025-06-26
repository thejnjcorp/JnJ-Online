export async function uploadImageToImgur(file) {
    const clientId = process.env.REACT_APP_IMGUR_CLIENT_ID,
        auth = "Client-ID " + clientId;
    const formData = new FormData();
    formData.append('image', file);

    // Making the post request
    const res = await fetch("https://api.imgur.com/3/image/", {
        // API Endpoint
        method: "POST", // HTTP Method
        body: formData, // Data to be sent
        headers: {
            // Setting header
            Authorization: auth,
            Accept: "application/json",
        },
    });

    const data = await res.json();
    console.log(data);
    if (data.success) {
        console.log("Image uploaded successfully:", data.data.link);
        alert("Image uploaded successfully: " + data.data.link);
        return data.data.link; // Return the image link
    } else {
        console.error("Image upload failed:", data.data.error);
        alert("Image upload failed: " + data.data.error);
    }
}