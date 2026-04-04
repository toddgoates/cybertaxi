import * as THREE from 'three';
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

export class GameApp {
  constructor(mount) {
    this.mount = mount;
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060814);
    this.scene.fog = new THREE.FogExp2(0x0a1020, 0.0042);

    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.mount.appendChild(this.renderer.domElement);

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
    this.cameraController = new CameraController(this.camera, this.player.mesh, GAME_CONFIG);

    this.resizeHandler = () => this.onResize();
    window.addEventListener('resize', this.resizeHandler);
  }

  setupLights() {
    const hemi = new THREE.HemisphereLight(0x5c7dff, 0x10141f, 0.9);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0x7be2ff, 1.15);
    keyLight.position.set(40, 80, 20);
    this.scene.add(keyLight);

    const magentaLight = new THREE.PointLight(0xff4fd8, 18, 180, 2);
    magentaLight.position.set(0, 60, 0);
    this.scene.add(magentaLight);
  }

  start() {
    this.music.start();
    this.animate();
  }

  animate = () => {
    requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.033);

    this.player.update(delta, this.energy.getDriveState());
    this.traffic.update(delta);
    this.energy.update(delta, this.player);
    const missionState = this.missions.getState();
    this.rivals.update(delta, this.player, missionState);

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
    const nextMissionState = this.missions.getState();

    this.ui.render({
      player: this.player,
      mission: nextMissionState,
      energy: this.energy.getState(),
      district: this.worldData.getDistrictName(this.player.mesh.position),
      music: this.music.getState(),
      rivals: this.rivals.getState(),
    });

    this.renderer.render(this.scene, this.camera);
  };

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
