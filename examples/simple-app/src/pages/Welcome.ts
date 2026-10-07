import { component } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import classes from './Page.module.scss';

export const Welcome = component(() => ({
  node: html`
    <section class=${classes.page}>
      <h1 class=${classes.title}>Todos</h1>
      <p class=${classes.hint}>Create a list in the sidebar to get started.</p>
      <p class=${classes.hint}><kbd>k</kbd> jumps to the new list field.</p>
      <p class=${classes.hint}>
        Inside a list, <kbd>n</kbd> jumps to the new-todo field, a double click
        renames a todo, and <kbd>Esc</kbd> cancels.
      </p>
    </section>
  `,
}));
