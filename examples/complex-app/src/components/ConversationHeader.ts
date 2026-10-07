import {
  attach,
  component,
  destroy,
  getFrame,
  listen,
  useStore,
} from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { initial } from '../lib/format';
import { chatUrl, router } from '../router';
import { ChatStore } from '../store/chat';
import type { Placement } from '../store/ui';
import type { Conversation } from './Conversation';
import classes from './Conversation.module.scss';
import { SafetyNumberDialog } from './SafetyNumberDialog';

const presenceLabel = {
  online: 'online',
  connecting: 'connecting...',
  offline: 'offline',
};

export type ConversationHeader = {
  node: HTMLElement;
  /** Updates actions for the conversation's current placement. */
  place(placement: Placement, conversation: Conversation): void;
};

export const ConversationHeader = component(
  (peerId: string): ConversationHeader => {
    const avatar = html`<div class=${classes.avatar}></div>`;
    const name = html`<div class=${classes.name}></div>`;
    const dot = html`<span class=${classes.dot}></span>`;
    const status = html`<span></span>`;
    const verified = html`<span
      class=${classes.verified}
      title="Safety number verified"
      >verified</span
    >`;
    const verify = html`<button title="Compare safety numbers">Verify</button>`;
    const actions = html`<div class=${classes.actions}>${verify}</div>`;
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
      SafetyNumberDialog(chat, peerId);
    });
    const frame = getFrame()!;

    // Replace the action group and its listeners after each move.
    let placementButtons: HTMLElement | undefined;

    return {
      node: html`
        <header class=${classes.header}>
          ${avatar}
          <div class=${classes.who}>
            ${name}
            <div class=${classes.status}>${dot}${status}${verified}</div>
          </div>
          ${actions}
        </header>
      `,

      place(placement, conversation) {
        destroy(placementButtons);
        const group = html`<span></span>`;
        attach(frame, group);
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
          const close = html`<button title="Close">x</button>`;
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
