import './styles.css';
import { GameApp } from './game/GameApp.js';

const mount = document.getElementById('app');
const app = new GameApp(mount);

app.start();
