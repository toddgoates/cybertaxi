import * as THREE from 'three';

const SPARK_COLORS = [0xfff4a3, 0xffd15c, 0xffa13b, 0xff7a2f];
const SPARK_COUNT = 16;
const SPARK_POOL_SIZE = 12;
const SPARK_COLOR_COMPONENTS = SPARK_COLORS.map((hex) => new THREE.Color(hex).toArray());

export class EffectsHooks {
  constructor(scene) {
    this.scene = scene;
    this.sparkBursts = Array.from({ length: SPARK_POOL_SIZE }, () => this.createSparkBurst());
    this.nextSparkBurstIndex = 0;
    this.collisionAudioIndex = 0;
    this.collisionSounds = Array.from({ length: 4 }, () => {
      const audio = new Audio('/audio/crash.mp3');
      audio.preload = 'auto';
      audio.volume = 0.42;
      return audio;
    });
  }

  createSparkBurst() {
    const positions = new Float32Array(SPARK_COUNT * 3);
    const colors = new Float32Array(SPARK_COUNT * 3);
    const velocities = Array.from({ length: SPARK_COUNT }, () => new THREE.Vector3());
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 1.6,
      transparent: true,
      opacity: 0,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    points.visible = false;
    this.scene.add(points);

    return {
      points,
      positions,
      colors,
      velocities,
      life: 0,
      duration: 0.45,
      active: false,
    };
  }

  onPickup() {
    // Reserved for future stingers, screen flashes, or controller rumble.
  }

  onDropoff() {
    // Reserved for combo scoring, audio cues, or celebratory VFX.
  }

  onCollision(position, normal = new THREE.Vector3(0, 1, 0)) {
    this.playCollisionSound();

    const burst = this.sparkBursts[this.nextSparkBurstIndex];
    this.nextSparkBurstIndex = (this.nextSparkBurstIndex + 1) % this.sparkBursts.length;
    burst.active = true;
    burst.life = burst.duration;
    burst.points.visible = true;
    burst.points.material.opacity = 0.95;

    _sparkBasePosition.copy(position).addScaledVector(normal, 1.8);
    _sparkOutward.copy(normal).setY(Math.max(normal.y, 0));
    if (_sparkOutward.lengthSq() === 0) {
      _sparkOutward.set(0, 1, 0);
    } else {
      _sparkOutward.normalize();
    }

    for (let i = 0; i < SPARK_COUNT; i += 1) {
      const index = i * 3;
      burst.positions[index] = _sparkBasePosition.x;
      burst.positions[index + 1] = _sparkBasePosition.y;
      burst.positions[index + 2] = _sparkBasePosition.z;

      const color = SPARK_COLOR_COMPONENTS[Math.floor(Math.random() * SPARK_COLOR_COMPONENTS.length)];
      burst.colors[index] = color[0];
      burst.colors[index + 1] = color[1];
      burst.colors[index + 2] = color[2];

      const velocity = burst.velocities[i];
      velocity.copy(_sparkOutward).multiplyScalar(10 + Math.random() * 12);
      velocity.add(_sparkJitter.set(
        (Math.random() - 0.5) * 8,
        5 + Math.random() * 8,
        (Math.random() - 0.5) * 8,
      ));
      if (velocity.lengthSq() === 0) {
        velocity.copy(_sparkUp).multiplyScalar(10);
      }
    }

    burst.points.geometry.attributes.position.needsUpdate = true;
    burst.points.geometry.attributes.color.needsUpdate = true;
  }

  playCollisionSound() {
    const audio = this.collisionSounds[this.collisionAudioIndex];
    this.collisionAudioIndex = (this.collisionAudioIndex + 1) % this.collisionSounds.length;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  update(delta) {
    for (let i = 0; i < this.sparkBursts.length; i += 1) {
      const burst = this.sparkBursts[i];
      if (!burst.active) continue;
      burst.life -= delta;

      const positionAttribute = burst.points.geometry.getAttribute('position');
      for (let particleIndex = 0; particleIndex < burst.velocities.length; particleIndex += 1) {
        const velocity = burst.velocities[particleIndex];
        velocity.y -= 24 * delta;
        velocity.multiplyScalar(1 - Math.min(delta * 2.6, 0.22));

        const index = particleIndex * 3;
        positionAttribute.array[index] += velocity.x * delta;
        positionAttribute.array[index + 1] += velocity.y * delta;
        positionAttribute.array[index + 2] += velocity.z * delta;
      }
      positionAttribute.needsUpdate = true;

      burst.points.material.opacity = Math.max(0, burst.life / burst.duration);

      if (burst.life > 0) continue;

      burst.active = false;
      burst.points.visible = false;
    }
  }

  getActiveCount() {
    let count = 0;
    for (let i = 0; i < this.sparkBursts.length; i += 1) {
      if (this.sparkBursts[i].active) count += 1;
    }
    return count;
  }

  destroy() {
    this.collisionSounds.forEach((audio) => {
      audio.pause();
      audio.src = '';
    });
    this.sparkBursts.forEach((burst) => {
      this.scene.remove(burst.points);
      burst.points.geometry.dispose();
      burst.points.material.dispose();
    });
  }
}

const _sparkBasePosition = new THREE.Vector3();
const _sparkOutward = new THREE.Vector3();
const _sparkJitter = new THREE.Vector3();
const _sparkUp = new THREE.Vector3(0, 1, 0);
