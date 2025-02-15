import appData from './AppData.json';

/**
 * @deprecated due to client side issues with Google. Request is considered insecure and is unable to generate auth tokens.
 */
export function generateGoogleRefreshToken() {
    const redirectUri = window.location.href;
    console.log(redirectUri)
    const responseType = 'code';

    const stateUUID = crypto.randomUUID();

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(appData.clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=${encodeURIComponent(appData.scope)}&` +
    `response_type=${encodeURIComponent(responseType)}&` +
    `state=${encodeURIComponent(stateUUID)}&` +
    `access_type=offline`;

    console.log(authUrl)
    // window.location.href = authUrl;

}