import { component, listen } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { countOpen, type TodoList } from '../store/todos';
import classes from './TodoFooter.module.scss';

export type TodoFooter = {
  node: HTMLElement;
  update(list: TodoList): void;
};

export const TodoFooter = component((onClearDone: () => void): TodoFooter => {
  const left = html`<span></span>`;
  const clearDone = html<HTMLButtonElement>`<button>Clear done</button>`;

  listen(clearDone, 'click', onClearDone);

  return {
    node: html` <footer class=${classes.footer}>${left}${clearDone}</footer> `,
    update(list) {
      const open = countOpen(list);
      left.textContent = `${open} ${open === 1 ? 'item' : 'items'} left`;
      clearDone.disabled = open === list.todos.length;
    },
  };
});
