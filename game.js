const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xcad8ff, 0.0012);
scene.background = new THREE.Color(0x92c8ff);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 120000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const ambient = new THREE.HemisphereLight(0xddeeff, 0x40405a, 1.3);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.castShadow = true;
sun.shadow.camera.left = -1500;
sun.shadow.camera.right = 1500;
sun.shadow.camera.top = 1500;
sun.shadow.camera.bottom = -1500;
sun.shadow.mapSize.set(2048, 2048);
sun.position.set(300, 800, 450);
scene.add(sun);

const mapWidth = 22000;
const mapHeight = 38000;
const cityMinX = -mapWidth / 2;
const cityMaxX = mapWidth / 2;
const cityMinZ = -mapHeight / 2;
const cityMaxZ = mapHeight / 2;
const roadWidth = 22;
const roadClear = roadWidth + 8;
const avenueSpacing = 1000;
const streetSpacing = 1000;

const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x2f3c4d, roughness: 0.85, metalness: 0.06 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(mapWidth, mapHeight), groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
scene.add(ground);

const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x22272f, metalness: 0.15, roughness: 0.7 });
const lineMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f4bf, emissive: 0x494900 });
const boundaryMaterial = new THREE.MeshStandardMaterial({ color: 0x44526a, roughness: 0.75, metalness: 0.15 });
const carBodyMaterials = [
  new THREE.MeshStandardMaterial({ color: 0xff5f4c, metalness: 0.3, roughness: 0.4 }),
  new THREE.MeshStandardMaterial({ color: 0x4c8cff, metalness: 0.3, roughness: 0.4 }),
  new THREE.MeshStandardMaterial({ color: 0x76ff64, metalness: 0.3, roughness: 0.4 })
];

const collidableMeshes = [];
const trafficVehicles = [];
const policeVehicles = [];
const trafficLights = [];
const storeZones = [];
const cargoZones = [];
const safehouses = [];
const subwayStations = [];
const subwayTrains = [];
const billboards = [];
const spikeStrips = [];
const landmarks = [];
const pedestrians = [];
const npcCharacters = [];
const missionMarkers = [];
const avenuePositions = [];
const streetPositions = [];
let routeLine = null;
let routeUpdateTimer = 0;
let cityBlocks = [];
let heatMapFade = 0;
let currentScore = 0;
const maxHighScores = 5;
const highScores = JSON.parse(localStorage.getItem('drivingHighScores') || '[]');
const avenueNames = ['12th Ave','11th Ave','10th Ave','9th Ave','8th Ave','7th Ave','6th Ave','5th Ave','Broadway','Madison Ave','Park Ave','Lexington Ave','3rd Ave','2nd Ave','1st Ave','Avenue A','Avenue B','Avenue C','Avenue D','Avenue E','Avenue F','Avenue G'];
const streetNames = Array.from({ length: 45 }, (_, i) => `${i + 1}${i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'} St`);

const playerData = {
  money: 1500,
  heat: 0,
  health: 100,
  reputation: 28,
  faction: 'City Rider',
  factionTier: null,
  upgrades: {
    acceleration: 0,
    topSpeed: 0,
    armor: 0
  },
  paintColor: 0xff5f4c,
  carIndex: 0,
  cars: [
    { name: 'Runner', maxSpeed: 3.5, accel: 0.035, handling: 0.03, color: 0xff5f4c, price: 0 },
    { name: 'Interceptor', maxSpeed: 3.1, accel: 0.04, handling: 0.035, color: 0x4c8cff, price: 2400 },
    { name: 'Classic', maxSpeed: 2.9, accel: 0.032, handling: 0.028, color: 0x76ff64, price: 1800 }
  ]
};

const missionData = {
  activeIndex: 0,
  jailBreakActive: false,
  jailBreakTimer: 0,
  missions: [
    { title: 'Rookie Robber', description: 'Rob 3 different stores.', type: 'robStores', goal: 3, progress: 0, reward: 700, complete: false, targetName: 'Store raids' },
    { title: 'Smooth Escape', description: 'Avoid police hits for 60 seconds.', type: 'evadeTime', targetTime: 60, progress: 0, reward: 900, complete: false, targetName: 'Clean escape' },
    { title: 'Cargo Run', description: 'Pickup cargo and deliver it safely.', type: 'cargoDelivery', pickupIndex: 0, dropIndex: 1, cargoPicked: false, progress: 0, reward: 1000, complete: false, targetName: 'Cargo delivery' },
    { title: 'Safehouse Retreat', description: 'Reach a safehouse and hide out.', type: 'safeHouse', targetIndex: 0, progress: 0, reward: 650, complete: false, targetName: 'Safe hiding' },
    { title: 'Jail Break', description: 'After arrest, escape to a safehouse.', type: 'jailBreak', targetIndex: 1, progress: 0, reward: 1200, complete: false, targetName: 'Jail escape' },
    { title: 'Landmark Tour', description: 'Visit a famous city landmark.', type: 'visitLandmark', targetIndex: 0, progress: 0, reward: 650, complete: false, targetName: 'Landmark check-in' }
  ],
  checkpoint: null
};

const shopItems = [
  { id: 'acceleration', label: 'Engine upgrade', cost: 600, value: 0.008, text: '+ acceleration' },
  { id: 'topSpeed', label: 'Top speed upgrade', cost: 650, value: 0.35, text: '+ top speed' },
  { id: 'armor', label: 'Armor plating', cost: 500, value: 0.12, text: '+ collision resistance' },
  { id: 'paint-crimson', label: 'Crimson Paint', cost: 420, color: 0xff5f4c, text: 'New car color' },
  { id: 'paint-ice', label: 'Ice Blue Paint', cost: 520, color: 0x4c8cff, text: 'New car color' },
  { id: 'paint-emerald', label: 'Emerald Paint', cost: 480, color: 0x76ff64, text: 'New car color' }
];

const heatConfig = { max: 100, decayRate: 4 };
const reputationTiers = [
  { min: 0, name: 'City Rider', moneyMult: 1, heatDecay: 4, speedBoost: 0, discount: 0, bonus: 'No bonus' },
  { min: 25, name: 'Street Scholar', moneyMult: 1.05, heatDecay: 4.3, speedBoost: 0.05, discount: 0.02, bonus: '+5% speed, +5% payouts' },
  { min: 50, name: 'Shadow Runner', moneyMult: 1.1, heatDecay: 4.7, speedBoost: 0.1, discount: 0.05, bonus: '+10% speed, +10% payouts' },
  { min: 75, name: 'Kingpin', moneyMult: 1.15, heatDecay: 5.2, speedBoost: 0.15, discount: 0.1, bonus: '+15% speed, +15% payouts' },
  { min: 90, name: 'Urban Legend', moneyMult: 1.2, heatDecay: 5.8, speedBoost: 0.2, discount: 0.15, bonus: 'Free paint, +20% speed, +20% payouts' }
];
const wantedData = { stars: 0, timer: 0, lastHitTime: 0 };
const policeState = { hits: 0, caught: false, lastHitTime: 0, caughtStart: 0, releaseDelay: 8 };
const redLightViolation = { count: 0, lastLight: null };
const robberyState = { zone: null, timer: 0 };
const routeMaterial = new THREE.LineBasicMaterial({ color: 0x00ffcb, transparent: true, opacity: 0.88 });
let dayTime = 540;
let rainActive = false;
let rainParticles;

const lightStates = [
  { name: 'green', color: 0x00ff00, duration: 15 },
  { name: 'yellow', color: 0xffd700, duration: 3 },
  { name: 'red', color: 0xff0000, duration: 15 }
];

const audioContext = window.AudioContext ? new window.AudioContext() : null;
let sirenOscillator = null;
let enginePlaying = false;

function playTone(frequency, duration, type = 'sine', volume = 0.12) {
  if (!audioContext) return;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start();
  osc.stop(audioContext.currentTime + duration);
}

function startSiren() {
  if (!audioContext || sirenOscillator) return;
  sirenOscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  gain.gain.value = 0.06;
  sirenOscillator.type = 'sine';
  sirenOscillator.frequency.setValueAtTime(700, audioContext.currentTime);
  sirenOscillator.connect(gain);
  gain.connect(audioContext.destination);
  sirenOscillator.start();
  let toggle = true;
  const sirenInterval = setInterval(() => {
    if (!sirenOscillator) return clearInterval(sirenInterval);
    sirenOscillator.frequency.setValueAtTime(toggle ? 950 : 700, audioContext.currentTime);
    toggle = !toggle;
  }, 220);
}

function stopSiren() {
  if (!sirenOscillator) return;
  sirenOscillator.stop();
  sirenOscillator.disconnect();
  sirenOscillator = null;
}

function playEngineBeep() {
  if (!audioContext || enginePlaying) return;
  enginePlaying = true;
  playTone(120, 0.07, 'triangle', 0.08);
  setTimeout(() => { enginePlaying = false; }, 90);
}

function playCrashSound() {
  playTone(120, 0.08, 'square', 0.16);
  playTone(220, 0.15, 'sawtooth', 0.08);
}

