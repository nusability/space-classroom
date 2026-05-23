// Space Classroom — Sun, Earth, Moon, planets.
// Educational 3D model — sizes & distances are NOT to scale.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';

import { I18N, lang as _lang, t, setLang } from './i18n.js';
import { canvasTexture, makeGlowTexture, makeSunTexture,
         loadEarthTexture, loadEarthCloudsTexture, loadMoonTexture } from './textures.js';
import { PLANETS, MOONS, buildPlanet } from './bodies.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const TILT = 23.5 * DEG;
const MOON_INCLINATION = 5.14 * DEG;          // Moon orbit's tilt to the ecliptic — real

const SUN_R = 9, EARTH_R = 1.7, MOON_R = 0.7;
const EARTH_ORBIT = 78, MOON_ORBIT = 7.0;
// Real lunar distance from Earth, in Earth-radii: 60.336 → in our anchored units:
const MOON_REAL_ORBIT = EARTH_R * 60.336;     // ≈ 102.6
const YEAR = 365.25, MONTH_SIDEREAL = 27.32, JUNE_SOLSTICE = 172;

// Mutable language (re-exported so we can rebind on language switch)
let lang = _lang;

/* ---------- renderer / scene / camera ---------- */
const container = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);

const camera = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, 0.05, 9000);
camera.position.set(11, 6, 14);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.enablePan = false;
controls.minDistance = 2.6;
controls.maxDistance = 900;
controls.rotateSpeed = 0.85;
controls.zoomSpeed = 0.9;

/* lights — point light AT the Sun keeps day/night, seasons & phases correct. */
scene.add(new THREE.PointLight(0xfff3da, 3.4, 0, 0));
scene.add(new THREE.AmbientLight(0x3d4d70, 0.32));

/* ---------- starfield ---------- */
{
  const N=3600,pos=new Float32Array(N*3),col=new Float32Array(N*3);
  const tints=[[1,1,1],[0.8,0.86,1],[1,0.92,0.78],[1,0.83,0.7]];
  for(let i=0;i<N;i++){
    const u=Math.random()*2-1,th=Math.random()*TAU,r=1900,s=Math.sqrt(1-u*u);
    pos[i*3]=Math.cos(th)*s*r; pos[i*3+1]=u*r; pos[i*3+2]=Math.sin(th)*s*r;
    const c=tints[Math.random()*tints.length|0],b=0.5+Math.random()*0.5;
    col[i*3]=c[0]*b; col[i*3+1]=c[1]*b; col[i*3+2]=c[2]*b;
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  g.setAttribute('color',new THREE.BufferAttribute(col,3));
  scene.add(new THREE.Points(g,new THREE.PointsMaterial({
    size:1.8,
    map:makeGlowTexture([[0,'rgba(255,255,255,1)'],[0.5,'rgba(255,255,255,.55)'],[1,'rgba(255,255,255,0)']]),
    vertexColors:true, transparent:true, depthWrite:false,
    sizeAttenuation:false, blending:THREE.AdditiveBlending })));
}

/* ---------- Sun ---------- */
const sun = new THREE.Mesh(new THREE.SphereGeometry(SUN_R,48,32),
  new THREE.MeshBasicMaterial({ map:makeSunTexture() }));
scene.add(sun);

// Tight, sharp glow — small extent and steep falloff avoids low-alpha dithering.
const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map:makeGlowTexture([
    [0,'rgba(255,238,180,1)'],
    [0.15,'rgba(255,210,120,0.55)'],
    [0.38,'rgba(255,170,60,0.10)'],
    [1,'rgba(255,170,60,0)']]),
  blending:THREE.AdditiveBlending, depthWrite:false, transparent:true }));
sunGlow.scale.setScalar(SUN_R*3.2);
sun.add(sunGlow);

/* ---------- Earth system ---------- */
const earthPivot = new THREE.Object3D();        // translates only — axis stays fixed in space
scene.add(earthPivot);

const earthTilt = new THREE.Object3D();         // fixed 23.5° tilt (does not rotate)
earthTilt.rotation.z = TILT;
earthPivot.add(earthTilt);

const earth = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_R,96,64),
  new THREE.MeshStandardMaterial({ map:loadEarthTexture(), roughness:0.86, metalness:0 })
);
earthTilt.add(earth);

// Subtle real-image cloud layer
const clouds = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_R*1.015, 64, 40),
  new THREE.MeshStandardMaterial({
    map:loadEarthCloudsTexture(), transparent:true, depthWrite:false,
    opacity:0.7, roughness:1, metalness:0 })
);
earthTilt.add(clouds);

