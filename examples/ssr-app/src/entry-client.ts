import './styles/global.scss';
import { hydrate } from 'engine-ts/ssr';
import { App, router } from './app';

// Adopts the server-rendered DOM instead of rebuilding it.
await hydrate(document.querySelector('#app')!, App, router);
