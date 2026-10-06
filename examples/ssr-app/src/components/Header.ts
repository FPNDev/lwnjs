import { attach, component, listen, useStore } from 'engine-ts/core';
import { html } from 'engine-ts/html';
import { isServer } from 'engine-ts/ssr';
import { CartStore } from '../cart';
import { routerLink } from '../routes';
import classes from '../styles/ui.module.scss';
import { CartDrawer } from './CartDrawer';

export const Header = component((parent: object) => {
  const count = html`<span>0</span>`;
  const cartButton = html`<button class=${classes.button}>Cart (${count})</button>`;
  const node = html`
    <header class=${classes.header}>
      <a class=${classes.logo} href="/">engine shop</a>
      <nav class=${classes.nav}>
        <a href="/search">Search</a>
        <a href="/account">Account</a>
      </nav>
      ${cartButton}
    </header>
  `;
  attach(parent, node);
  const cart = useStore(CartStore);

  for (const link of node.querySelectorAll('a')) {
    routerLink(link);
  }

  // The server renders 0; the browser shows the stored cart. Text only, so hydration is unaffected.
  const showCount = () => {
    count.textContent = String(cart.count());
  };
  if (!isServer) {
    showCount();
  }
  cart.state.subscribe(showCount);
  listen(cartButton, 'click', () =>{  CartDrawer(node); });

  return node;
});
