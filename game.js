import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const WORLD_SIZE   = 600;
const TERRAIN_SEGS = 120;
const TREE_COUNT   = 900;
const GRASS_COUNT  = 4000;
const ROCK_COUNT   = 180;
const DEER_COUNT      = 14;
const RABBIT_COUNT    = 22;
const DAY_LENGTH      = 240;  // seconds per full day
const BOND_RANGE      = 4.5;
const GESTATION_DAYS  = 2;    // in-game days until pups born
const PUP_GROW_DAYS   = 5;    // in-game days to reach full size
const WOLF_SPEED   = 7.5;
const SPRINT_MULT  = 2.0;
const GRAVITY      = 28;
const ATTACK_RANGE = 3.2;
const HOWL_RADIUS  = 60;

// ─── Noise (simple 2-D value noise) ──────────────────────────────────────────
function hash(x, y) {
  let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix,   iy),   b = hash(ix+1, iy);
  const c = hash(ix,   iy+1), d = hash(ix+1, iy+1);
  return a + (b-a)*ux + (c-a)*uy + (d-a)*ux*uy - ((b-a)*ux + (c-a)*uy)*ux*uy +
         (d-b-c+a)*ux*uy;
}
function fbm(x, y, octaves=6) {
  let v=0, amp=0.5, freq=1, max=0;
  for (let i=0;i<octaves;i++) {
    v += amp * noise(x*freq, y*freq);
    max += amp; amp *= 0.5; freq *= 2.0;
  }
  return v / max;
}
function terrainY(x, z) {
  const s = 0.004;
  const h = fbm(x*s + 100, z*s + 200);
  return h * h * 35 - 2;
}

// ─── Scene Setup ─────────────────────────────────────────────────────────────
const canvas   = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.toneMapping       = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.outputColorSpace  = THREE.SRGBColorSpace;

const scene  = new THREE.Scene();
scene.fog    = new THREE.FogExp2(0x8da8b0, 0.008);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.1, 800);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ─── Lighting ─────────────────────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0x404860, 0.6);
scene.add(ambientLight);

const sun = new THREE.DirectionalLight(0xfff4e0, 2.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far  = 400;
sun.shadow.camera.left = sun.shadow.camera.bottom = -120;
sun.shadow.camera.right = sun.shadow.camera.top   =  120;
sun.shadow.bias = -0.0003;
scene.add(sun);

const moonLight = new THREE.DirectionalLight(0x4060a0, 0.4);
scene.add(moonLight);

const hemi = new THREE.HemisphereLight(0x7090c0, 0x3a5530, 0.5);
scene.add(hemi);

// ─── Sky ──────────────────────────────────────────────────────────────────────
const skyGeo = new THREE.SphereGeometry(700, 32, 32);
skyGeo.scale(-1, 1, 1);
const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true });
// We'll update sky colors in the loop — store vertex colors per time
const skyCols = new Float32Array(skyGeo.attributes.position.count * 3);
skyGeo.setAttribute('color', new THREE.BufferAttribute(skyCols, 3));
const skyMesh = new THREE.Mesh(skyGeo, skyMat);
scene.add(skyMesh);

const starGeo = new THREE.BufferGeometry();
const starVerts = [];
for (let i = 0; i < 3000; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2*Math.random()-1);
  const r     = 680;
  starVerts.push(r*Math.sin(phi)*Math.cos(theta), r*Math.cos(phi), r*Math.sin(phi)*Math.sin(theta));
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
const starMat  = new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: true });
const starMesh = new THREE.Points(starGeo, starMat);
scene.add(starMesh);

// ─── Terrain ─────────────────────────────────────────────────────────────────
const tGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, TERRAIN_SEGS, TERRAIN_SEGS);
tGeo.rotateX(-Math.PI / 2);
const posAttr = tGeo.attributes.position;
for (let i = 0; i < posAttr.count; i++) {
  const x = posAttr.getX(i), z = posAttr.getZ(i);
  posAttr.setY(i, terrainY(x, z));
}
tGeo.computeVertexNormals();

// Vertex color by height/slope for realism
const tCols = new Float32Array(posAttr.count * 3);
const norAttr = tGeo.attributes.normal;
for (let i = 0; i < posAttr.count; i++) {
  const y  = posAttr.getY(i);
  const ny = norAttr.getY(i);
  // slope: cliff vs slope vs grass
  const t  = Math.max(0, Math.min(1, ny));
  // base grass
  let r = 0.22 + Math.random()*0.04, g = 0.28 + Math.random()*0.06, b = 0.12;
  if (y < 0.5) { r=0.18;g=0.22;b=0.16; } // wet low ground
  if (y > 10)  { r = 0.55+y*0.01; g = 0.52+y*0.005; b = 0.48; } // rocky peaks
  // cliffs override with grey stone
  const grey = 0.35+Math.random()*0.1;
  r = r*t + grey*(1-t); g = g*t + (grey*0.95)*(1-t); b = b*t + (grey*0.9)*(1-t);
  tCols[i*3]=r; tCols[i*3+1]=g; tCols[i*3+2]=b;
}
tGeo.setAttribute('color', new THREE.BufferAttribute(tCols, 3));

const tMat  = new THREE.MeshLambertMaterial({ vertexColors: true });
const terrain = new THREE.Mesh(tGeo, tMat);
terrain.receiveShadow = true;
scene.add(terrain);

// ─── Water plane ─────────────────────────────────────────────────────────────
const waterGeo = new THREE.PlaneGeometry(WORLD_SIZE * 2, WORLD_SIZE * 2);
waterGeo.rotateX(-Math.PI / 2);
const waterMat = new THREE.MeshLambertMaterial({
  color: 0x1a4a7a, transparent: true, opacity: 0.82,
});
const waterMesh = new THREE.Mesh(waterGeo, waterMat);
waterMesh.position.y = 0.3;
waterMesh.receiveShadow = true;
scene.add(waterMesh);

// ─── Trees ────────────────────────────────────────────────────────────────────
const trunkMat  = new THREE.MeshLambertMaterial({ color: 0x4a3020 });
const leaf1Mat  = new THREE.MeshLambertMaterial({ color: 0x1e4a1e });
const leaf2Mat  = new THREE.MeshLambertMaterial({ color: 0x254d20 });
const piLeafMat = new THREE.MeshLambertMaterial({ color: 0x1a3a1a });

