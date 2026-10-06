import { attach, component, destroy, env, listen, onDestroy, useStore } from 'engine-ts/core';
import { html } from 'engine-ts/html';
import { CartStore } from '../cart';
import classes from '../styles/ui.module.scss';

/**
 * The cart, as a drawer mounted in <body> but owned by `owner` (the header).
 * Created on click only, so it never takes part in hydration.
 */
export const CartDrawer = component((owner: object) => {
  const list = html`<div></div>`;
  const close = html`<button class=${`${classes.button} ${classes.ghost}`}>Close</button>`;
  const drawer = html`<aside class=${classes.drawer}><h2>Cart</h2>${list}${close}</aside>`;
  const node = html`<div class=${classes.backdrop}>${drawer}</div>`;
  attach(owner, node);
  document.body.append(node);
  const cart = useStore(CartStore);

  const id = Symbol('cart');
  env.isolate(id);
  onDestroy(() =>{  env.release(id); });

  const render = () => {
    list.replaceChildren();
    for (const line of cart.state.get()) {
      const remove = html`<button class=${`${classes.button} ${classes.ghost}`}>✕</button>`;
      // Runs on every cart change, outside setup: the owner is passed explicitly.
      listen(node, remove, 'click', () =>{  cart.remove(line.handle); });
      list.append(html`<div class=${classes.line}><img src=${line.image} alt="" /><span>${line.title} × ${line.quantity}</span>${remove}</div>`);
    }
    if (!list.firstChild) {
      list.append(html`<p class=${classes.muted}>Your cart is empty.</p>`);
    }
  };
  render();
  cart.state.subscribe(render);

  listen(close, 'click', () =>{  destroy(node); });
  listen(node, 'mousedown', (event) => {
    if (event.target === node) {
      destroy(node);
    }
  });
  listen(document, 'keydown', (event) => {
    if (event.key === 'Escape' && env.isCurrent(id)) {
      destroy(node);
    }
  });
});
