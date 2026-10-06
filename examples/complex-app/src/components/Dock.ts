import { attach, attachStore, component, destroy, onDestroy } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { PlacementStore } from '../store/ui';
import type { Conversation } from './Conversation';
import classes from './Dock.module.scss';

export type Dock = {
  /** Moves a live conversation into the dock: same node, same state, same subscriptions. */
  adopt(conversation: Conversation): void;
  /** Hands the docked conversation back if it is `peerId`'s. */
  take(peerId: string): Conversation | undefined;
};

/** A floating window that keeps one conversation alive across navigation. */
export const Dock = component((parent: object): Dock => {
  const node = html`<aside class=${classes.dock} hidden></aside>`;
  attach(parent, node);
  document.body.append(node);

  const placement = attachStore(PlacementStore);
  placement.kind = 'dock';
  placement.close = (conversation) => {
    destroy(conversation.node);
  };

  let current: Conversation | undefined;
  let unwatch: (() => void) | undefined;
  const empty = () => {
    current = undefined;
    node.hidden = true;
  };

  return {
    adopt(conversation) {
      unwatch?.();
      destroy(current?.node);
      current = conversation;
      // `attach` moves it: detached from the page (its subscriptions stay, they belong to the
      // conversation itself), attached here (its onAttach re-reads the placement).
      attach(node, conversation.node);
      node.append(conversation.node);
      node.hidden = false;
      unwatch = onDestroy(conversation.node, empty);
    },

    take(peerId) {
      if (current?.peerId !== peerId) {
        return;
      }
      const conversation = current;
      unwatch?.();
      empty();

      return conversation;
    },
  };
});
