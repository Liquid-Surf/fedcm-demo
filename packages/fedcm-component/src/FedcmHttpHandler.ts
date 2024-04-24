import type { ProviderFactory } from '@solid/community-server';
import { AccountStore } from '@solid/community-server';
import { BaseClientCredentialsStore, ClientCredentialsStore, RequestParser } from '@solid/community-server';
import { CookieStore } from '@solid/community-server';
import { HttpHandler } from '@solid/community-server';
import type { HttpHandlerInput } from '@solid/community-server';
import { WebIdStore } from '@solid/community-server';
import { createDpopHeader, generateDpopKeyPair } from '@inrupt/solid-client-authn-core';
import { getLoggerFor } from '@solid/community-server';
import { parse } from 'cookie'
import { readableToString } from '@solid/community-server';






async function get_client_id_secret(authorization: string, webId: string, baseUrl: string) {

  // Now that we are logged in, we need to request the updated controls from the server.
  // These will now have more values than in the previous example.
  const indexResponse = await fetch(`${baseUrl}.account/`, {
    headers: { authorization: `CSS-Account-Token ${authorization}` }
  });
  let { controls } = await indexResponse.json();

  // Here we request the server to generate a token on our account
  const response = await fetch(controls.account.clientCredentials, {
    method: 'POST',
    headers: { authorization: `CSS-Account-Token ${authorization}`, 'content-type': 'application/json' },
    // The name field will be used when generating the ID of your token.
    // The WebID field determines which WebID you will identify as when using the token.
    // Only WebIDs linked to your account can be used.
    body: JSON.stringify({ name: 'my-token', webId: webId }),
  });

  // TODO: why can I remove the token on my account page and still be able to fetch /profile/
  // TODO: should I remove the token ?

  // These are the identifier and secret of your token.
  // Store the secret somewhere safe as there is no way to request it again from the server!
  // The `resource` value can be used to delete the token at a later point in time.
  const { id, secret, resource } = await response.json();
  console.log('id, sec')
  console.log({ id, secret, resource })
  return { id, secret, resource }
}


