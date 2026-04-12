import * as THREE from 'three';

export class EnergySystem {
  constructor(scene, worldData, config, ui, missions) {
    this.scene = scene;
    this.ui = ui;
    this.missions = missions;
    this.config = config.energy;
    this.stations = worldData.energyStations;
    this.currentEnergy = this.config.maxEnergy;
    this.wasDepleted = false;
    this.activeStation = null;
    this.refuelProgress = 0;
    this.pendingThresholdAnnouncements = [];
    this.thresholds = [20, 10, 5];
    this.triggeredThresholds = new Set();
    this.stationMarkers = this.stations.map((station) => this.createStationMarker(station.position, this.config.stationRadius));
    this.scene.add(...this.stationMarkers);
  }

  createStationMarker(position, radius) {
    const group = new THREE.Group();
    group.position.copy(position);

    const color = 0xffe45c;
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 1.2, 24, 1, true),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.95, transparent: true, opacity: 0.38, side: THREE.DoubleSide }),
    );
    ring.position.y = 0.6;
    group.add(ring);

    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.22, radius * 0.32, 7, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 1.35 }),
    );
    beacon.position.y = 3.8;
    group.add(beacon);

    return group;
  }

  update(delta, player) {
    this.spinStations(delta);
    const previousEnergy = this.currentEnergy;

    const speedRatio = player.getSpeedRatio();
    const drain = this.config.baseDrainPerSecond + speedRatio * this.config.motionDrainPerSecond + (player.isBoosting ? this.config.boostDrainPerSecond : 0);
    this.currentEnergy = Math.max(0, this.currentEnergy - drain * delta);

    const nearbyStation = this.stations.find((station) => player.mesh.position.distanceTo(station.position) < this.config.stationRadius);
    if (nearbyStation && this.currentEnergy < this.config.maxEnergy) {
      if (this.activeStation !== nearbyStation) {
        this.activeStation = nearbyStation;
        this.refuelProgress = 0;
      }

      this.refuelProgress = Math.min(this.config.refuelSeconds, this.refuelProgress + delta);
      if (this.refuelProgress === this.config.refuelSeconds) {
        this.currentEnergy = this.config.maxEnergy;
        this.wasDepleted = false;
        this.activeStation = null;
        this.refuelProgress = 0;
        this.ui.pushFeed(`Energy topped off at ${nearbyStation.name}`, 'good');
      }
    } else {
      this.activeStation = null;
      this.refuelProgress = 0;
    }

    if (this.currentEnergy === 0 && !this.wasDepleted) {
      this.wasDepleted = true;
      this.ui.pushFeed('Energy depleted. Find a recharge station', 'bad');
      this.missions.onEnergyDepleted(player.mesh.position, this.config.emptyPassengerPenalty);
    }

    if (this.currentEnergy > 0) {
      this.wasDepleted = false;
    }

    this.updateThresholdAnnouncements(previousEnergy, this.currentEnergy);
  }

  updateThresholdAnnouncements(previousEnergy, currentEnergy) {
    const previousRatio = previousEnergy / this.config.maxEnergy;
    const currentRatio = currentEnergy / this.config.maxEnergy;

    this.thresholds.forEach((threshold) => {
      const ratioThreshold = threshold / 100;
      if (currentRatio > ratioThreshold) {
        this.triggeredThresholds.delete(threshold);
      }

      if (previousRatio > ratioThreshold && currentRatio <= ratioThreshold && !this.triggeredThresholds.has(threshold)) {
        this.triggeredThresholds.add(threshold);
        this.pendingThresholdAnnouncements.push(threshold);
      }
    });
  }

  spinStations(delta) {
    const time = performance.now() * 0.004;
    this.stationMarkers.forEach((marker, index) => {
      marker.rotation.y += delta * 0.75;
      marker.children[1].position.y = 3.8 + Math.sin(time + index * 0.7) * 0.65;
    });
  }

  getDriveState() {
    return {
      canBoost: this.currentEnergy > 0,
      movementScale: this.currentEnergy > 0 ? 1 : this.config.depletedMovementScale,
    };
  }

  getState() {
    const ratio = this.currentEnergy / this.config.maxEnergy;
    let status = 'Energy stable';

    if (this.currentEnergy === 0) {
      status = 'Energy depleted';
    } else if (ratio < 0.2) {
      status = 'Energy critical';
    } else if (ratio < 0.45) {
      status = 'Energy low';
    }

    if (this.activeStation && this.currentEnergy < this.config.maxEnergy) {
      status = `Charging ${this.refuelProgress.toFixed(1)} / ${this.config.refuelSeconds}s`;
    }

    return {
      currentEnergy: Math.round(this.currentEnergy),
      maxEnergy: this.config.maxEnergy,
      ratio,
      status,
      refuelRatio: this.refuelProgress / this.config.refuelSeconds,
      refueling: Boolean(this.activeStation && this.currentEnergy < this.config.maxEnergy),
      activeStation: this.activeStation
        ? {
            name: this.activeStation.name,
            x: this.activeStation.position.x,
            y: this.activeStation.position.y,
            z: this.activeStation.position.z,
            radius: this.config.stationRadius,
          }
        : null,
      stations: this.stations.map((station) => ({
        name: station.name,
        x: station.position.x,
        z: station.position.z,
      })),
    };
  }

  consumeThresholdAnnouncement() {
    return this.pendingThresholdAnnouncements.shift() ?? null;
  }

  setStartingEnergy(amount) {
    this.currentEnergy = THREE.MathUtils.clamp(Math.round(amount), 1, this.config.maxEnergy);
    this.wasDepleted = false;
    this.pendingThresholdAnnouncements = [];
    this.triggeredThresholds.clear();
    this.thresholds.forEach((threshold) => {
      if (this.currentEnergy / this.config.maxEnergy <= threshold / 100) {
        this.triggeredThresholds.add(threshold);
      }
    });
  }
}