function createTrafficLight(x, z, rotation, axis, initialState = 0) {
  const light = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 8, 12), new THREE.MeshStandardMaterial({ color: 0x22272f, metalness: 0.2, roughness: 0.8 }));
  pole.position.y = 4;
  light.add(pole);
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.4, 1.2), new THREE.MeshStandardMaterial({ color: 0x101820, metalness: 0.2, roughness: 0.8 }));
  box.position.y = 6.3;
  light.add(box);
  const lights = {
    red: new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0x000000, emissiveIntensity: 0 })),
    yellow: new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x000000, emissiveIntensity: 0 })),
    green: new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x000000, emissiveIntensity: 0 }))
  };
  lights.red.position.set(0.2, 7.3, 0.7);
  lights.yellow.position.set(0.2, 6.3, 0.7);
  lights.green.position.set(0.2, 5.3, 0.7);
  light.add(lights.red, lights.yellow, lights.green);
  light.position.set(x, 0, z);
  light.rotation.y = rotation;
  scene.add(light);
  trafficLights.push({ group: light, axis, stateIndex: initialState, timer: 0, lights });
  updateTrafficLightVisuals(trafficLights[trafficLights.length - 1]);
}

function updateTrafficLightVisuals(light) {
  light.lights.red.material.emissiveIntensity = light.stateIndex === 2 ? 1 : 0.08;
  light.lights.yellow.material.emissiveIntensity = light.stateIndex === 1 ? 1 : 0.08;
  light.lights.green.material.emissiveIntensity = light.stateIndex === 0 ? 1 : 0.08;
}

function createSafehouse(x, z, label) {
  const zone = new THREE.Mesh(new THREE.CircleGeometry(30, 32), new THREE.MeshStandardMaterial({ color: 0x35d97c, opacity: 0.15, transparent: true, side: THREE.DoubleSide }));
  zone.rotation.x = -Math.PI / 2;
  zone.position.set(x, 0.02, z);
  scene.add(zone);
  const house = new THREE.Mesh(new THREE.BoxGeometry(60, 22, 50), new THREE.MeshStandardMaterial({ color: 0x2f4b33, roughness: 0.65 }));
  house.position.set(x, 11, z);
  house.castShadow = true;
  scene.add(house);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(32, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }));
  sign.position.set(x, 22, z - 26);
  scene.add(sign);
  safehouses.push({ x, z, label, mesh: zone, sign, timer: 0 });
}

function createCargoZone(x, z, label, color) {
  const zone = new THREE.Mesh(new THREE.CircleGeometry(22, 32), new THREE.MeshStandardMaterial({ color, opacity: 0.2, transparent: true, side: THREE.DoubleSide }));
  zone.rotation.x = -Math.PI / 2;
  zone.position.set(x, 0.02, z);
  scene.add(zone);
  const crate = new THREE.Mesh(new THREE.BoxGeometry(16, 10, 16), new THREE.MeshStandardMaterial({ color: 0x8d5b2d, roughness: 0.7 }));
  crate.position.set(x, 5, z);
  scene.add(crate);
  cargoZones.push({ x, z, label, mesh: zone, radius: 22 });
}

function createBillboard(x, z, width, height, text) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 20, 12), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.25, roughness: 0.8 }));
  pole.position.set(x, 10, z);
  scene.add(pole);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveIntensity: 0.2, side: THREE.DoubleSide }));
  board.position.set(x, 18, z);
  board.rotation.y = Math.PI / 2;
  scene.add(board);
  billboards.push({ mesh: board });
}

function createSubwayStation(x, z) {
  const entrance = new THREE.Mesh(new THREE.BoxGeometry(36, 10, 26), new THREE.MeshStandardMaterial({ color: 0x444d5a, roughness: 0.7 }));
  entrance.position.set(x, 5, z);
  scene.add(entrance);
  const stairs = new THREE.Mesh(new THREE.BoxGeometry(24, 4, 16), new THREE.MeshStandardMaterial({ color: 0x1d262f, roughness: 0.85 }));
  stairs.position.set(x, 2, z - 5);
  scene.add(stairs);
  subwayStations.push({ x, z, mesh: entrance });
}

function createSpikeStrip(x, z, rotation) {
  const strip = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 6), new THREE.MeshStandardMaterial({ color: 0x1c1c1c, emissive: 0xff2b2b, emissiveIntensity: 0.14, metalness: 0.2, roughness: 0.8 }));
  strip.position.set(x, 0.2, z);
  strip.rotation.y = rotation;
  strip.userData.spike = true;
  scene.add(strip);
  collidableMeshes.push(strip);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshStandardMaterial({ color: 0xff4444, transparent: true, opacity: 0.18, side: THREE.DoubleSide }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(x, 0.21, z);
  scene.add(glow);
  spikeStrips.push({ mesh: strip, active: true, glow, pulse: Math.random() * Math.PI * 2 });
}

function createSubwayTrack(route, color) {
  const points = route.map((point) => new THREE.Vector3(point.x, 0.16, point.z));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const track = new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({ color, opacity: 0.6, transparent: true, linewidth: 2 }));
  scene.add(track);
}

function createSubwayTrain(route, speed, color) {
  const train = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(6, 1.4, 10), new THREE.MeshStandardMaterial({ color, emissive: 0x4cd1ff, emissiveIntensity: 0.24, roughness: 0.35 }));
  body.position.y = 0.75;
  train.add(body);
  const headlightLeft = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9 }));
  headlightLeft.position.set(-1.4, 0.7, 5.2);
  const headlightRight = headlightLeft.clone();
  headlightRight.position.set(1.4, 0.7, 5.2);
  train.add(headlightLeft, headlightRight);
  train.position.set(route[0].x, 0, route[0].z);
  scene.add(train);
  subwayTrains.push({ mesh: train, route, routeIndex: 0, speed, progress: 0 });
}

function updateSubwayTrains(delta) {
  for (const train of subwayTrains) {
    const route = train.route;
    if (route.length < 2) continue;
    const current = route[train.routeIndex];
    const nextIndex = (train.routeIndex + 1) % route.length;
    const next = route[nextIndex];
    const direction = new THREE.Vector3(next.x - current.x, 0, next.z - current.z).normalize();
    const move = direction.clone().multiplyScalar(train.speed * delta * 28);
    train.mesh.position.add(move);
    train.mesh.lookAt(next.x, 0.75, next.z);
    if (train.mesh.position.distanceTo(new THREE.Vector3(next.x, 0, next.z)) < 14) {
      train.routeIndex = nextIndex;
    }
  }
}

function updateSpikeStrips(delta) {
  for (const strip of spikeStrips) {
    strip.pulse += delta * 3;
    const glowValue = 0.18 + Math.abs(Math.sin(strip.pulse)) * 0.18;
    strip.glow.material.opacity = glowValue;
    strip.mesh.material.emissiveIntensity = 0.14 + Math.abs(Math.sin(strip.pulse * 1.2)) * 0.16;
  }
}

function getFactionTier(reputation) {
  return reputationTiers.slice().reverse().find((tier) => reputation >= tier.min) || reputationTiers[0];
}

function checkFactionTierUpdate() {
  const tier = getFactionTier(playerData.reputation);
  if (!playerData.factionTier || playerData.factionTier.name !== tier.name) {
    playerData.factionTier = tier;
    playerData.faction = tier.name;
    setActivityStatus(`Reputation tier reached: ${tier.name}. ${tier.bonus}`);
  }
}

function getEffectiveItemCost(item) {
  if (!item) return Infinity;
  if (item.id.startsWith('paint-') && playerData.factionTier?.min >= 90) return 0;
  return Math.round(item.cost * (1 - (playerData.factionTier?.discount ?? 0)));
}

function applyFactionBonuses(value) {
  if (!playerData.factionTier) return value;
  return Math.round(value * playerData.factionTier.moneyMult);
}

function getCurrentFactionBonus() {
  return playerData.factionTier?.bonus || 'No bonus';
}

function getCurrentFactionSpeedBoost() {
  return playerData.factionTier?.speedBoost || 0;
}

function getCurrentFactionHeatDecay() {
  return playerData.factionTier?.heatDecay ?? heatConfig.decayRate;
}

function getCurrentFactionDiscount() {
  return playerData.factionTier?.discount || 0;
}

function getEffectiveSpeed(baseSpeed) {
  return baseSpeed + getCurrentFactionSpeedBoost();
}

function updateFactionDisplay() {
  tierValue.textContent = getCurrentFactionBonus();
}

function getMissionRewardWithFaction(mission) {
  return applyFactionBonuses(mission.reward);
}

function getRewardText(mission) {
  const total = getMissionRewardWithFaction(mission);
  return total === mission.reward ? `$${total}` : `$${total} (+${Math.round((playerData.factionTier?.moneyMult - 1) * 100)}% bonus)`;
}

function getPaintCostLabel(item) {
  const cost = getEffectiveItemCost(item);
  return cost === 0 ? 'Free' : `$${cost}`;
}

function getShoppedCost(item) {
  return getEffectiveItemCost(item);
}

function spawnCrashParticles(x, y, z) {
  for (let i = 0; i < 12; i += 1) {
    const particle = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), new THREE.MeshStandardMaterial({ color: 0x9e9e9e, transparent: true, opacity: 0.7 }));
    particle.position.set(x, y, z);
    particle.userData = { life: 0.8, velocity: new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2) };
    scene.add(particle);
    particles.push(particle);
  }
}

function updateParticles(delta) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const part = particles[i];
    part.userData.life -= delta;
    if (part.userData.life <= 0) {
      scene.remove(part);
      particles.splice(i, 1);
      continue;
    }
    part.position.add(part.userData.velocity.clone().multiplyScalar(delta * 10));
    part.material.opacity = Math.max(0, part.userData.life / 0.8);
    part.position.y -= delta * 1.5;
  }
}

function getNearestIntersection(x, z) {
  const ax = THREE.MathUtils.clamp(Math.round((x - cityMinX) / avenueSpacing), 0, avenuePositions.length - 1);
  const sz = THREE.MathUtils.clamp(Math.round((z - cityMinZ) / streetSpacing), 0, streetPositions.length - 1);
  return { ax, sz };
}

