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
  }

  createTaxiMesh() {
    const root = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x1b2034, emissive: 0x1989ff, emissiveIntensity: 0.45, metalness: 0.35, roughness: 0.35 }),
    );
    body.position.y = 0.4;
    root.add(body);

    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1, 3.2),
      new THREE.MeshStandardMaterial({ color: 0x78d8ff, emissive: 0x1273ff, emissiveIntensity: 0.55, transparent: true, opacity: 0.78 }),
    );
    canopy.position.set(0, 1.1, -0.1);
    root.add(canopy);

    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 1.1, 2),
      new THREE.MeshStandardMaterial({ color: 0xff4fd8, emissive: 0xff4fd8, emissiveIntensity: 0.75 }),
    );
    fin.position.set(0, 1.3, 2.2);
    root.add(fin);

    const thrusterGeometry = new THREE.CylinderGeometry(0.3, 0.4, 1.4, 8);
    const thrusterMaterial = new THREE.MeshStandardMaterial({ color: 0x090c14, emissive: 0x00e6ff, emissiveIntensity: 0.95 });
    [-1.8, 1.8].forEach((x) => {
      const thruster = new THREE.Mesh(thrusterGeometry, thrusterMaterial);
      thruster.rotation.z = Math.PI / 2;
      thruster.position.set(x, -0.3, 1.1);
      root.add(thruster);
    });

    root.userData.radius = this.config.collisionRadius;
    return root;
  }

  update(delta) {
    const forwardInput = (this.input.isDown('forward') ? 1 : 0) - (this.input.isDown('brake') ? 1 : 0);
    const turnInput = this.input.getAxis('left', 'right');
    const verticalInput = this.input.getAxis('descend', 'ascend');
    const strafeInput = this.input.getAxis('strafeLeft', 'strafeRight');

    if (forwardInput > 0) {
      this.forwardSpeed = Math.min(this.forwardSpeed + this.config.acceleration * delta, this.config.maxForwardSpeed);
    } else if (forwardInput < 0) {
      this.forwardSpeed = Math.max(this.forwardSpeed - this.config.braking * delta, -this.config.maxReverseSpeed);
    } else {
      this.forwardSpeed = damp(this.forwardSpeed, 0, this.config.drag, delta);
    }

    this.verticalVelocity = damp(
      this.verticalVelocity,
      verticalInput * this.config.verticalSpeed,
      this.config.verticalAcceleration / this.config.verticalSpeed,
      delta,
    );
    this.strafeVelocity = damp(
      this.strafeVelocity,
      strafeInput * this.config.strafeSpeed,
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
    this.mesh.rotation.z = THREE.MathUtils.damp(this.mesh.rotation.z, -turnInput * 0.18 - this.strafeVelocity * 0.012, 7, delta);
    this.mesh.rotation.x = THREE.MathUtils.damp(this.mesh.rotation.x, -this.forwardSpeed * 0.003, 6, delta);
  }

  getSpeedRatio() {
    return Math.min(Math.abs(this.forwardSpeed) / this.config.maxForwardSpeed, 1);
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
