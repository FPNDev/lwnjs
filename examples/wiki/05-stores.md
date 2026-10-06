# 5. Stores

A store is a value a node provides to its logical descendants, like dependency injection scoped by the logical tree. Stores are how components share state, services and actions without passing them through every function.

## Defining a store

```ts
import { createState, createStore } from 'lwnjs/core';

function createTodos() {
  const all: TodoList[] = load();
  const lists = createState(all);
  lists.subscribe((value) => save(value)); // persistence, owned by the provider

  return {
    lists,
    find: (id: string) => all.find((list) => list.id === id),
    addTodo(listId: string, title: string) {
      all
        .find((list) => list.id === listId)!
        .todos.push({ id: crypto.randomUUID(), title, done: false });
      lists.notify();
    },
    // …more actions
  };
}

export type Todos = ReturnType<typeof createTodos>;
export const TodosStore = createStore(createTodos);
```

- `createStore(init)` returns an identifier. `init` runs once per provider and returns the value.
- The value is a plain object: put states, emitters, plain functions (actions) and data in it.
- Actions mutate and `notify()`. Components call actions; they don't reach into the data.

## Providing and using

```ts
// The provider: usually a root or layout component
const App = component((parent: object) => {
  const node = html`<div class="app"></div>`;
  attach(parent, node);
  const todos = attachStore(TodosStore); // runs init, provides on `node`
  // …
});

// Any logical descendant
const Sidebar = component((parent: object) => {
  const node = html`<aside></aside>`;
  attach(parent, node);
  const todos = useStore(TodosStore); // nearest provider up the logical tree
  todos.lists.subscribe(render);
  // …
});
```

- `attachStore(Store)` / `attachStore(node, Store)` creates a fresh value on the node and returns it.
- `useStore(Store)` / `useStore(node, Store)` walks up logical parents from the node and returns the nearest provided value. That's O(depth), and runs once per component setup.
- `useStore` throws `no ancestor provides this store` when nothing up the tree provides it. Usually that means the component wasn't attached yet; attach first.

## Resolution follows the logical tree

Stores resolve through **logical** parents, not DOM parents. A modal mounted in `<body>` but owned by a page sees the page's stores. A page loaded by an outlet sees the stores of the outlet's owner.

Several nodes can provide the same store; descendants get the nearest one:

```ts
// The chat page and the floating dock each provide a placement.
attachStore(PlacementStore).kind = 'page';
attachStore(PlacementStore).kind = 'dock';

// A conversation reads whichever is above it, and re-reads after it moves.
onAttach(() => header.place(useStore(node, PlacementStore)));
```

## Kinds of stores

**Domain stores:** data plus actions (`TodosStore`, `CartStore`). Provide them at the highest component that needs them.

**Service stores:** non-visual services, such as a chat connection manager, an API client or a cache. They often hold emitters (`messageAdded`) and states (`presence`) and own logical nodes of their own (connections).

**UI stores:** app-wide UI services (`toasts.show(text)`, a dock, a modal host), filled by the root component right after attaching:

```ts
const ui = attachStore(UiStore); // createStore(() => ({}) as Ui)
ui.toasts = Toasts(node);
ui.dock = Dock(node);
```

**Context stores:** small values describing _where_ something is (`PlacementStore`, a theme), provided by layouts.

## Stores that need async initialization

Store `init` is synchronous. If the value needs async work (opening IndexedDB, loading an identity), do it before mounting and let `init` return the result:

```ts
let started: Chat | undefined;

export async function startChat() {
  const db = await openDb();
  started = createChat(db, await loadIdentity(db));
}
export const ChatStore = createStore(() => started!);

// main.ts
await startChat();
container.append(App(container));
```

Every component can then read the store synchronously during setup.

## Stores and moving components

A component that moves between parents (see [Components](03-components.md)) should resolve parent-dependent stores in `onAttach`, from its own node:

```ts
onAttach(() => {
  const placement = useStore(node, PlacementStore);
});
```

Stores provided by an ancestor common to both places (an app-wide store) can be resolved once during setup.

## Stores and server rendering

Stores are created per provider. On the server, a fresh app root is built per request, so each request gets fresh stores. Client-only data (localStorage, IndexedDB) must not be read on the server: guard with `isServer` and start empty there (see `ssr-app/src/cart.ts`).

## Guidelines

- One store per concern; don't build one global store for everything.
- Expose actions, not setters for raw data. `todos.toggleTodo(listId, id)` beats `todos.lists.get()[i].todos[j].done = …` scattered across components.
- Read the store once during setup and keep the reference (`const todos = useStore(TodosStore)`).
- Store values are plain objects: test them without any UI (see [Testing](12-testing.md)).
