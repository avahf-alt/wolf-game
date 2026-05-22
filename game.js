import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const WORLD_SIZE     = 600;
const TERRAIN_SEGS   = 140;
const TREE_COUNT     = 1000;
const GRASS_COUNT    = 5000;
const ROCK_COUNT     = 200;
const DEER_COUNT     = 14;
const RABBIT_COUNT   = 22;
const DAY_LENGTH     = 240;
const WOLF_SPEED     = 7.5;
const SPRINT_MULT    = 2.0;
const GRAVITY        = 28;
const ATTACK_RANGE   = 3.2;
const HOWL_RADIUS    = 60;
const BOND_RANGE     = 4.5;
const GESTATION_DAYS = 2;
const PUP_GROW_DAYS  = 5;
const CROUCH_MULT    = 0.35;
const POUNCE_RANGE   = 9;
const DEN_FOOD_MAX   = 5;
const BERRY_COUNT    = 60;
const FISH_COUNT     = 18;
const LAKE_X         = -160;
const LAKE_Z         = -200;
const LAKE_R         = 62;
const LAKE_Y         = 0.65;

// ─── Noise ────────────────────────────────────────────────────────────────────
function hash(x,y){let n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n)}
function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y);const fx=x-ix,fy=y-iy;const ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);return a+(b-a)*ux+(c-a)*uy+(d-a)*ux*uy-((b-a)*ux+(c-a)*uy)*ux*uy+(d-b-c+a)*ux*uy}
function fbm(x,y,o=6){let v=0,a=0.5,f=1,m=0;for(let i=0;i<o;i++){v+=a*noise(x*f,y*f);m+=a;a*=0.5;f*=2}return v/m}
function terrainY(x,z){const s=0.004;const h=fbm(x*s+100,z*s+200);return h*h*35-2}

// ─── Mobile detect ────────────────────────────────────────────────────────────
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)||navigator.maxTouchPoints>1;

// ─── Wolf presets ─────────────────────────────────────────────────────────────
const COAT_PRESETS = [
  { name:'Mystic',  base:0x080608, saddle:0x120008, belly:0x141014, sock:0x0c080c, eye:0x88ddff, pattern:'mystic' },
  { name:'Timber',  base:0x7a7268, saddle:0x252218, belly:0xcecab8, sock:0xd8d4c4, eye:0xffee44 },
  { name:'Arctic',  base:0xf2f0ec, saddle:0xd8d6d0, belly:0xffffff, sock:0xffffff, eye:0x88ccff },
  { name:'Obsidian',base:0x18180e, saddle:0x080806, belly:0x2e2e28, sock:0x1e1e18, eye:0xff8800 },
  { name:'Copper',  base:0x8a4c28, saddle:0x4e2010, belly:0xd4906a, sock:0xe0b080, eye:0xffcc44 },
  { name:'Silver',  base:0x9aa0a8, saddle:0x5a6068, belly:0xe4e8ec, sock:0xdde0e4, eye:0x66bbff },
  { name:'Tundra',  base:0xb0a87a, saddle:0x6a6030, belly:0xe4ddb8, sock:0xd8d0a0, eye:0xaacc44 },
  { name:'Shadow',  base:0x3c3a30, saddle:0x181610, belly:0x6a6858, sock:0x505040, eye:0xff6622 },
  { name:'Crimson', base:0x8a3820, saddle:0x481208, belly:0xc47858, sock:0xd09070, eye:0xffdd44 },
];
const EYE_COLORS = [
  { color:0xffee44, label:'Amber'  },
  { color:0xff8800, label:'Gold'   },
  { color:0x88ccff, label:'Ice'    },
  { color:0x44ff88, label:'Jade'   },
  { color:0xff4466, label:'Ember'  },
  { color:0xffffff, label:'White'  },
  { color:0xff0808, label:'Red'    },
];

let wolfConfig = {
  preset:   0,    // Mystic — jet black coat
  eyeIdx:   6,    // Red eyes
  scale:    1.0,
  name:     'Shadow',
  wings:    true, // huge red wings
};

// ─── Splash boot — register immediately so any later crash can't block it ────
{
  const splashEl = document.getElementById('splash');
  const startBtn  = document.getElementById('start-btn');
  function doStartGame(){
    splashEl.classList.add('hidden');
    try { if(!isMobile) document.getElementById('canvas').requestPointerLock(); } catch(e){}
    setTimeout(()=>{ splashEl.style.display='none'; }, 1100);
  }
  if(startBtn) startBtn.addEventListener('click', doStartGame);
}

// ─── Scene Setup ─────────────────────────────────────────────────────────────
const canvas   = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.toneMapping       = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;
renderer.outputColorSpace  = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog   = new THREE.FogExp2(0xb8d8ea, 0.007);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.1, 800);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  if (custRenderer) {
    custRenderer.setSize(custCanvasEl.clientWidth, custCanvasEl.clientHeight);
    custCamera.aspect = custCanvasEl.clientWidth / custCanvasEl.clientHeight;
    custCamera.updateProjectionMatrix();
  }
});

// ─── Lighting ─────────────────────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0x445566, 1.5);
scene.add(ambientLight);

const sun = new THREE.DirectionalLight(0xfff0d0, 4.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 400;
sun.shadow.camera.left = sun.shadow.camera.bottom = -150;
sun.shadow.camera.right = sun.shadow.camera.top = 150;
sun.shadow.bias = -0.0003;
scene.add(sun);

const moonLight = new THREE.DirectionalLight(0x3050a0, 0.5);
scene.add(moonLight);

const hemi = new THREE.HemisphereLight(0x7090c0, 0x3a5530, 1.0);
scene.add(hemi);

// Fill light for soft shadows under canopy
const fillLight = new THREE.DirectionalLight(0x204030, 0.3);
fillLight.position.set(-1, 0.5, -1);
scene.add(fillLight);

// ─── Sky ──────────────────────────────────────────────────────────────────────
const skyGeo  = new THREE.SphereGeometry(700, 32, 16);
skyGeo.scale(-1,1,1);
const skyMat  = new THREE.MeshBasicMaterial({ vertexColors: true });
const skyCols = new Float32Array(skyGeo.attributes.position.count*3);
skyGeo.setAttribute('color', new THREE.BufferAttribute(skyCols,3));
const skyMesh = new THREE.Mesh(skyGeo, skyMat);
scene.add(skyMesh);

// Stars
const starVerts = [];
for(let i=0;i<3000;i++){
  const t=Math.random()*Math.PI*2, p=Math.acos(2*Math.random()-1), r=680;
  starVerts.push(r*Math.sin(p)*Math.cos(t), r*Math.cos(p), r*Math.sin(p)*Math.sin(t));
}
const starGeo  = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts,3));
const starMat  = new THREE.PointsMaterial({ color:0xffffff, size:1.6, sizeAttenuation:true });
const starMesh = new THREE.Points(starGeo, starMat);
scene.add(starMesh);

// Sun disc
const sunDiscGeo = new THREE.CircleGeometry(8, 24);
const sunDiscMat = new THREE.MeshBasicMaterial({ color:0xfffde0, transparent:true, opacity:0.95, side:THREE.DoubleSide });
const sunDisc    = new THREE.Mesh(sunDiscGeo, sunDiscMat);
scene.add(sunDisc);
// Glow halo
const haloGeo = new THREE.CircleGeometry(18, 24);
const haloMat = new THREE.MeshBasicMaterial({ color:0xffd880, transparent:true, opacity:0.22, side:THREE.DoubleSide });
const sunHalo = new THREE.Mesh(haloGeo, haloMat);
scene.add(sunHalo);

// Moon disc
const moonGeo  = new THREE.CircleGeometry(5, 20);
const moonMat  = new THREE.MeshBasicMaterial({ color:0xd8e8ff, transparent:true, opacity:0.9, side:THREE.DoubleSide });
const moonDisc = new THREE.Mesh(moonGeo, moonMat);
scene.add(moonDisc);

// Clouds (billboard planes)
const cloudMat = new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.55, side:THREE.DoubleSide });
const clouds = [];
for(let i=0;i<10;i++){
  const cg = new THREE.PlaneGeometry(80+Math.random()*80, 20+Math.random()*18);
  const cm = new THREE.Mesh(cg, cloudMat.clone());
  cm.rotation.x = 0.1 + Math.random()*0.1;
  const ang = Math.random()*Math.PI*2, rad = 200+Math.random()*120;
  cm.position.set(Math.cos(ang)*rad, 60+Math.random()*40, Math.sin(ang)*rad);
  cm.userData.speed = 0.8+Math.random()*0.6;
  cm.userData.ang   = ang;
  cm.userData.rad   = rad;
  scene.add(cm);
  clouds.push(cm);
}

// ─── Terrain ─────────────────────────────────────────────────────────────────
const tGeo   = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, TERRAIN_SEGS, TERRAIN_SEGS);
tGeo.rotateX(-Math.PI/2);
const posAttr = tGeo.attributes.position;
for(let i=0;i<posAttr.count;i++){
  const x=posAttr.getX(i), z=posAttr.getZ(i);
  posAttr.setY(i, terrainY(x,z));
}
tGeo.computeVertexNormals();

const tCols   = new Float32Array(posAttr.count*3);
const norAttr = tGeo.attributes.normal;
for(let i=0;i<posAttr.count;i++){
  const y  = posAttr.getY(i);
  const ny = norAttr.getY(i);
  const slope = Math.max(0, Math.min(1, ny));
  const moisture = noise(posAttr.getX(i)*0.008, posAttr.getZ(i)*0.008);
  let r, g, b;
  // Base: rich grass
  r=0.18+moisture*0.06; g=0.28+moisture*0.1; b=0.10;
  // Water edge: dark wet mud
  if(y<0.8){ r=0.15; g=0.18; b=0.12; }
  // Mid: varied grass
  if(y>2 && y<10){ r=0.2+moisture*0.05; g=0.3+moisture*0.08; b=0.11; }
  // High: rocky
  if(y>10){ const t2=(y-10)/8; r=0.45+t2*0.15; g=0.42+t2*0.12; b=0.38+t2*0.1; }
  // Peaks: snow
  if(y>20){ const sn=Math.min(1,(y-20)/5); r=r*(1-sn)+0.92*sn; g=g*(1-sn)+0.94*sn; b=b*(1-sn)+0.98*sn; }
  // Cliff: grey rock overrides
  const grey = 0.38+Math.random()*0.08;
  r=r*slope+grey*(1-slope); g=g*slope+(grey*0.93)*(1-slope); b=b*slope+(grey*0.88)*(1-slope);
  // Micro noise
  r+=( Math.random()-0.5)*0.03; g+=(Math.random()-0.5)*0.03; b+=(Math.random()-0.5)*0.02;
  tCols[i*3]=r; tCols[i*3+1]=g; tCols[i*3+2]=b;
}
tGeo.setAttribute('color', new THREE.BufferAttribute(tCols,3));
const tMat    = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.92, metalness:0.0 });
const terrain = new THREE.Mesh(tGeo, tMat);
terrain.receiveShadow = true;
scene.add(terrain);

// ─── Water ────────────────────────────────────────────────────────────────────
const waterGeo = new THREE.PlaneGeometry(WORLD_SIZE*2, WORLD_SIZE*2, 60, 60);
waterGeo.rotateX(-Math.PI/2);
const waterMat = new THREE.MeshStandardMaterial({
  color:0x1a4a7a, transparent:true, opacity:0.78, roughness:0.05, metalness:0.3,
  envMapIntensity:0.8,
});
const waterMesh = new THREE.Mesh(waterGeo, waterMat);
waterMesh.position.y = 0.3;
waterMesh.receiveShadow = true;
scene.add(waterMesh);
// Store base water Y for animation
const waterBaseY = [];
const waterPos = waterGeo.attributes.position;
for(let i=0;i<waterPos.count;i++) waterBaseY.push(waterPos.getY(i));

// ─── Trees ────────────────────────────────────────────────────────────────────
const trunkMat  = new THREE.MeshStandardMaterial({ color:0x3d2510, roughness:0.95, metalness:0 });
const leaf1Mat  = new THREE.MeshStandardMaterial({ color:0x1e4a1e, roughness:0.9,  metalness:0 });
const leaf2Mat  = new THREE.MeshStandardMaterial({ color:0x254d20, roughness:0.9,  metalness:0 });
const piLeafMat = new THREE.MeshStandardMaterial({ color:0x183318, roughness:0.88, metalness:0 });
const leaf3Mat  = new THREE.MeshStandardMaterial({ color:0x2e5a18, roughness:0.9,  metalness:0 });

function makeTree(x, z, type) {
  const g  = new THREE.Group();
  const ty = terrainY(x, z);
  if(ty < 0.6) return null;
  if(type===0){
    // Pine — layered cones
    const h = 5+Math.random()*4;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.3,h,8), trunkMat);
    trunk.position.y=h/2; trunk.castShadow=true; g.add(trunk);
    const layers = 5+Math.floor(Math.random()*3);
    for(let i=0;i<layers;i++){
      const cr = (1.8+Math.random()*0.6)*(1-i/layers*0.55);
      const ch = (h*0.55)*(1-i/layers*0.3);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(cr,ch,9), piLeafMat);
      cone.position.y = h*0.45 + i*(h*0.38/(layers-1));
      cone.castShadow=true; g.add(cone);
    }
  } else if(type===1){
    // Broad deciduous
    const h = 5+Math.random()*6;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.38,h,9), trunkMat);
    trunk.position.y=h/2; trunk.castShadow=true; g.add(trunk);
    // Forking branches
    const cr  = 2.5+Math.random()*2.2;
    const mat = [leaf1Mat,leaf2Mat,leaf3Mat][Math.floor(Math.random()*3)];
    for(let k=0;k<3;k++){
      const ball = new THREE.Mesh(new THREE.SphereGeometry(cr*(0.7+Math.random()*0.5),9,7), mat);
      ball.position.set((Math.random()-0.5)*cr, h+cr*(0.4+Math.random()*0.4), (Math.random()-0.5)*cr);
      ball.castShadow=true; g.add(ball);
    }
  } else {
    // Birch — thin white trunk
    const h = 6+Math.random()*5;
    const birchMat = new THREE.MeshStandardMaterial({ color:0xd8d0c0, roughness:0.9, metalness:0 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.16,h,7), birchMat);
    trunk.position.y=h/2; trunk.castShadow=true; g.add(trunk);
    // Loose canopy
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.6+Math.random(),8,7), leaf3Mat);
    ball.position.y=h+1.2; ball.scale.set(1,0.75,1); ball.castShadow=true; g.add(ball);
  }
  g.position.set(x,ty,z);
  g.rotation.y=Math.random()*Math.PI*2;
  g.userData.baseRY = g.rotation.y;
  return g;
}

const treeObjects = [];
for(let i=0;i<TREE_COUNT;i++){
  const x    = (Math.random()-0.5)*WORLD_SIZE*0.92;
  const z    = (Math.random()-0.5)*WORLD_SIZE*0.92;
  const type = Math.random()<0.42 ? 0 : Math.random()<0.6 ? 1 : 2;
  const t    = makeTree(x,z,type);
  if(t){ scene.add(t); treeObjects.push(t); }
}

// ─── Rocks ────────────────────────────────────────────────────────────────────
const rockMat  = new THREE.MeshStandardMaterial({ color:0x545250, roughness:0.88, metalness:0.05 });
const rockMat2 = new THREE.MeshStandardMaterial({ color:0x6a6560, roughness:0.85, metalness:0.04 });
for(let i=0;i<ROCK_COUNT;i++){
  const x=( Math.random()-0.5)*WORLD_SIZE*0.9;
  const z=(Math.random()-0.5)*WORLD_SIZE*0.9;
  const ty=terrainY(x,z);
  const s=0.4+Math.random()*2.2;
  const r=new THREE.Mesh(new THREE.DodecahedronGeometry(s,0), Math.random()>0.5?rockMat:rockMat2);
  r.position.set(x,ty+s*0.45,z);
  r.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
  r.castShadow=r.receiveShadow=true;
  scene.add(r);
}

// Fallen logs
const logMat = new THREE.MeshStandardMaterial({ color:0x3a2810, roughness:0.97, metalness:0 });
for(let i=0;i<40;i++){
  const x=(Math.random()-0.5)*WORLD_SIZE*0.8, z=(Math.random()-0.5)*WORLD_SIZE*0.8;
  const ty=terrainY(x,z);
  if(ty<0.5) continue;
  const len=3+Math.random()*5;
  const log=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.22,len,8), logMat);
  log.position.set(x,ty+0.18,z);
  log.rotation.set(Math.random()*0.3, Math.random()*Math.PI, Math.PI/2+Math.random()*0.3);
  log.castShadow=log.receiveShadow=true;
  scene.add(log);
}