// Atmosphere — fresnel rim glow, brighter on the day side.
// `discard` for very low contributions to avoid additive-blend dithering.
const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_R*1.075, 64, 40),
  new THREE.ShaderMaterial({
    uniforms:{ sunDir:{value:new THREE.Vector3(1,0,0)} },
    transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.FrontSide,
    vertexShader:`
      varying vec3 vN; varying vec3 vView;
      void main(){
        vN=normalize(mat3(modelMatrix)*normal);
        vec4 wp=modelMatrix*vec4(position,1.0);
        vView=normalize(cameraPosition-wp.xyz);
        gl_Position=projectionMatrix*viewMatrix*wp;
      }`,
    fragmentShader:`
      varying vec3 vN; varying vec3 vView; uniform vec3 sunDir;
      void main(){
        float rim=pow(1.0-max(dot(vN,vView),0.0),3.0);
        float day=max(dot(vN,sunDir),0.0);
        float g=rim*(0.3+1.05*day);
        if(g<0.05) discard;
        gl_FragColor=vec4(vec3(0.36,0.62,1.0)*g,g);
      }`
  }));
earthTilt.add(atmosphere);

// Earth's tilted spin axis with N / S caps
const axisGroup=new THREE.Group();
axisGroup.add(new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0,-EARTH_R*2.05,0),new THREE.Vector3(0,EARTH_R*2.05,0)]),
  new THREE.LineBasicMaterial({ color:0xff6b6b })));
const nCap=new THREE.Mesh(new THREE.ConeGeometry(EARTH_R*0.16,EARTH_R*0.38,16),
  new THREE.MeshBasicMaterial({color:0xff6b6b}));
nCap.position.y=EARTH_R*2.05; axisGroup.add(nCap);
const sCap=nCap.clone(); sCap.position.y=-EARTH_R*2.05; sCap.rotation.x=Math.PI; axisGroup.add(sCap);
earthTilt.add(axisGroup);

// Vertical "straight up" reference dashed line (orbital normal)
const vertRef=new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0,-EARTH_R*2.2,0),new THREE.Vector3(0,EARTH_R*2.2,0)]),
  new THREE.LineDashedMaterial({ color:0x55607a, dashSize:0.25, gapSize:0.2 }));
vertRef.computeLineDistances();
earthPivot.add(vertRef);

// Globe lines — equator, tropics, polar circles
const globeLines=new THREE.Group();
function latCircle(lat,color,opacity){
  const r=EARTH_R*1.003*Math.cos(lat*DEG), y=EARTH_R*1.003*Math.sin(lat*DEG), pts=[];
  for(let i=0;i<=96;i++){const a=i/96*TAU;pts.push(new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r));}
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({color,transparent:true,opacity}));
}
globeLines.add(latCircle(0,0xffe27a,0.9));
globeLines.add(latCircle(23.5,0xffffff,0.4));
globeLines.add(latCircle(-23.5,0xffffff,0.4));
globeLines.add(latCircle(66.5,0x8fb8ff,0.4));
globeLines.add(latCircle(-66.5,0x8fb8ff,0.4));
earthTilt.add(globeLines);

/* ---------- Moon — orbit tilted 5.14° from the ecliptic ---------- */
const moonOrbitPlane = new THREE.Group();
moonOrbitPlane.rotation.z = MOON_INCLINATION;
earthPivot.add(moonOrbitPlane);

const moonGroup = new THREE.Group();
moonOrbitPlane.add(moonGroup);
const moon = new THREE.Mesh(
  new THREE.SphereGeometry(MOON_R, 64, 40),
  new THREE.MeshStandardMaterial({ map:loadMoonTexture(), roughness:1, metalness:0 })
);
moon.position.x = MOON_ORBIT;
moonGroup.add(moon);

/* ---------- Other planets — each on its own (lightly) tilted orbital plane ---------- */
const planetsContainer = new THREE.Group();
planetsContainer.visible = false;       // toggled by t-planets
scene.add(planetsContainer);

const planetBodies = [];                // { key, tilt, group, mesh, ring, ... }
for(const p of PLANETS){
  const built = buildPlanet(p);
  const tilt = new THREE.Group();
  tilt.rotation.x = p.incl;             // real inclination to the ecliptic
  tilt.add(built.group);
  planetsContainer.add(tilt);
  planetBodies.push({
    key:p.key, tilt, group:built.group, mesh:built.mesh,
    eduR:p.eduR, realR:p.realR,
    eduOrbit:p.eduOrbit, realOrbit:p.realOrbit, currentOrbit:p.eduOrbit,
    period:p.period, phase:Math.random()*TAU
  });
}

/* ---------- Planet moons (Galilean + Titan + Triton) ---------- */
const planetMoons = [];
for(const m of MOONS){
  const pb = planetBodies.find(x => x.key === m.planet);
  if(!pb) continue;
  const pivot = new THREE.Group();      // rotates around Y → moon orbits planet
  pb.group.add(pivot);
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(m.eduR, 24, 16),
    new THREE.MeshStandardMaterial({ color:m.color, roughness:1, metalness:0 })
  );
  mesh.position.x = m.eduOrbit;
  pivot.add(mesh);
  planetMoons.push({
    key:m.key, planet:m.planet, pivot, mesh,
    eduR:m.eduR, realR:m.realR,
    eduOrbit:m.eduOrbit, realOrbit:m.realOrbit,
    period:m.period, phase:Math.random()*TAU
  });
}

