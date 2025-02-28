import { BadRequestHttpError, CookieStore, finishInteraction, HttpRequest, HttpResponse, InternalServerError, ProviderFactory } from '@solid/community-server';
import { Interaction } from '@solid/community-server';
import { forgetWebId } from '@solid/community-server';
import { HttpHandler } from '@solid/community-server';
import type { HttpHandlerInput } from '@solid/community-server';
import { WebIdStore } from '@solid/community-server';
import { generateDpopKeyPair } from '@inrupt/solid-client-authn-core';
import { getLoggerFor } from '@solid/community-server';
import { parse } from 'cookie'
import { readableToString } from '@solid/community-server';
import { InteractionResults } from '@solid/community-server/templates/types/oidc-provider';

/**
 * HTTP handler that handle all FedCM requests.
 */
export class FedcmHttpHandler extends HttpHandler {
  protected readonly logger = getLoggerFor(this);

  private readonly baseUrl: string;
  private readonly cookieStore: CookieStore;
  private readonly webIdStore: WebIdStore;
  private readonly providerFactory;


  public constructor(
    baseUrl: string,
    webIdStore: WebIdStore,
    cookieStore: CookieStore,
    providerFactory: ProviderFactory,
  ) {
    super();
    this.baseUrl = baseUrl.slice(-1) === '/'
      ? baseUrl
      : `${baseUrl}/`; // TODO check if CSS does it automatically     
    this.cookieStore = cookieStore
    this.webIdStore = webIdStore
    this.providerFactory = providerFactory
  }

