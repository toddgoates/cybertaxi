import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

function clamp01(value) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function createStrikeZone(radius) {
  const group = new THREE.Group();

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.78, radius, 48),
    new THREE.MeshBasicMaterial({
      color: 0xcfe6ff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.24;
  group.add(ring);

  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.8, 40),
    new THREE.MeshBasicMaterial({
      color: 0x83b9ff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.18;
  group.add(disc);

  const cloudGlow = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 1.18, 40),
    new THREE.MeshBasicMaterial({
      color: 0xbfd7ff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    }),
  );
  cloudGlow.position.y = 170;
  cloudGlow.rotation.x = Math.PI / 2;
  group.add(cloudGlow);

  group.visible = false;
  group.renderOrder = 15;
  group.userData = {
    active: false,
    phase: 'idle',
    timer: 0,
    radius,
    ring,
    disc,
    cloudGlow,
  };
  return group;
}

function createBoltEffect() {
  const segmentCount = 10;
  const positions = new Float32Array(segmentCount * 2 * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.LineBasicMaterial({
    color: 0xf4fbff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });

  const line = new THREE.LineSegments(geometry, material);
  line.visible = false;
  line.renderOrder = 20;

  return {
    line,
    positions,
    duration: 0.15,
    timer: 0,
    active: false,
  };
}

function createRain(count) {
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count);
  const geometry = new THREE.BufferGeometry();

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = THREE.MathUtils.randFloatSpread(180);
    positions[i * 3 + 1] = Math.random() * 140;
    positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(180);
    velocities[i] = 55 + Math.random() * 35;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0x9fcfff,
    size: 1.6,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    fog: false,
  });

  const points = new THREE.Points(geometry, material);
  points.visible = false;
  return { points, positions, velocities };
}

export class StormSystem {
  constructor(scene, camera, renderer, config, ui, missions, player, environment) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.worldConfig = config;
    this.config = config.storm;
    this.ui = ui;
    this.missions = missions;
    this.player = player;
    this.environment = environment;

    this.eligible = false;
    this.unlocked = false;
    this.stormActive = false;
    this.stormAlpha = 0;
    this.intensity = 0;
    this.phaseTimer = THREE.MathUtils.randFloat(this.config.calmMinSeconds, this.config.calmMaxSeconds);
    this.strikePressure = 0;
    this.strikeCooldown = 0;
    this.flashTimer = 0;
    this.flashStrength = 0;
    this.nearbyStrikeTimer = 0;
    this.paused = false;
    this.targetIndex = 0;

    this.baseBackground = this.environment.background.clone();
    this.stormBackground = new THREE.Color(0x060814);
    this.baseFogColor = this.environment.fog.color.clone();
    this.stormFogColor = new THREE.Color(0x11192d);
    this.baseFogDensity = this.environment.fog.density;
    this.stormFogDensity = 0.0048;
    this.baseExposure = renderer.toneMappingExposure;

    this.zones = Array.from({ length: this.config.maxSimultaneousZones }, () => createStrikeZone(this.config.strikeRadius));
    this.bolts = Array.from({ length: this.config.boltPoolSize }, () => createBoltEffect());
    this.rain = createRain(this.config.rainParticleCount);

    this.zones.forEach((zone) => this.scene.add(zone));
    this.bolts.forEach((bolt) => this.scene.add(bolt.line));
    this.scene.add(this.rain.points);

    this.thunderLoop = new Audio('/audio/thunder.mp3');
    this.thunderLoop.loop = true;
    this.thunderLoop.preload = 'auto';
    this.thunderLoop.volume = 0;

    this.cracklePool = Array.from({ length: 3 }, () => {
      const audio = new Audio('/audio/zap.mp3');
      audio.preload = 'auto';
      audio.volume = 0.26;
      return audio;
    });
    this.crackleIndex = 0;

    this.thunderBuffer = null;
    this.fallbackThunder = Array.from({ length: 3 }, () => {
      const audio = new Audio('/audio/thunder.mp3');
      audio.preload = 'auto';
      audio.volume = 0.42;
      return audio;
    });
    this.fallbackThunderIndex = 0;

