import './styles/global.scss';
import { domRenderer, setRenderer } from 'lwnjs/core';
import { App } from './App';

setRenderer(domRenderer);

const container = document.querySelector('#app')!;
container.append(App(container));
