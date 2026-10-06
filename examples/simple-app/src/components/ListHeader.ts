import { attach, component, listen } from 'lwnjs/core';
import { html } from 'lwnjs/html';
import classes from './ListHeader.module.scss';

export type ListHeader = {
  node: HTMLElement;
  setTitle(title: string): void;
};

/** The list's name and its delete button. */
export const ListHeader = component(
  (parent: object, onDelete: () => void): ListHeader => {
    const title = html`<h1 class=${classes.title}></h1>`;
    const remove = html`<button class=${classes.delete}>Delete list</button>`;

    const node = html`<header class=${classes.header}>
      ${title}${remove}
    </header>`;
    attach(parent, node);

    listen(remove, 'click', onDelete);

    return {
      node,
      setTitle(value) {
        title.textContent = value;
      },
    };
  },
);