function getIntersectionPosition(node) {
  return { x: avenuePositions[node.ax], z: streetPositions[node.sz] };
}

function findPathOnGrid(startX, startZ, endX, endZ) {
  const start = getNearestIntersection(startX, startZ);
  const end = getNearestIntersection(endX, endZ);
  const startKey = `${start.ax},${start.sz}`;
  const endKey = `${end.ax},${end.sz}`;
  if (startKey === endKey) return [{ x: avenuePositions[start.ax], z: streetPositions[start.sz] }];
  const openSet = [startKey];
  const cameFrom = {};
  const gScore = { [startKey]: 0 };
  const fScore = { [startKey]: Math.abs(end.ax - start.ax) + Math.abs(end.sz - start.sz) };
  const keyToNode = (key) => {
    const [ax, sz] = key.split(',').map(Number);
    return { ax, sz };
  };
  const neighbors = (node) => {
    const result = [];
    if (node.ax > 0) result.push({ ax: node.ax - 1, sz: node.sz });
    if (node.ax < avenuePositions.length - 1) result.push({ ax: node.ax + 1, sz: node.sz });
    if (node.sz > 0) result.push({ ax: node.ax, sz: node.sz - 1 });
    if (node.sz < streetPositions.length - 1) result.push({ ax: node.ax, sz: node.sz + 1 });
    return result;
  };
  while (openSet.length > 0) {
    openSet.sort((a, b) => fScore[a] - fScore[b]);
    const currentKey = openSet.shift();
    if (currentKey === endKey) {
      const path = [];
      let nodeKey = currentKey;
      while (nodeKey) {
        path.unshift(getIntersectionPosition(keyToNode(nodeKey)));
        nodeKey = cameFrom[nodeKey];
      }
      return path;
    }
    const current = keyToNode(currentKey);
    for (const neighbor of neighbors(current)) {
      const neighborKey = `${neighbor.ax},${neighbor.sz}`;
      const tentativeG = gScore[currentKey] + 1;
      if (tentativeG < (gScore[neighborKey] ?? Infinity)) {
        cameFrom[neighborKey] = currentKey;
        gScore[neighborKey] = tentativeG;
        fScore[neighborKey] = tentativeG + Math.abs(end.ax - neighbor.ax) + Math.abs(end.sz - neighbor.sz);
        if (!openSet.includes(neighborKey)) openSet.push(neighborKey);
      }
    }
  }
  return [{ x: avenuePositions[start.ax], z: streetPositions[start.sz] }, { x: avenuePositions[end.ax], z: streetPositions[end.sz] }];
}

function getMissionRouteTarget() {
  const mission = missionData.missions[missionData.activeIndex];
  if (mission.type === 'visitLandmark') {
    return landmarks[mission.targetIndex] || null;
  }
  if (mission.type === 'robStores') {
    const nearestStore = storeZones.filter((zone) => !zone.robbed).reduce((best, zone) => {
      const distance = Math.hypot(car.position.x - zone.x, car.position.z - zone.z);
      return !best || distance < best.distance ? { zone, distance } : best;
    }, null);
    return nearestStore ? { x: nearestStore.zone.x, z: nearestStore.zone.z } : null;
  }
  if (mission.type === 'cargoDelivery') {
    if (!mission.cargoPicked) {
      const pickup = cargoZones[mission.pickupIndex];
      return pickup ? { x: pickup.x, z: pickup.z } : null;
    }
    const drop = cargoZones[mission.dropIndex];
    return drop ? { x: drop.x, z: drop.z } : null;
  }
  if (mission.type === 'safeHouse' || mission.type === 'jailBreak') {
    const safehouse = safehouses[mission.targetIndex];
    return safehouse ? { x: safehouse.x, z: safehouse.z } : null;
  }
  return null;
}

function clearRouteLine() {
  if (routeLine) {
    scene.remove(routeLine);
    routeLine.geometry.dispose();
    routeLine = null;
  }
}

function generateGPSRoute() {
  const target = getMissionRouteTarget();
  if (!target) {
    clearRouteLine();
    return;
  }
  const path = findPathOnGrid(car.position.x, car.position.z, target.x, target.z);
  if (path.length < 2) {
    clearRouteLine();
    return;
  }
  const points = path.map((point) => new THREE.Vector3(point.x, 0.2, point.z));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  clearRouteLine();
  routeLine = new THREE.Line(geometry, routeMaterial);
  routeLine.layers.set(1);
  routeLine.renderOrder = 999;
  scene.add(routeLine);
}

function animateShopCard(card) {
  if (!card) return;
  card.classList.add('purchased');
  setTimeout(() => card.classList.remove('purchased'), 700);
}

function createStoreZone(x, z, radius, label) {
  const circle = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshStandardMaterial({ color: 0xffb84c, opacity: 0.22, transparent: true, side: THREE.DoubleSide }));
  circle.rotation.x = -Math.PI / 2;
  circle.position.set(x, 0.02, z);
  scene.add(circle);
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 1.6, radius - 0.8, 48), new THREE.MeshStandardMaterial({ color: 0xffd27d, emissive: 0xffa843, emissiveIntensity: 0.22, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.03, z);
  scene.add(ring);
  const store = new THREE.Mesh(new THREE.BoxGeometry(24, 14, 18), new THREE.MeshStandardMaterial({ color: 0xe8be8f, roughness: 0.7 }));
  store.position.set(x + radius * 0.75, 7, z - 4);
  scene.add(store);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 1), new THREE.MeshStandardMaterial({ color: 0xcc312a, emissive: 0xcc312a, emissiveIntensity: 0.35 }));
  sign.position.set(x + radius * 0.75, 12.5, z - 11);
  scene.add(sign);
  storeZones.push({ x, z, radius, label, robbed: false, cooldown: 0, mesh: circle });
}

function createLandmark(x, z, width, height, depth, color, name) {
  const base = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05 }));
  base.position.set(x, height / 2, z);
  base.castShadow = true;
  scene.add(base);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.8, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
  sign.position.set(x, height + 8, z);
  sign.rotation.y = Math.PI;
  scene.add(sign);
  landmarks.push({ x, z, name, mesh: base });
}

function createPedestrian(x, z, axis, rangeMin, rangeMax) {
  const person = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2, 1.2), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x5577ff, roughness: 0.8 }));
  person.position.set(x, 1, z);
  scene.add(person);
  pedestrians.push({ mesh: person, axis, min: rangeMin, max: rangeMax, direction: 1, speed: 0.65 + Math.random() * 0.4 });
}

function createSwipeRoadSurface(x, z, width, length, orientation = 'vertical') {
  const roadGeometry = orientation === 'vertical' ? new THREE.BoxGeometry(width, 0.1, length) : new THREE.BoxGeometry(length, 0.1, width);
  const road = new THREE.Mesh(roadGeometry, roadMaterial);
  road.position.set(x, 0.05, z);
  road.receiveShadow = true;
  scene.add(road);
  const lineGeometry = orientation === 'vertical' ? new THREE.BoxGeometry(width * 0.05, 0.11, length) : new THREE.BoxGeometry(length * 0.05, 0.11, width);
  const center = new THREE.Mesh(lineGeometry, lineMaterial);
  center.position.set(x, 0.06, z);
  scene.add(center);
  const boundaryOffset = width / 2 + 0.8;
  if (orientation === 'vertical') {
    const boundaryGeometry = new THREE.BoxGeometry(1.2, 0.7, length);
    const leftBoundary = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
    leftBoundary.position.set(x - boundaryOffset, 0.35, z);
    const rightBoundary = leftBoundary.clone();
    rightBoundary.position.set(x + boundaryOffset, 0.35, z);
    scene.add(leftBoundary, rightBoundary);
    collidableMeshes.push(leftBoundary, rightBoundary);
  } else {
    const boundaryGeometry = new THREE.BoxGeometry(length, 0.7, 1.2);
    const leftBoundary = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
    leftBoundary.position.set(x, 0.35, z - boundaryOffset);
    const rightBoundary = leftBoundary.clone();
    rightBoundary.position.set(x, 0.35, z + boundaryOffset);
    scene.add(leftBoundary, rightBoundary);
    collidableMeshes.push(leftBoundary, rightBoundary);
  }
}

