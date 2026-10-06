import { attach, component, onAttach, useStore } from 'lwnjs/core';
import { html } from 'lwnjs/html';
import { ChatStore } from '../store/chat';
import { PlacementStore } from '../store/ui';
import { Composer } from './Composer';
import classes from './Conversation.module.scss';
import { ConversationHeader } from './ConversationHeader';
import { MessageList } from './MessageList';

export type Conversation = {
  node: HTMLElement;
  peerId: string;
};

/**
 * A chat with one peer. It can move between the chat page and the dock
 * without being re-created: history, scroll position and the half-typed
 * message survive. Everything it subscribes to is owned by its own node, so
 * moving it changes nothing; only what depends on *where* it is (its buttons)
 * is re-read in `onAttach`.
 */
export const Conversation = component(
  (parent: object, peerId: string): Conversation => {
    const node = html`<section class=${classes.conversation}></section>`;
    attach(parent, node);
    const chat = useStore(ChatStore);
    const conversation: Conversation = { node, peerId };

    const header = ConversationHeader(node, peerId);
    const messages = MessageList(node);
    const composer = Composer(node, (text) => void chat.send(peerId, text));
    node.append(header.node, messages.node, composer.node);

    void chat.messages(peerId).then((history) => {
      for (const message of history) {
        messages.add(message);
      }
      messages.scrollToEnd();
    });
    chat.messageAdded.subscribe((message) => {
      if (message.peerId === peerId) {
        messages.add(message);
        chat.markRead(peerId);
      }
    });
    chat.messageUpdated.subscribe((message) => {
      if (message.peerId === peerId) {
        messages.update(message);
      }
    });
    chat.markRead(peerId);
    chat.connect(peerId);

    // Runs now and after every move.
    onAttach(() => {
      // `node`, not the hook's scope: the placement is provided by whoever holds the conversation.
      header.place(useStore(node, PlacementStore), conversation);
      composer.focus();
    });

    return conversation;
  },
);
