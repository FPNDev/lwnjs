import { component, listen, useStore } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { isolateOnFocus } from '../lib/focus-env';
import { ChatStore } from '../store/chat';
import { UiStore } from '../store/ui';
import classes from './Sidebar.module.scss';

const statusPresence = {
  starting: 'connecting',
  online: 'online',
  offline: 'offline',
};

/** Displays the local identity and signaling status. */
export const IdentityCard = component(() => {
  const dot = html`<span class=${classes.dot} title="Signaling server"></span>`;
  const name = html<HTMLInputElement>`<input
    aria-label="Your name"
    maxlength="32"
  />`;
  const copy = html`<button>Copy</button>`;
  const codeNode = html`<code></code>`;
  const chat = useStore(ChatStore);
  const ui = useStore(UiStore);

  name.value = chat.me.name;
  codeNode.textContent = chat.me.peerId;

  const showStatus = () => {
    dot.dataset.presence = statusPresence[chat.status.get()];
  };
  showStatus();
  chat.status.subscribe(showStatus);

  isolateOnFocus(name, Symbol('my name'));
  listen(name, 'change', () => {
    chat.rename(name.value.trim() || chat.me.name);
  });
  listen(copy, 'click', () => {
    void navigator.clipboard.writeText(chat.me.peerId).then(() => {
      ui.toasts.show('Your ID is copied. Send it to someone.');
    });
  });

  return {
    node: html`
      <section class=${classes.identity}>
        <div class=${classes.me}>${dot}${name}</div>
        <div class=${classes.id}>${codeNode}${copy}</div>
      </section>
    `,
  };
});
