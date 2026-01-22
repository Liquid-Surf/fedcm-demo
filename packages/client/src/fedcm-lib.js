/**
 * FedCM Login Library for Solid Applications using Inrupt Auth lib
 */

const DEFAULT_ISSUER_URL = 'https://fedcm-server.liquid.surf';

const buildRedirectUrl = (code, state, providerUrl) => {
  const base = window.location.href;
  return `${base}?code=${code}&state=${state}&iss=${encodeURIComponent(providerUrl)}`;
};

const handleFedcmRedirect = async (redirectUrl, providerUrl, session) => {
  const params = Object.fromEntries(new URL(redirectUrl).searchParams);

  const credential = await navigator.credentials.get({
    identity: {
      providers: [{
        configURL: 'any',
        clientId: params.client_id,
        registered: true,
        params: {
          code_challenge: params.code_challenge,
          code_challenge_method: params.code_challenge_method,
          state: params.state
        }
      }]
    }
  });

  await session.handleIncomingRedirect(buildRedirectUrl(credential.token, params.state, providerUrl));
};

/**
 * Initiate Solid login using FedCM.
 */
export async function loginWithFedcm(session, options = {}, issuerUrl = DEFAULT_ISSUER_URL) {
  const {
    clientId = `${window.location.href}clientid`,
    clientName = 'Solid App'
  } = options;

  if (session.info.isLoggedIn) return;

  return new Promise((resolve, reject) => {
    session.login({
      oidcIssuer: issuerUrl,
      clientName,
      clientId,
      handleRedirect: async (url) => {
        try {
          await handleFedcmRedirect(url, issuerUrl, session);
          resolve();
        } catch (err) {
          reject(err);
        }
      }
    });
  });
}
