import { attach, component, listen, useStore } from 'lwnjs/core';
import { html } from 'lwnjs/html';
import { isServer } from 'lwnjs/ssr';
import { CartStore } from '../cart';
import { routerLink } from '../routes';
import classes from '../styles/ui.module.scss';
import { CartDrawer } from './CartDrawer';

const NavItems = [
  ['/search', 'Search'],
  ['/account', 'Account'],
] as const;

export const Header = component((parent: object) => {
  const count = html`<span>0</span>`;
  const cartButton = html`<button class=${classes.button}>
    Cart (${count})
  </button>`;
  const logo = html<HTMLAnchorElement>`
    <a class=${classes.logo} href="/">engine shop</a>
  `;
  const navLinks = NavItems.map(
    ([link, title]) => html<HTMLAnchorElement>`<a href=${link}>${title}</a>`,
  );

  const node = html`
    <header class=${classes.header}>
      ${logo}
      <nav class=${classes.nav}>${navLinks}</nav>
      ${cartButton}
    </header>
  `;
  attach(parent, node);
  const cart = useStore(CartStore);

  routerLink(logo);
  for (const link of navLinks) {
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
  listen(cartButton, 'click', () => {
    CartDrawer(node);
  });

  return node;
});