function makeTree(x, z, type) {
  const group  = new THREE.Group();
  const ty     = terrainY(x, z);
  if (ty < 0.6) return null; // no trees in water

  if (type === 0) {
    // Pine
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.28,4+Math.random()*2,7), trunkMat);
    trunk.position.y = 2;
    trunk.castShadow = true;
    group.add(trunk);
    const h = 3.5 + Math.random()*2;
    for (let i=0; i<4; i++) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(1.8-i*0.35, h*0.55, 8),
        piLeafMat
      );
      cone.position.y = 3.5 + i * (h*0.32);
      cone.castShadow = true;
      group.add(cone);
    }
  } else {
    // Deciduous
    const h     = 5 + Math.random() * 4;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.35,h,8), trunkMat);
    trunk.position.y = h/2;
    trunk.castShadow = true;
    group.add(trunk);
    const cr   = 2.2 + Math.random()*1.8;
    const mat  = Math.random() > 0.5 ? leaf1Mat : leaf2Mat;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(cr, 9, 7), mat);
    ball.position.y = h + cr * 0.5;
    ball.castShadow = true;
    group.add(ball);
    if (Math.random() > 0.4) {
      const b2 = new THREE.Mesh(new THREE.SphereGeometry(cr*0.7, 7, 6), mat);
      b2.position.set((Math.random()-0.5)*cr, h + cr*0.2, (Math.random()-0.5)*cr);
      b2.castShadow = true;
      group.add(b2);
    }
  }
  group.position.set(x, ty, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  return group;
}

const treeObjects = [];
for (let i = 0; i < TREE_COUNT; i++) {
  const x    = (Math.random()-0.5)*WORLD_SIZE*0.92;
  const z    = (Math.random()-0.5)*WORLD_SIZE*0.92;
  const type = Math.random() > 0.45 ? 0 : 1;
  const t    = makeTree(x, z, type);
  if (t) { scene.add(t); treeObjects.push(t); }
}

// ─── Rocks ────────────────────────────────────────────────────────────────────
const rockMat = new THREE.MeshLambertMaterial({ color: 0x5a5650 });
for (let i = 0; i < ROCK_COUNT; i++) {
  const x  = (Math.random()-0.5)*WORLD_SIZE*0.9;
  const z  = (Math.random()-0.5)*WORLD_SIZE*0.9;
  const ty = terrainY(x, z);
  const s  = 0.4 + Math.random()*1.8;
  const r  = new THREE.Mesh(
    new THREE.DodecahedronGeometry(s, 0),
    rockMat
  );
  r.position.set(x, ty + s*0.5, z);
  r.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
  r.castShadow = r.receiveShadow = true;
  scene.add(r);
}

// ─── Grass instances ──────────────────────────────────────────────────────────
const grassGeo = new THREE.BufferGeometry();
const gv = [0,-0.1,0,  0.05,0.6,0,  0.1,-0.1,0];
grassGeo.setAttribute('position', new THREE.Float32BufferAttribute(gv,3));
const grassMat = new THREE.MeshBasicMaterial({ color:0x2d5a1a, side:THREE.DoubleSide });
const grassDummy = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(0.25, 0.55, 1, 3),
  new THREE.MeshBasicMaterial({ color:0x2d5a20, side:THREE.DoubleSide, transparent:true, opacity:0.9 }),
  GRASS_COUNT
);
const dm = new THREE.Object3D();
for (let i = 0; i < GRASS_COUNT; i++) {
  const x = (Math.random()-0.5)*WORLD_SIZE;
  const z = (Math.random()-0.5)*WORLD_SIZE;
  const y = terrainY(x,z);
  if (y < 0.4) { dm.position.set(0,-999,0); }
  else { dm.position.set(x,y+0.15,z); }
  dm.rotation.y = Math.random()*Math.PI;
  dm.scale.set(1+Math.random()*0.5,1+Math.random()*0.8,1);
  dm.updateMatrix();
  grassDummy.setMatrixAt(i, dm.matrix);
}
grassDummy.instanceMatrix.needsUpdate = true;
scene.add(grassDummy);

// ─── Wolf (player) ────────────────────────────────────────────────────────────
function makeWolf(color = 0x555550) {
  const g = new THREE.Group();

  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x2a2a28 });
  const whiteMat= new THREE.MeshLambertMaterial({ color: 0xddd8cc });
  const eyeMat  = new THREE.MeshBasicMaterial({ color: 0xffee44 });

  // Body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.52,10,8), bodyMat);
  body.scale.set(1.15, 0.85, 1.7);
  body.position.y = 0.7;
  body.castShadow = true;
  g.add(body);

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.28,0.35,8), bodyMat);
  neck.position.set(0, 1.05, 0.52);
  neck.rotation.x = -0.4;
  neck.castShadow = true;
  g.add(neck);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32,10,8), bodyMat);
  head.scale.set(1.05,0.95,1.2);
  head.position.set(0, 1.24, 0.82);
  head.castShadow = true;
  g.add(head);

  // Snout
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.16,0.32), bodyMat);
  snout.position.set(0, 1.14, 1.05);
  g.add(snout);

  // Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055,6,5), darkMat);
  nose.position.set(0, 1.15, 1.21);
  g.add(nose);

  // Eyes
  [-1,1].forEach(side => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055,6,5), eyeMat);
    eye.position.set(side*0.13, 1.29, 0.98);
    g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03,5,4), darkMat);
    pupil.position.set(side*0.13, 1.29, 1.03);
    g.add(pupil);
  });

  // Ears
  const earGeo = new THREE.ConeGeometry(0.1, 0.22, 5);
  [-1,1].forEach(side => {
    const ear = new THREE.Mesh(earGeo, bodyMat);
    ear.position.set(side*0.2, 1.5, 0.78);
    ear.rotation.z = side*0.3;
    g.add(ear);
  });

  // Tail
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.1,0.7,7), bodyMat);
  tail.position.set(0, 0.85, -0.78);
  tail.rotation.x = 0.9;
  tail.name = 'tail';
  g.add(tail);

  // Legs (4)
  const legGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.6, 7);
  const legPos = [
    [ 0.28, 0.3,  0.42], [-0.28, 0.3,  0.42],
    [ 0.28, 0.3, -0.35], [-0.28, 0.3, -0.35],
  ];
  legPos.forEach((p,i) => {
    const leg = new THREE.Mesh(legGeo, bodyMat);
    leg.position.set(...p);
    leg.castShadow = true;
    leg.name = 'leg' + i;
    g.add(leg);
  });

  // Belly
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3,8,6), whiteMat);
  belly.scale.set(0.9,0.5,1.3);
  belly.position.set(0,0.4,0.1);
  g.add(belly);

  return g;
}

