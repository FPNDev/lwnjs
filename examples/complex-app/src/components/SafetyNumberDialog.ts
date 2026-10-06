import { component, listen } from 'engine-ts/core';
import { html } from 'engine-ts/html';
import type { Chat } from '../store/chat';
import classes from './Conversation.module.scss';
import { openModal } from './Modal';

/**
 * Shows the safety number for a contact. Owned by the conversation header:
 * if the conversation is destroyed while it is open, the dialog closes too.
 */
export const SafetyNumberDialog = component(
  (owner: object, chat: Chat, peerId: string) => {
    const contact = chat.find(peerId);
    const modal = openModal(owner, `Verify ${contact?.name ?? peerId}`);
    const number = html`<p class=${classes.safety}>…</p>`;
    const verify = html<HTMLButtonElement>`<button type="submit">
      Mark as verified
    </button>`;
    modal.body.append(
      html`<p class=${classes.hint}>
        Compare this number with ${contact?.name ?? 'them'} in person or on a
        call. If it matches on both screens, nobody is in the middle.
      </p>`,
      number,
      verify,
    );

    void chat.safetyNumber(peerId).then((value) => {
      number.textContent = value ?? 'Connect once to exchange keys first.';
      verify.disabled = !value || contact?.verified === true;
    });
    listen(modal.node, verify, 'click', () => {
      chat.verify(peerId);
      modal.close();
    });
  },
);
