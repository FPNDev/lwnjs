import './styles/global.scss';
import { hydrate } from 'lwn-js/ssr';
import { router, runApp } from './app';

// Adopts the server-rendered DOM instead of rebuilding it.
await hydrate(document.querySelector('#app')!, runApp, router);
