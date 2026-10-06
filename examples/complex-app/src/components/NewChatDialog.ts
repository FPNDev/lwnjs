import { component, listen, useStore } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { isolateOnFocus } from '../lib/focus-env';
import { chatUrl, router } from '../router';
import { ChatStore } from '../store/chat';
import { openModal } from './Modal';

/** Asks for a peer id and a name, then opens the chat. */
export const NewChatDialog = component((owner: object) => {
  const chat = useStore(owner, ChatStore);
  const modal = openModal(owner, 'New chat');
  const peerId = html<HTMLInputElement>`<input
    required
    pattern="^ets-[\\w\\-]+$"
    placeholder="ets-…"
  />`;
  const name = html<HTMLInputElement>`<input
    placeholder="Their name (only you see it)"
  />`;
  const form = html`
    <form>
      <label>Their ID ${peerId}</label>
      <label>Name ${name}</label>
      <button type="submit">Start chat</button>
    </form>
  `;
  modal.body.append(form);

  // openModal attached the modal first, so it owns everything below.
  // Inputs nest inside the modal's env: Escape (checked with `env.is(modal)`) still closes it.
  isolateOnFocus(peerId, Symbol('peer id'), modal.env);
  isolateOnFocus(name, Symbol('name'), modal.env);

  listen(form, 'submit', (event) => {
    event.preventDefault();
    const id = peerId.value.trim();
    if (id === chat.me.peerId) {
      peerId.setCustomValidity('That is your own ID.');
      peerId.reportValidity();

      return;
    }
    chat.addContact(id, name.value.trim() || id);
    modal.close();
    void router.go(chatUrl(id));
  });
  listen(peerId, 'input', () => {
    peerId.setCustomValidity('');
  });
  peerId.focus();
});
