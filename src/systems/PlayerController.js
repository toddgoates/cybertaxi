import * as THREE from 'three';

function damp(current, target, lambda, dt) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

export class PlayerController {
  constructor(scene, input, config, spawnPoint) {
    this.input = input;
    this.config = config.player;
    this.worldConfig = config;
    this.mesh = this.createTaxiMesh();
    this.mesh.position.copy(spawnPoint);
    scene.add(this.mesh);

    this.velocity = new THREE.Vector3();
    this.forwardSpeed = 0;
    this.verticalVelocity = 0;
    this.strafeVelocity = 0;
    this.hoverTime = 0;
    this.isBoosting = false;
    this.boostCharge = this.config.boostDuration;
    this.boostCooldownTimer = 0;
  }

  createTaxiMesh() {
    const root = new THREE.Group();
    const visual = new THREE.Group();
    root.add(visual);
    this.visualMesh = visual;

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xd7dbe2,
      emissive: 0x0f1622,
      emissiveIntensity: 0.16,
      metalness: 0.32,
      roughness: 0.42,
    });
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: 0x202632,
      emissive: 0x0b1220,
      emissiveIntensity: 0.18,
      metalness: 0.45,
      roughness: 0.36,
    });
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x9fdcff,
      emissive: 0x2b8fff,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.72,
      metalness: 0.12,
      roughness: 0.2,
    });
    const lightMaterial = new THREE.MeshStandardMaterial({
      color: 0x86d9ff,
      emissive: 0x1fb6ff,
      emissiveIntensity: 1.4,
      transparent: true,
      opacity: 0.95,
    });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.05, 8.8), bodyMaterial);
    chassis.position.y = 0.2;
    visual.add(chassis);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.7, 2.4), bodyMaterial);
    hood.position.set(0, 0.78, -2.25);
    visual.add(hood);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.25, 3.7), bodyMaterial);
    cabin.position.set(0, 1.18, 0.1);
    visual.add(cabin);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.8, 1.2), glassMaterial);
    windshield.position.set(0, 1.45, -0.82);
    visual.add(windshield);

    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.75, 1.05), glassMaterial);
    rearGlass.position.set(0, 1.42, 1.02);
    visual.add(rearGlass);

    const bumperFront = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.42, 0.42), trimMaterial);
    bumperFront.position.set(0, 0.1, -4.28);
    visual.add(bumperFront);

    const bumperRear = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.42, 0.42), trimMaterial);
    bumperRear.position.set(0, 0.1, 4.2);
    visual.add(bumperRear);

    const sideSkirtGeometry = new THREE.BoxGeometry(0.24, 0.42, 6.2);
    [-2.05, 2.05].forEach((x) => {
      const skirt = new THREE.Mesh(sideSkirtGeometry, trimMaterial);
      skirt.position.set(x, -0.05, 0.28);
      visual.add(skirt);
    });

    const wheelGeometry = new THREE.CylinderGeometry(0.68, 0.68, 0.5, 18);
    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: 0x0d1118,
      emissive: 0x060a10,
      emissiveIntensity: 0.15,
      roughness: 0.82,
      metalness: 0.18,
    });
    [-1.95, 1.95].forEach((x) => {
      [-2.55, 2.45].forEach((z) => {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, -0.18, z);
        visual.add(wheel);
      });
    });

    const roofLightBase = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.58), trimMaterial);
    roofLightBase.position.set(0, 1.98, -0.05);
    visual.add(roofLightBase);

    const roofLight = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.26, 0.42), lightMaterial);
    roofLight.position.set(0, 2.18, -0.05);
    visual.add(roofLight);

    const flameMaterial = new THREE.MeshStandardMaterial({
      color: 0xbff3ff,
      emissive: 0x7ae7ff,
      emissiveIntensity: 1.6,
      transparent: true,
      opacity: 0.85,
    });
    const flameGeometry = new THREE.ConeGeometry(0.34, 1.2, 10);
    const flameOffsets = [
      [-1.2, -0.85, -1.7],
      [1.2, -0.85, -1.7],
      [-1.2, -0.85, 1.7],
      [1.2, -0.85, 1.7],
    ];
    this.hoverFlames = flameOffsets.map(([x, y, z], index) => {
      const flame = new THREE.Mesh(flameGeometry, flameMaterial.clone());
      flame.position.set(x, y, z);
      flame.rotation.x = Math.PI;
      flame.scale.setScalar(0.92 + index * 0.04);
      visual.add(flame);
      return flame;
    });

    const boostFlameGeometry = new THREE.ConeGeometry(0.7, 3.2, 14);
    const boostFlameMaterial = new THREE.MeshStandardMaterial({
      color: 0xc8f6ff,
      emissive: 0x39d7ff,
      emissiveIntensity: 2.2,
      transparent: true,
      opacity: 0,
    });
    this.boostFlames = [-1.05, 1.05].map((x) => {
      const flame = new THREE.Mesh(boostFlameGeometry, boostFlameMaterial.clone());
      flame.position.set(x, 0.15, 4.95);
      flame.rotation.x = Math.PI / 2;
      flame.scale.set(0.7, 0.7, 0.7);
      visual.add(flame);
      return flame;
    });

    root.userData.radius = this.config.collisionRadius;
    return root;
  }

  update(delta, driveState = { canBoost: true, movementScale: 1 }) {
    this.updateBoostState(delta, driveState.canBoost);

    const forwardInput = (this.input.isDown('forward') ? 1 : 0) - (this.input.isDown('brake') ? 1 : 0);
    const turnInput = this.input.getAxis('left', 'right');
    const verticalInput = this.input.getAxis('descend', 'ascend');
    const strafeInput = this.input.getAxis('strafeLeft', 'strafeRight');
    const boostMultiplier = this.isBoosting ? this.config.boostSpeedMultiplier : 1;
    const accelerationMultiplier = (this.isBoosting ? this.config.boostAccelerationMultiplier : 1) * driveState.movementScale;
    const maxForwardSpeed = this.config.maxForwardSpeed * boostMultiplier * driveState.movementScale;

    if (forwardInput > 0) {
      this.forwardSpeed = Math.min(
        this.forwardSpeed + this.config.acceleration * accelerationMultiplier * delta,
        maxForwardSpeed,
      );
    } else if (forwardInput < 0) {
      this.forwardSpeed = Math.max(this.forwardSpeed - this.config.braking * delta, -this.config.maxReverseSpeed * driveState.movementScale);
    } else {
      this.forwardSpeed = damp(this.forwardSpeed, 0, this.config.drag, delta);
    }

    this.verticalVelocity = damp(
      this.verticalVelocity,
      verticalInput * this.config.verticalSpeed * driveState.movementScale,
      this.config.verticalAcceleration / this.config.verticalSpeed,
      delta,
    );
    this.strafeVelocity = damp(
      this.strafeVelocity,
      strafeInput * this.config.strafeSpeed * driveState.movementScale,
      this.config.strafeAcceleration / this.config.strafeSpeed,
      delta,
    );

    this.mesh.rotation.y -= turnInput * this.config.turnSpeed * delta * Math.max(0.4, Math.abs(this.forwardSpeed) / this.config.maxForwardSpeed + 0.35);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.mesh.quaternion);
    this.velocity.copy(forward.multiplyScalar(this.forwardSpeed));
    this.velocity.add(right.multiplyScalar(this.strafeVelocity));
    this.velocity.y = this.verticalVelocity;

    this.mesh.position.addScaledVector(this.velocity, delta);

    const y = THREE.MathUtils.clamp(this.mesh.position.y, this.worldConfig.hoverFloor, this.worldConfig.hoverCeiling);
    if (y !== this.mesh.position.y) {
      this.mesh.position.y = y;
      this.verticalVelocity = 0;
    }

    this.hoverTime += delta;
    this.mesh.position.y += Math.sin(this.hoverTime * 7) * 0.018;
    this.visualMesh.rotation.z = THREE.MathUtils.damp(
      this.visualMesh.rotation.z,
      -turnInput * 0.08 - this.strafeVelocity * 0.004,
      7,
      delta,
    );
    this.visualMesh.rotation.x = THREE.MathUtils.damp(this.visualMesh.rotation.x, -this.forwardSpeed * 0.0012, 6, delta);

    this.hoverFlames.forEach((flame, index) => {
      const flicker = 0.82 + Math.sin(this.hoverTime * 14 + index * 0.9) * 0.14;
      flame.scale.y = flicker + Math.abs(this.verticalVelocity) * 0.01;
      flame.material.opacity = 0.72 + Math.sin(this.hoverTime * 18 + index) * 0.08;
    });

    this.boostFlames.forEach((flame, index) => {
      const boostPulse = this.isBoosting ? 1 + Math.sin(this.hoverTime * 24 + index * 0.7) * 0.18 : 0.45;
      const targetScale = this.isBoosting ? 1.15 : 0.001;
      flame.scale.x = THREE.MathUtils.damp(flame.scale.x, targetScale * boostPulse, 10, delta);
      flame.scale.y = THREE.MathUtils.damp(flame.scale.y, targetScale * (1.3 + index * 0.08), 10, delta);
      flame.scale.z = THREE.MathUtils.damp(flame.scale.z, targetScale * boostPulse, 10, delta);
      flame.material.opacity = THREE.MathUtils.damp(flame.material.opacity, this.isBoosting ? 0.92 : 0, 12, delta);
    });
  }

  updateBoostState(delta, canBoost) {
    const wantsBoost = this.input.isDown('boost');

    if (this.boostCooldownTimer > 0) {
      this.boostCooldownTimer = Math.max(0, this.boostCooldownTimer - delta);
    }

    this.isBoosting = canBoost && wantsBoost && this.boostCharge > 0 && this.boostCooldownTimer === 0 && this.forwardSpeed > 0;

    if (this.isBoosting) {
      this.boostCharge = Math.max(0, this.boostCharge - delta);
      if (this.boostCharge === 0) {
        this.isBoosting = false;
        this.boostCooldownTimer = this.config.boostCooldown;
      }
      return;
    }

    if (this.boostCharge < this.config.boostDuration && this.boostCooldownTimer === 0) {
      this.boostCharge = Math.min(this.config.boostDuration, this.boostCharge + delta);
    }
  }

  getSpeedRatio() {
    const maxForwardSpeed = this.config.maxForwardSpeed * this.config.boostSpeedMultiplier;
    return Math.min(Math.abs(this.forwardSpeed) / maxForwardSpeed, 1);
  }

  getBoostRatio() {
    return this.boostCharge / this.config.boostDuration;
  }

  getBoostStatusText() {
    if (this.isBoosting) {
      return `Boost engaged ${this.boostCharge.toFixed(1)}s`;
    }

    if (this.boostCooldownTimer > 0) {
      return `Boost recharging ${this.boostCooldownTimer.toFixed(1)}s`;
    }

    return 'Boost ready';
  }

  bounce(normal, strength = 0.35) {
    const lateral = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
    lateral.reflect(normal).multiplyScalar(strength);
    this.forwardSpeed *= -0.2;
    this.strafeVelocity *= -0.3;
    this.mesh.position.addScaledVector(normal, 1.6);
    this.velocity.x = lateral.x;
    this.velocity.z = lateral.z;
  }
}