// ─── Spawn Pond (river pool next to start) ────────────────────────────────────
(function buildSpawnPond(){
  const cx=0, cz=-10; // right at spawn (player faces -Z)
  const pondY = 0.55;  // water surface height

  // Carve a bowl in the terrain so the water surface is always visible
  const pondFloor = pondY - 0.7; // well below water surface
  for(let i=0;i<posAttr.count;i++){
    const px=posAttr.getX(i), pz=posAttr.getZ(i);
    const d=Math.sqrt((px-cx)*(px-cx)+(pz-cz)*(pz-cz));
    if(d<8.5){
      posAttr.setY(i, pondFloor); // flat pond bed, guaranteed below water
    } else if(d<14){
      const t=(d-8.5)/5.5, ts=t*t*(3-2*t); // smooth step
      posAttr.setY(i, pondFloor*(1-ts)+posAttr.getY(i)*ts);
    }
  }
  posAttr.needsUpdate=true;
  tGeo.computeVertexNormals();

  // Pond water surface
  const pondGeo=new THREE.CircleGeometry(8.5,32);
  pondGeo.rotateX(-Math.PI/2);
  const pondMat=new THREE.MeshStandardMaterial({
    color:0x1a5888,transparent:true,opacity:0.84,roughness:0.04,metalness:0.35,
  });
  const pondMesh=new THREE.Mesh(pondGeo,pondMat);
  pondMesh.position.set(cx,pondY,cz);
  pondMesh.receiveShadow=true;
  scene.add(pondMesh);

  // Shallow shore gradient ring (darker)
  const shoreGeo=new THREE.RingGeometry(7,10,32);
  shoreGeo.rotateX(-Math.PI/2);
  const shoreMat=new THREE.MeshStandardMaterial({color:0x0e3a55,transparent:true,opacity:0.55,roughness:0.1});
  const shoreMesh=new THREE.Mesh(shoreGeo,shoreMat);
  shoreMesh.position.set(cx,pondY+0.01,cz);
  scene.add(shoreMesh);

  // Rocks around edge
  const pondRockMat=new THREE.MeshStandardMaterial({color:0x4a4840,roughness:0.88,metalness:0.06});
  const pondRockMat2=new THREE.MeshStandardMaterial({color:0x6a6560,roughness:0.84,metalness:0.05});
  for(let i=0;i<14;i++){
    const a=i/14*Math.PI*2+(Math.random()-0.5)*0.4;
    const r=8.2+Math.random()*1.6;
    const s=0.3+Math.random()*0.85;
    const rk=new THREE.Mesh(new THREE.DodecahedronGeometry(s,0), Math.random()>0.5?pondRockMat:pondRockMat2);
    rk.position.set(cx+Math.cos(a)*r, pondY-s*0.4, cz+Math.sin(a)*r);
    rk.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
    rk.castShadow=rk.receiveShadow=true;
    scene.add(rk);
  }
  // Some rocks inside the pond (exposed)
  for(let i=0;i<5;i++){
    const a=Math.random()*Math.PI*2, r=2+Math.random()*4;
    const s=0.18+Math.random()*0.28;
    const rk=new THREE.Mesh(new THREE.DodecahedronGeometry(s,0),pondRockMat);
    rk.position.set(cx+Math.cos(a)*r,pondY+s*0.3,cz+Math.sin(a)*r);
    rk.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
    scene.add(rk);
  }

  // Lily pads
  const lilyMat=new THREE.MeshStandardMaterial({color:0x2a5e18,roughness:0.9,metalness:0});
  const lilyFlowerMat=new THREE.MeshStandardMaterial({color:0xf8e8f0,roughness:0.7,emissive:new THREE.Color(0x180808)});
  for(let i=0;i<9;i++){
    const a=Math.random()*Math.PI*2, r=1.5+Math.random()*5;
    const pad=new THREE.Mesh(new THREE.CircleGeometry(0.35+Math.random()*0.25,10),lilyMat);
    pad.rotation.x=-Math.PI/2;
    pad.position.set(cx+Math.cos(a)*r, pondY+0.03, cz+Math.sin(a)*r);
    scene.add(pad);
    // Tiny flower on some pads
    if(Math.random()>0.5){
      const fl=new THREE.Mesh(new THREE.SphereGeometry(0.07,6,5),lilyFlowerMat);
      fl.position.set(cx+Math.cos(a)*r,pondY+0.1,cz+Math.sin(a)*r);
      scene.add(fl);
    }
  }

  // Reed / cattail stalks
  const reedMat=new THREE.MeshStandardMaterial({color:0x5a7a2a,roughness:0.95});
  const cattailMat=new THREE.MeshStandardMaterial({color:0x5a3010,roughness:0.92});
  for(let i=0;i<18;i++){
    const a=Math.random()*Math.PI*2, r=7.5+Math.random()*3;
    const h=0.9+Math.random()*1.2;
    const stalk=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.04,h,5),reedMat);
    stalk.position.set(cx+Math.cos(a)*r, pondY+h/2, cz+Math.sin(a)*r);
    scene.add(stalk);
    if(Math.random()>0.4){
      const head=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.28,7),cattailMat);
      head.position.set(cx+Math.cos(a)*r, pondY+h+0.1, cz+Math.sin(a)*r);
      scene.add(head);
    }
  }

  // River stream flowing south from pond (visual only)
  const streamMat=new THREE.MeshStandardMaterial({color:0x1a5070,transparent:true,opacity:0.7,roughness:0.06});
  for(let seg=0;seg<5;seg++){
    const sz=8+seg*3;
    const sg=new THREE.PlaneGeometry(3.5,sz);
    sg.rotateX(-Math.PI/2);
    const sm=new THREE.Mesh(sg,streamMat);
    sm.position.set(cx+2+seg*0.5, pondY, cz-7-seg*sz*0.5+sz*0.5);
    scene.add(sm);
    // rocks along stream
    for(let r=0;r<3;r++){
      const rk=new THREE.Mesh(new THREE.DodecahedronGeometry(0.2+Math.random()*0.3,0),pondRockMat);
      rk.position.set(cx+1+Math.random()*5, pondY+0.05, cz-7-seg*8+Math.random()*8);
      rk.rotation.set(Math.random(),Math.random(),Math.random());
      scene.add(rk);
    }
  }
})();

// ─── Huge Lake (southwest) ────────────────────────────────────────────────────
(function buildLake(){
  const lakeFloor = LAKE_Y - 0.85;
  for(let i=0;i<posAttr.count;i++){
    const px=posAttr.getX(i), pz=posAttr.getZ(i);
    const d=Math.sqrt((px-LAKE_X)*(px-LAKE_X)+(pz-LAKE_Z)*(pz-LAKE_Z));
    if(d<LAKE_R-2){
      posAttr.setY(i, lakeFloor);
    } else if(d<LAKE_R+22){
      const t=(d-(LAKE_R-2))/24, ts=t*t*(3-2*t);
      posAttr.setY(i, lakeFloor*(1-ts)+posAttr.getY(i)*ts);
    }
  }
  posAttr.needsUpdate=true;
  tGeo.computeVertexNormals();

  // Deep center
  const deepGeo=new THREE.CircleGeometry(LAKE_R*0.62,48); deepGeo.rotateX(-Math.PI/2);
  const deepMesh=new THREE.Mesh(deepGeo,new THREE.MeshStandardMaterial({color:0x0c1e30,transparent:true,opacity:0.94,roughness:0.02,metalness:0.6}));
  deepMesh.position.set(LAKE_X,LAKE_Y,LAKE_Z); scene.add(deepMesh);
  // Shallow ring
  const shallowGeo=new THREE.RingGeometry(LAKE_R*0.58,LAKE_R,48); shallowGeo.rotateX(-Math.PI/2);
  const shallowMesh=new THREE.Mesh(shallowGeo,new THREE.MeshStandardMaterial({color:0x1a5888,transparent:true,opacity:0.82,roughness:0.04,metalness:0.35}));
  shallowMesh.position.set(LAKE_X,LAKE_Y+0.01,LAKE_Z); scene.add(shallowMesh);
  // Shore gradient
  const shoreGeo=new THREE.RingGeometry(LAKE_R-3,LAKE_R+10,48); shoreGeo.rotateX(-Math.PI/2);
  const shoreMesh=new THREE.Mesh(shoreGeo,new THREE.MeshStandardMaterial({color:0x0e3a55,transparent:true,opacity:0.40,roughness:0.1}));
  shoreMesh.position.set(LAKE_X,LAKE_Y+0.02,LAKE_Z); scene.add(shoreMesh);

  // Shore rocks
  const rmA=new THREE.MeshStandardMaterial({color:0x4a4840,roughness:0.88,metalness:0.06});
  const rmB=new THREE.MeshStandardMaterial({color:0x6a6560,roughness:0.84,metalness:0.05});
  for(let i=0;i<36;i++){
    const a=i/36*Math.PI*2+(Math.random()-0.5)*0.25;
    const r=LAKE_R+0.5+Math.random()*3.5, s=0.4+Math.random()*1.4;
    const rk=new THREE.Mesh(new THREE.DodecahedronGeometry(s,0),Math.random()>0.5?rmA:rmB);
    rk.position.set(LAKE_X+Math.cos(a)*r,LAKE_Y-s*0.3,LAKE_Z+Math.sin(a)*r);
    rk.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
    rk.castShadow=rk.receiveShadow=true; scene.add(rk);
  }
  // Submerged rocks
  for(let i=0;i<12;i++){
    const a=Math.random()*Math.PI*2, r=8+Math.random()*LAKE_R*0.7, s=0.2+Math.random()*0.5;
    const rk=new THREE.Mesh(new THREE.DodecahedronGeometry(s,0),rmA);
    rk.position.set(LAKE_X+Math.cos(a)*r,LAKE_Y+s*0.2,LAKE_Z+Math.sin(a)*r);
    rk.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
    scene.add(rk);
  }

  // Lily pads
  const lilyM=new THREE.MeshStandardMaterial({color:0x2a5e18,roughness:0.9});
  const flowerM=new THREE.MeshStandardMaterial({color:0xf8e8f0,roughness:0.7,emissive:new THREE.Color(0x180808)});
  for(let i=0;i<40;i++){
    const a=Math.random()*Math.PI*2, r=4+Math.random()*LAKE_R*0.85;
    const pad=new THREE.Mesh(new THREE.CircleGeometry(0.42+Math.random()*0.32,10),lilyM);
    pad.rotation.x=-Math.PI/2;
    pad.position.set(LAKE_X+Math.cos(a)*r,LAKE_Y+0.03,LAKE_Z+Math.sin(a)*r);
    scene.add(pad);
    if(Math.random()>0.45){
      const fl=new THREE.Mesh(new THREE.SphereGeometry(0.075,6,5),flowerM);
      fl.position.set(LAKE_X+Math.cos(a)*r,LAKE_Y+0.12,LAKE_Z+Math.sin(a)*r); scene.add(fl);
    }
  }

  // Reeds and cattails
  const reedM=new THREE.MeshStandardMaterial({color:0x5a7a2a,roughness:0.95});
  const cattailM=new THREE.MeshStandardMaterial({color:0x5a3010,roughness:0.92});
  for(let i=0;i<65;i++){
    const a=Math.random()*Math.PI*2, r=LAKE_R-4+Math.random()*10;
    const h=1.3+Math.random()*2.0;
    const st=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.04,h,5),reedM);
    st.position.set(LAKE_X+Math.cos(a)*r,LAKE_Y+h/2,LAKE_Z+Math.sin(a)*r); scene.add(st);
    if(Math.random()>0.38){
      const hd=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.32,7),cattailM);
      hd.position.set(LAKE_X+Math.cos(a)*r,LAKE_Y+h+0.15,LAKE_Z+Math.sin(a)*r); scene.add(hd);
    }
  }

  // Small rocky islands
  const islandM=new THREE.MeshStandardMaterial({color:0x4e4a38,roughness:0.88});
  for(let i=0;i<4;i++){
    const a=(i/4)*Math.PI*2+Math.random()*0.8, r=14+Math.random()*28;
    const ix=LAKE_X+Math.cos(a)*r, iz=LAKE_Z+Math.sin(a)*r;
    const isl=new THREE.Mesh(new THREE.SphereGeometry(2.5+Math.random()*2,9,7),islandM);
    isl.scale.set(1,0.28,1); isl.position.set(ix,LAKE_Y+0.18,iz);
    isl.receiveShadow=isl.castShadow=true; scene.add(isl);
    if(Math.random()>0.3){
      const st=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.04,1.4,5),reedM);
      st.position.set(ix,LAKE_Y+0.85,iz); scene.add(st);
    }
  }
})();

// ─── Berry Bushes ─────────────────────────────────────────────────────────────
const berryBushes = [];
const bushMat  = new THREE.MeshStandardMaterial({ color:0x1e3e10, roughness:0.9 });
const berryMat = new THREE.MeshStandardMaterial({ color:0xcc2222, roughness:0.7, emissive:new THREE.Color(0x330000) });
for(let i=0;i<BERRY_COUNT;i++){
  const x=(Math.random()-0.5)*WORLD_SIZE*0.8, z=(Math.random()-0.5)*WORLD_SIZE*0.8;
  const ty=terrainY(x,z);
  if(ty<0.5||ty>15) continue;
  const g=new THREE.Group();
  // bush body
  const b=new THREE.Mesh(new THREE.SphereGeometry(0.45+Math.random()*0.25,7,6), bushMat);
  b.scale.y=0.7; g.add(b);
  // berries
  for(let j=0;j<6+Math.floor(Math.random()*5);j++){
    const br=new THREE.Mesh(new THREE.SphereGeometry(0.06,5,4), berryMat);
    const a=Math.random()*Math.PI*2, r=0.3+Math.random()*0.25;
    br.position.set(Math.cos(a)*r, 0.1+Math.random()*0.35, Math.sin(a)*r);
    g.add(br);
  }
  g.position.set(x,ty,z);
  scene.add(g);
  berryBushes.push({ mesh:g, pos:new THREE.Vector3(x,ty,z), depleted:false, regenTimer:0 });
}

// ─── Fish ──────────────────────────────────────────────────────────────────────
const fishList = [];
const fishBodyMat = new THREE.MeshStandardMaterial({ color:0x5090c0, roughness:0.4, metalness:0.3 });
for(let i=0;i<FISH_COUNT;i++){
  // find a water spot
  let fx,fz,fy;
  for(let t=0;t<30;t++){
    fx=(Math.random()-0.5)*WORLD_SIZE*0.7; fz=(Math.random()-0.5)*WORLD_SIZE*0.7;
    if(terrainY(fx,fz)<0.2){ fy=0.25; break; }
  }
  if(fy===undefined) continue;
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.SphereGeometry(0.18,7,5), fishBodyMat);
  body.scale.set(1,0.55,2.2); g.add(body);
  const tail=new THREE.Mesh(new THREE.ConeGeometry(0.12,0.2,5), fishBodyMat);
  tail.position.z=-0.38; tail.rotation.x=Math.PI/2; g.add(tail);
  g.position.set(fx,fy,fz);
  g.rotation.y=Math.random()*Math.PI*2;
  scene.add(g);
  fishList.push({ mesh:g, angle:Math.random()*Math.PI*2, cx:fx, cz:fz, caught:false });
}
// Extra fish in the huge lake
for(let i=0;i<12;i++){
  const fa=Math.random()*Math.PI*2, fr=6+Math.random()*LAKE_R*0.82;
  const fx=LAKE_X+Math.cos(fa)*fr, fz=LAKE_Z+Math.sin(fa)*fr;
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.SphereGeometry(0.18,7,5),fishBodyMat);
  body.scale.set(1,0.55,2.2); g.add(body);
  const tail=new THREE.Mesh(new THREE.ConeGeometry(0.12,0.2,5),fishBodyMat);
  tail.position.z=-0.38; tail.rotation.x=Math.PI/2; g.add(tail);
  g.position.set(fx,LAKE_Y+0.05,fz); g.rotation.y=Math.random()*Math.PI*2;
  scene.add(g);
  fishList.push({mesh:g,angle:Math.random()*Math.PI*2,cx:fx,cz:fz,caught:false});
}

// ─── Grass ────────────────────────────────────────────────────────────────────
const grassInst = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(0.28, 0.6, 1, 3),
  new THREE.MeshBasicMaterial({ color:0x2a5518, side:THREE.DoubleSide, transparent:true, opacity:0.92 }),
  GRASS_COUNT
);
const dm = new THREE.Object3D();
for(let i=0;i<GRASS_COUNT;i++){
  const x=(Math.random()-0.5)*WORLD_SIZE, z=(Math.random()-0.5)*WORLD_SIZE, y=terrainY(x,z);
  if(y<0.4){ dm.position.set(0,-999,0); } else { dm.position.set(x,y+0.18,z); }
  dm.rotation.y=Math.random()*Math.PI; dm.scale.set(1+Math.random()*0.4,1+Math.random()*0.9,1);
  dm.updateMatrix(); grassInst.setMatrixAt(i,dm.matrix);
}
grassInst.instanceMatrix.needsUpdate=true;
scene.add(grassInst);