const wolf = makeWolf(0x6a6560);
wolf.scale.setScalar(1.15);
scene.add(wolf);

// ─── Mate Wolf ────────────────────────────────────────────────────────────────
const mateMesh = makeWolf(0xb0a090); // lighter tan female
mateMesh.scale.setScalar(1.0);
// Spawn her away from origin
const mateStartX = 80 + Math.random()*40;
const mateStartZ = 60 + Math.random()*40;
mateMesh.position.set(mateStartX, terrainY(mateStartX, mateStartZ), mateStartZ);
scene.add(mateMesh);

// Heart particle pool
const heartMat   = new THREE.MeshBasicMaterial({ color: 0xff4488, side: THREE.DoubleSide });
const heartGeo   = new THREE.PlaneGeometry(0.35, 0.35);
const hearts     = [];
for (let i = 0; i < 8; i++) {
  const h = new THREE.Mesh(heartGeo, heartMat.clone());
  h.visible = false;
  h.userData = { life: 0, vx: 0, vy: 0 };
  scene.add(h);
  hearts.push(h);
}
function spawnHearts(pos) {
  hearts.forEach(h => {
    if (!h.visible) {
      h.visible = true;
      h.position.copy(pos).add(new THREE.Vector3((Math.random()-0.5)*1.5, 1.2+Math.random()*0.6, (Math.random()-0.5)*1.5));
      h.userData.life = 1.4;
      h.userData.vy   = 1.2 + Math.random()*0.8;
      h.userData.vx   = (Math.random()-0.5)*0.6;
    }
  });
}
function updateHearts(dt) {
  hearts.forEach(h => {
    if (!h.visible) return;
    h.userData.life -= dt;
    h.position.y    += h.userData.vy * dt;
    h.position.x    += h.userData.vx * dt;
    h.material.opacity = Math.max(0, h.userData.life / 1.4);
    h.material.transparent = true;
    h.lookAt(camera.position);
    if (h.userData.life <= 0) h.visible = false;
  });
}

const mate = {
  mesh:        mateMesh,
  state:       'wander',  // wander | follow | approach | idle
  target:      new THREE.Vector3(),
  timer:       Math.random() * 6,
  legPhase:    0,
  approachTimer: 0,
};

function updateMate(dt) {
  const pos  = mate.mesh.position;
  const dist = pos.distanceTo(player.pos);

  // Approach player when howled (set from howl fn), or when bond >= 1
  if (packState.bondLevel > 0 && dist > 12) {
    mate.state = 'follow';
  }

  mate.timer -= dt;

  let dx = 0, dz = 0, spd = 3.8;

  if (mate.state === 'follow') {
    const tx = player.pos.x + (Math.random()-0.5)*4;
    const tz = player.pos.z + (Math.random()-0.5)*4;
    dx = tx - pos.x; dz = tz - pos.z;
    const l = Math.sqrt(dx*dx+dz*dz);
    if (l < 2.5) { dx=0; dz=0; }
    else { dx/=l; dz/=l; }
  } else if (mate.state === 'wander') {
    if (mate.timer < 0) {
      mate.timer = 3 + Math.random()*6;
      const a = Math.random()*Math.PI*2;
      const r = 10 + Math.random()*30;
      mate.target.set(
        Math.max(-WORLD_SIZE/2+5, Math.min(WORLD_SIZE/2-5, pos.x + Math.cos(a)*r)),
        0,
        Math.max(-WORLD_SIZE/2+5, Math.min(WORLD_SIZE/2-5, pos.z + Math.sin(a)*r))
      );
    }
    dx = mate.target.x - pos.x; dz = mate.target.z - pos.z;
    const l = Math.sqrt(dx*dx+dz*dz);
    if (l < 1) { dx=0; dz=0; }
    else { dx/=l; dz/=l; }
  }

  if (dx !== 0 || dz !== 0) {
    pos.x += dx*spd*dt;
    pos.z += dz*spd*dt;
    pos.y  = Math.max(terrainY(pos.x, pos.z), 0.35);
    mate.mesh.rotation.y = Math.atan2(dx, dz);
    mate.legPhase += spd*dt*3.5;
    ['leg0','leg2'].forEach(n=>{
      const l = mate.mesh.getObjectByName(n);
      if (l) l.rotation.x = Math.sin(mate.legPhase)*0.6;
    });
    ['leg1','leg3'].forEach(n=>{
      const l = mate.mesh.getObjectByName(n);
      if (l) l.rotation.x = -Math.sin(mate.legPhase)*0.6;
    });
  }
  // Tail wag near player
  const tail = mate.mesh.getObjectByName('tail');
  if (tail) tail.rotation.y = dist < 10 ? Math.sin(Date.now()*0.006)*0.5 : 0;
}

// ─── Pack / Breeding State ────────────────────────────────────────────────────
const packState = {
  bondLevel:       0,    // 0-3, then mated
  mated:           false,
  pregnant:        false,
  gestationTimer:  0,    // seconds remaining
  pups:            [],   // array of pup objects
  eCooldown:       0,
};

function updatePackLabel() {
  const alive = packState.pups.filter(p=>!p.dead).length;
  if (!packState.mated) {
    if (packState.bondLevel === 0) packLabel.textContent = 'Pack: Lone Wolf';
    else packLabel.textContent = `Pack: Bonding (${packState.bondLevel}/3)`;
  } else {
    const parts = ['You', 'Mate'];
    if (alive > 0) parts.push(`${alive} pup${alive>1?'s':''}`);
    packLabel.textContent = 'Pack: ' + parts.join(' + ');
  }
}

