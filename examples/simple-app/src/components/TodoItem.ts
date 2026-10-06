import { attach, component, listen } from 'engine-ts/core';
import { html } from 'engine-ts/html';
import { isolateOnFocus } from '../lib/focus-env';
import type { Todo } from '../store/todos';
import classes from './TodoItem.module.scss';

export type TodoActions = {
  toggle(id: string): void;
  rename(id: string, title: string): void;
  remove(id: string): void;
};

export type TodoItem = {
  node: HTMLLIElement;
  update(todo: Todo): void;
};

export const TodoItem = component(
  (parent: object, todo: Todo, actions: TodoActions): TodoItem => {
    const check = html<HTMLInputElement>`
      <input type="checkbox" class=${classes.check} aria-label="Done" />
    `;
    const title = html`<span class=${classes.title}></span>`;
    const remove = html`
      <button class=${classes.remove} title="Delete">✕</button>
    `;

    const node = html<HTMLLIElement>`
      <li class=${classes.item}>${check}${title}${remove}</li>
    `;
    attach(parent, node);

    // Local UI state: only this item reads it, so plain variables are enough.
    let current = todo;

    const editor = html<HTMLInputElement>`
      <input class=${classes.edit} aria-label="Todo title" />
    `;
    // Focus in the editor makes it the current env, so page shortcuts stay quiet while typing
    isolateOnFocus(editor, Symbol('edit todo'));

    const startEditing = () => {
      editor.value = current.title;
      title.replaceWith(editor);
      editor.focus();
      editor.select();
    };

    const stopEditing = (save: boolean) => {
      if (!editor.isConnected) {
        return;
      }

      const value = editor.value.trim();
      editor.replaceWith(title);
      if (save && value && value !== current.title) {
        actions.rename(current.id, value);
      }
    };

    listen(check, 'change', () => {
      actions.toggle(current.id);
    });
    listen(remove, 'click', () => {
      actions.remove(current.id);
    });

    listen(title, 'dblclick', startEditing);

    listen(editor, 'keydown', (event) => {
      if (event.key === 'Enter') {
        stopEditing(true);
      } else if (event.key === 'Escape') {
        stopEditing(false);
      }
    });

    listen(editor, 'blur', () => {
      stopEditing(true);
    });

    const update = (next: Todo) => {
      current = next;
      title.textContent = next.title;
      check.checked = next.done;
      node.classList.toggle(classes.done, next.done);
    };
    return { node, update };
  },
);
