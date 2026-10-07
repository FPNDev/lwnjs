import { component } from 'lwn-js/core';
import { html, mhtml } from 'lwn-js/html';
import type { Todo, TodoList } from '../store/todos';
import { TodoItem, type TodoActions } from './TodoItem';
import { matchesFilter, type Filter } from './TodoFilters';
import { createKeyedList } from './KeyedList';
import classes from './TodoItems.module.scss';

export type TodoItems = {
  nodes: Node[];
  render(list: TodoList, filter: Filter): void;
  clear(): void;
};

/** Reuses todo views by id and hides items excluded by the filter. */
export const TodoItems = component((actions: TodoActions): TodoItems => {
  const list = html`<ul class=${classes.items}></ul>`;
  const empty = html`<p class=${classes.empty}>Nothing here.</p>`;
  const views = createKeyedList(
    list,
    (todo: Todo) => todo.id,
    (todo) => TodoItem(todo, actions),
  );

  return {
    nodes: mhtml`${list}${empty}`,

    render(todoList, filter) {
      let shown = 0;
      views.render(todoList.todos, (view, todo) => {
        view.node.hidden = !matchesFilter[filter](todo);
        if (!view.node.hidden) {
          shown++;
        }
      });
      empty.hidden = shown > 0;
    },

    clear() {
      views.clear();
    },
  };
});