// ─── Wolf builder (shared for player, mate, pups) ──────────────────────────
function makeWolf(cfg={}) {
  const preset = COAT_PRESETS[cfg.preset ?? 0];
  const safeEyeIdx = Math.max(0, Math.min(EYE_COLORS.length-1, cfg.eyeIdx ?? 0));
  const eyeCol = EYE_COLORS[safeEyeIdx].color;
  const baseCol  = cfg.baseColor  ?? preset.base;
  const sadCol   = cfg.saddle     ?? preset.saddle;
  const bellyCol = cfg.belly      ?? preset.belly;
  const sockCol  = cfg.sock       ?? preset.sock;

  const g = new THREE.Group();

  function mat(c){ return new THREE.MeshStandardMaterial({ color:c, roughness:0.88, metalness:0.0 }); }
  const bodyMat  = mat(baseCol);
  const saddleMat= mat(sadCol);
  const bellyMat = mat(bellyCol);
  const sockMat  = mat(sockCol);
  const noseMat  = mat(0x1a1a18);
  const tongueMat= mat(0xd04858);
  const darkMat  = mat(sadCol);

  // ── Body — low slung, long wolf torso ──
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.54,14,10), bodyMat);
  body.scale.set(1.12,0.76,2.12); body.position.set(0,0.60,0); body.castShadow=true; g.add(body);
  // Deep chest (wolf drops low between front legs)
  const deepChest = new THREE.Mesh(new THREE.SphereGeometry(0.44,10,9), bodyMat);
  deepChest.scale.set(1.08,1.12,0.80); deepChest.position.set(0,0.42,0.64); g.add(deepChest);
  // Rump / haunches
  const rump = new THREE.Mesh(new THREE.SphereGeometry(0.36,9,8), bodyMat);
  rump.scale.set(1.02,0.90,0.82); rump.position.set(0,0.66,-0.72); g.add(rump);
  // Shoulder blades (visible muscle bumps)
  [-1,1].forEach(s=>{
    const sb=new THREE.Mesh(new THREE.SphereGeometry(0.18,8,7), saddleMat);
    sb.scale.set(0.9,0.62,0.75); sb.position.set(s*0.28,0.84,0.44); g.add(sb);
  });
  // Saddle (dark back stripe)
  const saddle = new THREE.Mesh(new THREE.SphereGeometry(0.50,10,8), saddleMat);
  saddle.scale.set(0.78,0.36,1.65); saddle.position.set(0,0.94,0.02); g.add(saddle);
  // Belly — narrow, tucked up
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.30,9,7), bellyMat);
  belly.scale.set(0.82,0.36,1.30); belly.position.set(0,0.24,0.06); g.add(belly);
  // Chest tuft
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.22,8,7), bellyMat);
  chest.scale.set(1.0,0.7,0.8); chest.position.set(0,0.46,0.80); g.add(chest);

  // ── Neck — thick, angled forward ──
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.30,0.44,9), bodyMat);
  neck.position.set(0,0.98,0.68); neck.rotation.x=-0.52; neck.castShadow=true; g.add(neck);
  const neckB = new THREE.Mesh(new THREE.SphereGeometry(0.17,7,6), bellyMat);
  neckB.position.set(0,0.76,0.78); g.add(neckB);

  // ── Head — wedge-shaped, low ──
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.29,12,10), bodyMat);
  head.scale.set(1.06,0.98,1.18); head.position.set(0,1.16,1.00); head.castShadow=true; g.add(head);
  // Brow ridge (strong, pushed forward)
  const brow = new THREE.Mesh(new THREE.SphereGeometry(0.15,8,6), saddleMat);
  brow.scale.set(1.48,0.36,0.62); brow.position.set(0,1.30,1.10); g.add(brow);
  // Cheeks
  [-1,1].forEach(s=>{
    const ch=new THREE.Mesh(new THREE.SphereGeometry(0.13,7,6), bodyMat);
    ch.position.set(s*0.19,1.14,1.02); g.add(ch);
  });
  // Jowls (loose skin under jaw — wolflike)
  [-1,1].forEach(s=>{
    const jw=new THREE.Mesh(new THREE.SphereGeometry(0.085,6,5), bodyMat);
    jw.scale.set(0.9,0.7,0.8); jw.position.set(s*0.09,1.02,1.20); g.add(jw);
  });

  // ── Snout — long muzzle, angled down ──
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.20,0.14,0.46), bodyMat);
  snout.position.set(0,1.05,1.20); snout.rotation.x=0.17; g.add(snout);
  const snoutTip = new THREE.Mesh(new THREE.SphereGeometry(0.10,8,6), bodyMat);
  snoutTip.scale.set(0.94,0.62,0.88); snoutTip.position.set(0,1.03,1.40); g.add(snoutTip);
  // Upper lip
  const upperLip=new THREE.Mesh(new THREE.SphereGeometry(0.068,7,5), bodyMat);
  upperLip.scale.set(1.38,0.45,0.78); upperLip.position.set(0,1.06,1.36); g.add(upperLip);
  // Nose — wet, wide
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.064,8,6), noseMat);
  nose.scale.set(1.1,0.68,0.88); nose.position.set(0,1.07,1.42); g.add(nose);
  // Nostrils
  [-1,1].forEach(s=>{
    const n=new THREE.Mesh(new THREE.SphereGeometry(0.022,5,4), new THREE.MeshStandardMaterial({color:0x080808,roughness:0.6}));
    n.position.set(s*0.038,1.062,1.44); g.add(n);
  });
  // Mouth line
  const mouthMat = new THREE.MeshStandardMaterial({ color:0x180808, roughness:0.9 });
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.10,0.02,0.04), mouthMat);
  mouth.position.set(0,0.995,1.34); g.add(mouth);

  // ── Eyes — flat discs with depthTest:false, always visible through head mesh ──
  function mkEyeMat(col, op){
    return new THREE.MeshBasicMaterial({
      color:col, transparent:op<1, opacity:op===undefined?1:op,
      depthTest:false, side:THREE.DoubleSide,
    });
  }
  [-1,1].forEach(s=>{
    const ex=s*0.19, ey=1.222, ez=1.155;
    const rx=-0.14, ry=s*0.26;
    // Glow halo
    const glow=new THREE.Mesh(new THREE.CircleGeometry(0.105,12),mkEyeMat(eyeCol,0.32));
    glow.position.set(ex,ey,ez); glow.rotation.set(rx,ry,0); glow.renderOrder=8; g.add(glow);
    // White sclera
    const sc=new THREE.Mesh(new THREE.CircleGeometry(0.088,14),mkEyeMat(0xfaf0d8));
    sc.position.set(ex,ey,ez+0.001); sc.rotation.set(rx,ry,0); sc.renderOrder=9; g.add(sc);
    // Coloured iris
    const ir=new THREE.Mesh(new THREE.CircleGeometry(0.074,14),mkEyeMat(eyeCol));
    ir.position.set(ex,ey,ez+0.002); ir.rotation.set(rx,ry,0); ir.renderOrder=10; g.add(ir);
    // Vertical slit pupil
    const pu=new THREE.Mesh(new THREE.CircleGeometry(0.032,10),mkEyeMat(0x010101));
    pu.scale.set(0.42,1,1); pu.position.set(ex,ey,ez+0.003); pu.rotation.set(rx,ry,0); pu.renderOrder=11; g.add(pu);
    // Catchlight
    const ca=new THREE.Mesh(new THREE.CircleGeometry(0.011,8),mkEyeMat(0xffffff));
    ca.position.set(ex+s*0.016,ey+0.022,ez+0.004); ca.rotation.set(rx,ry,0); ca.renderOrder=12; g.add(ca);
  });

  // ── Ears — alert, upright, wide-set ──
  const earGeo = new THREE.ConeGeometry(0.098,0.30,5);
  const innerEarMat = mat(0xc06870);
  [-1,1].forEach(s=>{
    const ear = new THREE.Mesh(earGeo, bodyMat);
    ear.position.set(s*0.198,1.44,0.92); ear.rotation.z=s*0.24; ear.rotation.x=-0.08;
    ear.castShadow=true; g.add(ear);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.062,0.20,5), innerEarMat);
    inner.position.set(s*0.198,1.44,0.93); inner.rotation.z=s*0.24; inner.rotation.x=-0.08; g.add(inner);
  });

  // ── Tail — bushy, carried in slight arc ──
  // base segment (named for animation)
  const tailBase = new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.08,0.50,8), bodyMat);
  tailBase.position.set(0,0.66,-0.84); tailBase.rotation.x=0.92; tailBase.name='tail';
  tailBase.castShadow=true; g.add(tailBase);
  // mid segment
  const tailMid = new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.07,0.38,7), bodyMat);
  tailMid.position.set(0,0.96,-1.00); tailMid.rotation.x=1.18; g.add(tailMid);
  // tip
  const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.10,7,6), bellyMat);
  tailTip.position.set(0,1.12,-1.14); g.add(tailTip);

  // ── Legs — articulated stance with visible knee angle ──
  // Front legs pitch slightly forward, hind legs slightly back (digitigrade)
  const legDefs = [
    { name:'leg0', x: 0.29, z: 0.54, rx: 0.14 },
    { name:'leg1', x:-0.29, z: 0.54, rx: 0.14 },
    { name:'leg2', x: 0.27, z:-0.52, rx:-0.14 },
    { name:'leg3', x:-0.27, z:-0.52, rx:-0.14 },
  ];
  legDefs.forEach(lp=>{
    // upper leg (thigh / shoulder)
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.085,0.40,7), bodyMat);
    thigh.position.set(lp.x, 0.44, lp.z); thigh.rotation.x=lp.rx;
    thigh.castShadow=true; g.add(thigh);
    // knee joint bump
    const knee=new THREE.Mesh(new THREE.SphereGeometry(0.075,6,5), bodyMat);
    knee.position.set(lp.x, 0.20, lp.z + lp.rx*0.5); g.add(knee);
    // lower leg (shin)
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.055,0.38,7), bodyMat);
    shin.position.set(lp.x, 0.18, lp.z); shin.rotation.x=-lp.rx*0.5;
    shin.castShadow=true; shin.name=lp.name; g.add(shin);
    // paw — wide, spread
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.09,7,6), sockMat);
    paw.scale.set(1.25,0.58,1.45); paw.position.set(lp.x, 0.04, lp.z+lp.rx*0.18+0.04); g.add(paw);
    // toe detail (2 small spheres)
    [-1,1].forEach(t=>{
      const toe=new THREE.Mesh(new THREE.SphereGeometry(0.028,5,4), sockMat);
      toe.position.set(lp.x+t*0.055, 0.04, lp.z+lp.rx*0.18+0.12); g.add(toe);
    });
  });

  // Apply special coat patterns
  if(preset.pattern==='mystic') applyMysticPattern(g);

  return g;
}

// ─── Mystic coat pattern: black + red stripes + silver swirls + gray hearts ──
function applyMysticPattern(g) {
  const redMat = new THREE.MeshStandardMaterial({
    color:0xcc1010, emissive:new THREE.Color(0x550000), roughness:0.6, metalness:0.1,
  });
  const silverMat = new THREE.MeshStandardMaterial({
    color:0xe0e4f0, emissive:new THREE.Color(0x202840), roughness:0.2, metalness:0.55,
  });
  const grayMat = new THREE.MeshStandardMaterial({
    color:0x8888a0, emissive:new THREE.Color(0x101018), roughness:0.75, metalness:0.1,
  });

  // ── Red diagonal stripes across back, shoulders, flanks ──
  const stripes = [
    { x: 0.42, y:0.76, z: 0.3,  rx:0,    ry: 0.25, rz: 0.55 },
    { x:-0.42, y:0.76, z: 0.3,  rx:0,    ry:-0.25, rz:-0.55 },
    { x: 0.4,  y:0.66, z:-0.15, rx:0.1,  ry: 0.3,  rz: 0.5  },
    { x:-0.4,  y:0.66, z:-0.15, rx:-0.1, ry:-0.3,  rz:-0.5  },
    { x: 0,    y:0.86, z: 0.05, rx: 0.4, ry:0,     rz:0     },
    { x: 0.3,  y:0.80, z:-0.35, rx:0.2,  ry: 0.15, rz: 0.45 },
    { x:-0.3,  y:0.80, z:-0.35, rx:0.2,  ry:-0.15, rz:-0.45 },
  ];
  stripes.forEach(p=>{
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.42,0.1), redMat);
    s.position.set(p.x,p.y,p.z); s.rotation.set(p.rx,p.ry,p.rz); g.add(s);
  });
  // Face stripe — down nose bridge
  const faceStripe = new THREE.Mesh(new THREE.BoxGeometry(0.04,0.28,0.06), redMat);
  faceStripe.position.set(0,1.20,1.08); faceStripe.rotation.x=0.15; g.add(faceStripe);

  // ── Silver/white swirl tubes using CatmullRom curves ──
  const swirlDefs = [
    [ [-0.58,0.63,-0.38],[-0.52,0.83,-0.1],[-0.45,0.68,0.25],[-0.38,0.80,0.52] ],
    [ [ 0.58,0.63,-0.38],[ 0.52,0.83,-0.1],[ 0.45,0.68,0.25],[ 0.38,0.80,0.52] ],
    [ [-0.35,0.53,-0.55],[ 0.0, 0.58,-0.65],[ 0.35,0.53,-0.55] ],
    [ [-0.22,1.10,1.00],[-0.05,1.24,1.12],[ 0.22,1.10,1.00] ],  // brow swirl
    [ [-0.5,0.43,0.38],[-0.3,0.30,0.42],[-0.1,0.26,0.45] ],     // shoulder-leg swirl
    [ [ 0.5,0.43,0.38],[ 0.3,0.30,0.42],[ 0.1,0.26,0.45] ],
  ];
  swirlDefs.forEach(pts=>{
    const curve = new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)));
    const tube  = new THREE.Mesh(new THREE.TubeGeometry(curve,14,0.042,7,false), silverMat);
    g.add(tube);
  });
  // Silver tip on tail
  const tailTipMat = new THREE.MeshStandardMaterial({color:0xd8dce8,emissive:new THREE.Color(0x181c24),roughness:0.4,metalness:0.4});
  const tailTip2 = new THREE.Mesh(new THREE.SphereGeometry(0.13,8,7), tailTipMat);
  tailTip2.position.set(0,1.14,-1.16); g.add(tailTip2);

  // ── Gray wolf hearts — chest, shoulders, haunches ──
  function addHeart(x,y,z,size,ry,rz=0){
    const h = new THREE.Group();
    const hs = size*0.52;
    const L = new THREE.Mesh(new THREE.SphereGeometry(hs,8,7), grayMat);
    L.position.set(-size*0.27,0,0); h.add(L);
    const R = new THREE.Mesh(new THREE.SphereGeometry(hs,8,7), grayMat);
    R.position.set( size*0.27,0,0); h.add(R);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(size*0.32,size*0.58,7), grayMat);
    tip.position.set(0,-size*0.52,0); tip.rotation.z=Math.PI; h.add(tip);
    h.position.set(x,y,z);
    h.rotation.y=ry; h.rotation.z=rz;
    h.scale.z=0.14;   // flatten like a fur marking
    g.add(h);
  }
  addHeart(0,    0.46, 0.78, 0.24, 0);          // chest centre
  addHeart( 0.44,0.72, 0.22, 0.18, 0.5);        // right shoulder
  addHeart(-0.44,0.72, 0.22, 0.18,-0.5);        // left shoulder
  addHeart( 0.42,0.60,-0.34, 0.16, 0.8);        // right haunch
  addHeart(-0.42,0.60,-0.34, 0.16,-0.8);        // left haunch
  addHeart(0,    0.70,-0.54, 0.14, Math.PI);    // lower back

  // ── Wings — huge demon/dragon wings, shown when cfg.wings is true ──
  if(cfg.wings){
    try{
      const wMat=new THREE.MeshStandardMaterial({
        color:0x9a0808, side:THREE.DoubleSide, roughness:0.65, metalness:0.1,
        emissive:new THREE.Color(0x380000), emissiveIntensity:0.55,
        transparent:true, opacity:0.92,
      });
      const bMat=new THREE.MeshStandardMaterial({color:0x100202,roughness:0.88});
      [-1,1].forEach(s=>{
        const wg=new THREE.Group();
        wg.name=s>0?'wing_r':'wing_l';
        wg.position.set(s*0.22,0.86,-0.10);
        g.add(wg);
        // 4-point wing membrane quad (two triangles, both sides)
        const v=new Float32Array([
          0,   0.0,  0.0,
          s*5.0, 2.2,-0.1,
          s*4.2,-0.6,-2.4,
          s*0.1,-0.4,-2.3,
        ]);
        const geo=new THREE.BufferGeometry();
        geo.setAttribute('position',new THREE.BufferAttribute(v,3));
        geo.setIndex(new THREE.BufferAttribute(new Uint16Array([0,1,2, 0,2,3, 2,1,0, 3,2,0]),1));
        geo.computeVertexNormals();
        const wMesh=new THREE.Mesh(geo,wMat);
        wMesh.castShadow=true; wg.add(wMesh);
        // Main spar bone: root → tip
        const tipV=new THREE.Vector3(s*5.0,2.2,-0.1);
        const sparLen=tipV.length();
        const spar=new THREE.Mesh(new THREE.CylinderGeometry(0.062,0.038,sparLen,7),bMat);
        spar.position.copy(tipV.clone().multiplyScalar(0.5));
        const up=new THREE.Vector3(0,1,0);
        const tipN=tipV.clone().normalize();
        if(Math.abs(up.dot(tipN))<0.9999) spar.quaternion.setFromUnitVectors(up,tipN);
        spar.castShadow=true; wg.add(spar);
        // Two trailing finger bones
        [[s*4.2,-0.6,-2.4],[s*2.2,-0.2,-2.0]].forEach(([tx,ty,tz])=>{
          const tv=new THREE.Vector3(tx,ty,tz);
          const tvN=tv.clone().normalize();
          const fl=new THREE.Mesh(new THREE.CylinderGeometry(0.030,0.018,tv.length()*0.72,6),bMat);
          fl.position.copy(tv.clone().multiplyScalar(0.36));
          if(Math.abs(up.dot(tvN))<0.9999) fl.quaternion.setFromUnitVectors(up,tvN);
          wg.add(fl);
        });
      });
    }catch(wingErr){ console.warn('Wings skipped:',wingErr); }
  }

  return g;
}

// ─── Player wolf ──────────────────────────────────────────────────────────────
let wolf;
try { wolf = makeWolf(wolfConfig); } catch(e){ console.error('makeWolf failed:',e); wolf = new THREE.Group(); }
wolf.scale.setScalar(wolfConfig.scale * 1.15);
scene.add(wolf);

// ─── Mate wolf ────────────────────────────────────────────────────────────────
const mateCfg = { preset:6, eyeIdx:1 }; // Shadow coat, gold eyes
const mateMesh = makeWolf(mateCfg);
mateMesh.scale.setScalar(1.0);
const mateStartX = 80+Math.random()*40, mateStartZ = 60+Math.random()*40;
mateMesh.position.set(mateStartX, terrainY(mateStartX,mateStartZ), mateStartZ);
scene.add(mateMesh);

