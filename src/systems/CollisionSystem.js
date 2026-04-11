import * as THREE from 'three';

export class CollisionSystem {
  constructor(staticColliders, config) {
    this.staticColliders = staticColliders;
    this.penalty = config.mission.collisionPenalty;
    this.playerRadius = config.player.collisionRadius;
    this.boostPenaltyMultiplier = config.player.boostCollisionPenaltyMultiplier;
    this.cooldowns = new Map();
  }

  resolvePlayerCollisions(player, trafficVehicles, delta) {
    const events = [];
    const now = performance.now();
    const playerPosition = player.mesh.position;

    this.staticColliders.forEach((collider, index) => {
      if (!this.intersectsBoxSphere(collider, playerPosition, this.playerRadius)) return;
      const cooldownKey = `static-${index}`;
      if (this.isCoolingDown(cooldownKey, now)) return;

      const normal = this.boxCollisionNormal(collider, playerPosition);
      player.bounce(normal, 0.22);
      this.cooldowns.set(cooldownKey, now + 800);
      const boosted = player.isBoosting;
      events.push({
        penalty: this.penalty * (boosted ? this.boostPenaltyMultiplier : 1),
        source: this.getStaticCollisionSource(collider, boosted),
        position: playerPosition,
        normal,
      });
    });

    trafficVehicles.forEach((vehicle, index) => {
      const distance = playerPosition.distanceTo(vehicle.mesh.position);
      if (distance > this.playerRadius + vehicle.radius) return;
      const cooldownKey = `traffic-${vehicle.mesh.id ?? index}`;
      if (this.isCoolingDown(cooldownKey, now)) return;

      _collisionNormal.copy(playerPosition).sub(vehicle.mesh.position).setY(0);
      if (_collisionNormal.lengthSq() > 0) {
        _collisionNormal.normalize();
      } else {
        _collisionNormal.set(1, 0, 0);
      }
      const bounceStrength = vehicle.collisionStrength ?? 0.3;
      player.bounce(_collisionNormal, bounceStrength);
      this.cooldowns.set(cooldownKey, now + 900);
      const boosted = player.isBoosting;
      const basePenalty = vehicle.collisionPenalty ?? (this.penalty + 6);
      const source = vehicle.collisionSource ?? (boosted ? 'boost traffic collision' : 'traffic collision');
      events.push({
        penalty: basePenalty * (boosted ? this.boostPenaltyMultiplier : 1),
        source,
        enemy: vehicle.enemy === true,
        position: playerPosition,
        normal: _collisionNormal.clone(),
      });
    });

    return events;
  }

  isCoolingDown(key, now) {
    return this.cooldowns.has(key) && this.cooldowns.get(key) > now;
  }

  getStaticCollisionSource(collider, boosted) {
    if (collider.type === 'blimp') {
      return boosted ? 'boosted into a blimp' : 'hit a blimp';
    }

    return boosted ? 'boost impact' : 'impact';
  }

  intersectsBoxSphere(box, center, radius) {
    const x = THREE.MathUtils.clamp(center.x, box.min.x, box.max.x);
    const y = THREE.MathUtils.clamp(center.y, box.min.y, box.max.y);
    const z = THREE.MathUtils.clamp(center.z, box.min.z, box.max.z);
    _closestPoint.set(x, y, z);
    return _closestPoint.distanceToSquared(center) < radius * radius;
  }

  boxCollisionNormal(box, center) {
    const left = Math.abs(center.x - box.min.x);
    const right = Math.abs(box.max.x - center.x);
    const back = Math.abs(center.z - box.min.z);
    const front = Math.abs(box.max.z - center.z);

    let minDistance = left;
    _boxNormal.set(-1, 0, 0);
    if (right < minDistance) {
      minDistance = right;
      _boxNormal.set(1, 0, 0);
    }
    if (back < minDistance) {
      minDistance = back;
      _boxNormal.set(0, 0, -1);
    }
    if (front < minDistance) {
      _boxNormal.set(0, 0, 1);
    }

    return _boxNormal.clone();
  }
}

const _closestPoint = new THREE.Vector3();
const _collisionNormal = new THREE.Vector3();
const _boxNormal = new THREE.Vector3();
