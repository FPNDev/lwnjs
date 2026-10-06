import { attach, attachStore, component, env, listen } from 'lwnjs/core';
import { html } from 'lwnjs/html';
import { createOutlet } from 'lwnjs/router';
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

export const App = component((parent: object) => {
  const node = html`<div class=${classes.layout}></div>`;
  attach(parent, node);
  const chat = attachStore(ChatStore);
  const ui = attachStore(UiStore);
  // Both are mounted in <body> but owned by the app.
  ui.toasts = Toasts(node);
  ui.dock = Dock(node);

  const newChat = html`<button class=${classes.newChat}>
    New chat <kbd>Ctrl K</kbd>
  </button>`;
  const slot = html<Comment>`<!---->`;
  node.append(
    html`<aside class=${classes.sidebar}>
      ${IdentityCard(node)}${newChat}${ContactList(node)}
    </aside>`,
    html`<main class=${classes.main}>${slot}</main>`,
  );

  const page = createOutlet(node, slot);
  router.route(HomeRoute, () => page.show(Welcome));
  router.route(ChatRoute, () => page.show(() => import('./pages/ChatPage')));
  router.route(FallbackRoute, () => router.go('/'));

  chat.notices.subscribe((text) => {
    ui.toasts.show(text);
  });

  listen(newChat, 'click', () => {
    NewChatDialog(node);
  });
  listen(document, 'keydown', (event) => {
    // App shortcuts run only when no env is isolated: focused inputs and open modals own the keyboard.
    if (
      (event.ctrlKey || event.metaKey) &&
      event.code === 'KeyK' &&
      env.current === undefined
    ) {
      event.preventDefault();
      NewChatDialog(node);
    }
  });

  return node;
});
