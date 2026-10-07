import {
  attach,
  attachStore,
  component,
  destroy,
  getFrame,
  onDestroy,
} from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { PlacementStore } from '../store/ui';
import type { Conversation } from './Conversation';
import classes from './Dock.module.scss';

export type Dock = {
  node: HTMLElement;
  /** Moves a live conversation into the dock without recreating its frame. */
  adopt(conversation: Conversation): void;
  /** Returns the docked conversation for `peerId`, if present. */
  take(peerId: string): Conversation | undefined;
};

/** Keeps one conversation alive across navigation in a floating window. */
export const Dock = component((): Dock => {
  const frame = getFrame()!;
  const node = html`<aside class=${classes.dock} hidden></aside>`;
  document.body.append(node);

  const placement = attachStore(PlacementStore);
  placement.kind = 'dock';
  placement.close = (conversation) => {
    destroy(conversation);
  };

  let current: Conversation | undefined;
  let unwatch: (() => void) | undefined;
  const empty = () => {
    current = undefined;
    node.hidden = true;
  };

  return {
    node,
    adopt(conversation) {
      unwatch?.();
      destroy(current);
      current = conversation;
      // Re-read the placement after the conversation changes frames.
      attach(frame, conversation);
      node.append(conversation.node);
      node.hidden = false;
      unwatch = onDestroy(conversation, empty);
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
