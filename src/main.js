import './styles.css';
import { GameApp } from './game/GameApp.js';

function parseDevDebugFlags() {
  if (!import.meta.env.DEV) return null;

  const params = new URLSearchParams(window.location.search);
  const readInt = (key) => {
    const value = params.get(key);
    if (value == null || value === '') return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const flags = {
    startingCredits: readInt('credits'),
    startingHeat: readInt('heat'),
    startingRivals: readInt('rivals'),
    startingEnergy: readInt('energy'),
    startingEmpCharges: readInt('emp'),
    startingSuperBoost: params.get('super-boost') === '1',
    skipIntro: params.get('skip-intro') === '1',
  };

  return Object.values(flags).some((value) => value != null) ? flags : null;
}

const mount = document.getElementById('app');
const app = new GameApp(mount, { debug: parseDevDebugFlags() });

app.start();
