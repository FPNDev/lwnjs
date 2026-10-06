import { attach } from 'engine-ts/core';
import { html } from 'engine-ts/html';
import classes from './Page.module.scss';

export function Welcome(parent: object) {
  const node = html`
    <section class=${classes.page}>
      <h1 class=${classes.title}>Todos</h1>
      <p class=${classes.hint}>Create a list in the sidebar to get started.</p>
      <p class=${classes.hint}>
        <kbd>k</kbd> jumps to the new list field.
      </p>
      <p class=${classes.hint}>
        Inside a list, <kbd>n</kbd> jumps to the new-todo field, a double click
        renames a todo, and <kbd>Esc</kbd> cancels.
      </p>
    </section>
  `;
  attach(parent, node);

  return node;
}