async function get_token(id: string, secret: string, dpopHeader: string, baseUrl: string) {
  // A key pair is needed for encryption.
  // This function from `solid-client-authn` generates such a pair for you.
  const dpopKey = await generateDpopKeyPair();

  // These are the ID and secret generated in the previous step.
  // Both the ID and the secret need to be form-encoded.
  const authString = `${encodeURIComponent(id)}:${encodeURIComponent(secret)}`;
  // This URL can be found by looking at the "token_endpoint" field at
  // http://localhost:3000/.well-known/openid-configuration
  // if your server is hosted at http://localhost:3000/.
  const tokenUrl = `${baseUrl}.oidc/token`;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      // The header needs to be in base64 encoding.
      authorization: `Basic ${Buffer.from(authString).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
      dpop: dpopHeader, // TODO
    },
    body: 'grant_type=client_credentials&scope=webid',
  });

  // This is the Access token that will be used to do an authenticated request to the server.
  // The JSON also contains an "expires_in" field in seconds,
  // which you can use to know when you need request a new Access token.
  const resp = await response.json();
  console.log(resp)
  return resp
}





/**
 * HTTP handler that handle all FedCM requests.
 */
export class FedcmHttpHandler extends HttpHandler {
  protected readonly logger = getLoggerFor(this);

  private readonly baseUrl: string;
  private readonly accountStore: AccountStore;
  private readonly cookieStore: CookieStore;
  private readonly webIdStore: WebIdStore;
  private readonly clientCredentialsStore: ClientCredentialsStore;
  private readonly providerFactory: ProviderFactory;
  private readonly requestParser: RequestParser;

  public constructor(
    baseUrl: string,
    accountStore: AccountStore,
    cookieStore: CookieStore,
    webIdStore: WebIdStore,
    providerFactory: ProviderFactory,
    requestParser: RequestParser,
    clientCredentialsStore: ClientCredentialsStore
  ) {
    super();
    this.baseUrl = baseUrl.slice(-1) === '/'
      ? baseUrl
      : `${baseUrl}/`; // TODO check if CSS does it automatically     
    this.accountStore = accountStore
    this.cookieStore = cookieStore
    this.webIdStore = webIdStore
    this.providerFactory = providerFactory
    this.requestParser = requestParser
    this.clientCredentialsStore = clientCredentialsStore
  }

  public async handle({ request, response }: HttpHandlerInput): Promise<void> {

    if (request.headers['sec-fetch-dest'] !== 'webidentity') {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'Bad Request: Missing or incorrect Sec-Fetch-Dest header'}));
      return;
    }

    if (request.url?.startsWith('/.well-known/web-identity')) {
      await this.handleWebIdentity({ request, response });
    } else if (request.url?.startsWith('/.well-known/fedcm/fedcm.json')) {
      await this.handleFedcmJSON({ request, response });
    } else if (request.url?.startsWith('/.well-known/fedcm/accounts_endpoint')) {
      await this.handleAccountsEnpoint({ request, response });
    } else if (request.url?.startsWith('/.wxell-known/fedcm/client_metadata_endpoint')) {
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
      "accounts_endpoint": "/.well-known/fedcm/accounts_endpoint",
      "client_metadata_endpoint": "/.well-known/fedcm/client_metadata_endpoint",
      "id_assertion_endpoint": "/.well-known/fedcm/token",
      "disconnect_endpoint": "/.well-known/fedcm/disconnect",
      "revocation_endpoint": ".oidc/token/revocation",
      "login_url": "/.account/login/password/",
      "branding": {
        "background_color": "rgb(255, 055, 255)",
        "color": "0xffffff",
        "context": `Sign in to CSS`,
        "icons": [
          {
            "url": `${this.baseUrl}.well-known/css/images/solid.png`,
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

    if (request.headers['sec-fetch-dest'] !== 'webidentity') {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end('Bad Request: Missing or incorrect Sec-Fetch-Dest header');
      return;
    }

    const cookies = parse(request.headers.cookie || '')

    const empty_accounts = { accounts: [] };
    if (! ('css-account' in cookies)) {
      response.writeHead(400, { 'Content-Type': 'text/plain' });
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
          // approved_clients: [] // Optional, I don't think we need it
        }
      ]
    }
    response.writeHead(200, { 'Content-Type': 'application/json' })

    response.end(JSON.stringify(accounts))

  }


  private async handleClientMetadataEndpoint({ request, response }: HttpHandlerInput): Promise<void> {
    // 3.4
    // https://fedidcg.github.io/FedCM/#idp-api-client-id-metadata-endpoint
    
    // This one is optional
    if (request.headers['sec-fetch-dest'] !== 'webidentity') {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end('Bad Request: Missing or incorrect Sec-Fetch-Dest header');
      return;
    }

    const metadata = {
      privacy_policy_url: '...',
      terms_of_service_url: '...'
    };
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(metadata));
  }

  private async handleToken({ request, response }: HttpHandlerInput): Promise<void> {
    // 3.5
    // https://fedidcg.github.io/FedCM/#idp-api-id-assertion-endpoint

    // Upon receiving the request, the server should:
    // 1. Verify that the request contains a Sec-Fetch-Dest: webidentity HTTP header.
    // 2. TODO Match the Origin header against the RP origin determine by the client_id. Reject if they don't match.
        // We do not use client id, should we force the client to call /.oidc/reg first ?
        // Then we need to check here if the given client id matches with the
        // TODO Need to make a DCR in the client, and here verify the client_id
    // 3. Match account_id against the ID of the already signed-in account. Reject if they don't match.
    // 4. Respond with a token. If the request is rejected, respond with an error response.
    // How the token is issued is up to the IdP, but in general, it's signed with information 
    //such as the account ID, client ID, issuer origin, nonce, so that the RP can verify the token is genuine.

    const r = await readableToString(request)
    const client_id = new URLSearchParams(r).get('client_id') || ''
    const nonce = new URLSearchParams(r).get('nonce') || undefined

    if (!nonce) {
      const error_msg = 'Nonce missing. To make FedCM work with Solid-OIDC, you need to pass the DPoP Header through the nonce value in the request.'
      this.logger.info(error_msg)
      response.writeHead(400, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ 'error': error_msg }))
      return
    }

    const dpopHeader = nonce // This is a hack since FedCM doesn't support DPoP Header, 
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
    this.logger.info(">>>>>> COOOKIE ")
    this.logger.info(cssAccountCookie)
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

    if ( accountId !== reqAccountId) {
      const error_msg = 'The account_id from the request\'s body doesn\'t match the account_id binded to the session cookie.'
      this.logger.info(error_msg)
      response.writeHead(400, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ 'error': error_msg }))
      return
    }


    const provider = await this.providerFactory.getProvider()
    const registered_client = await provider.Client.find(client_id)

    if ( !registered_client || registered_client.redirectUris?.[0] !== request.headers.origin) {
      const error_msg = 'The origin of the request doesn\'t match the redirect uri given during client registration.'
      this.logger.info(error_msg)
      response.writeHead(400, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ 'error': error_msg }))
      return
    }

    const accountLinks = await this.webIdStore.findLinks(accountId)
    const webId = accountLinks[0].webId // TODO: handle mutiple webId

    const client = await this.clientCredentialsStore.findByAccount(accountId)

    // TODO re-use previous token instead of creating a new
    const { id, secret, resource } = await get_client_id_secret(cssAccountCookie, webId, this.baseUrl)
    const { access_token: accessToken } = await get_token(id, secret, dpopHeader, this.baseUrl)


    this.logger.info(">>>>>> accoutn id, webid , id , secret, access token")
    this.logger.info(accountId)
    this.logger.info(webId)
    this.logger.info(id)
    this.logger.info(secret)
    this.logger.info(JSON.stringify(accessToken))

    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ 'token': accessToken }))
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
    response.end(JSON.stringify({error: "TODO"}));
  }


}



