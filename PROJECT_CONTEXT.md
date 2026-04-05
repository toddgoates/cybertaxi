# CyberTaxi Project Context

## Overview

`cybertaxi` is a small Three.js arcade prototype built with Vite. The player pilots a hovering taxi through a neon city, chooses between multiple passenger fares, drops riders off across districts, manages fare decay, traffic collisions, boost usage, energy consumption, and escalating rival taxi pressure.

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
- A mission loop presents five pickup choices, then locks one fare after selection and sends the player to a drop-off district.
- The active fare decreases over time during the drop-off phase.
- Fares scale with trip distance so longer trips start with higher quoted values.
- Collisions apply fare penalties, with larger penalties while boosting.
- The player manages an energy meter that drains over time and faster while boosting.
- Rival taxis escalate via a heat system and can chase, intercept, block, ram, and swarm.
- EMP pickups spawn on the map, can be stored, and can disable nearby rival taxis.
- The HUD shows fare, objective, route, credits, district, heat, rival count, EMP inventory, thrust, boost, energy, dispatch feed, music state, and a navigator.

## What Has Been Built So Far

### Core game loop

- Scene setup, lighting, camera, renderer, animation loop
- Procedural city generation with four themed districts
- Player movement with forward, reverse, turning, strafing, and vertical hover control
- Collidable NPC traffic following road and air lanes through each district
- Mission flow for five-choice pickup selection and drop-off
- Collision penalties and feedback effects hooks
- Distance-scaled fare generation and failed-fare penalties
- Energy system with rooftop recharge stations and depletion penalties
- Rival taxi AI with pooled agents, heat escalation, hidden spawns, and multiple steering behaviors
- EMP pickup system with inventory, activation, and green pulse effect
- Pause state with overlay

### HUD and mission guidance

- Top HUD panels for fare, objective, credits, and district
- Dispatch feed for mission and penalty events
- Lower-left navigator panel
- Navigator shows the active mission target relative to the player
- Top-right music control with mute toggle and looping background track support from `public/audio/`
- Navigator also shows yellow energy station dots
- Navigator also shows green EMP pickup targets when present
- Energy meter and charging progress ring for rooftop refueling
- Pause overlay and EMP inventory badge in the HUD

### Vehicle art direction changes

- The player taxi has been reshaped into a more car-like hovering vehicle
- Main body color changed to off-white/light gray
- Added darker trim and visible side wheels
- Added a blue roof light
- Added animated light-blue hover flames under the car

### Rival pressure and combat-lite additions

- Rival taxis are all yellow for clear visual identification
- Heat rises over time, from earnings, completed fares, perfect fares, and risky high-speed play
- Heat currently ramps more slowly than the first pass to avoid overwhelming early runs
- Rival taxis use lightweight steering behaviors instead of heavy pathfinding
- EMP charges spawn every 2 minutes as green map beacons and can be saved up to clear nearby rivals

### Environment and rendering changes

- Buildings now use procedural emissive window textures instead of mostly dark silhouettes
- Added stronger district color variation across cyan, magenta, purple, and yellow tones
- Added neon facade strips, rooftop glow crowns, and glowing panels/billboards
- Added a sky dome gradient and horizon glow
- Fog and lighting were retuned for a brighter, more alive nighttime look
- Added lightweight bloom with `UnrealBloomPass`
- District building placement was tightened to reduce large open gaps between blocks

### World scale changes

- The city was enlarged substantially so traversing from one end to another takes longer
- District spacing is now derived from config instead of fixed hardcoded centers
- District road/building footprint and traffic loops scale with city size
- Added larger glowing billboards to liven up the skyline

## Important Files

- `src/main.js`
  - Entry point that mounts and starts the game
- `src/game/GameApp.js`
  - Main composition root for scene, camera, systems, postprocessing, pause flow, and frame update loop
- `src/game/config.js`
  - Global gameplay, world, rival, and EMP tuning values
- `src/systems/CityGenerator.js`
  - Procedural district generation, emissive facades, sky, fog-friendly visuals, colliders, flight paths, and district lookup
- `src/systems/PlayerController.js`
  - Player vehicle mesh, movement, hover motion, and hover flame animation
- `src/systems/CameraController.js`
  - Third-person follow camera
- `src/systems/TrafficManager.js`
  - Spawns and updates collidable NPC traffic on road and air routes
