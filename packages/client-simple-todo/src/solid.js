import { Session as InruptSession } from '@inrupt/solid-client-authn-browser';
import { getAllTodos, createTodo, updateTodo, deleteTodo } from './solid-todo.js';

console.log(" ----  PAGE IS RELOADED ---- ")
// Initialize Inrupt session
const session = new InruptSession();

// Demo configuration constant
const CSS_URL = import.meta.env.VITE_CSS_URL || 'http://localhost:3000/';

const loginLink = document.getElementById('login_link');
const loginPage = document.getElementById('login_page')
const loggedPage = document.getElementById('logged_page')
const userHeader = document.getElementById('user_header')
const loginButton = document.getElementById("startInruptLogin")

// Todo UI elements
const todoList = document.getElementById('todo_list');
const addTodoForm = document.getElementById('add_todo_form');
const todoInput = document.getElementById('todo_input');
const loadingIndicator = document.getElementById('loading_indicator');
const errorContainer = document.getElementById('error_container');

// Set initial values in the UI
// resourceInput.value = `${CSS_URL}alice/profile/`;
// cssUrlInput.value = CSS_URL;

// TODO: fetch URL dynamically instead of hardcoded
// accountLink.href = `${CSS_URL}.account/`;
// registerLink.href = `${CSS_URL}.account/login/password/register/`;
loginLink.href = `${CSS_URL}.account/login/password/`;




const forgeRedirectUrl = (code, state, provider_url) => {
  return `${window.location.href}?code=${code}&state=${state}&iss=${encodeURIComponent(provider_url)}`
}


/**
 * Initiate Inrupt login using Fedcm if the user is not already logged in.
 * @param {string} cssUrl - The CSS base URL.
 * @param {object} session - The Inrupt session object.
 */
async function inruptLoginWithFedcm(cssUrl, session) {
  const clientId = `${window.location.href}clientid`
  if (!session.info.isLoggedIn) {
    await session.login({
      oidcIssuer: cssUrl,
      clientName: "Solid Demo App",
      prompt: "consent",
      clientId,
      // this has nothing to do with handleRedirectIncoming
      // here we override the default redirect behaviour
      handleRedirect: async (url) => triggerFedcmLoginAndHandleResponse(url, cssUrl)
    });
  }
}


/**
 * Trigger FedCM login process using parameters from the redirect URL.
 * @param {string} url - The redirect URL containing FedCM parameters, returned by CSS FedCMHandler
 */
const triggerFedcmLoginAndHandleResponse = async (url, provider_url) => {
  try {
    // parsing the params ( code_challenge, state etc.. ) from the URL 
    // given by inrupt login function
    console.log("Handling redirect URL:", url);
    const urlObj = new URL(url);
    const params = Object.fromEntries(urlObj.searchParams.entries());
    console.log("Parsed parameters:", params);

    // Start FedCM login with the extracted parameters
    const fedcm_response = await navigatorApiCallWrapper(params);
    const authorization_code = fedcm_response.token
    console.log("Received token:", authorization_code);

    // Handle the incoming redirect with the returned token
    const redirectUrl = forgeRedirectUrl(authorization_code, params.state, provider_url)
    console.log("forged redirect Url: ", redirectUrl)
    await session.handleIncomingRedirect(redirectUrl);

    if (session.info.isLoggedIn) {
      console.log("Session info:", session.info);
      handleLogin()
      // put in the resourceFetcher a resource that is private by default ( profile/ )
      
    } else {
      console.log("User is not logged according to `session.ino`");
    }
  } catch (err) {
    console.log("Error during FedCM login:", err);
  }
};

/**
 * Start FedCM login by calling the navigator.credentials API.
 * @param {object} params - Parameters extracted from the URL, with the client_id , the code_challenge* and the state
 * @returns {Promise<object>} - The token returned by the credentials API.
 */
async function navigatorApiCallWrapper(params) {
  console.log("Starting FedCM login...");
  const identityRegistered = {
    providers: [
      {
        configURL: `any`, // Trigger the registered IdP API 
        clientId: params.client_id,
        registered: true,
        params: {
          code_challenge: params.code_challenge,
          code_challenge_method: params.code_challenge_method,
          state: params.state
        }
      }
    ]
  };

  console.log("Requesting credentials via navigator API...");
  try {
    const token = await navigator.credentials.get({
      identity: identityRegistered
    });
    console.log("Navigator returned token:", token);
    return token;
  } catch (error) {
    console.log("Error calling navigator.credentials.get:", error);
    return;
  }
}

function showError(message) {
  errorContainer.innerHTML = `<div class="error">${message}</div>`;
  setTimeout(() => {
    errorContainer.innerHTML = '';
  }, 5000);
}

