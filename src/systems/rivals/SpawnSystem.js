import * as THREE from 'three';

export class SpawnSystem {
  constructor(config, worldConfig, staticColliders) {
    this.config = config;
    this.worldConfig = worldConfig;
    this.staticColliders = staticColliders;
  }

  findSpawnPoint(player, heatState, attemptCount = 10) {
    const playerPosition = player.mesh.position;
    const forward = _forward.set(0, 0, -1).applyQuaternion(player.mesh.quaternion).setY(0).normalize();
    if (forward.lengthSq() === 0) forward.set(0, 0, -1);
    const right = _right.crossVectors(forward, _up).normalize();
    const speedRatio = Math.min(player.velocity.length() / 120, 1);

    for (let attempt = 0; attempt < attemptCount; attempt += 1) {
      const lateralDirection = attempt % 2 === 0 ? 1 : -1;
      const behindDistance = THREE.MathUtils.lerp(this.config.minSpawnDistance, this.config.maxSpawnDistance, 0.35 + Math.random() * 0.65);
      const lateralDistance = (this.config.sideSpawnDistance + Math.random() * this.config.sideSpawnVariance) * lateralDirection;
      const altitude = this.pickAltitudeBand(heatState, attempt, speedRatio);
      const spawnPoint = _candidate
        .copy(playerPosition)
        .addScaledVector(forward, -behindDistance)
        .addScaledVector(right, lateralDistance)
        .setY(altitude);

      if (this.isSpawnValid(playerPosition, forward, spawnPoint)) {
        return spawnPoint.clone();
      }
    }

    return playerPosition.clone().addScaledVector(forward, -this.config.minSpawnDistance).setY(this.worldConfig.hoverFloor + 18);
  }

  pickAltitudeBand(heatState, attempt, speedRatio) {
    const bands = heatState.heat >= 7
      ? this.config.highHeatBands
      : heatState.heat >= 4
        ? this.config.midHeatBands
        : this.config.lowHeatBands;
    const band = bands[(attempt + Math.floor(Math.random() * bands.length)) % bands.length];
    return THREE.MathUtils.clamp(
      this.worldConfig.hoverFloor + band + speedRatio * 10,
      this.worldConfig.hoverFloor + 6,
      this.worldConfig.hoverCeiling - 12,
    );
  }

  isSpawnValid(playerPosition, forward, spawnPoint) {
    _toSpawn.copy(spawnPoint).sub(playerPosition).setY(0);
    if (_toSpawn.lengthSq() < this.config.minSpawnDistance * this.config.minSpawnDistance) return false;
    const dot = _toSpawn.normalize().dot(forward);
    if (dot > -0.15) return false;
    if (Math.abs(spawnPoint.x) > this.worldConfig.worldSize * 0.48 || Math.abs(spawnPoint.z) > this.worldConfig.worldSize * 0.48) return false;

    for (let i = 0; i < this.staticColliders.length; i += 1) {
      const collider = this.staticColliders[i];
      if (
        spawnPoint.x > collider.min.x - 12 && spawnPoint.x < collider.max.x + 12
        && spawnPoint.y > collider.min.y - 6 && spawnPoint.y < collider.max.y + 10
        && spawnPoint.z > collider.min.z - 12 && spawnPoint.z < collider.max.z + 12
      ) {
        return false;
      }
    }

    return true;
  }
}

const _up = new THREE.Vector3(0, 1, 0);
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _candidate = new THREE.Vector3();
const _toSpawn = new THREE.Vector3();