/* ---------- Thick orbit lines (Line2) ---------- */
const lineMaterials = [];
function makeOrbitRing(radius, color, opacity, width){
  const N=240, pts=new Float32Array((N+1)*3);
  for(let i=0;i<=N;i++){
    const a=i/N*TAU;
    pts[i*3]   = Math.cos(a)*radius;
    pts[i*3+1] = 0;
    pts[i*3+2] = Math.sin(a)*radius;
  }
  const geom=new LineGeometry(); geom.setPositions(pts);
  const mat=new LineMaterial({
    color, linewidth:width, transparent:true, opacity,
    worldUnits:false,
    resolution:new THREE.Vector2(innerWidth, innerHeight)
  });
  lineMaterials.push(mat);
  const line=new Line2(geom,mat); line.computeLineDistances();
  return line;
}

// Earth orbit ring
const orbitPaths = new THREE.Group();
orbitPaths.add(makeOrbitRing(EARTH_ORBIT, 0x6f96d6, 0.75, 2.0));
scene.add(orbitPaths);

// Moon orbit ring lives on the tilted plane (its visibility is toggled separately
// in the toggleMap below alongside orbitPaths).
const moonOrbitRing = makeOrbitRing(MOON_ORBIT, 0x9aa3b8, 0.85, 1.8);
moonOrbitPlane.add(moonOrbitRing);

// Planet orbit rings — one per planet, sitting inside the planet's tilted plane
// so they reveal the inclination too.
for(const pb of planetBodies){
  const ring = makeOrbitRing(pb.eduOrbit, 0x6c7a96, 0.55, 1.6);
  pb.tilt.add(ring);
  pb.ring = ring;
}

/* ---------- Season markers ---------- */
const seasonMarkers=new THREE.Group();
scene.add(seasonMarkers);
const markerSpec = [
  { ang:0,   key:'mkJune', color:'#ffd98a' },
  { ang:90,  key:'mkSep',  color:'#ffffff' },
  { ang:180, key:'mkDec',  color:'#9fd0ff' },
  { ang:270, key:'mkMar',  color:'#ffffff' }
];
const markerLabelEntries = [];      // { sprite, key }
for(const m of markerSpec){
  const px=Math.cos(m.ang*DEG)*EARTH_ORBIT, pz=Math.sin(m.ang*DEG)*EARTH_ORBIT;
  const dot=new THREE.Mesh(new THREE.SphereGeometry(0.95,16,12),
    new THREE.MeshBasicMaterial({color:m.color}));
  dot.position.set(px,0,pz);
  seasonMarkers.add(dot);
  // marker label is added later, after makeLabel is defined
  markerLabelEntries.push({ pos:{x:px,y:5.5,z:pz}, key:m.key, color:m.color });
}

/* ---------- Sunlight rays helper ---------- */
const sunRays=new THREE.Group();
const rayArrows=[];
for(let i=0;i<3;i++){
  const a=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(),1,0xffe27a,0.6,0.36);
  rayArrows.push(a); sunRays.add(a);
}
scene.add(sunRays);

/* ============================================================
   Labels — sprites that keep a constant SCREEN size
   ============================================================ */
const screenLabels = [];

function labelCanvas(text,color){
  const pad=22, font=46, f=`700 ${font}px -apple-system,Segoe UI,Roboto,sans-serif`;
  const c=document.createElement('canvas'); const x=c.getContext('2d');
  x.font=f; const w=Math.ceil(x.measureText(text).width);
  c.width=w+pad*2; c.height=font+pad*2;
  x.font=f;
  x.fillStyle='rgba(8,11,20,0.78)';
  x.beginPath(); x.roundRect(0,0,c.width,c.height,18); x.fill();
  x.strokeStyle='rgba(255,255,255,.18)'; x.lineWidth=2;
  x.beginPath(); x.roundRect(1,1,c.width-2,c.height-2,17); x.stroke();
  x.fillStyle=color; x.textBaseline='middle'; x.textAlign='center';
  x.fillText(text, c.width/2, c.height/2+2);
  return c;
}
function makeLabel(text, color, pixelHeight=28){
  const c=labelCanvas(text,color);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({
    map:canvasTexture(c), depthTest:false, depthWrite:false, transparent:true }));
  sp.renderOrder=999;
  sp.userData = { color, px:pixelHeight, aspect:c.width/c.height };
  screenLabels.push(sp);
  return sp;
}
function setLabel(sp,text){
  const c=labelCanvas(text, sp.userData.color);
  sp.material.map.dispose();
  sp.material.map = canvasTexture(c);
  sp.material.needsUpdate = true;
  sp.userData.aspect = c.width/c.height;
}

