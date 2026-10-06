import { defineServerApp } from 'engine-ts/server';
import { App, router, routes } from './app';
import { serverRoutes } from './server-routes';

// Server-only entry, used by `engine-ts dev | build | start`.
export default defineServerApp({ router, routes, serverRoutes, app: App });