function createCityRoads() {
  avenuePositions.length = 0;
  streetPositions.length = 0;
  cityBlocks.length = 0;
  for (let x = cityMinX + avenueSpacing / 2; x <= cityMaxX - avenueSpacing / 2 + 1; x += avenueSpacing) avenuePositions.push(x);
  for (let z = cityMinZ + streetSpacing / 2; z <= cityMaxZ - streetSpacing / 2 + 1; z += streetSpacing) streetPositions.push(z);
  for (const x of avenuePositions) createSwipeRoadSurface(x, 0, roadWidth, mapHeight, 'vertical');
  for (const z of streetPositions) createSwipeRoadSurface(0, z, mapWidth, roadWidth, 'horizontal');
  for (let i = 0; i < avenuePositions.length - 1; i += 1) {
    for (let j = 0; j < streetPositions.length - 1; j += 1) {
      cityBlocks.push({ xMin: avenuePositions[i] + roadClear, xMax: avenuePositions[i + 1] - roadClear, zMin: streetPositions[j] + roadClear, zMax: streetPositions[j + 1] - roadClear, avenue: i + 1, street: j + 1 });
    }
  }

  function createBuildingsInBlock(block) {
    const density = Math.random() * 0.28 + 0.55;
    const cols = Math.max(2, Math.floor((block.xMax - block.xMin) / 160));
    const rows = Math.max(2, Math.floor((block.zMax - block.zMin) / 160));
    for (let row = 0; row < cols; row += 1) {
      for (let col = 0; col < rows; col += 1) {
        if (Math.random() > density) continue;
        const width = THREE.MathUtils.randFloat(60, 160);
        const depth = THREE.MathUtils.randFloat(60, 160);
        const height = THREE.MathUtils.randFloat(18, 240);
        const x = THREE.MathUtils.lerp(block.xMin + width / 2 + 16, block.xMax - width / 2 - 16, (row + 0.5) / cols) + THREE.MathUtils.randFloatSpread(36);
        const z = THREE.MathUtils.lerp(block.zMin + depth / 2 + 16, block.zMax - depth / 2 - 16, (col + 0.5) / rows) + THREE.MathUtils.randFloatSpread(36);
        const color = new THREE.Color(`hsl(${THREE.MathUtils.randFloat(200, 260)}, 12%, ${THREE.MathUtils.randFloat(40, 60)}%)`);
        const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({ color, roughness: 0.68 }));
        building.position.set(x, height / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);
        collidableMeshes.push(building);
        const windows = new THREE.Mesh(new THREE.BoxGeometry(width * 0.96, height * 0.96, depth * 0.96), new THREE.MeshStandardMaterial({ color: 0x1a2330, transparent: true, opacity: 0.4, emissive: 0x223366, emissiveIntensity: 0.5 }));
        windows.position.copy(building.position);
        windows.position.y += 0.1;
        scene.add(windows);
      }
    }
  }

  for (const block of cityBlocks) createBuildingsInBlock(block);

  const neighborhoodCenters = [
    { x: -5200, z: -6800 }, { x: -5200, z: 6800 }, { x: 5200, z: -6800 }, { x: 5200, z: 6800 }
  ];
  for (const center of neighborhoodCenters) {
    createBillboard(center.x, center.z - 60, 16, 8, 'NEIGHBORHOOD');
    createSubwayStation(center.x + 80, center.z + 80);
  }

  const subwayRoutes = [
    [
      { x: -5200, z: -6800 },
      { x: -5200, z: 6800 },
      { x: 5200, z: 6800 },
      { x: 5200, z: -6800 }
    ],
    [
      { x: -3200, z: -5200 },
      { x: -3200, z: 5200 },
      { x: 3200, z: 5200 },
      { x: 3200, z: -5200 }
    ]
  ];

  for (const route of subwayRoutes) {
    createSubwayTrack(route, 0x55d4ff);
    createSubwayTrain(route, 1.4, 0x2a8fff);
  }

  createSafehouse(-4200, 3400, 'North Haven');
  createSafehouse(4200, -3200, 'East Hide');
  createSafehouse(-2600, -4200, 'Downtown Den');
  createSafehouse(2600, 4200, 'West Shelter');

  createCargoZone(-3000, 1800, 'Cargo Pick', 0x45d1ff);
  createCargoZone(2800, -2200, 'Cargo Drop', 0xff9f3b);
  createCargoZone(1600, 3600, 'Supply Load', 0x7a4dff);

  createSpikeStrip(0, -1200, 0);
  createSpikeStrip(0, 1200, 0);
  createSpikeStrip(-1200, 0, Math.PI / 2);
  createSpikeStrip(1200, 0, Math.PI / 2);

  const baseStoreNames = [
    'Broadway Market', 'Central Deli', 'Hudson Stop', 'Empire Goods', 'Brooklyn Barn',
    'Queens Corner', 'East Village Mart', 'Harlem Express', 'Battery Store', 'Times Square Shop',
    'Uptown Supplies', 'Downtown Depot', 'Village Goods', 'Bronx Bazaar', 'Staten Store',
    'Fifth Avenue', 'Chelsea Market', 'SoHo Mart', 'Union Square', 'Chinatown Shop',
    'Little Italy', 'Financial District', 'Murray Market', 'Riverside Goods', 'Parkside Mart'
  ];

  const storeNames = [];
  for (let i = 0; i < 75; i += 1) {
    const base = baseStoreNames[i % baseStoreNames.length];
    const tag = Math.floor(i / baseStoreNames.length) + 1;
    storeNames.push(tag === 1 ? base : `${base} ${tag}`);
  }

  function getRandomStorePosition() {
    const margin = 100;
    const minimumDistance = 220;
    let tries = 0;
    while (tries < 450) {
      const block = cityBlocks[Math.floor(Math.random() * cityBlocks.length)];
      const x = THREE.MathUtils.randFloat(block.xMin + margin, block.xMax - margin);
      const z = THREE.MathUtils.randFloat(block.zMin + margin, block.zMax - margin);
      if (!storeZones.some(zone => Math.hypot(zone.x - x, zone.z - z) < minimumDistance)) return { x, z };
      tries += 1;
    }
    const block = cityBlocks[Math.floor(Math.random() * cityBlocks.length)];
    return { x: THREE.MathUtils.randFloat(block.xMin + margin, block.xMax - margin), z: THREE.MathUtils.randFloat(block.zMin + margin, block.zMax - margin) };
  }

  for (let i = 0; i < storeNames.length; i += 1) {
    const { x, z } = getRandomStorePosition();
    createStoreZone(x, z, 32, storeNames[i]);
  }

  const landmarkData = [
    { x: 2200, z: 800, width: 140, height: 130, depth: 140, color: 0xffcc33, name: 'Grand Plaza' },
    { x: -2400, z: -1800, width: 180, height: 160, depth: 180, color: 0x33ccff, name: 'Riverside Tower' },
    { x: 1200, z: -3400, width: 120, height: 140, depth: 120, color: 0xff6677, name: 'City Museum' },
    { x: -1800, z: 3200, width: 160, height: 120, depth: 160, color: 0x78ff88, name: 'Transit Hall' },
    { x: 4200, z: 2200, width: 140, height: 100, depth: 140, color: 0xaf77ff, name: 'Skypark' }
  ];

  for (const item of landmarkData) createLandmark(item.x, item.z, item.width, item.height, item.depth, item.color, item.name);
  missionData.missions[5].targetIndex = 0;

  for (let i = 0; i < 30; i += 1) {
    const block = cityBlocks[Math.floor(Math.random() * cityBlocks.length)];
    const x = THREE.MathUtils.randFloat(block.xMin + 40, block.xMax - 40);
    const z = THREE.MathUtils.randFloat(block.zMin + 40, block.zMax - 40);
    const axis = Math.random() > 0.5 ? 'x' : 'z';
    createPedestrian(x, z, axis, block[axis + 'Min'], block[axis + 'Max']);
  }
}

function createTrafficVehicle(x, z, rotation, speed, axis, min, max, color) {
  const vehicle = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.1, 5.2), new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.45 }));
  body.position.y = 0.75;
  vehicle.add(body);
  function addWheel(offsetX, offsetZ) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.5, 16), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.25, roughness: 0.8 }));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(offsetX, 0.3, offsetZ);
    vehicle.add(wheel);
  }
  addWheel(-1.4, 2.2); addWheel(1.4, 2.2); addWheel(-1.4, -2.2); addWheel(1.4, -2.2);
  vehicle.position.set(x, 0, z);
  vehicle.rotation.y = rotation;
  vehicle.castShadow = true;
  scene.add(vehicle);
  trafficVehicles.push({ mesh: vehicle, direction: new THREE.Vector3(Math.sin(rotation), 0, Math.cos(rotation)).normalize(), speed, axis, min, max, directionScale: 1 });
}

function createPoliceVehicle(x, z, rotation, speed, route, color) {
  const vehicle = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.1, 5.2), new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.35 }));
  body.position.y = 0.75;
  vehicle.add(body);
  function addWheel(offsetX, offsetZ) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.5, 16), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.25, roughness: 0.8 }));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(offsetX, 0.3, offsetZ);
    vehicle.add(wheel);
  }
  addWheel(-1.4, 2.2); addWheel(1.4, 2.2); addWheel(-1.4, -2.2); addWheel(1.4, -2.2);
  const lightBar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.28, 1.2), new THREE.MeshStandardMaterial({ color: 0x66ddff, emissive: 0x66ddff, emissiveIntensity: 0.65 }));
  lightBar.position.set(0, 1.5, 0);
  vehicle.add(lightBar);
  vehicle.position.set(x, 0, z);
  vehicle.rotation.y = rotation;
  vehicle.castShadow = true;
  vehicle.userData = { police: true };
  scene.add(vehicle);
  collidableMeshes.push(vehicle);
  policeVehicles.push({ mesh: vehicle, route, speed, routeIndex: 0, chasing: false, direction: new THREE.Vector3(Math.sin(rotation), 0, Math.cos(rotation)).normalize(), path: [], pathIndex: 0, lastPathTime: 0, pathTargetKey: '' });
}

function isAnyPoliceChasing() {
  return policeVehicles.some((police) => police.chasing);
}

function updatePoliceStatusDisplay() {
  if (policeState.caught) {
    policeValue.textContent = 'Caught';
  } else if (isAnyPoliceChasing()) {
    policeValue.textContent = 'Pursuit';
  } else if (policeState.hits > 0) {
    policeValue.textContent = `${policeState.hits} hit${policeState.hits === 1 ? '' : 's'}`;
  } else {
    policeValue.textContent = 'Idle';
  }
}

