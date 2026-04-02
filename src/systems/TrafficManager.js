import * as THREE from 'three';

function createVehicleMesh(color, emissiveIntensity = 0.7, scale = 1) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.2 * scale, 0.8 * scale, 5.2 * scale),
    new THREE.MeshStandardMaterial({ color: 0x171d2b, emissive: color, emissiveIntensity, metalness: 0.2, roughness: 0.35 }),
  );
  group.add(body);

  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(1.6 * scale, 0.35 * scale, 2.8 * scale),
    new THREE.MeshStandardMaterial({ color: 0x92d4ff, emissive: 0x92d4ff, emissiveIntensity: 0.8 }),
  );
  strip.position.y = 0.45 * scale;
  group.add(strip);
  return group;
}

export class TrafficManager {
  constructor(scene, config, flightPaths) {
    this.scene = scene;
    this.config = config.traffic;
    this.vehicles = [];

    const collidablePaths = flightPaths.slice(0, this.config.obstacleCount);
    const ambientPaths = flightPaths.slice().reverse();

    for (let i = 0; i < this.config.obstacleCount; i += 1) {
      this.vehicles.push(this.spawnVehicle(collidablePaths[i % collidablePaths.length], true, i));
    }

    for (let i = 0; i < this.config.ambientCount; i += 1) {
      this.vehicles.push(this.spawnVehicle(ambientPaths[i % ambientPaths.length], false, i));
    }
  }

  spawnVehicle(pathData, collidable, seed) {
    const mesh = createVehicleMesh(collidable ? 0xff8a3d : 0x44f1ff, collidable ? 0.95 : 0.35, collidable ? 1 : 0.75);
    mesh.position.copy(pathData.waypoints[seed % pathData.waypoints.length]);
    this.scene.add(mesh);

    return {
      mesh,
      collidable,
      path: pathData.waypoints,
      currentIndex: seed % pathData.waypoints.length,
      speed: collidable ? 26 + (seed % 4) * 6 : 18 + (seed % 3) * 5,
      radius: collidable ? 3.8 : 3,
      pathName: pathData.district,
    };
  }

  update(delta) {
    this.vehicles.forEach((vehicle) => {
      const targetIndex = (vehicle.currentIndex + 1) % vehicle.path.length;
      const target = vehicle.path[targetIndex];
      const direction = target.clone().sub(vehicle.mesh.position);
      const distance = direction.length();

      if (distance < 4) {
        vehicle.currentIndex = targetIndex;
        return;
      }

      direction.normalize();
      vehicle.mesh.position.addScaledVector(direction, vehicle.speed * delta);
      vehicle.mesh.quaternion.slerp(
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction.clone().setY(0).normalize()),
        0.08,
      );
      vehicle.mesh.position.y += Math.sin(performance.now() * 0.002 + vehicle.speed) * 0.01;
    });
  }

  getVehicles() {
    return this.vehicles;
  }

  getCollidableVehicles() {
    return this.vehicles.filter((vehicle) => vehicle.collidable);
  }
}