// scale all visible labels to a constant pixel height each frame
const tmpVec = new THREE.Vector3();
function tickLabelSizes(){
  const screenH = renderer.domElement.clientHeight || innerHeight;
  const k0 = 2 * Math.tan(camera.fov * Math.PI/360) / screenH;
  for(const lbl of screenLabels){
    if(!lbl.visible) continue;
    lbl.getWorldPosition(tmpVec);
    const dist = tmpVec.distanceTo(camera.position);
    const k = dist * k0;
    lbl.scale.set(lbl.userData.aspect * lbl.userData.px * k, lbl.userData.px * k, 1);
  }
}

/* --- create labels now that makeLabel is defined --- */
const earthLabel = makeLabel(t('earth'), '#9fd0ff', 26);
earthLabel.position.set(0, EARTH_R*1.55, 0);
earthPivot.add(earthLabel);

const nLabel = makeLabel('N', '#ff9b9b', 16);
nLabel.position.set(0, EARTH_R*2.7, 0);
axisGroup.add(nLabel);

const moonLabel = makeLabel(t('moon'), '#d7dce6', 20);
moonLabel.position.set(MOON_ORBIT, MOON_R*1.7, 0);
moonGroup.add(moonLabel);

const sunLabel = makeLabel(t('sun'), '#ffd98a', 32);
sunLabel.position.set(0, SUN_R*1.4, 0);
sun.add(sunLabel);

const seasonLabels = [];     // for re-translation
for(const e of markerLabelEntries){
  const sp = makeLabel(t(e.key), e.color, 22);
  sp.position.set(e.pos.x, e.pos.y, e.pos.z);
  seasonMarkers.add(sp);
  seasonLabels.push({ sprite:sp, key:e.key });
}

const planetLabels = [];     // for re-translation
for(const pb of planetBodies){
  const sp = makeLabel(t('pl_'+pb.key), '#cdd6ea', 18);
  sp.userData.followKey = pb.key;
  pb.group.add(sp);
  // label position will be updated per frame based on planet radius * scale factor;
  // for now place at (0, radius*1.5, 0) inside the planet group
  const r = PLANETS.find(p=>p.key===pb.key).radius;
  sp.position.set(0, r*1.7, 0);
  planetLabels.push({ sprite:sp, key:pb.key });
}

/* ============================================================
   State & camera helpers
   ============================================================ */
const state = { simDays:0, playing:true, daysPerSecond:1,
                focus:'earth', tipKey:null, backDist:EARTH_R*3.6,
                realTarget:0, realProgress:0, realScale:0 };
const NORTH_AXIS = new THREE.Vector3(-Math.sin(TILT), Math.cos(TILT), 0);
const WORLD_UP = new THREE.Vector3(0,1,0);
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();

function focusObject(){
  return (state.focus==='moon'||state.focus==='fromEarth') ? moon
       : state.focus==='sun' ? sun : earth;
}
function focusRadius(){
  return (state.focus==='moon'||state.focus==='fromEarth') ? MOON_R
       : state.focus==='sun' ? SUN_R : EARTH_R;
}
function getFocusWorldPos(out){ return focusObject().getWorldPosition(out); }

function placeCamera(dist,dir){
  getFocusWorldPos(tmpA);
  const d = dir ? dir.clone().normalize()
                : tmpB.copy(camera.position).sub(controls.target).normalize();
  controls.target.copy(tmpA);
  camera.position.copy(tmpA).addScaledVector(d, dist);
  controls.update();
}
function viewDir(toSun, up, side){
  earth.getWorldPosition(tmpA);
  const s = tmpA.clone().multiplyScalar(-1).normalize();
  const sd = new THREE.Vector3().crossVectors(s, WORLD_UP);
  if(sd.lengthSq()<1e-4) sd.set(1,0,0);
  sd.normalize();
  return s.multiplyScalar(toSun).addScaledVector(sd, side).add(new THREE.Vector3(0, up, 0));
}

let trans = null;       // active camera transition
function setFocus(name, dist, dir){
  state.focus = name;
  document.querySelectorAll('#focusSeg button').forEach(b =>
    b.classList.toggle('on', b.dataset.focus===name));
  const fb=document.getElementById('fromEarthBtn');
  if(fb) fb.classList.toggle('on', name==='fromEarth');
  const fs=document.getElementById('fromSunBtn');
  if(fs) fs.classList.toggle('on', name==='fromSun');

  controls.enabled = false;
  const base = { u:0, dur:0.85,
                 fromCam:camera.position.clone(), fromTgt:controls.target.clone() };
  if(name==='fromEarth' || name==='fromSun'){
    state.backDist = name==='fromEarth' ? EARTH_R*3.6 : 22;
    trans = { ...base, toLocked:name };
    return;
  }
  controls.minDistance = name==='moon'?0.9 : name==='sun'?SUN_R*1.35 : 2.6;
  const dd = dist || (name==='earth'?14 : name==='moon'?5.0 : SUN_R*4.6);
  let d = dir ? dir.clone() : camera.position.clone().sub(controls.target);
  if(d.lengthSq()<1e-6) d.set(1, name==='sun'?0.5:0.45, 1);
  d.normalize();
  trans = { ...base, toLocked:null, dir:d, dist:dd };
}