  private async get_token(id: string, secret: string, dpopHeader: string) {
    // A key pair is needed for encryption.
    // This function from `solid-client-authn` generates such a pair for you.
    const dpopKey = await generateDpopKeyPair();
    // These are the ID and secret generated in the previous step.
    // Both the ID and the secret need to be form-encoded.
    const authString = `${encodeURIComponent(id)}:${encodeURIComponent(secret)}`;
    // This URL can be found by looking at the "token_endpoint" field at
    // http://localhost:3000/.well-known/openid-configuration
    // if your server is hosted at http://localhost:3000/.
    const tokenUrl = `${this.baseUrl}.oidc/token`;
    try {
      const target = tokenUrl;
      const resp = await fetch(target, {
        method: 'POST',
        headers: {
          // The header needs to be in base64 encoding.
          authorization: `Basic ${Buffer.from(authString).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded',
          dpop: dpopHeader,
        },
        body: 'grant_type=client_credentials&scope=webid',
      });
      const jresp = await resp.json();
      this.logger.info(`FETCHING ${target} \n RESPONDED WITH \n ${jresp}`)
      return jresp
    } catch (error) {
      this.logger.info(`Error in get_token: ${error}`)
      return
    }

    // This is the Access token that will be used to do an authenticated request to the server.
    // The JSON also contains an "expires_in" field in seconds,
    // which you can use to know when you need request a new Access token.

  }


  private async get_client_id_secret(authorization: string, webId: string) {

    // Now that we are logged in, we need to request the updated controls from the server.
    // These will now have more values than in the previous example.
    const indexResponse = await fetch(`${this.baseUrl}.account/`, {
      headers: { authorization: `CSS-Account-Token ${authorization}` }
    });
    let { controls }: any = await indexResponse.json();
    try {

      let target = controls.account.clientCredentials;
      // Here we request the server to generate a token on our account
      const resp = await fetch(target, {
        method: 'POST',
        headers: { authorization: `CSS-Account-Token ${authorization}`, 'content-type': 'application/json' },
        // The name field will be used when generating the ID of your token.
        // The WebID field determines which WebID you will identify as when using the token.
        // Only WebIDs linked to your account can be used.
        body: JSON.stringify({ name: 'my-token', webId: webId }),
      });
      const jresp = await resp.json()
      this.logger.info(`FETCHING ${target} \n RESPONDED WITH \n ${jresp}`)



      // These are the identifier and secret of your token.
      // Store the secret somewhere safe as there is no way to request it again from the server!
      // The `resource` value can be used to delete the token at a later point in time.
      const { id, secret }: any = jresp;
      return { tokenId: id, secret: secret }

    } catch (error) {
      this.logger.info(`Error in get_token: ${error}`)
      return
    }

  }
  private async deleteToken(tokenId: string, authorization: string) {
    const indexResponse = await fetch(`${this.baseUrl}.account/`, {
      headers: { authorization: `CSS-Account-Token ${authorization}` }
    });
    let { controls }: any = await indexResponse.json();
    const listOfTokensResp = await fetch(controls.account.clientCredentials, {
      headers: { authorization: `CSS-Account-Token ${authorization}` }
    })
    const listOfTokensJson: any = await listOfTokensResp.json()
    const tokenUrl = listOfTokensJson.clientCredentials[tokenId]
    const delteTokenResp = await fetch(tokenUrl, {
      method: 'DELETE',
      headers: { authorization: `CSS-Account-Token ${authorization}` }
    });
  }

  public async handle({ request, response }: HttpHandlerInput): Promise<void> {

    if (request.headers['sec-fetch-dest'] !== 'webidentity') {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'Bad Request: Missing or incorrect Sec-Fetch-Dest header' }));
      return;
    }

    if (request.url?.startsWith('/.well-known/web-identity')) {
      await this.handleWebIdentity({ request, response });
    } else if (request.url?.startsWith('/.well-known/fedcm/fedcm.json')) {
      await this.handleFedcmJSON({ request, response });
    } else if (request.url?.startsWith('/.well-known/fedcm/accounts_endpoint')) {
      await this.handleAccountsEnpoint({ request, response });
    } else if (request.url?.startsWith('/.well-known/fedcm/client_metadata_endpoint')) {
      await this.handleClientMetadataEndpoint({ request, response });
    } else if (request.url?.startsWith('/.well-known/fedcm/token')) {
      await this.handleToken({ request, response });
    } else if (request.url?.startsWith('/.well-known/fedcm/disconnect')) {
      await this.handleDisconnect({ request, response });
    } else {
      response.writeHead(500, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ 'error': { 'message': `Fail in FedcmHttpHandler to handle the following request url: ${request.url}` } }));
    }


  }


  private async handleWebIdentity({ request, response }: HttpHandlerInput): Promise<void> {
    // 3.1
    // https://fedidcg.github.io/FedCM/#idp-api-well-known

    const providers = [`${this.baseUrl}.well-known/fedcm/fedcm.json`]
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ 'provider_urls': providers }))
  }

  private async handleFedcmJSON({ request, response }: HttpHandlerInput): Promise<void> {
    // 3.2
    // 

    const config = {
      "accounts_endpoint": `/.well-known/fedcm/accounts_endpoint`,
      "client_metadata_endpoint": `/.well-known/fedcm/client_metadata_endpoint`,
      "id_assertion_endpoint": `/.well-known/fedcm/token`,
      "disconnect_endpoint": `/.well-known/fedcm/disconnect`,
      "revocation_endpoint": `/.oidc/token/revocation`,
      "login_url": `/.account/login/password/`,
      "branding": {
        "background_color": "rgb(255, 055, 255)",
        "color": "0xffffff",
        "context": `Sign in to CSS`,
        "icons": [
          {
            "url": `/.well-known/css/images/solid.png`,
            "size": 32
          }
        ]
      }
    }

    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify(config))
  }

  private async handleAccountsEnpoint({ request, response }: HttpHandlerInput): Promise<void> {
    // 3.3
    // https://fedidcg.github.io/FedCM/#idp-api-accounts-endpoint

    // Upon receiving the request, the server should:
    //  1. Verify that the request contains a Sec-Fetch-Dest: webidentity HTTP header.
    //  2. Match the session cookies with the IDs of the already signed-in accounts.
    //  3. Respond with the list of accounts.

    const cookies = parse(request.headers.cookie || '')
    if (!('css-account' in cookies)) {
      response.writeHead(401, { 'Content-Type': 'text/plain' });
      response.end(JSON.stringify({ error: "Missing 'css-account' in request's cookies" }));
      return;
    }
    const cssAccountCookie = cookies['css-account']
    const accountId = await this.cookieStore.get(cssAccountCookie)
    // TODO If the user is not signed in, respond with HTTP 401 (Unauthorized).
    // find a way to check if the user is signed in

    if (!accountId) {
      // TODO Does this necessary mean the user is not signed in ? 
      response.writeHead(400, { 'Content-Type': 'text/plain' });
      response.end(JSON.stringify({ error: `Could not find an account matching the given cookie (${cssAccountCookie}).` }));
      return;
    }


    const accountLinks = await this.webIdStore.findLinks(accountId)
    const webId = accountLinks[0].webId || '' // TODO multi webId account


    const accounts = {
      accounts: [
        {
          id: accountId,
          name: 'John', // TODO fetch webId's vcard
          given_name: 'Doe', // TODO fetch webId's vcard
          // email: 'a@a.a', // TODO get user's email ?
          email: webId, // giving the webId instead of an email
          picture: 'https://doodleipsum.com/150x150/avatar-2?i=f7de8aff0b8c3f4bc758e106d80d071e', // TODO 
          approved_clients: []
        }
      ]
    }
    response.writeHead(200, { 'Content-Type': 'application/json' })

    response.end(JSON.stringify(accounts))

  }


  private async handleClientMetadataEndpoint({ request, response }: HttpHandlerInput): Promise<void> {
    // 3.4
    // https://fedidcg.github.io/FedCM/#idp-api-client-id-metadata-endpoint

    const metadata = {
      privacy_policy_url: '...',
      terms_of_service_url: '...'
    };
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(metadata));
  }

  // ------ UTILS FOR handleToken ------- //

  private async fetchWithDefaults(url: string, options: RequestInit = {}): Promise<Response> {
    const defaultHeaders: Record<string, string> = {
      'Host': 'localhost:3000',
      'Connection': 'keep-alive',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'cors',
    };
    options.headers = { ...defaultHeaders, ...(options.headers || {}) };
    return fetch(url, options);
  }
  private renameCookiePath(cookieArray: Array<string>, newPath: string = '/'): Array<string> {
    let res: Array<string> = []
    // const setCookieHeader = pickWebIdCookie.getSetCookie();
    // if (setCookieHeader && Array.isArray(setCookieHeader)) {
    cookieArray.forEach((c: string) => {
      res.push(
        c.replace('path=/.account/', `path=${newPath}`)
          .replace(/path=\/\.oidc\/auth\/[a-zA-Z0-9_-]+;/, `path=${newPath};`)
      );
    });
    return res
  }

  // Parses a cookie header string into a key/value record.
  private cookieParser(cookieString: string): Record<string, string> {
    return cookieString.split('; ').reduce((acc, cookie) => {
      const [key, value] = cookie.split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
  }

  // Helper to turn an array of cookie strings into a single header string.
  private parseCookiesArray(cookies: string[]): string {
    if (!cookies) return '';
    return cookies.map(cookie => cookie.split(';')[0]).join('; ') + ';';
  }


  // Get first OIDC interaction cookie
  private async initiateOidcInteraction(clientId: string, clientUrl: string, codeChallenge: string, state: string): Promise<any> {
    const redirectUri = encodeURIComponent(clientUrl);
    const responseType = 'code';
    const scope = 'openid offline_access webid';
    const codeChallengeMethod = 'S256';
    const prompt = 'consent';
    const responseMode = 'query';

    const url = `${this.baseUrl}.oidc/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=${responseType}&scope=${encodeURIComponent(scope)}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=${codeChallengeMethod}&prompt=${prompt}&response_mode=${responseMode}&bypass=true`;

    const headers = {
      'Host': `localhost:3000`,
      'Accept': 'text/html',
      // 'Referer': clientUrl,
      'Referer': 'http://localhost:6080/',
      'Sec-Fetch-Site': "same-site",
      'Sec-Fetch-Mode': "navigate",
      'Sec-Fetch-Dest': "document",
      'Connection': "keep-alive"

    };

    const response = await fetch(url, {
      method: 'GET',
      headers,
      // Do not follow the 303 redirect
      redirect: 'manual',
      credentials: 'include'
    });

    const resp_status = response.status
    const resp_cookies = response.headers.getSetCookie()
    const resp_body = await response.text()

    return resp_cookies

  }

  // Creates the OIDC interaction if available.
  private async getOidcInteraction({ request, response }: HttpHandlerInput, initiateOidcInteractionCookies: Array<string>): Promise<Interaction | undefined> {
    let req_with_cookie = request
    req_with_cookie.headers.cookie += '; '
    req_with_cookie.headers.cookie += initiateOidcInteractionCookies.join('; ')

    try {
      const provider = await this.providerFactory.getProvider();
      // Keeping this here, it create an error on oidc-provider
      // will try to reproduce it
      // request.headers.cookie += ';_interaction=mWJLy75-lL8EhhJpy7lpu; _interaction.sig=QfxSPQxo6gYTyfT3TspY6JTt1v0;css-account=c5dfed2a-cfc2-4862-b94e-b791cb1d7c89'
      return await provider.interactionDetails(req_with_cookie, response);
    } catch (err) {
      this.logger.debug('No active OIDC interaction found:' + err);
      return undefined;
    }
  }

  // RESOLVELOGIN: Generates an authorization cookie and (if an OIDC interaction exists)
  // finishes the interaction to update policies.
  private async resolveLogin(accountId: string, interaction: Interaction | undefined): Promise<string> {
    // TODO just put part of the resolveLogin code, might need to recheck that part
    let authorization: string;
    authorization = await this.cookieStore.generate(accountId);
    if (interaction) {
      // Finish the interaction so the policies are checked again, where they will find the new cookie
      await finishInteraction(interaction, {}, true);
    }
    return authorization;
  }

  // PICK-WEBID: Calls the pick-webid endpoint, updates the OIDC interaction with the picked WebID,
  // and retrieves the redirect response to be used in the consent flow.
  private async pickWebIdAndFinishInteraction(
    request: HttpRequest,
    authorization: string,
    interaction: Interaction | undefined
  ): Promise<{ pickWebIdCookies: Array<string> }> {
    if (!interaction) {
      throw new BadRequestHttpError('No active OIDC interaction available.');
    }
    try {
      // TODO get url dynamically
      // TODO do not use fetch, import code from pick-webid
      const pickWebIdEndpoint = 'http://localhost:3000/.account/oidc/pick-webid/';
      let originalCookie = request.headers.cookie || ''
      originalCookie += `; css-account=${authorization}`;
      originalCookie = originalCookie.split('; ').slice(1).join('; ')

      const webIdResponse = await this.fetchWithDefaults(pickWebIdEndpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Sec-Fetch-Dest': 'empty',
          'Cookie': originalCookie
        } as any,
      });

      if (!webIdResponse.ok) {
        throw new InternalServerError('Failed to fetch pick-webid endpoint.');
      }
      const webIdJson: any = await webIdResponse.json();
      if (webIdJson.webIds.length < 1)
        throw new InternalServerError('No webId for this account');
      const webId = webIdJson.webIds[0];

      const provider = await this.providerFactory.getProvider();
      await forgetWebId(provider, interaction);

      const login: InteractionResults['login'] = {
        // Note that `accountId` here is unrelated to our user accounts but is part of the OIDC library
        accountId: webId,
        remember: false,
      };

      const location = await finishInteraction(interaction, { login }, true);
      // TODO: try to forge request and send it to this.oidcHttpHandler
      const redirectResponse = await fetch(location, {
        method: 'GET',
        headers: {
          'Host': 'localhost:3000',
          'Connection': 'keep-alive',
          'Accept': 'text/html',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Dest': 'empty',
          'Cookie': originalCookie
        } as any,
        redirect: 'manual',
        credentials: 'include'
      });

      const pickWebIdCookies = (redirectResponse.headers as any).getSetCookie();
      if (!(pickWebIdCookies && Array.isArray(pickWebIdCookies))) {
        // assert cookie error
      }

      return { pickWebIdCookies };
    } catch (err) {
      this.logger.error('Error during pick-webid processing:' + err);
      throw new InternalServerError('Pick-webid process failed.');
    }
  }

  // CONSENT: Uses the redirect response from the previous step to extract cookies,
  // then calls the consent endpoint and finally performs the last fetch to retrieve the final cookies and redirect URL.
  private async processConsent(
    pickWebIdCookies: Array<string>,
    cgaCookie: string,
    authorization: string
  ): Promise<{ consentCookies: string; finalRedirect: string }> {
    try {
      // Process cookies from the redirect response.
      const cookies = this.renameCookiePath(pickWebIdCookies)
      cookies.push(`cga-cookie=${cgaCookie}; Path=/; SameSite=Lax`);
      cookies.push(`css-account=${authorization}; Path=/; SameSite=Lax`);

      const cookiesHeader = this.parseCookiesArray(cookies);

      // TODO get url dynamically
      const consentUrl = 'http://localhost:3000/.account/oidc/consent/';
      const body = JSON.stringify({ remember: true });
      const consentResponse = await fetch(consentUrl, {
        method: 'POST',
        headers: {
          'Host': 'localhost:3000',
          'Connection': 'keep-alive',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Dest': 'empty',
          'Cookie': cookiesHeader
        } as any,
        body,
      });
      if (!consentResponse.ok) {
        throw new InternalServerError('Consent endpoint responded with an error.');
      }
      const consentJson = await consentResponse.json();
      const consentLocation = (consentJson as any).location;
      // const cookieLast = cookiesHeader.split(';').slice(4).join(';');
      const cookieLast = cookiesHeader;


      // LAST FETCH: Do not follow the 303 redirect so we can grab the cookies.
      const lastFetch = await fetch(consentLocation, {
        method: 'GET',
        headers: {
          'Host': 'localhost:3000',
          'Connection': 'keep-alive',
          'Accept': 'text/html',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Dest': 'document',
          'Cookie': cookieLast
        } as any,
        redirect: 'manual',
        credentials: 'include'
      });
      const lastSetCookieHeader = (lastFetch.headers as any).getSetCookie();
      const cookiesLastArray: string[] = lastSetCookieHeader && Array.isArray(lastSetCookieHeader) ?
        this.renameCookiePath(lastSetCookieHeader)
        : []
      //TODO handle empty array case 

      cookiesLastArray.push(`cga-cookie=${cgaCookie}; Path=/; SameSite=Lax`);
      cookiesLastArray.push(`css-account=${authorization}; Path=/; SameSite=Lax`);

      const cookiesHeaderLast = this.parseCookiesArray(cookiesLastArray);
      const clientRedirect = lastFetch.headers.get('location') || '';
      return { consentCookies: cookiesHeaderLast, finalRedirect: clientRedirect };
    } catch (err) {
      this.logger.error('Error during consent processing:' + err);
      throw new InternalServerError('Consent process failed.');
    }
  }

  private async getSession(accountId: string, cssAccountCookie: string, provider: any) {
    return async (sid="") => {
      const session = accountId ? await provider.Session.find(accountId) : null;
      const session2 = cssAccountCookie ? await provider.Session.find(cssAccountCookie) : null;
      const session3 = sid != '' ? await provider.Session.find(sid) : null
      return  session || session2 || session3 
    }
  }


  private async handleToken({ request, response }: HttpHandlerInput): Promise<void> {
    // 3.5
    // https://fedidcg.github.io/FedCM/#idp-api-id-assertion-endpoint

    // Upon receiving the request, the server should:
    // 1. Verify that the request contains a Sec-Fetch-Dest: webidentity HTTP header.
    // 2. Match the Origin header against the RP origin determine by the client_id. Reject if they don't match.
    // 3. Match account_id against the ID of the already signed-in account. Reject if they don't match.
    // 4. Respond with a token. If the request is rejected, respond with an error response.
    // How the token is issued is up to the IdP, but in general, it's signed with information 
    //such as the account ID, client ID, issuer origin, nonce, so that the RP can verify the token is genuine.

    const r = await readableToString(request)
    const client_id = new URLSearchParams(r).get('client_id') || ''
    const nonce = new URLSearchParams(r).get('nonce') || undefined
    const params_raw = new URLSearchParams(r).get('params') || undefined
    const params = params_raw ? JSON.parse(params_raw) : {}


    if (!client_id) {
      const error_msg = 'client_id missing from the request\'s body.'
      this.logger.info(error_msg)
      response.writeHead(400, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ 'error': error_msg }))
      return
    }

    // if (!nonce) {
    //   const error_msg = 'Nonce missing. To make FedCM work with Solid-OIDC, you need to pass the DPoP Header through the nonce value in the request.'
    //   this.logger.info(error_msg)
    //   response.writeHead(400, { 'Content-Type': 'application/json' })
    //   response.end(JSON.stringify({ 'error': error_msg }))
    //   return
    // }

    // const dpopHeader = nonce // This is a hack since FedCM doesn't support DPoP Header, 
    // we pass it through the nonce, since its an optional feature of FedCM



    const cookies = parse(request.headers.cookie || '')

    if (!('css-account' in cookies)) {
      const error_msg = 'No CSS cookie found in the request header.'
      this.logger.info(error_msg)
      response.writeHead(500, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ 'error': error_msg }))
      return
    }

    const cssAccountCookie = cookies['css-account']

    const accountId = await this.cookieStore.get(cssAccountCookie)
    const reqAccountId = new URLSearchParams(r).get('account_id')

    if (!accountId) {
      const error_msg = 'no account id find with the given cookie'
      this.logger.info(error_msg)
      response.writeHead(400, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ 'error': error_msg }))
      return
    }

    if (!reqAccountId) {
      const error_msg = 'account_id missing from the request\'s body.'
      this.logger.info(error_msg)
      response.writeHead(400, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ 'error': error_msg }))
      return
    }

    if (accountId !== reqAccountId) {
      const error_msg = 'The account_id from the request\'s body doesn\'t match the account_id binded to the session cookie.'
      this.logger.info(error_msg)
      response.writeHead(400, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ 'error': error_msg }))
      return
    }


    // ------ GET AUTHZ CODE ------ //

    const initiateOidcInteractionCookies =
      await this.initiateOidcInteraction(
        encodeURIComponent(client_id),
        "http://localhost:6080/",
        params.code_challenge,
        params.state)
    let cgaCookie = '123';
    const oidcInteraction = await this.getOidcInteraction({ request, response }, initiateOidcInteractionCookies);

    const authorization = await this.resolveLogin(accountId, oidcInteraction);

    // ----- PICK-WEBID -----
    const { pickWebIdCookies } = await this.pickWebIdAndFinishInteraction(
      request,
      authorization,
      oidcInteraction
    );


    // ----- CONSENT -----
    const { consentCookies, finalRedirect } = await this.processConsent(
      pickWebIdCookies,
      cgaCookie,
      authorization
    );


    const accountLinks = await this.webIdStore.findLinks(accountId)
    const webId = accountLinks[0].webId // TODO: handle mutiple webId


    // TODO re-use previous token instead of creating a new
    const { tokenId, secret }: any = await this.get_client_id_secret(cssAccountCookie, webId)
    const authString = `${encodeURIComponent(tokenId)}:${encodeURIComponent(secret)}`;

    // const { access_token: accessToken }: any = await this.get_token(tokenId, secret, dpopHeader)
    // seems that we can safely delete the tokenId once we have the access token
    // then we don't poluate the account with an incremental number of access tokens
    // await this.deleteToken(tokenId, cssAccountCookie)

    response.writeHead(200, { 'Content-Type': 'application/json' })
    // response.end(JSON.stringify({ 'token': authString}))
    response.end(JSON.stringify({ 'token': finalRedirect  }))
  }


  private async handleDisconnect({ request, response }: HttpHandlerInput): Promise<void> {
    // 3.6
    // https://fedidcg.github.io/FedCM/#idp-api-disconnect-endpoint


    // TODO:
    // check POST
    // has IDP cookies
    // has RP origin in header
    // in cors mode
    // has in body:
    //    - client id
    //    - account_hint


    // get account_id from cookie
    // fetch controls with account_id
    // call controls.account.logout
    const metadata = {
      privacy_policy_url: '...',
      terms_of_service_url: '...'
    };
    response.writeHead(501, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: "TODO" }));
  }


}
