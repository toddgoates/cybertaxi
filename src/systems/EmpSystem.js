import * as THREE from 'three';

const EMP_PICKUP_OFFSETS = [
  new THREE.Vector3(-140, 0, 90),
  new THREE.Vector3(135, 0, -120),
  new THREE.Vector3(0, 0, 160),
  new THREE.Vector3(-170, 0, -30),
  new THREE.Vector3(165, 0, 40),
];

function createEmpPickup(radius) {
  const group = new THREE.Group();

  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 1.6, 32, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x63ff83,
      emissive: 0x35ff6a,
      emissiveIntensity: 1,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
    }),
  );
  ring.position.y = 0.8;
  group.add(ring);

  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.2, radius * 0.28, 10, 16),
    new THREE.MeshBasicMaterial({ color: 0x85ff9e, toneMapped: false }),
  );
  core.position.y = 5;
  group.add(core);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.62, 0.45, 10, 32),
    new THREE.MeshBasicMaterial({ color: 0x4dff86, transparent: true, opacity: 0.7, toneMapped: false }),
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 3.6;
  group.add(halo);

  group.visible = false;
  return group;
}

function createEmpBlastEffect() {
  const group = new THREE.Group();

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x72ff98,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(8, 0.7, 12, 48), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const shockwave = new THREE.Mesh(
    new THREE.RingGeometry(6, 8, 48),
    new THREE.MeshBasicMaterial({
      color: 0xb5ffc4,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  shockwave.rotation.x = -Math.PI / 2;
  shockwave.position.y = 0.4;
  group.add(shockwave);

  const particlesGeometry = new THREE.BufferGeometry();
  const count = 48;
  const positions = new Float32Array(count * 3);
  const random = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    positions[i * 3] = Math.cos(angle) * 10;
    positions[i * 3 + 1] = (i % 4) * 0.35;
    positions[i * 3 + 2] = Math.sin(angle) * 10;
    random[i] = 0.7 + Math.random() * 0.9;
  }
  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particlesGeometry.setAttribute('empRandom', new THREE.BufferAttribute(random, 1));
  const particles = new THREE.Points(
    particlesGeometry,
    new THREE.PointsMaterial({
      color: 0x7dffa3,
      size: 2.2,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  group.add(particles);

  group.visible = false;
  group.userData = { ring, shockwave, particles, timer: 0 };
  return group;
}

export class EmpSystem {
  constructor(scene, input, worldData, config, ui) {
    this.scene = scene;
    this.input = input;
    this.worldData = worldData;
    this.config = config.emp;
    this.ui = ui;
    this.charges = 0;
    this.spawnTimer = this.config.spawnIntervalSeconds;
    this.pickup = createEmpPickup(this.config.pickupRadius);
    this.effect = createEmpBlastEffect();
    this.scene.add(this.pickup, this.effect);
    this.pickupSpots = this.createPickupSpots();
    this.pickupActive = false;
    this.pickupTarget = null;
    this.audioIndex = 0;
    this.zapSounds = Array.from({ length: 3 }, () => {
      const audio = new Audio('/audio/zap.mp3');
      audio.preload = 'auto';
      audio.volume = 0.48;
      return audio;
    });
  }

  createPickupSpots() {
    return this.worldData.districtAnchors.flatMap((district) => EMP_PICKUP_OFFSETS.map((offset) => ({
      district: district.name,
      position: district.position.clone().add(offset),
    })));
  }

  update(delta, player, rivals) {
    this.updateSpawn(delta, player);
    this.updatePickup(delta, player);
    this.updateEffect(delta, player);

    if (this.input.consumePress('emp')) {
      return this.activate(player, rivals);
    }

    return null;
  }

  updateSpawn(delta, player) {
    if (this.pickupActive || this.charges >= this.config.maxCharges) return;

    this.spawnTimer = Math.max(0, this.spawnTimer - delta);
    if (this.spawnTimer > 0) return;

    const currentDistrict = this.worldData.getDistrictName(player.mesh.position);
    const candidates = this.pickupSpots.filter((spot) => spot.district !== currentDistrict);
    const pool = candidates.length > 0 ? candidates : this.pickupSpots;
    this.pickupTarget = pool[Math.floor(Math.random() * pool.length)];
    this.pickup.position.copy(this.pickupTarget.position);
    this.pickup.visible = true;
    this.pickupActive = true;
    this.ui.pushFeed('EMP charge detected on the grid', 'good');
  }

  updatePickup(delta, player) {
    if (!this.pickupActive) return;

    this.pickup.rotation.y += delta * 1.2;
    this.pickup.children[1].position.y = 5 + Math.sin(performance.now() * 0.004) * 1.1;
    this.pickup.children[2].rotation.z += delta * 0.8;

    if (player.mesh.position.distanceTo(this.pickup.position) < this.config.pickupRadius) {
      this.charges = Math.min(this.config.maxCharges, this.charges + 1);
      this.pickup.visible = false;
      this.pickupActive = false;
      this.pickupTarget = null;
      this.spawnTimer = this.config.spawnIntervalSeconds;
      this.ui.pushFeed(`EMP charge acquired. Inventory ${this.charges}`, 'good');
    }
  }

  activate(player, rivals) {
    if (this.charges <= 0) {
      this.ui.pushFeed('No EMP charges available', 'bad');
      return { used: false, eliminated: 0 };
    }

    this.charges -= 1;
    const eliminated = rivals.disruptNearest(player.mesh.position, this.config.maxTargetsPerBlast, this.config.blastRadius, this.config.respawnDelayAfterUse);
    this.playZapSound();
    this.effect.visible = true;
    this.effect.userData.timer = 0.65;
    this.effect.position.copy(player.mesh.position);
    this.ui.pushFeed(eliminated > 0 ? `EMP burst disabled ${eliminated} rival taxis` : 'EMP burst discharged with no lock', eliminated > 0 ? 'good' : 'info');
    return { used: true, eliminated };
  }

  playZapSound() {
    const audio = this.zapSounds[this.audioIndex];
    this.audioIndex = (this.audioIndex + 1) % this.zapSounds.length;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  updateEffect(delta, player) {
    if (!this.effect.visible) return;

    const effectState = this.effect.userData;
    effectState.timer = Math.max(0, effectState.timer - delta);
    const progress = 1 - effectState.timer / 0.65;
    this.effect.position.copy(player.mesh.position);

    effectState.ring.scale.setScalar(1 + progress * 6.4);
    effectState.ring.material.opacity = (1 - progress) * 0.9;
    effectState.shockwave.scale.setScalar(1 + progress * 18);
    effectState.shockwave.material.opacity = (1 - progress) * 0.8;
    effectState.particles.material.opacity = (1 - progress) * 0.9;
    effectState.particles.rotation.y += delta * 1.3;

    if (effectState.timer === 0) {
      this.effect.visible = false;
    }
  }

  getState() {
    return {
      charges: this.charges,
      pickupTarget: this.pickupActive
        ? {
            name: 'EMP charge',
            x: this.pickup.position.x,
            z: this.pickup.position.z,
          }
        : null,
      cooldownSeconds: this.pickupActive || this.charges >= this.config.maxCharges ? 0 : Math.ceil(this.spawnTimer),
    };
  }
}