// Pose computations for the locked modes
function fromEarthCamPose(outPos, outTgt){
  earth.getWorldPosition(tmpC);
  moon.getWorldPosition(outTgt);
  const dx=outTgt.x-tmpC.x, dz=outTgt.z-tmpC.z;       // dirEM on the ecliptic
  const dl=Math.hypot(dx,dz)||1;
  outPos.set(tmpC.x - dx/dl*state.backDist,
             tmpC.y + state.backDist*0.9,
             tmpC.z - dz/dl*state.backDist);
}
function fromSunCamPose(outPos, outTgt){
  earth.getWorldPosition(outTgt);
  const dl=Math.hypot(outTgt.x,outTgt.z)||1;
  outPos.set(-outTgt.x/dl*state.backDist,
             state.backDist*0.9,
             -outTgt.z/dl*state.backDist);
}
function updateFromEarthCamera(){
  fromEarthCamPose(tmpA, tmpB);
  camera.position.copy(tmpA); camera.up.set(0,1,0);
  camera.lookAt(tmpB); controls.target.copy(tmpB);
}
function updateFromSunCamera(){
  fromSunCamPose(tmpA, tmpB);
  camera.position.copy(tmpA); camera.up.set(0,1,0);
  camera.lookAt(tmpB); controls.target.copy(tmpB);
}

/* ============================================================
   Simulation update
   ============================================================ */
function updateBodies(){
  const d=state.simDays;
  const thetaE=((d-JUNE_SOLSTICE)/YEAR)*TAU;
  earthPivot.position.set(Math.cos(thetaE)*EARTH_ORBIT, 0, Math.sin(thetaE)*EARTH_ORBIT);
  earth.rotation.y = d*TAU;
  clouds.rotation.y = d*TAU*0.92;
  moonGroup.rotation.y = (d/MONTH_SIDEREAL)*TAU;
  sun.rotation.y = d*0.06;

  // planets — position inside each planet's tilted plane
  if(planetsContainer.visible){
    for(const pb of planetBodies){
      const o = pb.currentOrbit;
      const theta = (d / (pb.period*YEAR))*TAU + pb.phase;
      pb.group.position.set(Math.cos(theta)*o, 0, Math.sin(theta)*o);
      pb.mesh.rotation.y = d*TAU/3;
    }
    for(const m of planetMoons){
      m.pivot.rotation.y = (d / m.period)*TAU + m.phase;
    }
  }

  // atmosphere sunDir
  earthPivot.getWorldPosition(tmpA);
  atmosphere.material.uniforms.sunDir.value.copy(tmpA).multiplyScalar(-1).normalize();
}

// Animate the "Real scale" morph and apply the lerped sizes/orbits.
function tickRealScale(dt){
  const tgt = state.realTarget;
  if(state.realProgress !== tgt){
    const step = dt / 1.8;
    state.realProgress = tgt > state.realProgress
      ? Math.min(tgt, state.realProgress + step)
      : Math.max(tgt, state.realProgress - step);
  }
  const u = state.realProgress;
  state.realScale = u<0.5 ? 2*u*u : 1-Math.pow(-2*u+2, 2)/2;
  const s = state.realScale;

  for(const pb of planetBodies){
    const r = THREE.MathUtils.lerp(pb.eduR, pb.realR, s);
    pb.mesh.scale.setScalar(r / pb.eduR);
    pb.currentOrbit = THREE.MathUtils.lerp(pb.eduOrbit, pb.realOrbit, s);
    pb.ring.scale.setScalar(pb.currentOrbit / pb.eduOrbit);
  }
  for(const m of planetMoons){
    const r = THREE.MathUtils.lerp(m.eduR, m.realR, s);
    m.mesh.scale.setScalar(r / m.eduR);
    m.mesh.position.x = THREE.MathUtils.lerp(m.eduOrbit, m.realOrbit, s);
  }
  const mo = THREE.MathUtils.lerp(MOON_ORBIT, MOON_REAL_ORBIT, s);
  moon.position.x = mo;
  if(moonLabel) moonLabel.position.x = mo;
  moonOrbitRing.scale.setScalar(mo / MOON_ORBIT);
  controls.maxDistance = THREE.MathUtils.lerp(900, 5000, s);
}

function updateRays(){
  if(!sunRays.visible) return;
  getFocusWorldPos(tmpA);
  tmpB.copy(tmpA).normalize();
  const up=Math.abs(tmpB.y)>0.95?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);
  tmpC.copy(tmpB).cross(up).normalize();
  const R=focusRadius(), len=R*3.4, spread=R*1.35;
  rayArrows.forEach((arr,i)=>{
    arr.position.copy(tmpA).addScaledVector(tmpB,-(R+len)).addScaledVector(tmpC,(i-1)*spread);
    arr.setDirection(tmpB);
    arr.setLength(len, R*0.85, R*0.5);
  });
}

/* ============================================================
   Astronomy read-outs
   ============================================================ */
