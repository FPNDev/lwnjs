import { component } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import classes from '../styles/ui.module.scss';

/** Served with status 404 (see server-routes.ts). */
export const NotFound = component(() => ({
  node: html`
    <div>
      <h1 class=${classes.title}>Not found</h1>
      <p class=${classes.muted}>There is nothing at this address.</p>
    </div>
  `,
}));
