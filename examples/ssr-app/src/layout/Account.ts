import { component, listen } from 'lwn-js/core';
import { html, text } from 'lwn-js/html';
import { createOutlet, lazy } from 'lwn-js/router';
import { useServer } from 'lwn-js/ssr';
import { UserData } from '../data';
import { OrdersRoute, OverviewRoute, router, routerLink } from '../routes';
import classes from '../styles/ui.module.scss';
import { Overview } from '../pages/account/Overview';

const Orders = lazy(() => import('../pages/account/Orders'));

/** Keeps the account shell mounted while its outlet switches between pages. */
const AccountLayout = component(() => {
  const user = useServer(UserData);

  const overview = routerLink(
    html<HTMLAnchorElement>`<a href="/account">Overview</a>`,
  );
  const orders = routerLink(
    html<HTMLAnchorElement>`<a href="/account/orders">Orders</a>`,
  );

  const switchUser = html`<button class=${`${classes.button} ${classes.ghost}`}>
    Switch user
  </button>`;
  const slot = text();

  listen(switchUser, 'click', () => {
    const next =
      (Number(/(?:^|;\s*)user=(\d+)/u.exec(document.cookie)?.[1] ?? 1) % 5) + 1;
    document.cookie = `user=${next}; path=/`;
    void router.reload();
  });

  const page = createOutlet(slot);

  router.route(OverviewRoute, () => {
    overview.classList.add(classes.active);
    orders.classList.remove(classes.active);

    return page.show(Overview);
  });

  router.route(OrdersRoute, () => {
    orders.classList.add(classes.active);
    overview.classList.remove(classes.active);

    return page.show(Orders);
  });

  return {
    node: html`
      <div class=${classes.account}>
        <nav class=${classes.accountNav}>
          <img src=${user.image} alt="" width="64" height="64" />
          <strong>${user.name}</strong>
          ${overview}${orders}${switchUser}
        </nav>
        <section>${slot}</section>
      </div>
    `,
  };
});

export default AccountLayout;
