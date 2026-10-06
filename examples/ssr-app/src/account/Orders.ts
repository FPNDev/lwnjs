import { attach } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { useServer } from 'lwn-js/ssr';
import { OrdersData } from '../data';
import classes from '../styles/ui.module.scss';

/** Lazy inner page of the account layout, with its own server data. */
export default function Orders(parent: object) {
  const node = html`<div><h1 class=${classes.title}>Orders</h1></div>`;
  attach(parent, node);

  const orders = useServer(OrdersData);
  for (const order of orders) {
    const items = html`<ul></ul>`;
    for (const item of order.items) {
      items.append(html`<li>${item.title} × ${item.quantity}</li>`);
    }
    node.append(
      html`<div class=${classes.order}>
        <strong>Order #${order.id} · ${order.total}</strong>${items}
      </div>`,
    );
  }
  if (orders.length === 0) {
    node.append(html`<p class=${classes.muted}>No orders yet.</p>`);
  }

  return node;
}
