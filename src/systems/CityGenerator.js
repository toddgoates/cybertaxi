import * as THREE from 'three';

const DISTRICTS = [
  { name: 'Neon Downtown', center: new THREE.Vector2(-180, -180), palette: [0x12d7ff, 0xff4fd8], height: [30, 110], density: 0.92 },
  { name: 'Industrial Sector', center: new THREE.Vector2(180, -180), palette: [0xffa630, 0x63ff83], height: [16, 70], density: 0.78 },
  { name: 'Corporate Spires', center: new THREE.Vector2(-180, 180), palette: [0x7c8dff, 0x7bfff8], height: [60, 170], density: 0.88 },
  { name: 'Night Market', center: new THREE.Vector2(180, 180), palette: [0xff6f61, 0xffef5a], height: [18, 82], density: 0.84 },
];

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

export class CityGenerator {
  constructor(scene, config) {
    this.scene = scene;
    this.config = config;
  }

  build() {
    const colliders = [];
    const districtAnchors = [];
    const flightPaths = [];

    this.addGround();
    this.addRain();

    DISTRICTS.forEach((district) => {
      districtAnchors.push({ name: district.name, position: new THREE.Vector3(district.center.x, 18, district.center.y) });
      this.addDistrict(district, colliders, flightPaths);
    });

    return {
      colliders,
      flightPaths,
      districtAnchors,
      spawnPoint: new THREE.Vector3(-180, 18, -110),
      getDistrictName: (position) => this.getDistrictName(position),
    };
  }

  addGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(this.config.worldSize, this.config.worldSize),
      new THREE.MeshStandardMaterial({ color: 0x070b15, roughness: 0.92, metalness: 0.08 }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(this.config.worldSize, 36, 0x154060, 0x102034);
    grid.position.y = 0.1;
    grid.material.opacity = 0.16;
    grid.material.transparent = true;
    this.scene.add(grid);
  }

  addRain() {
    const rainCount = 3200;
    const positions = new Float32Array(rainCount * 3);

    for (let i = 0; i < rainCount; i += 1) {
      positions[i * 3] = randRange(-420, 420);
      positions[i * 3 + 1] = randRange(10, 220);
      positions[i * 3 + 2] = randRange(-420, 420);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const rain = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: 0x9fd8ff, size: 0.9, transparent: true, opacity: 0.5 }),
    );
    this.scene.add(rain);
  }

  addDistrict(district, colliders, flightPaths) {
    const group = new THREE.Group();
    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x111824, emissive: 0x14243c, emissiveIntensity: 0.22 });
    const road = new THREE.Mesh(new THREE.BoxGeometry(300, 1, 300), roadMaterial);
    road.position.set(district.center.x, 0.5, district.center.y);
    group.add(road);

    const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0x111521, metalness: 0.15, roughness: 0.78 });
    const neonMaterials = district.palette.map(
      (color) => new THREE.MeshStandardMaterial({ color: 0x1a1f30, emissive: color, emissiveIntensity: 0.95, metalness: 0.2, roughness: 0.35 }),
    );

    for (let x = -120; x <= 120; x += 24) {
      for (let z = -120; z <= 120; z += 24) {
        if (Math.abs(x) < 24 || Math.abs(z) < 24) continue;
        if (Math.random() > district.density) continue;

        const width = randRange(12, 20);
        const depth = randRange(12, 20);
        const height = randRange(...district.height);
        const posX = district.center.x + x + randRange(-4, 4);
        const posZ = district.center.y + z + randRange(-4, 4);

        const tower = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), buildingMaterial.clone());
        tower.position.set(posX, height / 2, posZ);
        tower.material.color.offsetHSL(Math.random() * 0.01, 0, Math.random() * 0.05);
        group.add(tower);

        colliders.push({
          type: 'building',
          min: new THREE.Vector3(posX - width / 2, 0, posZ - depth / 2),
          max: new THREE.Vector3(posX + width / 2, height, posZ + depth / 2),
        });

        if (Math.random() > 0.45) {
          const sign = new THREE.Mesh(
            new THREE.BoxGeometry(width * 0.75, randRange(3, 6), 0.8),
            neonMaterials[Math.floor(Math.random() * neonMaterials.length)],
          );
          sign.position.set(posX, randRange(10, height - 6), posZ + depth / 2 + 1.2);
          group.add(sign);
        }
      }
    }

    const laneLoop = [
      new THREE.Vector3(district.center.x - 132, 20, district.center.y - 132),
      new THREE.Vector3(district.center.x + 132, 20, district.center.y - 132),
      new THREE.Vector3(district.center.x + 132, 26, district.center.y + 132),
      new THREE.Vector3(district.center.x - 132, 24, district.center.y + 132),
    ];
    flightPaths.push({ district: district.name, waypoints: laneLoop });

    const accent = new THREE.PointLight(district.palette[0], 28, 250, 2);
    accent.position.set(district.center.x, 24, district.center.y);
    group.add(accent);

    this.scene.add(group);
  }

  getDistrictName(position) {
    let closest = DISTRICTS[0];
    let bestDistance = Infinity;
    DISTRICTS.forEach((district) => {
      const dx = position.x - district.center.x;
      const dz = position.z - district.center.y;
      const distance = dx * dx + dz * dz;
      if (distance < bestDistance) {
        bestDistance = distance;
        closest = district;
      }
    });
    return closest.name;
  }
}
