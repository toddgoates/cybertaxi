# CyberTaxi

![A futuristic hover taxi driving in a neon and glowing cyberpunk city](public/images/screenshot.png "CYBERTAXI")

A small arcade-style hover taxi game built with Three.js and Vite.

You pilot a futuristic cab through a neon city, pick up passengers, deliver them across districts, avoid crashes, and try to keep each fare profitable.

## Features

- Third-person hover taxi driving
- Procedural neon city with different districts
- Pickup and drop-off mission loop
- Fare timer, distance-scaled pricing, and collision penalties
- Boost system with recharge
- Collidable NPC traffic
- Energy system with rooftop recharge stations
- HUD with fare info, dispatch feed, and navigator
- Background music support with mute toggle

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

## Music Setup

If you want background music, place your mp3 here:

`public/audio/midnight_circuits_1.mp3`

The game will try to start music automatically when the game begins. Some browsers block autoplay until the first click or key press.

## Controls

- `W` / `S`: accelerate / brake
- `A` / `D`: steer
- `Q` / `E`: strafe left / right
- `J` / `K`: rise / descend
- `Space`: boost
- `M`: toggle music

Arrow keys also work for forward, brake, and steering.

## Gameplay

1. Fly to the blue pickup marker.
2. Pick up the passenger.
3. Follow the pink drop-off marker.
4. Deliver the passenger before the fare drops too much.

Important rules:

- Your fare value drains over time while a passenger is onboard.
- Crashes during a ride reduce the fare further.
- Crashing while boosting causes a larger penalty.
- Longer trips pay more than shorter trips.
- If a fare drops to `0`, the ride fails and you lose 50% of the original fare from your credits.
- Energy drains over time and faster while boosting.
- You must stay parked in an energy station for 5 seconds to refill.
- If energy hits `0` while carrying a passenger, you are charged a `1000` credit penalty.

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
- `src/systems/MissionSystem.js`
  - Fare generation, pickup/drop-off logic, and payout handling
- `src/systems/EnergySystem.js`
  - Energy drain, rooftop recharge stations, and depletion penalties
- `src/systems/CollisionSystem.js`
  - Building and traffic collision handling
- `src/systems/UIManager.js`
  - HUD layout and updates
- `src/systems/MusicManager.js`
  - Background music playback and mute state
- `src/styles.css`
  - HUD and UI styling

## Notes

- This project currently has no backend or persistence.
- Most visuals are generated from primitive geometry rather than external art assets.
- The game is meant to be easy to iterate on through `src/game/config.js` and the systems under `src/systems/`.

## Additional Context

For a more detailed handoff document, see:

`PROJECT_CONTEXT.md`
