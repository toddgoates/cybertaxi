import * as THREE from 'three';

const PICKUP_OPTION_COUNT = 5;
const PICKUP_OFFSETS = [
  new THREE.Vector3(-120, 0, -70),
  new THREE.Vector3(110, 0, -90),
  new THREE.Vector3(0, 0, 130),
];

function createFareLabelSprite() {
  const texture = new THREE.CanvasTexture(document.createElement('canvas'));
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.position.y = 11;
  sprite.scale.set(22, 6, 1);
  sprite.userData.texture = texture;
  return sprite;
}

function updateFareLabelSprite(sprite, text) {
  const canvas = sprite.material.map.image;
  canvas.width = 256;
  canvas.height = 72;
  const context = canvas.getContext('2d');

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(4, 16, 28, 0.82)';
  context.strokeStyle = 'rgba(123, 229, 255, 0.75)';
  context.lineWidth = 4;
  context.beginPath();
  context.roundRect(6, 6, canvas.width - 12, canvas.height - 12, 18);
  context.fill();
  context.stroke();

  context.fillStyle = '#c8f6ff';
  context.font = '700 28px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  sprite.material.map.needsUpdate = true;
}

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
    this.originalFare = 0;
    this.phase = 'pickup';
    this.pickupSpots = this.createPickupSpots();
    this.pickupZones = Array.from({ length: PICKUP_OPTION_COUNT }, () => this.createZone(0x00e6ff, this.config.pickupRadius));
    this.dropoffZone = this.createZone(0xff4fd8, this.config.dropoffRadius);
    this.scene.add(...this.pickupZones, this.dropoffZone);
    this.pickupZones.forEach((zone) => {
      zone.visible = false;
    });
    this.dropoffZone.visible = false;
    this.pickupOffers = [];
    this.pickupDistrict = null;
    this.dropoffDistrict = null;
    this.pendingPenaltyText = '';
    this.objective = '';
    this.routeLabel = '';
    this.startNextFare();
  }

  createPickupSpots() {
    return this.worldData.districtAnchors.flatMap((district) => {
      return PICKUP_OFFSETS.map((offset, index) => ({
        district,
        name: district.name,
        id: `${district.name}-${index}`,
        position: district.position.clone().add(offset),
      }));
    });
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

    const labelSprite = createFareLabelSprite();
    labelSprite.visible = false;
    group.add(labelSprite);
    group.userData.labelSprite = labelSprite;
    return group;
  }

  startNextFare(playerPosition = null) {
    const districts = [...this.worldData.districtAnchors];
    const currentDistrictName = playerPosition ? this.worldData.getDistrictName(playerPosition) : null;
    const pickupCandidates = currentDistrictName
      ? this.pickupSpots.filter((spot) => spot.name !== currentDistrictName)
      : this.pickupSpots;
    const pickupPool = pickupCandidates.length >= PICKUP_OPTION_COUNT ? pickupCandidates : this.pickupSpots;
    const shuffledPool = [...pickupPool].sort(() => Math.random() - 0.5);

    this.pickupOffers = shuffledPool.slice(0, PICKUP_OPTION_COUNT).map((pickup) => {
      let dropoff = districts[Math.floor(Math.random() * districts.length)];

      while (dropoff.name === pickup.name) {
        dropoff = districts[Math.floor(Math.random() * districts.length)];
      }

      const tripDistance = pickup.position.distanceTo(dropoff.position);
      const baseFare = THREE.MathUtils.randInt(this.config.baseFareMin, this.config.baseFareMax);
      const distanceBonus = Math.round(tripDistance * this.config.distanceFareMultiplier);
      const quotedFare = baseFare + distanceBonus;

      return {
        pickupDistrict: pickup.district,
        pickupPosition: pickup.position.clone(),
        dropoffDistrict: dropoff,
        quotedFare,
      };
    });

    this.pickupDistrict = null;
    this.dropoffDistrict = null;
    this.originalFare = 0;
    this.currentFare = 0;
    this.phase = 'pickup';
    this.pendingPenaltyText = 'Choose a passenger to lock in a fare';
    this.pickupZones.forEach((zone, index) => {
      const offer = this.pickupOffers[index];
      zone.visible = Boolean(offer);
      if (offer) {
        zone.position.copy(offer.pickupPosition);
        updateFareLabelSprite(zone.userData.labelSprite, `${offer.quotedFare} cr`);
        zone.userData.labelSprite.visible = true;
      } else {
        zone.userData.labelSprite.visible = false;
      }
    });
    this.dropoffZone.visible = false;
    this.objective = 'Find a passenger';
    this.routeLabel = `${this.pickupOffers.length} fares available`;
    this.ui.pushFeed(`${this.pickupOffers.length} fares available across the city`, 'good');
  }

  selectPickup(offerIndex) {
    const offer = this.pickupOffers[offerIndex];
    if (!offer) return;

    this.pickupDistrict = offer.pickupDistrict;
    this.dropoffDistrict = offer.dropoffDistrict;
    this.originalFare = offer.quotedFare;
    this.currentFare = offer.quotedFare;
    this.phase = 'dropoff';
    this.pendingPenaltyText = '';
    this.pickupZones.forEach((zone) => {
      zone.visible = false;
      zone.userData.labelSprite.visible = false;
    });
    this.dropoffZone.visible = true;
    this.dropoffZone.position.copy(offer.dropoffDistrict.position);
    this.objective = `Deliver passenger to ${this.dropoffDistrict.name}`;
    this.routeLabel = formatDistrictTrip(this.pickupDistrict.name, this.dropoffDistrict.name);
    this.ui.pushFeed(`Passenger onboard. Fare locked at ${this.originalFare} credits`, 'info');
    this.effects.onPickup();
  }

  update(delta, player) {
    this.spinZones(delta);

    if (this.phase === 'pickup') {
      for (let i = 0; i < this.pickupOffers.length; i += 1) {
        if (player.mesh.position.distanceTo(this.pickupZones[i].position) < this.config.pickupRadius) {
          this.selectPickup(i);
          break;
        }
      }
      return;
    }

    if (this.phase === 'dropoff') {
      this.currentFare = Math.max(0, this.currentFare - this.config.timePenaltyPerSecond * delta);

      if (this.currentFare === 0) {
        const compensation = Math.round(this.originalFare * 0.5);
        this.totalCredits -= compensation;
        this.pendingPenaltyText = `Passenger refund -${compensation} credits`;
        this.ui.pushFeed(`Fare failed. Passenger charged you ${compensation} credits`, 'bad');
        this.startNextFare(player.mesh.position);
        return;
      }

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
    this.pickupZones.forEach((zone, index) => {
      zone.rotation.y += delta * (0.75 + index * 0.06);
      zone.children[1].position.y = 4 + Math.sin(performance.now() * 0.004 + index) * 0.8;
    });
    this.dropoffZone.rotation.y -= delta * 0.9;
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

  onEnergyDepleted(playerPosition, penalty) {
    if (this.phase !== 'dropoff') return;

    this.totalCredits -= penalty;
    this.pendingPenaltyText = `Passenger refund -${penalty} credits`;
    this.ui.pushFeed(`Passenger stranded. Emergency tow fee ${penalty} credits`, 'bad');
    this.startNextFare(playerPosition);
  }

  getState() {
    return {
      currentFare: Math.round(this.currentFare),
      totalCredits: this.totalCredits,
      objective: this.objective,
      routeLabel: this.routeLabel,
      phase: this.phase,
      pendingPenaltyText: this.pendingPenaltyText,
      pickupTargets: this.pickupOffers.map((offer) => ({
        name: offer.pickupDistrict.name,
        fare: offer.quotedFare,
        x: offer.pickupPosition.x,
        z: offer.pickupPosition.z,
      })),
      dropoffTarget: this.dropoffDistrict
        ? {
            name: this.dropoffDistrict.name,
            x: this.dropoffZone.position.x,
            z: this.dropoffZone.position.z,
          }
        : null,
    };
  }
}