function getRandomRespawnPosition() {
  const margin = 150;
  const block = cityBlocks[Math.floor(Math.random() * cityBlocks.length)];
  return {
    x: THREE.MathUtils.randFloat(block.xMin + margin, block.xMax - margin),
    z: THREE.MathUtils.randFloat(block.zMin + margin, block.zMax - margin)
  };
}

function resetAfterCaught() {
  setTimeout(() => {
    policeState.caught = false;
    policeState.hits = 0;
    policeState.caughtStart = 0;
    wantedData.stars = 0;
    wantedData.timer = 0;
    playerData.heat = 0;
    updateWantedDisplay();
    updatePoliceStatusDisplay();
    setActivityStatus('You have been released at a random location. Stay off the police radar.');
    playerData.health = 100;
    const respawn = getRandomRespawnPosition();
    car.position.set(respawn.x, 0, respawn.z);
    car.rotation.y = Math.random() * Math.PI * 2;
    state.speed = 0;
  }, policeState.releaseDelay * 1000);
}

function updatePolicePath(police) {
  const now = performance.now();
  const targetKey = `${Math.round(car.position.x)}:${Math.round(car.position.z)}`;
  if (police.path.length === 0 || police.pathTargetKey !== targetKey || now - police.lastPathTime > 1400) {
    police.path = findPathOnGrid(police.mesh.position.x, police.mesh.position.z, car.position.x, car.position.z);
    police.pathIndex = 0;
    police.lastPathTime = now;
    police.pathTargetKey = targetKey;
  }
}

function updatePoliceVehicles(delta) {
  const playerPosition = new THREE.Vector3(car.position.x, 0, car.position.z);
  for (const police of policeVehicles) {
    const position = police.mesh.position;
    const distanceToPlayer = position.distanceTo(playerPosition);
    const target = { x: position.x, z: position.z };
    if (wantedData.stars > 0 && !policeState.caught && distanceToPlayer < 3200) {
      police.chasing = true;
      updatePolicePath(police);
      if (police.path.length > 0) {
        if (police.pathIndex >= police.path.length) police.pathIndex = police.path.length - 1;
        const pathNode = police.path[police.pathIndex];
        if (Math.hypot(position.x - pathNode.x, position.z - pathNode.z) < 40 && police.pathIndex < police.path.length - 1) {
          police.pathIndex += 1;
        }
        const destination = police.path[police.pathIndex];
        target.x = destination.x;
        target.z = destination.z;
      } else {
        target.x = car.position.x;
        target.z = car.position.z;
      }
    } else {
      police.chasing = false;
      const routePoint = police.route[police.routeIndex];
      target.x = routePoint.x;
      target.z = routePoint.z;
      if (Math.hypot(position.x - target.x, position.z - target.z) < 40) police.routeIndex = (police.routeIndex + 1) % police.route.length;
    }
    const direction = new THREE.Vector3(target.x - position.x, 0, target.z - position.z).normalize();
    const speed = police.speed + (wantedData.stars * 0.45) + (police.chasing ? 0.5 : 0);
    police.mesh.position.add(direction.multiplyScalar(speed * delta * 18));
    police.mesh.rotation.y = Math.atan2(direction.x, direction.z);
  }
}

