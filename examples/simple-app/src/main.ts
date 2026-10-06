import './styles/global.scss';
import { domRenderer, setRenderer } from 'engine-ts/core';
import { App } from './App';

setRenderer(domRenderer);

const container = document.querySelector('#app')!;
container.append(App(container));
