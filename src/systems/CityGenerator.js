import * as THREE from 'three';

const DISTRICTS = [
  { name: 'Neon Downtown', grid: new THREE.Vector2(-1, -1), palette: [0x12d7ff, 0xff4fd8, 0xb86bff], baseColor: 0x12192b, height: [30, 110], density: 0.92 },
  { name: 'Industrial Sector', grid: new THREE.Vector2(1, -1), palette: [0xffc857, 0xff7a59, 0xff5e47], baseColor: 0x1b1718, height: [16, 70], density: 0.78 },
  { name: 'Corporate Spires', grid: new THREE.Vector2(-1, 1), palette: [0x7c8dff, 0x7bfff8, 0xf3fbff], baseColor: 0x141d30, height: [60, 170], density: 0.88 },
  { name: 'Night Market', grid: new THREE.Vector2(1, 1), palette: [0xffef5a, 0xff4fd8, 0x63ff83], baseColor: 0x1d1524, height: [18, 82], density: 0.84 },
];

const GLOBAL_NEON_PALETTE = [0x12d7ff, 0xff4fd8, 0xb86bff, 0xffef5a];

const DISTRICT_SKY_TINTS = {
  'Neon Downtown': ['#05101c', '#20103c', '#632367'],
  'Industrial Sector': ['#0b0d15', '#281624', '#6a2d1b'],
  'Corporate Spires': ['#06111f', '#102347', '#234c7b'],
  'Night Market': ['#100817', '#311343', '#5d2463'],
};

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

  Object.values(DISTRICT_SKY_TINTS).forEach(([top, mid, glow], index) => {
    const band = context.createLinearGradient(0, canvas.height * (0.38 + index * 0.04), 0, canvas.height);
    band.addColorStop(0, 'rgba(0, 0, 0, 0)');
    band.addColorStop(0.55, `${mid}22`);
    band.addColorStop(1, `${glow}33`);
    context.fillStyle = band;
    context.fillRect(0, canvas.height * (0.38 + index * 0.04), canvas.width, canvas.height);
  });

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
    this.skySearchlights = [];
    this.animatedNeon = [];
    this.rain = null;
  }

  build() {
    const colliders = [];
    const blimpAnchors = [];
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

    const energyStationCandidates = this.selectEnergyStations(stationCandidates);
    const energyStations = energyStationCandidates.map((station, index) => ({
      name: `Energy Station ${index + 1}`,
      position: station.position,
    }));

    this.addSkySearchlights(stationCandidates, energyStationCandidates);
    this.addSkyBlimps(colliders, blimpAnchors);

    return {
      blimpAnchors,
      colliders,
      flightPaths,
      energyStations,
      districtAnchors,
      cityHalfSpan: this.config.districtSpacing + this.config.districtSize * 0.5,
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

    const aurora = new THREE.Mesh(
      new THREE.SphereGeometry(this.config.worldSize * 0.52, 28, 18),
      new THREE.MeshBasicMaterial({
        color: 0x6f51ff,
        transparent: true,
        opacity: 0.05,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    aurora.position.y = 70;
    this.scene.add(aurora);
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
    const dropCount = 1800;
    const span = 260;
    const minY = this.config.hoverFloor + 2;
    const maxY = this.config.hoverCeiling + 40;
    const positions = new Float32Array(dropCount * 6);
    const anchors = new Float32Array(dropCount * 3);
    const speeds = new Float32Array(dropCount);
    const lengths = new Float32Array(dropCount);

    for (let i = 0; i < dropCount; i += 1) {
      const x = randRange(-span, span);
      const y = randRange(minY, maxY);
      const z = randRange(-span, span);
      const speed = randRange(110, 170);
      const length = randRange(8, 15);
      const index = i * 6;
      const anchorIndex = i * 3;

      anchors[anchorIndex] = x;
      anchors[anchorIndex + 1] = y;
      anchors[anchorIndex + 2] = z;
      speeds[i] = speed;
      lengths[i] = length;

      positions[index] = x;
      positions[index + 1] = y;
      positions[index + 2] = z;
      positions[index + 3] = x + 1.4;
      positions[index + 4] = y + length;
      positions[index + 5] = z + 0.8;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const rain = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        color: 0x9fd8ff,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.rain = {
      mesh: rain,
      positions,
      anchors,
      speeds,
      lengths,
      span,
      minY,
      maxY,
      wind: new THREE.Vector3(12, 0, 7),
    };
    rain.position.set(0, 0, 0);
    this.scene.add(rain);
  }

  createPanelStrip(length, horizontal, material) {
    return new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? length : 0.18, horizontal ? 0.18 : length, 0.1),
      material,
    );
  }

  addBuildingSkin(group, resources, center, dimensions, district) {
    const { x, z } = center;
    const { width, depth, height } = dimensions;
    const edgeMaterial = resources.edgeMaterial;
    const panelMaterial = resources.panelMaterial;

    if (height > 42 && Math.random() > 0.5) {
      [-1, 1].forEach((sx) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.34, height + 0.6, 0.34), edgeMaterial);
        post.position.set(x + sx * (width * 0.5 - 0.22), height * 0.5, z - depth * 0.5 + 0.22);
        group.add(post);
      });
    }

    const rows = Math.max(1, Math.floor(height / 42));
    for (let row = 1; row <= rows; row += 1) {
      const y = (height / (rows + 1)) * row;
      const front = this.createPanelStrip(width - 0.7, true, panelMaterial);
      front.position.set(x, y, z + depth * 0.5 + 0.08);
      group.add(front);

      const back = front.clone();
      back.position.z = z - depth * 0.5 - 0.08;
      group.add(back);

      if (height > 72 && row === rows && Math.random() > 0.5) {
        const side = this.createPanelStrip(depth - 0.7, true, panelMaterial);
        side.rotation.y = Math.PI / 2;
        side.position.set(x - width * 0.5 - 0.08, y, z);
        group.add(side);
      }
    }

    if (height > 78 && Math.random() > 0.72) {
      const glowFrame = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.26, 0.28, depth + 0.26),
        pickOne(resources.glowMaterials),
      );
      glowFrame.position.set(x, height + 0.22, z);
      group.add(glowFrame);
    }

    if (district.name === 'Corporate Spires' && height > 70 && Math.random() > 0.5) {
      const crown = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.82, 1.8, depth * 0.82),
        resources.capMaterial,
      );
      crown.position.set(x, height + 1.1, z);
      group.add(crown);
    }
  }

  addRooftopProps(group, resources, center, dimensions, district) {
    const { x, z } = center;
    const { width, depth, height } = dimensions;
    const roofY = height + 0.6;

    if (Math.random() > 0.52) {
      const vent = new THREE.Mesh(
        new THREE.BoxGeometry(width * randRange(0.12, 0.2), randRange(1.4, 2.8), depth * randRange(0.1, 0.18)),
        resources.darkMetalMaterial,
      );
      vent.position.set(x + randRange(-width * 0.2, width * 0.2), roofY + vent.geometry.parameters.height * 0.5, z + randRange(-depth * 0.2, depth * 0.2));
      group.add(vent);
    }

    if (height > 48 && Math.random() > 0.8) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(width * randRange(0.14, 0.28), 0.26, depth * randRange(0.18, 0.28)),
        pickOne(resources.glowMaterials),
      );
      panel.position.set(x + randRange(-width * 0.18, width * 0.18), roofY + 0.3, z + randRange(-depth * 0.18, depth * 0.18));
      group.add(panel);
    }

    if (height > 46 && Math.random() > 0.68) {
      const mastHeight = randRange(5, district.name === 'Corporate Spires' ? 15 : 10);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, mastHeight, 8), resources.darkMetalMaterial);
      mast.position.set(x + randRange(-width * 0.24, width * 0.24), roofY + mastHeight * 0.5, z + randRange(-depth * 0.24, depth * 0.24));
      group.add(mast);

      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 10), pickOne(resources.glowMaterials));
      tip.position.copy(mast.position).add(new THREE.Vector3(0, mastHeight * 0.5, 0));
      group.add(tip);
    }

    if (district.name !== 'Corporate Spires' && height > 34 && Math.random() > 0.9) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 2.8, 12), resources.darkMetalMaterial);
      tank.position.set(x + randRange(-width * 0.14, width * 0.14), roofY + 2.2, z + randRange(-depth * 0.14, depth * 0.14));
      group.add(tank);
      [-1.1, 1.1].forEach((offset) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.2, 0.18), resources.darkMetalMaterial);
        leg.position.set(tank.position.x + offset, roofY + 1, tank.position.z + 0.75);
        group.add(leg);
        const backLeg = leg.clone();
        backLeg.position.z = tank.position.z - 0.75;
        group.add(backLeg);
      });
    }
  }

  addNeonSign(group, resources, center, dimensions) {
    const { x, z } = center;
    const { width, depth, height } = dimensions;
    const signWidth = width * randRange(0.34, 0.62);
    const signHeight = randRange(4, Math.min(12, Math.max(5, height * 0.16)));
    const side = Math.floor(Math.random() * 4);
    const colorIndex = Math.floor(Math.random() * resources.neonMaterials.length);
    const emissiveColor = resources.palette[colorIndex % resources.palette.length];

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(signWidth, signHeight),
      new THREE.MeshBasicMaterial({ color: emissiveColor, transparent: true, opacity: 0.9, toneMapped: false, side: THREE.DoubleSide }),
    );
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(signWidth + 1.2, signHeight + 1.2, 0.2),
      resources.darkMetalMaterial,
    );
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.24, signHeight + 2.8, 0.24), resources.darkMetalMaterial);
    const y = randRange(12, Math.max(18, height - 12));

    if (side === 0) {
      sign.position.set(x, y, z + depth * 0.5 + 0.9);
      frame.position.set(x, y, z + depth * 0.5 + 0.72);
      bar.position.set(x - signWidth * 0.42, y - 0.4, z + depth * 0.5 + 0.4);
    } else if (side === 1) {
      sign.position.set(x, y, z - depth * 0.5 - 0.9);
      sign.rotation.y = Math.PI;
      frame.position.set(x, y, z - depth * 0.5 - 0.72);
      bar.position.set(x + signWidth * 0.42, y - 0.4, z - depth * 0.5 - 0.4);
    } else if (side === 2) {
      sign.position.set(x + width * 0.5 + 0.9, y, z);
      sign.rotation.y = -Math.PI / 2;
      frame.position.set(x + width * 0.5 + 0.72, y, z);
      frame.rotation.y = -Math.PI / 2;
      bar.position.set(x + width * 0.5 + 0.4, y - 0.4, z + signWidth * 0.42);
    } else {
      sign.position.set(x - width * 0.5 - 0.9, y, z);
      sign.rotation.y = Math.PI / 2;
      frame.position.set(x - width * 0.5 - 0.72, y, z);
      frame.rotation.y = Math.PI / 2;
      bar.position.set(x - width * 0.5 - 0.4, y - 0.4, z - signWidth * 0.42);
    }

    group.add(frame, sign, bar);
    this.animatedNeon.push({
      material: sign.material,
      pulse: 0.72 + Math.random() * 0.25,
      speed: 2.4 + Math.random() * 2.8,
      phase: Math.random() * Math.PI * 2,
    });
  }

  addTieredTower(group, resources, district, center, baseDimensions) {
    const tiers = baseDimensions.height > 72 && Math.random() > 0.74 ? 2 : baseDimensions.height > 44 && Math.random() > 0.82 ? 1 : 0;
    let currentWidth = baseDimensions.width;
    let currentDepth = baseDimensions.depth;
    let heightBuilt = 0;

    for (let tier = 0; tier <= tiers; tier += 1) {
      const segmentHeight = tier === tiers
        ? baseDimensions.height - heightBuilt
        : baseDimensions.height * randRange(0.32, 0.5);
      const segment = new THREE.Mesh(
        new THREE.BoxGeometry(currentWidth, segmentHeight, currentDepth),
        pickOne(resources.buildingMaterials),
      );
      segment.position.set(center.x, heightBuilt + segmentHeight * 0.5, center.z);
      segment.position.x += tier > 0 ? randRange(-0.12, 0.12) * baseDimensions.width : 0;
      segment.position.z += tier > 0 ? randRange(-0.12, 0.12) * baseDimensions.depth : 0;
      group.add(segment);

      this.addBuildingSkin(group, resources, { x: segment.position.x, z: segment.position.z }, {
        width: currentWidth,
        depth: currentDepth,
        height: heightBuilt + segmentHeight,
      }, district);

      heightBuilt += segmentHeight;
      currentWidth *= randRange(0.7, 0.88);
      currentDepth *= randRange(0.7, 0.9);
    }

    const rooftopCenter = new THREE.Vector3(center.x, heightBuilt, center.z);
    this.decorateTower(group, resources, center.x, center.z, baseDimensions.width, baseDimensions.depth, heightBuilt);
    if (heightBuilt > 30 && Math.random() > 0.45) {
      this.addRooftopProps(group, resources, center, { ...baseDimensions, height: heightBuilt }, district);
    }
    if (heightBuilt > 26 && Math.random() > 0.76) {
      this.addNeonSign(group, resources, center, { ...baseDimensions, height: heightBuilt });
    }

    return {
      rooftopCenter,
      height: heightBuilt,
      width: baseDimensions.width,
      depth: baseDimensions.depth,
    };
  }

  addSkySearchlights(candidates, excludedCandidates = []) {
    const beamGeometry = new THREE.CylinderGeometry(3.8, 13.5, 180, 24, 1, true);
    const capGeometry = new THREE.SphereGeometry(4.6, 18, 18);
    const mastGeometry = new THREE.CylinderGeometry(2.8, 3.6, 16, 12);
    const baseGeometry = new THREE.CylinderGeometry(7.2, 8.8, 5.5, 16);
    const beamColors = [0x7be5ff, 0xff7ee6, 0xffef7a];
    const searchlightAnchors = this.selectSearchlightAnchors(candidates, excludedCandidates);

    searchlightAnchors.forEach((anchor, index) => {
      const color = beamColors[index % beamColors.length];
      const group = new THREE.Group();
      group.position.copy(anchor);

      const base = new THREE.Mesh(
        baseGeometry,
        new THREE.MeshStandardMaterial({ color: 0x151e2d, emissive: 0x08111d, emissiveIntensity: 0.24, metalness: 0.36, roughness: 0.6 }),
      );
      base.position.y = 2.75;
      group.add(base);

      const mast = new THREE.Mesh(
        mastGeometry,
        new THREE.MeshStandardMaterial({ color: 0x1d2940, emissive: 0x0b1526, emissiveIntensity: 0.3, metalness: 0.28, roughness: 0.54 }),
      );
      mast.position.y = 13;
      group.add(mast);

      const head = new THREE.Group();
      head.position.y = 20;
      group.add(head);

      const emitter = new THREE.Mesh(
        new THREE.BoxGeometry(8.2, 4.2, 6.4),
        new THREE.MeshStandardMaterial({ color: 0x243149, emissive: color, emissiveIntensity: 0.18, metalness: 0.42, roughness: 0.42 }),
      );
      head.add(emitter);

      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(1.9, 1.9, 4.8, 18),
        new THREE.MeshBasicMaterial({ color, toneMapped: false }),
      );
      lens.rotation.z = Math.PI / 2;
      lens.position.x = 5.2;
      head.add(lens);

      const beam = new THREE.Mesh(
        beamGeometry,
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.12,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
      beam.position.x = 92;
      beam.rotation.z = Math.PI / 2;
      head.add(beam);

      const beamCap = new THREE.Mesh(
        capGeometry,
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.16,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      beamCap.scale.set(1.3, 0.45, 1.3);
      beamCap.position.x = 178;
      head.add(beamCap);

      const target = new THREE.Object3D();
      target.position.copy(anchor).add(new THREE.Vector3(0, 180, 0));
      this.scene.add(target);

      const light = new THREE.SpotLight(color, 200, 420, 0.16, 0.35, 1.2);
      light.position.set(5.2, 0, 0);
      light.target = target;
      light.castShadow = false;
      head.add(light);

      this.scene.add(group);
      this.skySearchlights.push({
        group,
        head,
        target,
        beam,
        beamCap,
        baseX: anchor.x,
        baseZ: anchor.z,
        phase: index * 1.9,
        yawAmplitude: 0.8 + index * 0.08,
        pitchBase: 0.95,
        pitchAmplitude: 0.18 + index * 0.02,
        sweepSpeed: 0.34 + index * 0.05,
      });
    });
  }

  selectSearchlightAnchors(candidates, excludedCandidates = []) {
    const anchors = [];
    const excludedPositions = excludedCandidates.map((candidate) => candidate.position);
    const sortedCandidates = [...candidates]
      .filter((candidate) => excludedPositions.every((position) => position.distanceTo(candidate.position) > 1))
      .sort((a, b) => b.height - a.height);

    sortedCandidates.forEach((candidate) => {
      if (anchors.length >= 3) return;
      const anchor = candidate.position.clone();
      const separated = anchors.every((existing) => existing.distanceTo(anchor) > this.config.districtSize * 0.55);
      if (!separated) return;
      anchors.push(anchor);
    });

    if (anchors.length === 3) {
      return anchors;
    }

    const fallbackAnchors = [
      new THREE.Vector3(-860, 96, -160),
      new THREE.Vector3(0, 112, 40),
      new THREE.Vector3(860, 100, 180),
    ];
    return [...anchors, ...fallbackAnchors.slice(anchors.length)].slice(0, 3);
  }

  addSkyBlimps(colliders, blimpAnchors = []) {
    const hullMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a3140,
      emissive: 0x0b1324,
      emissiveIntensity: 0.32,
      metalness: 0.28,
      roughness: 0.54,
    });
    const gondolaMaterial = new THREE.MeshStandardMaterial({
      color: 0x131c2b,
      emissive: 0x08111d,
      emissiveIntensity: 0.26,
      metalness: 0.22,
      roughness: 0.62,
    });
    const finMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e2637,
      emissive: 0x0a1020,
      emissiveIntensity: 0.24,
      metalness: 0.32,
      roughness: 0.56,
    });
    const hullGeometry = new THREE.SphereGeometry(1, 30, 22);
    const gondolaGeometry = new THREE.BoxGeometry(11, 3.6, 4.8);
    const finGeometry = new THREE.BoxGeometry(4.8, 0.7, 8);
    const pylonGeometry = new THREE.BoxGeometry(0.36, 3.5, 0.36);
    const lightStripGeometry = new THREE.BoxGeometry(1.8, 0.2, 40);
    const lightRingGeometry = new THREE.TorusGeometry(4.2, 0.2, 8, 28);

    const positions = [
      new THREE.Vector3(-720, 164, -180),
      new THREE.Vector3(690, 154, -260),
      new THREE.Vector3(-610, 176, 560),
      new THREE.Vector3(760, 160, 460),
      new THREE.Vector3(0, 188, 0),
      new THREE.Vector3(220, 148, -760),
    ];

    positions.forEach((position, index) => {
      const group = new THREE.Group();
      group.position.copy(position);
      group.rotation.y = randRange(0, Math.PI * 2);
      group.rotation.z = randRange(-0.08, 0.08);

      const hullLength = randRange(42, 56);
      const hullHeight = randRange(11.5, 15.5);
      const hullWidth = randRange(14, 18);
      const neonColor = GLOBAL_NEON_PALETTE[index % GLOBAL_NEON_PALETTE.length];
      const neonMaterial = new THREE.MeshBasicMaterial({ color: neonColor, toneMapped: false });
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: neonColor,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });

      const hull = new THREE.Mesh(hullGeometry, hullMaterial);
      hull.scale.set(hullWidth * 0.5, hullHeight * 0.5, hullLength * 0.5);
      group.add(hull);

      const gondola = new THREE.Mesh(gondolaGeometry, gondolaMaterial);
      gondola.position.set(0, -hullHeight * 0.52, hullLength * 0.08);
      group.add(gondola);

      [-2.6, 2.6].forEach((x) => {
        const pylon = new THREE.Mesh(pylonGeometry, finMaterial);
        pylon.position.set(x, -hullHeight * 0.34, hullLength * 0.07);
        group.add(pylon);
      });

      [
        { x: 0, y: hullHeight * 0.06, z: hullLength * 0.42, sx: 1.2, sy: 1, sz: 1 },
        { x: 0, y: -hullHeight * 0.1, z: hullLength * 0.42, sx: 1.2, sy: 1, sz: 1 },
        { x: hullWidth * 0.36, y: 0, z: hullLength * 0.4, sx: 1, sy: 1, sz: 0.82 },
        { x: -hullWidth * 0.36, y: 0, z: hullLength * 0.4, sx: 1, sy: 1, sz: 0.82 },
      ].forEach(({ x, y, z, sx, sy, sz }) => {
        const fin = new THREE.Mesh(finGeometry, finMaterial);
        fin.position.set(x, y, z);
        fin.scale.set(sx, sy, sz);
        if (x !== 0) fin.rotation.z = Math.PI / 2;
        group.add(fin);
      });

      [-1, 1].forEach((xDir) => {
        const strip = new THREE.Mesh(lightStripGeometry, glowMaterial);
        strip.position.set(xDir * (hullWidth * 0.34), 0, 0);
        group.add(strip);
      });

      [-0.18, 0.22].forEach((zFactor) => {
        const ring = new THREE.Mesh(lightRingGeometry, neonMaterial);
        ring.rotation.y = Math.PI / 2;
        ring.scale.set(hullWidth * 0.2, hullHeight * 0.16, 1);
        ring.position.set(0, 0, hullLength * zFactor);
        group.add(ring);
      });

      const noseLight = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 16), glowMaterial);
      noseLight.position.set(0, 0, -hullLength * 0.5);
      noseLight.scale.set(1.2, 1, 1.6);
      group.add(noseLight);

      this.scene.add(group);

      blimpAnchors.push({
        position: new THREE.Vector3(position.x, position.y + hullHeight * 0.9 + 14, position.z),
      });

      colliders.push({
        type: 'blimp',
        min: new THREE.Vector3(position.x - hullWidth * 0.5, position.y - hullHeight * 0.7, position.z - hullLength * 0.5),
        max: new THREE.Vector3(position.x + hullWidth * 0.5, position.y + hullHeight * 0.5, position.z + hullLength * 0.5),
      });
    });
  }

  getDistrictResources(district) {
    if (this.districtResources.has(district.name)) {
      return this.districtResources.get(district.name);
    }

    const accentPalette = [...district.palette, ...GLOBAL_NEON_PALETTE];
    const buildingMaterials = Array.from({ length: 5 }, (_, index) => {
      const tint = new THREE.Color(district.baseColor ?? 0x121827);
      tint.offsetHSL((index - 2) * 0.012, 0.05, index * 0.012);
      const texture = createWindowTexture(tint.getStyle(), new THREE.Color(accentPalette[index % accentPalette.length]).getStyle(), index + district.grid.x * 11 + district.grid.y * 19);
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: texture,
        emissiveMap: texture,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.95,
        metalness: 0.16,
        roughness: 0.68,
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
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0x1e2738, emissive: district.palette[0], emissiveIntensity: 0.08, metalness: 0.24, roughness: 0.52 });
    const panelMaterial = new THREE.MeshStandardMaterial({ color: 0x182031, emissive: district.palette[district.palette.length - 1], emissiveIntensity: 0.04, metalness: 0.18, roughness: 0.64 });
    const capMaterial = new THREE.MeshStandardMaterial({ color: 0x27324a, emissive: district.palette[1] ?? district.palette[0], emissiveIntensity: 0.12, metalness: 0.28, roughness: 0.48 });

    const resources = {
      buildingMaterials,
      neonMaterials,
      glowMaterials,
      darkMetalMaterial,
      edgeMaterial,
      panelMaterial,
      capMaterial,
      palette: accentPalette,
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
    const districtFootprint = this.config.districtSpacing * 0.94;
    const halfDistrict = districtSize / 2;
    const roadHalf = districtSize * 0.45;
    const buildingInset = districtSize * 0.038;
    const step = districtSize / 20;
    const perimeter = halfDistrict * 0.88;
    const boulevard = halfDistrict * 0.5;
    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x141b29, emissive: district.palette[0], emissiveIntensity: 0.14, metalness: 0.12, roughness: 0.8 });
    const road = new THREE.Mesh(new THREE.BoxGeometry(districtFootprint, 1, districtFootprint), roadMaterial);
    road.position.set(center.x, 0.5, center.y);
    group.add(road);

    const boulevardGlow = new THREE.Mesh(
      new THREE.BoxGeometry(districtFootprint * 0.82, 0.2, districtFootprint * 0.82),
      new THREE.MeshBasicMaterial({ color: pickOne(district.palette), transparent: true, opacity: 0.06, toneMapped: false }),
    );
    boulevardGlow.position.set(center.x, 0.22, center.y);
    group.add(boulevardGlow);

    for (let x = -roadHalf; x <= roadHalf; x += step) {
      for (let z = -roadHalf; z <= roadHalf; z += step) {
        if (Math.abs(x) < buildingInset || Math.abs(z) < buildingInset) continue;
        const edgeFactor = Math.max(Math.abs(x), Math.abs(z)) / roadHalf;
        const densityBias = edgeFactor > 0.82 ? 0.08 : edgeFactor < 0.3 ? -0.04 : 0;
        if (Math.random() > Math.min(0.985, district.density + densityBias)) continue;

        const width = randRange(11, 24);
        const depth = randRange(11, 24);
        const height = randRange(...district.height);
        const posX = center.x + x + randRange(-step * 0.16, step * 0.16);
        const posZ = center.y + z + randRange(-step * 0.16, step * 0.16);

        const building = this.addTieredTower(group, resources, district, { x: posX, z: posZ }, { width, depth, height });

        colliders.push({
          type: 'building',
          min: new THREE.Vector3(posX - width / 2, 0, posZ - depth / 2),
          max: new THREE.Vector3(posX + width / 2, building.height, posZ + depth / 2),
        });
        stationCandidates.push({
          district: district.name,
          height: building.height,
          position: building.rooftopCenter.clone().add(new THREE.Vector3(0, 2.5, 0)),
        });
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

  selectEnergyStations(candidates) {
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

    return chosen.slice(0, 6);
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

  update(delta, playerPosition = null) {
    const time = performance.now() * 0.001;
    this.animatedNeon.forEach((sign) => {
      const flicker = 0.72 + Math.sin(time * sign.speed + sign.phase) * 0.12 + (Math.sin(time * sign.speed * 2.7 + sign.phase) > 0.94 ? -0.26 : 0);
      sign.material.opacity = Math.max(0.4, flicker);
    });

    this.updateRain(delta, playerPosition);

    if (this.skySearchlights.length === 0) return;

    this.skySearchlights.forEach((searchlight, index) => {
      const swing = Math.sin(time * searchlight.sweepSpeed + searchlight.phase);
      const nod = Math.sin(time * (searchlight.sweepSpeed * 1.35) + searchlight.phase * 0.8);
      searchlight.group.rotation.y = swing * searchlight.yawAmplitude;
      searchlight.head.rotation.z = searchlight.pitchBase + nod * searchlight.pitchAmplitude;
      searchlight.beam.material.opacity = 0.1 + (nod * 0.5 + 0.5) * 0.05;
      searchlight.beamCap.material.opacity = 0.13 + (swing * 0.5 + 0.5) * 0.07;
      searchlight.target.position.set(
        searchlight.baseX + Math.sin(time * searchlight.sweepSpeed + searchlight.phase) * (180 + index * 36),
        290 + Math.cos(time * (searchlight.sweepSpeed * 1.2) + searchlight.phase) * 24,
        searchlight.baseZ + Math.cos(time * searchlight.sweepSpeed + searchlight.phase) * (150 + index * 28),
      );
    });
  }

  updateRain(delta, playerPosition) {
    if (!this.rain) return;

    const { positions, anchors, speeds, lengths, span, minY, maxY, wind, mesh } = this.rain;
    mesh.position.x = playerPosition?.x ?? 0;
    mesh.position.z = playerPosition?.z ?? 0;

    for (let i = 0; i < speeds.length; i += 1) {
      const anchorIndex = i * 3;
      const index = i * 6;

      anchors[anchorIndex] += wind.x * delta;
      anchors[anchorIndex + 1] -= speeds[i] * delta;
      anchors[anchorIndex + 2] += wind.z * delta;

      if (anchors[anchorIndex + 1] < minY) {
        anchors[anchorIndex] = randRange(-span, span);
        anchors[anchorIndex + 1] = randRange(maxY - 30, maxY);
        anchors[anchorIndex + 2] = randRange(-span, span);
      } else {
        if (anchors[anchorIndex] < -span) anchors[anchorIndex] += span * 2;
        if (anchors[anchorIndex] > span) anchors[anchorIndex] -= span * 2;
        if (anchors[anchorIndex + 2] < -span) anchors[anchorIndex + 2] += span * 2;
        if (anchors[anchorIndex + 2] > span) anchors[anchorIndex + 2] -= span * 2;
      }

      positions[index] = anchors[anchorIndex];
      positions[index + 1] = anchors[anchorIndex + 1];
      positions[index + 2] = anchors[anchorIndex + 2];
      positions[index + 3] = anchors[anchorIndex] + wind.x * 0.035;
      positions[index + 4] = anchors[anchorIndex + 1] + lengths[i];
      positions[index + 5] = anchors[anchorIndex + 2] + wind.z * 0.035;
    }

    mesh.geometry.attributes.position.needsUpdate = true;
  }
}
