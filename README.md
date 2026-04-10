# CyberTaxi

![A futuristic hover taxi driving in a neon and glowing cyberpunk city](public/images/screenshot.png "CYBERTAXI")

A small arcade-style hover taxi game built with Three.js and Vite.

You pilot a futuristic cab through a neon city, choose fares, deliver passengers across districts, evade hostile rival taxis, and try to keep each run profitable long enough to escape the city.

## Features

- Third-person hover taxi driving
- Procedural neon city with different districts
- Five-choice pickup and drop-off mission loop
- Milestone-based special fares with blue star pickup markers and short high-value deadlines
- Fare timer, distance-scaled pricing, and collision penalties
- Boost system with recharge
- Collidable NPC traffic and heavier ambient city air traffic
- Heat-based rival taxi pursuit system with multiple enemy behaviors
- EMP pickups and inventory for crowd control
- Energy system with rooftop recharge stations
- Crash sparks and crash sound effects on impacts
- Procedural weather, moving rooftop searchlights, and high-altitude neon blimps
- Intro narration with portrait/transcript widget and cinematic title card
- Playlist music support with mute toggle and keyboard track switching
- Pause overlay and streamlined HUD with fare/credits, navigator, and lower-left systems card

## Tech Stack

- `three`
- `vite`
- Plain JavaScript modules
- CSS for HUD and overlays

## Getting Started

### Requirements

- Node.js 18+ recommended
- npm

### Install

```bash
npm install
```

### Run in development

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

## Audio Setup

Place audio assets in `public/audio/`.

Music playlist files currently used:

- `public/audio/music_1.mp3`
- `public/audio/music_2.mp3`
- `public/audio/music_3.mp3`

Intro narration files:

- `public/audio/intro_1.mp3` through `public/audio/intro_7.mp3`

Other sound effects currently used:

- `public/audio/crash.mp3`
- `public/audio/zap.mp3`

Image assets currently used:

- `public/images/player.png` for the intro dialogue portrait

The game will try to start music and intro narration automatically when the game begins. Some browsers block autoplay until the first click or key press.

## Controls

- `W` / `S`: accelerate / brake
- `A` / `D`: steer
- `Q` / `E`: strafe left / right
- `J` / `K`: rise / descend
- `Space`: boost
- `L`: use EMP
- `Esc`: pause / resume
- `M`: toggle music
- `[` / `]`: previous / next music track

Arrow keys also work for forward, brake, and steering.

## Dev Query Params

When running `npm run dev`, you can seed debug state through URL params:

- `?credits=750`
- `?heat=4`
- `?rivals=6`
- `?emp=3`
- `?skip-intro=1`

These can be combined, for example:

`http://localhost:5173/?credits=1000&heat=5&rivals=8&emp=4&skip-intro=1`

## Gameplay

1. Choose from the blue passenger pickup markers.
2. Fly into one pickup zone to lock in that fare.
3. Follow the pink drop-off marker.
4. Deliver the passenger before the fare drops too much.
5. Watch heat rise as you survive, earn, and complete fares.
6. Collect green EMP charges when they appear and use them if rival taxis start to swarm.
7. Watch for blue-star special fares that unlock every `350` credits earned.

Important rules:

- Your fare value drains over time while a passenger is onboard.
- Special fares unlock every `350` total credits and pay more, but have a short timed delivery window.
- Crashes during a ride reduce the fare further.
- Crashing while boosting causes a larger penalty.
- Colliding with buildings, cars, rivals, or blimps throws off sparks and plays a crash sound.
- Longer trips pay more than shorter trips.
- If a fare drops to `0`, the ride fails and you lose 50% of the original fare from your credits.
- Energy drains over time and faster while boosting.
- You must stay parked in an energy station for 5 seconds to refill.
- If energy hits `0` while carrying a passenger, you are charged a `1000` credit penalty.
- Rival taxis escalate with heat and can chase, intercept, block, ram, and swarm.
- EMP pickups spawn every 2 minutes and can be stored for later use.
- A single EMP blast can disable up to 10 nearby rival taxis.
- The city includes moving rooftop searchlights, heavier rain, and large collidable neon blimps in the sky.

## Project Structure

- `src/main.js`
  - App entry point
- `src/game/GameApp.js`
  - Main game bootstrap and frame loop
- `src/game/config.js`
  - Tunable gameplay and world settings
- `src/systems/CityGenerator.js`
  - District generation, buildings, signs, billboards, and traffic paths
- `src/systems/PlayerController.js`
  - Player taxi mesh, movement, hover effects, and boost behavior
- `src/systems/TrafficManager.js`
  - NPC traffic spawning and movement
- `src/systems/rivals/HeatSystem.js`
  - Rival escalation and heat tracking
- `src/systems/rivals/RivalTaxiManager.js`
  - Rival taxi pooling, spawning, roles, and update coordination
- `src/systems/rivals/RivalTaxiAgent.js`
  - Individual rival taxi steering and behavior state
- `src/systems/rivals/SpawnSystem.js`
  - Rival spawn point selection outside the player's view
- `src/systems/rivals/SteeringBehaviors.js`
  - Lightweight seek, pursue, separation, and avoidance helpers
- `src/systems/MissionSystem.js`
  - Fare generation, five-choice pickup logic, special fare milestones, drop-off flow, and payout handling
- `src/systems/EnergySystem.js`
  - Energy drain, rooftop recharge stations, and depletion penalties
- `src/systems/EmpSystem.js`
  - EMP pickup spawning, inventory, activation, and blast effect
- `src/systems/CollisionSystem.js`
  - Building, traffic, rival, and blimp collision handling
- `src/systems/UIManager.js`
  - HUD layout, intro dialogue widget, title card, pause overlay, and navigator updates
- `src/systems/IntroDialogueManager.js`
  - JSON-driven intro narration sequencing and pause-aware playback
- `src/systems/MusicManager.js`
  - Playlist music playback, mute state, and keyboard track switching
- `src/data/introDialogue.json`
  - Intro narration metadata for portraits, transcript lines, and audio files
- `src/styles.css`
  - HUD and UI styling

## Notes

- This project currently has no backend or persistence.
- Most visuals are generated from primitive geometry rather than heavy environment assets.
- The city look is driven by procedural emissive windows, neon accents, fog, a sky dome, and lightweight bloom rather than heavy dynamic lights.
- The game is meant to be easy to iterate on through `src/game/config.js` and the systems under `src/systems/`.

## Additional Context

For a more detailed handoff document, see:

`PROJECT_CONTEXT.md`