function solarDeclination(){
  earthPivot.getWorldPosition(tmpA);
  tmpA.multiplyScalar(-1).normalize();
  return Math.asin(THREE.MathUtils.clamp(NORTH_AXIS.dot(tmpA), -1, 1));
}
function seasonKey(declDeg, increasing, south){
  let n;
  if(declDeg>=0) n = increasing ? 'sSpring' : 'sSummer';
  else           n = increasing ? 'sWinter' : 'sAutumn';
  if(south) n = ({sSpring:'sAutumn',sSummer:'sWinter',sAutumn:'sSpring',sWinter:'sSummer'})[n];
  return n;
}
function moonInfo(){
  earthPivot.getWorldPosition(tmpA);
  moon.getWorldPosition(tmpB);
  const es = tmpA.clone().multiplyScalar(-1).normalize();
  const em = tmpB.sub(tmpA).normalize();
  const elong = Math.acos(THREE.MathUtils.clamp(es.dot(em), -1, 1));
  const illum = (1-Math.cos(elong))/2;
  const waxing = (es.z*em.x - es.x*em.z) > 0;
  const e = elong / DEG;
  let key;
  if(e<22.5) key='pNew';
  else if(e<67.5) key = waxing?'pWaxC':'pWanC';
  else if(e<112.5) key = waxing?'pFirst':'pLast';
  else if(e<157.5) key = waxing?'pWaxG':'pWanG';
  else key='pFull';
  return { key, illum, waxing };
}

/* moon-phase icon */
const phaseCanvas = document.getElementById('phaseIcon');
const phaseCtx = phaseCanvas.getContext('2d');
function drawPhase(illum, waxing){
  const S=phaseCanvas.width, cx=S/2, cy=S/2, r=S/2-6, ctx=phaseCtx;
  ctx.clearRect(0,0,S,S);
  ctx.fillStyle='#1b2031';
  ctx.beginPath(); ctx.arc(cx,cy,r,0,TAU); ctx.fill();
  ctx.fillStyle='#eef1f8';
  for(let y=-r; y<=r; y++){
    const w=Math.sqrt(Math.max(0, r*r - y*y));
    const xt=(1-2*illum)*w;
    if(waxing) ctx.fillRect(cx+xt, cy+y, w-xt, 1);
    else       ctx.fillRect(cx-w,   cy+y, w-xt, 1);
  }
  ctx.strokeStyle='rgba(255,255,255,.18)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,TAU); ctx.stroke();
}

const el = id => document.getElementById(id);
let infoTimer=0;
function updateInfo(){
  const d=state.simDays;
  const year = Math.floor(d/YEAR)+1;
  const doy = ((d%YEAR)+YEAR)%YEAR;
  const CUM=[0,31,59,90,120,151,181,212,243,273,304,334];
  let m=11; for(let i=0;i<12;i++) if(doy>=CUM[i]) m=i;
  const dim = Math.floor(doy-CUM[m])+1;
  const month = (I18N[lang].months||I18N.en.months)[m];
  el('i-date').textContent = lang==='de'
    ? `${dim}. ${month}, ${t('yr')} ${year}`
    : `${month} ${dim}, ${t('yr')} ${year}`;

  const declDeg = solarDeclination()/DEG;
  const thetaE = ((d-JUNE_SOLSTICE)/YEAR)*TAU;
  const increasing = Math.sin(thetaE) < 0;
  el('i-north').textContent = t(seasonKey(declDeg, increasing, false));
  el('i-south').textContent = t(seasonKey(declDeg, increasing, true));
  const a = Math.abs(declDeg);
  el('i-decl').textContent = a<0.6 ? t('equator')
    : `${a.toFixed(0)}° ${declDeg>=0?t('north'):t('south')}`;

  const mi = moonInfo();
  el('i-phase').textContent = t(mi.key);
  el('i-illum').textContent = t('litUp').replace('{n}', Math.round(mi.illum*100));
  drawPhase(mi.illum, mi.waxing);
}

/* ============================================================
   UI wiring
   ============================================================ */
const SP_MIN=0.02, SP_MAX=60;
const sliderToDps = v => SP_MIN * Math.pow(SP_MAX/SP_MIN, v/1000);
const dpsToSlider = d => 1000 * Math.log(d/SP_MIN) / Math.log(SP_MAX/SP_MIN);
function setSpeed(dps){
  state.daysPerSecond = THREE.MathUtils.clamp(dps, SP_MIN, SP_MAX);
  el('speed').value = dpsToSlider(state.daysPerSecond);
  const v = state.daysPerSecond;
  el('speedVal').textContent = v>=1
    ? t('speedFast').replace('{n}', v<10?v.toFixed(1):Math.round(v))
    : t('speedSlow').replace('{n}', (1/v).toFixed(1));
}
el('speed').addEventListener('input', e => setSpeed(sliderToDps(+e.target.value)));
document.querySelectorAll('.presets button').forEach(b =>
  b.addEventListener('click', () => setSpeed(+b.dataset.dps)));

