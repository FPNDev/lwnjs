import { attach } from 'lwnjs/core';
import { html } from 'lwnjs/html';
import classes from '../styles/ui.module.scss';

/** Served with status 404 (see server-routes.ts). */
export function NotFound(parent: object) {
  const node = html`<div><h1 class=${classes.title}>Not found</h1><p class=${classes.muted}>There is nothing at this address.</p></div>`;
  attach(parent, node);

  return node;
}
