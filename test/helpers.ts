import { component } from '../src/core/index.ts';

export const flush = () =>
  new Promise((resolve) => {
    setTimeout(resolve);
  });

export const view = (text: string) =>
  component(() => {
    const node = document.createElement('p');
    node.textContent = text;

    return { node };
  });
