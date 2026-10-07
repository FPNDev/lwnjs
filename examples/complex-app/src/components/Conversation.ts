import { component, onAttach, useStore } from 'lwn-js/core';
import { html } from 'lwn-js/html';
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

/** A chat view that keeps its state when moved between the page and dock. */
export const Conversation = component((peerId: string) => {
  const chat = useStore(ChatStore);
  const header = ConversationHeader(peerId);
  const messages = MessageList();
  const composer = Composer((text) => void chat.send(peerId, text));

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

  const node = html`<section class=${classes.conversation}>
    ${header}${messages}${composer}
  </section>`;
  const conversation = { node, peerId };

  // Re-read placement after each attachment.
  onAttach(() => {
    header.place(useStore(PlacementStore), conversation);
    composer.focus();
  });

  return conversation;
});
