import { component } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { formatTime } from '../lib/format';
import type { Message } from '../services/db';
import classes from './Conversation.module.scss';

const statusMark = { pending: ' ⏳', sent: ' ✓', delivered: ' ✓✓' };

type Bubble = {
  node: HTMLLIElement;
  at: number;
  meta: HTMLElement;
};

export type MessageList = {
  node: HTMLElement;
  /** Adds a message in time order unless it is already present. */
  add(message: Message): void;
  update(message: Message): void;
  scrollToEnd(): void;
};

export const MessageList = component((): MessageList => {
  const bubbles = new Map<string, Bubble>();
  const order: Bubble[] = [];

  const isNearEnd = () =>
    node.scrollHeight - node.scrollTop - node.clientHeight < 48;
  const scrollToEnd = () => {
    node.scrollTop = node.scrollHeight;
  };

  const meta = (message: Message) =>
    formatTime(message.at) +
    (message.outgoing ? statusMark[message.status] : '');

  const node = html<HTMLUListElement>`<ul class=${classes.messages}></ul>`;

  return {
    node,
    scrollToEnd,

    add(message) {
      if (bubbles.has(message.id)) {
        return;
      }

      const stick = isNearEnd();
      const metaNode = html`<small class=${classes.meta}
        >${meta(message)}</small
      >`;
      const bubble: Bubble = {
        node: html<HTMLLIElement>`
          <li class=${classes.message}>${message.text}${metaNode}</li>
        `,
        at: message.at,
        meta: metaNode,
      };
      bubble.node.classList.toggle(classes.outgoing, message.outgoing);
      bubbles.set(message.id, bubble);

      // Insert newer messages at the end and place late history by timestamp.
      let index = order.length;
      while (index > 0 && order[index - 1].at > message.at) {
        index--;
      }
      node.insertBefore(bubble.node, order[index]?.node ?? null);
      order.splice(index, 0, bubble);

      if (stick || message.outgoing) {
        scrollToEnd();
      }
    },

    update(message) {
      const bubble = bubbles.get(message.id);
      if (bubble) {
        bubble.meta.textContent = meta(message);
      }
    },
  };
});
