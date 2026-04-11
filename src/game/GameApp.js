import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GAME_CONFIG } from './config.js';
import { InputManager } from '../systems/InputManager.js';
import { PlayerController } from '../systems/PlayerController.js';
import { CameraController } from '../systems/CameraController.js';
import { CityGenerator } from '../systems/CityGenerator.js';
import { TrafficManager } from '../systems/TrafficManager.js';
import { MissionSystem } from '../systems/MissionSystem.js';
import { CollisionSystem } from '../systems/CollisionSystem.js';
import { UIManager } from '../systems/UIManager.js';
import { EffectsHooks } from '../systems/EffectsHooks.js';
import { MusicManager } from '../systems/MusicManager.js';
import { EnergySystem } from '../systems/EnergySystem.js';
import { RivalTaxiManager } from '../systems/rivals/RivalTaxiManager.js';
import { EmpSystem } from '../systems/EmpSystem.js';
import { SuperBoostSystem } from '../systems/SuperBoostSystem.js';
import { IntroDialogueManager } from '../systems/IntroDialogueManager.js';
import { VoiceoverManager } from '../systems/VoiceoverManager.js';
import introDialogue from '../data/introDialogue.json';
import itemDialogue from '../data/itemDialogue.json';
import crashDialogue from '../data/crashDialogue.json';
import escalationDialogue from '../data/escalationDialogue.json';
import postIntroDialogue from '../data/postIntroDialogue.json';

const INTRO_TITLE_CARD_DURATION_SECONDS = 4.2;
const POST_INTRO_DELAY_AFTER_TITLE_SECONDS = 2.5;
const RIVAL_DIALOGUE_COOLDOWN_SECONDS = 60;
const CRASH_DIALOGUE_COOLDOWN_SECONDS = 15;

export class GameApp {
  constructor(mount, options = {}) {
    this.mount = mount;
    this.options = options;
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x120f22);
    this.scene.fog = new THREE.FogExp2(0x28194a, 0.0032);

    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.mount.appendChild(this.renderer.domElement);
    this.setupPostProcessing();

    this.input = new InputManager();
    this.ui = new UIManager(this.mount);
    this.effects = new EffectsHooks(this.scene);
    this.music = new MusicManager([
      '/audio/music_1.mp3',
      '/audio/music_2.mp3',
      '/audio/music_3.mp3',
    ]);
    this.introDialogue = new IntroDialogueManager(introDialogue, 300);
    this.postIntroDialogue = new IntroDialogueManager(postIntroDialogue, 250);
    this.voiceover = new VoiceoverManager();
    this.pendingPostIntroDelay = null;
    this.rivalDialogueCooldown = 0;
    this.crashDialogueCooldown = 0;
    this.ui.setMusicToggleHandler(() => this.music.toggleMute());

    this.setupLights();

    this.city = new CityGenerator(this.scene, GAME_CONFIG);
    this.worldData = this.city.build();

    this.player = new PlayerController(this.scene, this.input, GAME_CONFIG, this.worldData.spawnPoint);
    this.traffic = new TrafficManager(this.scene, GAME_CONFIG, this.worldData.flightPaths);
    this.missions = new MissionSystem(this.scene, this.worldData, GAME_CONFIG, this.ui, this.effects);
    this.energy = new EnergySystem(this.scene, this.worldData, GAME_CONFIG, this.ui, this.missions);
    this.collisions = new CollisionSystem(this.worldData.colliders, GAME_CONFIG, this.ui, this.effects);
    this.rivals = new RivalTaxiManager(this.scene, GAME_CONFIG, this.worldData, this.ui);
    this.emp = new EmpSystem(this.scene, this.input, this.worldData, GAME_CONFIG, this.ui);
    this.superBoost = new SuperBoostSystem(this.scene, this.input, this.worldData, GAME_CONFIG, this.ui, this.player);
    this.cameraController = new CameraController(this.camera, this.player.mesh, GAME_CONFIG);
    this.paused = false;

