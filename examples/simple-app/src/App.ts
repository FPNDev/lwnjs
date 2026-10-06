import { attach, attachStore, component, listen } from 'engine-ts/core';
import { html } from 'engine-ts/html';
import { createOutlet } from 'engine-ts/router';
import classes from './App.module.scss';
import { Sidebar } from './components/Sidebar';
import { Welcome } from './pages/Welcome';
import { FallbackRoute, HomeRoute, ListRoute, router } from './router';
import { STORAGE_KEY, TodosStore } from './store/todos';

export const App = component((parent: object) => {
  const node = html`<div class=${classes.layout}></div>`;
  attach(parent, node);
  // Every component below finds the lists with `useStore(TodosStore)`.
  const todos = attachStore(TodosStore);

  const slot = html`<!---->`;
  const main = html`<main class=${classes.main}>${slot}</main>`;
  node.append(Sidebar(node), main);

  // Pages are logical children of `node` but mounted inside `main`:
  // the logical tree and the DOM tree do not have to match.
  const page = createOutlet(node, slot);
  router.route(HomeRoute, () => page.show(Welcome));
  router.route(ListRoute, () => page.show(() => import('./pages/ListPage')));
  router.route(FallbackRoute, () => router.go('/'));

  // Another tab changed the lists: pick them up.
  listen(window, 'storage', (event) => {
    if (event.key === STORAGE_KEY) {
      todos.reload();
    }
  });

  return node;
});
