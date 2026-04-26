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
import { PerformanceOverlay } from '../systems/PerformanceOverlay.js';
import introDialogue from '../data/introDialogue.json';
import itemDialogue from '../data/itemDialogue.json';
import crashDialogue from '../data/crashDialogue.json';
import fakePassengerIntroDialogue from '../data/fakePassengerIntroDialogue.json';
import fakePassengerDialogue from '../data/fakePassengerDialogue.json';
import finalDialogue from '../data/finalDialogue.json';
import finalFiveDialogue from '../data/finalFiveDialogue.json';
import finalEscapeDialogue from '../data/finalEscapeDialogue.json';
import finalResolutionDialogue from '../data/finalResolutionDialogue.json';
import finalSurvivalDialogue from '../data/finalSurvivalDialogue.json';
import lowFuelDialogue from '../data/lowFuelDialogue.json';
import lightningDialogue from '../data/lightningDialogue.json';
import escalationDialogue from '../data/escalationDialogue.json';
import postIntroDialogue from '../data/postIntroDialogue.json';
import stormStartDialogue from '../data/stormStartDialogue.json';
import stormEndDialogue from '../data/stormEndDialogue.json';
import jamRelayStartDialogue from '../data/jamRelayStartDialogue.json';
import jamRelayHintOneDialogue from '../data/jamRelayHintOneDialogue.json';
import jamRelayHintTwoDialogue from '../data/jamRelayHintTwoDialogue.json';
import jamRelayRestoreDialogue from '../data/jamRelayRestoreDialogue.json';
import musicTracks from '../data/musicTracks.json';

const INTRO_TITLE_CARD_DURATION_SECONDS = 4.2;
const POST_INTRO_DELAY_AFTER_TITLE_SECONDS = 2.5;
const RIVAL_DIALOGUE_COOLDOWN_SECONDS = 60;
const CRASH_DIALOGUE_COOLDOWN_SECONDS = 15;
const ENDGAME_SURVIVAL_SECONDS = 60;
const NAVIGATOR_OFFLINE_HINT_DELAY_SECONDS = 15;

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function createAudioPool(path, count, volume) {
  return Array.from({ length: count }, () => {
    const audio = new Audio(path);
    audio.preload = 'auto';
    audio.volume = volume;
    return audio;
  });
}

function createExtractionMarker() {
  const group = new THREE.Group();

  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(18, 18, 1.4, 24, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    }),
  );
  ring.position.y = 0.7;
  group.add(ring);

  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 5.4, 8, 16),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.25,
    }),
  );
  beacon.position.y = 4;
  group.add(beacon);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(10.5, 0.5, 10, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.78, fog: false, depthWrite: false, toneMapped: false }),
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 5.4;
  group.add(halo);

  group.userData = { ring, beacon, halo };

  group.traverse((child) => {
    if (child.isMesh) {
      child.renderOrder = 10;
    }
  });

  group.visible = false;
  return group;
}

