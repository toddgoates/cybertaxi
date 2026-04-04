import * as THREE from 'three';
import { arrive, avoidStaticColliders, combine, pursue, seek, separation, steer } from './SteeringBehaviors.js';

const ENEMY_BODY_COLOR = 0xffd54a;
const ENEMY_EMISSIVE = 0xffc400;

function createEnemyTaxiMesh() {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: ENEMY_BODY_COLOR,
    emissive: ENEMY_EMISSIVE,
    emissiveIntensity: 0.38,
    metalness: 0.28,
    roughness: 0.34,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x2f2608,
    emissive: 0x161003,
    emissiveIntensity: 0.28,
    metalness: 0.42,
    roughness: 0.45,
  });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff1a6,
    emissive: 0xffc400,
    emissiveIntensity: 0.58,
    transparent: true,
    opacity: 0.88,
  });
  const warningMaterial = new THREE.MeshStandardMaterial({
    color: 0xff6b00,
    emissive: 0xffaa00,
    emissiveIntensity: 1.15,
  });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.95, 7.6), bodyMaterial);
  chassis.position.y = 0.18;
  group.add(chassis);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.52, 1.8), bodyMaterial);
  hood.position.set(0, 0.68, -2.1);
  group.add(hood);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.95, 3), bodyMaterial);
  cabin.position.set(0, 1.08, 0.2);
  group.add(cabin);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.56, 1), glassMaterial);
  windshield.position.set(0, 1.35, -0.58);
  group.add(windshield);

  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.48, 0.82), glassMaterial);
  rearGlass.position.set(0, 1.32, 0.78);
  group.add(rearGlass);

  const bumperFront = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.28, 0.3), trimMaterial);
  bumperFront.position.set(0, 0.15, -3.75);
  group.add(bumperFront);

  const bumperRear = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.28, 0.3), trimMaterial);
  bumperRear.position.set(0, 0.15, 3.68);
  group.add(bumperRear);

  const sideBladeGeometry = new THREE.BoxGeometry(0.18, 0.24, 5.4);
  [-1.84, 1.84].forEach((x) => {
    const blade = new THREE.Mesh(sideBladeGeometry, trimMaterial);
    blade.position.set(x, 0.02, 0.16);
    group.add(blade);
  });

  const warningLight = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.46), warningMaterial);
  warningLight.position.set(0, 1.74, 0.02);
  group.add(warningLight);

  const thrusterGeometry = new THREE.ConeGeometry(0.36, 1.6, 10);
  const thrusterMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff5bf,
    emissive: 0xffc400,
    emissiveIntensity: 1.45,
    transparent: true,
    opacity: 0.74,
  });
  const thrusterOffsets = [
    [-1.05, -0.55, 1.9],
    [1.05, -0.55, 1.9],
    [-1.05, -0.55, -1.9],
    [1.05, -0.55, -1.9],
  ];
  const hoverFlames = thrusterOffsets.map(([x, y, z]) => {
    const flame = new THREE.Mesh(thrusterGeometry, thrusterMaterial.clone());
    flame.position.set(x, y, z);
    flame.rotation.x = Math.PI;
    group.add(flame);
    return flame;
  });

  group.userData.hoverFlames = hoverFlames;
  return group;
}

export class RivalTaxiAgent {
  constructor(scene, staticColliders, config) {
    this.scene = scene;
    this.staticColliders = staticColliders;
    this.config = config;
    this.mesh = createEnemyTaxiMesh();
    this.mesh.visible = false;
    this.scene.add(this.mesh);

    this.position = this.mesh.position;
    this.velocity = new THREE.Vector3();
    this.acceleration = new THREE.Vector3();
    this.active = false;
    this.behavior = 'chaser';
    this.aggression = 0.3;
    this.maxSpeed = config.baseSpeed;
    this.maxForce = config.baseForce;
    this.radius = config.radius;
    this.collisionPenalty = config.collisionPenalty;
    this.collisionStrength = config.collisionStrength;
    this.collisionSource = 'intercepted';
    this.life = 0;
    this.hoverTime = Math.random() * Math.PI * 2;
    this.swarmSlot = 0;
  }

  activate(spawnPoint, behavior, profile) {
    this.active = true;
    this.behavior = behavior;
    this.aggression = profile.aggression;
    this.maxSpeed = profile.maxSpeed;
    this.maxForce = profile.maxForce;
    this.collisionPenalty = profile.collisionPenalty;
    this.collisionStrength = profile.collisionStrength;
    this.collisionSource = profile.collisionSource;
    this.life = 0;
    this.velocity.copy(profile.initialVelocity || _zero).setLength(Math.max(8, this.maxSpeed * 0.45));
    this.position.copy(spawnPoint);
    this.mesh.visible = true;
    this.mesh.rotation.set(0, 0, 0);
    this.swarmSlot = profile.swarmSlot || 0;
  }

  deactivate() {
    this.active = false;
    this.mesh.visible = false;
    this.velocity.set(0, 0, 0);
    this.acceleration.set(0, 0, 0);
  }

