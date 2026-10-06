import { attach, component, env, listen } from 'engine-ts/core';
import { html } from 'engine-ts/html';
import { isolateOnFocus } from '../lib/focus-env';
import classes from './NewTodoForm.module.scss';

/**
 * The new-todo input. Owns its shortcut: <kbd>n</kbd> focuses it when nobody
 * is typing (every focused input isolates an env), <kbd>Esc</kbd> leaves it.
 */
export const NewTodoForm = component(
  (parent: object, onAdd: (title: string) => void) => {
    const input = html<HTMLInputElement>`
      <input placeholder="What needs doing? [n]" aria-label="New todo" />
    `;
    const node = html`<form class=${classes.form}>
      ${input}<button>Add</button>
    </form>`;
    attach(parent, node);

    listen(node, 'submit', (event) => {
      event.preventDefault();
      const title = input.value.trim();
      if (title) {
        input.value = '';
        input.blur();
        
        onAdd(title);
      }
    });

    isolateOnFocus(input, Symbol('new todo'));

    listen(document, 'keydown', (event) => {
      if (
        event.code === 'KeyN' &&
        env.current === undefined &&
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

    return node;
  },
);
