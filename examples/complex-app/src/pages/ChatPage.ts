import { attach, attachStore, destroy, useStore } from 'engine-ts/core';
import { html } from 'engine-ts/html';
import { Conversation } from '../components/Conversation';
import { ChatRoute, currentPeerId, router } from '../router';
import { ChatStore } from '../store/chat';
import { PlacementStore, UiStore } from '../store/ui';
import classes from './Page.module.scss';

/**
 * Shows the conversation of the current route. Loaded lazily; the outlet
 * keeps this page while you switch chats, so it follows the route itself.
 */
export default function ChatPage(parent: object) {
  const node = html`<section class=${classes.page}></section>`;
  attach(parent, node);
  const chat = useStore(ChatStore);
  const ui = useStore(UiStore);

  let current: Conversation | undefined;

  const placement = attachStore(PlacementStore);
  placement.popOut = (conversation) => {
    // Hand the live conversation to the dock; it outlives this page.
    ui.dock.adopt(conversation);
    current = undefined;
    void router.go('/');
  };

  router.route(ChatRoute, () => {
    const peerId = currentPeerId()!;
    if (current?.peerId === peerId) {
      return;
    }
    if (!chat.has(peerId)) {
      chat.addContact(peerId, peerId);
    }
    destroy(current?.node);
    // A popped-out conversation comes back as it is: history, scroll, draft.
    current = ui.dock.take(peerId) ?? Conversation(node, peerId);
    attach(node, current.node);
    node.append(current.node);
  });

  return node;
}
