# 09. Explore the example apps

The examples grow from one counter to a server-rendered shop. Read them in order if you are learning the engine, or use the sections below to jump to a specific design question.

## hello-world: one component and local state

Start here when you want to see a minimal engine-ts app.

- The app sets domRenderer before mounting.
- Counter is a component function with an attached root node.
- A local variable holds the count.
- listen owns button and window listeners.
- html builds nodes from templates.

Open [the hello-world README](../hello-world/README.md) and then its source. Try adding a reset button or a disabled state.

## simple-app: shared state and keyed views

This todo app shows when state and stores become useful.

- TodosStore owns the data and actions.
- App provides the store to descendants.
- Sidebar and ListPage subscribe independently.
- TodoItems keeps one row view per todo identifier.
- The outlet loads ListPage lazily and retains it as the selected list changes.
- The focus helper gives inputs temporary keyboard ownership.

The `createKeyedList` helper lives in `simple-app/src/components/KeyedList.ts`. It is example code, not an engine API. The example keeps it to show how views can be reused by stable key. Ordinary add and delete flows can stay simpler: components report `onAdd` or `onDelete`, and the store owns the mutation.

Read [the simple-app README](../simple-app/README.md). A useful exercise is to trace one toggle from the button callback to the store mutation, notification, and row update.

## complex-app: moving ownership

The chat app shows features that need more than ordinary page composition.

- A peer connection is a logical node even though it has no view.
- A modal is logically owned by its caller but mounted under document.body.
- A live conversation moves between the page and a dock.
- onAttach re-reads placement context after a move.
- Store and emitter values expose app services to independent components.

Read [the complex-app README](../complex-app/README.md). Follow the dock's adopt and take methods to see how the logical parent changes while the conversation view stays alive.

## ssr-app: server data and hydration

The shop example combines routes, nested layouts, lazy pages, and server rendering.

- Home uses SSG, public product pages use ISR, and account pages use SSR.
- Server routes load typed data through tokens.
- A layout and its child page can load data in parallel.
- The browser hydrates views and fetches page data before later route actions.
- The cart remains client-only and begins with matching server and browser markup.

Read [the ssr-app README](../ssr-app/README.md). Start with its routes and data modules, then follow one product from server loader to useServer and hydration.

## Where to continue

Use the Learn pages to understand the concepts in isolation. Use the reference pages when checking exact signatures, default behaviors, or limits.
