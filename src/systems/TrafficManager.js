import * as THREE from 'three';

const TRAFFIC_COLORS = [0xff5a6b, 0x44a6ff, 0x63ff83, 0xb86bff, 0xf3f7ff];

function getHeightOffset(pathData, seed) {
  if (pathData.kind === 'road') {
    return [0, 4, 8][seed % 3];
  }

  return [8, 24, 44, 72, 104][seed % 5];
}

function offsetWaypoints(waypoints, heightOffset) {
  return waypoints.map((waypoint) => waypoint.clone().setY(waypoint.y + heightOffset));
}

function createVehicleMesh(color, emissiveIntensity = 0.7, scale = 1) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x171d2b,
    emissive: color,
    emissiveIntensity,
    metalness: 0.22,
    roughness: 0.34,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x0d121b,
    emissive: 0x05080d,
    emissiveIntensity: 0.18,
    metalness: 0.28,
    roughness: 0.6,
  });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0x9ad8ff,
    emissive: 0x67caff,
    emissiveIntensity: 0.65,
    metalness: 0.08,
    roughness: 0.16,
    transparent: true,
    opacity: 0.9,
  });
  const frontLightMaterial = new THREE.MeshStandardMaterial({
    color: 0xb9f1ff,
    emissive: 0x8ae8ff,
    emissiveIntensity: 1.1,
  });
  const rearLightMaterial = new THREE.MeshStandardMaterial({
    color: 0xff8ca0,
    emissive: 0xff5a6b,
    emissiveIntensity: 0.9,
  });

  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(2.35 * scale, 0.7 * scale, 5.4 * scale),
    bodyMaterial,
  );
  chassis.position.y = 0.12 * scale;
  group.add(chassis);

  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(1.95 * scale, 0.44 * scale, 1.5 * scale),
    bodyMaterial,
  );
  hood.position.set(0, 0.5 * scale, -1.58 * scale);
  group.add(hood);

  const rearDeck = new THREE.Mesh(
    new THREE.BoxGeometry(2 * scale, 0.38 * scale, 1.2 * scale),
    bodyMaterial,
  );
  rearDeck.position.set(0, 0.47 * scale, 1.82 * scale);
  group.add(rearDeck);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.62 * scale, 0.7 * scale, 2.3 * scale),
    bodyMaterial,
  );
  cabin.position.set(0, 0.83 * scale, 0.08 * scale);
  group.add(cabin);

  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(1.28 * scale, 0.4 * scale, 0.72 * scale),
    glassMaterial,
  );
  windshield.position.set(0, 1.04 * scale, -0.62 * scale);
  group.add(windshield);

  const rearGlass = new THREE.Mesh(
    new THREE.BoxGeometry(1.2 * scale, 0.34 * scale, 0.58 * scale),
    glassMaterial,
  );
  rearGlass.position.set(0, 1 * scale, 0.72 * scale);
  group.add(rearGlass);

  const sideSkirtGeometry = new THREE.BoxGeometry(0.14 * scale, 0.22 * scale, 4.3 * scale);
  [-1.16, 1.16].forEach((x) => {
    const sideSkirt = new THREE.Mesh(sideSkirtGeometry, trimMaterial);
    sideSkirt.position.set(x * scale, -0.02 * scale, 0.16 * scale);
    group.add(sideSkirt);
  });

  const lightBarGeometry = new THREE.BoxGeometry(1.45 * scale, 0.14 * scale, 0.18 * scale);
  const frontLight = new THREE.Mesh(lightBarGeometry, frontLightMaterial);
  frontLight.position.set(0, 0.34 * scale, -2.66 * scale);
  group.add(frontLight);

  const rearLight = new THREE.Mesh(lightBarGeometry, rearLightMaterial);
  rearLight.position.set(0, 0.32 * scale, 2.66 * scale);
  group.add(rearLight);

  const roofLight = new THREE.Mesh(
    new THREE.BoxGeometry(0.7 * scale, 0.12 * scale, 0.4 * scale),
    frontLightMaterial,
  );
  roofLight.position.set(0, 1.26 * scale, 0.06 * scale);
  group.add(roofLight);

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
    const path = offsetWaypoints(pathData.waypoints, getHeightOffset(pathData, seed));
    const startIndex = seed % path.length;
    const nextIndex = (startIndex + 1) % path.length;
    mesh.position.lerpVectors(
      path[startIndex],
      path[nextIndex],
      ((seed * 0.37) % 1),
    );
    this.scene.add(mesh);

    const baseSpeed = pathData.kind === 'road' ? 18 : 26;

    return {
      mesh,
      collidable,
      path,
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
      vehicle.mesh.position.y += Math.sin(performance.now() * 0.002 + vehicle.bobOffset) * 0.05;
    });
  }

  getVehicles() {
    return this.vehicles;
  }

  getCollidableVehicles() {
    return this.vehicles.filter((vehicle) => vehicle.collidable);
  }
}
