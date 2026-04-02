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

export class GameApp {
  constructor(mount) {
    this.mount = mount;
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060814);
    this.scene.fog = new THREE.FogExp2(0x0a1020, 0.0055);

    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.mount.appendChild(this.renderer.domElement);

    this.input = new InputManager();
    this.ui = new UIManager(this.mount);
    this.effects = new EffectsHooks();

    this.setupLights();

    this.city = new CityGenerator(this.scene, GAME_CONFIG);
    this.worldData = this.city.build();

    this.player = new PlayerController(this.scene, this.input, GAME_CONFIG, this.worldData.spawnPoint);
    this.traffic = new TrafficManager(this.scene, GAME_CONFIG, this.worldData.flightPaths);
    this.missions = new MissionSystem(this.scene, this.worldData, GAME_CONFIG, this.ui, this.effects);
    this.collisions = new CollisionSystem(this.worldData.colliders, GAME_CONFIG, this.ui, this.effects);
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
    this.animate();
  }

  animate = () => {
    requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.033);

    this.player.update(delta);
    this.traffic.update(delta);

    const trafficColliders = this.traffic.getCollidableVehicles();
    const collisionEvents = this.collisions.resolvePlayerCollisions(this.player, trafficColliders, delta);
    collisionEvents.forEach((event) => this.missions.applyCollisionPenalty(event.penalty, event.source));

    this.missions.update(delta, this.player, this.traffic.getVehicles());
    this.cameraController.update(delta, this.player.velocity);

    this.ui.render({
      player: this.player,
      mission: this.missions.getState(),
      district: this.worldData.getDistrictName(this.player.mesh.position),
    });

    this.renderer.render(this.scene, this.camera);
  };

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