// ─── Rival Packs ──────────────────────────────────────────────────────────────
const RIVAL_PACK_CONFIGS=[
  {x:175,z:155,name:'East Ridge Pack'},
  {x:-175,z:155,name:'North Forest Pack'},
  {x:175,z:-165,name:'South Meadow Pack'},
  {x:-110,z:165,name:'Moon Valley Pack'},
];
const rivalPacks=RIVAL_PACK_CONFIGS.map(cfg=>{
  const wolves=[];
  const count=2+Math.floor(Math.random()*2);
  for(let i=0;i<count;i++){
    const m=makeWolf({preset:Math.floor(Math.random()*COAT_PRESETS.length),eyeIdx:Math.floor(Math.random()*EYE_COLORS.length)});
    const ox=(Math.random()-0.5)*10, oz=(Math.random()-0.5)*10;
    const px=cfg.x+ox, pz=cfg.z+oz;
    m.position.set(px,terrainY(px,pz),pz);
    m.rotation.y=Math.random()*Math.PI*2;
    scene.add(m);
    wolves.push({mesh:m,homeX:px,homeZ:pz,wanderAngle:Math.random()*Math.PI*2,legPhase:0});
  }
  return {...cfg,wolves};
});

let playerAlliance = null; // null = own pack, or a rivalPack object when joined

// ─── Heart particles ──────────────────────────────────────────────────────────
const heartMat2 = new THREE.MeshBasicMaterial({ color:0xff4488, side:THREE.DoubleSide });
const hearts = [];
for(let i=0;i<10;i++){
  const h=new THREE.Mesh(new THREE.PlaneGeometry(0.38,0.38), heartMat2.clone());
  h.visible=false; h.userData={life:0,vy:0,vx:0}; scene.add(h); hearts.push(h);
}
function spawnHearts(pos){
  hearts.forEach(h=>{
    if(!h.visible){
      h.visible=true;
      h.position.copy(pos).add(new THREE.Vector3((Math.random()-0.5)*1.8,1.3+Math.random()*0.8,(Math.random()-0.5)*1.8));
      h.userData.life=1.5; h.userData.vy=1.3+Math.random()*0.7; h.userData.vx=(Math.random()-0.5)*0.5;
    }
  });
}
function updateHearts(dt){
  hearts.forEach(h=>{
    if(!h.visible) return;
    h.userData.life-=dt;
    h.position.y+=h.userData.vy*dt; h.position.x+=h.userData.vx*dt;
    h.material.opacity=Math.max(0,h.userData.life/1.5);
    h.material.transparent=true;
    h.lookAt(camera.position);
    if(h.userData.life<=0) h.visible=false;
  });
}

// ─── Mate AI ──────────────────────────────────────────────────────────────────
const mate = { mesh:mateMesh, state:'wander', target:new THREE.Vector3(), timer:Math.random()*6, legPhase:0 };
function updateMate(dt){
  const pos=mate.mesh.position;
  const dist=pos.distanceTo(player.pos);
  if(packState.bondLevel>0&&dist>12) mate.state='follow';
  mate.timer-=dt;
  let dx=0,dz=0,spd=3.8;
  if(mate.state==='follow'){
    dx=player.pos.x+(Math.random()-0.5)*4-pos.x;
    dz=player.pos.z+(Math.random()-0.5)*4-pos.z;
    const l=Math.sqrt(dx*dx+dz*dz);
    if(l<2.5){dx=0;dz=0;}else{dx/=l;dz/=l;}
  } else {
    if(mate.timer<0){
      mate.timer=3+Math.random()*6;
      const a=Math.random()*Math.PI*2,r=10+Math.random()*30;
      mate.target.set(Math.max(-WORLD_SIZE/2+5,Math.min(WORLD_SIZE/2-5,pos.x+Math.cos(a)*r)),0,Math.max(-WORLD_SIZE/2+5,Math.min(WORLD_SIZE/2-5,pos.z+Math.sin(a)*r)));
    }
    dx=mate.target.x-pos.x; dz=mate.target.z-pos.z;
    const l=Math.sqrt(dx*dx+dz*dz);
    if(l<1){dx=0;dz=0;}else{dx/=l;dz/=l;}
  }
  if(dx!==0||dz!==0){
    pos.x+=dx*spd*dt; pos.z+=dz*spd*dt;
    pos.y=Math.max(terrainY(pos.x,pos.z),0.35);
    mate.mesh.rotation.y=Math.atan2(dx,dz);
    mate.legPhase+=spd*dt*3.5;
    ['leg0','leg2'].forEach(n=>{const l=mate.mesh.getObjectByName(n);if(l)l.rotation.x=Math.sin(mate.legPhase)*0.6;});
    ['leg1','leg3'].forEach(n=>{const l=mate.mesh.getObjectByName(n);if(l)l.rotation.x=-Math.sin(mate.legPhase)*0.6;});
  }
  const tail=mate.mesh.getObjectByName('tail');
  if(tail) tail.rotation.y=dist<10?Math.sin(Date.now()*0.006)*0.5:0;
}

// ─── Pack / Breeding ──────────────────────────────────────────────────────────
const packState = { bondLevel:0, mated:false, pregnant:false, gestationTimer:0, pups:[], eCooldown:0, packMates:[], scoutPup:null, scoutTimer:0 };
function updatePackLabel(){
  const alive=packState.pups.filter(p=>!p.dead).length;
  if(!packState.mated){ packLabel.textContent=packState.bondLevel===0?'Pack: Lone Wolf':`Pack: Bonding (${packState.bondLevel}/3)`;
  } else { const pts=['You','Mate'];packState.packMates.forEach((_,i)=>pts.push(`Wolf ${i+2}`));if(alive>0)pts.push(`${alive} pup${alive>1?'s':''}`); packLabel.textContent='Pack: '+pts.join(' + '); }
}
function spawnPup(){
  const pIdx=Math.floor(Math.random()*COAT_PRESETS.length);
  const mesh=makeWolf({preset:pIdx,eyeIdx:Math.floor(Math.random()*EYE_COLORS.length)});
  mesh.scale.setScalar(0.45);
  const ox=(Math.random()-0.5)*3,oz=(Math.random()-0.5)*3;
  const px=mateMesh.position.x+ox,pz=mateMesh.position.z+oz;
  mesh.position.set(px,terrainY(px,pz),pz);
  scene.add(mesh);
  const pup={mesh,realAge:0,legPhase:0,dead:false,scouting:false,scoutTarget:null,followOffset:new THREE.Vector3((Math.random()-0.5)*3,0,(Math.random()-0.5)*3)};
  packState.pups.push(pup);
}
function updatePups(dt){
  packState.pups.forEach(pup=>{
    if(pup.dead||pup.scouting) return;
    pup.realAge=(pup.realAge||0)+dt;
    const growT=Math.min(1,pup.realAge/40);
    pup.mesh.scale.setScalar(0.45+growT*0.7);
    // Pups rest in den when player is inside, otherwise follow
    const followBase = (den.placed && !player.inDen) ? den.pos : player.pos;
    const target=new THREE.Vector3().copy(followBase).add(pup.followOffset);
    const dx=target.x-pup.mesh.position.x, dz=target.z-pup.mesh.position.z;
    const dist=Math.sqrt(dx*dx+dz*dz);
    if(dist>1.5){
      const spd=WOLF_SPEED*0.8;
      pup.mesh.position.x+=dx/dist*spd*dt; pup.mesh.position.z+=dz/dist*spd*dt;
      pup.mesh.position.y=Math.max(terrainY(pup.mesh.position.x,pup.mesh.position.z),0.2);
      pup.mesh.rotation.y=Math.atan2(dx/dist,dz/dist);
      pup.legPhase+=spd*dt*4;
      ['leg0','leg2'].forEach(n=>{const l=pup.mesh.getObjectByName(n);if(l)l.rotation.x=Math.sin(pup.legPhase)*0.7;});
      ['leg1','leg3'].forEach(n=>{const l=pup.mesh.getObjectByName(n);if(l)l.rotation.x=-Math.sin(pup.legPhase)*0.7;});
    }
    const tail=pup.mesh.getObjectByName('tail');
    if(tail) tail.rotation.y=Math.sin(Date.now()*0.008+pup.realAge*10)*0.7;
  });
  // Scout trigger: grown pup (40s) leaves to find a mate
  if(!packState.scoutPup){
    for(const pup of packState.pups){
      if(pup.dead||pup.scouting) continue;
      if((pup.realAge||0)>=40){
        packState.scoutPup=pup; packState.scoutTimer=120;
        pup.scouting=true; pup.mesh.visible=false;
        const rp=rivalPacks[Math.floor(Math.random()*rivalPacks.length)];
        pup.scoutTarget=rp;
        showNotif(`Your pup has left for ${rp.name}! Returns in 2:00`);
        break;
      }
    }
  }
}
function updatePackMates(dt){
  packState.packMates.forEach(pm=>{
    const target=new THREE.Vector3().copy(player.pos).add(pm.followOffset);
    const dx=target.x-pm.mesh.position.x, dz=target.z-pm.mesh.position.z;
    const dist=Math.sqrt(dx*dx+dz*dz);
    if(dist>2){
      const spd=WOLF_SPEED*0.85;
      pm.mesh.position.x+=dx/dist*spd*dt; pm.mesh.position.z+=dz/dist*spd*dt;
      pm.mesh.position.y=terrainY(pm.mesh.position.x,pm.mesh.position.z)+0.05;
      pm.mesh.rotation.y=Math.atan2(dx,dz);
      pm.legPhase=(pm.legPhase||0)+spd*dt*3.5;
      ['leg0','leg2'].forEach(n=>{const l=pm.mesh.getObjectByName(n);if(l)l.rotation.x=Math.sin(pm.legPhase)*0.65;});
      ['leg1','leg3'].forEach(n=>{const l=pm.mesh.getObjectByName(n);if(l)l.rotation.x=-Math.sin(pm.legPhase)*0.65;});
    }
    const tail=pm.mesh.getObjectByName('tail');
    if(tail) tail.rotation.y=Math.sin(Date.now()*0.003)*0.5;
  });
}

function returnScout(){
  const sp=packState.scoutPup; packState.scoutPup=null;
  sp.scouting=false; sp.mesh.visible=true;
  sp.mesh.position.copy(player.pos).add(new THREE.Vector3(3,0,3));
  sp.mesh.position.y=terrainY(sp.mesh.position.x,sp.mesh.position.z);
  // New pack-mate wolf
  const nm=makeWolf({preset:Math.floor(Math.random()*COAT_PRESETS.length),eyeIdx:Math.floor(Math.random()*EYE_COLORS.length)});
  nm.scale.setScalar(1.0);
  const mi=packState.packMates.length;
  const mox=(mi%2===0?1:-1)*4, moz=3+mi*2;
  nm.position.copy(player.pos).add(new THREE.Vector3(mox,0,moz));
  nm.position.y=terrainY(nm.position.x,nm.position.z);
  scene.add(nm);
  packState.packMates.push({mesh:nm,followOffset:new THREE.Vector3(mox,0,moz),legPhase:0});
  // New pups
  const count=2+Math.floor(Math.random()*2);
  for(let i=0;i<count;i++) spawnPup();
  spawnHearts(player.pos); spawnHearts(nm.position);
  showNotif(`Your pup returned with a mate and ${count} new pups! Pack grows!`);
  updatePackLabel();
}

function tryJoinPack(rp){
  if(playerAlliance===rp){
    showNotif(`You already run with the ${rp.name}.`); return;
  }
  if(playerAlliance) leaveEnemyPack(true);
  playerAlliance=rp;
  spawnHearts(player.pos);
  showNotif(`You have joined the ${rp.name}! Their wolves follow you.`);
  packLabel.textContent=`Pack: ${rp.name} · ${rp.wolves.length} wolves`;
  mate.state='wander';
}
function leaveEnemyPack(silent=false){
  if(!playerAlliance) return;
  const name=playerAlliance.name;
  playerAlliance=null;
  if(!silent) showNotif(`You left the ${name} and returned to your own pack.`);
  if(packState.mated) mate.state='follow';
  updatePackLabel();
}

let fWasDown=false;
function tryBondOrMate(){
  if(packState.eCooldown>0) return;
  if(mateMesh.position.distanceTo(player.pos)>BOND_RANGE) return;
  packState.eCooldown=1.8;
  if(!packState.mated){
    if(packState.bondLevel<3){
      packState.bondLevel++;
      spawnHearts(mateMesh.position);
      const msgs=['','You nuzzle her softly.','She leans in. Trust deepens.','Your bond is unbreakable.'];
      showNotif(msgs[packState.bondLevel]);
      if(packState.bondLevel===3){ packState.mated=true; mate.state='follow'; setTimeout(()=>showNotif('Press F near your mate to start a litter.'),3200); }
      updatePackLabel();
    }
  } else if(!packState.pregnant){
    packState.pregnant=true; packState.gestationTimer=60;
    spawnHearts(mateMesh.position); spawnHearts(wolf.position);
    showNotif('A new litter is on the way — pups in 1 minute!');
    updatePackLabel();
  } else { showNotif('Pups are on the way!'); }
}
const pupLabel = document.getElementById('pup-label');
function tickGestation(dt){
  // Scout countdown
  if(packState.scoutPup){
    packState.scoutTimer-=dt;
    const m=Math.floor(Math.max(0,packState.scoutTimer)/60);
    const s=Math.floor(Math.max(0,packState.scoutTimer)%60);
    pupLabel.style.display='block';
    pupLabel.textContent=`🐾 Pup seeking mate — ${m}:${String(s).padStart(2,'0')}`;
    if(packState.scoutTimer<=0) returnScout();
  }
  if(!packState.pregnant){ if(!packState.scoutPup) pupLabel.style.display='none'; return; }
  packState.gestationTimer-=dt;
  const sLeft=Math.max(0,packState.gestationTimer);
  const gm=Math.floor(sLeft/60), gs=Math.floor(sLeft%60);
  pupLabel.style.display='block';
  pupLabel.textContent=`🐺 Pups coming in ${gm}:${String(gs).padStart(2,'0')}`;
  if(packState.gestationTimer<=0){
    packState.pregnant=false;
    if(!packState.scoutPup) pupLabel.style.display='none';
    const count=2+Math.floor(Math.random()*3);
    for(let i=0;i<count;i++) spawnPup();
    spawnHearts(mateMesh.position);
    showNotif(`${count} pups born! Your pack grows.`);
    updatePackLabel();
  }
}

// ─── Deer & Rabbit ────────────────────────────────────────────────────────────
function makeDeer(){
  const g=new THREE.Group();
  const mat =new THREE.MeshStandardMaterial({color:0x8a5e38,roughness:0.88,metalness:0});
  const dark=new THREE.MeshStandardMaterial({color:0x3a2010,roughness:0.9,metalness:0});
  const white=new THREE.MeshStandardMaterial({color:0xfff0e0,roughness:0.85,metalness:0});
  const eye=new THREE.MeshStandardMaterial({color:0x0a0800,roughness:0.2,metalness:0.1});
  const body=new THREE.Mesh(new THREE.SphereGeometry(0.5,9,7),mat);
  body.scale.set(1,0.8,1.6);body.position.y=1.1;body.castShadow=true;g.add(body);
  const nk=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.2,0.52,7),mat);
  nk.position.set(0,1.52,0.57);nk.rotation.x=-0.5;nk.castShadow=true;g.add(nk);
  const hd=new THREE.Mesh(new THREE.SphereGeometry(0.22,9,7),mat);
  hd.scale.set(1,0.9,1.3);hd.position.set(0,1.74,0.84);hd.castShadow=true;g.add(hd);
  const sn=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.12,0.2),mat);
  sn.position.set(0,1.64,1.0);g.add(sn);
  [-1,1].forEach(s=>{
    const e=new THREE.Mesh(new THREE.SphereGeometry(0.04,6,5),eye);
    e.position.set(s*0.11,1.78,0.95);g.add(e);
  });
  [-1,1].forEach(s=>{
    const e=new THREE.Mesh(new THREE.ConeGeometry(0.08,0.22,5),mat);
    e.position.set(s*0.17,1.9,0.76);e.rotation.z=s*0.5;g.add(e);
  });
  const tl=new THREE.Mesh(new THREE.SphereGeometry(0.1,6,5),white);
  tl.position.set(0,1.1,-0.75);g.add(tl);
  const legG=new THREE.CylinderGeometry(0.07,0.05,0.9,6);
  [[0.22,0.45,0.38],[-0.22,0.45,0.38],[0.22,0.45,-0.32],[-0.22,0.45,-0.32]].forEach((p,i)=>{
    const l=new THREE.Mesh(legG,mat);l.position.set(...p);l.castShadow=true;l.name='leg'+i;g.add(l);
  });
  if(Math.random()>0.4){
    [-1,1].forEach(s=>{
      const a=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.05,0.5,5),dark);
      a.position.set(s*0.12,2.06,0.73);a.rotation.z=s*0.3;g.add(a);
      const a2=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.03,0.32,5),dark);
      a2.position.set(s*0.2,2.32,0.7);a2.rotation.z=s*0.7;g.add(a2);
    });
  }
  return g;
}
function makeRabbit(){
  const g=new THREE.Group();
  const mat=new THREE.MeshStandardMaterial({color:0x9a8a72,roughness:0.9,metalness:0});
  const dark=new THREE.MeshStandardMaterial({color:0x100c08,roughness:0.3,metalness:0.05});
  const b=new THREE.Mesh(new THREE.SphereGeometry(0.18,7,6),mat);
  b.scale.set(1,0.85,1.3);b.position.y=0.22;b.castShadow=true;g.add(b);
  const h=new THREE.Mesh(new THREE.SphereGeometry(0.13,7,6),mat);
  h.position.set(0,0.4,0.2);h.castShadow=true;g.add(h);
  [-1,1].forEach(s=>{
    const e=new THREE.Mesh(new THREE.CapsuleGeometry(0.03,0.22,4,6),mat);
    e.position.set(s*0.07,0.66,0.17);g.add(e);
  });
  [-1,1].forEach(s=>{
    const e=new THREE.Mesh(new THREE.SphereGeometry(0.026,5,4),dark);
    e.position.set(s*0.08,0.43,0.31);g.add(e);
  });
  const tl=new THREE.Mesh(new THREE.SphereGeometry(0.07,5,4),new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.9}));
  tl.position.set(0,0.22,-0.2);g.add(tl);
  [[0.1,0.08,0.12],[-0.1,0.08,0.12],[0.1,0.08,-0.1],[-0.1,0.08,-0.1]].forEach(p=>{
    const l=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.025,0.2,5),mat);
    l.position.set(...p);g.add(l);
  });
  return g;
}

