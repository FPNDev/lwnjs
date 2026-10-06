import './styles/global.scss';
import { hydrate } from 'lwnjs/ssr';
import { App, router } from './app';

// Adopts the server-rendered DOM instead of rebuilding it.
await hydrate(document.querySelector('#app')!, App, router);
