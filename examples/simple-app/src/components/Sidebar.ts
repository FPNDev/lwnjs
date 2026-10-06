import { attach, component, env, listen, useStore } from 'lwnjs/core';
import { html } from 'lwnjs/html';
import {
  HomeRoute,
  ListRoute,
  currentListId,
  listUrl,
  router,
  routerLink,
} from '../router';
import {
  TodosStore,
  countOpen,
  type TodoList,
  type Todos,
} from '../store/todos';
import { createKeyedList } from './KeyedList';
import classes from './Sidebar.module.scss';
import { isolateOnFocus } from '../lib/focus-env';

type ListRow = {
  node: HTMLLIElement;
  update(list: TodoList): void;
};

/** One sidebar entry. It updates itself in place; the sidebar only creates and destroys rows. */
const ListRow = component(
  (parent: object, list: TodoList, todos: Todos): ListRow => {
    const name = html`<span class=${classes.name}></span>`;
    const count = html`<span class=${classes.count}></span>`;

    const link = html<HTMLAnchorElement>`
      <a class=${classes.link} href=${listUrl(list.id)}>${name}${count}</a>
    `;
    const remove = html`
      <button class=${classes.remove} title="Delete list">✕</button>
    `;

    const node = html<HTMLLIElement>`
      <li class=${classes.row}>${link}${remove}</li>
    `;
    attach(parent, node);

    routerLink(link);

    listen(remove, 'click', () => {
      todos.removeList(list.id);
      if (currentListId() === list.id) {
        void router.go('/');
      }
    });

    return {
      node,
      update(next) {
        name.textContent = next.name;
        count.textContent =
          next.todos.length > 0
            ? `${countOpen(next)}/${next.todos.length}`
            : '';
      },
    };
  },
);

export const Sidebar = component((parent: object) => {
  const list = html`<ul class=${classes.lists}></ul>`;
  const empty = html`<p class=${classes.empty}>No lists yet.</p>`;
  const input = html<HTMLInputElement>`
    <input placeholder="New list…" maxlength="40" aria-label="New list name" />
  `;

  const form = html`
    <form class=${classes.form}>${input}<button>Add</button></form>
  `;

  const node = html`
    <aside class=${classes.sidebar}>
      <h2 class=${classes.title}>Lists</h2>
      ${list}${empty}${form}
    </aside>
  `;
  attach(parent, node);

  const todos = useStore(TodosStore);

  const rows = createKeyedList(
    node,
    list,
    (item: TodoList) => item.id,
    (owner, item) => ListRow(owner, item, todos),
  );
  const render = (lists: TodoList[]) => {
    rows.render(lists);
    empty.hidden = lists.length > 0;
  };

  render(todos.lists.get());
  todos.lists.subscribe(render);

  let active: HTMLLIElement | undefined;
  router.routes([HomeRoute, ListRoute], () => {
    active?.classList.remove(classes.active);
    const id = currentListId();
    active = id ? rows.get(id)?.node : undefined;
    active?.classList.add(classes.active);
  });

  const inputFocus = Symbol('new todo list');
  isolateOnFocus(input, inputFocus);

  listen(document, 'keydown', (event) => {
    if (
      event.code === 'KeyK' &&
      (env.current === undefined || env.is(inputFocus)) &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      input.focus();
    }
  });

  listen(input, 'keydown', (event) => {
    if (event.code === 'Escape') {
      input.blur();
    }
  });

  listen(form, 'submit', (event) => {
    event.preventDefault();

    const name = input.value.trim();
    if (!name) {
      return;
    }

    void router.go(listUrl(todos.addList(name).id));

    input.value = '';
    input.blur();
  });

  return node;
});