- `src/systems/rivals/HeatSystem.js`
  - Heat accumulation and decay that drives rival escalation
- `src/systems/rivals/RivalTaxiManager.js`
  - Pooled rival taxi orchestration, spawn pacing, and disruption handling
- `src/systems/rivals/RivalTaxiAgent.js`
  - Individual rival taxi mesh, behavior selection, and steering update
- `src/systems/rivals/SpawnSystem.js`
  - Spawn placement outside the player's immediate view and away from buildings
- `src/systems/rivals/SteeringBehaviors.js`
  - Shared steering helpers used by rival agents
- `src/systems/MissionSystem.js`
  - Mission selection, five live pickup zones, distance-scaled fare logic, failure penalties, and mission state exposed to UI
- `src/systems/EnergySystem.js`
  - Energy drain, rooftop station placement/interaction, and depletion penalties
- `src/systems/EmpSystem.js`
  - EMP pickup spawning, inventory, activation, and blast VFX state
- `src/systems/CollisionSystem.js`
  - Player collisions against buildings, traffic, and rival taxis
- `src/systems/UIManager.js`
  - HUD structure and rendering, including navigator logic, energy display, charging ring, pause overlay, EMP inventory, and music controls
- `src/systems/MusicManager.js`
  - Looping background music playback, autoplay fallback, and mute state
- `src/styles.css`
  - All HUD styling including navigator placement in the lower-left corner

## Current Configuration Notes

At the time of writing:

- `worldSize` is `3600`
- `districtSize` is `1120`
- `districtSpacing` is `520`
- Player top forward speed is `90`
- Mission pickup and drop-off radii are `12` and `14`
- Energy stations require `5` seconds parked in-zone to refill
- EMP pickups spawn every `120` seconds
- EMP can remove up to `10` nearby rival taxis per use

These values live in `src/game/config.js` and are the main place to tune feel and scale.

## Architecture Notes

- `GameApp` owns the systems and passes state into `UIManager.render(...)` each frame.
- Systems are mostly independent and communicate through simple method calls and shared state.
- Mission targets are represented both in-world as visible zone meshes and in UI state as target coordinates.
- Energy stations are selected from the tallest rooftops generated in the city and rendered as yellow beacon markers.
- EMP pickups are represented both in-world as green beacon markers and in UI state as navigator targets.
- Rival taxis are pooled and updated centrally to stay browser-friendly.
- City richness is driven mostly by emissive materials, procedural textures, and lightweight postprocessing rather than runtime lights.
- The navigator is not a full map. It is a radar/compass-style relative indicator rendered in HTML/CSS.

## Known Limitations

- No persistence or game progression beyond total credits in memory
- No menus, settings, or rebinding UI
- No minimap with actual street or district geometry, only the relative navigator
- Traffic routes are simple fixed lanes per district, not a city-wide dynamic network
- Vehicle visuals are mesh primitives only

## Suggested Next Improvements

- Add a true minimap with district outlines or simple road traces
- Add more districts or inter-district traffic routes
- Add better mission variety such as timed bonuses or VIP fares
- Add environmental landmarks so larger districts are easier to navigate
- Add basic game states such as start screen and restart
- Add more sound design beyond the current music playback
- Improve vehicle art further with headlights, taillights, and a more sculpted front profile
- Add more reactions for disrupted rivals, such as spark-outs or crash spirals after EMP use

## Notes For Future Chat Sessions

If continuing this project in another session, mention:

- This is a Vite + Three.js hover-taxi game prototype
- The city has already been enlarged and district placement now scales from config
- The HUD includes a lower-left navigator, energy meter, charging ring, EMP inventory, and pause overlay
- The player car has been updated to an off-white hovering car with wheels, blue roof light, blue hover flames, and boost flames
- The game includes collidable NPC traffic, rival taxi AI, distance-scaled fares, failed-fare penalties, rooftop energy stations, and EMP pickups
- The city visuals now rely on emissive procedural windows, neon accents, fog, a sky dome, and lightweight bloom
- The main gameplay wiring lives in `GameApp`, `MissionSystem`, `PlayerController`, `CityGenerator`, `EnergySystem`, `EmpSystem`, `RivalTaxiManager`, and `UIManager`

This should give the next session enough context to continue without re-discovering the current state from scratch.
