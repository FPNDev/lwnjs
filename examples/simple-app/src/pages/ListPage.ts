import { component, useStore } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { ListHeader } from '../components/ListHeader';
import { NewTodoForm } from '../components/NewTodoForm';
import { TodoFilters, type Filter } from '../components/TodoFilters';
import { TodoFooter } from '../components/TodoFooter';
import { TodoItems } from '../components/TodoItems';
import { ListRoute, currentListId, router } from '../router';
import { TodosStore } from '../store/todos';
import classes from './Page.module.scss';

const ListPage = component(() => {
  const todos = useStore(TodosStore);

  let listId = '';
  let shownId = '';
  let filter: Filter = 'all';

  const header = ListHeader(() => {
    todos.removeList(listId);
    void router.go('/');
  });
  const form = NewTodoForm((title) => {
    todos.addTodo(listId, title);
  });
  const filters = TodoFilters((next) => {
    filter = next;
    render();
  });
  const items = TodoItems({
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
  const footer = TodoFooter(() => {
    todos.clearDone(listId);
  });

  function render() {
    const list = todos.find(listId);
    if (!list) {
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

  return {
    node: html`
      <section class=${classes.page}>
        ${header}${form}${filters}${items}${footer}
      </section>
    `,
  };
});

export default ListPage;