// ─── Animal AI ────────────────────────────────────────────────────────────────
class Animal{
  constructor(mesh,maxHealth,speed,type,options={}){
    this.mesh=mesh;this.health=maxHealth;this.maxHealth=maxHealth;
    this.speed=speed;this.type=type;this.state='idle';
    this.target=new THREE.Vector3();this.timer=Math.random()*5;
    this.dead=false;this.legPhase=0;
    this.stamina=100; this.exhausted=false; this.exhaustTimer=0;
    this.docile=options.docile||false;
    let x,z;
    if(this.docile){
      // Spawn on map edge — spread across all 4 sides
      const side=Math.floor(Math.random()*4);
      const edgeDist=238+Math.random()*48;
      const spread=(Math.random()-0.5)*WORLD_SIZE*0.55;
      if(side===0){x=spread;z=-edgeDist;}
      else if(side===1){x=spread;z=edgeDist;}
      else if(side===2){x=edgeDist;z=spread;}
      else{x=-edgeDist;z=spread;}
      x=Math.max(-WORLD_SIZE/2+5,Math.min(WORLD_SIZE/2-5,x));
      z=Math.max(-WORLD_SIZE/2+5,Math.min(WORLD_SIZE/2-5,z));
    } else {
      do{x=(Math.random()-0.5)*WORLD_SIZE*0.8;z=(Math.random()-0.5)*WORLD_SIZE*0.8;}
      while(Math.sqrt(x*x+z*z)<30);
    }
    mesh.position.set(x,terrainY(x,z)+0.05,z);
    scene.add(mesh);
  }
  update(dt,wolfPos){
    if(this.dead) return;
    this.timer-=dt;
    const dist=this.mesh.position.distanceTo(wolfPos);

    // Exhaustion recovery
    if(this.exhausted){
      this.exhaustTimer-=dt;
      if(this.exhaustTimer<=0){ this.exhausted=false; this.stamina=100; this.state='idle'; this.timer=4; }
    }

    if(!this.exhausted && !this.docile){
      const fleeR=(this.type==='deer'?22:14)*(player.crouching?0.35:1.0);
      if(dist<fleeR && this.state!=='flee'){ this.state='flee'; this.timer=6; }
      if(this.state==='flee' && this.timer<0) this.state='wander';
      if(this.state==='idle' && this.timer<0){
        this.state=Math.random()>0.3?'wander':'idle';
        this.timer=2+Math.random()*5;
        if(this.state==='wander'){
          const a=Math.random()*Math.PI*2,r=8+Math.random()*25;
          this.target.set(
            Math.max(-WORLD_SIZE/2+5,Math.min(WORLD_SIZE/2-5,this.mesh.position.x+Math.cos(a)*r)),0,
            Math.max(-WORLD_SIZE/2+5,Math.min(WORLD_SIZE/2-5,this.mesh.position.z+Math.sin(a)*r))
          );
        }
      }
    }

    let spd=this.speed, dx=0, dz=0;
    if(this.state==='flee'){
      // Drain stamina while fleeing
      this.stamina=Math.max(0,this.stamina-dt*14);
      const tireFactor=this.stamina<30 ? 0.35+0.65*(this.stamina/30) : 1.0;
      spd*=2.2*tireFactor;
      if(this.stamina<=0){
        // Collapse — exhausted, catchable
        this.exhausted=true; this.exhaustTimer=this.type==='deer'?9:5;
        this.state='idle'; return;
      }
      dx=this.mesh.position.x-wolfPos.x; dz=this.mesh.position.z-wolfPos.z;
      const l=Math.sqrt(dx*dx+dz*dz)+0.001; dx/=l; dz/=l;
    } else {
      this.stamina=Math.min(100,this.stamina+dt*8);
      if(this.state==='wander'){
        dx=this.target.x-this.mesh.position.x; dz=this.target.z-this.mesh.position.z;
        const l=Math.sqrt(dx*dx+dz*dz);
        if(l<1){ this.state='idle'; this.timer=2+Math.random()*4; return; }
        dx/=l; dz/=l;
      }
    }
    if(dx!==0||dz!==0){
      this.mesh.position.x+=dx*spd*dt; this.mesh.position.z+=dz*spd*dt;
      this.mesh.position.y=Math.max(terrainY(this.mesh.position.x,this.mesh.position.z)+0.05,0.35);
      this.mesh.rotation.y=Math.atan2(dx,dz);
      this.legPhase+=spd*dt*5;
      ['leg0','leg2'].forEach(n=>{const l=this.mesh.getObjectByName(n);if(l)l.rotation.x=Math.sin(this.legPhase)*0.5;});
      ['leg1','leg3'].forEach(n=>{const l=this.mesh.getObjectByName(n);if(l)l.rotation.x=-Math.sin(this.legPhase)*0.5;});
    } else if(this.exhausted){
      // Panting: subtle body bob
      this.mesh.children[0] && (this.mesh.children[0].scale.y=0.8+Math.sin(Date.now()*0.012)*0.06);
    }
    this.mesh.position.x=Math.max(-WORLD_SIZE/2+5,Math.min(WORLD_SIZE/2-5,this.mesh.position.x));
    this.mesh.position.z=Math.max(-WORLD_SIZE/2+5,Math.min(WORLD_SIZE/2-5,this.mesh.position.z));
  }
  takeDamage(amt){
    if(this.dead) return;
    const bonus=this.exhausted?1.8:1.0; // exhausted animals take more damage
    this.health-=amt*bonus; this.state='flee'; this.timer=8;
    if(this.health<=0){
      this.dead=true; this.exhausted=false;
      this.mesh.rotation.z=Math.PI/2;
      this.mesh.position.y=terrainY(this.mesh.position.x,this.mesh.position.z);
    }
  }
}

const animals=[];
for(let i=0;i<DEER_COUNT;  i++) animals.push(new Animal(makeDeer(),  60,4.5,'deer'));
for(let i=0;i<RABBIT_COUNT;i++) animals.push(new Animal(makeRabbit(),20,3.8,'rabbit'));
// Docile (non-fleeing) prey at map edges — easy food for new players
for(let i=0;i<9;  i++) animals.push(new Animal(makeDeer(),  60,4.5,'deer',  {docile:true}));
for(let i=0;i<14; i++) animals.push(new Animal(makeRabbit(),20,3.8,'rabbit',{docile:true}));

// ─── Hunter Wolves (Prey Mode) ───────────────────────────────────────────────
let preyMode = false;
let flying   = false;

function toggleFly(){
  flying=!flying;
  const btn=document.getElementById('fly-btn');
  const mBtn=document.getElementById('btn-fly');
  if(flying){
    if(btn){btn.textContent='⬇ Land';btn.classList.add('active');}
    if(mBtn) mBtn.classList.add('active');
    player.vel.y=5; // initial upward kick
    showNotif('Wings spread — you soar! SPACE = rise, SHIFT = descend.');
  } else {
    if(btn){btn.textContent='🦅 Fly';btn.classList.remove('active');}
    if(mBtn) mBtn.classList.remove('active');
    showNotif('You descend to earth.');
  }
}

const HUNTER_CONFIGS = [
  { preset:3, eyeIdx:1 },  // Obsidian + gold eyes
  { preset:7, eyeIdx:4 },  // Shadow + ember eyes
  { preset:8, eyeIdx:0 },  // Crimson + amber eyes
];

class HunterWolf {
  constructor(cfg){
    this.mesh = makeWolf(cfg);
    this.mesh.scale.setScalar(1.25);
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.speed = 10.5;
    this.stamina = 100;
    this.exhausted = false;
    this.exhaustTimer = 0;
    this.legPhase = 0;
    this.active = false;
    this.damageCooldown = 0;
  }
  activate(playerPos){
    const angle = Math.random()*Math.PI*2;
    const dist  = 22+Math.random()*18; // spawn close — immediately threatening
    let x = playerPos.x+Math.cos(angle)*dist;
    let z = playerPos.z+Math.sin(angle)*dist;
    x = Math.max(-WORLD_SIZE/2+5, Math.min(WORLD_SIZE/2-5, x));
    z = Math.max(-WORLD_SIZE/2+5, Math.min(WORLD_SIZE/2-5, z));
    this.mesh.position.set(x, terrainY(x,z)+0.72, z);
    this.mesh.visible = true;
    this.active = true;
    this.stamina = 100;
    this.exhausted = false;
    this.damageCooldown = 0;
  }
  deactivate(){
    this.mesh.visible = false;
    this.active = false;
  }
  update(dt, playerPos){
    if(!this.active) return;
    this.damageCooldown = Math.max(0, this.damageCooldown-dt);
    if(this.exhausted){
      this.exhaustTimer -= dt;
      if(this.exhaustTimer<=0){ this.exhausted=false; this.stamina=100; }
      if(this.mesh.children[0]) this.mesh.children[0].scale.y=0.8+Math.sin(Date.now()*0.012)*0.06;
      return;
    }
    const dist = this.mesh.position.distanceTo(playerPos);
    let dx = playerPos.x-this.mesh.position.x;
    let dz = playerPos.z-this.mesh.position.z;
    const l = Math.sqrt(dx*dx+dz*dz)+0.001;
    dx/=l; dz/=l;
    this.stamina = Math.max(0, this.stamina-dt*5); // drain slower → longer chases
    const tireFactor = this.stamina<30 ? 0.4+0.6*(this.stamina/30) : 1.0;
    if(this.stamina<=0){
      this.exhausted=true; this.exhaustTimer=5+Math.random()*4;
      return;
    }
    const spd = this.speed*tireFactor;
    this.mesh.position.x += dx*spd*dt;
    this.mesh.position.z += dz*spd*dt;
    this.mesh.position.y = Math.max(terrainY(this.mesh.position.x,this.mesh.position.z)+0.72, 0.35);
    this.mesh.rotation.y = Math.atan2(dx,dz);
    this.legPhase += spd*dt*3.5;
    ['leg0','leg2'].forEach(n=>{const leg=this.mesh.getObjectByName(n);if(leg)leg.rotation.x=Math.sin(this.legPhase)*0.65;});
    ['leg1','leg3'].forEach(n=>{const leg=this.mesh.getObjectByName(n);if(leg)leg.rotation.x=-Math.sin(this.legPhase)*0.65;});
    const tail=this.mesh.getObjectByName('tail');
    if(tail) tail.rotation.y=Math.sin(this.legPhase*2)*0.5;
    this.mesh.position.x=Math.max(-WORLD_SIZE/2+5,Math.min(WORLD_SIZE/2-5,this.mesh.position.x));
    this.mesh.position.z=Math.max(-WORLD_SIZE/2+5,Math.min(WORLD_SIZE/2-5,this.mesh.position.z));
    if(dist<3.5&&this.damageCooldown<=0){
      player.health=Math.max(0,player.health-18);
      this.damageCooldown=1.0;
      // red screen flash
      vigEl.classList.add('hurt');
      setTimeout(()=>vigEl.classList.remove('hurt'),500);
      showNotif('A hunter wolf bites you! Run!');
    }
  }
}

const hunterWolves = HUNTER_CONFIGS.map(cfg=>new HunterWolf(cfg));

function togglePreyMode(){
  preyMode=!preyMode;
  const btn   = document.getElementById('prey-btn');
  const label = document.getElementById('prey-mode-label');
  const mBtn  = document.getElementById('btn-prey');
  if(preyMode){
    hunterWolves.forEach(h=>h.activate(player.pos));
    if(btn){ btn.textContent='⚠ Stop Running'; btn.classList.add('active'); }
    if(label) label.style.display='block';
    if(mBtn)  mBtn.classList.add('active');
    showNotif('Hunter wolves are on your trail! RUN!');
  } else {
    hunterWolves.forEach(h=>h.deactivate());
    if(btn){ btn.textContent='Become Prey'; btn.classList.remove('active'); }
    if(label) label.style.display='none';
    if(mBtn)  mBtn.classList.remove('active');
    showNotif('You slip away into the forest…');
  }
}

// ─── Underground Den ──────────────────────────────────────────────────────────
const den = {
  placed:false, pos:new THREE.Vector3(), insideY:0,
  entrance:null, interior:null, fireLight:null, emberMesh:null,
  foodCache:0, restTimer:0,
};

function buildDen(x, z){
  const ty = terrainY(x,z);
  if(ty < 1.0){ showNotif('Too wet here — find higher ground.'); return; }
  if(den.placed){ showNotif('You already have a den.'); return; }
  den.placed = true;
  den.pos.set(x, ty, z);
  den.insideY = ty - 7;

  // ── Entrance mound ──
  const eg = new THREE.Group();
  const dirtMat  = new THREE.MeshStandardMaterial({color:0x3a2a12,roughness:0.98});
  const stoneMat2= new THREE.MeshStandardMaterial({color:0x545048,roughness:0.9});
  // Earth mound
  const mound=new THREE.Mesh(new THREE.SphereGeometry(1.6,10,8),dirtMat);
  mound.scale.set(1.3,0.55,1.1); mound.position.set(0,0.5,0); eg.add(mound);
  // Dark hole
  const hole=new THREE.Mesh(new THREE.CircleGeometry(0.65,14),new THREE.MeshBasicMaterial({color:0x050302}));
  hole.rotation.x=0.55; hole.position.set(0,0.52,0.8); eg.add(hole);
  // Hole arch rocks
  for(let i=0;i<5;i++){
    const a=Math.PI*0.15+i*Math.PI*0.18;
    const r=new THREE.Mesh(new THREE.DodecahedronGeometry(0.22+Math.random()*0.1,0),stoneMat2);
    r.position.set(Math.cos(a)*0.75, 0.5+Math.sin(a)*0.4, 0.85);
    r.rotation.set(Math.random(),Math.random(),Math.random());
    eg.add(r);
  }
  // Scattered dirt
  for(let i=0;i<8;i++){
    const d=new THREE.Mesh(new THREE.SphereGeometry(0.12+Math.random()*0.1,5,4),dirtMat);
    d.scale.y=0.35; d.position.set((Math.random()-0.5)*2.5, 0.1, (Math.random()-0.5)*2+0.5); eg.add(d);
  }
  eg.position.set(x,ty,z);
  scene.add(eg);
  den.entrance = eg;

  // ── Underground room ──
  const ig = new THREE.Group();
  const caveY = den.insideY;
  const caveMat = new THREE.MeshStandardMaterial({color:0x2e2010,roughness:0.99,side:THREE.BackSide});
  const cave=new THREE.Mesh(new THREE.SphereGeometry(4.5,16,12),caveMat);
  cave.scale.set(1.5,0.72,2.0); cave.position.y=caveY+2.2; ig.add(cave);
  // Floor
  const floorMat=new THREE.MeshStandardMaterial({color:0x1e1408,roughness:0.99});
  const floor=new THREE.Mesh(new THREE.CircleGeometry(4.2,18),floorMat);
  floor.rotation.x=-Math.PI/2; floor.position.y=caveY+0.02; ig.add(floor);
  // Roots
  const rootMat=new THREE.MeshStandardMaterial({color:0x3a2210,roughness:0.97});
  for(let i=0;i<14;i++){
    const r=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.01,0.35+Math.random()*0.7,4),rootMat);
    r.position.set((Math.random()-0.5)*5,caveY+3.8,(Math.random()-0.5)*4);
    r.rotation.z=(Math.random()-0.5)*0.5; ig.add(r);
  }
  // Bedding (dried grass pile)
  const bedMat=new THREE.MeshStandardMaterial({color:0x7a6828,roughness:0.99});
  const bed=new THREE.Mesh(new THREE.SphereGeometry(1.2,8,6),bedMat);
  bed.scale.set(1.4,0.22,1.8); bed.position.set(1.2,caveY+0.12,-0.8); ig.add(bed);
  // Bone pile
  const boneMat=new THREE.MeshStandardMaterial({color:0xd8d0b0,roughness:0.85});
  for(let i=0;i<5;i++){
    const b=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.03,0.3+Math.random()*0.2,5),boneMat);
    b.position.set(-1.5+(Math.random()-0.5)*0.8,caveY+0.1,(Math.random()-0.5)*0.6);
    b.rotation.set(Math.random()*0.5,Math.random()*Math.PI,Math.random()*0.5); ig.add(b);
  }
  // Ember glow
  const emberMat=new THREE.MeshBasicMaterial({color:0xff5500});
  den.emberMesh=new THREE.Mesh(new THREE.SphereGeometry(0.1,6,5),emberMat);
  den.emberMesh.position.set(-0.4,caveY+0.15,0.5); ig.add(den.emberMesh);
  // Fire stones
  for(let i=0;i<6;i++){
    const a=i/6*Math.PI*2;
    const s=new THREE.Mesh(new THREE.SphereGeometry(0.1,5,4),new THREE.MeshStandardMaterial({color:0x444038,roughness:0.9}));
    s.position.set(-0.4+Math.cos(a)*0.22,caveY+0.08,0.5+Math.sin(a)*0.22); ig.add(s);
  }
  // Exit glow (orange-lit tunnel upward)
  const exitGlow=new THREE.Mesh(new THREE.CircleGeometry(0.7,14),new THREE.MeshBasicMaterial({color:0x604020,transparent:true,opacity:0.7}));
  exitGlow.rotation.x=0.5; exitGlow.position.set(0,caveY+0.5,3.2); exitGlow.name='denExit'; ig.add(exitGlow);
  // Warm fire point light
  den.fireLight=new THREE.PointLight(0xff6820,2.8,7);
  den.fireLight.position.set(-0.4,caveY+0.6,0.5); ig.add(den.fireLight);
  // Moss
  const mossMat=new THREE.MeshStandardMaterial({color:0x1e3a0a,roughness:0.99});
  for(let i=0;i<5;i++){
    const m=new THREE.Mesh(new THREE.SphereGeometry(0.25+Math.random()*0.15,6,5),mossMat);
    m.scale.y=0.18; m.position.set((Math.random()-0.5)*5,caveY+0.04,(Math.random()-0.5)*3.5); ig.add(m);
  }
  scene.add(ig);
  den.interior = ig;
  showNotif('Den dug! Press E at the entrance to go inside.');
}

