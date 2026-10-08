import {
  attach,
  attachStore,
  component,
  destroy,
  requireFrame,
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
  const frame = requireFrame();
  const node = html`<aside class=${classes.dock} hidden></aside>`;
  document.body.append(node);

  const placement = attachStore(PlacementStore);
  placement.kind = 'dock';
  placement.close = () => {
    destroy(current);
    empty();
  };

  let current: Conversation | undefined;
  const empty = () => {
    const emptied = current;
    current = undefined;
    node.hidden = true;

    return emptied;
  };

  return {
    node,
    adopt(conversation) {
      destroy(current);
      current = conversation;
      // Re-read the placement after the conversation changes frames.
      attach(frame, conversation);
      node.append(conversation.node);
      node.hidden = false;
    },

    take(peerId) {
      if (current?.peerId !== peerId) {
        return;
      }

      return empty();
    },
  };
});