function renderTodo(todo) {
  const li = document.createElement('li');
  if (todo.done) {
    li.classList.add('done');
  }
  li.dataset.todoId = todo.id;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = todo.done;
  checkbox.addEventListener('change', () => handleToggleTodo(todo.id, checkbox.checked));

  const text = document.createElement('span');
  text.classList.add('todo-text');
  text.textContent = todo.description;

  const deleteBtn = document.createElement('button');
  deleteBtn.classList.add('todo-delete');
  deleteBtn.textContent = '×';
  deleteBtn.title = 'Delete todo';
  deleteBtn.addEventListener('click', () => handleDeleteTodo(todo.id));

  li.appendChild(checkbox);
  li.appendChild(text);
  li.appendChild(deleteBtn);

  return li;
}

async function loadTodos() {
  if (!session.info.isLoggedIn) return;

  loadingIndicator.style.display = 'block';
  todoList.innerHTML = '';

  try {
    const todos = await getAllTodos(session.info.webId, session.fetch);
    loadingIndicator.style.display = 'none';

    if (todos.length === 0) {
      todoList.innerHTML = '<li style="color: var(--pico-muted-color); text-align: center;">No todos yet. Add one above!</li>';
    } else {
      todos.forEach(todo => {
        todoList.appendChild(renderTodo(todo));
      });
    }
  } catch (error) {
    loadingIndicator.style.display = 'none';
    console.error('Error loading todos:', error);
    showError('Failed to load todos. Please try again.');
  }
}

async function handleAddTodo(description) {
  if (!session.info.isLoggedIn) return;

  try {
    const newTodo = await createTodo(session.info.webId, session.fetch, description);
    // Remove the "no todos" message if present
    const emptyMessage = todoList.querySelector('li[style]');
    if (emptyMessage) {
      emptyMessage.remove();
    }
    todoList.appendChild(renderTodo(newTodo));
    todoInput.value = '';
  } catch (error) {
    console.error('Error creating todo:', error);
    showError('Failed to create todo. Please try again.');
  }
}

async function handleToggleTodo(todoId, done) {
  if (!session.info.isLoggedIn) return;

  try {
    await updateTodo(session.info.webId, session.fetch, todoId, done);
    const li = todoList.querySelector(`[data-todo-id="${CSS.escape(todoId)}"]`);
    if (li) {
      if (done) {
        li.classList.add('done');
      } else {
        li.classList.remove('done');
      }
    }
  } catch (error) {
    console.error('Error updating todo:', error);
    showError('Failed to update todo. Please try again.');
    // Reload todos to get correct state
    loadTodos();
  }
}

async function handleDeleteTodo(todoId) {
  if (!session.info.isLoggedIn) return;

  try {
    await deleteTodo(session.info.webId, session.fetch, todoId);
    const li = todoList.querySelector(`[data-todo-id="${CSS.escape(todoId)}"]`);
    if (li) {
      li.remove();
    }
    // Check if list is empty
    if (todoList.children.length === 0) {
      todoList.innerHTML = '<li style="color: var(--pico-muted-color); text-align: center;">No todos yet. Add one above!</li>';
    }
  } catch (error) {
    console.error('Error deleting todo:', error);
    showError('Failed to delete todo. Please try again.');
  }
}

async function handleLogin() {
  loggedPage.style.visibility = "";
  userHeader.style.visibility = "";
  loginPage.style.visibility = "hidden";
  loginPage.style.display = "none";

  // Update welcome message with user's WebID
  const welcomeSpan = userHeader.querySelector('span');
  if (welcomeSpan && session.info.webId) {
    const webIdUrl = new URL(session.info.webId);
    welcomeSpan.textContent = `Welcome, ${webIdUrl.pathname.split('/')[1] || 'User'}`;
  }

  // Load todos from the pod
  await loadTodos();
}

// Form submission handler
addTodoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const description = todoInput.value.trim();
  if (description) {
    await handleAddTodo(description);
  }
});

function handleCodeInUrl() {
  const url = new URL(window.location.href);
  if (url.searchParams.has('code')) {
    handleLogin();
    url.searchParams.delete('code');
    window.history.replaceState({}, '', url.toString());
  }
}

handleCodeInUrl();

// Binding the buttons to their respective functions
loginButton.addEventListener('click', () =>
  inruptLoginWithFedcm(CSS_URL, session)
);

const disconnectButton = document.getElementById('disconnectButton');
disconnectButton.addEventListener('click', () => {
  window.location.reload();
});

  // Uncomment below if you want to handle incoming redirects automatically on page load.
  // (async () => {
  //   await session.handleIncomingRedirect();
  // })();
