import { attach, component, env, listen } from 'lwn-js/core';
import { html } from 'lwn-js/html';
import { isolateOnFocus } from '../lib/focus-env';
import classes from './Conversation.module.scss';

export type Composer = {
  node: HTMLElement;
  focus(): void;
};

/** Message input. <kbd>Enter</kbd> sends, <kbd>Shift</kbd>+<kbd>Enter</kbd> adds a line. */
export const Composer = component(
  (parent: object, onSend: (text: string) => void): Composer => {
    const input = html<HTMLTextAreaElement>`<textarea
      placeholder="Message"
      rows="1"
      aria-label="Message"
    ></textarea>`;
    const send = html`<button>Send</button>`;
    const node = html`<div class=${classes.composer}>${input}${send}</div>`;
    attach(parent, node);

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
      // The composer owns Enter only while it is the innermost env.
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
      node,
      focus() {
        input.focus();
      },
    };
  },
);
