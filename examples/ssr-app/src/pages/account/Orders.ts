import { component } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { useServer } from 'lwn-js/ssr';
import { OrdersData } from '../../data';
import classes from '../../styles/ui.module.scss';

/** Lazy inner page of the account layout, with its own server data. */
const Orders = component(() => {
  const orders = useServer(OrdersData);
  const content = [] as Node[];
  for (const order of orders) {
    const items = order.items.map(
      (item) => html`<li>${item.title} x ${item.quantity}</li>`,
    );
    content.push(
      html`<div class=${classes.order}>
        <strong>Order #${order.id} - ${order.total}</strong>
        <ul>
          ${items}
        </ul>
      </div>`,
    );
  }
  if (orders.length === 0) {
    content.push(html`<p class=${classes.muted}>No orders yet.</p>`);
  }

  return {
    node: html`<div>
      <h1 class=${classes.title}>Orders</h1>
      ${content}
    </div>`,
  };
});

export default Orders;