    const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
    this.audioContext = AudioContextClass ? new AudioContextClass() : null;
    this.loadThunderBuffer();
  }

  async loadThunderBuffer() {
    if (!this.audioContext) return;

    try {
      const response = await fetch('/audio/thunder.mp3');
      const arrayBuffer = await response.arrayBuffer();
      this.thunderBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
    } catch {
      this.thunderBuffer = null;
    }
  }

  setPaused(paused) {
    this.paused = paused;
    if (paused) {
      this.thunderLoop.pause();
      return;
    }

    if (this.intensity > 0.08) {
      this.thunderLoop.play().catch(() => {});
    }
  }

  update(delta, { missionState, rivalsState }) {
    this.nearbyStrikeTimer = Math.max(0, this.nearbyStrikeTimer - delta);
    this.updateLifecycle(delta, missionState, rivalsState);
    this.updateEnvironment(delta);
    this.updateRain(delta);
    this.updateBoltEffects(delta);
    this.updateStrikeScheduling(delta);
    this.updateZones(delta);
    this.updateFlash(delta);
  }

  updateLifecycle(delta, missionState, rivalsState) {
    this.unlocked = this.unlocked || missionState.totalCredits >= this.config.unlockCredits;
    this.eligible = this.unlocked;

    if (!this.eligible) {
      this.stormActive = false;
      this.phaseTimer = THREE.MathUtils.randFloat(this.config.calmMinSeconds, this.config.calmMaxSeconds);
      this.stormAlpha = THREE.MathUtils.damp(this.stormAlpha, 0, this.config.fadeOutSpeed, delta);
      this.intensity = 0;
      return;
    }

    this.phaseTimer = Math.max(0, this.phaseTimer - delta);
    if (this.phaseTimer === 0) {
      this.stormActive = !this.stormActive;
      this.phaseTimer = this.stormActive
        ? THREE.MathUtils.randFloat(this.config.activeMinSeconds, this.config.activeMaxSeconds)
        : THREE.MathUtils.randFloat(this.config.calmMinSeconds, this.config.calmMaxSeconds);
      this.ui.showAlert(this.stormActive ? 'Storm front rolling in' : 'Storm front clearing');
    }

    const targetAlpha = this.stormActive ? 1 : 0;
    const damping = this.stormActive ? this.config.fadeInSpeed : this.config.fadeOutSpeed;
    this.stormAlpha = THREE.MathUtils.damp(this.stormAlpha, targetAlpha, damping, delta);

    const heatPressure = clamp01(rivalsState.intensity ?? 0);
    this.intensity = this.stormAlpha * (0.72 + heatPressure * 0.28);
  }

  updateEnvironment(delta) {
    const flashBoost = this.flashStrength;
    const backgroundMix = clamp01(this.stormAlpha * 0.92);
    const fogMix = clamp01(this.stormAlpha * 0.88);
    const sky = _colorA.copy(this.baseBackground).lerp(this.stormBackground, backgroundMix);
    this.environment.background.copy(sky);

    const fogColor = _colorB.copy(this.baseFogColor).lerp(this.stormFogColor, fogMix);
    this.environment.fog.color.copy(fogColor);
    this.environment.fog.density = THREE.MathUtils.lerp(this.baseFogDensity, this.stormFogDensity, fogMix);

    this.environment.hemi.intensity = THREE.MathUtils.lerp(1.45, 0.85, this.stormAlpha) + flashBoost * 0.5;
    this.environment.ambient.intensity = THREE.MathUtils.lerp(0.58, 0.34, this.stormAlpha) + flashBoost * 0.2;
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(this.baseExposure, 0.92, this.stormAlpha) + flashBoost * 0.18;

    const thunderLoopTarget = this.paused ? 0 : 0.04 + this.intensity * 0.16;
    this.thunderLoop.volume += (thunderLoopTarget - this.thunderLoop.volume) * Math.min(1, delta * 2.2);

    if (this.paused || this.thunderLoop.volume < 0.01) {
      this.thunderLoop.pause();
    } else if (this.thunderLoop.paused) {
      this.thunderLoop.play().catch(() => {});
    }
  }

  updateRain(delta) {
    const rainOpacity = clamp01((this.stormAlpha - 0.18) / 0.82) * 0.34;
    this.rain.points.visible = rainOpacity > 0.02;
    this.rain.points.material.opacity = rainOpacity;
    if (!this.rain.points.visible) return;

    this.rain.points.position.set(
      this.player.mesh.position.x,
      this.player.mesh.position.y + 24,
      this.player.mesh.position.z,
    );

    const positionAttribute = this.rain.points.geometry.getAttribute('position');
    for (let i = 0; i < this.rain.velocities.length; i += 1) {
      const index = i * 3;
      positionAttribute.array[index] -= 6 * delta;
      positionAttribute.array[index + 1] -= this.rain.velocities[i] * delta;
      positionAttribute.array[index + 2] += 10 * delta;

      if (positionAttribute.array[index + 1] < -16) {
        positionAttribute.array[index] = THREE.MathUtils.randFloatSpread(180);
        positionAttribute.array[index + 1] = 120 + Math.random() * 20;
        positionAttribute.array[index + 2] = THREE.MathUtils.randFloatSpread(180);
      }
    }
    positionAttribute.needsUpdate = true;
  }

  updateBoltEffects(delta) {
    this.bolts.forEach((bolt) => {
      if (!bolt.active) return;
      bolt.timer = Math.max(0, bolt.timer - delta);
      bolt.line.material.opacity = clamp01(bolt.timer / bolt.duration) * 0.96;
      if (bolt.timer > 0) return;
      bolt.active = false;
      bolt.line.visible = false;
    });
  }

  updateStrikeScheduling(delta) {
    if (this.intensity < 0.08) return;

    const activeZoneCount = this.zones.reduce((count, zone) => count + (zone.userData.active ? 1 : 0), 0);
    if (activeZoneCount >= this.config.maxSimultaneousZones) return;

    this.strikeCooldown = Math.max(0, this.strikeCooldown - delta);
    const altitudeRisk = this.getAltitudeRisk();
    const interval = THREE.MathUtils.lerp(this.config.maxStrikeInterval, this.config.minStrikeInterval, altitudeRisk * this.intensity);
    this.strikePressure += delta / Math.max(interval, 0.001);

    if (this.strikeCooldown === 0 && this.strikePressure >= 1) {
      this.strikePressure = 0;
      this.strikeCooldown = interval * THREE.MathUtils.lerp(0.4, 0.62, 1 - altitudeRisk);
      this.spawnTelegraphZone(altitudeRisk);
    }
  }

  spawnTelegraphZone(altitudeRisk) {
    const zone = this.zones.find((entry) => !entry.userData.active);
    if (!zone) return;

    const target = this.computeStrikeTarget(altitudeRisk);
    zone.position.copy(target);
    zone.visible = true;
    zone.userData.active = true;
    zone.userData.phase = 'telegraph';
    zone.userData.timer = this.config.telegraphSeconds;
    zone.scale.setScalar(1);
    zone.userData.ring.material.opacity = 0.34;
    zone.userData.disc.material.opacity = 0.08;
    zone.userData.cloudGlow.material.opacity = 0.14 + altitudeRisk * 0.18;

    if (this.player.mesh.position.distanceToSquared(zone.position) < 90 * 90) {
      this.ui.showAlert('Lightning lock forming');
    }

    this.playCrackle();
  }

  updateZones(delta) {
    for (let i = 0; i < this.zones.length; i += 1) {
      const zone = this.zones[i];
      if (!zone.userData.active) continue;

      zone.userData.timer = Math.max(0, zone.userData.timer - delta);

      if (zone.userData.phase === 'telegraph') {
        const progress = 1 - zone.userData.timer / this.config.telegraphSeconds;
        const flicker = 0.5 + Math.sin(performance.now() * 0.03 + i * 0.9) * 0.5;
        zone.userData.ring.material.opacity = 0.24 + progress * 0.46 + flicker * 0.12;
        zone.userData.disc.material.opacity = 0.04 + progress * 0.18;
        zone.userData.cloudGlow.material.opacity = 0.12 + progress * 0.24 + flicker * 0.1;
        zone.rotation.y += delta * (1.4 + i * 0.25);
        zone.scale.setScalar(1 + progress * 0.12);

        if (zone.userData.timer === 0) {
          this.fireStrike(zone);
        }
        continue;
      }

      if (zone.userData.phase === 'strike') {
        const strikeProgress = 1 - zone.userData.timer / this.config.strikeSeconds;
        zone.userData.ring.material.opacity = 0.95 - strikeProgress * 0.7;
        zone.userData.disc.material.opacity = 0.68 - strikeProgress * 0.54;
        zone.userData.cloudGlow.material.opacity = 0.8 - strikeProgress * 0.64;
        if (zone.userData.timer === 0) {
          zone.userData.phase = 'cooldown';
          zone.userData.timer = this.config.scorchSeconds;
        }
        continue;
      }

      const coolProgress = 1 - zone.userData.timer / this.config.scorchSeconds;
      zone.userData.ring.material.opacity = 0.2 - coolProgress * 0.2;
      zone.userData.disc.material.opacity = 0.08 - coolProgress * 0.08;
      zone.userData.cloudGlow.material.opacity = 0.12 - coolProgress * 0.12;
      zone.scale.setScalar(1 + coolProgress * 0.08);

      if (zone.userData.timer === 0) {
        zone.visible = false;
        zone.userData.active = false;
        zone.userData.phase = 'idle';
      }
    }
  }

  fireStrike(zone) {
    zone.userData.phase = 'strike';
    zone.userData.timer = this.config.strikeSeconds;
    zone.scale.setScalar(1.06);

    this.flashTimer = 0.18;
    this.flashStrength = 1;
    this.ui.flashLightning();
    this.spawnBolt(zone.position);
    this.playThunderAt(zone.position);

    _playerFlat.copy(this.player.mesh.position).setY(0);
    _zoneFlat.copy(zone.position).setY(0);
    const horizontalDistance = _playerFlat.distanceTo(_zoneFlat);
    if (horizontalDistance <= this.config.strikeRadius) {
      this.player.applyControlDisruption(this.config.disruptionSeconds, this.config.disruptionStrength);
      this.missions.applyDirectCreditPenalty(this.config.strikePenalty, 'lightning strike');
      this.ui.triggerSignalGlitch(1);
      this.ui.showAlert('Direct lightning strike');
      this.nearbyStrikeTimer = Math.max(this.nearbyStrikeTimer, 1.4);
    } else if (horizontalDistance <= this.config.strikeRadius * 2.2) {
      this.nearbyStrikeTimer = Math.max(this.nearbyStrikeTimer, 0.7);
    }
  }

  spawnBolt(targetPosition) {
    const bolt = this.bolts.find((entry) => !entry.active) ?? this.bolts[0];
    const height = 170;
    const startX = targetPosition.x + THREE.MathUtils.randFloatSpread(8);
    const startZ = targetPosition.z + THREE.MathUtils.randFloatSpread(8);
    const segmentCount = bolt.positions.length / 6;

    let previousX = startX;
    let previousY = height;
    let previousZ = startZ;

    for (let i = 0; i < segmentCount; i += 1) {
      const t = (i + 1) / segmentCount;
      const nextX = THREE.MathUtils.lerp(startX, targetPosition.x, t) + THREE.MathUtils.randFloatSpread((1 - t) * 12 + 2);
      const nextY = THREE.MathUtils.lerp(height, 0, t);
      const nextZ = THREE.MathUtils.lerp(startZ, targetPosition.z, t) + THREE.MathUtils.randFloatSpread((1 - t) * 12 + 2);
      const index = i * 6;
      bolt.positions[index] = previousX;
      bolt.positions[index + 1] = previousY;
      bolt.positions[index + 2] = previousZ;
      bolt.positions[index + 3] = nextX;
      bolt.positions[index + 4] = nextY;
      bolt.positions[index + 5] = nextZ;
      previousX = nextX;
      previousY = nextY;
      previousZ = nextZ;
    }

    bolt.line.geometry.attributes.position.needsUpdate = true;
    bolt.line.visible = true;
    bolt.active = true;
    bolt.timer = bolt.duration;
    bolt.line.material.opacity = 0.96;
  }

  computeStrikeTarget(altitudeRisk) {
    _forward.copy(this.player.velocity);
    _forward.y = 0;
    if (_forward.lengthSq() < 4) {
      _forward.set(0, 0, -1).applyQuaternion(this.player.mesh.quaternion).setY(0);
    }
    _forward.normalize();
    _right.crossVectors(_forward, UP).normalize();

    const aheadDistance = THREE.MathUtils.lerp(18, 46, altitudeRisk);
    const lateralPattern = [-24, 22, -12, 30, -30, 12];
    const lateralBase = lateralPattern[this.targetIndex % lateralPattern.length];
    this.targetIndex += 1;
    const lateralOffset = lateralBase + THREE.MathUtils.randFloatSpread(10);

    _target.copy(this.player.mesh.position)
      .addScaledVector(_forward, aheadDistance)
      .addScaledVector(_right, lateralOffset);

    _target.x = THREE.MathUtils.clamp(_target.x, -this.worldConfig.worldSize * 0.48, this.worldConfig.worldSize * 0.48);
    _target.z = THREE.MathUtils.clamp(_target.z, -this.worldConfig.worldSize * 0.48, this.worldConfig.worldSize * 0.48);
    _target.y = 0;
    return _target;
  }

  updateFlash(delta) {
    if (this.flashTimer > 0) {
      this.flashTimer = Math.max(0, this.flashTimer - delta);
      this.flashStrength = clamp01(this.flashTimer / 0.18);
      return;
    }

    this.flashStrength = THREE.MathUtils.damp(this.flashStrength, 0, 10, delta);
  }

  playCrackle() {
    const audio = this.cracklePool[this.crackleIndex];
    this.crackleIndex = (this.crackleIndex + 1) % this.cracklePool.length;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  playThunderAt(position) {
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    if (this.audioContext && this.thunderBuffer) {
      try {
        const source = this.audioContext.createBufferSource();
        source.buffer = this.thunderBuffer;
        const gain = this.audioContext.createGain();
        const panner = this.audioContext.createStereoPanner();
        _cameraRelative.copy(position).project(this.camera);
        panner.pan.value = THREE.MathUtils.clamp(_cameraRelative.x, -1, 1);
        const distance = position.distanceTo(this.player.mesh.position);
        gain.gain.value = THREE.MathUtils.clamp(1.05 - distance / 220, 0.18, 0.95);
        source.connect(gain);
        gain.connect(panner);
        panner.connect(this.audioContext.destination);
        source.start(0);
        return;
      } catch {
        // Fall through to HTMLAudio fallback.
      }
    }

    const audio = this.fallbackThunder[this.fallbackThunderIndex];
    this.fallbackThunderIndex = (this.fallbackThunderIndex + 1) % this.fallbackThunder.length;
    audio.currentTime = 0;
    audio.volume = 0.34 + clamp01(1 - position.distanceTo(this.player.mesh.position) / 240) * 0.34;
    audio.play().catch(() => {});
  }

  getAltitudeRisk() {
    const altitude01 = THREE.MathUtils.inverseLerp(this.worldConfig.hoverFloor, this.worldConfig.hoverCeiling, this.player.mesh.position.y);
    return THREE.MathUtils.smoothstep(altitude01, this.config.altitudeSafeStart, 1);
  }

  getState() {
    const altitudeRisk = this.getAltitudeRisk();
    return {
      unlocked: this.eligible,
      active: this.stormAlpha > 0.08,
      intensity: Number(this.intensity.toFixed(2)),
      altitudeRisk: Number(altitudeRisk.toFixed(2)),
      activeStrikes: this.zones.reduce((count, zone) => count + (zone.userData.active ? 1 : 0), 0),
      nearbyStrike: this.nearbyStrikeTimer > 0,
      status: !this.eligible
        ? 'Clear skies'
        : this.stormAlpha > 0.14
          ? 'Storm active'
          : 'Storm cycling',
    };
  }

  getActiveCount() {
    return this.zones.reduce((count, zone) => count + (zone.userData.active ? 1 : 0), 0)
      + this.bolts.reduce((count, bolt) => count + (bolt.active ? 1 : 0), 0)
      + (this.rain.points.visible ? 1 : 0);
  }

  destroy() {
    this.thunderLoop.pause();
    this.thunderLoop.src = '';
    this.cracklePool.forEach((audio) => {
      audio.pause();
      audio.src = '';
    });
    this.fallbackThunder.forEach((audio) => {
      audio.pause();
      audio.src = '';
    });
    this.zones.forEach((zone) => {
      this.scene.remove(zone);
      zone.children.forEach((child) => {
        child.geometry.dispose();
        child.material.dispose();
      });
    });
    this.bolts.forEach((bolt) => {
      this.scene.remove(bolt.line);
      bolt.line.geometry.dispose();
      bolt.line.material.dispose();
    });
    this.scene.remove(this.rain.points);
    this.rain.points.geometry.dispose();
    this.rain.points.material.dispose();
  }
}

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _target = new THREE.Vector3();
const _playerFlat = new THREE.Vector3();
const _zoneFlat = new THREE.Vector3();
const _cameraRelative = new THREE.Vector3();
const _colorA = new THREE.Color();
const _colorB = new THREE.Color();
