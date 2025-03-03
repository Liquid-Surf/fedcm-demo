
import { Session } from '@inrupt/solid-client-authn-browser';
export const InruptSession = Session


// export async function fetchRessource(url, accessToken, dpopKey) {
//   if (dpopKey) {
//     const authFetch = await buildAuthenticatedFetch(accessToken, { dpopKey })
//     const resp = await authFetch(url)
//     const body = await resp.text()
//     console.log("auth fetch")
//     console.log(body)
//     return body
//   } else {
//     const resp = await fetch(url)
//     console.log("resp", resp)
//     return await resp.text()
//   }
// }

// export function extractWebID(jwt) {
//   const parts = jwt.split('.');
//   if (parts.length !== 3) {
//     throw new Error('Invalid JWT: The token must consist of three parts.');
//   }
//   const payload = parts[1];

//   // Decode the payload from base64-url to a JSON string
//   const decodedPayload = atob(payload.replace(/_/g, '/').replace(/-/g, '+'));
//   const payloadObj = JSON.parse(decodedPayload);

//   return payloadObj.webid;
// }

// export async function getAccessToken(authString, opUrl) {
//   // A key pair is needed for encryption.
//   // This function from `solid-client-authn` generates such a pair for you.
//   // const dpopKey = await generateDpopKeyPair();

//   // These are the ID and secret generated in the previous step.
//   // Both the ID and the secret need to be form-encoded.
//   // const authString = `${encodeURIComponent(id)}:${encodeURIComponent(secret)}`;
//   // This URL can be found by looking at the "token_endpoint" field at
//   // http://localhost:3000/.well-known/openid-configuration
//   // if your server is hosted at http://localhost:3000/.
//   const tokenUrl = `${opUrl}.oidc/token`;
//   console.log('tokenUrl', tokenUrl)
//   const dpopKey = await generateDpopKeyPair();
//   const dpopHeader = await createDpopHeader(tokenUrl, 'POST', dpopKey);
//   console.log('dpopKey', dpopKey)
//   console.log('dpopHeader', dpopHeader)
//   const authString64 = btoa(authString)
//   console.log('authString', authString)
//   console.log(authString64)
//   try {
//     const target = tokenUrl;
//     const resp = await fetch(target, {
//       method: 'POST',
//       headers: {
//         // The header needs to be in base64 encoding.
//         authorization: `Basic ${authString64}`,
//         'content-type': 'application/x-www-form-urlencoded',
//         dpop: dpopHeader,
//       },
//       body: 'grant_type=client_credentials&scope=webid',
//     });
//     const jresp = await resp.json();
//     console.log(`fetching ${target} and got`, jresp)
//     const { access_token: accessToken } = jresp
//     console.log('result', { accessToken, dpopKey })
//     return { accessToken, dpopKey }
//   } catch (error) {
//     console.log(`Error in getAccessToken: ${error}`)
//     return
//   }

//   // This is the Access token that will be used to do an authenticated request to the server.
//   // The JSON also contains an "expires_in" field in seconds,
//   // which you can use to know when you need request a new Access token.

// }

// export async function inruptLogin(cssUrl, session) {
//   if (!session.info.isLoggedIn) {
//     // Initiate login
//     const login_response = await session.login({
//       // clientId: `${window.location.href}clientid`,
//       oidcIssuer: cssUrl,
//       redirectUrl: window.location.href,
//       clientName: "Solid Demo App",
//       prompt: "consent",
//       "handleRedirect": async (url) => {
//         try {
//           console.log("handle redirect ur ", url)
//           const urlObj = new URL(url);
//           const params = Object.fromEntries(urlObj.searchParams.entries());
//           console.log("PARAMS", params)
//           const token = await startFedcmLogin(params)
//           console.log("TOKEN", token)
//           // window.location = token.token 
//           // const res = await session.handleIncomingRedirect(token.token);
//           // console.log("handling redirect res", res)
//           // if (session.info.isLoggedIn) {
//           //   console.log(`User is logged in with WebID: ${session.info.webId}`);
//           //   console.log(session.info);
//           // } else {
//           //   console.log('not logged in..')
//           // }
//         } catch (err) {
//           console.log("got an error during fedcm loggin..", err)
//         }

//       },
//     });
//     console.log("login_response", login_response)
//   }
//   // else {
//   //   // Logout
//   //   await session.logout();
//   //   window.location.reload();
//   // }
// }

// function parseUrlParam() {
//   const urlObj = new URL(window.location.href);
//   const queryData = Object.fromEntries(urlObj.searchParams.entries());
//   return queryData;
// }

// export async function startFedcmLogin(params) {
//   console.log('startFedcmLogin')
//   // const params = parseUrlParam()
//   console.log("params", params)
//   // const clientId = `${window.location.protocol}//${window.location.host}/clientid`
//   const identity_registered = {
//     "providers": [
//       {
//         "configURL": `any`,
//         "clientId": params.client_id,
//         "registered": true,
//         // "type": "webid",

//         "params": {
//           "code_challenge": params.code_challenge,
//           "code_challenge_method": params.code_challenge_method,
//           "state": params._state

//         }

//       }
//     ]
//   }
//   console.log('requesting navigator\'s API..')
//   try {
//     const token = await navigator.credentials.get({
//       identity: identity_registered
//     })
//     console.log('token', token)
//     return token
//   } catch (error) {
//     console.log("Client Error calling the navigator api: ", error);
//     return

//   }
// }


