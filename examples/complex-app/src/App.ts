import { attachStore, component, env, listen } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { createOutlet } from 'lwn-js/router';
import classes from './App.module.scss';
import { ContactList } from './components/ContactList';
import { Dock } from './components/Dock';
import { IdentityCard } from './components/IdentityCard';
import { NewChatDialog } from './components/NewChatDialog';
import { Toasts } from './components/Toasts';
import { Welcome } from './pages/Welcome';
import { ChatRoute, FallbackRoute, HomeRoute, router } from './router';
import { ChatStore } from './store/chat';
import { UiStore } from './store/ui';

export const App = component(() => {
  const chat = attachStore(ChatStore);
  const ui = attachStore(UiStore);
  // These views render in body but remain children of the app frame.
  ui.toasts = Toasts();
  ui.dock = Dock();

  const newChat = html`<button class=${classes.newChat}>
    New chat <kbd>Ctrl K</kbd>
  </button>`;
  const slot = html<Comment>`<!---->`;
  const sidebar = html`<aside class=${classes.sidebar}>
    ${IdentityCard()}${newChat}${ContactList()}
  </aside>`;
  const main = html`<main class=${classes.main}>${slot}</main>`;

  const page = createOutlet(slot);
  router.route(HomeRoute, () => page.show(Welcome));
  router.route(ChatRoute, () => page.show(() => import('./pages/ChatPage')));
  router.route(FallbackRoute, () => router.go('/'));

  chat.notices.subscribe((text) => {
    ui.toasts.show(text);
  });

  listen(newChat, 'click', NewChatDialog);
  listen(document, 'keydown', (event) => {
    // Leave shortcuts to the active keyboard environment when one is set.
    if (
      (event.ctrlKey || event.metaKey) &&
      event.code === 'KeyK' &&
      env.current === undefined
    ) {
      event.preventDefault();
      NewChatDialog();
    }
  });

  return { node: html`<div class=${classes.layout}>${sidebar}${main}</div>` };
});
