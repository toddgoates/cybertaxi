# CyberTaxi

![A futuristic hover taxi driving in a neon and glowing cyberpunk city](public/images/screenshot.png "CYBERTAXI")

A small arcade-style hover taxi game built with Three.js and Vite.

You pilot a futuristic cab through a neon city, choose fares, deliver passengers across districts, evade hostile rival taxis, and try to keep each run profitable long enough to escape the city.

## Features

- Third-person hover taxi driving
- Procedural neon city with different districts
- Five-choice pickup and drop-off mission loop
- Milestone-based special fares with blue star pickup markers and high-value payouts
- Fake passenger ambushes after high-credit runs
- Full endgame sequence with survival phase, extraction marker, and win screen
- Fare timer, distance-scaled pricing, and collision penalties
- Boost system with recharge
- Collidable NPC traffic and heavier ambient city air traffic
- Heat-based rival taxi pursuit system with multiple enemy behaviors
- EMP pickups and inventory for crowd control
- Super Boost pickups with one-minute unlimited boost windows
- Energy system with rooftop recharge stations
- Crash sparks and crash sound effects on impacts
- Procedural weather, moving rooftop searchlights, and high-altitude neon blimps
- Intro narration, post-intro dialogue, item callouts, rival escalation callouts, crash chatter, fake passenger chatter, and low-energy dialogue with portrait/transcript widgets
- Multi-stage finale dialogue with survival chatter, shutdown chatter, extraction dialogue, and ending win screen
- Playlist music support with mute toggle and keyboard track switching
- Pause overlay and streamlined HUD with fare/credits, navigator, and lower-left systems card
- Optional dev performance overlay for long-session monitoring
- Contest widget script included in the app shell

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
- `public/audio/post_intro_1.mp3` through `public/audio/post_intro_5.mp3`

Item and alert dialogue files:

- `public/audio/item_1.mp3` through `public/audio/item_10.mp3`
- `public/audio/escalation_1.mp3` through `public/audio/escalation_20.mp3`
- `public/audio/crash_1.mp3` through `public/audio/crash_30.mp3`
- `public/audio/lowfuel_1.mp3` through `public/audio/lowfuel_10.mp3`
- `public/audio/fake_passenger_intro_1.mp3` through `public/audio/fake_passenger_intro_3.mp3`
- `public/audio/fake_passenger_1.mp3` through `public/audio/fake_passenger_10.mp3`
- `public/audio/final_1.mp3` through `public/audio/final_24.mp3`

Other sound effects currently used:

- `public/audio/crash.mp3`
- `public/audio/zap.mp3`

Image assets currently used:

- `public/images/player.png` for the intro dialogue portrait
- `public/images/partner.png` for partner dialogue portraits
- `public/images/taxi.png` for system / Axiom dialogue portraits

The game will try to start music and intro narration automatically when the game begins. Some browsers block autoplay until the first click or key press.

## Controls

- `W` / `S`: accelerate / brake
- `A` / `D`: steer
- `Q` / `E`: strafe left / right
- `J` / `K`: rise / descend
- `Space`: boost
- `L`: use EMP
- `P`: use Super Boost
- `Esc`: pause / resume
- `M`: toggle music
- `[` / `]`: previous / next music track

Arrow keys also work for forward, brake, and steering.

## Dev Query Params

When running `npm run dev`, you can seed debug state through URL params:

- `?credits=750`
- `?heat=4`
- `?rivals=6`
- `?energy=35`
- `?emp=3`
- `?super-boost=1`
- `?skip-intro=1`
- `?winner=1`
- `?final=1`
- `?perf=1`

These can be combined, for example:

`http://localhost:5173/?credits=1000&heat=5&rivals=8&energy=20&emp=4&super-boost=1&skip-intro=1&final=1&perf=1`

## Gameplay

1. Choose from the blue passenger pickup markers.
2. Fly into one pickup zone to lock in that fare.
3. Follow the pink drop-off marker.
4. Deliver the passenger before the fare drops too much.
5. Watch heat rise as you survive, earn, and complete fares.
6. Collect green EMP charges when they appear and use them if rival taxis start to swarm.
7. Collect orange Super Boost pickups when they appear to bank a one-minute unlimited boost item.
8. Watch for blue-star special fares that unlock every `350` credits earned.
9. After `4500` credits, watch out for fake passengers mixed into the normal pickup set.
10. Once you reach `10000` credits, fares stop and the endgame sequence begins.

Important rules:

- Your fare value drains over time while a passenger is onboard.
- Special fares unlock every `350` total credits and pay `300-500` credits.
- After `4500` credits, one of the five live pickup offers can be a fake passenger that steals `500-750` credits.
- Fake passengers look like normal pickups but have a subtle yellow flicker on the in-world beacon.
- Passenger pickup spots are pushed clear of building colliders so they stay near buildings without intersecting them.
- Crashes during a ride reduce the fare further.
- Crashing while boosting causes a larger penalty.
- Colliding with buildings, cars, rivals, or blimps throws off sparks and plays a crash sound.
- Longer trips pay more than shorter trips.
- If a fare drops to `0`, the ride fails and you lose 50% of the original fare from your credits.
- Energy drains over time and faster while boosting.
- You must stay parked in an energy station for 5 seconds to refill.
- If energy hits `0` while carrying a passenger, you are charged a `1000` credit penalty.
- Low-energy dialogue can trigger when energy crosses `20%`, `10%`, and `5%`.
- Rival taxis escalate with heat and can chase, intercept, block, ram, and swarm.
- Rival taxis back off while you are actively refueling at a station, then resume normal pursuit after you leave.
- EMP pickups spawn every 90 seconds and can be stored for later use.
- A single EMP blast can disable up to 10 nearby rival taxis.
- Super Boost pickups spawn randomly every few minutes and can be triggered later with `P`.
- The city includes moving rooftop searchlights, heavier rain, and large collidable neon blimps in the sky.
- Spoken dialogue ducks the music automatically while audio lines are playing.
- Gameplay voice lines are suppressed until the intro and post-intro sequences are fully finished.
- After `10000` credits, no new fares spawn, Heat 10 is gated behind finale dialogue, and the game transitions into a survival/endgame extraction sequence.
- During the survival phase, a hidden timer runs while 50 rivals pursue the player.
- After shutdown, a white extraction marker appears at the edge of the map; reaching it triggers the `You won!` screen.

