import * as THREE from 'three';
import { frameBoard } from './camera-fit.js';

const TAU = Math.PI * 2;
const TRACK_WIDTH = 1.25;
const laneRadius = (lane) => 4 + lane * 2.2;

function randomSource(seed = 716) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function surfaceTexture(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const random = randomSource(kind === 'ground' ? 829 : 419);
  const image = ctx.createImageData(512, 512);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const noise = (random() - 0.5) * (kind === 'ground' ? 22 : 35);
      const cloud = Math.sin(x * 0.034 + Math.cos(y * 0.017) * 3) * Math.cos(y * 0.025) * 7;
      const value = (kind === 'ground' ? 102 : 189) + noise + cloud;
      const i = (y * 512 + x) * 4;
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  if (kind !== 'ground') {
    // Hairline mineral veins and tiny flecks keep the stone from looking like plastic.
    for (let i = 0; i < 240; i++) {
      const x = random() * 512;
      const y = random() * 512;
      ctx.strokeStyle = `rgba(${random() > 0.5 ? '248,255,240' : '40,47,38'},${0.03 + random() * 0.06})`;
      ctx.lineWidth = 0.4 + random() * 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + random() * 16, y + random() * 6);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function studioEnvironment(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#aab7b2');
  gradient.addColorStop(0.40, '#647b70');
  gradient.addColorStop(0.58, '#26392b');
  gradient.addColorStop(1, '#101c12');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 512);
  ctx.fillStyle = '#f9fff3';
  ctx.fillRect(170, 70, 150, 80);
  ctx.fillStyle = '#a6bdbb';
  ctx.fillRect(620, 80, 200, 120);
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromEquirectangular(texture);
  texture.dispose();
  generator.dispose();
  return target;
}

// Each profile edge has its own vertices: flat track tops, clean bevels, dark walls.
function ringGeometry(radius, width) {
  const inside = radius - width / 2;
  const outside = radius + width / 2;
  const profile = [
    [inside + 0.06, -0.63], [outside - 0.06, -0.63],
    [outside, -0.56], [outside, 0.48], [outside - 0.06, 0.55],
    [inside + 0.06, 0.55], [inside, 0.48], [inside, -0.56],
    [inside + 0.06, -0.63],
  ];
  const positions = [], uvs = [], indices = [];
  const geometry = new THREE.BufferGeometry();
  const segments = 224;
  for (let p = 0; p < profile.length - 1; p++) {
    const offset = positions.length / 3;
    const start = indices.length;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * TAU;
      for (let j = 0; j < 2; j++) {
        const [r, y] = profile[p + j];
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        positions.push(x, y, z);
        if (p === 4) uvs.push(x * 0.24, z * 0.24);
        else uvs.push(i / segments * radius * 1.4, y * 0.8);
      }
    }
    for (let i = 0; i < segments; i++) {
      const a = offset + i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geometry.addGroup(start, indices.length - start, p === 4 ? 0 : p === 3 || p === 5 ? 2 : 1);
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function arcShape(radius, width, angle, length) {
  const shape = new THREE.Shape();
  const start = angle - length / 2;
  const end = angle + length / 2;
  const inner = radius - width / 2;
  const outer = radius + width / 2;
  const segments = 20;
  shape.moveTo(Math.cos(start) * outer, -Math.sin(start) * outer);
  for (let i = 1; i <= segments; i++) {
    const a = start + (end - start) * i / segments;
    shape.lineTo(Math.cos(a) * outer, -Math.sin(a) * outer);
  }
  for (let i = segments; i >= 0; i--) {
    const a = start + (end - start) * i / segments;
    shape.lineTo(Math.cos(a) * inner, -Math.sin(a) * inner);
  }
  shape.closePath();
  return shape;
}

class ArcCurve extends THREE.Curve {
  constructor(radius, start, length, height) {
    super();
    this.radius = radius;
    this.start = start;
    this.length = length;
    this.height = height;
  }
  getPoint(t, target = new THREE.Vector3()) {
    const angle = this.start + t * this.length;
    return target.set(Math.cos(angle) * this.radius, this.height, Math.sin(angle) * this.radius);
  }
}

function leafGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0,
    -0.16, 0.13, 0.31,
    0, 0.25, 0.42,
    0.16, 0.13, 0.31,
    -0.11, 0.20, 0.68,
    0, 0.29, 0.94,
    0.11, 0.20, 0.68,
  ], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3, 1, 4, 2, 4, 5, 2, 2, 5, 6, 2, 6, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#17251d');
  scene.fog = new THREE.FogExp2('#17251d', 0.008);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 180);
  const environment = studioEnvironment(renderer);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.6;

  const stoneMap = surfaceTexture('stone');
  const groundMap = surfaceTexture('ground');
  groundMap.repeat.set(36, 36);
  const materials = {
    track: new THREE.MeshStandardMaterial({ color: '#929d8f', map: stoneMap, roughness: 0.91, metalness: 0.08, envMapIntensity: 0.32 }),
    wall: new THREE.MeshStandardMaterial({ color: '#38443d', map: stoneMap, roughness: 0.94, metalness: 0.03 }),
    bevel: new THREE.MeshStandardMaterial({ color: '#a6b2a1', roughness: 0.79, metalness: 0.12 }),
    ground: new THREE.MeshStandardMaterial({ color: '#334936', map: groundMap, roughness: 1, metalness: 0 }),
    red: new THREE.MeshStandardMaterial({ color: '#ef303b', map: stoneMap, roughness: 0.44, metalness: 0.14, emissive: '#590207', emissiveIntensity: 0.1 }),
    redSide: new THREE.MeshStandardMaterial({ color: '#b71520', roughness: 0.52, metalness: 0.13 }),
    redEdge: new THREE.MeshStandardMaterial({ color: '#ff7372', roughness: 0.43, metalness: 0.08 }),
    goldEdge: new THREE.MeshStandardMaterial({ color: '#f3b932', roughness: 0.26, metalness: 0.83, envMapIntensity: 1.05 }),
    goldFace: new THREE.MeshStandardMaterial({ color: '#ffcf48', roughness: 0.28, metalness: 0.73, emissive: '#7c4300', emissiveIntensity: 0.16 }),
    goldRim: new THREE.MeshStandardMaterial({ color: '#ffe291', roughness: 0.21, metalness: 0.78 }),
    guide: new THREE.MeshStandardMaterial({ color: '#53b8ff', roughness: 0.28, metalness: 0.08, emissive: '#1288ff', emissiveIntensity: 2.35 }),
    guideBase: new THREE.MeshStandardMaterial({ color: '#1266cb', roughness: 0.42, emissive: '#0066df', emissiveIntensity: 0.48 }),
    ball: new THREE.MeshPhysicalMaterial({ color: '#87dc05', roughness: 0.16, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.4 }),
  };
  const leafMaterials = ['#354e21', '#44632a', '#567735', '#293d20'].map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.92, side: THREE.DoubleSide }));
  const rockMaterials = ['#465249', '#4e594f', '#38473e'].map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.96, flatShading: true, map: stoneMap }));

  const hemisphere = new THREE.HemisphereLight('#d4e5d3', '#101f15', 1.15);
  scene.add(hemisphere);
  const sunlight = new THREE.DirectionalLight('#f0f4d9', 3.4);
  sunlight.position.set(-8, 19, -8);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  sunlight.shadow.camera.near = 0.1;
  sunlight.shadow.camera.far = 70;
  sunlight.shadow.normalBias = 0.035;
  sunlight.shadow.bias = -0.00008;
  sunlight.shadow.radius = 3;
  scene.add(sunlight, sunlight.target);
  const fill = new THREE.DirectionalLight('#9dafbe', 0.56);
  fill.position.set(9, 8, 10);
  scene.add(fill);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), materials.ground);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.66;
  floor.receiveShadow = true;
  scene.add(floor);

  const board = new THREE.Group();
  const decor = new THREE.Group();
  scene.add(board, decor);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.38, 40, 28), materials.ball);
  ball.castShadow = true;
  ball.receiveShadow = true;
  scene.add(ball);
  const ballLight = new THREE.PointLight('#90e620', 0.6, 2.5, 2);
  scene.add(ballLight);
  const sparkleGeometry = new THREE.IcosahedronGeometry(0.052, 0);
  const sparkleMaterial = new THREE.MeshStandardMaterial({ color: '#ffe6a0', emissive: '#ffb922', emissiveIntensity: 1.25, roughness: 0.3, metalness: 0.3 });
  const sparkles = new THREE.InstancedMesh(sparkleGeometry, sparkleMaterial, 96);
  sparkles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  sparkles.frustumCulled = false;
  sparkles.count = 0;
  scene.add(sparkles);
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.48, 0.52, 64), new THREE.MeshBasicMaterial({ color: '#b4f54e', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  halo.rotation.x = -Math.PI / 2;
  halo.visible = false;
  scene.add(halo);
  const particleTransform = new THREE.Object3D();
  const effectRandom = randomSource(14829);
  let particles = [];
  let visualTime = 0;
  let previousPhase = '';
  let winStarted = -10;

  function burst(x, y, z, count, strength = 1) {
    for (let i = 0; i < count; i++) {
      const angle = effectRandom() * TAU;
      const speed = (0.5 + effectRandom() * 0.9) * strength;
      particles.push({ x, y, z, born: visualTime, life: 0.45 + effectRandom() * 0.38, vx: Math.cos(angle) * speed, vz: Math.sin(angle) * speed, vy: (0.9 + effectRandom() * 1.5) * strength, spin: effectRandom() * TAU });
    }
    if (particles.length > 96) particles = particles.slice(-96);
  }

  const coinBody = new THREE.CylinderGeometry(0.215, 0.215, 0.078, 28, 1);
  coinBody.rotateX(Math.PI / 2);
  const coinRim = new THREE.TorusGeometry(0.175, 0.013, 5, 28);
  const coinMark = new THREE.BoxGeometry(0.042, 0.166, 0.009);
  const leaf = leafGeometry();
  const rock = new THREE.DodecahedronGeometry(1, 0);
  const positions = rock.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const variation = 0.9 + (Math.sin(x * 42.4 + y * 21.7 + z * 35.8) * 0.5 + 0.5) * 0.2;
    positions.setXYZ(i, x * variation, y * variation, z * variation);
  }
  rock.computeVertexNormals();

  let currentLevel = null;
  let outerRadius = 6.825;
  let coins = [];
  let levelGeometries = [];
  let lastBallPosition = null;
  let disposed = false;
  let width = 1;
  let height = 1;

  function trackResource(geometry) {
    levelGeometries.push(geometry);
    return geometry;
  }

  function addRock(x, z, scale, random) {
    const mesh = new THREE.Mesh(rock, rockMaterials[Math.floor(random() * rockMaterials.length)]);
    mesh.scale.set(scale * (0.75 + random() * 0.4), scale * (0.85 + random() * 0.55), scale * (0.72 + random() * 0.3));
    mesh.position.set(x, -0.58 + scale * 0.56, z);
    mesh.rotation.set(random() * 0.25, random() * TAU, random() * 0.2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    decor.add(mesh);
  }

  function addPlant(x, z, scale, random) {
    const plant = new THREE.Group();
    plant.position.set(x, -0.62, z);
    plant.scale.setScalar(scale);
    for (let i = 0; i < 9; i++) {
      const blade = new THREE.Mesh(leaf, leafMaterials[Math.floor(random() * leafMaterials.length)]);
      blade.rotation.y = i * 2.399 + random() * 0.45;
      blade.rotation.x = -(0.03 + random() * 0.72);
      blade.scale.set(0.9 + random() * 0.5, 0.85 + random() * 0.45, 0.65 + random() * 0.65);
      blade.position.y = i * 0.006;
      blade.castShadow = true;
      blade.receiveShadow = true;
      plant.add(blade);
    }
    decor.add(plant);
  }

  function buildSurround() {
    const random = randomSource(4241 + currentLevel.rings * 17);
    const r = outerRadius;
    const clusters = [
      [-r - 1.5, -r * 0.52, 1.32], [r + 1.75, -r * 0.63, 1.60],
      [-r - 1.45, r * 0.65, 1.50], [r + 1.55, r * 0.77, 1.68],
      [-r * 0.64, -r - 2.6, 0.68], [r * 0.80, -r - 2.4, 0.78],
    ];
    for (const [x, z, scale] of clusters) {
      addRock(x, z, scale, random);
      addRock(x + (random() - 0.5) * 2, z + 1.35, scale * 0.46, random);
      addPlant(x + (x > 0 ? -0.55 : 0.55), z - 0.85, 1.2, random);
      addPlant(x + 0.3, z + 1.0, 0.78, random);
    }
    for (let i = 0; i < 40; i++) {
      const angle = random() * TAU;
      const distance = r + 1.1 + random() * 4.8;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      // Keep the near and far central sight lines quiet.
      if (Math.abs(x) < r * 0.65 && z > -r * 0.3) continue;
      if (i % 4 === 0) addPlant(x, z, 0.40 + random() * 0.4, random);
      else addRock(x, z, 0.09 + random() * 0.18, random);
    }
  }

  function addGuide(lane) {
    const radius = laneRadius(lane);
    const angle = lane % 2 === 0 ? 3.5 + lane * 0.12 : 0.6 + lane * 0.08;
    const length = Math.min(0.5, 2.0 / radius);
    const curve = new ArcCurve(radius, angle, length, 0.579);
    const base = new THREE.Mesh(trackResource(new THREE.TubeGeometry(curve, 32, 0.10, 8, false)), materials.guideBase);
    const line = new THREE.Mesh(trackResource(new THREE.TubeGeometry(curve, 32, 0.061, 8, false)), materials.guide);
    line.position.y = 0.024;
    board.add(base, line);
    for (const a of [angle, angle + length]) {
      const cap = new THREE.Mesh(trackResource(new THREE.SphereGeometry(0.101, 12, 8)), materials.guideBase);
      cap.scale.y = 0.5;
      cap.position.set(Math.cos(a) * radius, 0.58, Math.sin(a) * radius);
      board.add(cap);
    }
  }

  function addGate(gate, lane) {
    const geometry = trackResource(new THREE.ExtrudeGeometry(arcShape(laneRadius(lane), TRACK_WIDTH - 0.17, gate.angle, 0.18), {
      depth: 0.30,
      bevelEnabled: true,
      bevelThickness: 0.033,
      bevelSize: 0.035,
      bevelSegments: 2,
      steps: 1,
      curveSegments: 20,
    }));
    geometry.rotateX(-Math.PI / 2);
    const block = new THREE.Mesh(geometry, [materials.red, materials.redSide]);
    block.position.y = 0.585;
    block.castShadow = true;
    block.receiveShadow = true;
    board.add(block);
    const rimCurve = new ArcCurve(laneRadius(lane) + (TRACK_WIDTH - 0.17) / 2 - 0.03, gate.angle - 0.079, 0.158, 0.916);
    const highlight = new THREE.Mesh(trackResource(new THREE.TubeGeometry(rimCurve, 16, 0.012, 4, false)), materials.redEdge);
    board.add(highlight);
  }

  function addCoin(coin, index) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(coinBody, [materials.goldEdge, materials.goldFace, materials.goldFace]);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    for (const side of [-1, 1]) {
      const rim = new THREE.Mesh(coinRim, materials.goldRim);
      rim.position.z = side * 0.044;
      const mark = new THREE.Mesh(coinMark, materials.goldRim);
      mark.position.z = side * 0.045;
      group.add(rim, mark);
    }
    const radius = laneRadius(coin.lane);
    group.position.set(Math.cos(coin.angle) * radius, 1.05, Math.sin(coin.angle) * radius);
    group.rotation.y = -coin.angle + Math.PI / 2;
    board.add(group);
    coins.push({ id: coin.id, group, orientation: group.rotation.y, index, collectedAt: null });
  }

  function fitCamera() {
    frameBoard(camera, width, height, outerRadius);
  }

  function resize() {
    if (disposed) return;
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width || canvas.clientWidth || window.innerWidth);
    height = Math.max(1, rect.height || canvas.clientHeight || window.innerHeight);
    renderer.setSize(width, height, false);
    fitCamera();
  }

  function setLevel(level) {
    if (disposed) return;
    currentLevel = level;
    board.clear();
    decor.clear();
    for (const geometry of levelGeometries) geometry.dispose();
    levelGeometries = [];
    coins = [];
    lastBallPosition = null;
    particles = [];
    sparkles.count = 0;
    halo.visible = false;
    previousPhase = '';
    winStarted = -10;
    outerRadius = laneRadius(level.rings - 1) + TRACK_WIDTH / 2;
    for (let lane = 0; lane < level.rings; lane++) {
      const ring = new THREE.Mesh(trackResource(ringGeometry(laneRadius(lane), TRACK_WIDTH)), [materials.track, materials.wall, materials.bevel]);
      ring.castShadow = true;
      ring.receiveShadow = true;
      board.add(ring);
      addGuide(lane);
    }
    for (const gate of level.gates || []) for (const lane of gate.blocked || []) addGate(gate, lane);
    (level.coins || []).forEach(addCoin);
    buildSurround();
    const extent = outerRadius + 6;
    sunlight.position.set(-extent * 0.6, extent * 1.7, -extent * 0.65);
    sunlight.shadow.camera.left = sunlight.shadow.camera.bottom = -extent;
    sunlight.shadow.camera.right = sunlight.shadow.camera.top = extent;
    sunlight.shadow.camera.far = extent * 4;
    sunlight.shadow.camera.updateProjectionMatrix();
    fitCamera();
  }

  function update(state, dt = 0) {
    if (disposed || !currentLevel) return;
    if (state.phase !== 'paused') visualTime += Math.min(0.05, Math.max(0, Number.isFinite(dt) ? dt : 0));
    const time = visualTime;
    const radius = Number.isFinite(state.radius) ? state.radius : laneRadius(currentLevel.rings - 1);
    const angle = Number.isFinite(state.angle) ? state.angle : 2.4;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    ball.position.set(x, 0.94, z);
    if (lastBallPosition && state.phase === 'running') {
      const dx = x - lastBallPosition.x, dz = z - lastBallPosition.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 0.00001 && distance < 1.5) ball.rotateOnWorldAxis(new THREE.Vector3(dz / distance, 0, -dx / distance), distance / 0.38);
    }
    lastBallPosition = { x, z };
    ball.scale.setScalar(1);
    if (state.shift && !state.calm) {
      const shiftProgress = Math.min(1, state.shift.elapsed / 0.22);
      const lift = Math.sin(shiftProgress * Math.PI);
      ball.position.y += lift * 0.22;
      ball.scale.set(1 + lift * 0.045, 1 - lift * 0.07, 1 + lift * 0.045);
    }
    if (state.phase === 'won' && previousPhase !== 'won') {
      winStarted = time;
      if (!state.calm) burst(x, 1.14, z, 38, 1.5);
    }
    const winAge = time - winStarted;
    if (state.phase === 'won' && winAge < 0.75 && !state.calm) ball.position.y += Math.sin(winAge / 0.75 * Math.PI) * 0.38;
    halo.visible = state.phase === 'won' && winAge < 0.85 && !state.calm;
    if (halo.visible) {
      halo.position.set(x, 0.563, z);
      halo.scale.setScalar(1 + winAge * 2.3);
      halo.material.opacity = (1 - winAge / 0.85) * 0.65;
    }
    previousPhase = state.phase;
    ballLight.position.set(x, ball.position.y + 0.2, z);
    const collected = state.collected;
    for (const coin of coins) {
      const hasCoin = collected && collected.has(coin.id);
      if (hasCoin && coin.collectedAt === null) {
        coin.collectedAt = time;
        if (!state.calm) burst(coin.group.position.x, 1.12, coin.group.position.z, 12);
      }
      if (!hasCoin) coin.collectedAt = null;
      if (coin.collectedAt !== null) {
        const progress = state.calm ? 1 : Math.min(1, Math.max(0, (time - coin.collectedAt) / 0.24));
        coin.group.visible = progress < 1;
        coin.group.scale.setScalar(1 - progress * 0.9);
        coin.group.position.y = 1.05 + progress * 0.8;
      } else {
        coin.group.visible = true;
        coin.group.scale.setScalar(1);
        coin.group.position.y = 1.05 + (state.calm ? 0 : Math.sin(time * 1.8 + coin.index * 0.64) * 0.025);
      }
      coin.group.rotation.y = coin.orientation + (state.calm ? 0 : Math.sin(time * 0.65 + coin.index * 0.33) * 0.20);
    }
    particles = state.calm ? [] : particles.filter(particle => time - particle.born < particle.life);
    sparkles.count = particles.length;
    particles.forEach((particle, i) => {
      const age = time - particle.born;
      const progress = age / particle.life;
      particleTransform.position.set(particle.x + particle.vx * age, particle.y + particle.vy * age - 2.0 * age * age, particle.z + particle.vz * age);
      particleTransform.rotation.set(age * 5, particle.spin + age * 3, age * 2);
      particleTransform.scale.setScalar((1 - progress) * 1.1);
      particleTransform.updateMatrix();
      sparkles.setMatrixAt(i, particleTransform.matrix);
    });
    if (particles.length) sparkles.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    const geometries = new Set([coinBody, coinRim, coinMark, leaf, rock, ...levelGeometries]);
    const allMaterials = new Set([...Object.values(materials), ...leafMaterials, ...rockMaterials]);
    scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) allMaterials.add(material);
    });
    geometries.forEach(geometry => geometry.dispose());
    allMaterials.forEach(material => material.dispose());
    stoneMap.dispose();
    groundMap.dispose();
    environment.dispose();
    renderer.dispose();
  }

  resize();
  return { setLevel, update, resize, dispose };
}
