# engine-ts wiki

engine-ts is a small UI engine built around a **logical tree**. You write components as plain functions that build their views imperatively and attach them to a parent. The tree, not a framework runtime, decides when things live and die: subscriptions, event listeners, route listeners, stores, timers and child components are all released when their owner is destroyed.

There is no virtual DOM, no diffing, no compiler, no reactivity graph. A component runs once, sets things up, and from then on you change exactly the nodes that need changing.

## The mental model in one picture

```
logical tree (who owns whom)                 DOM tree (where things are mounted)

App ─┬─ Sidebar ─┬─ ListRow (a)               <div.layout>
     │           └─ ListRow (b)                 ├─ <aside> Sidebar, rows
     ├─ ListPage ─┬─ TodoItem                   ├─ <main> ListPage, items
     │            └─ TodoItem                   └─ <body> … <div.modal>  ← mounted elsewhere,
     └─ Modal                                                              owned by App
```

- Each box on the left is a **logical node**: any object, usually the component's root element.
- `attach(parent, child)` adds an edge; `destroy(node)` removes a node and everything below it, views included.
- Where a view sits in the DOM is your business. The two trees often match, but they don't have to (portals, docks, overlays).

## Principles

- **Less is more, and less is faster.** Use the smallest tool that works. A `let` and a setter beat a state primitive when only one component reads the value.
- **Imperative, not reactive.** You change the DOM yourself, exactly where it changes. Nothing re-runs that didn't need to.
- **Mutate in place.** Change objects and arrays directly; call `state.notify()` to tell observers. No copies, no spread-to-update.
- **Trust the developer.** The engine doesn't check whether a value "really" changed, whether you called something twice, or whether your data is valid. What you do is valid.
- **O(1) where it matters.** Attach, detach, move, subscribe, unsubscribe and env checks are constant time. Destroy is linear in the subtree and makes one live DOM mutation.
- **Pay for what you import.** One package with separate entry points, no runtime dependencies; `linkedom` (server DOM) and `vite` (CLI) are optional peers.

## Contents

| # | Page | What it covers |
|---|---|---|
| 1 | [Getting started](01-getting-started.md) | Install, a client-only app, a server-rendered app, project layout |
| 2 | [The logical tree](02-logical-tree.md) | `attach`, `detach`, `destroy`, ordering, moving, ownership rules |
| 3 | [Components](03-components.md) | The component pattern, `component()`, implicit owners, controllers, composition, portals, lists, reattachable components |
| 4 | [State and events](04-state-and-events.md) | Plain variables, `createState`, `createEmitter`, `notify`, delivery rules, owned vs unowned subscriptions |
| 5 | [Stores](05-stores.md) | `createStore`, `attachStore`, `useStore`, scoping, services, async-initialized stores |
| 6 | [Isolated envs](06-envs.md) | Keyboard ownership, `env.isolate`, `is`, `isCurrent`, nesting, focus, modals, shortcuts |
| 7 | [Routing](07-routing.md) | Routes, matching, params, guards, nested and index routes, aliases, the router API, history |
| 8 | [Outlets and layouts](08-outlets-and-layouts.md) | `createOutlet`, lazy pages, keeping pages across params, layouts with their own outlet |
| 9 | [HTML templates](09-html-templates.md) | `html`, `mhtml`, `element`, `text`, value rules, typing, caching, limits |
| 10 | [Renderers](10-renderers.md) | The renderer contract, `domRenderer`, writing your own (canvas, three.js) |
| 11 | [Server rendering](11-server-rendering.md) | SSR, SSG, ISR, server data, hydration, caching, the CLI, custom hosting |
| 12 | [Testing](12-testing.md) | Components, routes, stores and server rendering under test |
| 13 | [Best practices](13-best-practices.md) | Structure, performance, patterns that scale |
| 14 | [API reference](14-api-reference.md) | Every export, with signatures and semantics |
| 15 | [Troubleshooting and FAQ](15-troubleshooting.md) | Every error message explained, common questions |

## Entry points

| Import | Contains |
|---|---|
| `engine-ts/core` | the logical tree, lifecycle hooks, `component`, `createState`, `createEmitter`, stores, `env`, `listen`, renderers |
| `engine-ts/router` | `setupRouter`, routes, history adapters, `createOutlet`, `aliasRoute` |
| `engine-ts/html` | `html`, `mhtml`, `element`, `text` |
| `engine-ts/ssr` | client side of server rendering: `serverToken`, `useServer`, `hydrate`, `loadServerData`, `isServer` |
| `engine-ts/server` | Node only: `defineServerApp`, `createServer`, `fsCache`, `memoryCache`, `toNodeHandler` |
| `engine-ts` (CLI) | `engine-ts dev`, `engine-ts build`, `engine-ts start` |

Bundlers include only what you import. A bundle that uses `createState` alone is about 1.5 kB minified.

## Example apps

These live next to this wiki and are referenced throughout:
- `hello-world`: one component.
- `simple-app`: todo lists with stores, keyed lists, envs and a lazy page.
- `complex-app`: a peer-to-peer encrypted chat with portals, moving live components, envs and logical nodes that aren't views.
- `ssr-app`: a shop with SSG, ISR, SSR, layouts and hydration.
