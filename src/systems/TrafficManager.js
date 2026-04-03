import * as THREE from 'three';

const TRAFFIC_COLORS = [0xff5a6b, 0x44a6ff, 0x63ff83, 0xb86bff, 0xf3f7ff];

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

    const collidablePaths = flightPaths.slice();
    const ambientPaths = flightPaths.slice().reverse();

    for (let i = 0; i < this.config.obstacleCount; i += 1) {
      this.vehicles.push(this.spawnVehicle(collidablePaths[i % collidablePaths.length], true, i));
    }

    for (let i = 0; i < this.config.ambientCount; i += 1) {
      this.vehicles.push(this.spawnVehicle(ambientPaths[i % ambientPaths.length], false, i));
    }
  }

  spawnVehicle(pathData, collidable, seed) {
    const color = TRAFFIC_COLORS[seed % TRAFFIC_COLORS.length];
    const mesh = createVehicleMesh(color, collidable ? 0.95 : 0.35, collidable ? 1 : 0.75);
    const startIndex = seed % pathData.waypoints.length;
    const nextIndex = (startIndex + 1) % pathData.waypoints.length;
    mesh.position.lerpVectors(
      pathData.waypoints[startIndex],
      pathData.waypoints[nextIndex],
      ((seed * 0.37) % 1),
    );
    this.scene.add(mesh);

    const baseSpeed = pathData.kind === 'road' ? 18 : 26;

    return {
      mesh,
      collidable,
      path: pathData.waypoints,
      currentIndex: startIndex,
      speed: collidable ? baseSpeed + (seed % 4) * 3 : baseSpeed - 4 + (seed % 3) * 3,
      radius: collidable ? 3.8 : 3,
      pathName: pathData.district,
      bobOffset: Math.random() * Math.PI * 2,
    };
  }

  update(delta) {
    this.vehicles.forEach((vehicle) => {
      const targetIndex = (vehicle.currentIndex + 1) % vehicle.path.length;
      const target = vehicle.path[targetIndex];
      const direction = target.clone().sub(vehicle.mesh.position);
      const distance = direction.length();

      if (distance < 5) {
        vehicle.currentIndex = targetIndex;
        return;
      }

      direction.normalize();
      vehicle.mesh.position.addScaledVector(direction, vehicle.speed * delta);
      vehicle.mesh.quaternion.slerp(
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction.clone().setY(0).normalize()),
        0.08,
      );
      vehicle.mesh.position.y += Math.sin(performance.now() * 0.002 + vehicle.bobOffset) * 0.01;
    });
  }

  getVehicles() {
    return this.vehicles;
  }

  getCollidableVehicles() {
    return this.vehicles.filter((vehicle) => vehicle.collidable);
  }
}