function setPlaying(p){
  state.playing = p;
  el('playIcon').textContent = p?'⏸':'▶';
  el('playText').textContent = p?t('btnPause'):t('btnPlay');
}
el('playBtn').addEventListener('click', () => setPlaying(!state.playing));

document.querySelectorAll('#focusSeg button').forEach(b =>
  b.addEventListener('click', () => setFocus(b.dataset.focus)));

const toggleMap = {
  't-orbits':[orbitPaths, moonOrbitRing],
  't-markers':[seasonMarkers],
  't-axis':[axisGroup, vertRef],
  't-globe':[globeLines],
  't-rays':[sunRays],
  't-labels':[sunLabel, moonLabel],
  't-planets':[planetsContainer]
};
function applyToggle(id){
  const on = el(id).checked;
  toggleMap[id].forEach(o => o.visible = on);
}
Object.keys(toggleMap).forEach(id => {
  el(id).addEventListener('change', () => applyToggle(id));
  applyToggle(id);
});
function setToggle(id, on){ el(id).checked = on; applyToggle(id); }

el('resetBtn').addEventListener('click', () => {
  state.simDays = 0; setSpeed(1); setPlaying(true);
  ['t-orbits','t-markers','t-axis','t-labels'].forEach(i => setToggle(i, true));
  ['t-globe','t-rays','t-planets'].forEach(i => setToggle(i, false));
  el('t-realscale').checked = false; state.realTarget = 0;
  setFocus('earth', 13, viewDir(0.85, 0.42, 0.55));
  hideTip();
});

el('t-realscale').addEventListener('change', e => {
  state.realTarget = e.target.checked ? 1 : 0;
  if(e.target.checked) showTip('tipRealScale');
  else if(state.tipKey === 'tipRealScale') hideTip();
});

document.querySelectorAll('.phead').forEach(h =>
  h.addEventListener('click', () => h.parentElement.classList.toggle('collapsed')));

function showTip(key){ state.tipKey=key; el('tipText').textContent=t(key); el('tip').classList.remove('hidden'); }
function hideTip(){ state.tipKey=null; el('tip').classList.add('hidden'); }
el('tipClose').addEventListener('click', hideTip);

function lesson(name){
  if(name==='day'){
    setSpeed(0.25); setPlaying(true);
    setToggle('t-orbits', false); setToggle('t-markers', false); setToggle('t-axis', true);
    setToggle('t-globe', true); setToggle('t-rays', false);
    setToggle('t-labels', true);
    setFocus('earth', 9, viewDir(0.4, 0.34, 1.0));
    showTip('tipDay');
  }
  if(name==='seasons'){
    setSpeed(14); setPlaying(true);
    setToggle('t-orbits', true); setToggle('t-markers', true); setToggle('t-axis', true);
    setToggle('t-globe', true); setToggle('t-rays', true);
    setToggle('t-labels', true);
    setFocus('earth', 150, viewDir(0.3, 1.0, 0.45));
    showTip('tipSeasons');
  }
  if(name==='moon'){
    setSpeed(1.6); setPlaying(true);
    setToggle('t-orbits', false); setToggle('t-markers', false); setToggle('t-axis', false);
    setToggle('t-globe', false); setToggle('t-rays', true);
    setToggle('t-labels', true);
    setFocus('fromEarth');
    showTip('tipMoon');
  }
  el('intro').classList.add('hidden');
}
document.querySelectorAll('[data-lesson]').forEach(b =>
  b.addEventListener('click', () => lesson(b.dataset.lesson)));

el('freeBtn').addEventListener('click', () => { el('intro').classList.add('hidden'); hideTip(); });
el('helpBtn').addEventListener('click', () => el('intro').classList.remove('hidden'));

function setLanguage(l){
  lang = I18N[l] ? l : 'en';
  setLang(lang);
  document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach(e => { e.innerHTML = t(e.dataset.i18nHtml); });
  document.querySelectorAll('.lang button').forEach(b => b.classList.toggle('on', b.dataset.lang===lang));
  setPlaying(state.playing);
  setSpeed(state.daysPerSecond);
  setLabel(sunLabel, t('sun'));
  setLabel(earthLabel, t('earth'));
  setLabel(moonLabel, t('moon'));
  for(const m of seasonLabels) setLabel(m.sprite, t(m.key));
  for(const p of planetLabels) setLabel(p.sprite, t('pl_'+p.key));
  if(state.tipKey) el('tipText').textContent = t(state.tipKey);
  updateInfo();
}
document.querySelectorAll('.lang button').forEach(b =>
  b.addEventListener('click', () => setLanguage(b.dataset.lang)));

/* keyboard */
addEventListener('keydown', e => {
  if(e.key===' '){ e.preventDefault(); setPlaying(!state.playing); }
  else if(e.key==='e'||e.key==='E') setFocus('earth');
  else if(e.key==='m'||e.key==='M') setFocus('moon');
  else if(e.key==='1') lesson('day');
  else if(e.key==='2') lesson('seasons');
  else if(e.key==='3') lesson('moon');
  else if(e.key==='h'||e.key==='H') el('intro').classList.toggle('hidden');
});

