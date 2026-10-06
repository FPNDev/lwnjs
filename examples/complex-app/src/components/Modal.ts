import { attach, destroy, env, listen, onDestroy } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import classes from './Modal.module.scss';

export type Modal = {
  /** The modal's logical node: own its listeners with it. */
  node: HTMLElement;
  /** Put the dialog's content here. */
  body: HTMLElement;
  /** The modal's env: inputs inside isolate within it. */
  env: symbol;
  close(): void;
};

/**
 * A portal, for free: the modal is a logical child of `owner` but mounted at
 * the end of `<body>`. When the owner is destroyed (you navigate away, a chat
 * closes), the modal goes with it. No portal API, no cleanup code.
 */
export function openModal(owner: object, title: string): Modal {
  const id = Symbol(title);
  const body = html`<div class=${classes.body}></div>`;
  const close = html`<button class=${classes.close} aria-label="Close">
    ✕
  </button>`;
  const node = html`
    <div class=${classes.backdrop}>
      <div
        class=${classes.dialog}
        role="dialog"
        aria-modal="true"
        aria-label=${title}
      >
        <header class=${classes.header}>
          <h2>${title}</h2>
          ${close}
        </header>
        ${body}
      </div>
    </div>
  `;
  attach(owner, node);
  document.body.append(node);

  env.isolate(id);
  onDestroy(node, () => {
    env.release(id);
  });

  // `is`, not `isCurrent`: Escape closes the modal even while an input inside it has focus.
  listen(node, document, 'keydown', (event) => {
    if (event.key === 'Escape' && env.is(id)) {
      destroy(node);
    }
  });
  listen(node, node, 'mousedown', (event) => {
    if (event.target === node) {
      destroy(node);
    }
  });
  listen(node, close, 'click', () => {
    destroy(node);
  });

  return {
    node,
    body,
    env: id,
    close: () => {
      destroy(node);
    },
  };
}
