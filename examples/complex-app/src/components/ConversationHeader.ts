import { attach, component, destroy, listen, useStore } from 'lwnjs/core';
import { html } from 'lwnjs/html';
import { initial } from '../lib/format';
import { chatUrl, router } from '../router';
import { ChatStore } from '../store/chat';
import type { Placement } from '../store/ui';
import type { Conversation } from './Conversation';
import classes from './Conversation.module.scss';
import { SafetyNumberDialog } from './SafetyNumberDialog';

const presenceLabel = {
  online: 'online',
  connecting: 'connecting…',
  offline: 'offline',
};

export type ConversationHeader = {
  node: HTMLElement;
  /** Shows the buttons for where the conversation is now. */
  place(placement: Placement, conversation: Conversation): void;
};

export const ConversationHeader = component(
  (parent: object, peerId: string): ConversationHeader => {
    const avatar = html`<div class=${classes.avatar}></div>`;
    const name = html`<div class=${classes.name}></div>`;
    const dot = html`<span class=${classes.dot}></span>`;
    const status = html`<span></span>`;
    const verified = html`<span
      class=${classes.verified}
      title="Safety number verified"
      >✔ verified</span
    >`;
    const verify = html`<button title="Compare safety numbers">Verify</button>`;
    const actions = html`<div class=${classes.actions}>${verify}</div>`;
    const node = html`
      <header class=${classes.header}>
        ${avatar}
        <div class=${classes.who}>
          ${name}
          <div class=${classes.status}>${dot}${status}${verified}</div>
        </div>
        ${actions}
      </header>
    `;
    attach(parent, node);
    const chat = useStore(ChatStore);

    const showContact = () => {
      const contact = chat.find(peerId);
      name.textContent = contact?.name ?? peerId;
      avatar.textContent = initial(contact?.name ?? peerId);
      verified.hidden = !contact?.verified;
    };
    const showPresence = () => {
      const presence = chat.presenceOf(peerId);
      dot.dataset.presence = presence;
      status.textContent = presenceLabel[presence];
    };
    showContact();
    showPresence();
    chat.contacts.subscribe(showContact);
    chat.presence.subscribe(showPresence);

    listen(verify, 'click', () => {
      SafetyNumberDialog(node, chat, peerId);
    });

    // Placement buttons are rebuilt on every move; they are owned by a group node that is replaced.
    let placementButtons: HTMLElement | undefined;

    return {
      node,
      place(placement, conversation) {
        destroy(placementButtons);
        const group = html`<span></span>`;
        attach(node, group);
        if (placement.kind === 'page') {
          const popOut = html`<button
            title="Keep this chat open while you browse"
          >
            Pop out
          </button>`;
          listen(group, popOut, 'click', () =>
            placement.popOut?.(conversation),
          );
          group.append(popOut);
        } else {
          const open = html`<button title="Open in the main view">
            Open
          </button>`;
          const close = html`<button title="Close">✕</button>`;
          listen(group, open, 'click', () => void router.go(chatUrl(peerId)));
          listen(group, close, 'click', () => placement.close?.(conversation));
          group.append(open, close);
        }
        actions.append(group);
        placementButtons = group;
      },
    };
  },
);
