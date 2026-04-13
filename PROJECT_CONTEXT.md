# CyberTaxi Project Context

## Overview

`cybertaxi` is a browser-based Three.js arcade game built with Vite. The player pilots a hovering taxi through a stylized neon city, chooses between multiple passenger fares, delivers riders across districts, manages fare decay, traffic collisions, boost usage, energy consumption, and escalating rival taxi pressure.

The project is still a lightweight, code-driven game with no backend and no save system, but it now uses a growing set of local audio and image assets for music, intro narration, portraits, effects, item callouts, rival escalation chatter, crash chatter, and low-energy warnings.

## Tech Stack

- `three` for rendering, scene graph, geometry, animation, and lighting
- `vite` for development and builds
- Plain JavaScript modules, no framework
- Styling in `src/styles.css`
- Native browser `Audio` elements for music, intro dialogue, and gameplay voiceover

## Run Commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`

## Current Gameplay

- The player controls a hovering taxi in a third-person view.
- A mission loop presents five pickup choices, then locks one fare after selection and sends the player to a drop-off district.
- Every `350` total credits earned, the next mission batch includes a special priority fare with a blue-star pickup marker and a `300-500` credit payout.
- After `4500` credits, one of the five live pickup offers can be a fake passenger that steals `500-750` credits.
- The active fare decreases over time during the drop-off phase.
- Priority fares now decay at the same rate as normal fares; they are just worth much more.
- Fares scale with trip distance so longer trips start with higher quoted values.
- Collisions apply fare penalties, with larger penalties while boosting.
- Collisions also trigger spark VFX, crash audio, and optional crash chatter.
- The player manages an energy meter that drains over time and faster while boosting.
- Low-energy dialogue can trigger when energy crosses `20%`, `10%`, and `5%`.
- Rival taxis escalate via a heat system and can chase, intercept, block, ram, and swarm.
- Rival taxis back off while the player is actively refueling, then resume pursuit after the player leaves the station.
- EMP pickups spawn on the map, can be stored, and can disable nearby rival taxis.
- Super Boost pickups spawn on the map, can be stored, and provide a one-minute unlimited boost window when triggered.
- The city includes animated rain, moving rooftop searchlights, and large collidable neon blimps.
- The opening now includes JSON-driven narration with portrait/transcript UI, a title card reveal, and a post-intro dialogue beat.

## What Has Been Built So Far

### Core game loop

- Scene setup, lighting, camera, renderer, post-processing, and animation loop
- Procedural city generation with four themed districts
- Player movement with forward, reverse, turning, strafing, and vertical hover control
- Collidable NPC traffic following road and air lanes through each district
- Mission flow for five-choice pickup selection and drop-off
- Special fare milestone system with boosted payouts
- Collision penalties and collision feedback effects
- Distance-scaled fare generation and failed-fare penalties
- Energy system with rooftop recharge stations, depletion penalties, and threshold announcements
- Rival taxi AI with pooled agents, heat escalation, hidden spawns, and multiple steering behaviors
- EMP pickup system with inventory, activation, and disruption effect
- Super Boost pickup system with inventory and one-minute unlimited boost activation
- Pause state with overlay and audio pause support
- Fake passenger robbery flow with first-time and repeat dialogue responses

### HUD and presentation

- Top-right fare + credits card with district, heat, and rival count
- Lower-left thrust / boost / energy systems card with inline EMP and Super Boost inventory
- Lower-right navigator panel
- Upper-left dialogue card that shows portrait and transcript during intro and runtime voice lines
- Centered intro title card: `Todd Goates Presents` / `Cybertaxi`
- Simplified HUD layout after removing the older dispatch and objective widgets
- Navigator shows the active mission target relative to the player
- Navigator also shows yellow energy station dots, green EMP pickup markers, blue-star special fare markers, and orange Super Boost markers
- Fake passenger pickup beacons use a subtle yellow flicker while still looking mostly like normal passenger markers
- Energy meter and charging progress ring for rooftop refueling
- Boost meter changes to an orange highlighted state while Super Boost is active
- Keyboard-driven music controls with mute and track switching

### Audio and dialogue systems

