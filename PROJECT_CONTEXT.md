# CyberTaxi Project Context

## Overview

`cybertaxi` is a small Three.js arcade prototype built with Vite. The player pilots a hovering taxi through a neon city, picks up passengers in one district, and drops them off in another while avoiding collisions that reduce fare payout.

The project is currently a lightweight, code-driven game with no external assets, no backend, and no save system.

## Tech Stack

- `three` for rendering, scene graph, lighting, geometry, and animation
- `vite` for local development and production builds
- Plain JavaScript modules, no framework
- Styling in `src/styles.css`

## Run Commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`

## Current Gameplay

- The player controls a hovering taxi in a third-person view.
- A mission loop selects a random pickup district and a different drop-off district.
- The active fare decreases over time during the drop-off phase.
- Collisions apply additional fare penalties.
- The HUD shows fare, objective, route, credits, district, thrust, dispatch feed, and a navigator.

## What Has Been Built So Far

### Core game loop

- Scene setup, lighting, camera, renderer, animation loop
- Procedural city generation with four themed districts
- Player movement with forward, reverse, turning, strafing, and vertical hover control
- Ambient and collidable traffic vehicles following district flight loops
- Mission flow for pickup and drop-off
- Collision penalties and feedback effects hooks

### HUD and mission guidance

- Top HUD panels for fare, objective, credits, and district
- Dispatch feed for mission and penalty events
- Lower-left navigator panel
- Navigator shows the active mission target relative to the player
- During pickup, navigator also shows the future drop-off as a secondary marker
- Top-right music control with mute toggle and looping background track support from `public/audio/`

### Vehicle art direction changes

- The player taxi has been reshaped into a more car-like hovering vehicle
- Main body color changed to off-white/light gray
- Added darker trim and visible side wheels
- Added a blue roof light
- Added animated light-blue hover flames under the car

### World scale changes

- The city was enlarged substantially so traversing from one end to another takes longer
- District spacing is now derived from config instead of fixed hardcoded centers
- District road/building footprint and traffic loops scale with city size

## Important Files

- `src/main.js`
  - Entry point that mounts and starts the game
- `src/game/GameApp.js`
  - Main composition root for scene, camera, systems, and frame update loop
- `src/game/config.js`
  - Global gameplay and world tuning values
- `src/systems/CityGenerator.js`
  - Procedural district generation, ground, rain, colliders, flight paths, and district lookup
- `src/systems/PlayerController.js`
  - Player vehicle mesh, movement, hover motion, and hover flame animation
- `src/systems/CameraController.js`
  - Third-person follow camera
- `src/systems/TrafficManager.js`
  - Spawns and updates AI traffic on flight loops
- `src/systems/MissionSystem.js`
  - Mission selection, pickup/drop-off zones, fare logic, and mission state exposed to UI
- `src/systems/CollisionSystem.js`
  - Player collisions against buildings and traffic
- `src/systems/UIManager.js`
  - HUD structure and rendering, including navigator logic and music controls
- `src/systems/MusicManager.js`
  - Looping background music playback, autoplay fallback, and mute state
- `src/styles.css`
  - All HUD styling including navigator placement in the lower-left corner

## Current Configuration Notes

At the time of writing:

- `worldSize` is `1800`
- `districtSize` is `560`
- Player top forward speed is `90`
- Mission pickup and drop-off radii are `12` and `14`

These values live in `src/game/config.js` and are the main place to tune feel and scale.

## Architecture Notes

- `GameApp` owns the systems and passes state into `UIManager.render(...)` each frame.
- Systems are mostly independent and communicate through simple method calls and shared state.
- Mission targets are represented both in-world as visible zone meshes and in UI state as target coordinates.
- The navigator is not a full map. It is a radar/compass-style relative indicator rendered in HTML/CSS.

## Known Limitations

- No persistence or game progression beyond total credits in memory
- No audio
- No menus, pause flow, settings, or rebinding UI
- No minimap with actual street or district geometry, only the relative navigator
- Traffic routes are simple loops per district, not a city-wide network
- Vehicle visuals are mesh primitives only

## Suggested Next Improvements

- Add a true minimap with district outlines or simple road traces
- Add more districts or inter-district traffic routes
- Add better mission variety such as timed bonuses or VIP fares
- Add environmental landmarks so larger districts are easier to navigate
- Add basic game states such as start screen, pause, and restart
- Add sound and music
- Improve vehicle art further with headlights, taillights, and a more sculpted front profile

## Notes For Future Chat Sessions

If continuing this project in another session, mention:

- This is a Vite + Three.js hover-taxi game prototype
- The city has already been enlarged and district placement now scales from config
- The HUD already includes a lower-left navigator panel for pickup and drop-off guidance
- The player car has already been updated to an off-white hovering car with wheels, blue roof light, and blue hover flames
- The main gameplay wiring lives in `GameApp`, `MissionSystem`, `PlayerController`, `CityGenerator`, and `UIManager`

This should give the next session enough context to continue without re-discovering the current state from scratch.
