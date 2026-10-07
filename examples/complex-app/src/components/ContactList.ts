import { component, useStore } from 'lwn-js/core';
import { html, text } from 'lwn-js/html';
import { formatTime, initial } from '../lib/format';
import {
  ChatRoute,
  HomeRoute,
  chatUrl,
  currentPeerId,
  router,
  routerLink,
} from '../router';
import type { Contact } from '../services/db';
import { ChatStore, type Presence } from '../store/chat';
import classes from './Sidebar.module.scss';

type ContactRow = {
  node: HTMLLIElement;
  link: HTMLAnchorElement;
  update(contact: Contact): void;
  setPresence(presence: Presence): void;
};

const ContactRow = component((contact: Contact): ContactRow => {
  const letter = text();
  const dot = html`<span class=${classes.dot}></span>`;
  const avatar = html`<span class=${classes.avatar}>${letter}${dot}</span>`;
  const name = html`<span class=${classes.name}></span>`;
  const time = html`<span class=${classes.time}></span>`;
  const preview = html`<span class=${classes.preview}></span>`;
  const unread = html`<span class=${classes.unread}></span>`;
  const link = routerLink(html<HTMLAnchorElement>`
    <a class=${classes.contact} href=${chatUrl(contact.peerId)}>
      ${avatar}
      <span class=${classes.text}>
        <span class=${classes.line}>${name}${time}</span>
        <span class=${classes.line}>${preview}${unread}</span>
      </span>
    </a>
  `);

  return {
    node: html<HTMLLIElement>`<li>${link}</li>`,
    link,
    update(next) {
      letter.data = initial(next.name);
      name.textContent = next.verified ? `${next.name} ✔` : next.name;
      time.textContent = next.preview ? formatTime(next.lastAt) : '';
      preview.textContent = next.preview || 'No messages yet';
      unread.textContent = String(next.unread);
      unread.hidden = next.unread === 0;
    },
    setPresence(presence) {
      dot.dataset.presence = presence;
    },
  };
});

/** Lists contacts with presence and unread counts. */
export const ContactList = component(() => {
  const list = html`<ul class=${classes.contacts}></ul>`;
  const empty = html`<p class=${classes.empty}>
    No chats yet. Share your ID or start a new chat.
  </p>`;
  const chat = useStore(ChatStore);

  const rows = new Map<string, ContactRow>();
  const render = (contacts: Contact[]) => {
    for (const [index, contact] of contacts.entries()) {
      let row = rows.get(contact.peerId);
      if (!row) {
        row = ContactRow(contact);
        rows.set(contact.peerId, row);
        row.setPresence(chat.presenceOf(contact.peerId));
      }
      row.update(contact);
      // Preserve rows already in their correct position.
      if (list.children[index] !== row.node) {
        list.insertBefore(row.node, list.children[index] ?? null);
      }
    }
    empty.hidden = contacts.length > 0;
    highlight();
  };

  let active: HTMLAnchorElement | undefined;
  const highlight = () => {
    active?.classList.remove(classes.active);
    const peerId = currentPeerId();
    active = peerId ? rows.get(peerId)?.link : undefined;
    active?.classList.add(classes.active);
  };

  render(chat.contacts.get());
  chat.contacts.subscribe(render);
  chat.presence.subscribe((presence) => {
    for (const [peerId, value] of presence) {
      rows.get(peerId)?.setPresence(value);
    }
  });
  router.routes([HomeRoute, ChatRoute], highlight);

  return { node: html`<nav>${list}${empty}</nav>` };
});