function enterDen(){
  if(!den.placed) return;
  const dist=den.pos.distanceTo(player.pos);
  if(dist>2.8){ showNotif('Get closer to the den entrance.'); return; }
  player.inDen=true;
  player.pos.set(den.pos.x, den.insideY+1.5, den.pos.z);
  player.vel.set(0,0,0);
  scene.fog.color.set(0x100804);
  ambientLight.color.set(0x402010); ambientLight.intensity=0.4;
  showNotif('Inside the den. Press G to exit. Rest here to heal.');
}

function exitDen(){
  player.inDen=false;
  player.pos.set(den.pos.x, terrainY(den.pos.x,den.pos.z)+1.8, den.pos.z+1.5);
  player.vel.set(0,0,0);
}

function updateDen(dt){
  if(!den.placed) return;
  // Flicker fire
  if(den.fireLight){
    den.fireLight.intensity=2.4+Math.sin(Date.now()*0.009)*0.5+Math.sin(Date.now()*0.017)*0.3;
  }
  if(den.emberMesh){
    const s=0.9+Math.sin(Date.now()*0.006)*0.15;
    den.emberMesh.scale.setScalar(s);
  }
  if(player.inDen){
    // Faster regen while resting in den
    player.health =Math.min(100,player.health +4*dt);
    player.stamina=Math.min(100,player.stamina+20*dt);
    // Check exit
    const exitPos=new THREE.Vector3(den.pos.x,den.insideY+0.5,den.pos.z+3.2);
    if(player.pos.distanceTo(exitPos)<2.0&&(keys['KeyG']||touchState.bond)){
      exitDen();
    }
    // Feed pups if food cached
    if(den.foodCache>0 && notifTimer<=0){
      notifEl.textContent=`Den: ${den.foodCache}/${DEN_FOOD_MAX} food stored · Press Z to sleep`;
      notifEl.classList.add('show');
    }
    // Sleep with Z
    if(keys['KeyZ']){
      timeOfDay=0.26; showNotif('You sleep deeply. Dawn comes.');
      player.health=Math.min(100,player.health+30);
      player.hunger=Math.max(0,player.hunger-15);
    }
  } else {
    // Restore fog after exiting
    if(scene.fog.color.r<0.05) scene.fog.color.lerp(new THREE.Color(0x8da8b0),0.02);
    if(ambientLight.intensity<0.45) ambientLight.intensity=Math.min(0.5,ambientLight.intensity+0.01);
  }
}

// ─── Player State ─────────────────────────────────────────────────────────────
const player={
  pos:new THREE.Vector3(0,terrainY(0,0)+1.8,0),
  vel:new THREE.Vector3(),
  yaw:0,pitch:0,
  health:100,hunger:100,thirst:100,stamina:100,
  grounded:false,kills:0,day:1,legPhase:0,
  attacking:false,attackCooldown:0,
  howling:false,howlTimer:0,dead:false,
  crouching:false, inDen:false, pounceReady:false,
};

// ─── Input ────────────────────────────────────────────────────────────────────
const keys={};
document.addEventListener('keydown',e=>{keys[e.code]=true});
document.addEventListener('keyup',  e=>{keys[e.code]=false});

let mouseX=0,mouseY=0,pointerLocked=false;
document.addEventListener('mousemove',e=>{
  if(!pointerLocked) return;
  mouseX+=e.movementX*0.0018; mouseY+=e.movementY*0.0018;
  mouseY=Math.max(-0.5,Math.min(0.7,mouseY));
});
canvas.addEventListener('click',()=>{if(!pointerLocked&&!isMobile) canvas.requestPointerLock();});
document.addEventListener('pointerlockchange',()=>{ pointerLocked=document.pointerLockElement===canvas; });

// Mobile setup
if(isMobile){
  document.getElementById('touch-controls').style.display='block';
  document.getElementById('controls').style.display='none';
  document.body.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
}

// Joystick
const joystickZone=document.getElementById('joystick-zone');
const joystickKnob=document.getElementById('joystick-knob');
const joystick={active:false,id:-1,startX:0,startZ:0,dx:0,dy:0};
const JOY_R=45;
joystickZone.addEventListener('touchstart',e=>{e.preventDefault();const t=e.changedTouches[0],r=joystickZone.getBoundingClientRect();joystick.active=true;joystick.id=t.identifier;joystick.startX=r.left+r.width/2;joystick.startZ=r.top+r.height/2;joystick.dx=0;joystick.dy=0;},{passive:false});
joystickZone.addEventListener('touchmove',e=>{e.preventDefault();for(const t of e.changedTouches){if(t.identifier!==joystick.id)continue;let dx=t.clientX-joystick.startX,dy=t.clientY-joystick.startZ;const l=Math.sqrt(dx*dx+dy*dy);if(l>JOY_R){dx=dx/l*JOY_R;dy=dy/l*JOY_R;}joystick.dx=dx/JOY_R;joystick.dy=dy/JOY_R;joystickKnob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;}},{passive:false});
const endJoy=e=>{for(const t of e.changedTouches){if(t.identifier===joystick.id){joystick.active=false;joystick.dx=0;joystick.dy=0;joystickKnob.style.transform='translate(-50%,-50%)'}}};
joystickZone.addEventListener('touchend',endJoy,{passive:false});
joystickZone.addEventListener('touchcancel',endJoy,{passive:false});

// Look zone
const lookZone=document.getElementById('look-zone');
const look={active:false,id:-1,lastX:0,lastY:0};
lookZone.addEventListener('touchstart',e=>{e.preventDefault();if(look.active)return;const t=e.changedTouches[0];look.active=true;look.id=t.identifier;look.lastX=t.clientX;look.lastY=t.clientY;},{passive:false});
lookZone.addEventListener('touchmove',e=>{e.preventDefault();for(const t of e.changedTouches){if(t.identifier!==look.id)continue;mouseX+=(t.clientX-look.lastX)*0.004;mouseY+=(t.clientY-look.lastY)*0.004;mouseY=Math.max(-0.5,Math.min(0.7,mouseY));look.lastX=t.clientX;look.lastY=t.clientY;}},{passive:false});
const endLook=e=>{for(const t of e.changedTouches){if(t.identifier===look.id)look.active=false;}};
lookZone.addEventListener('touchend',endLook,{passive:false});
lookZone.addEventListener('touchcancel',endLook,{passive:false});

// Touch buttons
const touchState={attack:false,howl:false,bond:false,sprint:false};
function bindBtn(id,key){
  const el=document.getElementById(id);
  el.addEventListener('touchstart',e=>{e.preventDefault();touchState[key]=true; el.classList.add('pressed');},{passive:false});
  el.addEventListener('touchend',  e=>{e.preventDefault();touchState[key]=false;el.classList.remove('pressed');},{passive:false});
  el.addEventListener('touchcancel',e=>{touchState[key]=false;el.classList.remove('pressed');},{passive:false});
}
bindBtn('btn-attack','attack'); bindBtn('btn-howl','howl');
bindBtn('btn-bond','bond');     bindBtn('btn-sprint','sprint');
// Prey button — tap to toggle
const preyMobileBtn=document.getElementById('btn-prey');
if(preyMobileBtn) preyMobileBtn.addEventListener('touchstart',e=>{e.preventDefault();togglePreyMode();},{passive:false});

// ─── HUD Refs ─────────────────────────────────────────────────────────────────
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
let notifTimer=0;
function showNotif(msg){ notifEl.textContent=msg; notifEl.classList.add('show'); notifTimer=3.5; }

// ─── Minimap ──────────────────────────────────────────────────────────────────
const minimapCanvas = document.getElementById('minimap');
const mmCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;
const MM = 150; // canvas size in px
const MM_RADIUS = 140; // world units visible
const MM_SCALE = MM / (MM_RADIUS * 2);
const mapMarkers = [];

function wm(wx, wz){ // world → minimap pixel (player-centred)
  return [MM/2+(wx-player.pos.x)*MM_SCALE, MM/2+(wz-player.pos.z)*MM_SCALE];
}
function inMM(px,py,margin=4){ return px>=-margin&&px<=MM+margin&&py>=-margin&&py<=MM+margin; }

function drawMinimap(){
  if(!mmCtx||player.dead) return;
  mmCtx.clearRect(0,0,MM,MM);
  // Dark forest background
  mmCtx.fillStyle='rgba(6,12,6,0.90)';
  mmCtx.fillRect(0,0,MM,MM);

  // Huge lake
  const [lmx,lmz]=wm(LAKE_X,LAKE_Z);
  const lmr=Math.round(LAKE_R*MM_SCALE);
  if(inMM(lmx,lmz,lmr+12)){
    const lgr=mmCtx.createRadialGradient(lmx,lmz,0,lmx,lmz,lmr);
    lgr.addColorStop(0,'rgba(14,40,90,0.95)');
    lgr.addColorStop(0.55,'rgba(28,90,170,0.80)');
    lgr.addColorStop(1,'rgba(10,40,90,0.25)');
    mmCtx.beginPath(); mmCtx.arc(lmx,lmz,lmr,0,Math.PI*2);
    mmCtx.fillStyle=lgr; mmCtx.fill();
    // Label if near
    if(inMM(lmx,lmz,10)){
      mmCtx.fillStyle='rgba(120,190,255,0.55)'; mmCtx.font='7px sans-serif';
      mmCtx.textAlign='center'; mmCtx.fillText('LAKE',lmx,lmz); mmCtx.textAlign='left';
    }
  }

  // Spawn pond — blue circle (cx=0, cz=-10)
  const [pmx,pmz]=wm(0,-10);
  const pr=Math.round(8.5*MM_SCALE);
  if(inMM(pmx,pmz,pr)){
    const gr=mmCtx.createRadialGradient(pmx,pmz,0,pmx,pmz,pr);
    gr.addColorStop(0,'rgba(50,140,220,0.85)');
    gr.addColorStop(1,'rgba(20,60,130,0.35)');
    mmCtx.beginPath(); mmCtx.arc(pmx,pmz,pr,0,Math.PI*2);
    mmCtx.fillStyle=gr; mmCtx.fill();
  }

  // Den — gold diamond
  if(den.placed){
    const [dx,dz]=wm(den.pos.x,den.pos.z);
    if(inMM(dx,dz)){
      mmCtx.save(); mmCtx.translate(dx,dz); mmCtx.rotate(Math.PI/4);
      mmCtx.fillStyle='rgba(255,200,40,0.92)'; mmCtx.fillRect(-4,-4,8,8); mmCtx.restore();
    }
  }

  // Animals — small dots (docile ones brighter/larger)
  animals.forEach(a=>{
    if(a.dead) return;
    const [ax,az]=wm(a.mesh.position.x,a.mesh.position.z);
    if(!inMM(ax,az)) return;
    if(a.docile){
      mmCtx.beginPath(); mmCtx.arc(ax,az,3,0,Math.PI*2);
      mmCtx.fillStyle='rgba(230,210,100,0.92)'; mmCtx.fill();
      // small ring to highlight
      mmCtx.beginPath(); mmCtx.arc(ax,az,4.5,0,Math.PI*2);
      mmCtx.strokeStyle='rgba(255,230,100,0.45)'; mmCtx.lineWidth=1; mmCtx.stroke();
    } else {
      mmCtx.beginPath(); mmCtx.arc(ax,az,2,0,Math.PI*2);
      mmCtx.fillStyle=a.type==='deer'?'rgba(200,165,75,0.70)':'rgba(155,125,65,0.70)';
      mmCtx.fill();
    }
  });

  // Mate — pink
  const [mateX,mateZ]=wm(mateMesh.position.x,mateMesh.position.z);
  if(inMM(mateX,mateZ)){
    mmCtx.beginPath(); mmCtx.arc(mateX,mateZ,3.5,0,Math.PI*2);
    mmCtx.fillStyle='rgba(255,130,180,0.92)'; mmCtx.fill();
  }

  // Pups — tiny pink
  packState.pups.forEach(pup=>{
    const [ppx,ppz]=wm(pup.mesh.position.x,pup.mesh.position.z);
    if(!inMM(ppx,ppz)) return;
    mmCtx.beginPath(); mmCtx.arc(ppx,ppz,2,0,Math.PI*2);
    mmCtx.fillStyle='rgba(255,160,200,0.75)'; mmCtx.fill();
  });

  // Rival packs — blue (neutral) or green (allied)
  rivalPacks.forEach(rp=>{
    const [rpx,rpz]=wm(rp.x,rp.z);
    const allied=playerAlliance===rp;
    if(inMM(rpx,rpz,12)){
      mmCtx.beginPath(); mmCtx.arc(rpx,rpz,allied?5:4,0,Math.PI*2);
      mmCtx.fillStyle=allied?'rgba(80,255,120,0.92)':'rgba(140,180,255,0.85)'; mmCtx.fill();
      mmCtx.beginPath(); mmCtx.arc(rpx,rpz,allied?7:6,0,Math.PI*2);
      mmCtx.strokeStyle=allied?'rgba(100,255,140,0.7)':'rgba(180,220,255,0.5)'; mmCtx.lineWidth=1; mmCtx.stroke();
      mmCtx.fillStyle=allied?'rgba(140,255,160,0.85)':'rgba(200,230,255,0.65)'; mmCtx.font='6px sans-serif';
      mmCtx.textAlign='center'; mmCtx.fillText((allied?'★ ':'')+rp.name,rpx,rpz+11); mmCtx.textAlign='left';
    }
  });
  // Pack mates — magenta dots
  packState.packMates.forEach(pm=>{
    const [pmx,pmz]=wm(pm.mesh.position.x,pm.mesh.position.z);
    if(inMM(pmx,pmz)){
      mmCtx.beginPath(); mmCtx.arc(pmx,pmz,3,0,Math.PI*2);
      mmCtx.fillStyle='rgba(255,100,220,0.88)'; mmCtx.fill();
    }
  });

  // Hunter wolves — red (prey mode)
  if(preyMode){
    hunterWolves.forEach(h=>{
      if(!h.active) return;
      const [hx,hz]=wm(h.mesh.position.x,h.mesh.position.z);
      if(!inMM(hx,hz)) return;
      mmCtx.beginPath(); mmCtx.arc(hx,hz,4,0,Math.PI*2);
      mmCtx.fillStyle='rgba(255,35,15,0.96)'; mmCtx.fill();
      // pulsing ring
      mmCtx.beginPath(); mmCtx.arc(hx,hz,5+Math.sin(Date.now()*0.006)*2,0,Math.PI*2);
      mmCtx.strokeStyle='rgba(255,80,40,0.6)'; mmCtx.lineWidth=1; mmCtx.stroke();
    });
  }

  // User markers — gold X
  mmCtx.strokeStyle='rgba(255,210,50,0.95)'; mmCtx.lineWidth=1.5;
  mapMarkers.forEach(mk=>{
    const [mkx,mkz]=wm(mk.x,mk.z);
    if(!inMM(mkx,mkz,12)) return;
    mmCtx.beginPath();
    mmCtx.moveTo(mkx-5,mkz-5); mmCtx.lineTo(mkx+5,mkz+5);
    mmCtx.moveTo(mkx+5,mkz-5); mmCtx.lineTo(mkx-5,mkz+5);
    mmCtx.stroke();
    // label
    if(mk.label){ mmCtx.fillStyle='rgba(255,210,50,0.7)'; mmCtx.font='7px sans-serif'; mmCtx.fillText(mk.label,mkx+6,mkz-3); }
  });

  // Player — white/red triangle facing direction
  mmCtx.save();
  mmCtx.translate(MM/2, MM/2);
  mmCtx.rotate(-player.yaw);
  mmCtx.beginPath(); mmCtx.moveTo(0,-7); mmCtx.lineTo(-4,5); mmCtx.lineTo(4,5); mmCtx.closePath();
  mmCtx.fillStyle=preyMode?'rgba(255,80,50,1.0)':'rgba(255,255,255,1.0)'; mmCtx.fill();
  mmCtx.restore();

  // North indicator
  mmCtx.fillStyle='rgba(255,255,255,0.32)'; mmCtx.font='bold 8px sans-serif'; mmCtx.textAlign='center';
  mmCtx.fillText('N',MM/2,10);

  // Border
  mmCtx.strokeStyle='rgba(255,255,255,0.14)'; mmCtx.lineWidth=1;
  mmCtx.strokeRect(0.5,0.5,MM-1,MM-1);
}

