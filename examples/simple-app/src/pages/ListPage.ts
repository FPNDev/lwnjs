import { attach, useStore } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { ListHeader } from '../components/ListHeader';
import { NewTodoForm } from '../components/NewTodoForm';
import { TodoFilters, type Filter } from '../components/TodoFilters';
import { TodoFooter } from '../components/TodoFooter';
import { TodoItems } from '../components/TodoItems';
import { ListRoute, currentListId, router } from '../router';
import { TodosStore } from '../store/todos';
import classes from './Page.module.scss';

/**
 * A list's todos, loaded lazily by the outlet in App. The page only wires
 * the store and the route to its components. The outlet keeps this page
 * while you switch lists, so it follows the route itself.
 */
export default function ListPage(parent: object) {
  const node = html`<section class=${classes.page}></section>`;
  attach(parent, node);
  const todos = useStore(TodosStore);

  let listId = '';
  let shownId = '';
  let filter: Filter = 'all';

  const header = ListHeader(node, () => {
    todos.removeList(listId);
    void router.go('/');
  });
  const form = NewTodoForm(node, (title) => {
    todos.addTodo(listId, title);
  });
  const filters = TodoFilters(node, (next) => {
    filter = next;
    render();
  });
  const items = TodoItems(node, {
    toggle: (id) => {
      todos.toggleTodo(listId, id);
    },
    rename: (id, title) => {
      todos.renameTodo(listId, id, title);
    },
    remove: (id) => {
      todos.removeTodo(listId, id);
    },
  });
  const footer = TodoFooter(node, () => {
    todos.clearDone(listId);
  });

  node.append(header.node, form, filters, ...items.nodes, footer.node);

  function render() {
    const list = todos.find(listId);
    if (!list) {
      // Deleted, here or in another tab.
      void router.go('/');

      return;
    }

    if (list.id !== shownId) {
      items.clear();
      shownId = list.id;
    }
    header.setTitle(list.name);
    items.render(list, filter);
    footer.update(list);
  }

  router.route(ListRoute, () => {
    listId = currentListId() ?? '';
    render();
  });
  todos.lists.subscribe(render);

  return node;
}
