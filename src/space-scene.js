import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const SPACE_SCENE_BUDGET = Object.freeze({
  ringPlatforms: 11, visibleAhead: 112, asteroids: 62, barriers: 96,
  pickups: 64, particles: 180, maxPixelRatio: 1.65,
});
const LANES = [-2.2, 0, 2.2];
const STEP = 12;
const POOL = SPACE_SCENE_BUDGET.ringPlatforms;
const FAR = SPACE_SCENE_BUDGET.visibleAhead;
const TAU = Math.PI * 2;

export const SPACE_SCENE_LAYOUT = Object.freeze({
  lanes: Object.freeze([-2.2, 0, 2.2]), ballRadius: .62, ballCenterY: .66,
  visibleAhead: FAR, ringSpacing: STEP, cameraTilt: 17, ballScreenY: .70,
});

// Pure framing data for headless projection checks, using Three's standard perspective.
export function spaceCameraFraming(width, height) {
  const aspect = Math.max(1, width) / Math.max(1, height);
  const fov = 58;
  const halfHeight = 3.05 / Math.min(aspect, 1.1);
  const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const depth = Math.max(5.15, halfHeight / tanHalfFov);
  const tilt = THREE.MathUtils.degToRad(SPACE_SCENE_LAYOUT.cameraTilt);
  const vertical = -.40 * depth * tanHalfFov;
  return {
    aspect, fov, near: .08, far: 360,
    x: 0, y: .66 + depth * Math.sin(tilt) - vertical * Math.cos(tilt),
    z: depth * Math.cos(tilt) + vertical * Math.sin(tilt),
    rotationX: -tilt, rotationY: 0, rotationZ: 0,
  };
}

