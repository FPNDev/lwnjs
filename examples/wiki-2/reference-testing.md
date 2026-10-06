# Testing reference

The engine APIs are ordinary TypeScript functions, so tests can call components and state directly. DOM tests need a browser-like environment. The examples below use Vitest and happy-dom.

## Configure a DOM environment

```sh
npm install -D vitest happy-dom
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
  },
});
```

Server tests should use Node so browser globals cannot hide server-only behavior. Vitest can select the environment per file:

```ts
// @vitest-environment node
```

Install the DOM renderer before tests that use outlets or destruction to remove DOM views:

```ts
import { beforeEach } from 'vitest';
import { domRenderer, setRenderer } from 'lwn-js/core';

beforeEach(() => {
  setRenderer(domRenderer);
});
```

The renderer is module-level state. Setting it in shared test setup gives each test a known DOM implementation.

## Test a component directly

A component can use a plain object as its owner. It does not need a mounted container unless the component behavior depends on a parent element.

```ts
import { destroy, domRenderer, setRenderer } from 'lwn-js/core';
import { NewTodoForm } from '../src/components/NewTodoForm';

beforeEach(() => {
  setRenderer(domRenderer);
});

it('trims the submitted title and clears the input', () => {
  const owner = {};
  const added: string[] = [];
  const form = NewTodoForm(owner, (title) => added.push(title));
  const input = form.querySelector('input')!;

  input.value = '  milk ';
  form.dispatchEvent(new Event('submit', { cancelable: true }));

  expect(added).toEqual(['milk']);
  expect(input.value).toBe('');
  destroy(owner);
});
```

Call `destroy(owner)` during cleanup. It removes owned listeners and subscriptions, including listeners attached to `document` or `window`. For a test that can throw before its assertions complete, put destruction in an `afterEach` cleanup or a `try/finally` block.

## Test state and stores

State and store logic does not need a DOM.

```ts
const root = {};
const todos = attachStore(root, TodosStore);
const list = todos.addList('Work');

todos.addTodo(list.id, 'Write documentation');

expect(todos.find(list.id)?.todos).toHaveLength(1);
destroy(root);
```

When a component reads a store, provide it above the component before building that component:

```ts
const root = {};
const todos = attachStore(root, TodosStore);
const sidebar = Sidebar(root);

todos.addList('Groceries');

expect(sidebar.querySelectorAll('li')).toHaveLength(1);
destroy(root);
```

Reset browser storage such as `localStorage` between tests when the application persists state there. An in-memory test should not depend on data left by another test.

## Test ownership cleanup

Explicit owners make cleanup easy to assert.

```ts
it('stops notifying an owner after destroy', () => {
  const ping = createEmitter();
  const seen = vi.fn();
  const owner = {};

  ping.subscribe(owner, seen);
  destroy(owner);
  ping.emit();

  expect(seen).not.toHaveBeenCalled();
});
```

Unowned subscriptions created outside a setup frame are not automatically cleaned up. Save and call the unsubscribe function, or subscribe with an explicit owner.

The `env` object is also module-level state. If a test calls `env.isolate(id)`, call `env.release(id)` in cleanup, including on assertion failures.

## Test routing without a browser

Use `memoryHistory` to select the initial URL. Router navigation can then run without `window.history`.

```ts
const router = setupRouter(routes, {
  history: memoryHistory('/'),
});
await router.ready;

const shown = vi.fn();
router.route(owner, ProductRoute, shown);

await router.go('/products/tea');

expect(shown).toHaveBeenCalledTimes(1);
expect(router.getParams()?.groups?.handle).toBe('tea');

router.dispose();
destroy(owner);
```

`router.go` resolves after matching, the load hook, route actions, and promises returned by those actions. `router.match(path)` checks a route without navigating, though it still evaluates guards.

## Test outlets and lazy pages

Outlet changes may be asynchronous when a page is loaded dynamically. Await the returned promise instead of waiting for an arbitrary timer.

```ts
const host = document.createElement('div');
const outlet = createOutlet(host);
await outlet.show(() => import('../src/pages/Product'));

expect(host.querySelector('h1')).not.toBeNull();
destroy(host);
```

The first dynamic import under a test runner may include a transform step, so fixed timeouts are especially unreliable.

## Test server rendering

Use Node for server tests and call the server's request handler directly.

```ts
// @vitest-environment node
import { createServer, memoryCache } from 'lwn-js/server';

const server = createServer({
  template,
  router,
  routes,
  serverRoutes,
  app: App,
  cache: memoryCache(),
});

it('renders a product page', async () => {
  const response = await server.handle(
    new Request('http://localhost/products/tea'),
  );

  expect(response?.status).toBe(200);
  expect(await response?.text()).toContain('<h1');
});
```

Stub or inject network calls in server loaders so the test is fast and deterministic. When testing ISR expiry, use fake timers for the clock and move time past the route's `revalidate` interval.

`server.build({ outDir })` writes prerendered output to a directory. Point it at a temporary directory and inspect the resulting files when the generated static layout is part of the behavior under test.

## Test hydration

A hydration test can render on the server, parse that HTML into the DOM test environment, then run the client app against the same markup.

```ts
const response = await server.handle(
  new Request('http://localhost/products/tea'),
);
const page = await response!.text();
const parsed = new DOMParser().parseFromString(page, 'text/html');
document.body.replaceWith(document.importNode(parsed.body, true));

const container = document.querySelector('#app')!;
const serverHeading = container.querySelector('h1');

await hydrate(container, App, router);

expect(container.querySelector('h1')).toBe(serverHeading);
expect(document.querySelector('#__engine')).toBeNull();
```

Comparing node identity proves that the client adopted the server node instead of replacing it. The payload script is consumed during hydration.

For client navigation after hydration, route the data request for `/path/__data.json` to `server.handle` in the test's `fetch` stub. Keep unrelated requests directed to the original fetch implementation or the test's own mock.
