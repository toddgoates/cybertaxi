import * as THREE from 'three';

const SUPER_BOOST_PICKUP_OFFSETS = [
  new THREE.Vector3(-90, 0, -150),
  new THREE.Vector3(145, 0, -55),
  new THREE.Vector3(80, 0, 145),
  new THREE.Vector3(-155, 0, 40),
  new THREE.Vector3(0, 0, -185),
];

function createSuperBoostPickup(radius) {
  const group = new THREE.Group();

  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 1.6, 32, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xffb347,
      emissive: 0xff8c2f,
      emissiveIntensity: 1.05,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
    }),
  );
  ring.position.y = 0.8;
  group.add(ring);

  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.24, radius * 0.32, 10, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd07a, toneMapped: false }),
  );
  core.position.y = 5;
  group.add(core);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.66, 0.5, 10, 32),
    new THREE.MeshBasicMaterial({ color: 0xff9d3d, transparent: true, opacity: 0.74, toneMapped: false }),
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 3.6;
  group.add(halo);

  group.visible = false;
  return group;
}

function randomSeconds(min, max) {
  return THREE.MathUtils.randFloat(min, max);
}

export class SuperBoostSystem {
  constructor(scene, input, worldData, config, ui, player) {
    this.scene = scene;
    this.input = input;
    this.worldData = worldData;
    this.config = config.superBoost;
    this.ui = ui;
    this.player = player;
    this.charges = 0;
    this.pickup = createSuperBoostPickup(this.config.pickupRadius);
    this.scene.add(this.pickup);
    this.pickupSpots = this.createPickupSpots();
    this.pickupActive = false;
    this.pickupTarget = null;
    this.spawnAnnouncementPending = false;
    this.spawnTimer = this.scheduleNextSpawn();
  }

  createPickupSpots() {
    return this.worldData.districtAnchors.flatMap((district) => SUPER_BOOST_PICKUP_OFFSETS.map((offset, index) => ({
      district: district.name,
      id: `${district.name}-super-${index}`,
      position: district.position.clone().add(offset),
    })));
  }

  scheduleNextSpawn() {
    return randomSeconds(this.config.spawnIntervalMinSeconds, this.config.spawnIntervalMaxSeconds);
  }

  setStartingCharges(count) {
    this.charges = THREE.MathUtils.clamp(Math.round(count), 0, this.config.maxCharges);
  }

  update(delta, player) {
    this.updateSpawn(delta, player);
    this.updatePickup(delta, player);

    if (this.input.consumePress('superBoost')) {
      return this.activate();
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
    this.spawnAnnouncementPending = true;
    this.ui.pushFeed('Super Boost detected on the grid', 'good');
  }

  updatePickup(delta, player) {
    if (!this.pickupActive) return;

    this.pickup.rotation.y += delta * 1.5;
    this.pickup.children[1].position.y = 5 + Math.sin(performance.now() * 0.0045) * 1.15;
    this.pickup.children[2].rotation.z += delta * 1.15;

    if (player.mesh.position.distanceTo(this.pickup.position) < this.config.pickupRadius) {
      this.charges = Math.min(this.config.maxCharges, this.charges + 1);
      this.pickup.visible = false;
      this.pickupActive = false;
      this.pickupTarget = null;
      this.spawnTimer = this.scheduleNextSpawn();
      this.ui.pushFeed(`Super Boost acquired. Inventory ${this.charges}`, 'good');
    }
  }

  activate() {
    if (this.charges <= 0) {
      this.ui.pushFeed('No Super Boost available', 'bad');
      return { used: false };
    }

    this.charges -= 1;
    this.player.activateSuperBoost(this.config.duration);
    this.ui.pushFeed('Super Boost engaged', 'good');
    return { used: true };
  }

  consumeSpawnEvent() {
    if (!this.spawnAnnouncementPending) return null;
    this.spawnAnnouncementPending = false;
    return this.pickupTarget;
  }

  getState() {
    return {
      charges: this.charges,
      active: this.player.isSuperBoosting,
      pickupTarget: this.pickupActive
        ? {
            name: 'Super Boost',
            x: this.pickup.position.x,
            z: this.pickup.position.z,
          }
        : null,
      cooldownSeconds: this.pickupActive || this.charges >= this.config.maxCharges ? 0 : Math.ceil(this.spawnTimer),
    };
  }
}
