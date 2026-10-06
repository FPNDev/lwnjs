import { createStore } from 'lwn-js/core';
import type { Conversation } from '../components/Conversation';
import type { Dock } from '../components/Dock';
import type { Toasts } from '../components/Toasts';

export type Ui = {
  toasts: Toasts;
  dock: Dock;
};

/** App-wide UI services. App fills it right after attaching. */
export const UiStore = createStore(() => ({}) as Ui);

/**
 * Where a conversation currently lives. The chat page and the dock each
 * provide one; a conversation reads it in `onAttach`, so moving it between
 * them changes its buttons without re-creating it.
 */
export type Placement = {
  kind: 'page' | 'dock';
  popOut?(conversation: Conversation): void;
  close?(conversation: Conversation): void;
};

export const PlacementStore = createStore((): Placement => ({ kind: 'page' }));
