import * as THREE from 'three';

const DISTRICTS = [
  { name: 'Neon Downtown', grid: new THREE.Vector2(-1, -1), palette: [0x12d7ff, 0xff4fd8, 0xb86bff], height: [30, 110], density: 0.92 },
  { name: 'Industrial Sector', grid: new THREE.Vector2(1, -1), palette: [0xffc857, 0x12d7ff, 0xff7a59], height: [16, 70], density: 0.78 },
  { name: 'Corporate Spires', grid: new THREE.Vector2(-1, 1), palette: [0x7c8dff, 0x7bfff8, 0xe86bff], height: [60, 170], density: 0.88 },
  { name: 'Night Market', grid: new THREE.Vector2(1, 1), palette: [0xffef5a, 0xff4fd8, 0x63ff83], height: [18, 82], density: 0.84 },
];

const GLOBAL_NEON_PALETTE = [0x12d7ff, 0xff4fd8, 0xb86bff, 0xffef5a];

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function pickOne(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function createSeededRandom(seed) {
  let value = seed * 9973 + 17;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function createSkyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#050814');
  gradient.addColorStop(0.35, '#140d2c');
  gradient.addColorStop(0.68, '#29134b');
  gradient.addColorStop(1, '#5d1d66');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const horizonGlow = context.createLinearGradient(0, canvas.height * 0.56, 0, canvas.height);
  horizonGlow.addColorStop(0, 'rgba(0, 0, 0, 0)');
  horizonGlow.addColorStop(0.6, 'rgba(43, 124, 255, 0.16)');
  horizonGlow.addColorStop(1, 'rgba(255, 79, 216, 0.28)');
  context.fillStyle = horizonGlow;
  context.fillRect(0, canvas.height * 0.56, canvas.width, canvas.height * 0.44);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createWindowTexture(baseColor, windowColor, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const random = createSeededRandom(seed);

  context.fillStyle = baseColor;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const rows = 24;
  const cols = 10;
  const marginX = 8;
  const marginY = 10;
  const gapX = 4;
  const gapY = 4;
  const windowWidth = (canvas.width - marginX * 2 - gapX * (cols - 1)) / cols;
  const windowHeight = (canvas.height - marginY * 2 - gapY * (rows - 1)) / rows;
  const darkWindow = 'rgba(8, 14, 24, 0.92)';

  for (let row = 0; row < rows; row += 1) {
    const rowBias = random();
    for (let col = 0; col < cols; col += 1) {
      const x = marginX + col * (windowWidth + gapX);
      const y = marginY + row * (windowHeight + gapY);
      const lit = random() > 0.28 - rowBias * 0.14;
      context.fillStyle = lit ? windowColor : darkWindow;
      context.fillRect(x, y, windowWidth, windowHeight);

      if (lit && random() > 0.68) {
        context.fillStyle = 'rgba(255,255,255,0.16)';
        context.fillRect(x, y, windowWidth, windowHeight * 0.22);
      }
    }
  }

  context.fillStyle = 'rgba(255,255,255,0.04)';
  for (let i = 0; i < 6; i += 1) {
    context.fillRect(0, random() * canvas.height, canvas.width, 1.5);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class CityGenerator {
  constructor(scene, config) {
    this.scene = scene;
    this.config = config;
    this.skyTexture = createSkyTexture();
    this.districtResources = new Map();
  }

  build() {
    const colliders = [];
    const districtAnchors = [];
    const flightPaths = [];
    const stationCandidates = [];
    const districtSpacing = this.config.districtSpacing;

    this.addSky();
    this.addGround();
    this.addRain();

    DISTRICTS.forEach((district) => {
      const center = new THREE.Vector2(district.grid.x * districtSpacing, district.grid.y * districtSpacing);
      districtAnchors.push({ name: district.name, position: new THREE.Vector3(center.x, 18, center.y) });
      this.addDistrict(district, center, colliders, flightPaths, stationCandidates);
    });

    const energyStations = this.createEnergyStations(stationCandidates);

    return {
      colliders,
      flightPaths,
      energyStations,
      districtAnchors,
      spawnPoint: new THREE.Vector3(-districtSpacing, 18, -districtSpacing + this.config.districtSize * 0.2),
      getDistrictName: (position) => this.getDistrictName(position),
    };
  }

  addSky() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(this.config.worldSize * 0.58, 32, 20),
      new THREE.MeshBasicMaterial({ map: this.skyTexture, side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    this.scene.add(sky);

    const horizonGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(this.config.worldSize * 0.44, this.config.worldSize * 0.5, 240, 48, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff4fd8,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    horizonGlow.position.y = 110;
    this.scene.add(horizonGlow);
  }

  addGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(this.config.worldSize, this.config.worldSize),
      new THREE.MeshStandardMaterial({ color: 0x0a1020, emissive: 0x08111f, emissiveIntensity: 0.18, roughness: 0.9, metalness: 0.08 }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(this.config.worldSize, 36, 0x4b5cff, 0x15314e);
    grid.position.y = 0.1;
    grid.material.opacity = 0.24;
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

  getDistrictResources(district) {
    if (this.districtResources.has(district.name)) {
      return this.districtResources.get(district.name);
    }

    const accentPalette = [...district.palette, ...GLOBAL_NEON_PALETTE];
    const buildingMaterials = Array.from({ length: 5 }, (_, index) => {
      const tint = new THREE.Color(0x121827);
      tint.offsetHSL((index - 2) * 0.01, 0.04, index * 0.01);
      const texture = createWindowTexture(tint.getStyle(), new THREE.Color(accentPalette[index % accentPalette.length]).getStyle(), index + district.grid.x * 11 + district.grid.y * 19);
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: texture,
        emissiveMap: texture,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.82,
        metalness: 0.12,
        roughness: 0.74,
      });
    });
    const neonMaterials = accentPalette.map((color) => new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    const glowMaterials = accentPalette.map((color) => new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }));
    const darkMetalMaterial = new THREE.MeshStandardMaterial({ color: 0x0d131f, metalness: 0.35, roughness: 0.58 });

    const resources = {
      buildingMaterials,
      neonMaterials,
      glowMaterials,
      darkMetalMaterial,
    };
    this.districtResources.set(district.name, resources);
    return resources;
  }

  decorateTower(group, resources, posX, posZ, width, depth, height) {
    if (height > 24 && Math.random() > 0.32) {
      const stripHeight = height * randRange(0.45, 0.88);
      const verticalStrip = new THREE.Mesh(
        new THREE.BoxGeometry(randRange(0.35, 0.9), stripHeight, 0.32),
        pickOne(resources.glowMaterials),
      );
      const side = Math.floor(Math.random() * 4);
      if (side === 0) verticalStrip.position.set(posX - width * 0.5 - 0.18, stripHeight * 0.5 + randRange(2, 8), posZ + depth * 0.16);
      if (side === 1) verticalStrip.position.set(posX + width * 0.5 + 0.18, stripHeight * 0.5 + randRange(2, 8), posZ - depth * 0.18);
      if (side === 2) {
        verticalStrip.geometry = new THREE.BoxGeometry(0.32, stripHeight, randRange(0.35, 0.9));
        verticalStrip.position.set(posX + width * 0.12, stripHeight * 0.5 + randRange(2, 8), posZ - depth * 0.5 - 0.18);
      }
      if (side === 3) {
        verticalStrip.geometry = new THREE.BoxGeometry(0.32, stripHeight, randRange(0.35, 0.9));
        verticalStrip.position.set(posX - width * 0.15, stripHeight * 0.5 + randRange(2, 8), posZ + depth * 0.5 + 0.18);
      }
      group.add(verticalStrip);
    }

    if (height > 20 && Math.random() > 0.45) {
      const crown = new THREE.Mesh(
        new THREE.BoxGeometry(width * randRange(0.42, 0.82), 0.72, depth * randRange(0.42, 0.82)),
        pickOne(resources.glowMaterials),
      );
      crown.position.set(posX, height + 0.4, posZ);
      group.add(crown);
    }

    if (height > 18 && Math.random() > 0.58) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(width * randRange(0.38, 0.72), randRange(5, 11), 0.68),
        pickOne(resources.neonMaterials),
      );
      panel.position.set(posX, randRange(12, Math.max(18, height - 10)), posZ + depth * 0.5 + 0.7);
      group.add(panel);

      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(panel.geometry.parameters.width + 1.2, panel.geometry.parameters.height + 1.1, 0.18),
        resources.darkMetalMaterial,
      );
      frame.position.copy(panel.position).add(new THREE.Vector3(0, 0, -0.36));
      group.add(frame);
    }
  }

  addDistrict(district, center, colliders, flightPaths, stationCandidates) {
    const group = new THREE.Group();
    const resources = this.getDistrictResources(district);
    const districtSize = this.config.districtSize;
    const halfDistrict = districtSize / 2;
    const roadHalf = districtSize * 0.42;
    const buildingInset = districtSize * 0.05;
    const step = districtSize / 18;
    const perimeter = halfDistrict * 0.88;
    const boulevard = halfDistrict * 0.5;
    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x141b29, emissive: 0x15365d, emissiveIntensity: 0.34, metalness: 0.12, roughness: 0.8 });
    const road = new THREE.Mesh(new THREE.BoxGeometry(districtSize, 1, districtSize), roadMaterial);
    road.position.set(center.x, 0.5, center.y);
    group.add(road);

    const boulevardGlow = new THREE.Mesh(
      new THREE.BoxGeometry(districtSize * 0.86, 0.2, districtSize * 0.86),
      new THREE.MeshBasicMaterial({ color: pickOne(district.palette), transparent: true, opacity: 0.06, toneMapped: false }),
    );
    boulevardGlow.position.set(center.x, 0.22, center.y);
    group.add(boulevardGlow);

    for (let x = -roadHalf; x <= roadHalf; x += step) {
      for (let z = -roadHalf; z <= roadHalf; z += step) {
        if (Math.abs(x) < buildingInset || Math.abs(z) < buildingInset) continue;
        if (Math.random() > district.density) continue;

        const width = randRange(12, 22);
        const depth = randRange(12, 22);
        const height = randRange(...district.height);
        const posX = center.x + x + randRange(-step * 0.16, step * 0.16);
        const posZ = center.y + z + randRange(-step * 0.16, step * 0.16);

        const tower = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), pickOne(resources.buildingMaterials));
        tower.position.set(posX, height / 2, posZ);
        group.add(tower);
        this.decorateTower(group, resources, posX, posZ, width, depth, height);

        colliders.push({
          type: 'building',
          min: new THREE.Vector3(posX - width / 2, 0, posZ - depth / 2),
          max: new THREE.Vector3(posX + width / 2, height, posZ + depth / 2),
        });
        stationCandidates.push({
          district: district.name,
          height,
          position: new THREE.Vector3(posX, height + 2.5, posZ),
        });

        if (Math.random() > 0.45) {
          const sign = new THREE.Mesh(
            new THREE.BoxGeometry(width * 0.75, randRange(3, 6), 0.8),
            pickOne(resources.neonMaterials),
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
        new THREE.MeshBasicMaterial({ color, toneMapped: false }),
      );
      board.position.copy(spot);
      board.lookAt(spot.x + facingCenter.x, spot.y, spot.z + facingCenter.z);
      group.add(board);

      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(boardWidth + 2.4, boardHeight + 2.2, 0.5),
        resources.darkMetalMaterial,
      );
      frame.position.copy(spot).add(new THREE.Vector3(0, 0, -0.55).applyQuaternion(board.quaternion));
      frame.quaternion.copy(board.quaternion);
      group.add(frame);

      [-boardWidth * 0.32, boardWidth * 0.32].forEach((offsetX) => {
        const support = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, spot.y - 4, 1.1),
          resources.darkMetalMaterial,
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

    this.scene.add(group);
  }

  createEnergyStations(candidates) {
    const byDistrict = DISTRICTS.map((district) => {
      const districtCandidates = candidates
        .filter((candidate) => candidate.district === district.name)
        .sort((a, b) => b.height - a.height);
      return districtCandidates[0];
    }).filter(Boolean);

    const chosen = [...byDistrict];
    const remaining = candidates
      .filter((candidate) => !chosen.includes(candidate))
      .sort((a, b) => b.height - a.height);

    remaining.forEach((candidate) => {
      if (chosen.length >= 6) return;
      const separated = chosen.every((station) => station.position.distanceTo(candidate.position) > this.config.districtSize * 0.3);
      if (separated) chosen.push(candidate);
    });

    return chosen.slice(0, 6).map((station, index) => ({
      name: `Energy Station ${index + 1}`,
      position: station.position,
    }));
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