    this.applyDebugFlags();

    this.resizeHandler = () => this.onResize();
    window.addEventListener('resize', this.resizeHandler);
  }

  applyDebugFlags() {
    if (!import.meta.env.DEV || !this.options.debug) return;

    const { startingCredits, startingHeat, startingRivals, startingEmpCharges, startingSuperBoost } = this.options.debug;
    const applied = [];

    if (startingCredits != null) {
      this.missions.setStartingCredits(startingCredits);
      applied.push(`credits=${startingCredits}`);
    }

    if (startingHeat != null || startingRivals != null) {
      const result = this.rivals.setDebugState({
        startingHeat,
        startingRivals,
        player: this.player,
        missionState: this.missions.getState(),
      });

      if (startingHeat != null) applied.push(`heat=${result.heat}`);
      if (startingRivals != null) applied.push(`rivals=${result.rivals}`);
    }

    if (startingEmpCharges != null) {
      this.emp.setStartingCharges(startingEmpCharges);
      applied.push(`emp=${this.emp.charges}`);
    }

    if (startingSuperBoost) {
      this.superBoost.setStartingCharges(1);
      applied.push('super-boost=1');
    }

    if (applied.length > 0) {
      this.ui.pushFeed(`DEV flags active: ${applied.join(' | ')}`, 'info');
    }
  }

  setupLights() {
    const hemi = new THREE.HemisphereLight(0x7fd7ff, 0x1b1022, 1.45);
    this.scene.add(hemi);

    const ambient = new THREE.AmbientLight(0x8e6cff, 0.58);
    this.scene.add(ambient);
  }

  setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.65,
      0.45,
      0.72,
    );
    this.composer.addPass(this.bloomPass);
  }

  start() {
    if (this.options.debug?.skipIntro) {
      this.music.start();
    } else {
      this.music.start(0.3);
      this.introDialogue.start({
        onEntryStart: (entry) => this.ui.showDialogue(entry),
        onEntryEnd: () => this.ui.hideDialogue(),
        onComplete: () => {
          this.music.setVolumeScale(1);
          this.ui.showIntroCard('Todd Goates Presents', 'Cybertaxi');
          this.pendingPostIntroDelay = INTRO_TITLE_CARD_DURATION_SECONDS + POST_INTRO_DELAY_AFTER_TITLE_SECONDS;
        },
      });
    }
    this.animate();
  }

  startPostIntroDialogue() {
    this.postIntroDialogue.start({
      onEntryStart: (entry) => {
        this.music.setVolumeScale(0.24);
        this.ui.showDialogue(entry);
      },
      onEntryEnd: () => this.ui.hideDialogue(),
      onComplete: () => {
        this.music.setVolumeScale(1);
        this.ui.hideDialogue();
      },
    });
  }

  playItemAnnouncement(alertText) {
    const entry = itemDialogue[Math.floor(Math.random() * itemDialogue.length)];
    this.ui.showAlert(alertText);
    this.voiceover.play(entry, {
      onStart: (dialogueEntry) => {
        this.music.setVolumeScale(0.22);
        this.ui.showDialogue(dialogueEntry);
      },
      onComplete: () => {
        this.music.setVolumeScale(1);
        this.ui.hideDialogue();
      },
    });
  }

  playEscalationAnnouncement() {
    const entry = escalationDialogue[Math.floor(Math.random() * escalationDialogue.length)];
    this.ui.showAlert('A new Axiom Mobility taxi has been spotted!');
    this.rivalDialogueCooldown = RIVAL_DIALOGUE_COOLDOWN_SECONDS;
    this.voiceover.play(entry, {
      onStart: (dialogueEntry) => {
        this.music.setVolumeScale(0.22);
        this.ui.showDialogue(dialogueEntry);
      },
      onComplete: () => {
        this.music.setVolumeScale(1);
        this.ui.hideDialogue();
      },
    });
  }

  playCrashDialogue() {
    const entry = crashDialogue[Math.floor(Math.random() * crashDialogue.length)];
    this.crashDialogueCooldown = CRASH_DIALOGUE_COOLDOWN_SECONDS;
    this.voiceover.play(entry, {
      onStart: (dialogueEntry) => {
        this.music.setVolumeScale(0.22);
        this.ui.showDialogue(dialogueEntry);
      },
      onComplete: () => {
        this.music.setVolumeScale(1);
        this.ui.hideDialogue();
      },
    });
  }

  animate = () => {
    requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.033);

    if (this.input.consumePress('pause')) {
      this.paused = !this.paused;
      this.music.setPaused(this.paused);
      this.introDialogue.setPaused(this.paused);
      this.postIntroDialogue.setPaused(this.paused);
      this.voiceover.setPaused(this.paused);
    }

    if (!this.paused) {
      this.music.update(delta);
      this.rivalDialogueCooldown = Math.max(0, this.rivalDialogueCooldown - delta);
      this.crashDialogueCooldown = Math.max(0, this.crashDialogueCooldown - delta);
      if (this.pendingPostIntroDelay != null) {
        this.pendingPostIntroDelay = Math.max(0, this.pendingPostIntroDelay - delta);
        if (this.pendingPostIntroDelay === 0) {
          this.pendingPostIntroDelay = null;
          this.startPostIntroDialogue();
        }
      }
      this.city.update(delta, this.player.mesh.position);
      this.player.update(delta, this.energy.getDriveState());
      this.traffic.update(delta);
      this.energy.update(delta, this.player);
      const missionState = this.missions.getState();
      this.rivals.update(delta, this.player, missionState);
      this.emp.update(delta, this.player, this.rivals);
      this.superBoost.update(delta, this.player);
      const empSpawn = this.emp.consumeSpawnEvent();
      if (empSpawn) {
        this.playItemAnnouncement('An EMP appeared!');
      }
      const superBoostSpawn = this.superBoost.consumeSpawnEvent();
      if (superBoostSpawn) {
        this.playItemAnnouncement('A Super Boost appeared!');
      }
      if (this.rivals.consumeSpawnAnnouncement()) {
        if (!this.voiceover.isActive() && this.rivalDialogueCooldown === 0) {
          this.playEscalationAnnouncement();
        } else {
          this.ui.showAlert('A new Axiom Mobility taxi has been spotted!');
        }
      }
      this.effects.update(delta);

      const trafficColliders = this.traffic.getCollidableVehicles();
      const rivalColliders = this.rivals.getCollidableVehicles();
      const collisionEvents = this.collisions.resolvePlayerCollisions(this.player, [...trafficColliders, ...rivalColliders], delta);
      collisionEvents.forEach((event) => {
        this.missions.applyCollisionPenalty(event.penalty, event.source);
        this.effects.onCollision(event.position, event.normal);
        if (event.enemy) {
          this.rivals.onCollision(event.penalty / GAME_CONFIG.mission.collisionPenalty);
        }
      });
      if (collisionEvents.length > 0 && !this.voiceover.isActive() && this.crashDialogueCooldown === 0) {
        this.playCrashDialogue();
      }

      this.missions.update(delta, this.player, this.traffic.getVehicles());
      this.cameraController.update(delta, this.player.velocity);
    }

    const nextMissionState = this.missions.getState();

    this.ui.render({
      player: this.player,
      mission: nextMissionState,
      energy: this.energy.getState(),
      district: this.worldData.getDistrictName(this.player.mesh.position),
      music: this.music.getState(),
      rivals: this.rivals.getState(),
      emp: this.emp.getState(),
      superBoost: this.superBoost.getState(),
      paused: this.paused,
    });

    this.composer.render();
  };

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }
}
