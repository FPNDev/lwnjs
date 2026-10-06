import { attach, component, destroy, listen, onDestroy } from 'lwnjs/core';
import { html } from 'lwnjs/html';
import classes from './Toasts.module.scss';

export type Toasts = {
  /**
   * Shows a message for a few seconds. With an `owner`, the toast is its
   * logical child: if the owner goes away first, so does the toast.
   */
  show(text: string, owner?: object): void;
};

export const Toasts = component((parent: object): Toasts => {
  const host = html`<div class=${classes.toasts} aria-live="polite"></div>`;
  attach(parent, host);
  document.body.append(host);

  return {
    show(text, owner = host) {
      const toast = html`<div class=${classes.toast}>${text}</div>`;
      attach(owner, toast);
      host.append(toast);

      const timer = setTimeout(() => {
        destroy(toast);
      }, 4000);
      onDestroy(toast, () => {
        clearTimeout(timer);
      });
      listen(toast, toast, 'click', () => {
        destroy(toast);
      });
    },
  };
});
