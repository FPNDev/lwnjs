import './styles/global.scss';
import { domRenderer, setRenderer } from 'lwn-js/core';
import { App } from './App';

setRenderer(domRenderer);

const container = document.querySelector('#app')!;
container.append(App().node);