function randomGenerator(seed = 2917) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function annulus(outer, inner, height) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, TAU, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner, 0, TAU, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height, steps: 1, curveSegments: 48,
    bevelEnabled: true, bevelSegments: 1, bevelSize: .045, bevelThickness: .04,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function rimMaterial(color, intensity = 2.6) {
  return new THREE.ShaderMaterial({
    uniforms: { tint: { value: new THREE.Color(color) }, strength: { value: intensity } },
    vertexShader: `varying vec3 vNormal; varying vec3 vEye;
      void main() { vec4 p = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal); vEye = -p.xyz;
        gl_Position = projectionMatrix * p; }`,
    fragmentShader: `uniform vec3 tint; uniform float strength;
      varying vec3 vNormal; varying vec3 vEye;
      void main() { float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vEye))), 3.0);
        gl_FragColor = vec4(tint * strength * rim, rim * .87); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

/** A bounded, straight three-lane course. Decorative ring holes never interrupt the road. */
export function createSpaceScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, SPACE_SCENE_BUDGET.maxPixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#020714');
  scene.fog = new THREE.FogExp2('#04101e', .012);
  const camera = new THREE.PerspectiveCamera(58, 1, .08, 360);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 768), .68, .48, .84);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const trackedGeometry = new Set();
  const trackedMaterial = new Set();
  const geometry = value => (trackedGeometry.add(value), value);
  const material = value => (trackedMaterial.add(value), value);
  const box = geometry(new THREE.BoxGeometry(1, 1, 1));
  const dummy = new THREE.Object3D();
  const metal = material(new THREE.MeshStandardMaterial({ color: '#445665', metalness: .82, roughness: .29 }));
  const darkMetal = material(new THREE.MeshStandardMaterial({ color: '#101c2b', metalness: .72, roughness: .36 }));
  const cyan = material(new THREE.MeshBasicMaterial({ color: new THREE.Color(.07, 1.35, 2.1) }));
  const softCyan = material(new THREE.MeshBasicMaterial({ color: '#126780' }));
  const red = material(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, .095, .065) }));
  const gold = material(new THREE.MeshStandardMaterial({ color: '#fff2b7', emissive: '#ffaf19', emissiveIntensity: 1.7, metalness: .5, roughness: .22 }));
  scene.add(new THREE.HemisphereLight('#98cfff', '#0d1029', 1.5));
  const key = new THREE.DirectionalLight('#e3f4ff', 3.2);
  key.position.set(-7, 12, 5); scene.add(key);
  const fill = new THREE.DirectionalLight('#2374e1', 2.5);
  fill.position.set(8, 3, -15); scene.add(fill);

  // A tiny procedural studio supplies the long reflections across the metal panels.
  const studio = new THREE.Scene();
  studio.background = new THREE.Color('#203245');
  const studioGeometry = new THREE.PlaneGeometry(22, 14);
  const studioMaterials = [];
  for (const [color, x, y, z, rx, ry] of [
    ['#b3d8ee', 0, 9, 0, Math.PI / 2, 0],
    ['#477594', -10, 0, 0, 0, Math.PI / 2],
    ['#18324d', 10, 1, -3, 0, -Math.PI / 2],
  ]) {
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    studioMaterials.push(m);
    const p = new THREE.Mesh(studioGeometry, m);
    p.position.set(x, y, z); p.rotation.set(rx, ry, 0); studio.add(p);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(studio, .06, .1, 100);
  scene.environment = environment.texture;
  pmrem.dispose(); studioGeometry.dispose(); studioMaterials.forEach(m => m.dispose());

  function instances(geo, mat, count) {
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Repositioned pools use an explicit visibility window rather than stale instance bounds.
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  }
  function put(mesh, index, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) {
    dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz);
    dummy.rotation.set(rx, ry, rz); dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  }
  function flush(...meshes) { meshes.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; }); }

  const rings = instances(geometry(annulus(5.15, 4.22, .40)), metal, POOL);
  const innerRims = instances(geometry(new THREE.TorusGeometry(4.22, .025, 5, 96)), softCyan, POOL);
  const outerRims = instances(geometry(new THREE.TorusGeometry(5.16, .036, 5, 96)), darkMetal, POOL);
  const seams = instances(box, darkMetal, POOL * 24);
  const bridgeMaterial = material(new THREE.MeshStandardMaterial({
    color: '#105166', emissive: '#043347', emissiveIntensity: .55, metalness: .76, roughness: .27,
  }));
  const bridgeDecks = instances(box, bridgeMaterial, POOL * 3);
  const bridgeFrames = instances(box, metal, POOL * 2);
  const laneRails = instances(box, cyan, POOL * 4);
  const roadRibs = instances(box, softCyan, POOL * 6);
  const sidePods = instances(box, darkMetal, POOL * 4);
  const podLights = instances(box, red, POOL * 4);
  let firstSegment = null;
  function arrangeTrack(distance) {
    const first = Math.floor(distance / STEP) - 1;
    if (firstSegment === first) return;
    firstSegment = first;
    for (let slot = 0; slot < POOL; slot++) {
      const z = -(first + slot) * STEP;
      put(rings, slot, 0, -.48, z);
      put(innerRims, slot, 0, -.01, z, 1, 1, 1, 0, Math.PI / 2);
      put(outerRims, slot, 0, -.04, z, 1, 1, 1, 0, Math.PI / 2);
      for (let i = 0; i < 24; i++) {
        const a = i * TAU / 24;
        put(seams, slot * 24 + i, Math.cos(a) * 4.685, -.006, z + Math.sin(a) * 4.685, .86, .027, .034, -a);
      }
      for (let lane = 0; lane < 3; lane++) {
        put(bridgeDecks, slot * 3 + lane, LANES[lane], -.155, z - STEP / 2, 2.18, .30, STEP + .025);
      }
      [-3.37, 3.37].forEach((x, i) => put(bridgeFrames, slot * 2 + i, x, -.14, z - STEP / 2, .19, .32, STEP + .02));
      [-3.25, -1.1, 1.1, 3.25].forEach((x, i) => put(laneRails, slot * 4 + i, x, .019, z - STEP / 2, i === 0 || i === 3 ? .055 : .027, .024, STEP + .01));
      for (let i = 0; i < 6; i++) put(roadRibs, slot * 6 + i, 0, .003, z - i * 2, 6.43, .012, .022);
      [-1, 1].forEach((side, j) => {
        [-1.9, 1.9].forEach((off, k) => {
          const index = slot * 4 + j * 2 + k;
          put(sidePods, index, side * 4.44, .12, z + off, .77, .34, 1.18, -side * off * .04);
          put(podLights, index, side * 4.44, .30, z + off, .80, .027, 1.20, -side * off * .04);
        });
      });
    }
    flush(rings, innerRims, outerRims, seams, bridgeDecks, bridgeFrames, laneRails, roadRibs, sidePods, podLights);
  }

  // One draw call for each obstacle layer, irrespective of the number of gates.
  const barrierMaterial = material(new THREE.MeshStandardMaterial({ color: '#350e18', emissive: '#64101a', emissiveIntensity: .35, metalness: .5, roughness: .3 }));
  const barrierPattern = material(new THREE.ShaderMaterial({
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv;
      gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv;
      void main(){ vec2 p=vUv*vec2(8.0,6.0); p.x+=mod(floor(p.y),2.0)*.5;
        vec2 q=abs(fract(p)-.5); float cell=max(q.x*.866+q.y*.5,q.y);
        float grid=smoothstep(.36,.43,cell); float edge=pow(abs(vUv.x-.5)*2.0,8.0)+pow(abs(vUv.y-.5)*2.0,8.0);
        gl_FragColor=vec4(vec3(.38,.008,.018)+vec3(.7,.02,.004)*grid+vec3(.35,.018,.004)*edge,1.0); }`,
  }));
  const barrierCores = instances(box, barrierMaterial, SPACE_SCENE_BUDGET.barriers);
  const barrierEdges = instances(box, red, SPACE_SCENE_BUDGET.barriers * 4);
  const barrierFaces = instances(geometry(new THREE.PlaneGeometry(1.39, 1.10)), barrierPattern, SPACE_SCENE_BUDGET.barriers);
  const coinRings = instances(geometry(new THREE.TorusGeometry(.29, .055, 8, 20)), gold, SPACE_SCENE_BUDGET.pickups);
  const coinCenters = instances(geometry(new THREE.OctahedronGeometry(.115)), gold, SPACE_SCENE_BUDGET.pickups);
  let course = { length: 280, gates: [], coins: [] };
  let seenCoins = new Set();
  function arrangeObstacles(state) {
    let count = 0;
    for (const gate of course.gates || []) {
      const ahead = gate.distance - state.distance;
      if (ahead < -5 || ahead > FAR) continue;
      for (const lane of gate.blocked) {
        if (count >= SPACE_SCENE_BUDGET.barriers) break;
        const x = LANES[lane], z = -gate.distance;
        put(barrierCores, count, x, .625, z, 1.5, 1.25, .75);
        put(barrierFaces, count, x, .625, z + .379);
        put(barrierEdges, count * 4, x, .025, z + .393, 1.54, .051, .047);
        put(barrierEdges, count * 4 + 1, x, 1.225, z + .393, 1.54, .051, .047);
        put(barrierEdges, count * 4 + 2, x - .745, .625, z + .393, .048, 1.25, .047);
        put(barrierEdges, count * 4 + 3, x + .745, .625, z + .393, .048, 1.25, .047);
        count++;
      }
    }
    barrierCores.count = barrierFaces.count = count; barrierEdges.count = count * 4;
    let coins = 0;
    for (const coin of course.coins || []) {
      if (state.collected?.has(coin.id)) {
        if (!seenCoins.has(coin.id)) {
          seenCoins.add(coin.id);
          if (!state.calm) burst(LANES[coin.lane], .95, -coin.distance, 18, '#ffe875', 1.25);
        }
        continue;
      }
      const ahead = coin.distance - state.distance;
      if (ahead < -4 || ahead > FAR || coins >= SPACE_SCENE_BUDGET.pickups) continue;
      const turn = state.calm ? .2 : state.time * 1.25;
      put(coinRings, coins, LANES[coin.lane], .95, -coin.distance, 1, 1, 1, turn);
      put(coinCenters, coins, LANES[coin.lane], .95, -coin.distance, 1, 1, 1, -turn, 0, .25);
      coins++;
    }
    coinRings.count = coinCenters.count = coins;
    flush(barrierCores, barrierFaces, barrierEdges, coinRings, coinCenters);
  }

  const ball = new THREE.Group(); scene.add(ball);
  const rolling = new THREE.Group(); ball.add(rolling);
  const ballMaterial = material(new THREE.MeshPhysicalMaterial({
    color: '#569d16', emissive: '#2e5906', emissiveIntensity: .52,
    metalness: .4, roughness: .19, clearcoat: 1, clearcoatRoughness: .08,
  }));
  const sphere = geometry(new THREE.SphereGeometry(.62, 40, 28));
  rolling.add(new THREE.Mesh(sphere, ballMaterial));
  const ballStripe = material(new THREE.MeshStandardMaterial({ color: '#a1f249', emissive: '#53e909', emissiveIntensity: 1.0, metalness: .45, roughness: .2 }));
  const stripeGeo = geometry(new THREE.TorusGeometry(.621, .009, 5, 64));
  for (const rotation of [[0, 0, 0], [0, Math.PI / 2, .35]]) {
    const stripe = new THREE.Mesh(stripeGeo, ballStripe); stripe.rotation.set(...rotation); rolling.add(stripe);
  }
  const glowMaterial = material(rimMaterial('#8bff20', 3.1));
  const glow = new THREE.Mesh(sphere, glowMaterial); glow.scale.setScalar(1.025); ball.add(glow);
  const lamp = new THREE.PointLight('#91ff37', 7, 6, 2); lamp.position.set(0, .7, 0); ball.add(lamp);
  const floorGlowMat = material(new THREE.ShaderMaterial({
    uniforms: { tint: { value: new THREE.Color('#80ff22') }, opacity: { value: .56 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec2 vUv; uniform vec3 tint; uniform float opacity; void main(){float r=length(vUv-.5)*2.0; float a=pow(max(0.0,1.0-r),2.0)*opacity; gl_FragColor=vec4(tint*1.3,a);}',
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  }));
  const floorGlow = new THREE.Mesh(geometry(new THREE.PlaneGeometry(3.0, 3.0)), floorGlowMat);
  floorGlow.rotation.x = -Math.PI / 2; scene.add(floorGlow);
  const trailMaterial = material(new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec2 vUv;void main(){float line=pow(max(0.0,1.0-abs(vUv.x-.5)*2.0),2.0);gl_FragColor=vec4(.4,1.7,.025,line*vUv.y*.62);}',
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  const trails = [-.22, .22].map(x => {
    const mesh = new THREE.Mesh(geometry(new THREE.PlaneGeometry(.16, 2.8)), trailMaterial);
    mesh.rotation.x = -Math.PI / 2; mesh.userData.offset = x; scene.add(mesh); return mesh;
  });

  const sky = new THREE.Group(); scene.add(sky);
  const nebulaMaterial = material(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec3 vP;
      float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
        mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){vec3 d=normalize(vP);vec3 p=d*5.0;float n=noise(p)*.55+noise(p*2.1)*.28+noise(p*4.2)*.12;
        float band=exp(-pow((d.x*.75+d.y*.48+.06)*3.8,2.0));
        vec3 color=vec3(.002,.008,.019)+band*pow(n,2.7)*vec3(.09,.17,.31);
        color+=pow(n,4.0)*vec3(.065,.018,.09);gl_FragColor=vec4(color,1.0); }`,
  }));
  const nebula = new THREE.Mesh(geometry(new THREE.SphereGeometry(260, 32, 18)), nebulaMaterial);
  nebula.renderOrder = -10; sky.add(nebula);
  const random = randomGenerator();
  const starsGeo = geometry(new THREE.BufferGeometry());
  const starPositions = [], starColors = [];
  for (let i = 0; i < 1450; i++) {
    const az = random() * TAU, yy = random() * 2 - 1, rr = Math.sqrt(1 - yy * yy), radius = 170 + random() * 55;
    starPositions.push(Math.cos(az) * rr * radius, yy * radius, Math.sin(az) * rr * radius);
    const intensity = .35 + random() * .7;
    starColors.push(intensity * .73, intensity * .88, intensity);
  }
  starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  starsGeo.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
  const starMaterial = material(new THREE.PointsMaterial({ size: .32, vertexColors: true, transparent: true, opacity: .8, depthWrite: false, fog: false, sizeAttenuation: true }));
  sky.add(new THREE.Points(starsGeo, starMaterial));
  const planet = new THREE.Group(); planet.position.set(-48, 21, -132); sky.add(planet);
  const planetGeo = geometry(new THREE.SphereGeometry(33, 48, 32));
  const planetMaterial = material(new THREE.MeshStandardMaterial({ color: '#183445', roughness: .85, metalness: .06, fog: false }));
  planet.add(new THREE.Mesh(planetGeo, planetMaterial));
  const atmosphere = new THREE.Mesh(planetGeo, material(rimMaterial('#35baff', 1.9)));
  atmosphere.scale.setScalar(1.016); planet.add(atmosphere);
  const planetBand = new THREE.Mesh(geometry(new THREE.TorusGeometry(35.7, .055, 5, 100)), softCyan);
  planetBand.rotation.set(.2, .8, -.35); planet.add(planetBand);

  const rockGeo = geometry(new THREE.IcosahedronGeometry(1, 1));
  const rockPositions = rockGeo.getAttribute('position');
  // Deterministic rough rock silhouettes rather than hundreds of individual meshes.
  for (let i = 0; i < rockPositions.count; i++) {
    const x = rockPositions.getX(i), y = rockPositions.getY(i), z = rockPositions.getZ(i);
    const rough = 1 + Math.sin(x * 12.13 + y * 7.63 + z * 9.31) * .14;
    rockPositions.setXYZ(i, x * rough, y * rough, z * rough);
  }
  rockGeo.computeVertexNormals();
  const rocks = instances(rockGeo, material(new THREE.MeshStandardMaterial({ color: '#344252', roughness: .96, metalness: .09 })), SPACE_SCENE_BUDGET.asteroids);
  const asteroidSpecs = Array.from({ length: SPACE_SCENE_BUDGET.asteroids }, () => ({
    x: (random() < .5 ? -1 : 1) * (8 + random() * 32),
    y: -10 + random() * 33,
    along: random() * 148,
    size: .15 + Math.pow(random(), 2) * 2.1,
    rx: random() * TAU, ry: random() * TAU,
  }));
  function arrangeAsteroids(distance) {
    asteroidSpecs.forEach((s, i) => {
      const ahead = ((s.along - distance) % 148 + 148) % 148 - 12;
      put(rocks, i, s.x, s.y, -distance - ahead, s.size * 1.3, s.size, s.size * .85, s.ry, s.rx);
    });
    flush(rocks);
  }

  const finish = new THREE.Group(); scene.add(finish);
  const finishRimMaterial = material(new THREE.MeshBasicMaterial({ color: new THREE.Color(.12, 1.3, 1.85) }));
  const finishRing = new THREE.Mesh(geometry(new THREE.TorusGeometry(4.25, .14, 10, 80)), metal);
  finishRing.position.y = 3.8; finish.add(finishRing);
  const finishRim = new THREE.Mesh(geometry(new THREE.TorusGeometry(4.07, .045, 6, 80)), finishRimMaterial);
  finishRim.position.y = 3.8; finish.add(finishRim);
  const finishLine = new THREE.Mesh(box, cyan); finishLine.scale.set(6.5, .04, .6); finishLine.position.y = .025; finish.add(finishLine);

  const MAX_PARTICLES = SPACE_SCENE_BUDGET.particles;
  const particleGeo = geometry(new THREE.BufferGeometry());
  const particlePositions = new Float32Array(MAX_PARTICLES * 3);
  const particleColors = new Float32Array(MAX_PARTICLES * 3);
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3).setUsage(THREE.DynamicDrawUsage));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3).setUsage(THREE.DynamicDrawUsage));
  const particleMaterial = material(new THREE.PointsMaterial({ size: .09, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const particleCloud = new THREE.Points(particleGeo, particleMaterial); particleCloud.frustumCulled = false; scene.add(particleCloud);
  const particles = [];
  function burst(x, y, z, count, color, speed = 1) {
    const tint = new THREE.Color(color);
    for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
      const a = random() * TAU, v = (.5 + random()) * speed;
      particles.push({ x, y, z, vx: Math.cos(a) * v, vy: (random() * 2 + .7) * speed, vz: Math.sin(a) * v,
        life: 0, duration: .45 + random() * .45, color: tint });
    }
  }
  function animateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life += dt;
      if (p.life > p.duration) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= dt * 3;
    }
    particles.forEach((p, i) => {
      const fade = 1 - p.life / p.duration;
      particlePositions.set([p.x, p.y, p.z], i * 3);
      particleColors.set([p.color.r * fade * 2, p.color.g * fade * 2, p.color.b * fade * 2], i * 3);
    });
    particleGeo.setDrawRange(0, particles.length);
    particleGeo.attributes.position.needsUpdate = particleGeo.attributes.color.needsUpdate = true;
  }

  let cameraZ = 5.0, cameraY = 3.4;
  let previousPhase = null;
  let disposed = false;
  function resize() {
    if (disposed) return;
    const width = Math.max(1, canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, canvas.clientHeight || window.innerHeight);
    const framing = spaceCameraFraming(width, height);
    camera.aspect = framing.aspect;
    camera.fov = framing.fov;
    // Fixed orientation and the closest fit that keeps all three lanes visible.
    cameraZ = framing.z; cameraY = framing.y;
    camera.rotation.set(framing.rotationX, 0, 0);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
  }
  function setCourse(next) {
    course = next || { length: 280, gates: [], coins: [] };
    seenCoins = new Set(); particles.length = 0; previousPhase = null; firstSegment = null;
    finish.position.z = -(course.length || 280);
    finishRimMaterial.color.setRGB(.12, 1.3, 1.85);
  }
  function update(state, delta = 0) {
    if (disposed || !state) return;
    const dt = Math.min(.05, Math.max(0, Number.isFinite(delta) ? delta : 0));
    const distance = Number.isFinite(state.distance) ? state.distance : 0;
    const x = Number.isFinite(state.x) ? state.x : LANES[state.lane ?? 1];
    const time = Number.isFinite(state.time) ? state.time : 0;
    const normalized = { ...state, distance, time };
    const shiftProgress = state.shift ? Math.min(1, state.shift.elapsed / (state.shift.duration || .24)) : 0;
    const lift = state.calm ? 0 : Math.sin(shiftProgress * Math.PI) * .13;
    ball.position.set(x, .66 + lift, -distance);
    rolling.rotation.x = -distance / .62;
    rolling.rotation.z = -x * .11;
    glowMaterial.uniforms.strength.value = state.calm ? 2.8 : 3.0 + Math.sin(time * 2.7) * .15;
    floorGlow.position.set(x, .025, -distance);
    trails.forEach(mesh => {
      mesh.position.set(x + mesh.userData.offset, .035, -distance + 1.7);
      mesh.visible = state.phase === 'running' && !state.calm;
    });
    camera.position.set(0, cameraY, -distance + cameraZ);
    sky.position.z = -distance;
    arrangeTrack(distance); arrangeAsteroids(distance); arrangeObstacles(normalized);
    const remaining = (course.length || 280) - distance;
    finish.visible = remaining < FAR && remaining > -20;
    if (state.phase !== previousPhase) {
      if (state.phase === 'won' || state.phase === 'finished') {
        if (!state.calm) burst(x, 1.0, -distance, 100, '#a9ff3d', 3);
        finishRimMaterial.color.setRGB(.55, 2.1, .1);
      }
      if (!state.calm && (state.phase === 'lost' || state.phase === 'crashed')) burst(x, .9, -distance, 24, '#ff6645', 1.6);
      previousPhase = state.phase;
    }
    if (state.calm) particles.length = 0;
    animateParticles(state.phase === 'paused' ? 0 : dt);
    composer.render();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    trackedGeometry.forEach(g => g.dispose());
    trackedMaterial.forEach(m => m.dispose());
    scene.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
    environment.dispose();
    composer.passes.forEach(pass => pass.dispose?.());
    composer.dispose(); renderer.dispose();
  }
  resize();
  return { setCourse, update, resize, dispose };
}
