# LWN

[![npm version](https://img.shields.io/npm/v/lwn-js.svg)](https://www.npmjs.com/package/lwn-js)

### Please, note - work in progress

### SSR IS EXTREMELY EARLY ACCESS AND SHOULD BE USED WITH CAUTION - MUCH OF IT WILL BE FULLY REPLACED IN THE NEXT VERSIONS

LWN is a TypeScript UI engine for building component-based interfaces. Components create logical views and frames that define lifetimes for child components, listeners, and subscriptions. A renderer decides how views are placed. The included DOM renderer supports browser interfaces and server rendering.

## Get started

Install the package:

```sh
npm install lwn-js
```

Select the DOM renderer, create a component, and mount its view:

```ts
import {
  component,
  destroy,
  domRenderer,
  listen,
  setRenderer,
} from 'lwn-js/core';
import { html } from 'lwn-js/html';

setRenderer(domRenderer);

const Counter = component(() => {
  let count = 0;
  const output = html`<output>0</output>`;
  const increment = html`<button>Increment</button>`;

  listen(increment, 'click', () => {
    count += 1;
    output.textContent = String(count);
  });

  return {
    node: html`<section>
      <h1>Counter</h1>
      ${output}${increment}
    </section>`,
  };
});

const root = document.querySelector('#app');
if (!root) {
  throw new Error('Missing #app');
}

const counter = Counter();
root.append(counter.node);

export function unmount() {
  destroy(counter);
}
```

The component keeps its private count in a local variable. Its click listener is tied to the component frame and is removed when the component is destroyed.

## Components and frames

Create a component with component(). Each call to its factory creates a new component instance and returns a controller for that instance. A controller describes one rendered root with node or several roots with nodes. Pass the controller to destroy() to remove its views, destroy its logical descendants, and run its cleanup hooks.

Component factories called during another component's setup become its logical children. Use attach(parent, child) and detach(child) when a logical relationship needs to change while both components remain alive. Logical attachment determines lifetime and frame lookup. A renderer or an outlet determines where views appear.

Use onAttach() for work that depends on the current logical parent. The hook runs after attachment and its cleanup runs on detach. This is useful when a component can move between parents and needs to resolve a different store after each move.

A frame is active only during synchronous engine callbacks. Event listeners registered with listen() and subscriptions created during setup are re-entered in their component frame automatically. If external asynchronous code needs to create frame-bound resources, capture getFrame() before starting it and use withFrame(frame, callback) in the callback.

## State and shared services

Keep state local when only one component uses it. Use createState() for a value shared by multiple parts of the interface, and createEmitter() for events. Subscriptions made during component setup are removed when that component is destroyed.

Use a store to provide a service to logical descendants:

```ts
import {
  attachStore,
  component,
  createState,
  createStore,
  useStore,
} from 'lwn-js/core';
import { html } from 'lwn-js/html';

const Theme = createStore(() => createState('slate'));

const Toolbar = component(() => {
  const theme = useStore(Theme);
  return {
    node: html`<button>${theme.get()}</button>`,
  };
});

const App = component(() => {
  attachStore(Theme);
  return { node: html`<main>${Toolbar()}</main>` };
});
```

A store is found by walking the logical parent chain. Components that may move between parents should resolve parent-provided stores after attachment, for example inside onAttach().

## Navigation

Routes match paths and run actions for the active route. An outlet shows one component at a time and destroys the previous view:

```ts
import { component } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { createOutlet, setupRouter } from 'lwn-js/router';

const HomeRoute = { path: '/' };
const SettingsRoute = { path: '/settings' };
const router = setupRouter([HomeRoute, SettingsRoute]);

const Home = component(() => ({
  node: html`<h1>Home</h1>`,
}));

const App = component(() => {
  const slot = html<Comment>`<!---->`;
  const outlet = createOutlet(slot);

  router.route(HomeRoute, () => outlet.show(Home));
  router.route(SettingsRoute, () => outlet.show(() => import('./Settings')));

  return { node: html`<main>${slot}</main>` };
});
```

Route actions registered during component setup follow that component's lifetime. Lazy imports keep a page out of the initial bundle until it is needed.

## Views and renderers

The core works with logical views and a renderer interface. setRenderer() selects the renderer used by outlets and view cleanup. The included domRenderer places DOM views in browser or server documents. Implement the Renderer interface to use another view system.

The lwn-js/html package provides html(), mhtml(), element(), and text(). html() requires exactly one root, while mhtml() returns all roots. Interpolated strings become text, and interpolated views are inserted as views.

## Server rendering and hydration

The lwn-js/ssr and lwn-js/server packages provide server data, server rendering, static generation, incremental regeneration, and hydration. Declare typed data with serverToken(), load it in server routes, and read it synchronously during component setup with useServer().

Hydration expects the client to build the same view structure as the server. Keep browser-only values such as local storage, random IDs, and viewport state out of the initial structure. Apply browser-specific state after hydration. The SSR shop example demonstrates the server and client entry points, route data, caching modes, and hydration.

## Packages

| Import path   | Provides                                                                     |
| ------------- | ---------------------------------------------------------------------------- |
| lwn-js/core   | Components, frames, lifecycle hooks, state, stores, listeners, and renderers |
| lwn-js/router | Routes, history adapters, and outlets                                        |
| lwn-js/html   | HTML templates and view helpers                                              |
| lwn-js/ssr    | Hydration and server data helpers                                            |
| lwn-js/server | Server rendering, static generation, caching, and the Node adapter           |

Core has no runtime dependencies. The server package uses Vite and LinkeDOM as optional peer dependencies.

## Examples

- [hello-world](examples/hello-world/README.md): a counter with button and keyboard input.
- [simple-app](examples/simple-app/README.md): persistent todo lists with routes and shared state.
- [complex-app](examples/complex-app/README.md): a peer-to-peer chat with detachable conversations.
- [ssr-app](examples/ssr-app/README.md): a shop demonstrating server rendering and hydration.

## Development

From the repository root:

```sh
npm install
npm run typecheck
npm run lint
npm test
npm run build
```
