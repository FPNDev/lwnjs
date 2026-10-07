import { defineServerApp } from 'lwn-js/server';
import { router, routes, runApp } from './app';
import { serverRoutes } from './server-routes';

// Server-only entry, used by `lwn dev | build | start`.
export default defineServerApp({ router, routes, serverRoutes, app: runApp });
