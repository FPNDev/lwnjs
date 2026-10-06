import { attach, component, listen } from 'lwnjs/core';
import { html } from 'lwnjs/html';
import type { Todo } from '../store/todos';
import classes from './TodoFilters.module.scss';

export type Filter = 'all' | 'active' | 'done';

const labels: Record<Filter, string> = {
  all: 'All',
  active: 'Active',
  done: 'Done',
};

export const matchesFilter: Record<Filter, (todo: Todo) => boolean> = {
  all: () => true,
  active: (todo) => !todo.done,
  done: (todo) => todo.done,
};

/** All / Active / Done. Keeps the selected button; reports changes. */
export const TodoFilters = component(
  (parent: object, onChange: (filter: Filter) => void) => {
    const node = html`<nav class=${classes.filters}></nav>`;
    attach(parent, node);

    let selected: HTMLButtonElement | undefined;
    for (const [filter, label] of Object.entries(labels)) {
      const button = html<HTMLButtonElement>`<button>${label}</button>`;
      node.append(button);

      listen(button, 'click', () => {
        selected?.classList.remove(classes.selected);
        selected = button;
        button.classList.add(classes.selected);
        onChange(filter as Filter);
      });

      if (filter === 'all') {
        selected = button;
        button.classList.add(classes.selected);
      }
    }

    return node;
  },
);