// ─── Day / Night Cycle ────────────────────────────────────────────────────────
let timeOfDay=0.25;
const skyDawn =new THREE.Color(0xffa060), skyNoon=new THREE.Color(0x87ceeb);
const skyDusk =new THREE.Color(0xff7040), skyNight=new THREE.Color(0x050818);
function lerpColor(a,b,t){return new THREE.Color().lerpColors(a,b,t)}
function skyColor(t){
  if(t<0.25) return lerpColor(skyNight,skyDawn,t/0.25);
  if(t<0.5)  return lerpColor(skyDawn,skyNoon,(t-0.25)/0.25);
  if(t<0.75) return lerpColor(skyNoon,skyDusk,(t-0.5)/0.25);
  return lerpColor(skyDusk,skyNight,(t-0.75)/0.25);
}
function updateSky(dt){
  timeOfDay=(timeOfDay+dt/DAY_LENGTH)%1;
  const sc=skyColor(timeOfDay), sc2=skyColor((timeOfDay+0.5)%1);
  scene.fog.color.copy(sc); renderer.setClearColor(sc);
  const pos=skyGeo.attributes.position, col=skyGeo.attributes.color;
  for(let i=0;i<pos.count;i++){
    const y=pos.getY(i),t=Math.max(0,Math.min(1,(y+10)/700));
    const c=lerpColor(sc,new THREE.Color(sc).lerp(sc2,0.3),t);
    col.setXYZ(i,c.r,c.g,c.b);
  }
  col.needsUpdate=true;
  const sunAngle=(timeOfDay-0.25)*Math.PI*2;
  sun.position.set(Math.cos(sunAngle)*200,Math.sin(sunAngle)*200,-80);
  sun.intensity=Math.max(0,Math.sin(sunAngle))*3.2;
  // Sun disc follows sun
  sunDisc.position.copy(sun.position).normalize().multiplyScalar(650);
  sunDisc.lookAt(0,0,0);
  sunHalo.position.copy(sunDisc.position).normalize().multiplyScalar(648);
  sunHalo.lookAt(0,0,0);
  sunDisc.material.opacity=Math.max(0,Math.sin(sunAngle))*0.95;
  sunHalo.material.opacity=Math.max(0,Math.sin(sunAngle))*0.22;
  moonLight.position.set(-Math.cos(sunAngle)*200,-Math.sin(sunAngle)*200,80);
  moonLight.intensity=Math.max(0,-Math.sin(sunAngle))*0.55;
  moonDisc.position.copy(moonLight.position).normalize().multiplyScalar(640);
  moonDisc.lookAt(0,0,0);
  moonDisc.material.opacity=Math.max(0,-Math.sin(sunAngle))*0.9;
  starMesh.material.opacity=Math.max(0,-Math.sin(sunAngle)*1.4);
  starMesh.material.transparent=true;
  ambientLight.intensity=0.25+Math.max(0,Math.sin(sunAngle))*0.55;
  // Cloud opacity with time
  const cloudAlpha=0.3+Math.max(0,Math.sin(sunAngle))*0.35;
  clouds.forEach(c=>{ c.material.opacity=cloudAlpha; });
  const dayNum=Math.floor(timeOfDay*24);
  let ts='Night';
  if(dayNum>=5&&dayNum<8) ts='Dawn';
  else if(dayNum>=8&&dayNum<12) ts='Morning';
  else if(dayNum>=12&&dayNum<14) ts='Noon';
  else if(dayNum>=14&&dayNum<17) ts='Afternoon';
  else if(dayNum>=17&&dayNum<20) ts='Dusk';
  dayLabel.textContent=ts+' · Day '+player.day;
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function isInWater(pos){
  if(terrainY(pos.x,pos.z)<0.32) return true;
  const dx=pos.x, dz=pos.z+10;
  if(Math.sqrt(dx*dx+dz*dz)<9.5) return true;
  // huge lake
  const lx=pos.x-LAKE_X, lz=pos.z-LAKE_Z;
  return Math.sqrt(lx*lx+lz*lz)<LAKE_R;
}

// ─── Howl ─────────────────────────────────────────────────────────────────────
function triggerHowl(){
  if(player.howling) return;
  player.howling=true; player.howlTimer=2.2;
  howlRing.classList.remove('active'); void howlRing.offsetWidth; howlRing.classList.add('active');
  showNotif('Your howl echoes across the valley…');
  mate.state='follow'; mate.timer=10;
  animals.forEach(a=>{ if(!a.dead&&a.mesh.position.distanceTo(player.pos)<HOWL_RADIUS){a.state='flee';a.timer=6;} });
}

// ─── Attack / Catch ───────────────────────────────────────────────────────────
function tryAttack(fromBtn=false){
  if(player.attackCooldown>0) return;
  if(player.stamina<8&&!fromBtn) return;
  player.attacking=true;
  const isPounce = player.pounceReady;
  player.attackCooldown = isPounce ? 1.0 : 0.5;
  if(player.stamina>=8) player.stamina=Math.max(0,player.stamina-(isPounce?22:6));
  let hit=false;
  const range = isPounce ? POUNCE_RANGE : ATTACK_RANGE;
  animals.forEach(a=>{
    if(a.dead) return;
    // Docile (tame edge) prey catchable at generous range
    const catchRange = a.docile ? Math.max(range, 7.0) : range;
    if(a.mesh.position.distanceTo(player.pos)<catchRange){
      const dmg = a.docile ? 9999 : (isPounce?(55+Math.random()*25):(18+Math.random()*12));
      a.takeDamage(dmg); hit=true;
      if(isPounce) showNotif('Pounce! You pin it to the ground.');
      if(a.dead){
        player.kills++; killsLabel.textContent='Kills: '+player.kills;
        const meat = a.type==='deer'?50:20;
        player.hunger=Math.min(100,player.hunger+meat);
        // Store extra in den if full
        if(player.hunger>=95&&den.placed&&den.foodCache<DEN_FOOD_MAX){ den.foodCache++; showNotif(`Stored food in den (${den.foodCache}/${DEN_FOOD_MAX}).`); }
        else showNotif(a.type==='deer'?'You bring down a deer.':'A rabbit caught. Quick meal.');
        if(player.kills===5)  { updatePackLabel(); showNotif('Pack: Beta Wolf earned.'); }
        if(player.kills===15) { packLabel.textContent='Pack: Alpha Wolf'; showNotif('You are Alpha.'); }
      }
    }
  });
  // Exhausted animal — easy kill at normal range
  if(!hit){
    animals.forEach(a=>{
      if(a.dead||!a.exhausted) return;
      if(a.mesh.position.distanceTo(player.pos)<ATTACK_RANGE*1.5){
        a.takeDamage(999); hit=true;
        player.kills++; killsLabel.textContent='Kills: '+player.kills;
        const meat=a.type==='deer'?50:20;
        player.hunger=Math.min(100,player.hunger+meat);
        if(den.placed&&player.hunger>=95&&den.foodCache<DEN_FOOD_MAX){ den.foodCache++; showNotif(`Stored in den (${den.foodCache}/${DEN_FOOD_MAX}).`); }
        else showNotif(a.type==='deer'?'Deer brought down — pack eats tonight.':'Rabbit caught.');
        if(player.kills===5)  updatePackLabel();
        if(player.kills===15) { packLabel.textContent='Pack: Alpha Wolf'; showNotif('You are Alpha.'); }
      }
    });
  }
  // Berry eating
  if(!hit){
    berryBushes.forEach(b=>{
      if(b.depleted||b.pos.distanceTo(player.pos)>2.2) return;
      player.hunger=Math.min(100,player.hunger+12);
      b.depleted=true; b.regenTimer=60;
      b.mesh.children.forEach((c,i)=>{ if(i>0) c.visible=false; }); // hide berries
      showNotif('Wild berries. Bitter but filling.'); hit=true;
    });
  }
  // Fish catch (crouching in water)
  if(!hit&&player.crouching&&isInWater(player.pos)){
    fishList.forEach(f=>{
      if(f.caught||f.mesh.position.distanceTo(player.pos)>2.8) return;
      f.caught=true; f.mesh.visible=false;
      player.hunger=Math.min(100,player.hunger+28);
      player.thirst=Math.min(100,player.thirst+18);
      showNotif('Caught a fish! Fresh meat from the river.'); hit=true;
      setTimeout(()=>{ f.caught=false; f.mesh.visible=true; },45000);
    });
  }
  // Drink
  if(!hit&&isInWater(player.pos)){ player.thirst=Math.min(100,player.thirst+35); showNotif('You drink from the stream.'); }
}

// ─── Player Update ────────────────────────────────────────────────────────────
const cameraOffset = new THREE.Vector3(0,1.8,-4.5);
const lookTarget   = new THREE.Vector3();

function updatePlayer(dt){
  if(player.dead) return;
  player.yaw=-mouseX;
  const fwd  = new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
  const right= new THREE.Vector3( Math.cos(player.yaw),0,-Math.sin(player.yaw));
  // Crouch toggle
  if(keys['KeyC'] && !player._cWas){ player.crouching=!player.crouching; player._cWas=true;
    showNotif(player.crouching?'Stalking… Animals won\'t notice you as easily.':'Standing.');
  }
  if(!keys['KeyC']) player._cWas=false;
  // Prey mode toggle
  if(keys['KeyP']&&!player._pWas){ player._pWas=true; togglePreyMode(); }
  if(!keys['KeyP']) player._pWas=false;
  // Map marker (M key)
  if(keys['KeyM']&&!player._mWas){ player._mWas=true;
    let removed=false;
    for(let i=mapMarkers.length-1;i>=0;i--){
      const mk=mapMarkers[i];
      if(Math.sqrt((mk.x-player.pos.x)**2+(mk.z-player.pos.z)**2)<10){
        mapMarkers.splice(i,1); removed=true; showNotif('Map marker removed.'); break;
      }
    }
    if(!removed&&mapMarkers.length<20){
      mapMarkers.push({x:player.pos.x, z:player.pos.z, label:mapMarkers.length>0?String(mapMarkers.length+1):'1'});
      showNotif('Marker '+(mapMarkers.length)+' placed on map.');
    }
  }
  if(!keys['KeyM']) player._mWas=false;

  // G key — dig den or exit den
  if(keys['KeyG']&&!player._gWas){ player._gWas=true;
    if(player.inDen) exitDen();
    else if(den.placed && den.pos.distanceTo(player.pos)<2.8) enterDen();
    else if(!den.placed) buildDen(player.pos.x, player.pos.z);
  }
  if(!keys['KeyG']) player._gWas=false;

  // V key — toggle fly
  if(keys['KeyV']&&!keys._vWas){ keys._vWas=true; toggleFly(); }
  if(!keys['KeyV']) keys._vWas=false;

  const sprinting=!player.crouching&&!flying&&(keys['ShiftLeft']||keys['ShiftRight']||touchState.sprint);
  const moving   =keys['KeyW']||keys['KeyS']||keys['KeyA']||keys['KeyD']||joystick.active;
  const cMult    = player.crouching ? CROUCH_MULT : 1.0;
  const flySpd   = flying ? WOLF_SPEED*1.6 : WOLF_SPEED*cMult*(sprinting&&player.stamina>0?SPRINT_MULT:1.0);
  // Pounce ready: sprinting toward an animal within range
  player.pounceReady=false;
  if(sprinting && player.stamina>20){
    animals.forEach(a=>{ if(!a.dead&&a.mesh.position.distanceTo(player.pos)<POUNCE_RANGE) player.pounceReady=true; });
  }
  const move=new THREE.Vector3();
  if(keys['KeyW']) move.addScaledVector(fwd, 1);
  if(keys['KeyS']) move.addScaledVector(fwd,-1);
  if(keys['KeyD']) move.addScaledVector(right,1);
  if(keys['KeyA']) move.addScaledVector(right,-1);
  if(joystick.active){ move.addScaledVector(fwd,-joystick.dy); move.addScaledVector(right,joystick.dx); }
  if(move.lengthSq()>0) move.normalize();
  player.vel.x=move.x*flySpd; player.vel.z=move.z*flySpd;
  const ty=terrainY(player.pos.x,player.pos.z)+0.9;
  if(flying){
    // Fly physics: Space = rise, Shift = descend, otherwise gentle glide down
    if(keys['Space']) player.vel.y=Math.min(player.vel.y+18*dt,12);
    else if(keys['ShiftLeft']||keys['ShiftRight']) player.vel.y=Math.max(player.vel.y-18*dt,-10);
    else player.vel.y=Math.max(player.vel.y-4*dt,-3); // slow glide descent
    player.grounded=false;
    // Don't go below terrain while flying
    if(player.pos.y<ty){ player.pos.y=ty; player.vel.y=0; }
  } else {
    if(player.pos.y>ty){ player.vel.y-=GRAVITY*dt; } else { player.vel.y=0; player.pos.y=ty; player.grounded=true; }
  }
  player.pos.addScaledVector(player.vel,dt);
  player.pos.x=Math.max(-WORLD_SIZE/2+5,Math.min(WORLD_SIZE/2-5,player.pos.x));
  player.pos.z=Math.max(-WORLD_SIZE/2+5,Math.min(WORLD_SIZE/2-5,player.pos.z));
  // Stamina
  if(sprinting&&moving){ player.stamina=Math.max(0,player.stamina-18*dt); } else { player.stamina=Math.min(100,player.stamina+12*dt); }
  // Vitals decay
  player.hunger=Math.max(0,player.hunger-dt*100/160);
  player.thirst=Math.max(0,player.thirst-dt*100/114);
  if(isInWater(player.pos)){
    const wasLow=player.thirst<30;
    player.thirst=Math.min(100,player.thirst+10*dt); // faster auto-drink
    if(wasLow&&player.thirst>=30) showNotif('You drink deeply from the water.');
  }
  if(player.hunger<10) player.health=Math.max(0,player.health-4*dt);
  if(player.thirst<10) player.health=Math.max(0,player.health-6*dt);
  if(player.hunger>50&&player.thirst>50) player.health=Math.min(100,player.health+2*dt);
  // Death
  if(player.health<=0&&!player.dead){
    player.dead=true;
    const hunterKill=preyMode&&hunterWolves.some(h=>h.active&&h.mesh.position.distanceTo(player.pos)<5);
    deathReason.textContent=hunterKill?'The hunter wolves brought you down.':player.hunger<10?'Starvation claimed your spirit.':player.thirst<10?'Thirst consumed you.':'The wilderness took you.';
    deathScreen.classList.add('show'); document.exitPointerLock();
  }
  // Cooldowns
  if(player.attackCooldown>0) player.attackCooldown-=dt;
  if(player.attacking&&player.attackCooldown<0.3) player.attacking=false;
  if(player.howling){ player.howlTimer-=dt; if(player.howlTimer<0) player.howling=false; }
  // Actions
  if(keys['KeyE']||touchState.attack) tryAttack();
  if(touchState.howl&&!player.howling){ touchState.howl=false; triggerHowl(); }
  if(keys['Space']&&!player.howling&&!flying) triggerHowl();
  packState.eCooldown=Math.max(0,packState.eCooldown-dt);
  // F key — join rival pack, leave pack, or bond/mate
  if((keys['KeyF']&&!fWasDown)||touchState.bond){
    fWasDown=true; touchState.bond=false;
    // Find nearest rival pack wolf within join range
    let nearPack=null;
    for(const rp of rivalPacks){
      for(const w of rp.wolves){
        if(w.mesh.position.distanceTo(player.pos)<10){ nearPack=rp; break; }
      }
      if(nearPack) break;
    }
    if(nearPack){
      tryJoinPack(nearPack);
    } else if(playerAlliance && mateMesh.position.distanceTo(player.pos)<BOND_RANGE*2){
      leaveEnemyPack();
    } else if(!playerAlliance){
      tryBondOrMate();
    }
  }
  if(!keys['KeyF']) fWasDown=false;
  // Proximity prompt
  const mateDist=mateMesh.position.distanceTo(player.pos);
  let shownPrompt=false;
  // Rival pack join prompt
  for(const rp of rivalPacks){
    for(const w of rp.wolves){
      if(w.mesh.position.distanceTo(player.pos)<10&&notifTimer<=0){
        notifEl.textContent=playerAlliance===rp?`Running with the ${rp.name} · F near mate to leave`:`Press F to join the ${rp.name}`;
        notifEl.classList.add('show'); shownPrompt=true; break;
      }
    }
    if(shownPrompt) break;
  }
  if(!shownPrompt && mateDist<BOND_RANGE&&notifTimer<=0){
    if(playerAlliance){ notifEl.textContent='Press F to leave '+playerAlliance.name+' and return home'; notifEl.classList.add('show'); }
    else if(!packState.mated&&packState.bondLevel<3){ notifEl.textContent='Press F to bond with her'; notifEl.classList.add('show'); }
    else if(packState.mated&&!packState.pregnant){ notifEl.textContent='Press F to start a litter'; notifEl.classList.add('show'); }
  }
  // Wolf mesh — crouch lowers body
  wolf.position.copy(player.pos); wolf.position.y -= player.crouching ? 1.05 : 0.72;
  const targetScaleY = player.crouching ? 0.72 : 1.0;
  wolf.scale.y += (targetScaleY - wolf.scale.y) * 0.15;
  if(move.lengthSq()>0) wolf.rotation.y=Math.atan2(move.x,move.z);
  if(moving){
    player.legPhase+=flySpd*dt*3.5;
    ['leg0','leg2'].forEach(n=>{const l=wolf.getObjectByName(n);if(l)l.rotation.x=Math.sin(player.legPhase)*0.65;});
    ['leg1','leg3'].forEach(n=>{const l=wolf.getObjectByName(n);if(l)l.rotation.x=-Math.sin(player.legPhase)*0.65;});
    const tail=wolf.getObjectByName('tail'); if(tail) tail.rotation.y=Math.sin(player.legPhase*2)*0.4;
  } else {
    const br=Math.sin(Date.now()*0.002)*0.025;
    if(wolf.children[0]) wolf.children[0].scale.y=0.88+br;
  }
  // Wing animation
  const wt=Date.now()*0.004;
  ['wing_r','wing_l'].forEach((name,i)=>{
    const w=wolf.getObjectByName(name); if(!w) return;
    const side=name==='wing_r'?1:-1;
    if(flying){
      // Fast flapping when ascending, slow glide otherwise
      const flapSpeed=keys['Space']?8:3;
      w.rotation.z=side*(0.15+Math.sin(wt*flapSpeed+i*Math.PI)*0.32);
    } else {
      // Gently fold/rest with slight breathing motion
      w.rotation.z=side*(0.08+Math.sin(wt*0.7)*0.06);
    }
  });
  // Camera
  const offset=cameraOffset.clone().applyEuler(new THREE.Euler(mouseY*0.6,player.yaw,0,'YXZ'));
  const camPos=new THREE.Vector3().copy(player.pos).add(offset);
  const camTY=terrainY(camPos.x,camPos.z)+0.4;
  if(camPos.y<camTY) camPos.y=camTY;
  camera.position.lerp(camPos,0.12);
  lookTarget.set(player.pos.x,player.pos.y+0.8,player.pos.z);
  camera.lookAt(lookTarget);
  // HUD
  if(healthFill) healthFill.style.width =player.health +'%';
  if(hungerFill) hungerFill.style.width =player.hunger +'%';
  if(thirstFill) thirstFill.style.width =player.thirst +'%';
  if(staminaFill) staminaFill.style.width=player.stamina+'%';
  document.getElementById('stalk-label').style.display  = player.crouching&&!player.inDen?'block':'none';
  document.getElementById('den-label').style.display    = player.inDen?'block':'none';
  document.getElementById('pounce-label').style.display = player.pounceReady?'block':'none';
  if(player.health<30){ const pulse=Math.sin(Date.now()*0.004)*0.5+0.5; vigEl.style.background=`radial-gradient(ellipse at center,transparent 40%,rgba(120,0,0,${0.3+pulse*0.3}) 100%)`; }
  else { vigEl.style.background=''; vigEl.classList.remove('hurt'); }
}

// ─── Respawn ──────────────────────────────────────────────────────────────────
function respawn(){
  player.health=100;player.hunger=100;player.thirst=100;player.stamina=100;
  player.kills=0;player.day=1;player.dead=false;
  player.pos.set(0,terrainY(0,0)+1.8,0); player.vel.set(0,0,0);
  killsLabel.textContent='Kills: 0';
  packState.bondLevel=0;packState.mated=false;packState.pregnant=false;packState.gestationTimer=0;packState.scoutPup=null;packState.scoutTimer=0;
  playerAlliance=null;
  packState.pups.forEach(p=>scene.remove(p.mesh)); packState.pups.length=0;
  packState.packMates.forEach(pm=>scene.remove(pm.mesh)); packState.packMates.length=0;
  mateMesh.position.set(mateStartX,terrainY(mateStartX,mateStartZ),mateStartZ);
  mate.state='wander'; pupLabel.style.display='none'; updatePackLabel();
  // Reset prey mode
  if(preyMode){
    preyMode=false;
    hunterWolves.forEach(h=>h.deactivate());
    const pb=document.getElementById('prey-btn');
    if(pb){pb.textContent='Become Prey';pb.classList.remove('active');}
    const pl=document.getElementById('prey-mode-label');
    if(pl) pl.style.display='none';
    const mb=document.getElementById('btn-prey');
    if(mb) mb.classList.remove('active');
  }
  deathScreen.classList.remove('show');
}
document.getElementById('respawn-btn').addEventListener('click',respawn);

// ─── Wolf Customizer ─────────────────────────────────────────────────────────
const custEl        = document.getElementById('customizer');
const custCanvasEl  = document.getElementById('cust-canvas');
const nameBadge     = document.getElementById('wolf-name-badge');
const nameInput     = document.getElementById('wolf-name-input');

let custRenderer = null, custScene = null, custCamera = null, custWolf = null, custAnimId = null;

function initCustRenderer(){
  if(custRenderer) return;
  custRenderer = new THREE.WebGLRenderer({ canvas:custCanvasEl, antialias:true, alpha:true });
  custRenderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  custRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  custRenderer.toneMappingExposure = 1.1;
  custRenderer.outputColorSpace = THREE.SRGBColorSpace;
  custRenderer.setClearColor(0x000000,0);
  custScene  = new THREE.Scene();
  custCamera = new THREE.PerspectiveCamera(45,1,0.1,100);
  custCamera.position.set(0,1.2,5.5); custCamera.lookAt(0,0.8,0);
  custScene.add(new THREE.AmbientLight(0x888888,1.0));
  const dl=new THREE.DirectionalLight(0xfff0d0,2.5); dl.position.set(3,5,4); custScene.add(dl);
  const fill=new THREE.DirectionalLight(0x8090c0,0.7); fill.position.set(-3,2,-2); custScene.add(fill);
  const rim=new THREE.DirectionalLight(0xc0a060,0.5); rim.position.set(0,-1,4); custScene.add(rim);
  // Ground plate
  const gp=new THREE.Mesh(new THREE.CircleGeometry(2.5,32),new THREE.MeshStandardMaterial({color:0x2a3820,roughness:0.9}));
  gp.rotation.x=-Math.PI/2; custScene.add(gp);
}

function rebuildCustWolf(){
  if(!custScene) return;
  if(custWolf){ custScene.remove(custWolf); custWolf=null; }
  custWolf = makeWolf(wolfConfig);
  custWolf.scale.setScalar(wolfConfig.scale*1.15);
  custWolf.position.set(0,0,0);
  custScene.add(custWolf);
}

function animateCust(){
  custAnimId = requestAnimationFrame(animateCust);
  if(!custWolf) return;
  custWolf.rotation.y += 0.008;
  const tail=custWolf.getObjectByName('tail');
  if(tail) tail.rotation.y=Math.sin(Date.now()*0.003)*0.5;
  const w=custCanvasEl.clientWidth, h=custCanvasEl.clientHeight;
  if(w&&h){ custRenderer.setSize(w,h,false); custCamera.aspect=w/h; custCamera.updateProjectionMatrix(); }
  custRenderer.render(custScene, custCamera);
}

function openCustomizer(){
  custEl.classList.add('open');
  document.exitPointerLock();
  initCustRenderer();
  rebuildCustWolf();
  if(!custAnimId) animateCust();
}
function closeCustomizer(){
  custEl.classList.remove('open');
  if(custAnimId){ cancelAnimationFrame(custAnimId); custAnimId=null; }
  // Re-lock mouse if the game has started (splash is hidden)
  if(!isMobile && splash.classList.contains('hidden')){
    setTimeout(()=>canvas.requestPointerLock(), 80);
  }
}

document.getElementById('cust-close').addEventListener('click', closeCustomizer);
document.getElementById('customize-btn').addEventListener('click', openCustomizer);
document.getElementById('ingame-cust-btn').addEventListener('click', openCustomizer);

// Build coat grid
const coatGrid = document.getElementById('coat-grid');
COAT_PRESETS.forEach((p,i)=>{
  const sw=document.createElement('div');
  sw.className='coat-swatch'+(i===0?' active':'');
  // Gradient using base+saddle colors
  const bc=new THREE.Color(p.base), sc2=new THREE.Color(p.saddle);
  const bHex='#'+bc.getHexString(), sHex='#'+sc2.getHexString();
  sw.style.background=`linear-gradient(160deg, ${sHex} 0%, ${bHex} 60%, #${new THREE.Color(p.belly).getHexString()} 100%)`;
  sw.innerHTML=`<span>${p.name}</span>`;
  sw.addEventListener('click',()=>{
    document.querySelectorAll('.coat-swatch').forEach(s=>s.classList.remove('active'));
    sw.classList.add('active');
    wolfConfig.preset=i;
    const eyeMatch = EYE_COLORS.findIndex(e=>e.color===COAT_PRESETS[i].eye);
    if(eyeMatch >= 0) wolfConfig.eyeIdx = eyeMatch;
    rebuildCustWolf();
    // Sync eye selection
    document.querySelectorAll('.eye-dot').forEach((d,di)=>d.classList.toggle('active',di===wolfConfig.eyeIdx));
  });
  coatGrid.appendChild(sw);
});

// Eye grid
const eyeGrid = document.getElementById('eye-grid');
EYE_COLORS.forEach((e,i)=>{
  const dot=document.createElement('div');
  dot.className='eye-dot'+(i===0?' active':'');
  dot.style.background='#'+new THREE.Color(e.color).getHexString();
  dot.title=e.label;
  dot.addEventListener('click',()=>{
    document.querySelectorAll('.eye-dot').forEach(d=>d.classList.remove('active'));
    dot.classList.add('active');
    wolfConfig.eyeIdx=i;
    rebuildCustWolf();
  });
  eyeGrid.appendChild(dot);
});

// Size buttons
document.querySelectorAll('.size-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.size-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    wolfConfig.scale=parseFloat(btn.dataset.size);
    rebuildCustWolf();
  });
});

