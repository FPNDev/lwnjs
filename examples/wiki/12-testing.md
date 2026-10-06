# 12. Testing

LWN code is plain functions over plain objects, so it tests well with any runner. These examples use Vitest with happy-dom for client code and the Node environment for server code.

## Setup

```sh
npm install -D vitest happy-dom
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'happy-dom' } });
```

Server tests opt into Node per file with `// @vitest-environment node` on the first line, so browser globals can't hide server bugs.

Call `setRenderer(domRenderer)` once (in a `beforeEach` or a setup file).

## Components

```ts
import { destroy, domRenderer, setRenderer } from 'lwnjs/core';
import { NewTodoForm } from '../src/components/NewTodoForm';

beforeEach(() => setRenderer(domRenderer));

it('reports trimmed titles and clears the input', () => {
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

- **The parent can be a plain object.** You don't need a container unless the component mounts into one.
- **`destroy(owner)` releases everything the component set up**, including listeners on `document` or `window`. Do it at the end of each test.
- **Components that read stores** need a provider above them:

```ts
const root = {};
const todos = attachStore(root, TodosStore);
const sidebar = Sidebar(root);
todos.addList('Groceries');
expect(sidebar.querySelectorAll('li')).toHaveLength(1);
```

## Stores

Store values are plain objects; test them without a UI:

```ts
const root = {};
const todos = attachStore(root, TodosStore);
const list = todos.addList('Work');
todos.addTodo(list.id, 'Write tests');
expect(todos.find(list.id)!.todos).toHaveLength(1);
```

Clear `localStorage` (or whatever a store persists to) in `beforeEach`.

## Ownership and cleanup

```ts
it('stops listening when destroyed', () => {
  const ping = createEmitter();
  const seen = vi.fn();
  const owner = {};
  ping.subscribe(owner, seen);
  destroy(owner);
  ping.emit();
  expect(seen).not.toHaveBeenCalled();
});
```

## Routing

Use `memoryHistory` to drive a router without a browser:

```ts
const router = setupRouter(routes, { history: memoryHistory('/') });
const shown = vi.fn();
router.route({}, ProductRoute, shown);

await router.go('/products/slides');
expect(shown).toHaveBeenCalledTimes(1);
expect(router.getParams()?.groups?.handle).toBe('slides');
```

- `router.go` resolves after the actions and the promises they return.
- `router.match(path)` checks matching (and guards) without navigating.

## Outlets and lazy pages

```ts
const owner = document.createElement('div');
const outlet = createOutlet(owner);
await outlet.show(() => import('../src/pages/Product'));
expect(owner.querySelector('h1')).not.toBeNull();
```

The first dynamic import under a test runner can take a few hundred milliseconds (transform). Await the `show` promise rather than a fixed timeout.

## Envs

```ts
const id = Symbol('input');
env.isolate(id);
document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }));
expect(shortcutRan).toBe(false);
env.release(id);
```

`env` is module-level: release what you isolate, or tests leak into each other.

## Server rendering

```ts
// @vitest-environment node
import { createServer, memoryCache } from 'lwnjs/server';

const server = createServer({
  template,
  router,
  routes,
  serverRoutes,
  app: App,
  cache: memoryCache(),
});

it('renders the product page', async () => {
  const response = (await server.handle(
    new Request('http://localhost/products/slides'),
  ))!;
  expect(response.status).toBe(200);
  expect(await response.text()).toContain('<h1');
  expect(response.headers.get('x-engine-cache')).toBe('MISS');
});
```

- **Stub loaders' network calls** (mock `fetch`, or inject the data source) to keep tests fast and deterministic.
- **ISR:** use fake timers for `Date` (`vi.useFakeTimers({ toFake: ['Date'] })`) and `vi.setSystemTime` to make pages stale.
- **SSG output:** `server.build({ outDir: tmp })`, then read the files.

## Hydration

Hydration tests run the server render and the client in one process (happy-dom environment):

```ts
const page = await (await server.handle(
  new Request('http://localhost/products/slides'),
))!.text();
document.body.replaceWith(
  document.importNode(
    new DOMParser().parseFromString(page, 'text/html').body,
    true,
  ),
);

const container = document.querySelector('#app')!;
const serverHeading = container.querySelector('h1');
await hydrate(container, App, router);

expect(container.querySelector('h1')).toBe(serverHeading); // adopted, not rebuilt
expect(document.querySelector('#__engine')).toBeNull(); // payload consumed
```

To test client navigation after hydration, stub `fetch` so `/…/__data.json` goes to `server.handle`, and everything else to the real fetch (or to your mocks).
