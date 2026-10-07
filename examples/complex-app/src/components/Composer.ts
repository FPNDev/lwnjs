import { component, env, listen } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { isolateOnFocus } from '../lib/focus-env';
import classes from './Conversation.module.scss';

export type Composer = {
  node: HTMLElement;
  focus(): void;
};

/** Sends on Enter and inserts a line break on Shift+Enter. */
export const Composer = component(
  (onSend: (text: string) => void): Composer => {
    const input = html<HTMLTextAreaElement>`<textarea
      placeholder="Message"
      rows="1"
      aria-label="Message"
    ></textarea>`;
    const send = html`<button>Send</button>`;
    const id = Symbol('composer');
    isolateOnFocus(input, id);

    const submit = () => {
      const text = input.value.trim();
      if (text) {
        onSend(text);
        input.value = '';
        input.style.height = ``;
      }
      input.focus();
    };

    listen(send, 'click', submit);
    listen(input, 'keydown', (event) => {
      // Handle Enter only while this composer is the active environment.
      if (event.key === 'Enter' && !event.shiftKey && env.isCurrent(id)) {
        event.preventDefault();
        submit();
      }
    });
    listen(input, 'input', () => {
      input.style.height = ``;
      input.style.height = `${input.scrollHeight}px`;
    });

    return {
      node: html`<div class=${classes.composer}>${input}${send}</div>`,
      focus() {
        input.focus();
      },
    };
  },
);
