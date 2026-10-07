import './styles/global.scss';
import { domRenderer, setRenderer } from 'lwn-js/core';
import { App } from './App';
import { startChat } from './store/chat';

setRenderer(domRenderer);

// Load the identity and start signaling before building the app.
await startChat();

const container = document.querySelector('#app')!;
container.append(App().node);
