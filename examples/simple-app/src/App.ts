import { attachStore, component, listen } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { createOutlet } from 'lwn-js/router';
import classes from './App.module.scss';
import { Sidebar } from './components/Sidebar';
import { Welcome } from './pages/Welcome';
import { FallbackRoute, HomeRoute, ListRoute, router } from './router';
import { STORAGE_KEY, TodosStore } from './store/todos';

export const App = component(() => {
  const todos = attachStore(TodosStore);

  const slot = html`<!---->`;
  const sidebar = Sidebar();
  const main = html`<main class=${classes.main}>${slot}</main>`;

  // The outlet view is a logical child rendered inside main.
  const page = createOutlet(slot);
  router.route(HomeRoute, () => page.show(Welcome));
  router.route(ListRoute, () => page.show(() => import('./pages/ListPage')));
  router.route(FallbackRoute, () => router.go('/'));

  listen(window, 'storage', (event) => {
    if (event.key === STORAGE_KEY) {
      todos.reload();
    }
  });

  return { node: html`<div class=${classes.layout}>${sidebar}${main}</div>` };
});
