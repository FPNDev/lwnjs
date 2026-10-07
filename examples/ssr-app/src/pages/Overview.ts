import { component } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { useServer } from 'lwn-js/ssr';
import { UserData } from '../data';
import classes from '../styles/ui.module.scss';

/** Index route of the account layout. Reads the layout's data: loaders of the whole chain feed `useServer`. */
export const Overview = component(() => {
  const user = useServer(UserData);

  return {
    node: html`
      <div>
        <h1 class=${classes.title}>Hi, ${user.name}</h1>
        <p class=${classes.muted}>
          Signed in as ${user.email}. This page is rendered per request (SSR).
        </p>
      </div>
    `,
  };
});
