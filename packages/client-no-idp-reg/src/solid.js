import { Session as InruptSession } from '@inrupt/solid-client-authn-browser';
import { loginWithFedcm } from './fedcm-lib.js';

console.log(" ----  PAGE IS RELOADED ---- ")

// Initialize Inrupt session
const session = new InruptSession();

// Demo configuration constant
const CSS_URL = import.meta.env.VITE_CSS_URL || 'http://localhost:3000/';

// DOM elements
const resourceInput = document.getElementById('resourceInput');
const cssUrlInput = document.getElementById('cssurl');
const accountLink = document.getElementById('accountlink');
const registerLink = document.getElementById('registerlink');
const loginLink = document.getElementById('loginlink');
const loginStatusDiv = document.getElementById('loginstatus');
const resourceContentDiv = document.getElementById('resourceContent');

const fetchResourceButton = document.getElementById("fetchResource")
const loginButton = document.getElementById("startInruptLogin")

// Set initial values in the UI
resourceInput.value = `${CSS_URL}alice/profile/`;
cssUrlInput.value = CSS_URL;
// TODO: fetch URL dynamically instead of hardcoded
accountLink.href = `${CSS_URL}.account/`;
registerLink.href = `${CSS_URL}.account/login/password/register/`;
loginLink.href = `${CSS_URL}.account/login/password/`;

/**
 * Fetch and display a resource.
 */
const fetchResource = async () => {
  console.log("Fetching file using session:", session);
  resourceContentDiv.textContent = "";

  const _fetch = session.info.isLoggedIn ? session.fetch : fetch;
  const resourceUrl =
    resourceInput.value.trim() || resourceInput.placeholder;

  try {
    const response = await _fetch(resourceUrl);

    if (!response.ok) {
      resourceContentDiv.textContent = `Cannot show file: ${response.status} ${response.statusText}`;
      return;
    }

    // Display the text content of the resource
    const text = await response.text();
    resourceContentDiv.textContent = text;
  } catch (err) {
    resourceContentDiv.textContent = `Error fetching file: ${err}`;
  }
};

/**
 * Handle login button click - initiate FedCM login.
 */
const handleLogin = async () => {
  try {
    await loginWithFedcm(session, { clientName: 'Solid Demo App' }, CSS_URL );
    if (session.info.isLoggedIn) {
      console.log("Session info:", session.info);
      resourceInput.value = session.info.webId.replace('card#me', '');
      loginStatusDiv.innerText = `You are logged in with ${session.info.webId}`;
    }
  } catch (err) {
    console.log("Error during FedCM login:", err);
  }
};

// Binding the buttons to their respective functions
fetchResourceButton.addEventListener('click', fetchResource);
loginButton.addEventListener('click', handleLogin);

// Uncomment below if you want to handle incoming redirects automatically on page load.
// (async () => {
//   await session.handleIncomingRedirect();
// })();
