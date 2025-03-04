import { BadRequestHttpError, HttpRequest, InternalServerError } from '@solid/community-server';
import { CookieStore } from '@solid/community-server';
import { ProviderFactory } from '@solid/community-server';
import { HttpHandler } from '@solid/community-server';
import type { HttpHandlerInput } from '@solid/community-server';
import { WebIdStore } from '@solid/community-server';
import { getLoggerFor } from '@solid/community-server';
import { parse } from 'cookie'
import { readableToString } from '@solid/community-server';
import Provider from '@solid/community-server/templates/types/oidc-provider';

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



  public async handle({ request, response }: HttpHandlerInput): Promise<void> {

    if (request.headers['sec-fetch-dest'] !== 'webidentity') {
      throw new BadRequestHttpError('Missing or incorrect Sec-Fetch-Dest header');
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

  private removeLastTraillingSlash(url: string): string { return url.slice(-1) == '/' ? url.slice(0, -1) : url }
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
    // Is the fact that we have a cookie enough to assume user is logged in ?
    // Is there expiration on a cookie ? can I test with an expirated cookie and able to log in ?

    if (!accountId) {
      // TODO Does this necessary mean the user is not signed in ? 
      throw new BadRequestHttpError(`Could not find an account matching the given cookie (${cssAccountCookie}).`);
    }


    const accountLinks = await this.webIdStore.findLinks(accountId)

    if (!accountLinks || accountLinks.length < 1 || !accountLinks[0].webId) {
      throw new InternalServerError("No account linked to this accountId. Does this account have a webId?")
    }
    if (accountLinks.length > 1) {
      throw new InternalServerError("With the current implementation, your CSS account should have one and only one WebId")
    }

    const webId = accountLinks[0].webId

    // TODO get name, email etc from profile
    // import { ResourceStore }from  '@solid/community-server'
    // import { RepresentationMetadata }from  '@solid/community-server'
    // import { DataFactory }from  'n3'
    // import { namedNode }from  DataFactory;

    // async function getResource(internalUrl, resourceStore) {
    // const metadata = new RepresentationMetadata(namedNode(internalUrl));
    // const representation = await resourceStore.getRepresentation({ path: internalUrl }, { type: { 'text/turtle': 1 } }, metadata);
    // const data = representation.data;
    // }
    const accounts = {
      accounts: [
        {
          id: accountId,
          name: '...',
          given_name: '...',
          // email: 'a@a.a', 
          email: webId, // giving the webId instead of an email
          picture: 'https://doodleipsum.com/150x150/avatar-2?i=f7de8aff0b8c3f4bc758e106d80d071e',
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

  private async getCode(req: string, webId: string, provider: Provider): Promise<string> {

    // const req = await readableToString(request)


    // TODO
    const client_id = new URLSearchParams(req).get('client_id') || ''
    const params_raw = new URLSearchParams(req).get('params') || undefined
    const params = params_raw ? JSON.parse(params_raw) : {}



    // 2. Determine the client (e.g., if client_id is known for this FedCM context)
    const client = await provider.Client.find(client_id);
    if (!client) {
      // TODO
      return ''
    }

    // 3. Ensure a grant exists for this client (create one if needed, to attach scopes)
    // let grantId = session.grantIdFor(client.clientId);
    let grantId
    let grant
    if (!grantId) {
      // grantId = session.ensureGrant(client.clientId);  // pseudo-method: create new grantId and link to session
      // Optionally, use provider.Grant to persist allowed scopes for this grant
      // accountId in CSS != accountId for oidc-provider, oidc-provider uses webId as accountId
      grant = new provider.Grant({ clientId: client.clientId, accountId: webId });
      grant.addOIDCScope('openid profile offline_access webid');
      grantId = await grant.save();
      // (The library auto-saves the grant when issuing tokens if not done explicitly)
    }
    // grantId = session.grantIdFor(client.clientId)

    if (!client.redirectUris || client.redirectUris.length < 1) {
      // TODO
      return ''
    }

    // 4. Create an AuthorizationCode instance with necessary details
    const AuthorizationCode = provider.AuthorizationCode;  // class access
    const code = new AuthorizationCode({
      accountId: webId,
      client,
      redirectUri: client.redirectUris[0],      // or a specific one intended for this flow
      // scope: 'openid profile offline_access webid',  // TODO scopes to allow; make sure these were consented
      scope: 'webid openid profile offline_access',
      grantId: grantId,
      gty: 'authorization_code', // TODO
      // If PKCE is required by this client or desired, you would include codeChallenge fields:
      codeChallenge: params.code_challenge,
      codeChallengeMethod: params.code_challenge_method,
      resource: 'solid', // required to return an access token in a JWT format
      // Other fields like acr, amr, authTime, nonce can be set if applicable:
      // acr: session.acr, amr: session.amr, authTime: session.authTime,
      // nonce: (if this code is intended for an OpenID ID Token and nonce was provided by RP)
    });
    // 5. Save the code to generate the value
    const codeValue = await code.save();

    // 6. Respond to FedCM request with the code (e.g., as JSON)
    return codeValue

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

    const req = await readableToString(request)
    // TODO
    const client_id = new URLSearchParams(req).get('client_id') || ''
    const params_raw = new URLSearchParams(req).get('params') || undefined
    const params = params_raw ? JSON.parse(params_raw) : {}
    const provider = await this.providerFactory.getProvider()

    if (!params.state) {
      throw new BadRequestHttpError("missing `state` value from params.")
    }

    if (!client_id) {
      const error_msg = 'client_id missing from the request\'s body.'
      this.logger.info(error_msg)
      throw new BadRequestHttpError(error_msg)
    }

    const cookies = parse(request.headers.cookie || '')

    if (!('css-account' in cookies)) {
      const error_msg = 'No CSS cookie found in the request header.'
      this.logger.info(error_msg)
      throw new BadRequestHttpError(error_msg)
    }

    const cssAccountCookie = cookies['css-account']

    const accountId = await this.cookieStore.get(cssAccountCookie)
    const reqAccountId = new URLSearchParams(req).get('account_id')

    if (!accountId) {
      const error_msg = 'no account id find with the given cookie'
      this.logger.info(error_msg)
      throw new BadRequestHttpError(error_msg)
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
    const client = await provider.Client.find(client_id)
    const allowed_uris = client?.redirectUris?.map(url => this.removeLastTraillingSlash(url))

    // TODO: SECURITY: is this enough checks ? 
    // does it have implication if a user alter a redirect_uri, or the origin of the request ? 

    if (!allowed_uris) {
      throw new InternalServerError("Client doesn't have redirectUris")
    }
    if (!request.headers.origin) {
      throw new BadRequestHttpError("No origin found in the request's header")
    }
    if (!allowed_uris) {
      throw new InternalServerError("Client doesn't have redirectUris")
    }

    if (!request.headers.origin) {
      throw new BadRequestHttpError("No origin found in the request's header")
    }
    // ----- PICK-WEBID -----
    const accountLinks = await this.webIdStore.findLinks(accountId)
    const webId = accountLinks[0].webId || '' // TODO multi webId account

    const code = await this.getCode(req, webId, provider)

    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ 'token': code, }))
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
