import {
  attach,
  component,
  destroy,
  getFrame,
  listen,
  onDestroy,
} from 'lwn-js/core';
import { html } from 'lwn-js/html';
import classes from './Toasts.module.scss';

export type Toasts = {
  node: HTMLElement;
  /**
   * Shows a message for a few seconds and attaches it to `frame`, if provided.
   * Destroying that frame also destroys the toast.
   */
  show(text: string, frame?: object): void;
};

export const Toasts = component((): Toasts => {
  const frame = getFrame()!;
  const node = html`<div class=${classes.toasts} aria-live="polite"></div>`;
  document.body.append(node);

  return {
    node,
    show(text, parent = frame) {
      const toast = html`<div class=${classes.toast}>${text}</div>`;
      attach(parent, toast);
      node.append(toast);

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
