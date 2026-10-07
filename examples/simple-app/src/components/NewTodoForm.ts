import { component, env, listen } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { isolateOnFocus } from '../lib/focus-env';
import classes from './NewTodoForm.module.scss';

/** Adds todos and handles the input's keyboard shortcuts. */
export const NewTodoForm = component((onAdd: (title: string) => void) => {
  const input = html<HTMLInputElement>`
    <input placeholder="What needs doing? [n]" aria-label="New todo" />
  `;
  const node = html`<form class=${classes.form}>
    ${input}<button>Add</button>
  </form>`;
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

  return { node };
});
