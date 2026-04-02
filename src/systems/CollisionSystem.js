import * as THREE from 'three';

export class CollisionSystem {
  constructor(staticColliders, config) {
    this.staticColliders = staticColliders;
    this.penalty = config.mission.collisionPenalty;
    this.playerRadius = config.player.collisionRadius;
    this.cooldowns = new Map();
  }

  resolvePlayerCollisions(player, trafficVehicles, delta) {
    const events = [];
    const now = performance.now();

    this.staticColliders.forEach((collider, index) => {
      if (!this.intersectsBoxSphere(collider, player.mesh.position, this.playerRadius)) return;
      const cooldownKey = `static-${index}`;
      if (this.isCoolingDown(cooldownKey, now)) return;

      const normal = this.boxCollisionNormal(collider, player.mesh.position);
      player.bounce(normal, 0.22);
      this.cooldowns.set(cooldownKey, now + 800);
      events.push({ penalty: this.penalty, source: 'impact' });
    });

    trafficVehicles.forEach((vehicle, index) => {
      const distance = player.mesh.position.distanceTo(vehicle.mesh.position);
      if (distance > this.playerRadius + vehicle.radius) return;
      const cooldownKey = `traffic-${index}`;
      if (this.isCoolingDown(cooldownKey, now)) return;

      const normal = player.mesh.position.clone().sub(vehicle.mesh.position).setY(0).normalize();
      player.bounce(normal.lengthSq() === 0 ? new THREE.Vector3(1, 0, 0) : normal, 0.3);
      this.cooldowns.set(cooldownKey, now + 900);
      events.push({ penalty: this.penalty + 6, source: 'traffic collision' });
    });

    return events;
  }

  isCoolingDown(key, now) {
    return this.cooldowns.has(key) && this.cooldowns.get(key) > now;
  }

  intersectsBoxSphere(box, center, radius) {
    const x = THREE.MathUtils.clamp(center.x, box.min.x, box.max.x);
    const y = THREE.MathUtils.clamp(center.y, box.min.y, box.max.y);
    const z = THREE.MathUtils.clamp(center.z, box.min.z, box.max.z);
    const closest = new THREE.Vector3(x, y, z);
    return closest.distanceToSquared(center) < radius * radius;
  }

  boxCollisionNormal(box, center) {
    const distances = [
      { normal: new THREE.Vector3(-1, 0, 0), value: Math.abs(center.x - box.min.x) },
      { normal: new THREE.Vector3(1, 0, 0), value: Math.abs(box.max.x - center.x) },
      { normal: new THREE.Vector3(0, 0, -1), value: Math.abs(center.z - box.min.z) },
      { normal: new THREE.Vector3(0, 0, 1), value: Math.abs(box.max.z - center.z) },
    ];
    distances.sort((a, b) => a.value - b.value);
    return distances[0].normal;
  }
}