// ─── Pup ──────────────────────────────────────────────────────────────────────
function spawnPup() {
  // Random pup color — blend between parents
  const colors = [0x8a8070, 0x6a6560, 0xb0a090, 0x707068, 0x909080];
  const col    = colors[Math.floor(Math.random()*colors.length)];
  const mesh   = makeWolf(col);
  const startScale = 0.45;
  mesh.scale.setScalar(startScale);
  // Near the mate
  const ox = (Math.random()-0.5)*3, oz = (Math.random()-0.5)*3;
  const px = mateMesh.position.x + ox;
  const pz = mateMesh.position.z + oz;
  mesh.position.set(px, terrainY(px,pz), pz);
  scene.add(mesh);

  const pup = {
    mesh,
    age:       0,         // in-game days
    legPhase:  0,
    dead:      false,
    followOffset: new THREE.Vector3((Math.random()-0.5)*3, 0, (Math.random()-0.5)*3),
  };
  packState.pups.push(pup);
  return pup;
}

function updatePups(dt) {
  const dayFrac = dt / DAY_LENGTH;
  packState.pups.forEach(pup => {
    if (pup.dead) return;
    pup.age += dayFrac;

    // Grow towards full size
    const growT   = Math.min(1, pup.age / PUP_GROW_DAYS);
    const s       = 0.45 + growT * 0.7;
    pup.mesh.scale.setScalar(s);

    // Follow player with individual offset
    const target = new THREE.Vector3()
      .copy(player.pos)
      .add(pup.followOffset);
    const dx = target.x - pup.mesh.position.x;
    const dz = target.z - pup.mesh.position.z;
    const dist = Math.sqrt(dx*dx+dz*dz);

    if (dist > 1.5) {
      const spd = WOLF_SPEED * 0.8 * (1 - growT*0.2);
      const ndx = dx/dist, ndz = dz/dist;
      pup.mesh.position.x += ndx*spd*dt;
      pup.mesh.position.z += ndz*spd*dt;
      pup.mesh.position.y  = Math.max(terrainY(pup.mesh.position.x, pup.mesh.position.z), 0.2);
      pup.mesh.rotation.y  = Math.atan2(ndx, ndz);
      pup.legPhase += spd*dt*4;
      ['leg0','leg2'].forEach(n=>{
        const l = pup.mesh.getObjectByName(n); if(l) l.rotation.x = Math.sin(pup.legPhase)*0.7;
      });
      ['leg1','leg3'].forEach(n=>{
        const l = pup.mesh.getObjectByName(n); if(l) l.rotation.x = -Math.sin(pup.legPhase)*0.7;
      });
    }
    // Tail wag always for pups
    const tail = pup.mesh.getObjectByName('tail');
    if (tail) tail.rotation.y = Math.sin(Date.now()*0.008 + pup.age*10)*0.6;
  });
}

// ─── Bond / Mate (F key) ──────────────────────────────────────────────────────
let fWasDown = false;
function tryBondOrMate() {
  if (packState.eCooldown > 0) return;
  const dist = mateMesh.position.distanceTo(player.pos);
  if (dist > BOND_RANGE) return;

  packState.eCooldown = 1.8;

  if (!packState.mated) {
    if (packState.bondLevel < 3) {
      packState.bondLevel++;
      spawnHearts(mateMesh.position);
      const msgs = ['', 'You nuzzle. A connection forms.', 'She leans close. Trust grows.', 'Your bond is complete.'];
      showNotif(msgs[packState.bondLevel]);
      if (packState.bondLevel === 3) {
        packState.mated = true;
        mate.state = 'follow';
        setTimeout(() => showNotif('Press F near your mate to start a litter.'), 3200);
      }
      updatePackLabel();
    }
  } else if (packState.mated && !packState.pregnant) {
    // Need to be fed enough
    if (player.hunger < 55) {
      showNotif('You are too hungry. Hunt first.'); return;
    }
    if (player.thirst < 40) {
      showNotif('You are too thirsty. Drink first.'); return;
    }
    packState.pregnant     = true;
    packState.gestationTimer = GESTATION_DAYS * DAY_LENGTH;
    spawnHearts(mateMesh.position);
    spawnHearts(wolf.position);
    showNotif('A new litter is on the way...');
    updatePackLabel();
  } else if (packState.pregnant) {
    showNotif('Pups are on the way. Be patient.');
  } else {
    showNotif('Your mate is by your side.');
  }
}

const pupLabel = document.getElementById('pup-label');

// Gestation tick — called in main loop
function tickGestation(dt) {
  if (!packState.pregnant) {
    pupLabel.style.display = 'none';
    return;
  }
  packState.gestationTimer -= dt;
  const daysLeft = Math.max(0, packState.gestationTimer / DAY_LENGTH);
  pupLabel.style.display = 'block';
  pupLabel.textContent   = `Expecting pups · ${daysLeft.toFixed(1)}d`;

  if (packState.gestationTimer <= 0) {
    packState.pregnant = false;
    pupLabel.style.display = 'none';
    const count = 2 + Math.floor(Math.random()*3); // 2–4 pups
    for (let i=0; i<count; i++) spawnPup();
    spawnHearts(mateMesh.position);
    showNotif(`${count} pups born! Your pack grows.`);
    updatePackLabel();
  }
}

