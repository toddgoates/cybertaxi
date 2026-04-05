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

export class GameApp {
  constructor(mount) {
    this.mount = mount;
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x140d24);
    this.scene.fog = new THREE.FogExp2(0x180f2d, 0.0026);

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
    this.effects = new EffectsHooks();
    this.music = new MusicManager('/audio/midnight_circuits_1.mp3');
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
    this.cameraController = new CameraController(this.camera, this.player.mesh, GAME_CONFIG);
    this.paused = false;

    this.resizeHandler = () => this.onResize();
    window.addEventListener('resize', this.resizeHandler);
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
    this.music.start();
    this.animate();
  }

  animate = () => {
    requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.033);

    if (this.input.consumePress('pause')) {
      this.paused = !this.paused;
    }

    if (!this.paused) {
      this.player.update(delta, this.energy.getDriveState());
      this.traffic.update(delta);
      this.energy.update(delta, this.player);
      const missionState = this.missions.getState();
      this.rivals.update(delta, this.player, missionState);
      this.emp.update(delta, this.player, this.rivals);

      const trafficColliders = this.traffic.getCollidableVehicles();
      const rivalColliders = this.rivals.getCollidableVehicles();
      const collisionEvents = this.collisions.resolvePlayerCollisions(this.player, [...trafficColliders, ...rivalColliders], delta);
      collisionEvents.forEach((event) => {
        this.missions.applyCollisionPenalty(event.penalty, event.source);
        if (event.enemy) {
          this.rivals.onCollision(event.penalty / GAME_CONFIG.mission.collisionPenalty);
        }
      });

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
