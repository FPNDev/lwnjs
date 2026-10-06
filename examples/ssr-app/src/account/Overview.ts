import { attach } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { useServer } from 'lwn-js/ssr';
import { UserData } from '../data';
import classes from '../styles/ui.module.scss';

/** Index route of the account layout. Reads the layout's data: loaders of the whole chain feed `useServer`. */
export function Overview(parent: object) {
  const user = useServer(UserData);
  const node = html`
    <div>
      <h1 class=${classes.title}>Hi, ${user.name}</h1>
      <p class=${classes.muted}>
        Signed in as ${user.email}. This page is rendered per request (SSR).
      </p>
    </div>
  `;
  attach(parent, node);

  return node;
}
