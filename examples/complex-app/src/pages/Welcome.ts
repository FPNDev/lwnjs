import { component, useStore } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { ChatStore } from '../store/chat';
import classes from './Page.module.scss';

export const Welcome = component(() => ({
  node: html`
    <section class=${classes.welcome}>
      <h1>Peer-to-peer, end-to-end encrypted</h1>
      <p>
        Your ID is ${useStore(ChatStore).me.peerId}. Give it to someone and they
        can start a chat with you.
      </p>
      <ol>
        <li>
          Open this app in another browser or profile (or send the link to a
          friend).
        </li>
        <li>
          Press <kbd>Ctrl</kbd> <kbd>K</kbd> or "New chat" and paste the other
          ID.
        </li>
        <li>
          Messages go straight between the browsers. Use "Verify" to compare
          safety numbers.
        </li>
      </ol>
      <p>
        Messages written while the other side is offline wait here and are
        delivered when they come back.
      </p>
    </section>
  `,
}));