- Intro dialogue is driven by `src/data/introDialogue.json`
- Post-intro dialogue is driven by `src/data/postIntroDialogue.json`
- Each intro line maps an audio file, portrait image, and transcript block
- Intro narration plays over ducked music, with the music swelling back to full volume at the end
- Background music now plays from a playlist instead of a single looping file
- Crash sound plays on collision and EMP uses its own zap sound
- Item, rival spawn, crash, and low-energy chatter all route through `VoiceoverManager`
- Fake passenger robbery dialogue also routes through the dialogue widget and music ducking path
- Item dialogue is shared for EMP and Super Boost spawn announcements
- Rival spawn dialogue has a `60` second cooldown
- Crash dialogue has a `15` second cooldown
- Low-energy dialogue has no cooldown and is threshold-driven
- `skip-intro=1` can bypass the intro sequence in dev or regular local use
- Gameplay voice lines are suppressed until the intro and post-intro sequences are finished

### Vehicle and feedback changes

- The player taxi has been reshaped into a more car-like hovering vehicle
- Main body color is off-white/light gray with darker trim
- Added cockpit shaping, running lights, rear light bar, underglow, hover flames, and boost flames
- Added stronger tilt/bob feedback while keeping movement yaw separate from visual tilt
- Added collision sparks with yellow/orange particles
- Added Super Boost support on the player, including a one-minute unlimited boost state
- Boost visuals now shift orange while Super Boost is active

### Environment and rendering changes

- Buildings use procedural emissive window textures instead of mostly dark silhouettes
- Added stronger district color variation across cyan, magenta, purple, yellow, blue, and industrial orange tones
- Added selective neon facade strips, rooftop glow crowns, panels, and billboards
- Added a sky dome gradient, horizon glow, and atmospheric fog tuning
- Added lightweight bloom with `UnrealBloomPass`
- Added animated rain streaks centered around the player so the city is always raining
- Added rooftop searchlights and large sky blimps as additional set dressing and obstacles
- District ground overlap was corrected to stop border flicker between district color zones
- Added orange Super Boost pickups and orange navigator markers for them
- Pickup spots are adjusted away from building colliders so they do not overlap structures

### Balancing and progression-related changes

- Player hover ceiling was raised to `220`
- Rival escalation and traffic density were increased from earlier values
- Base fares and average payouts were nudged upward
- Time-based fare decay was slowed to `1.5` credits per second
- Special fare unlock threshold was lowered from `500` to `350`
- EMP spawn interval was reduced to `90` seconds

### Performance and stability changes

- Added a lightweight dev performance overlay enabled via `?perf=1`
- Reworked navigator marker rendering to reuse DOM nodes instead of rebuilding with `innerHTML` every frame
- Reworked collision spark effects to use a fixed reusable pool instead of creating and disposing point clouds per impact
- Reduced per-frame `Vector3` / `Quaternion` churn in traffic, player, and collision systems
- Fixed traffic hover bob so it no longer accumulates vertical drift over time
- Added explicit destroy/cleanup helpers for input, UI, audio, intro systems, effects, and renderer ownership paths

## Important Files

- `src/main.js`
  - Entry point, dev query-param parsing, and app startup
- `src/game/GameApp.js`
  - Main composition root for scene, camera, systems, intro flow, runtime dialogue coordination, pause flow, and frame update loop
- `src/game/config.js`
  - Global gameplay, world, traffic, rival, energy, EMP, Super Boost, and mission tuning values
- `src/data/introDialogue.json`
  - Intro narration metadata for portraits, transcripts, and audio files
- `src/data/postIntroDialogue.json`
  - Post-intro dialogue metadata
- `src/data/fakePassengerIntroDialogue.json`
  - First fake-passenger robbery dialogue sequence
- `src/data/fakePassengerDialogue.json`
  - Repeat fake-passenger robbery dialogue pool
- `src/data/itemDialogue.json`
  - Shared item voiceover metadata for EMP and Super Boost spawns
- `src/data/escalationDialogue.json`
  - Rival spawn voiceover metadata
- `src/data/crashDialogue.json`
  - Crash chatter voiceover metadata
- `src/data/lowFuelDialogue.json`
  - Low-energy warning voiceover metadata
- `src/systems/CityGenerator.js`
  - Procedural district generation, sky, rain, searchlights, blimps, colliders, flight paths, and district lookup
- `src/systems/PlayerController.js`
  - Player vehicle mesh, movement, hover motion, underglow, thruster animation, and Super Boost state