  update(delta, context) {
    if (!this.active) return;

    this.life += delta;
    this.hoverTime += delta;

    const desiredVelocity = this.computeDesiredVelocity(context);
    steer(this.velocity, desiredVelocity, this.maxForce, _steerForce);

    const separationForce = separation(this, context.neighbors, context.config.separationDistance, _separationForce);
    const avoidForce = avoidStaticColliders(this.position, this.staticColliders, context.config.avoidanceDistance, _avoidForce);

    combine([
      { force: _steerForce, weight: 1.15 },
      { force: separationForce, weight: 0.75 },
      { force: avoidForce, weight: 1.25 },
    ], this.acceleration);

    this.velocity.addScaledVector(this.acceleration, delta);
    if (this.velocity.lengthSq() > this.maxSpeed * this.maxSpeed) {
      this.velocity.setLength(this.maxSpeed);
    }

    this.position.addScaledVector(this.velocity, delta);
    this.position.y = THREE.MathUtils.clamp(this.position.y, context.world.hoverFloor + 6, context.world.hoverCeiling - 10);

    _planarVelocity.copy(this.velocity).setY(0);
    if (_planarVelocity.lengthSq() > 1) {
      this.mesh.quaternion.slerp(
        _targetQuat.setFromUnitVectors(_forwardAxis, _planarVelocity.normalize()),
        0.12,
      );
    }

    this.mesh.rotation.z = THREE.MathUtils.damp(this.mesh.rotation.z, -THREE.MathUtils.clamp(this.acceleration.x * 0.015, -0.12, 0.12), 6, delta);
    this.mesh.rotation.x = THREE.MathUtils.damp(this.mesh.rotation.x, -THREE.MathUtils.clamp(this.velocity.length() * 0.0045, -0.18, 0.18), 5, delta);

    this.mesh.userData.hoverFlames.forEach((flame, index) => {
      const pulse = 0.86 + Math.sin(this.hoverTime * 18 + index) * 0.1 + this.aggression * 0.1;
      flame.scale.y = pulse;
      flame.material.opacity = 0.58 + pulse * 0.14;
    });
  }

  computeDesiredVelocity(context) {
    const { player, mission, managerState } = context;
    const playerPosition = player.mesh.position;
    const playerVelocity = player.velocity;

    if (this.behavior === 'interceptor') {
      const leadTime = THREE.MathUtils.lerp(0.55, 1.4, this.aggression);
      return pursue(this.position, playerPosition, playerVelocity, leadTime, this.maxSpeed, _desiredVelocity);
    }

    if (this.behavior === 'blocker') {
      const zoneTarget = this.getZoneTarget(playerPosition, mission);
      return arrive(this.position, zoneTarget, this.maxSpeed * 0.92, 28, _desiredVelocity);
    }

    if (this.behavior === 'rammer') {
      const leadTime = THREE.MathUtils.lerp(0.25, 0.65, this.aggression);
      pursue(this.position, playerPosition, playerVelocity, leadTime, this.maxSpeed * 1.05, _desiredVelocity);
      return _desiredVelocity;
    }

    if (this.behavior === 'swarm') {
      const leadTime = THREE.MathUtils.lerp(0.65, 1.1, this.aggression);
      _swarmAnchor.copy(playerVelocity).multiplyScalar(leadTime).add(playerPosition);
      _swarmLateral.set(managerState.right.x, 0, managerState.right.z).multiplyScalar((this.swarmSlot - 1.5) * 10);
      _swarmDepth.copy(managerState.forward).multiplyScalar(18 + this.swarmSlot * 5);
      _swarmAnchor.add(_swarmLateral).sub(_swarmDepth);
      _swarmAnchor.y = THREE.MathUtils.clamp(playerPosition.y + (this.swarmSlot % 2 === 0 ? 8 : -6), context.world.hoverFloor + 10, context.world.hoverCeiling - 12);
      return arrive(this.position, _swarmAnchor, this.maxSpeed, 34, _desiredVelocity);
    }

    _chaseTarget.copy(playerPosition).addScaledVector(managerState.forward, -18 - this.aggression * 16);
    _chaseTarget.y = THREE.MathUtils.clamp(playerPosition.y - 2, context.world.hoverFloor + 8, context.world.hoverCeiling - 10);
    return seek(this.position, _chaseTarget, this.maxSpeed, _desiredVelocity);
  }

  getZoneTarget(playerPosition, mission) {
    const target = mission.phase === 'dropoff' && mission.dropoffTarget
      ? mission.dropoffTarget
      : mission.pickupTargets[0] || mission.dropoffTarget;

    if (!target) return _zoneTarget.copy(playerPosition);

    _zoneTarget.set(target.x, playerPosition.y, target.z);
    _zoneOffset.copy(playerPosition).sub(_zoneTarget).setY(0);
    if (_zoneOffset.lengthSq() < 1) {
      _zoneOffset.set(1, 0, 0);
    }
    _zoneOffset.setLength(12 + this.aggression * 16);
    _zoneTarget.add(_zoneOffset);
    _zoneTarget.y = target.y ?? playerPosition.y;
    return _zoneTarget;
  }

  getVehicle() {
    return {
      mesh: this.mesh,
      radius: this.radius,
      collisionPenalty: this.collisionPenalty,
      collisionStrength: this.collisionStrength,
      collisionSource: this.collisionSource,
      collidable: true,
      enemy: true,
    };
  }
}

const _zero = new THREE.Vector3(0, 0, -1);
const _forwardAxis = new THREE.Vector3(0, 0, -1);
const _targetQuat = new THREE.Quaternion();
const _planarVelocity = new THREE.Vector3();
const _steerForce = new THREE.Vector3();
const _separationForce = new THREE.Vector3();
const _avoidForce = new THREE.Vector3();
const _desiredVelocity = new THREE.Vector3();
const _chaseTarget = new THREE.Vector3();
const _zoneTarget = new THREE.Vector3();
const _zoneOffset = new THREE.Vector3();
const _swarmAnchor = new THREE.Vector3();
const _swarmLateral = new THREE.Vector3();
const _swarmDepth = new THREE.Vector3();
