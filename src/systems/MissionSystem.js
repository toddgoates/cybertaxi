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

function randomInt(min, max) {
  return THREE.MathUtils.randInt(min, max);
}

function pickOne(list) {
  return list[Math.floor(Math.random() * list.length)];
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
    this.completedFares = 0;
    this.perfectFares = 0;
    this.currentRunHadIncident = false;
    this.phase = 'pickup';
    this.nextSpecialFareCredits = this.config.specialFareThreshold;
    this.queuedSpecialFares = 0;
    this.activeSpecialFare = null;
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
    this.fakePassengerHandler = null;
    this.startNextFare();
  }

  setFakePassengerHandler(handler) {
    this.fakePassengerHandler = handler;
  }

  createPickupSpots() {
    const clearance = this.config.pickupRadius + 4;
    return this.worldData.districtAnchors.flatMap((district) => {
      return PICKUP_OFFSETS.map((offset, index) => ({
        district,
        name: district.name,
        id: `${district.name}-${index}`,
        position: this.resolvePickupPosition(district.position, offset, clearance),
      }));
    });
  }

  resolvePickupPosition(anchor, offset, clearance) {
    _pickupPosition.copy(anchor).add(offset);

    for (let iteration = 0; iteration < 6; iteration += 1) {
      const collider = this.findOverlappingPickupCollider(_pickupPosition, clearance);
      if (!collider) break;

      _colliderCenter.set(
        (collider.min.x + collider.max.x) * 0.5,
        _pickupPosition.y,
        (collider.min.z + collider.max.z) * 0.5,
      );
      _pushDirection.copy(_pickupPosition).sub(_colliderCenter).setY(0);
      if (_pushDirection.lengthSq() < 0.001) {
        _pushDirection.copy(offset).setY(0);
      }
      if (_pushDirection.lengthSq() < 0.001) {
        _pushDirection.set(1, 0, 0);
      }
      _pushDirection.normalize();

      const pushDistanceX = Math.max(0, collider.max.x - _pickupPosition.x + clearance, _pickupPosition.x - collider.min.x + clearance);
      const pushDistanceZ = Math.max(0, collider.max.z - _pickupPosition.z + clearance, _pickupPosition.z - collider.min.z + clearance);
      _pickupPosition.addScaledVector(_pushDirection, Math.max(pushDistanceX, pushDistanceZ, clearance * 0.6));
    }

    return _pickupPosition.clone();
  }

  findOverlappingPickupCollider(position, clearance) {
    return this.worldData.colliders.find((collider) => {
      if (collider.type !== 'building') return false;
      return position.x > collider.min.x - clearance
        && position.x < collider.max.x + clearance
        && position.z > collider.min.z - clearance
        && position.z < collider.max.z + clearance;
    }) ?? null;
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
    group.userData = { labelSprite, ring, beacon, baseColor: color };
    return group;
  }

  setZoneColor(zone, color) {
    zone.userData.ring.material.color.setHex(color);
    zone.userData.ring.material.emissive.setHex(color);
    zone.userData.beacon.material.emissive.setHex(color);
  }

  buildOffer(pickup, districts, special = false) {
    let dropoff = districts[Math.floor(Math.random() * districts.length)];

    while (dropoff.name === pickup.name) {
      dropoff = districts[Math.floor(Math.random() * districts.length)];
    }

    const tripDistance = pickup.position.distanceTo(dropoff.position);
    const baseFare = randomInt(this.config.baseFareMin, this.config.baseFareMax);
    const distanceBonus = Math.round(tripDistance * this.config.distanceFareMultiplier);
    const quotedFare = baseFare + distanceBonus;
    const specialFare = randomInt(this.config.specialFareMinCredits, this.config.specialFareMaxCredits);

    return {
      pickupId: pickup.id,
      pickupDistrict: pickup.district,
      pickupPosition: pickup.position.clone(),
      dropoffDistrict: dropoff,
      quotedFare: special ? specialFare : quotedFare,
      special,
      fake: false,
      robberyAmount: 0,
    };
  }

  maybeQueueSpecialFare() {
    let queued = 0;
    while (this.totalCredits >= this.nextSpecialFareCredits) {
      this.queuedSpecialFares += 1;
      queued += 1;
      this.nextSpecialFareCredits += this.config.specialFareThreshold;
    }

    if (queued > 0) {
      this.ui.pushFeed('Priority fare unlocked on the grid', 'info');
    }
  }

  setStartingCredits(amount) {
    this.totalCredits = Math.max(0, Math.round(amount));
    const threshold = this.config.specialFareThreshold;
    this.nextSpecialFareCredits = Math.floor(this.totalCredits / threshold + 1) * threshold;
    this.queuedSpecialFares = 0;
  }

  startNextFare(playerPosition = null) {
    const districts = [...this.worldData.districtAnchors];
    const currentDistrictName = playerPosition ? this.worldData.getDistrictName(playerPosition) : null;
    const pickupCandidates = currentDistrictName
      ? this.pickupSpots.filter((spot) => spot.name !== currentDistrictName)
      : this.pickupSpots;
    const pickupPool = pickupCandidates.length >= PICKUP_OPTION_COUNT ? pickupCandidates : this.pickupSpots;
    const shuffledPool = [...pickupPool].sort(() => Math.random() - 0.5);

    this.pickupOffers = shuffledPool.slice(0, PICKUP_OPTION_COUNT).map((pickup) => this.buildOffer(pickup, districts));

    if (this.queuedSpecialFares > 0 && this.pickupOffers.length > 0) {
      const usedPickups = new Set(this.pickupOffers.map((offer) => offer.pickupId));
      const specialPickup = shuffledPool.slice(PICKUP_OPTION_COUNT).find((pickup) => !usedPickups.has(pickup.id)) ?? shuffledPool[0];
      const replaceIndex = Math.min(this.pickupOffers.length - 1, randomInt(0, this.pickupOffers.length - 1));
      this.pickupOffers[replaceIndex] = this.buildOffer(specialPickup, districts, true);
      this.queuedSpecialFares -= 1;
      this.ui.pushFeed('Priority fare beacon is live', 'info');
    }

    if (this.totalCredits >= this.config.fakePassengerThresholdCredits && this.pickupOffers.length > 0) {
      const candidateIndexes = this.pickupOffers
        .map((offer, index) => ({ offer, index }))
        .filter(({ offer }) => !offer.special);
      const fakeIndexPool = candidateIndexes.length > 0 ? candidateIndexes : this.pickupOffers.map((offer, index) => ({ offer, index }));
      const { offer } = pickOne(fakeIndexPool);
      offer.fake = true;
      offer.robberyAmount = randomInt(this.config.fakePassengerMinRobberyCredits, this.config.fakePassengerMaxRobberyCredits);
    }

    this.pickupDistrict = null;
    this.dropoffDistrict = null;
    this.originalFare = 0;
    this.currentFare = 0;
    this.activeSpecialFare = null;
    this.currentRunHadIncident = false;
    this.phase = 'pickup';
    this.pendingPenaltyText = 'Choose a passenger to lock in a fare';
    this.pickupZones.forEach((zone, index) => {
      const offer = this.pickupOffers[index];
      zone.visible = Boolean(offer);
      if (offer) {
        zone.position.copy(offer.pickupPosition);
        this.setZoneColor(zone, offer.special ? 0x58a6ff : zone.userData.baseColor);
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

    if (offer.fake) {
      this.handleFakePassenger(offer);
      return;
    }

    this.pickupDistrict = offer.pickupDistrict;
    this.dropoffDistrict = offer.dropoffDistrict;
    this.originalFare = offer.quotedFare;
    this.currentFare = offer.quotedFare;
    this.activeSpecialFare = offer.special ? { penaltyLoss: 0 } : null;
    this.phase = 'dropoff';
    this.pendingPenaltyText = '';
    this.currentRunHadIncident = false;
    this.pickupZones.forEach((zone) => {
      zone.visible = false;
      zone.userData.labelSprite.visible = false;
      this.setZoneColor(zone, zone.userData.baseColor);
    });
    this.dropoffZone.visible = true;
    this.dropoffZone.position.copy(offer.dropoffDistrict.position);
    this.objective = offer.special ? `Priority fare to ${this.dropoffDistrict.name}` : `Deliver passenger to ${this.dropoffDistrict.name}`;
    this.routeLabel = formatDistrictTrip(this.pickupDistrict.name, this.dropoffDistrict.name);
    this.ui.pushFeed(
      offer.special
        ? `Priority fare onboard. Fare locked at ${this.originalFare} credits`
        : `Passenger onboard. Fare locked at ${this.originalFare} credits`,
      'info',
    );
    this.effects.onPickup();
  }

  handleFakePassenger(offer) {
    const robberyAmount = offer.robberyAmount || randomInt(this.config.fakePassengerMinRobberyCredits, this.config.fakePassengerMaxRobberyCredits);
    this.totalCredits = Math.max(0, this.totalCredits - robberyAmount);
    this.pendingPenaltyText = `-${robberyAmount} credits from fake passenger`;
    this.ui.pushFeed('You were robbed by a fake passenger!', 'bad');
    this.ui.pushFeed(`Lost ${robberyAmount} credits`, 'bad');
    this.fakePassengerHandler?.({ robberyAmount });
    this.startNextFare(offer.pickupPosition);
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
        const cancelMessage = this.currentRunHadIncident
          ? 'The passenger cancelled the ride! Too bumpy!'
          : 'The passenger cancelled the ride! Too long!';
        this.ui.showAlert(cancelMessage);
        this.ui.pushFeed(
          cancelMessage,
          'bad',
        );
        this.ui.pushFeed(`Fare failed. Passenger charged you ${compensation} credits`, 'bad');
        this.startNextFare(player.mesh.position);
        return;
      }

        if (player.mesh.position.distanceTo(this.dropoffZone.position) < this.config.dropoffRadius) {
          const payout = Math.round(this.currentFare);
          this.totalCredits += payout;
          this.maybeQueueSpecialFare();
          this.completedFares += 1;
          if (!this.currentRunHadIncident && payout >= Math.round(this.originalFare * 0.96)) {
            this.perfectFares += 1;
          }
          this.ui.pushFeed(
            this.activeSpecialFare
              ? `Priority drop-off complete. Earned ${payout} credits`
              : `Dropoff complete. Earned ${payout} credits`,
            'good',
          );
          this.effects.onDropoff();
          this.startNextFare(player.mesh.position);
      }
    }
  }

  spinZones(delta) {
    const time = performance.now() * 0.004;
    this.pickupZones.forEach((zone, index) => {
      zone.rotation.y += delta * (0.75 + index * 0.06);
      zone.children[1].position.y = 4 + Math.sin(time + index) * 0.8;
      const offer = this.pickupOffers[index];
      if (offer?.fake) {
        const baseColor = offer.special ? 0x58a6ff : zone.userData.baseColor;
        const flickerColor = offer.special ? 0xffc45c : 0xffe45c;
        const flicker = Math.sin(time * 3.7 + index * 1.4) > 0.985;
        this.setZoneColor(zone, flicker ? flickerColor : baseColor);
      }
    });
    this.dropoffZone.rotation.y -= delta * 0.9;
    this.dropoffZone.children[1].position.y = 4 + Math.cos(time) * 0.8;
  }

  applyCollisionPenalty(amount, source) {
    if (this.phase !== 'dropoff') return;

    this.currentFare = Math.max(0, this.currentFare - amount);
    if (this.activeSpecialFare) {
      this.activeSpecialFare.penaltyLoss += amount;
    }
    this.currentRunHadIncident = true;
    const rounded = Math.round(amount);
    this.pendingPenaltyText = `-${rounded} credits from ${source}`;
    this.ui.pushFeed(this.pendingPenaltyText, 'bad');
  }

  onEnergyDepleted(playerPosition, penalty) {
    if (this.phase !== 'dropoff') return;

    this.totalCredits -= penalty;
    this.currentRunHadIncident = true;
    this.pendingPenaltyText = `Passenger refund -${penalty} credits`;
    this.ui.pushFeed(`Passenger stranded. Emergency tow fee ${penalty} credits`, 'bad');
    this.startNextFare(playerPosition);
  }

  getState() {
    return {
      currentFare: Math.round(this.currentFare),
      totalCredits: this.totalCredits,
      completedFares: this.completedFares,
      perfectFares: this.perfectFares,
      objective: this.objective,
      routeLabel: this.routeLabel,
      phase: this.phase,
      specialFareActive: Boolean(this.activeSpecialFare),
      pendingPenaltyText: this.pendingPenaltyText,
      pickupTargets: this.pickupOffers.map((offer) => ({
        name: offer.pickupDistrict.name,
        fare: offer.quotedFare,
        special: offer.special,
        x: offer.pickupPosition.x,
        y: offer.pickupPosition.y,
        z: offer.pickupPosition.z,
      })),
      dropoffTarget: this.dropoffDistrict
        ? {
            name: this.dropoffDistrict.name,
            special: Boolean(this.activeSpecialFare),
            x: this.dropoffZone.position.x,
            y: this.dropoffZone.position.y,
            z: this.dropoffZone.position.z,
          }
        : null,
    };
  }
}

const _pickupPosition = new THREE.Vector3();
const _colliderCenter = new THREE.Vector3();
const _pushDirection = new THREE.Vector3();
