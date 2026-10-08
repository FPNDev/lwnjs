import { createStore } from 'lwn-js/core';
import type { Conversation } from '../components/Conversation';
import type { Dock } from '../components/Dock';
import type { Toasts } from '../components/Toasts';

export type Ui = {
  toasts: Toasts;
  dock: Dock;
};

/** App-wide toast and dock views. */
export const UiStore = createStore(() => ({}) as Ui);

/** Provides the current conversation placement to its descendants. */
export type Placement = {
  kind: 'page' | 'dock';
  popOut?(conversation: Conversation): void;
  close?(): void;
};

export const PlacementStore = createStore((): Placement => ({ kind: 'page' }));