## Project Structure

- `src/main.js`
  - App entry point
- `src/game/GameApp.js`
  - Main game bootstrap, runtime dialogue coordination, endgame flow, extraction, win state, and frame loop
- `src/game/config.js`
  - Tunable gameplay and world settings
- `src/systems/CityGenerator.js`
  - District generation, buildings, signs, billboards, and traffic paths
- `src/systems/PlayerController.js`
  - Player taxi mesh, movement, hover effects, boost behavior, and Super Boost state
- `src/systems/TrafficManager.js`
  - NPC traffic spawning and movement
- `src/systems/rivals/HeatSystem.js`
  - Rival escalation and heat tracking
- `src/systems/rivals/RivalTaxiManager.js`
  - Rival taxi pooling, spawning, roles, update coordination, and refuel backoff support
- `src/systems/rivals/RivalTaxiAgent.js`
  - Individual rival taxi steering and behavior state
- `src/systems/rivals/SpawnSystem.js`
  - Rival spawn point selection outside the player's view
- `src/systems/rivals/SteeringBehaviors.js`
  - Lightweight seek, pursue, separation, and avoidance helpers
- `src/systems/MissionSystem.js`
  - Fare generation, five-choice pickup logic, special fare milestones, fake passengers, finale trigger, drop-off flow, and payout handling
- `src/systems/EnergySystem.js`
  - Energy drain, rooftop recharge stations, depletion penalties, and refuel state exposure
- `src/systems/EmpSystem.js`
  - EMP pickup spawning, inventory, activation, and blast effect
- `src/systems/SuperBoostSystem.js`
  - Super Boost pickup spawning, inventory, and activation
- `src/systems/CollisionSystem.js`
  - Building, traffic, rival, and blimp collision handling
- `src/systems/UIManager.js`
  - HUD layout, dialogue widget, title card, win overlay, pause overlay, and navigator updates
- `src/systems/IntroDialogueManager.js`
  - JSON-driven intro narration sequencing and pause-aware playback
- `src/systems/VoiceoverManager.js`
  - Shared one-off spoken dialogue playback for items, rival spawns, crashes, and low energy
- `src/systems/PerformanceOverlay.js`
  - Optional dev overlay for scene/memory/draw-call/runtime counts
- `src/systems/MusicManager.js`
  - Playlist music playback, mute state, and keyboard track switching
- `src/data/introDialogue.json`
  - Intro narration metadata for portraits, transcript lines, and audio files
- `src/data/postIntroDialogue.json`
  - Post-intro dialogue metadata
- `src/data/itemDialogue.json`
  - Shared item-related voice lines used for EMP and Super Boost spawns
- `src/data/escalationDialogue.json`
  - Rival spawn callout dialogue metadata
- `src/data/crashDialogue.json`
  - Collision chatter dialogue metadata
- `src/data/lowFuelDialogue.json`
  - Low-energy warning dialogue metadata
- `src/data/fakePassengerIntroDialogue.json`
  - First fake-passenger event dialogue sequence
- `src/data/fakePassengerDialogue.json`
  - Repeat fake-passenger dialogue pool
- `src/data/finalDialogue.json`
  - Initial `10000` credit finale dialogue sequence
- `src/data/finalSurvivalDialogue.json`
  - Survival-phase chase dialogue sequence
- `src/data/finalResolutionDialogue.json`
  - Rival shutdown dialogue sequence
- `src/data/finalFiveDialogue.json`
  - Final Axiom line when only five rivals remain
- `src/data/finalEscapeDialogue.json`
  - Post-shutdown extraction dialogue sequence
- `src/styles.css`
  - HUD and UI styling

## Performance Debugging

- Add `?perf=1` to the URL to show a lightweight runtime overlay
- The overlay reports:
  - scene children
  - geometry count
  - texture count
  - draw calls
  - triangle count
  - active traffic / rivals / effects

## Notes

- This project currently has no backend or persistence.
- Most visuals are generated from primitive geometry rather than heavy environment assets.
- The city look is driven by procedural emissive windows, neon accents, fog, a sky dome, and lightweight bloom rather than heavy dynamic lights.
- The game is meant to be easy to iterate on through `src/game/config.js` and the systems under `src/systems/`.
- A lightweight long-session performance overlay is available with `?perf=1`.
- `index.html` includes the Vibe Jam contest widget script.
- For a more detailed handoff document, see `project_context.md`.

## Additional Context

For a more detailed handoff document, see:

`project_context.md`
