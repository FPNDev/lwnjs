import {
  attach,
  attachStore,
  component,
  destroy,
  requireFrame,
  useStore,
} from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { Conversation } from '../components/Conversation';
import { ChatRoute, currentPeerId, router } from '../router';
import { ChatStore } from '../store/chat';
import { PlacementStore, UiStore } from '../store/ui';
import classes from './Page.module.scss';

/** Shows the routed conversation; the outlet keeps this page alive across peer changes. */
const ChatPage = component(() => {
  const frame = requireFrame();
  const chat = useStore(ChatStore);
  const ui = useStore(UiStore);

  let current: Conversation | undefined;

  const placement = attachStore(PlacementStore);
  placement.popOut = (conversation) => {
    ui.dock.adopt(conversation);
    current = undefined;
    void router.go('/');
  };

  const node = html`<section class=${classes.page}></section>`;

  router.route(ChatRoute, () => {
    const peerId = currentPeerId()!;
    if (current?.peerId === peerId) {
      return;
    }

    destroy(current);

    if (!chat.has(peerId)) {
      chat.addContact(peerId, peerId);
    }

    // Restore the same conversation instance when it was docked.
    const docked = ui.dock.take(peerId);
    current = docked ?? Conversation(peerId);
    if (docked) {
      attach(frame, docked);
    }
    node.append(current.node);
  });

  return { node };
});

export default ChatPage;