// ─── Deer ────────────────────────────────────────────────────────────────────
function makeDeer() {
  const g = new THREE.Group();
  const mat  = new THREE.MeshLambertMaterial({ color: 0x8a6040 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x3a2010 });
  const white= new THREE.MeshLambertMaterial({ color: 0xfff0e0 });
  const eye  = new THREE.MeshBasicMaterial({ color: 0x111100 });

  // Body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5,9,7), mat);
  body.scale.set(1,0.8,1.6); body.position.y=1.1; body.castShadow=true; g.add(body);
  // Neck
  const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.2,0.5,7), mat);
  nk.position.set(0,1.5,0.55); nk.rotation.x=-0.5; nk.castShadow=true; g.add(nk);
  // Head
  const hd = new THREE.Mesh(new THREE.SphereGeometry(0.22,9,7), mat);
  hd.scale.set(1,0.9,1.3); hd.position.set(0,1.72,0.82); hd.castShadow=true; g.add(hd);
  // Snout
  const sn = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.12,0.2), mat);
  sn.position.set(0,1.63,0.98); g.add(sn);
  // Eyes
  [-1,1].forEach(s=>{
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.04,5,4), eye);
    e.position.set(s*0.11,1.76,0.93); g.add(e);
  });
  // Ears
  [-1,1].forEach(s=>{
    const e = new THREE.Mesh(new THREE.ConeGeometry(0.08,0.2,5), mat);
    e.position.set(s*0.17,1.88,0.75); e.rotation.z=s*0.5; g.add(e);
  });
  // Tail
  const tl = new THREE.Mesh(new THREE.SphereGeometry(0.1,6,5), white);
  tl.position.set(0,1.1,-0.75); g.add(tl);
  // Legs
  const legG = new THREE.CylinderGeometry(0.07,0.05,0.9,6);
  [[0.22,0.45,0.38],[-0.22,0.45,0.38],[0.22,0.45,-0.32],[-0.22,0.45,-0.32]].forEach((p,i)=>{
    const l = new THREE.Mesh(legG, mat);
    l.position.set(...p); l.castShadow=true; l.name='leg'+i; g.add(l);
  });
  // Antlers (male, random)
  if (Math.random() > 0.45) {
    [-1,1].forEach(s=>{
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.05,0.5,5), dark);
      a.position.set(s*0.12,2.05,0.72); a.rotation.z=s*0.3; g.add(a);
      const a2= new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.03,0.3,5), dark);
      a2.position.set(s*0.2,2.3,0.68); a2.rotation.z=s*0.7; g.add(a2);
    });
  }
  return g;
}

// ─── Rabbit ──────────────────────────────────────────────────────────────────
function makeRabbit() {
  const g    = new THREE.Group();
  const mat  = new THREE.MeshLambertMaterial({ color: 0x9a8c7a });
  const dark = new THREE.MeshBasicMaterial({ color: 0x111100 });
  // Body
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.18,7,6), mat);
  b.scale.set(1,0.85,1.3); b.position.y=0.22; b.castShadow=true; g.add(b);
  // Head
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.13,7,6), mat);
  h.position.set(0,0.4,0.2); h.castShadow=true; g.add(h);
  // Ears
  [-1,1].forEach(s=>{
    const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.03,0.22,4,6), mat);
    e.position.set(s*0.07,0.65,0.16); g.add(e);
  });
  // Eyes
  [-1,1].forEach(s=>{
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.025,5,4), dark);
    e.position.set(s*0.08,0.42,0.3); g.add(e);
  });
  // Tail
  const tl = new THREE.Mesh(new THREE.SphereGeometry(0.07,5,4), new THREE.MeshLambertMaterial({color:0xffffff}));
  tl.position.set(0,0.22,-0.2); g.add(tl);
  // Legs
  [[0.1,0.08,0.12],[-0.1,0.08,0.12],[0.1,0.08,-0.1],[-0.1,0.08,-0.1]].forEach(p=>{
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.025,0.2,5), mat);
    l.position.set(...p); g.add(l);
  });
  return g;
}

// ─── Animal State ─────────────────────────────────────────────────────────────
class Animal {
  constructor(mesh, maxHealth, speed, type) {
    this.mesh     = mesh;
    this.health   = maxHealth;
    this.maxHealth= maxHealth;
    this.speed    = speed;
    this.type     = type; // 'deer' | 'rabbit'
    this.state    = 'idle'; // idle | wander | flee | dead
    this.target   = new THREE.Vector3();
    this.vel      = new THREE.Vector3();
    this.timer    = Math.random() * 5;
    this.dead     = false;
    this.legPhase = 0;
    // random start
    const x = (Math.random()-0.5)*WORLD_SIZE*0.8;
    const z = (Math.random()-0.5)*WORLD_SIZE*0.8;
    mesh.position.set(x, terrainY(x,z)+0.05, z);
    scene.add(mesh);
  }
  update(dt, wolfPos) {
    if (this.dead) return;
    this.timer -= dt;
    const dist = this.mesh.position.distanceTo(wolfPos);

    const fleeR = this.type === 'deer' ? 22 : 14;
    if (dist < fleeR) {
      this.state = 'flee';
      this.timer = 4;
    }
    if (this.state === 'flee' && this.timer < 0) this.state = 'wander';

    if (this.state === 'idle' && this.timer < 0) {
      this.state = Math.random() > 0.3 ? 'wander' : 'idle';
      this.timer = 2 + Math.random() * 5;
      if (this.state === 'wander') {
        const a = Math.random() * Math.PI * 2;
        const r = 8 + Math.random() * 25;
        this.target.set(
          this.mesh.position.x + Math.cos(a)*r,
          0,
          this.mesh.position.z + Math.sin(a)*r
        );
        // clamp to world
        this.target.x = Math.max(-WORLD_SIZE/2+5, Math.min(WORLD_SIZE/2-5, this.target.x));
        this.target.z = Math.max(-WORLD_SIZE/2+5, Math.min(WORLD_SIZE/2-5, this.target.z));
      }
    }

    let spd = this.speed;
    let dx=0, dz=0;

    if (this.state === 'flee') {
      spd *= 2.2;
      dx = this.mesh.position.x - wolfPos.x;
      dz = this.mesh.position.z - wolfPos.z;
      const l = Math.sqrt(dx*dx+dz*dz)+0.001;
      dx/=l; dz/=l;
    } else if (this.state === 'wander') {
      dx = this.target.x - this.mesh.position.x;
      dz = this.target.z - this.mesh.position.z;
      const l = Math.sqrt(dx*dx+dz*dz);
      if (l < 1) { this.state='idle'; this.timer=2+Math.random()*4; return; }
      dx/=l; dz/=l;
    }

    if (dx !== 0 || dz !== 0) {
      this.mesh.position.x += dx*spd*dt;
      this.mesh.position.z += dz*spd*dt;
      const ty = terrainY(this.mesh.position.x, this.mesh.position.z);
      this.mesh.position.y = Math.max(ty + 0.05, 0.35);
      this.mesh.rotation.y = Math.atan2(dx, dz);
      // leg anim
      this.legPhase += spd * dt * 5;
      ['leg0','leg2'].forEach(n=>{
        const l = this.mesh.getObjectByName(n);
        if (l) l.rotation.x = Math.sin(this.legPhase)*0.5;
      });
      ['leg1','leg3'].forEach(n=>{
        const l = this.mesh.getObjectByName(n);
        if (l) l.rotation.x = -Math.sin(this.legPhase)*0.5;
      });
    }

    // clamp
    this.mesh.position.x = Math.max(-WORLD_SIZE/2+5, Math.min(WORLD_SIZE/2-5, this.mesh.position.x));
    this.mesh.position.z = Math.max(-WORLD_SIZE/2+5, Math.min(WORLD_SIZE/2-5, this.mesh.position.z));
  }
  takeDamage(amt) {
    if (this.dead) return;
    this.health -= amt;
    this.state   = 'flee';
    this.timer   = 8;
    if (this.health <= 0) {
      this.dead = true;
      this.mesh.rotation.z = Math.PI/2;
      this.mesh.position.y = terrainY(this.mesh.position.x, this.mesh.position.z);
    }
  }
}