- `src/systems/CameraController.js`
  - Third-person follow camera
- `src/systems/TrafficManager.js`
  - Ambient and collidable traffic spawning and movement with reduced per-frame allocation churn
- `src/systems/rivals/HeatSystem.js`
  - Heat accumulation and decay that drives rival escalation
- `src/systems/rivals/RivalTaxiManager.js`
  - Pooled rival taxi orchestration, spawn pacing, debug seeding, spawn announcements, refuel backoff, and disruption handling
- `src/systems/rivals/RivalTaxiAgent.js`
  - Individual rival taxi mesh, behavior selection, and steering update
- `src/systems/rivals/SpawnSystem.js`
  - Spawn placement outside the player's immediate view and away from buildings
- `src/systems/rivals/SteeringBehaviors.js`
  - Shared steering helpers used by rival agents
- `src/systems/MissionSystem.js`
  - Mission selection, live pickup zones, special fare logic, fake passengers, distance-scaled fare logic, and payout handling
- `src/systems/EnergySystem.js`
  - Energy drain, rooftop station placement/interaction, depletion penalties, and low-energy threshold announcements
- `src/systems/EmpSystem.js`
  - EMP pickup spawning, inventory, activation, blast VFX state, and EMP sound playback
- `src/systems/SuperBoostSystem.js`
  - Super Boost pickup spawning, inventory, activation, and navigator target exposure
- `src/systems/CollisionSystem.js`
  - Player collisions against buildings, traffic, rivals, and blimps with reduced temporary allocation churn
- `src/systems/EffectsHooks.js`
  - Pooled collision spark particles and crash sound support
- `src/systems/UIManager.js`
  - HUD structure and rendering, including dialogue card, title card, navigator logic, systems card, and pause overlay
- `src/systems/IntroDialogueManager.js`
  - JSON-driven intro narration sequencing with pause-aware playback
- `src/systems/VoiceoverManager.js`
  - Shared one-off spoken dialogue playback for gameplay-triggered voice lines
- `src/systems/PerformanceOverlay.js`
  - Optional dev-only runtime overlay for scene/memory/render/effect counts
- `src/systems/MusicManager.js`
  - Playlist-based background music playback, autoplay fallback, mute state, and track switching
- `src/styles.css`
  - HUD styling, intro card styling, dialogue widget styling, and panel positioning

## Current Configuration Notes

At the time of writing:

- `worldSize` is `3600`
- `districtSize` is `1120`
- `districtSpacing` is `520`
- Player top forward speed is `90`
- Player hover ceiling is `220`
- Mission pickup and drop-off radii are `12` and `14`
- Regular fare decay is `1.5` credits per second
- Special fare unlock threshold is `350` credits
- Special fare payout range is `300-500` credits
- Fake passengers begin appearing at `4500` credits
- Energy stations require `5` seconds parked in-zone to refill
- EMP pickups spawn every `90` seconds
- EMP can remove up to `10` nearby rival taxis per use
- Super Boost lasts `60` seconds once activated

These values live in `src/game/config.js` and are the main place to tune feel and scale.

## Dev Query Params

When running locally, the game currently supports:

- `credits=<number>`
- `heat=<number>`
- `rivals=<number>`
- `energy=<number>`
- `emp=<number>`
- `super-boost=1`
- `skip-intro=1`
- `perf=1`

Example:

`http://localhost:5173/?credits=1000&heat=5&rivals=8&energy=20&emp=4&super-boost=1&skip-intro=1`

## Asset Expectations

Current runtime asset locations:

- Music playlist:
  - `public/audio/music_1.mp3`
  - `public/audio/music_2.mp3`
  - `public/audio/music_3.mp3`
- Intro dialogue:
  - `public/audio/intro_1.mp3` through `public/audio/intro_7.mp3`
- Post-intro dialogue:
  - `public/audio/post_intro_1.mp3` through `public/audio/post_intro_5.mp3`
- Item dialogue:
  - `public/audio/item_1.mp3` through `public/audio/item_10.mp3`
- Rival escalation dialogue:
  - `public/audio/escalation_1.mp3` through `public/audio/escalation_20.mp3`
- Crash dialogue:
  - `public/audio/crash_1.mp3` through `public/audio/crash_30.mp3`
- Low-energy dialogue:
  - `public/audio/lowfuel_1.mp3` through `public/audio/lowfuel_10.mp3`
