import {
  component,
  destroy,
  env,
  getFrame,
  listen,
  onDestroy,
  useStore,
} from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { CartStore } from '../cart';
import classes from '../styles/ui.module.scss';

/**
 * The cart drawer is mounted in <body> and attached to the header frame.
 * Created on click only, so it never takes part in hydration.
 */
export const CartDrawer = component(() => {
  const frame = getFrame()!;
  const list = html`<div></div>`;
  const close = html`<button class=${`${classes.button} ${classes.ghost}`}>
    Close
  </button>`;
  const drawer = html`<aside class=${classes.drawer}>
    <h2>Cart</h2>
    ${list}${close}
  </aside>`;

  const node = html`<div class=${classes.backdrop}>${drawer}</div>`;
  document.body.append(node);

  const cart = useStore(CartStore);

  const id = Symbol('cart');
  env.isolate(id, env.current);
  onDestroy(() => {
    env.release(id);
  });

  const render = () => {
    list.replaceChildren();
    for (const line of cart.state.get()) {
      const remove = html`<button class=${`${classes.button} ${classes.ghost}`}>
        x
      </button>`;
      // Runs on every cart change, outside setup: the frame is passed explicitly.
      listen(frame, remove, 'click', () => {
        cart.remove(line.handle);
      });
      list.append(
        html`<div class=${classes.line}>
          <img src=${line.image} alt="" /><span
            >${line.title} x ${line.quantity}</span
          >${remove}
        </div>`,
      );
    }
    if (!list.firstChild) {
      list.append(html`<p class=${classes.muted}>Your cart is empty.</p>`);
    }
  };
  render();
  cart.state.subscribe(render);

  listen(close, 'click', () => {
    destroy(frame);
  });
  listen(node, 'mousedown', (event) => {
    if (event.target === node) {
      destroy(frame);
    }
  });
  listen(document, 'keydown', (event) => {
    if (event.key === 'Escape' && env.isCurrent(id)) {
      destroy(frame);
    }
  });

  return { node };
});