// Name input
nameInput.addEventListener('input',()=>{
  wolfConfig.name = nameInput.value.trim() || 'Wolf';
  nameBadge.textContent = wolfConfig.name;
});

// Confirm
document.getElementById('cust-confirm').addEventListener('click',()=>{
  closeCustomizer();
  // Rebuild player wolf with new config
  scene.remove(wolf);
  wolf = makeWolf(wolfConfig);
  wolf.scale.setScalar(wolfConfig.scale*1.15);
  scene.add(wolf);
});

// ─── Prey Mode Button ─────────────────────────────────────────────────────────
document.getElementById('prey-btn').addEventListener('click', togglePreyMode);

// ─── Catch Prey Button ────────────────────────────────────────────────────────
document.getElementById('catch-prey-btn').addEventListener('click',()=>tryAttack(true));
const catchMobileBtn=document.getElementById('btn-catch');
if(catchMobileBtn){
  catchMobileBtn.addEventListener('touchstart',e=>{e.preventDefault();tryAttack(true);catchMobileBtn.classList.add('pressed');},{passive:false});
  catchMobileBtn.addEventListener('touchend',  e=>{e.preventDefault();catchMobileBtn.classList.remove('pressed');},{passive:false});
}

// ─── Fly Button ───────────────────────────────────────────────────────────────
document.getElementById('fly-btn').addEventListener('click', toggleFly);
const flyMobileBtn=document.getElementById('btn-fly');
if(flyMobileBtn) flyMobileBtn.addEventListener('touchstart',e=>{e.preventDefault();toggleFly();},{passive:false});

// ─── Splash (pointer lock wired here so it fires after game is ready) ─────────
const splash = document.getElementById('splash');
document.getElementById('start-btn').addEventListener('click',()=>{
  splash.classList.add('hidden');
  try { if(!isMobile) canvas.requestPointerLock(); } catch(e){}
  setTimeout(()=>{ splash.style.display='none'; }, 1100);
});

// ─── Main Loop ────────────────────────────────────────────────────────────────
let lastTime=0, dayTick=0;

function loop(now){
  requestAnimationFrame(loop);
  const dt=Math.min((now-lastTime)/1000,0.05);
  lastTime=now;

  // T key — open/close in-game customizer from anywhere
  if(keys['KeyT']&&!keys._tWas){ keys._tWas=true;
    if(custEl.classList.contains('open')) closeCustomizer(); else openCustomizer();
  }
  if(!keys['KeyT']) keys._tWas=false;

  if(!player.dead && !custEl.classList.contains('open')){
    updatePlayer(dt);
    animals.forEach(a=>a.update(dt,player.pos));
    hunterWolves.forEach(h=>h.update(dt,player.pos));
    updateMate(dt);
    updatePups(dt);
    updatePackMates(dt);
    updateHearts(dt);
    tickGestation(dt);
    // Rival pack wander / allied follow
    rivalPacks.forEach((rp,ri)=>{
      const allied=playerAlliance===rp;
      rp.wolves.forEach((w,wi)=>{
        if(allied){
          // Follow player in formation
          const ox=((wi%3)-1)*3.5, oz=2.5+Math.floor(wi/3)*2.5;
          const tx=player.pos.x+Math.sin(player.yaw)*-oz+Math.cos(player.yaw)*ox;
          const tz=player.pos.z+Math.cos(player.yaw)*-oz-Math.sin(player.yaw)*ox;
          const dx=tx-w.mesh.position.x, dz=tz-w.mesh.position.z;
          const dist=Math.sqrt(dx*dx+dz*dz);
          if(dist>1.2){
            const spd=WOLF_SPEED*1.05;
            w.mesh.position.x+=dx/dist*spd*dt; w.mesh.position.z+=dz/dist*spd*dt;
            w.mesh.position.y=terrainY(w.mesh.position.x,w.mesh.position.z)+0.05;
            w.mesh.rotation.y=Math.atan2(dx,dz);
            w.legPhase=(w.legPhase||0)+spd*dt*3.5;
            ['leg0','leg2'].forEach(n=>{const l=w.mesh.getObjectByName(n);if(l)l.rotation.x=Math.sin(w.legPhase)*0.65;});
            ['leg1','leg3'].forEach(n=>{const l=w.mesh.getObjectByName(n);if(l)l.rotation.x=-Math.sin(w.legPhase)*0.65;});
          }
          const tail=w.mesh.getObjectByName('tail');
          if(tail) tail.rotation.y=Math.sin(Date.now()*0.005+wi)*0.6;
        } else {
          // Normal wander
          w.wanderAngle+=(Math.random()-0.5)*dt*0.6;
          const spd=0.9;
          const nx=w.mesh.position.x+Math.sin(w.wanderAngle)*spd*dt;
          const nz=w.mesh.position.z+Math.cos(w.wanderAngle)*spd*dt;
          const hdx=w.homeX-nx, hdz=w.homeZ-nz;
          if(Math.sqrt(hdx*hdx+hdz*hdz)>9){ w.wanderAngle=Math.atan2(hdx,hdz); }
          w.mesh.position.x=nx; w.mesh.position.z=nz;
          w.mesh.position.y=terrainY(nx,nz)+0.05;
          w.mesh.rotation.y=w.wanderAngle;
          w.legPhase=(w.legPhase||0)+spd*dt*3.5;
          ['leg0','leg2'].forEach(n=>{const l=w.mesh.getObjectByName(n);if(l)l.rotation.x=Math.sin(w.legPhase)*0.5;});
          ['leg1','leg3'].forEach(n=>{const l=w.mesh.getObjectByName(n);if(l)l.rotation.x=-Math.sin(w.legPhase)*0.5;});
        }
      });
    });
    updateDen(dt);
    updateSky(dt);
    // Berry regen
    berryBushes.forEach(b=>{ if(b.depleted){ b.regenTimer-=dt; if(b.regenTimer<=0){ b.depleted=false; b.mesh.children.forEach(c=>c.visible=true); } } });
    // Fish drift
    fishList.forEach(f=>{ if(f.caught) return; f.angle+=dt*0.4; f.mesh.position.x=f.cx+Math.cos(f.angle)*1.5; f.mesh.position.z=f.cz+Math.sin(f.angle)*1.5; f.mesh.rotation.y=f.angle+Math.PI/2; });
    // Exhausted animal prompt
    if(notifTimer<=0){
      for(const a of animals){
        if(a.dead) continue;
        if(a.exhausted && a.mesh.position.distanceTo(player.pos)<8){
          notifEl.textContent='⚡ Exhausted prey — press E to finish the hunt';
          notifEl.classList.add('show'); break;
        }
        const nearFleeing = !a.dead && a.state==='flee' && a.mesh.position.distanceTo(player.pos)<18;
        if(nearFleeing && a.stamina<40){ notifEl.textContent='Chase it! The prey is tiring…'; notifEl.classList.add('show'); break; }
      }
    }
    dayTick+=dt;
    if(dayTick>DAY_LENGTH){ dayTick=0; player.day++; }
    if(notifTimer>0){ notifTimer-=dt; if(notifTimer<=0) notifEl.classList.remove('show'); }
    // Animate water
    const t=now*0.001;
    const wpos=waterGeo.attributes.position;
    for(let i=0;i<wpos.count;i++){
      const x=wpos.getX(i), z=wpos.getZ(i);
      wpos.setY(i, waterBaseY[i]+Math.sin(x*0.08+t)*0.12+Math.cos(z*0.1+t*0.7)*0.08);
    }
    wpos.needsUpdate=true; waterGeo.computeVertexNormals();
    // Drift clouds
    clouds.forEach(c=>{
      c.userData.ang+=c.userData.speed*dt*0.002;
      c.position.x=Math.cos(c.userData.ang)*c.userData.rad;
      c.position.z=Math.sin(c.userData.ang)*c.userData.rad;
      c.lookAt(new THREE.Vector3(c.position.x,c.position.y-50,c.position.z));
    });
    drawMinimap();
  }

  renderer.render(scene, camera);
}

requestAnimationFrame(t=>{ lastTime=t; loop(t); });
setTimeout(()=>showNotif('Click to lock mouse · Hunt · Survive · Find your mate'),2000);
