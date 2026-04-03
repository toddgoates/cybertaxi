import * as THREE from 'three';

function formatDistrictTrip(from, to) {
  return `${from} -> ${to}`;
}

export class MissionSystem {
  constructor(scene, worldData, config, ui, effects) {
    this.scene = scene;
    this.worldData = worldData;
    this.config = config.mission;
    this.ui = ui;
    this.effects = effects;
    this.totalCredits = 0;
    this.currentFare = 0;
    this.phase = 'pickup';
    this.pickupZone = this.createZone(0x00e6ff, this.config.pickupRadius);
    this.dropoffZone = this.createZone(0xff4fd8, this.config.dropoffRadius);
    this.scene.add(this.pickupZone, this.dropoffZone);
    this.dropoffZone.visible = false;
    this.pendingPenaltyText = '';
    this.objective = '';
    this.routeLabel = '';
    this.startNextFare();
  }

  createZone(color, radius) {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 1.4, 24, 1, true),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    );
    ring.position.y = 0.7;
    group.add(ring);

    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.22, radius * 0.3, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 1.25 }),
    );
    beacon.position.y = 4;
    group.add(beacon);
    return group;
  }

  startNextFare(playerPosition = null) {
    const districts = [...this.worldData.districtAnchors];
    const currentDistrictName = playerPosition ? this.worldData.getDistrictName(playerPosition) : null;
    const pickupCandidates = currentDistrictName
      ? districts.filter((district) => district.name !== currentDistrictName)
      : districts;
    const pickupPool = pickupCandidates.length > 0 ? pickupCandidates : districts;
    const pickup = pickupPool[Math.floor(Math.random() * pickupPool.length)];
    let dropoff = districts[Math.floor(Math.random() * districts.length)];

    while (dropoff.name === pickup.name) {
      dropoff = districts[Math.floor(Math.random() * districts.length)];
    }

    this.pickupDistrict = pickup;
    this.dropoffDistrict = dropoff;
    this.currentFare = THREE.MathUtils.randInt(this.config.baseFareMin, this.config.baseFareMax);
    this.phase = 'pickup';
    this.pendingPenaltyText = '';
    this.pickupZone.visible = true;
    this.dropoffZone.visible = false;
    this.pickupZone.position.copy(pickup.position);
    this.dropoffZone.position.copy(dropoff.position);
    this.objective = `Pick up passenger in ${pickup.name}`;
    this.routeLabel = formatDistrictTrip(pickup.name, dropoff.name);
    this.ui.pushFeed(`New fare quoted at ${this.currentFare} credits`, 'good');
  }

  update(delta, player) {
    this.spinZones(delta);

    if (this.phase === 'pickup') {
      if (player.mesh.position.distanceTo(this.pickupZone.position) < this.config.pickupRadius) {
        this.phase = 'dropoff';
        this.pickupZone.visible = false;
        this.dropoffZone.visible = true;
        this.objective = `Deliver passenger to ${this.dropoffDistrict.name}`;
        this.ui.pushFeed(`Passenger onboard. Route set for ${this.dropoffDistrict.name}`, 'info');
        this.effects.onPickup();
      }
      return;
    }

    if (this.phase === 'dropoff') {
      this.currentFare = Math.max(0, this.currentFare - this.config.timePenaltyPerSecond * delta);
      if (player.mesh.position.distanceTo(this.dropoffZone.position) < this.config.dropoffRadius) {
        const payout = Math.round(this.currentFare);
        this.totalCredits += payout;
        this.ui.pushFeed(`Dropoff complete. Earned ${payout} credits`, 'good');
        this.effects.onDropoff();
        this.startNextFare(player.mesh.position);
      }
    }
  }

  spinZones(delta) {
    this.pickupZone.rotation.y += delta * 0.9;
    this.dropoffZone.rotation.y -= delta * 0.9;
    this.pickupZone.children[1].position.y = 4 + Math.sin(performance.now() * 0.004) * 0.8;
    this.dropoffZone.children[1].position.y = 4 + Math.cos(performance.now() * 0.004) * 0.8;
  }

  applyCollisionPenalty(amount, source) {
    if (this.phase !== 'dropoff') return;

    this.currentFare = Math.max(0, this.currentFare - amount);
    const rounded = Math.round(amount);
    this.pendingPenaltyText = `-${rounded} credits from ${source}`;
    this.ui.pushFeed(this.pendingPenaltyText, 'bad');
    this.effects.onCollision();
  }

  getState() {
    return {
      currentFare: Math.round(this.currentFare),
      totalCredits: this.totalCredits,
      objective: this.objective,
      routeLabel: this.routeLabel,
      phase: this.phase,
      pendingPenaltyText: this.pendingPenaltyText,
      pickupTarget: {
        name: this.pickupDistrict.name,
        x: this.pickupZone.position.x,
        z: this.pickupZone.position.z,
      },
      dropoffTarget: {
        name: this.dropoffDistrict.name,
        x: this.dropoffZone.position.x,
        z: this.dropoffZone.position.z,
      },
    };
  }
}
