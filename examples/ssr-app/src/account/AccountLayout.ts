import { attach, listen } from 'lwnjs/core';
import { html } from 'lwnjs/html';
import { createOutlet } from 'lwnjs/router';
import { useServer } from 'lwnjs/ssr';
import { UserData } from '../data';
import { OrdersRoute, OverviewRoute, router, routerLink } from '../routes';
import classes from '../styles/ui.module.scss';
import { Overview } from './Overview';

/**
 * A layout with its own outlet. App shows this for every /account/* URL; the
 * layout decides what goes into its slot through its own routes. Moving
 * between /account and /account/orders keeps the layout (same factory in
 * App's outlet) and only swaps the inner page. Both are SSR: they depend on
 * the signed-in user.
 */
export default function AccountLayout(parent: object) {
  const user = useServer(UserData);
  const overview = html<HTMLAnchorElement>`<a href="/account">Overview</a>`;
  const orders = html<HTMLAnchorElement>`<a href="/account/orders">Orders</a>`;
  const switchUser = html`<button class=${`${classes.button} ${classes.ghost}`}>
    Switch user
  </button>`;
  const slot = html<Comment>`<!---->`;
  const node = html`
    <div class=${classes.account}>
      <nav class=${classes.accountNav}>
        <img src=${user.image} alt="" width="64" height="64" />
        <strong>${user.name}</strong>
        ${overview}${orders}${switchUser}
      </nav>
      <section>${slot}</section>
    </div>
  `;
  attach(parent, node);
  routerLink(overview);
  routerLink(orders);

  // The layout's own outlet: inner pages are its logical children, mounted in its <section>.
  const page = createOutlet(node, slot);
  router.route(OverviewRoute, () => {
    overview.classList.add(classes.active);
    orders.classList.remove(classes.active);

    return page.show(Overview);
  });
  router.route(OrdersRoute, () => {
    orders.classList.add(classes.active);
    overview.classList.remove(classes.active);

    return page.show(() => import('./Orders'));
  });

  // SSR in action: a different cookie, a different page from the server.
  listen(switchUser, 'click', () => {
    const next =
      (Number(/(?:^|;\s*)user=(\d+)/u.exec(document.cookie)?.[1] ?? 1) % 5) + 1;
    document.cookie = `user=${next}; path=/`;
    location.reload();
  });

  return node;
}