const animals = [];
for (let i=0;i<DEER_COUNT;  i++) animals.push(new Animal(makeDeer(),   60, 4.5, 'deer'));
for (let i=0;i<RABBIT_COUNT;i++) animals.push(new Animal(makeRabbit(), 20, 3.8, 'rabbit'));

// ─── Player State ─────────────────────────────────────────────────────────────
const player = {
  pos:     new THREE.Vector3(0, terrainY(0,0)+1.8, 0),
  vel:     new THREE.Vector3(),
  yaw:     0,
  pitch:   0,
  health:  100,
  hunger:  100,
  thirst:  100,
  stamina: 100,
  grounded:false,
  kills:   0,
  day:     1,
  legPhase:0,
  attacking:false,
  attackCooldown:0,
  howling: false,
  howlTimer:0,
  dead:    false,
};

// ─── Input ────────────────────────────────────────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => { keys[e.code] = true;  });
document.addEventListener('keyup',   e => { keys[e.code] = false; });

let mouseX=0, mouseY=0, pointerLocked=false;
document.addEventListener('mousemove', e => {
  if (!pointerLocked) return;
  mouseX += e.movementX * 0.0018;
  mouseY += e.movementY * 0.0018;
  mouseY  = Math.max(-0.5, Math.min(0.7, mouseY));
});
canvas.addEventListener('click', () => { if (!pointerLocked) canvas.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
});

// ─── HUD refs ─────────────────────────────────────────────────────────────────
const healthFill  = document.getElementById('health-fill');
const hungerFill  = document.getElementById('hunger-fill');
const thirstFill  = document.getElementById('thirst-fill');
const staminaFill = document.getElementById('stamina-fill');
const killsLabel  = document.getElementById('kills-label');
const packLabel   = document.getElementById('pack-label');
const dayLabel    = document.getElementById('day-label');
const notifEl     = document.getElementById('notif');
const vigEl       = document.getElementById('vignette');
const howlRing    = document.getElementById('howl-ring');
const deathScreen = document.getElementById('death');
const deathReason = document.getElementById('death-reason');

let notifTimer = 0;
function showNotif(msg) {
  notifEl.textContent = msg;
  notifEl.classList.add('show');
  notifTimer = 3;
}

let vigTimer = 0;
function flashHurt() {
  vigEl.classList.add('hurt');
  vigTimer = 1.2;
}

// ─── Day/night cycle ─────────────────────────────────────────────────────────
let timeOfDay = 0.25; // 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk, 1=midnight
const skyDawn   = new THREE.Color(0xffa060);
const skyNoon   = new THREE.Color(0x87ceeb);
const skyDusk   = new THREE.Color(0xff7040);
const skyNight  = new THREE.Color(0x050818);

function lerpColor(a,b,t) { return new THREE.Color().lerpColors(a,b,t); }
function skyColor(t) {
  if (t < 0.25) return lerpColor(skyNight, skyDawn,  t/0.25);
  if (t < 0.5)  return lerpColor(skyDawn,  skyNoon,  (t-0.25)/0.25);
  if (t < 0.75) return lerpColor(skyNoon,  skyDusk,  (t-0.5)/0.25);
  return lerpColor(skyDusk, skyNight, (t-0.75)/0.25);
}

