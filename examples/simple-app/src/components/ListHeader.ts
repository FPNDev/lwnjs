import { component, listen } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import classes from './ListHeader.module.scss';

export type ListHeader = {
  node: HTMLElement;
  setTitle(title: string): void;
};

/** The list's name and its delete button. */
export const ListHeader = component((onDelete: () => void): ListHeader => {
  const title = html`<h1 class=${classes.title}></h1>`;
  const remove = html`<button class=${classes.delete}>Delete list</button>`;

  listen(remove, 'click', onDelete);

  return {
    node: html`<header class=${classes.header}>${title}${remove}</header>`,
    setTitle(value) {
      title.textContent = value;
    },
  };
});