- Fake-passenger intro dialogue:
  - `public/audio/fake_passenger_intro_1.mp3` through `public/audio/fake_passenger_intro_3.mp3`
- Fake-passenger repeat dialogue:
  - `public/audio/fake_passenger_1.mp3` through `public/audio/fake_passenger_10.mp3`
- Sound effects:
  - `public/audio/crash.mp3`
  - `public/audio/zap.mp3`
- Portraits:
  - `public/images/player.png`
  - `public/images/partner.png`
  - `public/images/taxi.png`

## Architecture Notes

- `GameApp` owns the systems and passes state into `UIManager.render(...)` each frame.
- Systems are mostly independent and communicate through simple method calls and shared state.
- Mission targets are represented both in-world as visible zone meshes and in UI state as target coordinates.
- Energy stations are selected from tall rooftops generated in the city.
- Searchlights are chosen from tall rooftops that are not already used as energy stations.
- EMP pickups are represented both in-world and in UI state as navigator targets.
- Super Boost pickups are represented both in-world and in UI state as orange navigator targets.
- Passenger pickup candidates are clearance-checked against building colliders before use.
- Rival taxis are pooled and updated centrally to stay browser-friendly.
- City richness is driven mostly by emissive materials, procedural textures, and lightweight post-processing rather than runtime lights.
- The navigator is not a full map. It is a radar/compass-style relative indicator rendered in HTML/CSS.
- Music and intro narration both use browser `Audio` elements with autoplay fallback via user interaction.
- Gameplay voice lines also use browser `Audio` elements through `VoiceoverManager`, which coordinates dialogue widget use and music ducking.
- The app shell includes the external Vibe Jam contest widget script in `index.html`.
- Rain is rendered as a player-centered streak volume so coverage remains consistent across the whole city.

## Known Limitations

- No persistence or game progression beyond total credits in memory
- No menus, settings, or rebinding UI
- No minimap with actual street or district geometry, only the relative navigator
- Traffic routes are simple fixed lanes per district, not a city-wide dynamic network
- Vehicle visuals are still primarily primitive meshes
- Intro dialogue sequencing currently assumes one portrait/transcript block per audio clip rather than per-word timing data

## Suggested Next Improvements

- Add a true minimap with district outlines or simple road traces
- Add more districts or inter-district traffic routes
- Add better mission variety beyond the current special fare system
- Add environmental landmarks so larger districts are easier to navigate
- Add basic game states such as a start screen and restart flow
- Add more sound design beyond the current intro/music/voiceover/crash/EMP playback
- Improve vehicle art further with headlights, taillights, and a more sculpted front profile
- Add more reactions for disrupted rivals, such as spark-outs or crash spirals after EMP use

## Notes For Future Chat Sessions

If continuing this project in another session, mention:

- This is a Vite + Three.js hover-taxi game prototype
- The city scales from config and now includes rain, searchlights, blimps, and more traffic
- The HUD now uses a top-right fare/credits card, lower-left systems card, lower-right navigator, upper-left dialogue widget, and pause/title overlays
- The player car has been updated to an off-white hovering car with wheels, underglow, roof light, hover flames, boost flames, and a Super Boost state
- The game includes collidable NPC traffic, rival taxi AI, special fares, failed-fare penalties, rooftop energy stations, EMP pickups, and Super Boost pickups
- Intro narration is data-driven from `src/data/introDialogue.json`
- Additional gameplay voiceover data lives in `itemDialogue.json`, `escalationDialogue.json`, `crashDialogue.json`, and `lowFuelDialogue.json`
- Fake passenger dialogue data lives in `fakePassengerIntroDialogue.json` and `fakePassengerDialogue.json`
- Music now plays from a playlist with `[` and `]` track switching and `M` mute
- Dev URL flags include `credits`, `heat`, `rivals`, `energy`, `emp`, `super-boost`, `skip-intro`, and `perf`
- The main gameplay wiring lives in `GameApp`, `MissionSystem`, `PlayerController`, `CityGenerator`, `EnergySystem`, `EmpSystem`, `SuperBoostSystem`, `RivalTaxiManager`, `UIManager`, `MusicManager`, `VoiceoverManager`, `IntroDialogueManager`, and `PerformanceOverlay`

This should give the next session enough context to continue without re-discovering the current state from scratch.