function updateSky(dt) {
  timeOfDay = (timeOfDay + dt/DAY_LENGTH) % 1;

  const sc   = skyColor(timeOfDay);
  const sc2  = skyColor((timeOfDay+0.5)%1);
  scene.fog.color.copy(sc);
  renderer.setClearColor(sc);

  // Paint sphere verts
  const pos = skyGeo.attributes.position;
  const col = skyGeo.attributes.color;
  for (let i=0;i<pos.count;i++) {
    const y = pos.getY(i);
    const t = Math.max(0,Math.min(1,(y+10)/700));
    const c = lerpColor(sc, new THREE.Color(sc).lerp(sc2,0.3), t);
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;

  // Sun arc
  const sunAngle = (timeOfDay - 0.25) * Math.PI * 2;
  sun.position.set(Math.cos(sunAngle)*200, Math.sin(sunAngle)*200, -80);
  sun.intensity = Math.max(0, Math.sin(sunAngle)) * 2.8;

  // Moon
  moonLight.position.set(-Math.cos(sunAngle)*200, -Math.sin(sunAngle)*200, 80);
  moonLight.intensity = Math.max(0, -Math.sin(sunAngle)) * 0.5;

  // Stars visible at night
  starMesh.material.opacity = Math.max(0, -Math.sin(sunAngle)*1.4);
  starMesh.material.transparent = true;

  ambientLight.intensity = 0.3 + Math.max(0,Math.sin(sunAngle))*0.5;

  // Day counter
  const dayNum   = Math.floor(timeOfDay * 24);
  let   timeStr  = '';
  if (dayNum <  5) timeStr = 'Night';
  else if (dayNum < 8)  timeStr = 'Dawn';
  else if (dayNum < 12) timeStr = 'Morning';
  else if (dayNum < 14) timeStr = 'Noon';
  else if (dayNum < 17) timeStr = 'Afternoon';
  else if (dayNum < 20) timeStr = 'Dusk';
  else timeStr = 'Night';
  dayLabel.textContent = timeStr + ' · Day ' + player.day;
}

// ─── Water detection ──────────────────────────────────────────────────────────
function isInWater(pos) { return terrainY(pos.x, pos.z) < 0.32; }

// ─── Howl ─────────────────────────────────────────────────────────────────────
function triggerHowl() {
  if (player.howling) return;
  player.howling  = true;
  player.howlTimer= 2.2;
  howlRing.classList.remove('active');
  void howlRing.offsetWidth;
  howlRing.classList.add('active');
  showNotif('You howl into the darkness...');
  // Mate comes closer when you howl
  mate.state = 'follow';
  mate.timer = 10;
  // Scare animals
  animals.forEach(a => {
    if (!a.dead && a.mesh.position.distanceTo(player.pos) < HOWL_RADIUS) {
      a.state = 'flee';
      a.timer = 6;
    }
  });
}

// ─── Attack ───────────────────────────────────────────────────────────────────
function tryAttack() {
  if (player.attackCooldown > 0 || player.stamina < 8) return;
  player.attacking      = true;
  player.attackCooldown = 0.6;
  player.stamina        = Math.max(0, player.stamina - 8);

  let hit = false;
  animals.forEach(a => {
    if (a.dead) return;
    const d = a.mesh.position.distanceTo(player.pos);
    if (d < ATTACK_RANGE) {
      const dmg = 18 + Math.random()*12;
      a.takeDamage(dmg);
      hit = true;
      if (a.dead) {
        player.kills++;
        killsLabel.textContent = 'Kills: ' + player.kills;
        player.hunger = Math.min(100, player.hunger + (a.type==='deer' ? 45 : 18));
        showNotif(a.type === 'deer' ? 'You bring down a deer. The pack will feast.' : 'A rabbit caught. Quick meal.');
        if (player.kills === 5)  { packLabel.textContent='Pack: Beta Wolf'; showNotif('You earn your place. Pack: Beta.'); }
        if (player.kills === 15) { packLabel.textContent='Pack: Alpha Wolf'; showNotif('The pack bows. You are Alpha.'); }
      }
    }
  });
  if (!hit) {
    // Drink if in water
    if (isInWater(player.pos)) {
      player.thirst = Math.min(100, player.thirst + 35);
      showNotif('You drink from the stream. Refreshing.');
    }
  }
}

// ─── Physics & movement ───────────────────────────────────────────────────────
const cameraOffset = new THREE.Vector3(0, 1.8, -4.5);
const lookTarget   = new THREE.Vector3();

function updatePlayer(dt) {
  if (player.dead) return;

  // Yaw from mouse
  player.yaw = -mouseX;

  // Direction
  const fwd  = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right= new THREE.Vector3( Math.cos(player.yaw), 0, -Math.sin(player.yaw));

  const sprinting = keys['ShiftLeft'] || keys['ShiftRight'];
  const moving    = keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'];

  let spd = WOLF_SPEED * (sprinting && player.stamina > 0 ? SPRINT_MULT : 1.0);
  let move = new THREE.Vector3();

  if (keys['KeyW']) move.addScaledVector(fwd, 1);
  if (keys['KeyS']) move.addScaledVector(fwd,-1);
  if (keys['KeyD']) move.addScaledVector(right,1);
  if (keys['KeyA']) move.addScaledVector(right,-1);

  if (move.lengthSq() > 0) { move.normalize(); }
  player.vel.x = move.x * spd;
  player.vel.z = move.z * spd;

  // Gravity
  const ty = terrainY(player.pos.x, player.pos.z) + 0.9;
  if (player.pos.y > ty) {
    player.vel.y -= GRAVITY * dt;
  } else {
    player.vel.y  = 0;
    player.pos.y  = ty;
    player.grounded = true;
  }

  player.pos.addScaledVector(player.vel, dt);

  // World bounds
  player.pos.x = Math.max(-WORLD_SIZE/2+5, Math.min(WORLD_SIZE/2-5, player.pos.x));
  player.pos.z = Math.max(-WORLD_SIZE/2+5, Math.min(WORLD_SIZE/2-5, player.pos.z));

  // Stamina
  if (sprinting && moving) {
    player.stamina = Math.max(0, player.stamina - 18*dt);
  } else {
    player.stamina = Math.min(100, player.stamina + 12*dt);
  }

  // Vitals decay
  const baseRate = 1.0 / 160;
  player.hunger = Math.max(0, player.hunger - baseRate*dt*100);
  player.thirst = Math.max(0, player.thirst - baseRate*1.4*dt*100);

  // Auto-drink in water
  if (isInWater(player.pos)) {
    player.thirst = Math.min(100, player.thirst + 6*dt);
  }

  // Starvation / dehydration damage
  if (player.hunger  < 10) player.health = Math.max(0, player.health - 4*dt);
  if (player.thirst  < 10) player.health = Math.max(0, player.health - 6*dt);
  if (player.hunger  > 50 && player.thirst > 50) player.health = Math.min(100, player.health + 2*dt);

  // Death
  if (player.health <= 0 && !player.dead) {
    player.dead = true;
    let reason = 'The wilderness claimed you.';
    if (player.hunger < 10)  reason = 'Starvation claimed your spirit.';
    if (player.thirst < 10)  reason = 'Thirst consumed you.';
    deathReason.textContent = reason;
    deathScreen.classList.add('show');
    document.exitPointerLock();
  }

  // Attack cooldown
  if (player.attackCooldown > 0) player.attackCooldown -= dt;
  if (player.attacking && player.attackCooldown < 0.3) player.attacking = false;

  // Howl
  if (keys['Space'] && !player.howling) triggerHowl();
  if (player.howling) {
    player.howlTimer -= dt;
    if (player.howlTimer < 0) player.howling = false;
  }

  // E — attack or drink
  if (keys['KeyE']) tryAttack();

  // F — bond / mate
  packState.eCooldown = Math.max(0, packState.eCooldown - dt);
  if (keys['KeyF'] && !fWasDown) { fWasDown = true; tryBondOrMate(); }
  if (!keys['KeyF']) fWasDown = false;

  // Proximity prompt for mate
  const mateDist = mateMesh.position.distanceTo(player.pos);
  if (mateDist < BOND_RANGE && !packState.mated && packState.bondLevel < 3 && notifTimer <= 0) {
    notifEl.textContent = 'Press F to bond with her';
    notifEl.classList.add('show');
  } else if (mateDist < BOND_RANGE && packState.mated && !packState.pregnant && notifTimer <= 0) {
    notifEl.textContent = 'Press F to start a litter';
    notifEl.classList.add('show');
  }

  // Wolf mesh
  wolf.position.copy(player.pos);
  wolf.position.y -= 0.9;
  if (move.lengthSq() > 0) {
    wolf.rotation.y = Math.atan2(move.x, move.z);
  }

  // Walk animation
  if (moving) {
    player.legPhase += spd * dt * 3.5;
    ['leg0','leg2'].forEach(n=>{
      const l = wolf.getObjectByName(n);
      if (l) l.rotation.x = Math.sin(player.legPhase)*0.65;
    });
    ['leg1','leg3'].forEach(n=>{
      const l = wolf.getObjectByName(n);
      if (l) l.rotation.x = -Math.sin(player.legPhase)*0.65;
    });
    // Tail wag when running
    const tail = wolf.getObjectByName('tail');
    if (tail) tail.rotation.y = Math.sin(player.legPhase*2)*0.4;
  } else {
    // Idle breathing
    const br = Math.sin(Date.now()*0.002)*0.03;
    wolf.children[0] && (wolf.children[0].scale.y = 0.85 + br);
  }

  // Camera — 3rd person chase
  const camPos = new THREE.Vector3();
  const offset = cameraOffset.clone()
    .applyEuler(new THREE.Euler(mouseY*0.6, player.yaw, 0, 'YXZ'));
  camPos.copy(player.pos).add(offset);

  // Don't go underground
  const camTY = terrainY(camPos.x, camPos.z) + 0.4;
  if (camPos.y < camTY) camPos.y = camTY;

  camera.position.lerp(camPos, 0.12);
  lookTarget.set(player.pos.x, player.pos.y + 0.8, player.pos.z);
  camera.lookAt(lookTarget);

  // HUD
  healthFill.style.width  = player.health  + '%';
  hungerFill.style.width  = player.hunger  + '%';
  thirstFill.style.width  = player.thirst  + '%';
  staminaFill.style.width = player.stamina + '%';

  // Low health vignette
  if (player.health < 30) {
    vigEl.classList.add('hurt');
  } else {
    vigEl.classList.remove('hurt');
  }
}

// ─── Respawn ──────────────────────────────────────────────────────────────────
function respawn() {
  player.health  = 100; player.hunger = 100;
  player.thirst  = 100; player.stamina=100;
  player.kills   = 0; player.day = 1; player.dead = false;
  player.pos.set(0, terrainY(0,0)+1.8, 0);
  player.vel.set(0,0,0);
  killsLabel.textContent = 'Kills: 0';
  // Reset pack
  packState.bondLevel = 0; packState.mated = false;
  packState.pregnant  = false; packState.gestationTimer = 0;
  packState.pups.forEach(p => scene.remove(p.mesh));
  packState.pups.length = 0;
  mateMesh.position.set(mateStartX, terrainY(mateStartX, mateStartZ), mateStartZ);
  mate.state = 'wander';
  pupLabel.style.display = 'none';
  updatePackLabel();
  deathScreen.classList.remove('show');
  // Revive animals
  animals.forEach(a => {
    a.dead   = false;
    a.health = a.maxHealth;
    a.state  = 'idle';
    a.mesh.rotation.z = 0;
    const x = (Math.random()-0.5)*WORLD_SIZE*0.8;
    const z = (Math.random()-0.5)*WORLD_SIZE*0.8;
    a.mesh.position.set(x, terrainY(x,z)+0.05, z);
  });
}

document.getElementById('respawn-btn').addEventListener('click', respawn);

// ─── Splash start ─────────────────────────────────────────────────────────────
const splash = document.getElementById('splash');
document.getElementById('start-btn').addEventListener('click', () => {
  splash.classList.add('hidden');
  canvas.requestPointerLock();
  setTimeout(() => splash.style.display='none', 1100);
});

// ─── Notification timer ───────────────────────────────────────────────────────
// ─── Main loop ────────────────────────────────────────────────────────────────
let lastTime = 0;

// Day tick
let dayTick = 0;
const prevDay = { t: 0 };

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime  = now;

  if (!player.dead) {
    updatePlayer(dt);
    animals.forEach(a => a.update(dt, player.pos));
    updateMate(dt);
    updatePups(dt);
    updateHearts(dt);
    tickGestation(dt);
    updateSky(dt);

    // Day count
    dayTick += dt;
    if (dayTick > DAY_LENGTH) { dayTick=0; player.day++; }

    // Notif timer
    if (notifTimer > 0) {
      notifTimer -= dt;
      if (notifTimer <= 0) notifEl.classList.remove('show');
    }

    // Vignette for low health (pulsing)
    if (player.health < 30) {
      const pulse = Math.sin(Date.now()*0.004)*0.5+0.5;
      vigEl.style.background = `radial-gradient(ellipse at center, transparent 40%, rgba(120,0,0,${0.3+pulse*0.3}) 100%)`;
    } else {
      vigEl.style.background = '';
    }
  }

  renderer.render(scene, camera);
}

requestAnimationFrame(t => { lastTime=t; loop(t); });

// Show first-time notif after a moment
setTimeout(() => showNotif('Click to lock mouse. W/A/S/D to move. Hunt. Survive.'), 2200);
