import {
  destroy,
  env,
  listen,
  onDestroy,
  requireFrame,
} from 'lwn-js/core';
import { html } from 'lwn-js/html';
import classes from './Modal.module.scss';

export type Modal = {
  /** The modal's rendered root. Destroy its component frame with `close()`. */
  node: HTMLElement;
  /** Put the dialog's content here. */
  body: HTMLElement;
  /** The modal's env: inputs inside isolate within it. */
  env: symbol;
  close(): void;
};

/**
 * A portal, for free: the modal is a logical child of the current component but mounted at
 * the end of `<body>`. When the component frame is destroyed (you navigate away, a chat
 * closes), the modal goes with it. No portal API, no cleanup code.
 */
export function openModal(title: string): Modal {
  const frame = requireFrame();
  const id = Symbol(title);
  const body = html`<div class=${classes.body}></div>`;
  const close = html`<button class=${classes.close} aria-label="Close">
    x
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

  env.isolate(id, env.current);
  onDestroy(() => {
    env.release(id);
  });

  // `is`, not `isCurrent`: Escape closes the modal even while an input inside it has focus.
  listen(document, 'keydown', (event) => {
    if (event.key === 'Escape' && env.is(id)) {
      destroy(frame);
    }
  });
  listen(node, 'mousedown', (event) => {
    if (event.target === node) {
      destroy(frame);
    }
  });
  listen(close, 'click', () => {
    destroy(frame);
  });

  document.body.append(node);

  return {
    node,
    body,
    env: id,
    close: () => {
      destroy(frame);
    },
  };
}
