import * as THREE from 'three';

const SPARK_COLORS = [0xfff4a3, 0xffd15c, 0xffa13b, 0xff7a2f];

function randomSparkColor() {
  return new THREE.Color(SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)]);
}

export class EffectsHooks {
  constructor(scene) {
    this.scene = scene;
    this.sparkBursts = [];
    this.collisionAudioIndex = 0;
    this.collisionSounds = Array.from({ length: 4 }, () => {
      const audio = new Audio('/audio/crash.mp3');
      audio.preload = 'auto';
      audio.volume = 0.42;
      return audio;
    });
  }

  onPickup() {
    // Reserved for future stingers, screen flashes, or controller rumble.
  }

  onDropoff() {
    // Reserved for combo scoring, audio cues, or celebratory VFX.
  }

  onCollision(position, normal = new THREE.Vector3(0, 1, 0)) {
    this.playCollisionSound();

    const sparkCount = 16;
    const positions = new Float32Array(sparkCount * 3);
    const colors = new Float32Array(sparkCount * 3);
    const velocities = [];
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.PointsMaterial({
      size: 1.6,
      transparent: true,
      opacity: 0.95,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      sizeAttenuation: true,
    });

    const basePosition = position.clone().add(normal.clone().multiplyScalar(1.8));
    const up = new THREE.Vector3(0, 1, 0);
    const outward = normal.clone().setY(Math.max(normal.y, 0)).normalize();

    for (let i = 0; i < sparkCount; i += 1) {
      const index = i * 3;
      positions[index] = basePosition.x;
      positions[index + 1] = basePosition.y;
      positions[index + 2] = basePosition.z;

      const color = randomSparkColor();
      colors[index] = color.r;
      colors[index + 1] = color.g;
      colors[index + 2] = color.b;

      const velocity = outward.clone().multiplyScalar(10 + Math.random() * 12);
      velocity.add(new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        5 + Math.random() * 8,
        (Math.random() - 0.5) * 8,
      ));
      if (velocity.lengthSq() === 0) {
        velocity.copy(up).multiplyScalar(10);
      }
      velocities.push(velocity);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const points = new THREE.Points(geometry, material);
    this.scene.add(points);
    this.sparkBursts.push({ points, velocities, life: 0.45, duration: 0.45 });
  }

  playCollisionSound() {
    const audio = this.collisionSounds[this.collisionAudioIndex];
    this.collisionAudioIndex = (this.collisionAudioIndex + 1) % this.collisionSounds.length;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  update(delta) {
    for (let i = this.sparkBursts.length - 1; i >= 0; i -= 1) {
      const burst = this.sparkBursts[i];
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

      this.scene.remove(burst.points);
      burst.points.geometry.dispose();
      burst.points.material.dispose();
      this.sparkBursts.splice(i, 1);
    }
  }
}
