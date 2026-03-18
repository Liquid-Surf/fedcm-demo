import {
  getSolidDataset,
  createSolidDataset,
  saveSolidDatasetAt,
  getThing,
  getThingAll,
  createThing,
  setThing,
  removeThing,
  getStringNoLocale,
  getBoolean,
  setStringNoLocale,
  setBoolean,
  getUrl,
  setUrl,
} from "@inrupt/solid-client";

const TODO_TYPE = "http://schema.org/Action";
const TODO_DESCRIPTION = "http://schema.org/description";
const TODO_COMPLETED = "http://schema.org/actionStatus";
const TODO_LIST = "http://schema.org/ItemList";

const FILE_NAME = "fedcm-simple-todo-example.ttl";


function getTodoDocumentUrl(webId) {
  const url = new URL(webId);
  const pathParts = url.pathname.split('/').filter(Boolean);
  // The first path segment is typically the username/pod name
  const podRoot = url.origin + "/" + pathParts[0] + "/"; // -> return https://pod.com/alice/
  return podRoot + FILE_NAME;
}


async function getOrCreateTodoDataset(webId, fetch) {
  const todoUrl = getTodoDocumentUrl(webId);

  try {
    const dataset = await getSolidDataset(todoUrl, { fetch });
    return dataset;
  } catch (error) {
    if (error.statusCode === 404 || error.response?.status === 404) {
      // Create a new dataset if it doesn't exist
      const newDataset = createSolidDataset();
      const savedDataset = await saveSolidDatasetAt(todoUrl, newDataset, { fetch });
      return savedDataset;
    }
    throw error;
  }
}


export async function getAllTodos(webId, fetch) {
  const dataset = await getOrCreateTodoDataset(webId, fetch);
  const things = getThingAll(dataset);

  const todos = things
    .filter((thing) => getUrl(thing, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type") === TODO_TYPE)
    .map((thing) => ({
      id: thing.url,
      description: getStringNoLocale(thing, TODO_DESCRIPTION) || "",
      done: getBoolean(thing, TODO_COMPLETED) ?? false,
    }));

  return todos;
}


export async function createTodo(webId, fetch, description) {
  const todoUrl = getTodoDocumentUrl(webId);
  let dataset = await getOrCreateTodoDataset(webId, fetch);

  // Generate a unique ID for the todo
  const todoId = `#todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  let newTodo = createThing({ url: todoUrl + todoId });
  newTodo = setUrl(newTodo, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", TODO_TYPE);
  newTodo = setStringNoLocale(newTodo, TODO_DESCRIPTION, description);
  newTodo = setBoolean(newTodo, TODO_COMPLETED, false);

  dataset = setThing(dataset, newTodo);
  await saveSolidDatasetAt(todoUrl, dataset, { fetch });

  return {
    id: todoUrl + todoId,
    description,
    done: false,
  };
}

 
export async function updateTodo(webId, fetch, todoId, done) {
  const todoUrl = getTodoDocumentUrl(webId);
  let dataset = await getOrCreateTodoDataset(webId, fetch);

  let todo = getThing(dataset, todoId);
  if (!todo) {
    throw new Error(`Todo not found: ${todoId}`);
  }

  todo = setBoolean(todo, TODO_COMPLETED, done);
  dataset = setThing(dataset, todo);
  await saveSolidDatasetAt(todoUrl, dataset, { fetch });

  return {
    id: todoId,
    description: getStringNoLocale(todo, TODO_DESCRIPTION) || "",
    done,
  };
}


export async function deleteTodo(webId, fetch, todoId) {
  const todoUrl = getTodoDocumentUrl(webId);
  let dataset = await getOrCreateTodoDataset(webId, fetch);

  const todo = getThing(dataset, todoId);
  if (!todo) {
    throw new Error(`Todo not found: ${todoId}`);
  }

  dataset = removeThing(dataset, todo);
  await saveSolidDatasetAt(todoUrl, dataset, { fetch });
}


export async function updateTodoDescription(webId, fetch, todoId, description) {
  const todoUrl = getTodoDocumentUrl(webId);
  let dataset = await getOrCreateTodoDataset(webId, fetch);

  let todo = getThing(dataset, todoId);
  if (!todo) {
    throw new Error(`Todo not found: ${todoId}`);
  }

  todo = setStringNoLocale(todo, TODO_DESCRIPTION, description);
  dataset = setThing(dataset, todo);
  await saveSolidDatasetAt(todoUrl, dataset, { fetch });

  return {
    id: todoId,
    description,
    done: getBoolean(todo, TODO_COMPLETED) ?? false,
  };
}