function createWaypoint(x, z) {
  missionMarkers.forEach((marker) => { scene.remove(marker.mesh); });
  missionMarkers.length = 0;
  const ring = new THREE.Mesh(new THREE.RingGeometry(12, 14, 32), new THREE.MeshStandardMaterial({ color: 0x00ffcb, emissive: 0x00ffcb, emissiveIntensity: 0.35, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.05, z);
  scene.add(ring);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(6, 12, 12), new THREE.MeshStandardMaterial({ color: 0x00ffcb, emissive: 0x00ffcb, emissiveIntensity: 0.25 }));
  arrow.position.set(x, 10, z);
  arrow.rotation.x = Math.PI;
  scene.add(arrow);
  missionMarkers.push({ mesh: ring });
  missionMarkers.push({ mesh: arrow });
}

function updateMissionDisplay() {
  const mission = missionData.missions[missionData.activeIndex];
  missionTitle.textContent = mission.title;
  missionDesc.textContent = mission.description;
  if (mission.type === 'robStores') {
    missionProgress.textContent = `${mission.progress}/${mission.goal} stores robbed`;
  } else if (mission.type === 'evadeTime') {
    missionProgress.textContent = `${Math.round(mission.progress)}/${mission.targetTime}s clean evasion`;
  } else if (mission.type === 'visitLandmark') {
    missionProgress.textContent = mission.complete ? 'Landmark reached!' : `Go to ${landmarks[mission.targetIndex].name}`;
  } else if (mission.type === 'cargoDelivery') {
    missionProgress.textContent = mission.cargoPicked ? 'Cargo picked up, deliver it now' : 'Drive to the cargo pickup point';
  } else if (mission.type === 'safeHouse') {
    missionProgress.textContent = mission.complete ? 'Safehouse secured!' : 'Reach a safehouse and wait to hide out';
  } else if (mission.type === 'jailBreak') {
    missionProgress.textContent = mission.complete ? 'Jail break successful!' : 'Escape to the safehouse after release';
  }
}

function activateMission(index) {
  missionData.activeIndex = index;
  const mission = missionData.missions[index];
  missionData.jailBreakActive = false;
  missionData.jailBreakTimer = 0;
  if (mission.type === 'visitLandmark') {
    const landmark = landmarks[mission.targetIndex];
    createWaypoint(landmark.x, landmark.z);
  } else if (mission.type === 'cargoDelivery') {
    const pickup = cargoZones[mission.pickupIndex];
    if (pickup) createWaypoint(pickup.x, pickup.z);
  } else if (mission.type === 'safeHouse' || mission.type === 'jailBreak') {
    const safehouse = safehouses[mission.targetIndex];
    if (safehouse) createWaypoint(safehouse.x, safehouse.z);
  } else {
    missionMarkers.forEach(marker => scene.remove(marker.mesh));
    missionMarkers.length = 0;
  }
  updateMissionDisplay();
  generateGPSRoute();
}

function completeMission() {
  const mission = missionData.missions[missionData.activeIndex];
  if (!mission.complete) {
    mission.complete = true;
    const reward = getMissionRewardWithFaction(mission);
    playerData.money += reward;
    playerData.heat = Math.max(0, playerData.heat - 8);
    playerData.reputation = Math.min(100, playerData.reputation + 6);
    setActivityStatus(`Mission complete! +${getRewardText(mission)}`);
    updateStatusDisplays();
    updateShop();
    mission.progress = mission.type === 'evadeTime' ? mission.targetTime : mission.progress;
    missionProgress.textContent = 'Mission complete!';
    if (mission.type === 'cargoDelivery') {
      setActivityStatus('Cargo delivered! Good job keeping it safe.');
    }
    setTimeout(() => {
      missionData.activeIndex = (missionData.activeIndex + 1) % missionData.missions.length;
      activateMission(missionData.activeIndex);
    }, 3500);
  }
}

function updateStatusDisplays() {
  checkFactionTierUpdate();
  moneyValue.textContent = `$${playerData.money}`;
  heatValue.textContent = `${Math.min(heatConfig.max, Math.round(playerData.heat))}`;
  healthValue.textContent = `${Math.max(0, Math.round(playerData.health))}%`;
  reputationValue.textContent = `${playerData.reputation} / 100`;
  factionValue.textContent = playerData.faction;
  updateFactionDisplay();
  updateWantedDisplay();
  updatePoliceStatusDisplay();
}

function updateArrestDisplay() {
  if (policeState.caught) {
    const elapsed = (performance.now() - policeState.caughtStart) / 1000;
    const remaining = Math.max(0, policeState.releaseDelay - elapsed);
    jailStatus.textContent = `Jail release in ${remaining.toFixed(1)}s`;
    arrestOverlay.classList.add('active');
  } else {
    jailStatus.textContent = '';
    arrestOverlay.classList.remove('active');
  }
}

function drawMinimapIcons() {
  if (!miniOverlayContext) return;
  miniOverlayContext.clearRect(0, 0, miniOverlayCanvas.width, miniOverlayCanvas.height);
  const scale = miniOverlayCanvas.width / 180;
  const heatAlpha = Math.min(0.42, playerData.heat / heatConfig.max * 0.42);
  if (heatAlpha > 0.02) {
    const gradient = miniOverlayContext.createRadialGradient(miniOverlayCanvas.width / 2, miniOverlayCanvas.height / 2, 10, miniOverlayCanvas.width / 2, miniOverlayCanvas.height / 2, miniOverlayCanvas.width / 2);
    gradient.addColorStop(0, `rgba(255, 40, 40, ${heatAlpha * 0.45})`);
    gradient.addColorStop(1, 'rgba(255, 40, 40, 0)');
    miniOverlayContext.fillStyle = gradient;
    miniOverlayContext.fillRect(0, 0, miniOverlayCanvas.width, miniOverlayCanvas.height);
  }
  for (const zone of cargoZones) {
    const dx = zone.x - car.position.x;
    const dz = zone.z - car.position.z;
    if (Math.abs(dx) > 90 || Math.abs(dz) > 90) continue;
    const x = miniOverlayCanvas.width / 2 + dx * scale;
    const y = miniOverlayCanvas.height / 2 - dz * scale;
    miniOverlayContext.fillStyle = 'rgba(70, 190, 255, 0.95)';
    miniOverlayContext.fillRect(x - 3, y - 3, 6, 6);
  }
  for (const zone of safehouses) {
    const dx = zone.x - car.position.x;
    const dz = zone.z - car.position.z;
    if (Math.abs(dx) > 90 || Math.abs(dz) > 90) continue;
    const x = miniOverlayCanvas.width / 2 + dx * scale;
    const y = miniOverlayCanvas.height / 2 - dz * scale;
    miniOverlayContext.fillStyle = 'rgba(85, 255, 160, 0.95)';
    miniOverlayContext.beginPath();
    miniOverlayContext.arc(x, y, 4, 0, Math.PI * 2);
    miniOverlayContext.fill();
  }
  for (const zone of storeZones) {
    if (zone.robbed) continue;
    const dx = zone.x - car.position.x;
    const dz = zone.z - car.position.z;
    if (Math.abs(dx) > 90 || Math.abs(dz) > 90) continue;
    const x = miniOverlayCanvas.width / 2 + dx * scale;
    const y = miniOverlayCanvas.height / 2 - dz * scale;
    miniOverlayContext.beginPath();
    miniOverlayContext.arc(x, y, 4, 0, Math.PI * 2);
    miniOverlayContext.fillStyle = 'rgba(255, 95, 75, 0.95)';
    miniOverlayContext.fill();
    miniOverlayContext.strokeStyle = 'rgba(255, 180, 150, 0.95)';
    miniOverlayContext.lineWidth = 1.8;
    miniOverlayContext.stroke();
  }
}

function getRedLightThreshold() {
  return wantedData.stars === 0 ? 3 : 5;
}

function setActivityStatus(message) {
  activityStatus.textContent = message;
}

function updateWantedDisplay() {
  wantedValue.textContent = '★'.repeat(wantedData.stars) + '☆'.repeat(5 - wantedData.stars);
}

function getStreetName() {
  const avenueIndex = Math.round((car.position.x - cityMinX) / avenueSpacing);
  const streetIndex = Math.round((car.position.z - cityMinZ) / streetSpacing);
  const avenueName = `${Math.abs(avenueIndex)}${avenueIndex >= 0 ? 'E' : 'W'} Ave`;
  const streetName = `${Math.abs(streetIndex)}${streetIndex >= 0 ? 'N' : 'S'} St`;
  return `${avenueName} / ${streetName}`;
}

function getCurrentWeatherName() {
  if (rainActive) return 'Rainy';
  if (dayTime < 360 || dayTime > 1140) return 'Night';
  if (dayTime < 420 || dayTime > 1080) return 'Sunrise/Sunset';
  return 'Clear';
}

function restoreCarAppearance() {
  const carMaterial = new THREE.MeshStandardMaterial({ color: playerData.cars[playerData.carIndex].color, metalness: 0.3, roughness: 0.4 });
  car.children[0].material = carMaterial;
}

function changeCar(index) {
  if (index >= 0 && index < playerData.cars.length && playerData.money >= playerData.cars[index].price) {
    if (index !== playerData.carIndex) {
      playerData.carIndex = index;
      restoreCarAppearance();
      setActivityStatus(`Selected car: ${playerData.cars[index].name}`);
      updateShop();
      const card = document.querySelector(`.car-card[data-car-index="${index}"]`);
      animateShopCard(card);
    }
  }
}

function buyUpgrade(id) {
  const item = shopItems.find((entry) => entry.id === id);
  const cost = getEffectiveItemCost(item);
  if (!item || playerData.money < cost) return;
  playerData.money -= cost;
  if (item.id.startsWith('paint-')) {
    playerData.paintColor = item.color;
    playerData.cars[playerData.carIndex].color = item.color;
    restoreCarAppearance();
    setActivityStatus(item.id.startsWith('paint-') && cost === 0 ? `Paint applied for free!` : `Purchased ${item.label}!`);
  } else {
    playerData.upgrades[id] += item.value;
    setActivityStatus(`Purchased ${item.label}!`);
  }
  updateStatusDisplays();
  updateShop();
  const card = document.querySelector(`.shop-card[data-item-id="${id}"]`);
  animateShopCard(card);
}

function updateShop() {
  carSelector.innerHTML = '';
  shopItemsContainer.innerHTML = '';
  for (let index = 0; index < playerData.cars.length; index += 1) {
    const carOption = playerData.cars[index];
    const card = document.createElement('div');
    card.className = `car-card${index === playerData.carIndex ? ' selected' : ''}`;
    card.dataset.carIndex = index;
    card.innerHTML = `<div>${carOption.name} - $${carOption.price}</div>`;
    const button = document.createElement('button');
    button.textContent = index === playerData.carIndex ? 'Selected' : 'Select';
    button.disabled = index === playerData.carIndex || playerData.money < carOption.price;
    button.addEventListener('click', () => changeCar(index));
    card.appendChild(button);
    carSelector.appendChild(card);
  }
  for (const item of shopItems) {
    const card = document.createElement('div');
    card.className = 'shop-card';
    card.dataset.itemId = item.id;
    const label = document.createElement('div');
    const effectiveCost = getEffectiveItemCost(item);
    label.innerHTML = `<strong>${item.label}</strong><br><small>${item.text} for ${effectiveCost === 0 ? 'Free' : '$' + effectiveCost}</small>`;
    const button = document.createElement('button');
    button.textContent = `Buy`;
    if (item.id.startsWith('paint-') && playerData.paintColor === item.color) {
      button.textContent = 'Applied';
      button.disabled = true;
    } else {
      button.disabled = playerData.money < effectiveCost;
    }
    button.addEventListener('click', () => buyUpgrade(item.id));
    card.appendChild(label);
    card.appendChild(button);
    shopItemsContainer.appendChild(card);
  }
}

function getActiveMissionTarget() {
  const mission = missionData.missions[missionData.activeIndex];
  if (mission.type === 'visitLandmark') {
    return landmarks[mission.targetIndex];
  }
  return null;
}

function isNearRedLight(position, axis) {
  for (const light of trafficLights) {
    if (light.axis !== axis || light.stateIndex !== 2) continue;
    const distance = axis === 'z' ? Math.abs(position.z - light.group.position.z) : Math.abs(position.x - light.group.position.x);
    if (distance < 22) return true;
  }
  return false;
}

function getCurrentRedLightViolation() {
  for (const light of trafficLights) {
    if (light.stateIndex !== 2) continue;
    const axis = light.axis;
    const primaryDistance = axis === 'z' ? Math.abs(car.position.z - light.group.position.z) : Math.abs(car.position.x - light.group.position.x);
    const crossDistance = axis === 'z' ? Math.abs(car.position.x - light.group.position.x) : Math.abs(car.position.z - light.group.position.z);
    if (primaryDistance < 8 && crossDistance < 14) return light;
  }
  return null;
}

function setupScene() {
  createCityRoads();
  createTrafficVehicle(0, cityMinZ, Math.PI, 1.05, 'z', cityMinZ, cityMaxZ, 0xffd54f);
  createTrafficVehicle(1000, cityMaxZ, 0, 1.1, 'z', cityMinZ, cityMaxZ, 0xff8bff);
  createTrafficVehicle(cityMinX, 1000, Math.PI / 2, 0.95, 'x', cityMinX, cityMaxX, 0x5cc1ff);
  createTrafficVehicle(cityMaxX, -1000, -Math.PI / 2, 1.15, 'x', cityMinX, cityMaxX, 0x7cff8b);
  createPoliceVehicle(cityMinX, -1800, Math.PI / 2, 1.05, [{ x: cityMinX, z: -1800 }, { x: cityMaxX, z: -1800 }, { x: cityMaxX, z: 1800 }, { x: cityMinX, z: 1800 }], 0x183cff);
  createPoliceVehicle(cityMaxX, 1600, -Math.PI / 2, 1.0, [{ x: cityMaxX, z: 1600 }, { x: cityMaxX, z: -1600 }, { x: cityMinX, z: -1600 }, { x: cityMinX, z: 1600 }], 0x183cff);
  createPoliceVehicle(2000, cityMaxZ, Math.PI, 1.05, [{ x: 2000, z: cityMaxZ }, { x: 2000, z: cityMinZ }], 0xffffff);
  createPoliceVehicle(-1200, cityMinZ, 0, 1.0, [{ x: -1200, z: cityMinZ }, { x: -1200, z: cityMaxZ }], 0xffffff);
  createPoliceVehicle(1200, 0, Math.PI, 1.05, [{ x: 1200, z: cityMinZ }, { x: 1200, z: cityMaxZ }, { x: cityMinX, z: 0 }], 0xff3333);
  createPoliceVehicle(-2200, 2200, -Math.PI / 2, 1.0, [{ x: -2200, z: 2200 }, { x: -2200, z: -2200 }, { x: 2200, z: -2200 }], 0xff3333);
  const lightPositions = [
    { x: 0, z: 0, axis: 'z', initial: 0 },
    { x: 0, z: 0, axis: 'x', initial: 2 },
    { x: 1000, z: 1000, axis: 'z', initial: 0 },
    { x: 1000, z: 1000, axis: 'x', initial: 2 },
    { x: -1000, z: -1000, axis: 'z', initial: 2 },
    { x: -1000, z: -1000, axis: 'x', initial: 0 },
    { x: 2000, z: 0, axis: 'z', initial: 0 },
    { x: 0, z: 2000, axis: 'x', initial: 0 },
    { x: -2000, z: 0, axis: 'z', initial: 0 },
    { x: 0, z: -2000, axis: 'x', initial: 2 }
  ];
  for (const light of lightPositions) createTrafficLight(light.x, light.z, light.axis === 'z' ? 0 : -Math.PI / 2, light.axis, light.initial);
}

const car = new THREE.Group();
const body = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.2, 7), new THREE.MeshStandardMaterial({ color: playerData.cars[0].color, metalness: 0.3, roughness: 0.4 }));
body.position.y = 1;
car.add(body);
function createWheel(x, z) {
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.6, 16), new THREE.MeshStandardMaterial({ color: 0x101112, metalness: 0.3, roughness: 0.7 }));
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(x, 0.35, z);
  return wheel;
}
car.add(createWheel(-1.5, 2.6));
car.add(createWheel(1.5, 2.6));
car.add(createWheel(-1.5, -2.6));
car.add(createWheel(1.5, -2.6));
car.position.set(0, 0, 20);
car.rotation.y = Math.PI;
car.castShadow = true;
scene.add(car);