/* resize */
addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  for(const m of lineMaterials) m.resolution.set(innerWidth, innerHeight);
});

/* click a body to look at it; hover shows a pointer */
const raycaster=new THREE.Raycaster();
const ndc=new THREE.Vector2();
const dom=renderer.domElement;
let downX=0, downY=0, pointerDown=false;
function clickables(){
  const arr=[earth, moon, sun];
  if(planetsGroup.visible) for(const pb of planetBodies) arr.push(pb.mesh);
  return arr;
}
function pickBody(e){
  ndc.set((e.clientX/innerWidth)*2-1, -(e.clientY/innerHeight)*2+1);
  raycaster.setFromCamera(ndc, camera);
  const h = raycaster.intersectObjects(clickables(), false)[0];
  return h ? h.object : null;
}
dom.style.cursor='grab';
dom.addEventListener('pointerdown', e => { pointerDown=true; downX=e.clientX; downY=e.clientY;
  dom.style.cursor='grabbing'; });
dom.addEventListener('pointerup', e => {
  pointerDown=false; dom.style.cursor='grab';
  if(Math.hypot(e.clientX-downX, e.clientY-downY) > 6) return;
  const o = pickBody(e);
  if(!o) return;
  if(o===moon) setFocus('moon');
  else if(o===sun) setFocus('sun');
  else if(o===earth) setFocus('earth');
  // planets aren't focus targets — silently ignored for now
  hideTip();
});
dom.addEventListener('pointermove', e => {
  if(pointerDown) return;
  dom.style.cursor = pickBody(e) ? 'pointer' : 'grab';
});
dom.addEventListener('wheel', e => {
  if(state.focus==='fromEarth'){
    e.preventDefault();
    state.backDist = THREE.MathUtils.clamp(
      state.backDist * (1 + Math.sign(e.deltaY)*0.12), EARTH_R*2.4, EARTH_R*13);
  } else if(state.focus==='fromSun'){
    e.preventDefault();
    state.backDist = THREE.MathUtils.clamp(
      state.backDist * (1 + Math.sign(e.deltaY)*0.12), 12, 80);
  }
}, { passive:false });

el('fromEarthBtn').addEventListener('click', () => { setFocus('fromEarth'); showTip('tipMoon'); });
el('fromSunBtn').addEventListener('click',  () => { setFocus('fromSun');   showTip('tipFromSun'); });

/* ============================================================
   Main loop
   ============================================================ */
const clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if(state.playing) state.simDays += dt * state.daysPerSecond;

  tickRealScale(dt);
  updateBodies();
  sunRays.visible    = el('t-rays').checked   && state.focus!=='sun';
  earthLabel.visible = el('t-labels').checked && state.focus!=='fromEarth';
  updateRays();

  if(trans){
    trans.u = Math.min(trans.u + dt/trans.dur, 1);
    const u = trans.u, e = u<0.5 ? 2*u*u : 1-Math.pow(-2*u+2, 2)/2;
    if(trans.toLocked==='fromEarth')    fromEarthCamPose(tmpA, tmpB);
    else if(trans.toLocked==='fromSun') fromSunCamPose(tmpA, tmpB);
    else { getFocusWorldPos(tmpB); tmpA.copy(tmpB).addScaledVector(trans.dir, trans.dist); }
    camera.position.lerpVectors(trans.fromCam, tmpA, e);
    controls.target.lerpVectors(trans.fromTgt, tmpB, e);
    camera.up.set(0,1,0);
    camera.lookAt(controls.target);
    if(u>=1){
      trans = null;
      if(state.focus!=='fromEarth' && state.focus!=='fromSun') controls.enabled = true;
    }
  } else if(state.focus==='fromEarth'){
    updateFromEarthCamera();
  } else if(state.focus==='fromSun'){
    updateFromSunCamera();
  } else {
    getFocusWorldPos(tmpA);
    tmpB.copy(camera.position).sub(controls.target);
    controls.target.copy(tmpA);
    camera.position.copy(tmpA).add(tmpB);
    controls.update();
  }

  // axis grows a little when far away, so the tilt stays readable
  earth.getWorldPosition(tmpA);
  const axisScale = THREE.MathUtils.clamp(1 + (camera.position.distanceTo(tmpA)-12)/120, 1, 1.9);
  axisGroup.scale.setScalar(axisScale);
  vertRef.scale.setScalar(axisScale);

  tickLabelSizes();

  infoTimer += dt;
  if(infoTimer > 0.12){ infoTimer = 0; updateInfo(); }

  renderer.render(scene, camera);
}

/* ---------- boot ---------- */
setSpeed(1);
updateBodies();
state.focus = 'earth';
controls.minDistance = 2.6;
placeCamera(13, viewDir(0.85, 0.42, 0.55));
document.querySelectorAll('#focusSeg button').forEach(b =>
  b.classList.toggle('on', b.dataset.focus==='earth'));
setLanguage(lang);
animate();

window.__spaceReady = true;
