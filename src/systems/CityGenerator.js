import * as THREE from 'three';

const DISTRICTS = [
  { name: 'Neon Downtown', grid: new THREE.Vector2(-1, -1), palette: [0x12d7ff, 0xff4fd8], height: [30, 110], density: 0.92 },
  { name: 'Industrial Sector', grid: new THREE.Vector2(1, -1), palette: [0xffa630, 0x63ff83], height: [16, 70], density: 0.78 },
  { name: 'Corporate Spires', grid: new THREE.Vector2(-1, 1), palette: [0x7c8dff, 0x7bfff8], height: [60, 170], density: 0.88 },
  { name: 'Night Market', grid: new THREE.Vector2(1, 1), palette: [0xff6f61, 0xffef5a], height: [18, 82], density: 0.84 },
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
    const districtSpacing = this.config.districtSpacing;

    this.addGround();
    this.addRain();

    DISTRICTS.forEach((district) => {
      const center = new THREE.Vector2(district.grid.x * districtSpacing, district.grid.y * districtSpacing);
      districtAnchors.push({ name: district.name, position: new THREE.Vector3(center.x, 18, center.y) });
      this.addDistrict(district, center, colliders, flightPaths);
    });

    return {
      colliders,
      flightPaths,
      districtAnchors,
      spawnPoint: new THREE.Vector3(-districtSpacing, 18, -districtSpacing + this.config.districtSize * 0.2),
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
    const span = this.config.worldSize * 0.47;

    for (let i = 0; i < rainCount; i += 1) {
      positions[i * 3] = randRange(-span, span);
      positions[i * 3 + 1] = randRange(10, 220);
      positions[i * 3 + 2] = randRange(-span, span);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const rain = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: 0x9fd8ff, size: 0.9, transparent: true, opacity: 0.5 }),
    );
    this.scene.add(rain);
  }

  addDistrict(district, center, colliders, flightPaths) {
    const group = new THREE.Group();
    const districtSize = this.config.districtSize;
    const halfDistrict = districtSize / 2;
    const roadHalf = districtSize * 0.42;
    const buildingInset = districtSize * 0.05;
    const step = districtSize / 18;
    const perimeter = halfDistrict * 0.88;
    const boulevard = halfDistrict * 0.5;
    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x111824, emissive: 0x14243c, emissiveIntensity: 0.22 });
    const road = new THREE.Mesh(new THREE.BoxGeometry(districtSize, 1, districtSize), roadMaterial);
    road.position.set(center.x, 0.5, center.y);
    group.add(road);

    const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0x111521, metalness: 0.15, roughness: 0.78 });
    const neonMaterials = district.palette.map(
      (color) => new THREE.MeshStandardMaterial({ color: 0x1a1f30, emissive: color, emissiveIntensity: 0.95, metalness: 0.2, roughness: 0.35 }),
    );

    for (let x = -roadHalf; x <= roadHalf; x += step) {
      for (let z = -roadHalf; z <= roadHalf; z += step) {
        if (Math.abs(x) < buildingInset || Math.abs(z) < buildingInset) continue;
        if (Math.random() > district.density) continue;

        const width = randRange(12, 22);
        const depth = randRange(12, 22);
        const height = randRange(...district.height);
        const posX = center.x + x + randRange(-step * 0.16, step * 0.16);
        const posZ = center.y + z + randRange(-step * 0.16, step * 0.16);

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

    const billboardPalette = [...district.palette, 0xffffff, 0x7c8dff, 0xff7a59, 0x63ff83];
    const billboardSpots = [
      new THREE.Vector3(center.x - boulevard * 1.1, 22, center.y - perimeter * 0.68),
      new THREE.Vector3(center.x + boulevard * 1.08, 24, center.y + perimeter * 0.62),
      new THREE.Vector3(center.x - perimeter * 0.72, 20, center.y + boulevard * 1.05),
    ];

    billboardSpots.forEach((spot, index) => {
      const boardWidth = randRange(20, 34);
      const boardHeight = randRange(8, 14);
      const color = billboardPalette[(index + Math.floor(Math.random() * billboardPalette.length)) % billboardPalette.length];
      const facingCenter = new THREE.Vector3(center.x - spot.x, 0, center.y - spot.z).normalize();
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(boardWidth, boardHeight, 1.4),
        new THREE.MeshStandardMaterial({
          color: 0x151a28,
          emissive: color,
          emissiveIntensity: 1.25,
          metalness: 0.2,
          roughness: 0.28,
        }),
      );
      board.position.copy(spot);
      board.lookAt(spot.x + facingCenter.x, spot.y, spot.z + facingCenter.z);
      group.add(board);

      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(boardWidth + 2.4, boardHeight + 2.2, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x0c111b, emissive: color, emissiveIntensity: 0.45, metalness: 0.35, roughness: 0.4 }),
      );
      frame.position.copy(spot).add(new THREE.Vector3(0, 0, -0.55).applyQuaternion(board.quaternion));
      frame.quaternion.copy(board.quaternion);
      group.add(frame);

      [-boardWidth * 0.32, boardWidth * 0.32].forEach((offsetX) => {
        const support = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, spot.y - 4, 1.1),
          new THREE.MeshStandardMaterial({ color: 0x0d131d, metalness: 0.4, roughness: 0.55 }),
        );
        support.position.copy(spot);
        support.position.y = (spot.y - 4) * 0.5;
        support.position.add(new THREE.Vector3(offsetX, -boardHeight * 0.08, -0.4).applyQuaternion(board.quaternion));
        support.quaternion.copy(board.quaternion);
        group.add(support);
      });
    });

    const roadLoop = [
      new THREE.Vector3(center.x - boulevard, 10, center.y - boulevard),
      new THREE.Vector3(center.x + boulevard, 10, center.y - boulevard),
      new THREE.Vector3(center.x + boulevard, 10, center.y + boulevard),
      new THREE.Vector3(center.x - boulevard, 10, center.y + boulevard),
    ];
    const airLoop = [
      new THREE.Vector3(center.x - perimeter, 20, center.y - perimeter),
      new THREE.Vector3(center.x + perimeter, 20, center.y - perimeter),
      new THREE.Vector3(center.x + perimeter, 26, center.y + perimeter),
      new THREE.Vector3(center.x - perimeter, 24, center.y + perimeter),
    ];
    const skyLane = [
      new THREE.Vector3(center.x - perimeter, 28, center.y),
      new THREE.Vector3(center.x - boulevard, 24, center.y),
      new THREE.Vector3(center.x + boulevard, 24, center.y),
      new THREE.Vector3(center.x + perimeter, 28, center.y),
      new THREE.Vector3(center.x + boulevard, 24, center.y),
      new THREE.Vector3(center.x - boulevard, 24, center.y),
    ];
    flightPaths.push(
      { district: district.name, kind: 'road', waypoints: roadLoop },
      { district: district.name, kind: 'air', waypoints: airLoop },
      { district: district.name, kind: 'air', waypoints: skyLane },
    );

    const accent = new THREE.PointLight(district.palette[0], 28, 250, 2);
    accent.position.set(center.x, 24, center.y);
    group.add(accent);

    this.scene.add(group);
  }

  getDistrictName(position) {
    const districtSpacing = this.config.districtSpacing;
    let closest = DISTRICTS[0];
    let bestDistance = Infinity;
    DISTRICTS.forEach((district) => {
      const centerX = district.grid.x * districtSpacing;
      const centerZ = district.grid.y * districtSpacing;
      const dx = position.x - centerX;
      const dz = position.z - centerZ;
      const distance = dx * dx + dz * dz;
      if (distance < bestDistance) {
        bestDistance = distance;
        closest = district;
      }
    });
    return closest.name;
  }
}