function createNavigatorOfflineRings(blimpAnchors = []) {
  const group = new THREE.Group();
  const ringGeometry = new THREE.TorusGeometry(18, 0.38, 14, 48);
  const glowGeometry = new THREE.TorusGeometry(18, 0.82, 14, 48);
  const colors = [
    { value: 0x58a6ff, name: 'Blue' },
    { value: 0xff9d3d, name: 'Orange' },
    { value: 0x63ff83, name: 'Green' },
    { value: 0xff5e47, name: 'Red' },
  ];

  blimpAnchors.slice(0, colors.length).forEach((anchor, index) => {
    const ringGroup = new THREE.Group();
    ringGroup.position.copy(anchor.position);
    ringGroup.userData = {
      baseY: anchor.position.y,
      colorName: colors[index].name,
      cleared: false,
      index,
      phase: index * 0.85,
      proximityRadius: 10,
      spinSpeed: 0.28 + index * 0.05,
      wasInside: false,
    };

    const ring = new THREE.Mesh(
      ringGeometry,
      new THREE.MeshBasicMaterial({
        color: colors[index].value,
        transparent: true,
        opacity: 0.36,
        fog: false,
        toneMapped: false,
      }),
    );
    ring.renderOrder = 12;
    ringGroup.add(ring);

    const glow = new THREE.Mesh(
      glowGeometry,
      new THREE.MeshBasicMaterial({
        color: colors[index].value,
        transparent: true,
        opacity: 0.035,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    );
    glow.scale.set(1.04, 1.04, 1.04);
    glow.renderOrder = 11;
    ringGroup.add(glow);
    ringGroup.userData.ring = ring;
    ringGroup.userData.glow = glow;

    group.add(ringGroup);
  });

  group.visible = false;
  return group;
}

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
    this.baseToneMappingExposure = this.renderer.toneMappingExposure;

    this.mount.appendChild(this.renderer.domElement);
    this.setupPostProcessing();

    this.input = new InputManager();
    this.ui = new UIManager(this.mount);
    this.effects = new EffectsHooks(this.scene);
    this.music = new MusicManager(musicTracks);
    this.introDialogue = new IntroDialogueManager(introDialogue, 300);
    this.postIntroDialogue = new IntroDialogueManager(postIntroDialogue, 250);
    this.fakePassengerIntroDialogue = new IntroDialogueManager(fakePassengerIntroDialogue, 250);
    this.finalDialogue = new IntroDialogueManager(finalDialogue, 250);
    this.finalSurvivalDialogue = new IntroDialogueManager(finalSurvivalDialogue, 1400);
    this.finalEscapeDialogue = new IntroDialogueManager(finalEscapeDialogue, 250);
    this.finalResolutionDialogue = new IntroDialogueManager(finalResolutionDialogue, 250);
    this.jamRelayStartDialogue = new IntroDialogueManager(jamRelayStartDialogue, 250);
    this.jamRelayHintOneDialogue = new IntroDialogueManager(jamRelayHintOneDialogue, 250);
    this.jamRelayHintTwoDialogue = new IntroDialogueManager(jamRelayHintTwoDialogue, 250);
    this.jamRelayRestoreDialogue = new IntroDialogueManager(jamRelayRestoreDialogue, 250);
    this.voiceover = new VoiceoverManager();
    this.pendingPostIntroDelay = null;
    this.rivalDialogueCooldown = 0;
    this.crashDialogueCooldown = 0;
    this.pendingLowFuelAnnouncements = [];
    this.runtimeDialogueUnlocked = false;
    this.fakePassengerIntroSeen = false;
    this.fakePassengerIntroActive = false;
    this.finalDialogueActive = false;
    this.survivalModeActive = false;
    this.survivalDialogueActive = false;
    this.survivalTimer = 0;
    this.endgameResolutionActive = false;
    this.endgameShutdownStarted = false;
    this.finalFiveDialogueQueued = false;
    this.finalFiveDialoguePlayed = false;
    this.finalFiveDialogueFinished = false;
    this.finalEscapeDialogueActive = false;
    this.finalEscapeDialogueStarted = false;
    this.extractionActive = false;
    this.extractionTarget = null;
    this.navigatorOfflineActive = false;
    this.navigatorOfflineCompleted = false;
    this.navigatorOfflineSequenceIndex = 0;
    this.navigatorOfflineDialogueActive = false;
    this.navigatorOfflineRestoreDialogueQueued = false;
    this.navigatorOfflineRestoreDialoguePlayed = false;
    this.navigatorOfflineHintStage = 0;
    this.navigatorOfflineHintTimer = null;
    this.navigatorOfflineStaticAudio = new Audio('/audio/static.mp3');
    this.navigatorOfflineStaticAudio.preload = 'auto';
    this.navigatorOfflineStaticAudio.volume = 0.82;
    this.won = false;
    this.lightningConfig = GAME_CONFIG.lightning;
    this.lightningCooldown = this.randomLightningCooldown();
    this.lightningWarningTimer = 0;
    this.lightningSparkTimer = 0;
    this.lightningFlashTimer = 0;
    this.lightningChallengeActive = false;
    this.cityLimitWarningActive = false;
    this.cityLimitTurnActive = false;
    this.lightningAudioIndex = 0;
    this.thunderAudioIndex = 0;
    this.ringBlipAudioIndex = 0;
    this.lightningWarningSounds = createAudioPool('/audio/sparks.mp3', 3, 0.6);
    this.thunderSounds = createAudioPool('/audio/thunder.mp3', 3, 0.72);
    this.ringBlipSounds = createAudioPool('/audio/blip.mp3', 3, 0.7);
    this.perfOverlay = this.options.debug?.showPerfOverlay ? new PerformanceOverlay(this.mount) : null;
    this.ui.setMusicToggleHandler(() => this.music.toggleMute());
    this.ui.setStartHandler(() => this.beginGame());

    this.setupLights();

    this.city = new CityGenerator(this.scene, GAME_CONFIG);
    this.worldData = this.city.build();
    this.extractionMarker = createExtractionMarker();
    this.scene.add(this.extractionMarker);
    this.navigatorOfflineRings = createNavigatorOfflineRings(this.worldData.blimpAnchors);
    this.scene.add(this.navigatorOfflineRings);
    this.lightningFlash = new THREE.PointLight(0xf4fbff, 0, 320, 1.15);
    this.scene.add(this.lightningFlash);

    this.player = new PlayerController(this.scene, this.input, GAME_CONFIG, this.worldData.spawnPoint);
    this.traffic = new TrafficManager(this.scene, GAME_CONFIG, this.worldData.flightPaths);
    this.missions = new MissionSystem(this.scene, this.worldData, GAME_CONFIG, this.ui, this.effects);
    this.missions.setFakePassengerHandler(({ robberyAmount }) => this.onFakePassengerRobbed(robberyAmount));
    this.missions.setFinaleHandler(() => this.onFinaleTriggered());
    this.energy = new EnergySystem(this.scene, this.worldData, GAME_CONFIG, this.ui, this.missions);
    this.collisions = new CollisionSystem(this.worldData.colliders, GAME_CONFIG, this.ui, this.effects);
    this.rivals = new RivalTaxiManager(this.scene, GAME_CONFIG, this.worldData, this.ui);
    this.emp = new EmpSystem(this.scene, this.input, this.worldData, GAME_CONFIG, this.ui);
    this.superBoost = new SuperBoostSystem(this.scene, this.input, this.worldData, GAME_CONFIG, this.ui, this.player);
    this.cameraController = new CameraController(this.camera, this.player.mesh, GAME_CONFIG);
    this.paused = false;
    this.started = false;

    this.applyDebugFlags();
    this.lightningChallengeActive = this.isLightningChallengeActive(this.missions.totalCredits);

    this.resizeHandler = () => this.onResize();
    window.addEventListener('resize', this.resizeHandler);
    this.beforeUnloadHandler = () => this.destroy();
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  applyDebugFlags() {
    if (!import.meta.env.DEV || !this.options.debug) return;

    const { startingCredits, startingHeat, startingRivals, startingEnergy, startingEmpCharges, startingSuperBoost, showFinal, showWinner } = this.options.debug;
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

    if (startingEnergy != null) {
      this.energy.setStartingEnergy(startingEnergy);
      applied.push(`energy=${this.energy.currentEnergy}`);
    }

    if (startingSuperBoost) {
      this.superBoost.setStartingCharges(1);
      applied.push('super-boost=1');
    }

    if (showFinal) {
      this.triggerFinalDebugState();
      applied.push('final=1');
    }

    if (showWinner) {
      this.triggerWin();
      applied.push('winner=1');
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
    this.animate();
  }

  beginGame() {
    if (this.started || this.won) return;

    this.started = true;
    this.input.clearState();
    this.ui.hideTitleScreen();

    if (this.options.debug?.skipIntro) {
      this.music.start();
      this.runtimeDialogueUnlocked = true;
      return;
    }

    this.music.start(0.3);
    this.introDialogue.start({
      onEntryStart: (entry) => this.ui.showDialogue(entry),
      onEntryEnd: () => this.ui.hideDialogue(),
      onComplete: () => {
        this.music.setVolumeScale(1);
        this.pendingPostIntroDelay = POST_INTRO_DELAY_AFTER_TITLE_SECONDS;
      },
    });
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
        this.runtimeDialogueUnlocked = true;
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

  onFakePassengerRobbed() {
    this.ui.showAlert('You were robbed by a fake passenger!');

    if (!this.runtimeDialogueUnlocked) return;

    if (!this.fakePassengerIntroSeen) {
      this.fakePassengerIntroSeen = true;
      this.fakePassengerIntroActive = true;
      this.voiceover.stop();
      this.fakePassengerIntroDialogue.start({
        onEntryStart: (entry) => {
          this.music.setVolumeScale(0.22);
          this.ui.showDialogue(entry);
        },
        onEntryEnd: () => this.ui.hideDialogue(),
        onComplete: () => {
          this.music.setVolumeScale(1);
          this.ui.hideDialogue();
          this.fakePassengerIntroActive = false;
        },
      });
      return;
    }

    if (!this.isGameplayDialogueBusy()) {
      const entry = fakePassengerDialogue[Math.floor(Math.random() * fakePassengerDialogue.length)];
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
  }

  isBlockingGameplayDialogueActive() {
    return this.fakePassengerIntroActive
      || this.finalDialogueActive
      || this.survivalDialogueActive
      || this.endgameResolutionActive
      || this.finalEscapeDialogueActive
      || this.navigatorOfflineDialogueActive;
  }

  isGameplayDialogueBusy() {
    return this.isBlockingGameplayDialogueActive() || this.voiceover.isActive();
  }

  playStormAnnouncement(dialogueEntries, alertText) {
    this.ui.showAlert(alertText);

    if (!this.runtimeDialogueUnlocked || this.isBlockingGameplayDialogueActive() || dialogueEntries.length === 0) {
      return;
    }

    const entry = dialogueEntries[Math.floor(Math.random() * dialogueEntries.length)];
    this.voiceover.stop();
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

  startBlockingDialogueSequence(manager, onComplete) {
    this.navigatorOfflineDialogueActive = true;
    this.voiceover.stop();
    manager.start({
      onEntryStart: (entry) => {
        this.music.setVolumeScale(0.22);
        this.ui.showDialogue(entry);
      },
      onEntryEnd: () => this.ui.hideDialogue(),
      onComplete: () => {
        this.music.setVolumeScale(1);
        this.ui.hideDialogue();
        this.navigatorOfflineDialogueActive = false;
        onComplete?.();
        if (this.navigatorOfflineRestoreDialogueQueued) {
          this.navigatorOfflineRestoreDialogueQueued = false;
          this.playNavigatorOfflineRestoreDialogue();
        }
      },
    });
  }

  startNavigatorOfflineHintTimer() {
    if (!this.navigatorOfflineActive || this.navigatorOfflineCompleted || this.navigatorOfflineHintStage >= 2) {
      this.navigatorOfflineHintTimer = null;
      return;
    }

    this.navigatorOfflineHintTimer = NAVIGATOR_OFFLINE_HINT_DELAY_SECONDS;
  }

  playNavigatorOfflineStartDialogue() {
    this.navigatorOfflineDialogueActive = true;
    this.voiceover.stop();
    this.navigatorOfflineStaticAudio.currentTime = 0;
    this.navigatorOfflineStaticAudio.play()
      .then(() => {
        const handleEnded = () => {
          this.navigatorOfflineStaticAudio.removeEventListener('ended', handleEnded);
          this.startBlockingDialogueSequence(this.jamRelayStartDialogue, () => {
            this.startNavigatorOfflineHintTimer();
          });
        };
        this.navigatorOfflineStaticAudio.addEventListener('ended', handleEnded, { once: true });
      })
      .catch(() => {
        this.navigatorOfflineDialogueActive = false;
        this.startBlockingDialogueSequence(this.jamRelayStartDialogue, () => {
          this.startNavigatorOfflineHintTimer();
        });
      });
  }

  playNavigatorOfflineHintDialogue() {
    if (this.navigatorOfflineCompleted || !this.navigatorOfflineActive) return;

    const manager = this.navigatorOfflineHintStage === 0
      ? this.jamRelayHintOneDialogue
      : this.jamRelayHintTwoDialogue;

    this.navigatorOfflineHintStage += 1;
    this.startBlockingDialogueSequence(manager, () => {
      this.startNavigatorOfflineHintTimer();
    });
  }

  playNavigatorOfflineRestoreDialogue() {
    if (this.navigatorOfflineRestoreDialoguePlayed) return;
    if (this.navigatorOfflineDialogueActive) {
      this.navigatorOfflineRestoreDialogueQueued = true;
      return;
    }

    this.navigatorOfflineRestoreDialoguePlayed = true;
    this.navigatorOfflineHintTimer = null;
    this.startBlockingDialogueSequence(this.jamRelayRestoreDialogue);
  }

  updateNavigatorOfflineDialogue(delta) {
    if (this.paused || this.navigatorOfflineHintTimer == null || this.navigatorOfflineDialogueActive) return;

    this.navigatorOfflineHintTimer = Math.max(0, this.navigatorOfflineHintTimer - delta);
    if (this.navigatorOfflineHintTimer > 0) return;

    this.navigatorOfflineHintTimer = null;
    this.playNavigatorOfflineHintDialogue();
  }

  handleLightningChallengeStateChange(challengeActive) {
    if (challengeActive === this.lightningChallengeActive) return;

    this.lightningChallengeActive = challengeActive;
    if (challengeActive) {
      this.playStormAnnouncement(stormStartDialogue, 'A thunderstorm has started!');
      return;
    }

    this.playStormAnnouncement(stormEndDialogue, 'The thunderstorm has cleared up!');
  }

  onFinaleTriggered() {
    this.finalDialogueActive = true;
    this.runtimeDialogueUnlocked = false;
    this.emp.disable();
    this.superBoost.disable();
    this.voiceover.stop();
    this.ui.showAlert('10,000 credits secured!');
    this.finalDialogue.start({
      onEntryStart: (entry) => {
        this.music.setVolumeScale(0.22);
        this.ui.showDialogue(entry);
      },
      onEntryEnd: () => this.ui.hideDialogue(),
      onComplete: () => {
        this.music.setVolumeScale(1);
        this.ui.hideDialogue();
        this.finalDialogueActive = false;
        this.missions.unlockEndgame();
        this.runtimeDialogueUnlocked = true;
      },
    });
  }

  startSurvivalMode() {
    this.survivalModeActive = true;
    this.survivalTimer = ENDGAME_SURVIVAL_SECONDS;
    this.runtimeDialogueUnlocked = false;
    this.ui.showAlert('Survive');
    this.ui.setNotificationsSuppressed(true);
    this.voiceover.stop();
    this.survivalDialogueActive = true;
    this.finalSurvivalDialogue.start({
      onEntryStart: (entry) => {
        this.music.setVolumeScale(0.22);
        this.ui.showDialogue(entry);
      },
      onEntryEnd: () => this.ui.hideDialogue(),
      onComplete: () => {
        this.music.setVolumeScale(1);
        this.ui.hideDialogue();
        this.survivalDialogueActive = false;
      },
    });
  }

  endSurvivalMode() {
    this.survivalModeActive = false;
    this.survivalTimer = 0;
    this.ui.clearPersistentAlert();
    this.ui.setNotificationsSuppressed(false);
    this.runtimeDialogueUnlocked = true;
  }

  startEndgameShutdown() {
    if (this.endgameShutdownStarted) return;
    this.endgameShutdownStarted = true;
    this.endgameResolutionActive = true;
    this.runtimeDialogueUnlocked = false;
    this.ui.clearPersistentAlert();
    this.ui.setNotificationsSuppressed(true);
    this.rivals.startShutdown();
    this.finalResolutionDialogue.start({
      onEntryStart: (entry) => {
        this.music.setVolumeScale(0.22);
        this.ui.showDialogue(entry);
      },
      onEntryEnd: () => this.ui.hideDialogue(),
      onComplete: () => {
        this.music.setVolumeScale(1);
        this.ui.hideDialogue();
        this.endgameResolutionActive = false;
      },
    });
  }

  playFinalFiveDialogue() {
    const entry = finalFiveDialogue[0];
    this.finalFiveDialoguePlayed = true;
    this.finalFiveDialogueQueued = false;
    this.voiceover.play(entry, {
      onStart: (dialogueEntry) => {
        this.music.setVolumeScale(0.22);
        this.ui.showDialogue(dialogueEntry);
      },
      onComplete: () => {
        this.music.setVolumeScale(1);
        this.ui.hideDialogue();
        this.finalFiveDialogueFinished = true;
      },
    });
  }

  startFinalEscapeDialogue() {
    this.finalEscapeDialogueStarted = true;
    this.finalEscapeDialogueActive = true;
    this.finalEscapeDialogue.start({
      onEntryStart: (entry) => {
        this.music.setVolumeScale(0.22);
        this.ui.showDialogue(entry);
      },
      onEntryEnd: () => this.ui.hideDialogue(),
      onComplete: () => {
        this.music.setVolumeScale(1);
        this.ui.hideDialogue();
        this.finalEscapeDialogueActive = false;
        this.activateExtractionTarget();
      },
    });
  }

  triggerFinalDebugState() {
    this.missions.totalCredits = Math.max(this.missions.totalCredits, GAME_CONFIG.mission.finalCreditsThreshold);
    this.missions.endgameTriggered = true;
    this.missions.endgameUnlocked = true;
    this.missions.phase = 'endgame';
    this.missions.pickupOffers = [];
    this.missions.pickupDistrict = null;
    this.missions.dropoffDistrict = null;
    this.missions.currentFare = 0;
    this.missions.originalFare = 0;
    this.missions.pendingPenaltyText = '';
    this.missions.objective = 'Reach the destination';
    this.missions.routeLabel = 'Extraction point marked on navigator';
    this.missions.pickupZones.forEach((zone) => {
      zone.visible = false;
      zone.userData.labelSprite.visible = false;
      this.missions.setZoneColor(zone, zone.userData.baseColor);
    });
    this.missions.dropoffZone.visible = false;
    this.emp.disable();
    this.superBoost.disable();
    this.rivals.startShutdown();
    this.endgameShutdownStarted = true;
    this.finalFiveDialoguePlayed = true;
    this.finalFiveDialogueFinished = true;
    this.finalEscapeDialogueStarted = true;
    this.activateExtractionTarget();
    this.runtimeDialogueUnlocked = true;
  }

  activateExtractionTarget() {
    this.extractionTarget = this.computeExtractionTarget();
    this.extractionMarker.position.copy(this.extractionTarget);
    this.extractionMarker.visible = true;
    this.extractionActive = true;
  }

  computeExtractionTarget() {
    const innerCityOffset = GAME_CONFIG.districtSpacing * 0.42;
    const crossAxisLimit = GAME_CONFIG.districtSpacing * 0.3;
    const targetHeight = 0;
    const playerPosition = this.player.mesh.position;
    if (Math.abs(playerPosition.x) >= Math.abs(playerPosition.z)) {
      return new THREE.Vector3(
        Math.sign(playerPosition.x || 1) * innerCityOffset,
        targetHeight,
        THREE.MathUtils.clamp(playerPosition.z, -crossAxisLimit, crossAxisLimit),
      );
    }

    return new THREE.Vector3(
      THREE.MathUtils.clamp(playerPosition.x, -crossAxisLimit, crossAxisLimit),
      targetHeight,
      Math.sign(playerPosition.z || 1) * innerCityOffset,
    );
  }

  enforceCityLimits() {
    const position = this.player.mesh.position;
    const cityHalfSpan = this.worldData.cityHalfSpan ?? (GAME_CONFIG.districtSpacing + GAME_CONFIG.districtSize * 0.5);
    const turnAroundLimit = cityHalfSpan + GAME_CONFIG.cityLimits.turnAroundBuffer;
    const farthestAxis = Math.max(Math.abs(position.x), Math.abs(position.z));
    if (farthestAxis <= turnAroundLimit) {
      this.cityLimitWarningActive = false;
      this.cityLimitTurnActive = false;
      return;
    }

    if (!this.cityLimitWarningActive) {
      this.ui.showAlert("Turn around! You're leaving the city limits.");
      this.cityLimitWarningActive = true;
    }

    if (!this.cityLimitTurnActive) {
      this.player.turnAround();
      this.cityLimitTurnActive = true;
    }
  }

  updateExtractionMarker(delta) {
    if (!this.extractionActive) return;
    this.extractionMarker.rotation.y += delta * 0.9;
    this.extractionMarker.userData.beacon.position.y = 4 + Math.sin(performance.now() * 0.004) * 0.8;
    this.extractionMarker.userData.halo.rotation.z += delta * 0.85;
    const dx = this.player.mesh.position.x - this.extractionTarget.x;
    const dz = this.player.mesh.position.z - this.extractionTarget.z;
    if (Math.hypot(dx, dz) < 22) {
      this.triggerWin();
    }
  }

  randomLightningCooldown() {
    return randRange(this.lightningConfig.cooldownMinSeconds, this.lightningConfig.cooldownMaxSeconds);
  }

  playPooledAudio(pool, indexProperty) {
    const audio = pool[this[indexProperty]];
    this[indexProperty] = (this[indexProperty] + 1) % pool.length;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  isLightningChallengeActive(totalCredits) {
    return totalCredits >= this.lightningConfig.resumeCredits
      || (totalCredits >= this.lightningConfig.startCredits && totalCredits < this.lightningConfig.pauseCredits);
  }

  shouldStartNavigatorOffline(totalCredits) {
    return totalCredits >= this.lightningConfig.navigatorOfflineCredits;
  }

  resetNavigatorOfflineRings() {
    this.navigatorOfflineSequenceIndex = 0;
    this.navigatorOfflineRings.children.forEach((ringGroup) => {
      ringGroup.userData.cleared = false;
      ringGroup.userData.wasInside = false;
      ringGroup.visible = true;
    });
  }

  updateNavigatorOfflineChallenge(delta, totalCredits) {
    const shouldStart = this.shouldStartNavigatorOffline(totalCredits);

    if (!this.navigatorOfflineCompleted && shouldStart && !this.navigatorOfflineActive) {
      this.navigatorOfflineActive = true;
      this.navigatorOfflineRestoreDialogueQueued = false;
      this.navigatorOfflineRestoreDialoguePlayed = false;
      this.navigatorOfflineHintStage = 0;
      this.navigatorOfflineHintTimer = null;
      this.resetNavigatorOfflineRings();
      this.ui.showAlert('Navigator offline.');
      this.playNavigatorOfflineStartDialogue();
    }

    if (!this.navigatorOfflineActive) {
      this.updateNavigatorOfflineRings(delta, false);
      this.missions.setNavigatorOffline(false);
      return;
    }

    this.updateNavigatorOfflineRings(delta, true);
    this.missions.setNavigatorOffline(true);

    const playerPosition = this.player.mesh.position;
    let enteredRing = null;

    this.navigatorOfflineRings.children.forEach((ringGroup) => {
      const inside = playerPosition.distanceToSquared(ringGroup.position) <= ringGroup.userData.proximityRadius ** 2;
      if (inside && !ringGroup.userData.wasInside && enteredRing == null) {
        enteredRing = ringGroup;
      }
      ringGroup.userData.wasInside = inside;
    });

    if (!enteredRing) return;

    if (enteredRing.userData.index !== this.navigatorOfflineSequenceIndex) {
      this.resetNavigatorOfflineRings();
      enteredRing.userData.wasInside = true;
      this.ui.showAlert('Wrong ring. Sequence reset.');
      return;
    }

    enteredRing.userData.cleared = true;
    enteredRing.visible = false;
    this.navigatorOfflineSequenceIndex += 1;
    this.playPooledAudio(this.ringBlipSounds, 'ringBlipAudioIndex');

    if (this.navigatorOfflineSequenceIndex === this.navigatorOfflineRings.children.length) {
      this.navigatorOfflineActive = false;
      this.navigatorOfflineCompleted = true;
      this.navigatorOfflineHintTimer = null;
      this.updateNavigatorOfflineRings(delta, false);
      this.missions.setNavigatorOffline(false);
      this.ui.showAlert('Navigator restored!');
      this.playNavigatorOfflineRestoreDialogue();
    }
  }

  updateNavigatorOfflineRings(delta, navigatorOffline) {
    if (!this.navigatorOfflineRings) return;

    this.navigatorOfflineRings.visible = navigatorOffline;
    if (!navigatorOffline) return;

    const time = performance.now() * 0.001;
    this.navigatorOfflineRings.children.forEach((ringGroup) => {
      const { baseY, glow, index, phase, ring, spinSpeed } = ringGroup.userData;
      ringGroup.position.y = baseY + Math.sin(time * 1.2 + phase) * 1.8;
      ringGroup.rotation.y += delta * spinSpeed;
      ringGroup.visible = !ringGroup.userData.cleared;

      const isTarget = index === this.navigatorOfflineSequenceIndex;
      const pulse = 1 + Math.sin(time * 2.4 + phase) * (isTarget ? 0.09 : 0.04);
      ringGroup.scale.setScalar(pulse);
      ring.material.opacity = isTarget ? 0.48 : 0.22;
      glow.material.opacity = isTarget ? 0.08 : 0.025;
    });
  }

  getLightningExposure() {
    const { minHeight, openSkyHeight, nearbyBuildingRadius, roofClearance } = this.lightningConfig;
    const playerPosition = this.player.mesh.position;
    if (playerPosition.y < minHeight) return 0;

    let nearbyRoofHeight = 0;
    const radiusSquared = nearbyBuildingRadius * nearbyBuildingRadius;

    for (let i = 0; i < this.worldData.colliders.length; i += 1) {
      const collider = this.worldData.colliders[i];
      if (collider.type !== 'building') continue;

      const x = THREE.MathUtils.clamp(playerPosition.x, collider.min.x, collider.max.x);
      const z = THREE.MathUtils.clamp(playerPosition.z, collider.min.z, collider.max.z);
      const dx = playerPosition.x - x;
      const dz = playerPosition.z - z;
      if (dx * dx + dz * dz > radiusSquared) continue;
      nearbyRoofHeight = Math.max(nearbyRoofHeight, collider.max.y);
    }

    let exposure = 0;
    if (nearbyRoofHeight > 0 && playerPosition.y >= nearbyRoofHeight - roofClearance) {
      exposure = Math.max(exposure, THREE.MathUtils.clamp(0.5 + (playerPosition.y - (nearbyRoofHeight - roofClearance)) / 28, 0.5, 1));
    }

    if (playerPosition.y >= openSkyHeight) {
      exposure = Math.max(exposure, THREE.MathUtils.clamp(0.36 + (playerPosition.y - openSkyHeight) / 70, 0.36, 1));
    }

    return exposure;
  }

  startLightningWarning() {
    this.lightningWarningTimer = this.lightningConfig.warningSeconds;
    this.lightningSparkTimer = 0;
    this.playPooledAudio(this.lightningWarningSounds, 'lightningAudioIndex');
    this.effects.emitVehicleSparks(this.player.mesh.position);
  }

  cancelLightningWarning() {
    this.lightningWarningTimer = 0;
    this.lightningSparkTimer = 0;
  }

  triggerLightningStrike() {
    this.cancelLightningWarning();
    this.lightningCooldown = this.randomLightningCooldown();
    this.lightningFlashTimer = this.lightningConfig.flashSeconds;
    this.lightningFlash.position.copy(this.player.mesh.position).add(new THREE.Vector3(0, 54, 0));
    this.lightningFlash.intensity = this.lightningConfig.flashIntensity;
    this.renderer.toneMappingExposure = this.baseToneMappingExposure + 0.85;
    this.playPooledAudio(this.thunderSounds, 'thunderAudioIndex');
    this.effects.emitVehicleSparks(this.player.mesh.position);
    this.ui.flashLightning();
    this.missions.cancelRideForDanger(
      this.player.mesh.position,
      this.lightningConfig.passengerPenalty,
      'The passenger cancelled the ride! Too dangerous!',
    );
    if (this.runtimeDialogueUnlocked && !this.isGameplayDialogueBusy()) {
      this.playLightningDialogue();
    }
  }

  updateLightning(delta, missionState) {
    const challengeActive = this.isLightningChallengeActive(missionState.totalCredits);
    this.handleLightningChallengeStateChange(challengeActive);
    if (!challengeActive) {
      this.cancelLightningWarning();
      this.lightningCooldown = this.randomLightningCooldown();
      return;
    }

    if (this.lightningWarningTimer > 0) {
      this.lightningWarningTimer = Math.max(0, this.lightningWarningTimer - delta);
      this.lightningSparkTimer = Math.max(0, this.lightningSparkTimer - delta);
      if (this.lightningSparkTimer === 0) {
        this.lightningSparkTimer = this.lightningConfig.warningSparkIntervalSeconds;
        this.effects.emitVehicleSparks(this.player.mesh.position);
      }
      if (this.lightningWarningTimer === 0) {
        this.triggerLightningStrike();
      }
      return;
    }

    const exposure = this.getLightningExposure();
    if (exposure === 0) return;

    this.lightningCooldown = Math.max(0, this.lightningCooldown - delta * THREE.MathUtils.lerp(0.65, 1.4, exposure));
    if (this.lightningCooldown === 0) {
      this.startLightningWarning();
    }
  }

  updateLightningFlash(delta) {
    if (this.lightningFlashTimer > 0) {
      this.lightningFlashTimer = Math.max(0, this.lightningFlashTimer - delta);
      const ratio = this.lightningFlashTimer / this.lightningConfig.flashSeconds;
      this.lightningFlash.intensity = this.lightningConfig.flashIntensity * ratio;
      this.renderer.toneMappingExposure = this.baseToneMappingExposure + 0.85 * ratio;
      this.bloomPass.strength = 0.65 + 0.95 * ratio;
      return;
    }

    this.lightningFlash.intensity = 0;
    this.renderer.toneMappingExposure = this.baseToneMappingExposure;
    this.bloomPass.strength = 0.65;
  }

  triggerWin() {
    if (this.won) return;
    this.won = true;
    this.music.setPaused(true);
    this.ui.clearPersistentAlert();
    this.ui.showWinScreen();
    this.extractionMarker.visible = false;
    this.extractionActive = false;
    this.scene.visible = false;
    this.renderer.domElement.style.visibility = 'hidden';
    this.runtimeDialogueUnlocked = false;
  }

  playEscalationAnnouncement() {
    const entry = escalationDialogue[Math.floor(Math.random() * escalationDialogue.length)];
    this.ui.showAlert('A new Axiom Mobility taxi is tracking you!');
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

  playLowFuelDialogue() {
    const entry = lowFuelDialogue[Math.floor(Math.random() * lowFuelDialogue.length)];
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

  playLightningDialogue() {
    const entry = lightningDialogue[Math.floor(Math.random() * lightningDialogue.length)];
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

    if (this.won) return;

    if (!this.started) {
      this.ui.render({
        player: this.player,
        mission: this.missions.getState(),
        energy: this.latestEnergyState ?? this.energy.getState(),
        district: this.worldData.getDistrictName(this.player.mesh.position),
        music: this.music.getState(),
        rivals: this.rivals.getState(),
        emp: this.emp.getState(),
        superBoost: this.superBoost.getState(),
        weather: {
          thunderstormActive: false,
        },
        challenges: {
          navigatorOffline: false,
        },
        endgame: {
          extractionTarget: null,
        },
        paused: false,
      });
      this.composer.render();
      return;
    }

    if (this.input.consumePress('pause')) {
      this.paused = !this.paused;
      this.music.setPaused(this.paused);
      this.introDialogue.setPaused(this.paused);
      this.postIntroDialogue.setPaused(this.paused);
      this.fakePassengerIntroDialogue.setPaused(this.paused);
      this.finalDialogue.setPaused(this.paused);
      this.finalSurvivalDialogue.setPaused(this.paused);
      this.finalEscapeDialogue.setPaused(this.paused);
      this.finalResolutionDialogue.setPaused(this.paused);
      this.jamRelayStartDialogue.setPaused(this.paused);
      this.jamRelayHintOneDialogue.setPaused(this.paused);
      this.jamRelayHintTwoDialogue.setPaused(this.paused);
      this.jamRelayRestoreDialogue.setPaused(this.paused);
      if (this.paused) {
        this.navigatorOfflineStaticAudio.pause();
      } else if (this.navigatorOfflineDialogueActive && this.navigatorOfflineStaticAudio.src && this.navigatorOfflineStaticAudio.ended === false && this.jamRelayStartDialogue.started === false) {
        this.navigatorOfflineStaticAudio.play().catch(() => {});
      }
      this.voiceover.setPaused(this.paused);
    }

    if (!this.paused) {
      this.music.update(delta);
      this.rivalDialogueCooldown = Math.max(0, this.rivalDialogueCooldown - delta);
      this.crashDialogueCooldown = Math.max(0, this.crashDialogueCooldown - delta);
      if (this.survivalModeActive) {
        this.survivalTimer = Math.max(0, this.survivalTimer - delta);
        if (this.survivalTimer === 0 && !this.survivalDialogueActive) {
          this.endSurvivalMode();
          this.startEndgameShutdown();
        }
      }
      if (this.pendingPostIntroDelay != null) {
        this.pendingPostIntroDelay = Math.max(0, this.pendingPostIntroDelay - delta);
        if (this.pendingPostIntroDelay === 0) {
          this.pendingPostIntroDelay = null;
          this.startPostIntroDialogue();
        }
      }
      this.city.update(delta, this.player.mesh.position);
      this.player.update(delta, this.energy.getDriveState());
      this.enforceCityLimits();
      this.updateExtractionMarker(delta);
      this.traffic.update(delta);
      this.energy.update(delta, this.player);
      this.latestEnergyState = this.energy.getState();
      if (this.runtimeDialogueUnlocked) {
        let lowFuelThreshold;
        while ((lowFuelThreshold = this.energy.consumeThresholdAnnouncement()) != null) {
          this.pendingLowFuelAnnouncements.push(lowFuelThreshold);
        }
      } else {
        while (this.energy.consumeThresholdAnnouncement() != null) {
          // Drop threshold announcements during the opening narrative.
        }
      }
      const missionState = this.missions.getState();
      this.updateLightning(delta, missionState);
      this.rivals.update(delta, this.player, missionState, this.latestEnergyState);
      this.emp.update(delta, this.player, this.rivals);
      this.superBoost.update(delta, this.player);
      const empSpawn = this.emp.consumeSpawnEvent();
      const superBoostSpawn = this.superBoost.consumeSpawnEvent();
      const rivalSpawnAnnouncement = this.rivals.consumeSpawnAnnouncement();
      if (this.runtimeDialogueUnlocked) {
        if (empSpawn) {
          if (!this.isGameplayDialogueBusy()) {
            this.playItemAnnouncement('An EMP appeared!');
          } else {
            this.ui.showAlert('An EMP appeared!');
          }
        }
        if (superBoostSpawn) {
          if (!this.isGameplayDialogueBusy()) {
            this.playItemAnnouncement('A Super Boost appeared!');
          } else {
            this.ui.showAlert('A Super Boost appeared!');
          }
        }
        if (rivalSpawnAnnouncement) {
          if (!this.isGameplayDialogueBusy() && this.rivalDialogueCooldown === 0) {
            this.playEscalationAnnouncement();
          } else {
            this.ui.showAlert('A new Axiom Mobility taxi is tracking you!');
          }
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
      if (this.runtimeDialogueUnlocked && collisionEvents.length > 0 && !this.isGameplayDialogueBusy() && this.crashDialogueCooldown === 0) {
        this.playCrashDialogue();
      }
      if (this.runtimeDialogueUnlocked && !this.isGameplayDialogueBusy() && this.pendingLowFuelAnnouncements.length > 0) {
        this.pendingLowFuelAnnouncements.shift();
        this.playLowFuelDialogue();
      }

      this.missions.update(delta, this.player, this.traffic.getVehicles());
      this.cameraController.update(delta, this.player.velocity);
      this.updateLightningFlash(delta);
    }

    const nextMissionState = this.missions.getState();
    const rivalsState = this.rivals.getState();
    this.updateNavigatorOfflineChallenge(delta, nextMissionState.totalCredits);
    this.updateNavigatorOfflineDialogue(delta);

    if (nextMissionState.endgameUnlocked && !this.survivalModeActive && !this.survivalDialogueActive && !this.endgameShutdownStarted && rivalsState.activeRivals >= 50) {
      this.startSurvivalMode();
    }

    if (rivalsState.shutdownActive && !this.finalFiveDialoguePlayed && rivalsState.activeRivals <= 5) {
      this.finalFiveDialogueQueued = true;
    }

    if (this.finalFiveDialogueQueued && !this.isGameplayDialogueBusy()) {
      this.playFinalFiveDialogue();
    }

    if (rivalsState.shutdownActive && !this.finalEscapeDialogueStarted && this.finalFiveDialogueFinished && rivalsState.activeRivals === 0 && !this.isGameplayDialogueBusy()) {
      this.startFinalEscapeDialogue();
    }

    this.ui.render({
      player: this.player,
      mission: nextMissionState,
      energy: this.latestEnergyState ?? this.energy.getState(),
      district: this.worldData.getDistrictName(this.player.mesh.position),
      music: this.music.getState(),
      rivals: rivalsState,
      emp: this.emp.getState(),
      superBoost: this.superBoost.getState(),
      weather: {
        thunderstormActive: this.lightningChallengeActive,
      },
      challenges: {
        navigatorOffline: this.navigatorOfflineActive,
      },
      endgame: {
        extractionTarget: this.extractionActive
          ? {
              name: 'Destination',
              x: this.extractionTarget.x,
              z: this.extractionTarget.z,
            }
          : null,
      },
      paused: this.paused,
    });

    if (this.perfOverlay) {
      this.perfOverlay.update(delta, {
        sceneChildren: this.scene.children.length,
        geometries: this.renderer.info.memory.geometries,
        textures: this.renderer.info.memory.textures,
        drawCalls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
        traffic: this.traffic.getVehicles().length,
        rivals: this.rivals.getState().activeRivals,
        effects: this.effects.getActiveCount(),
        voiceActive: this.voiceover.isActive(),
      });
    }

    this.composer.render();
  };

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener('resize', this.resizeHandler);
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    this.input.destroy();
    this.ui.destroy();
    this.effects.destroy();
    this.music.destroy();
    this.introDialogue.destroy();
    this.postIntroDialogue.destroy();
    this.fakePassengerIntroDialogue.destroy();
    this.finalDialogue.destroy();
    this.finalSurvivalDialogue.destroy();
    this.finalEscapeDialogue.destroy();
    this.finalResolutionDialogue.destroy();
    this.jamRelayStartDialogue.destroy();
    this.jamRelayHintOneDialogue.destroy();
    this.jamRelayHintTwoDialogue.destroy();
    this.jamRelayRestoreDialogue.destroy();
    this.voiceover.destroy();
    this.lightningWarningSounds.forEach((audio) => {
      audio.pause();
      audio.src = '';
    });
    this.thunderSounds.forEach((audio) => {
      audio.pause();
      audio.src = '';
    });
    this.ringBlipSounds.forEach((audio) => {
      audio.pause();
      audio.src = '';
    });
    this.navigatorOfflineStaticAudio.pause();
    this.navigatorOfflineStaticAudio.src = '';
    this.perfOverlay?.destroy();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
