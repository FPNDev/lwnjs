import './styles/global.scss';
import { domRenderer, setRenderer } from 'engine-ts/core';
import { App } from './App';
import { startChat } from './store/chat';

setRenderer(domRenderer);

// Identity, contacts and the signaling connection are ready before the first view is built,
// so every component can read them synchronously.
await startChat();

const container = document.querySelector('#app')!;
container.append(App(container));
