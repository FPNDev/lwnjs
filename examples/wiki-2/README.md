# LWN

LWN is a performance-focused TypeScript UI engine. Components build their views once. When something changes, your code updates the specific DOM nodes affected by that change. The engine does not rebuild a virtual DOM, diff a view tree, or replay component functions to find the difference.

The hot path stays direct: there is no tree walk for ordinary updates. A lightweight logical ownership structure handles setup and cleanup. It keeps listeners, subscriptions, child components, and other resources tied to the right lifetime.

Your app does not hand the engine a UI tree to traverse. It creates live components and updates the nodes affected by each action. Ownership links are lifecycle bookkeeping.

## Start with Learn

| Page                                                         | What you will learn                                     |
| ------------------------------------------------------------ | ------------------------------------------------------- |
| [01. Start here](learn-01-start-here.md)                     | Install the package and build an interactive component  |
| [02. Components](learn-02-components.md)                     | Build, compose, and control components                  |
| [03. Lifetimes and ownership](learn-03-lifetimes.md)         | Attach, detach, move, and clean up owned work           |
| [04. State and stores](learn-04-state-and-stores.md)         | Share values between components                         |
| [05. Routing and outlets](learn-05-routing-and-outlets.md)   | Match URLs and show pages                               |
| [06. HTML and renderers](learn-06-html-and-renderers.md)     | Build safe DOM templates and connect other view systems |
| [07. Keyboard input and envs](learn-07-keyboard-and-envs.md) | Give inputs, dialogs, and shortcuts clear ownership     |
| [08. Server rendering](learn-08-server-rendering.md)         | Choose SSR, SSG, or ISR and hydrate server HTML         |
| [09. Explore the example apps](learn-09-example-apps.md)     | Follow the concepts in complete examples                |

## API reference

| Page                                                       | What it covers                                             |
| ---------------------------------------------------------- | ---------------------------------------------------------- |
| [Core reference](reference-core.md)                        | Ownership, subscriptions, stores, envs, and listeners      |
| [Router reference](reference-router.md)                    | Route matching, history, actions, and outlets              |
| [HTML and renderer reference](reference-html-renderers.md) | Template values, limits, hydration, and renderer contract  |
| [Server reference](reference-server.md)                    | Server routes, data, caches, rendering, and custom hosting |
| [CLI reference](reference-cli.md)                          | Development, build, and production commands                |
| [Testing reference](reference-testing.md)                  | Test setup and engine-specific patterns                    |
| [Troubleshooting](reference-troubleshooting.md)            | Common errors and where to look                            |

## The mental model

Think about an application as two structures that often overlap:

```text
Logical ownership                         Where views are mounted

App                                        <div id="app">
|- Sidebar                                   <aside>...</aside>
|- Page                                      <main>...</main>
|- Modal                                     <body> ... <div class="modal">
   '- Button
```

The ownership links answer, "When this component ends, what else should end with it?" The DOM answers, "Where is this element displayed?" A modal can be owned by a page while mounted under document.body. A live conversation can move from a page into a dock without being rebuilt. The engine uses ownership for lifetimes and scoped lookup, not to decide which nodes to update after a state change.

A component usually follows four steps:

1. Create a root view.
2. Call attach(parent, root) to connect its lifetime to an owner.
3. Create listeners, subscriptions, child components, and cleanup hooks.
4. Return the view, or a small controller that contains the view.

The engine does not infer your data model. Use a local variable for local data, createState when separate parts of the app need updates, and a store when descendants need a shared value or service.

## Where the work happens

The component setup creates a view and its event handlers. Later, an event or store callback changes the nodes it affects. There is no general render pass that checks every component after each change.

| Operation                      | Work                                                          |
| ------------------------------ | ------------------------------------------------------------- |
| Attach, detach, and move       | O(1), plus any lifecycle hooks that run                       |
| Subscribe and unsubscribe      | O(1)                                                          |
| Check the current isolated env | O(1)                                                          |
| Notify subscribers             | Proportional to the listeners being notified                  |
| Look up a store                | Proportional to the number of ownership links to its provider |
| Destroy an owner               | Proportional to the owned subtree being cleaned up            |

The performance model is selective work, not a claim that every operation is constant time. A store lookup follows ownership links, and destruction visits the resources that must end. Ordinary view updates are code you write against the particular nodes that changed.

## Package entry points

| Import       | Use                                                           |
| ------------ | ------------------------------------------------------------- |
| lwn-js/core   | Ownership, state, stores, envs, listeners, and renderer setup |
| lwn-js/router | Routes, history, and outlets                                  |
| lwn-js/html   | HTML templates and typed node creation                        |
| lwn-js/ssr    | Client-safe hydration and page-data helpers                   |
| lwn-js/server | Node server rendering and caches                              |
| lwn          | Command-line interface                                        |

## Example apps

The examples live beside this wiki in the examples directory.

- hello-world starts with a counter and local state.
- simple-app adds stores, keyed todo rows, routes, and keyboard shortcuts.
- complex-app demonstrates modals, portals, moving live components, and service objects.
- ssr-app demonstrates server data, layouts, SSG, ISR, SSR, and hydration.

Use the examples to see whole-app structure. Use the reference pages for exact API behavior.
