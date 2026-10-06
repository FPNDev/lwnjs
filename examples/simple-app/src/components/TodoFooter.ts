import { attach, component, listen } from 'engine-ts/core';
import { html } from 'engine-ts/html';
import { countOpen, type TodoList } from '../store/todos';
import classes from './TodoFooter.module.scss';

export type TodoFooter = {
  node: HTMLElement;
  update(list: TodoList): void;
};

/** "3 items left" and "Clear done". */
export const TodoFooter = component(
  (parent: object, onClearDone: () => void): TodoFooter => {
    const left = html`<span></span>`;
    const clearDone = html<HTMLButtonElement>`<button>Clear done</button>`;

    const node = html`
      <footer class=${classes.footer}>${left}${clearDone}</footer>
    `;
    attach(parent, node);

    listen(clearDone, 'click', onClearDone);

    return {
      node,
      update(list) {
        const open = countOpen(list);
        left.textContent = `${open} ${open === 1 ? 'item' : 'items'} left`;
        clearDone.disabled = open === list.todos.length;
      },
    };
  },
);