const keys = { forward: false, backward: false, left: false, right: false };
const state = { speed: 0, turn: 0, damage: 0 };

const speedDisplay = document.getElementById('speed-value');
const wantedValue = document.getElementById('wanted-value');
const policeValue = document.getElementById('police-value');
const jailStatus = document.getElementById('jail-status');
const activityStatus = document.getElementById('activity-status');
const collisionStatus = document.getElementById('collision-status');
const arrestOverlay = document.getElementById('arrest-overlay');
const miniMapCanvas = document.getElementById('minimap-canvas');
const miniOverlayCanvas = document.createElement('canvas');
miniOverlayCanvas.id = 'minimap-overlay';
miniMapCanvas.parentElement.appendChild(miniOverlayCanvas);
const miniOverlayContext = miniOverlayCanvas.getContext('2d');
const miniRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas: miniMapCanvas });
miniRenderer.setPixelRatio(window.devicePixelRatio);
miniRenderer.setClearColor(0x08101d, 0.35);
const miniCamera = new THREE.OrthographicCamera(-90, 90, 90, -90, 0.1, 500);
miniCamera.position.set(0, 120, 0);
miniCamera.lookAt(0, 0, 0);
miniCamera.layers.enable(1);
camera.layers.enable(0);
camera.layers.disable(1);

const moneyValue = document.getElementById('money-value');
const heatValue = document.getElementById('heat-value');
const healthValue = document.getElementById('health-value');
const reputationValue = document.getElementById('reputation-value');
const factionValue = document.getElementById('faction-value');
const tierValue = document.getElementById('tier-value');
const missionTitle = document.getElementById('mission-title');
const missionDesc = document.getElementById('mission-desc');
const missionProgress = document.getElementById('mission-progress');
const streetName = document.getElementById('street-name');
const weatherStatus = document.getElementById('weather-status');
const carSelector = document.getElementById('car-selector');
const shopItemsContainer = document.getElementById('shop-items');

window.addEventListener('keydown', (event) => {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW': keys.forward = true; break;
    case 'ArrowDown':
    case 'KeyS': keys.backward = true; break;
    case 'ArrowLeft':
    case 'KeyA': keys.left = true; break;
    case 'ArrowRight':
    case 'KeyD': keys.right = true; break;
  }
});
window.addEventListener('keyup', (event) => {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW': keys.forward = false; break;
    case 'ArrowDown':
    case 'KeyS': keys.backward = false; break;
    case 'ArrowLeft':
    case 'KeyA': keys.left = false; break;
    case 'ArrowRight':
    case 'KeyD': keys.right = false; break;
  }
});

const clock = new THREE.Clock();
const carBox = new THREE.Box3();
const tmpBox = new THREE.Box3();
const waypointBox = new THREE.Box3();
const waypoint = new THREE.Vector3();

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  const minimapSize = Math.min(260, Math.max(180, Math.min(window.innerWidth * 0.22, window.innerHeight * 0.24)));
  miniRenderer.setSize(minimapSize, minimapSize);
  miniOverlayCanvas.width = minimapSize;
  miniOverlayCanvas.height = minimapSize;
  miniOverlayCanvas.style.width = `${minimapSize}px`;
  miniOverlayCanvas.style.height = `${minimapSize}px`;
}
window.addEventListener('resize', resize);
resize();

function updateTrafficLights(delta) {
  for (const light of trafficLights) {
    light.timer += delta;
    const duration = lightStates[light.stateIndex].duration;
    if (light.timer > duration) {
      light.timer = 0;
      light.stateIndex = (light.stateIndex + 1) % lightStates.length;
      updateTrafficLightVisuals(light);
    }
  }
}

function checkStoreZones(delta) {
  let insideAnyZone = false;
  for (const zone of storeZones) {
    const distance = Math.hypot(car.position.x - zone.x, car.position.z - zone.z);
    const isInside = distance < zone.radius;
    if (zone.robbed) {
      if (!isInside) {
        zone.cooldown += delta;
        if (zone.cooldown >= 12) {
          zone.robbed = false;
          zone.cooldown = 0;
        }
      }
    }
    if (isInside) {
      insideAnyZone = true;
      if (!zone.robbed) {
        if (robberyState.zone !== zone) {
          robberyState.zone = zone;
          robberyState.timer = 0;
        }
        robberyState.timer += delta;
        const remaining = Math.max(0, 10 - robberyState.timer).toFixed(1);
        if (robberyState.timer >= 10) {
          zone.robbed = true;
          zone.cooldown = 0;
          robberyState.zone = null;
          robberyState.timer = 0;
          wantedData.stars = Math.min(5, wantedData.stars + 1);
          wantedData.timer = 0;
          playerData.money += 280;
          playerData.heat = Math.min(heatConfig.max, playerData.heat + 14);
          updateStatusDisplays();
          setActivityStatus(`Robbery complete! +$280. Wanted level now ${wantedData.stars}★`);
          const mission = missionData.missions[missionData.activeIndex];
          if (mission.type === 'robStores' && !mission.complete) {
            mission.progress += 1;
            if (mission.progress >= mission.goal) completeMission();
          }
        } else {
          setActivityStatus(`Robbing store... stay inside the circle ${remaining}s`);
        }
      } else {
        setActivityStatus('Store on alert. Leave and wait for restock.');
      }
    }
  }
  if (!insideAnyZone) {
    if (robberyState.zone !== null) {
      robberyState.zone = null;
      robberyState.timer = 0;
    }
    if (!trafficLights.some(light => light.stateIndex === 2)) setActivityStatus('');
  }
}

function checkCargoZones(delta) {
  const mission = missionData.missions[missionData.activeIndex];
  if (mission.type !== 'cargoDelivery' || mission.complete) return;
  const pickup = cargoZones[mission.pickupIndex];
  const drop = cargoZones[mission.dropIndex];
  const nearPickup = pickup && Math.hypot(car.position.x - pickup.x, car.position.z - pickup.z) < 28;
  const nearDrop = drop && Math.hypot(car.position.x - drop.x, car.position.z - drop.z) < 28;
  if (!mission.cargoPicked && nearPickup) {
    mission.cargoPicked = true;
    setActivityStatus('Cargo loaded. Deliver it to the drop zone.');
    createWaypoint(drop.x, drop.z);
  }
  if (mission.cargoPicked && nearDrop) {
    mission.progress = 1;
    completeMission();
  }
}

function checkSafehouseZones(delta) {
  const mission = missionData.missions[missionData.activeIndex];
  const targetSafehouse = safehouses[mission.targetIndex];
  for (const zone of safehouses) {
    const distance = Math.hypot(car.position.x - zone.x, car.position.z - zone.z);
    const inside = distance < 30;
    if (inside) {
      playerData.heat = Math.max(0, playerData.heat - 18 * delta);
      playerData.health = Math.min(100, playerData.health + 9 * delta);
      if (mission.type === 'safeHouse' && zone === targetSafehouse && !mission.complete) {
        zone.timer += delta;
        setActivityStatus(`Hiding out... ${zone.timer.toFixed(1)}s`);
        if (zone.timer >= 8) {
          mission.progress = 1;
          completeMission();
        }
      }
      if (mission.type === 'jailBreak' && zone === targetSafehouse && missionData.jailBreakActive && !mission.complete) {
        mission.progress = 1;
        completeMission();
      }
    } else {
      zone.timer = 0;
    }
  }
  if (mission.type === 'jailBreak' && missionData.jailBreakActive && !mission.complete) {
    missionData.jailBreakTimer += delta;
    if (missionData.jailBreakTimer > 30) {
      missionData.jailBreakActive = false;
      setActivityStatus('Jail break failed. Try again later.');
    }
  }
}

function getNearestLandmark() {
  let closest = null;
  let bestDist = Infinity;
  for (const landmark of landmarks) {
    const dist = Math.hypot(car.position.x - landmark.x, car.position.z - landmark.z);
    if (dist < bestDist) {
      bestDist = dist;
      closest = landmark;
    }
  }
  return { landmark: closest, distance: bestDist };
}

function updatePedestrians(delta) {
  for (const person of pedestrians) {
    if (person.axis === 'x') {
      person.mesh.position.x += person.speed * delta * person.direction;
      if (person.mesh.position.x > person.max || person.mesh.position.x < person.min) person.direction *= -1;
    } else {
      person.mesh.position.z += person.speed * delta * person.direction;
      if (person.mesh.position.z > person.max || person.mesh.position.z < person.min) person.direction *= -1;
    }
  }
}

