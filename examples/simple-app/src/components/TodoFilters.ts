import { component, listen } from 'lwn-js/core';
import { html } from 'lwn-js/html';
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

/** Keeps the selected filter button and reports filter changes. */
export const TodoFilters = component((onChange: (filter: Filter) => void) => {
  const buttons: HTMLButtonElement[] = [];
  let selected: HTMLButtonElement | undefined;
  for (const [filter, label] of Object.entries(labels)) {
    const button = html<HTMLButtonElement>`<button>${label}</button>`;
    buttons.push(button);

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

  return { node: html`<nav class=${classes.filters}>${buttons}</nav>` };
});
