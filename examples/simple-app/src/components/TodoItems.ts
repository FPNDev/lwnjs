import { attach, component } from 'engine-ts/core';
import { html, mhtml } from 'engine-ts/html';
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

/**
 * Todo views are reused by id through the example-local KeyedList helper.
 * Filtering only toggles `hidden`.
 */
export const TodoItems = component((parent: object, actions: TodoActions): TodoItems => {
  const list = html`<ul class=${classes.items}></ul>`;
  const empty = html`<p class=${classes.empty}>Nothing here.</p>`;
  attach(parent, list);

  const views = createKeyedList(
    list,
    list,
    (todo: Todo) => todo.id,
    (owner, todo) => TodoItem(owner, todo, actions),
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