function updateDayNight(delta) {
  dayTime += delta * 8;
  if (dayTime >= 1440) dayTime -= 1440;
  if (Math.random() < 0.0009 * delta) rainActive = !rainActive;
  const dayFactor = Math.max(0, Math.cos((dayTime / 1440) * Math.PI * 2));
  const sunHeight = Math.max(0.15, Math.sin((dayTime / 1440) * Math.PI * 2));
  sun.intensity = 0.5 + sunHeight * 0.7;
  sun.position.set(Math.cos((dayTime / 1440) * Math.PI * 2) * 400, 800 * Math.max(0.5, sunHeight), Math.sin((dayTime / 1440) * Math.PI * 2) * 450);
  const skyHue = dayTime < 420 || dayTime > 1020 ? 0.62 : 0.55;
  const skySaturation = dayTime < 420 || dayTime > 1020 ? 0.4 : 0.6;
  const skyLightness = dayTime < 420 || dayTime > 1020 ? 0.13 : 0.55;
  scene.background.setHSL(skyHue, skySaturation, skyLightness);
  scene.fog.color.copy(scene.background);
  scene.fog.density = 0.0012 + (rainActive ? 0.0008 : 0);
  if (dayTime > 1080 || dayTime < 360) {
    ambient.intensity = 0.8;
  } else {
    ambient.intensity = 1.3;
  }
  weatherStatus.textContent = `${getCurrentWeatherName()} • ${Math.floor(dayTime / 60)}:${String(Math.floor(dayTime % 60)).padStart(2, '0')}`;
}

function updateTrafficLightStatus() {
  updateTrafficLights(clock.getDelta());
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  updateDayNight(delta);
  const selectedCar = playerData.cars[playerData.carIndex];
  const maxSpeed = getEffectiveSpeed(selectedCar.maxSpeed) + playerData.upgrades.topSpeed - (1 - playerData.health / 100) * 0.6;
  const acceleration = keys.forward ? selectedCar.accel + playerData.upgrades.acceleration : keys.backward ? -(selectedCar.accel * 0.9) : 0;
  if (keys.forward && !enginePlaying) playEngineBeep();
  state.speed += acceleration * delta * 60;
  state.speed *= 0.94;
  state.speed = THREE.MathUtils.clamp(state.speed, -1.9, maxSpeed);
  state.turn = keys.left ? 0.03 : keys.right ? -0.03 : 0;
  car.rotation.y += state.turn * delta * 30 * Math.sign(Math.max(0.2, Math.abs(state.speed)));
  const previousPosition = car.position.clone();
  if (!policeState.caught) {
    car.position.x += Math.sin(car.rotation.y) * state.speed * delta * 30;
    car.position.z += Math.cos(car.rotation.y) * state.speed * delta * 30;
  }
  carBox.setFromObject(car);
  let collided = false;
  let collidedWithPolice = false;
  for (const mesh of collidableMeshes) {
    tmpBox.setFromObject(mesh);
    if (carBox.intersectsBox(tmpBox)) {
      collided = true;
      if (mesh.userData?.police) collidedWithPolice = true;
      break;
    }
  }
  updateTrafficLights(delta);
  const currentRedLight = getCurrentRedLightViolation();
  if (currentRedLight && Math.abs(state.speed) > 0.35 && !policeState.caught) {
    const threshold = getRedLightThreshold();
    if (redLightViolation.lastLight !== currentRedLight) {
      redLightViolation.lastLight = currentRedLight;
      redLightViolation.count += 1;
      setActivityStatus(`Red light violation ${redLightViolation.count}/${threshold}`);
      playTone(260, 0.06, 'square', 0.08);
      if (redLightViolation.count >= threshold) {
        redLightViolation.count = 0;
        wantedData.stars = Math.min(5, wantedData.stars + 1);
        wantedData.timer = 0;
        playerData.heat = Math.min(heatConfig.max, playerData.heat + 8);
        updateStatusDisplays();
        setActivityStatus(`Wanted star earned! ${wantedData.stars}★`);
      }
    }
  } else if (!currentRedLight) {
    redLightViolation.lastLight = null;
  }
  const approachingRed = isNearRedLight(car.position, isCarFacingAxis('z') ? 'z' : 'x') && Math.abs(state.speed) > 0.15;
  const currentTime = performance.now() / 1000;
  if (collided) {
    car.position.copy(previousPosition);
    state.speed *= -0.28;
    spawnCrashParticles(car.position.x, 0.8, car.position.z);
    playerData.health = Math.max(0, playerData.health - (collidedWithPolice ? 12 : 8) * (1 - playerData.upgrades.armor));
    collisionStatus.textContent = 'Collision! Slow down and recover.';
    playCrashSound();
    if (collidedWithPolice && !policeState.caught) {
      if (currentTime - policeState.lastHitTime > 1) {
        policeState.lastHitTime = currentTime;
        policeState.hits += 1;
        updatePoliceStatusDisplay();
        if (policeState.hits >= 3) {
          policeState.caught = true;
          state.speed = 0;
          if (missionData.missions[missionData.activeIndex].type === 'jailBreak' && !missionData.missions[missionData.activeIndex].complete) {
            missionData.jailBreakActive = true;
            missionData.jailBreakTimer = 0;
          }
          setActivityStatus('Caught by police! Resetting soon...');
          resetAfterCaught();
        } else {
          const remaining = 3 - policeState.hits;
          setActivityStatus(`Police hit! ${remaining} more and you are caught.`);
        }
      }
    }
  } else if (approachingRed) {
    state.speed *= 0.91;
    collisionStatus.textContent = 'Red light ahead, slow down.';
  } else {
    collisionStatus.textContent = '';
  }
  if (!policeState.caught && policeState.hits > 0 && currentTime - policeState.lastHitTime >= 30) {
    policeState.hits = 0;
    wantedData.stars = 0;
    wantedData.timer = 0;
    playerData.heat = Math.max(0, playerData.heat - 20);
    updateStatusDisplays();
    setActivityStatus('Clean for 30 seconds. Wanted level cleared.');
  }
  if (wantedData.stars > 0) {
    if (!sirenOscillator) startSiren();
    wantedData.timer += delta;
    if (wantedData.timer >= 90 && wantedData.stars < 5) {
      wantedData.timer -= 90;
      wantedData.stars += 1;
      playerData.heat = Math.min(heatConfig.max, playerData.heat + 10);
      updateStatusDisplays();
      setActivityStatus(`Heat escalated to ${wantedData.stars}★`);
    }
  } else {
    if (sirenOscillator) stopSiren();
    playerData.heat = Math.max(0, playerData.heat - getCurrentFactionHeatDecay() * delta);
  }
  if (missionData.missions[missionData.activeIndex].type === 'evadeTime' && !policeState.caught) {
    const mission = missionData.missions[missionData.activeIndex];
    if (wantedData.stars === 0) {
      mission.progress += delta;
      if (mission.progress >= mission.targetTime) completeMission();
    } else {
      mission.progress = 0;
    }
  }
  checkStoreZones(delta);
  checkCargoZones(delta);
  checkSafehouseZones(delta);
  const missionTarget = getActiveMissionTarget();
  if (missionTarget) {
    const dist = Math.hypot(car.position.x - missionTarget.x, car.position.z - missionTarget.z);
    if (!missionData.missions[missionData.activeIndex].complete && dist < 28) completeMission();
  }
  for (const traffic of trafficVehicles) {
    const stoppingLight = trafficLights.some(light => light.axis === traffic.axis && light.stateIndex === 2 && Math.abs((traffic.axis === 'z' ? traffic.mesh.position.z : traffic.mesh.position.x) - light.group.position[traffic.axis]) < 18);
    const movement = traffic.direction.clone().multiplyScalar((stoppingLight ? 0.08 : traffic.speed * traffic.directionScale) * delta * 15);
    traffic.mesh.position.add(movement);
    const position = traffic.mesh.position;
    if (traffic.axis === 'z') {
      if (position.z > traffic.max || position.z < traffic.min) {
        traffic.directionScale *= -1;
        traffic.mesh.rotation.y += Math.PI;
      }
    } else {
      if (position.x > traffic.max || position.x < traffic.min) {
        traffic.directionScale *= -1;
        traffic.mesh.rotation.y += Math.PI;
      }
    }
  }
  updatePoliceVehicles(delta);
  updatePedestrians(delta);
  updateSubwayTrains(delta);
  updateSpikeStrips(delta);
  updateParticles(delta);
  routeUpdateTimer += delta;
  if (routeUpdateTimer > 0.8) {
    generateGPSRoute();
    routeUpdateTimer = 0;
  }
  camera.position.lerp(new THREE.Vector3(car.position.x - Math.sin(car.rotation.y) * 14, car.position.y + 8.5, car.position.z - Math.cos(car.rotation.y) * 18), 0.08);
  camera.lookAt(car.position.x, car.position.y + 1.7, car.position.z);
  miniCamera.position.set(car.position.x, 120, car.position.z);
  miniCamera.lookAt(car.position.x, 0, car.position.z);
  miniRenderer.render(scene, miniCamera);
  drawMinimapIcons();
  speedDisplay.textContent = Math.round(Math.abs(state.speed) * 42);
  updateArrestDisplay();
  streetName.textContent = getStreetName();
  weatherStatus.textContent = `${getCurrentWeatherName()} • ${Math.floor(dayTime / 60)}:${String(Math.floor(dayTime % 60)).padStart(2, '0')}`;
  updateStatusDisplays();
  renderer.render(scene, camera);
}

function initializeUI() {
  playerData.factionTier = getFactionTier(playerData.reputation);
  playerData.faction = playerData.factionTier.name;
  updateShop();
  updateStatusDisplays();
  activateMission(missionData.activeIndex);
}

createCityRoads();
setupScene();
initializeUI();
updateWantedDisplay();
updatePoliceStatusDisplay();
camera.position.set(0, 6, 32);
camera.lookAt(car.position);
animate();
