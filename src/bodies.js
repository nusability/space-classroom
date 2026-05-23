// Planet data + factories.
//
// Educational sizes/distances are chosen for visibility.
// Real ratios anchor Earth (radius 1.7, orbit 78) and apply realistic
// Earth-radii and AU multiples to everything else. The "Real scale" toggle
// in the UI animates between the two columns.
//
// Inclinations are the planets' real orbital-plane tilts to the ecliptic.

import * as THREE from 'three';
import { makeBandedTexture, makeRockyTexture, makeRingTexture } from './textures.js';

const DEG = Math.PI/180;

// realR / realOrbit are computed from real Earth-radii and AU ratios
//   (Earth radius = 1.7 units, Earth orbit = 78 units).
// Inclinations: real orbital-plane tilt to the ecliptic.
// Real orbit values use the same anchor as Earth (1 AU = 39,918 units in real mode):
//   realOrbit = (real AU) * 39,918
export const PLANETS = [
  { key:'mercury', eduR:0.55, realR:0.65,  eduOrbit:36,  realOrbit:15_449,    period:0.2408,
    axisTilt:0.03,    incl:7.00*DEG,
    factory: ()=>makeRockyTexture('#8e8276','#5e554c','#bba89a',60) },
  { key:'venus',   eduR:1.45, realR:1.61,  eduOrbit:55,  realOrbit:28_861,    period:0.6152,
    axisTilt:177*DEG, incl:3.39*DEG,
    factory: ()=>makeRockyTexture('#d8b787','#9a7a4d','#f3d7a1',0) },
  // Earth: eduR 1.7, eduOrbit 78 (real 39,918) — handled in main.js
  { key:'mars',    eduR:0.95, realR:0.90,  eduOrbit:108, realOrbit:60_834,    period:1.881,
    axisTilt:25.2*DEG, incl:1.85*DEG,
    factory: ()=>makeRockyTexture('#b85a3a','#7d3a23','#dc8f6b',30) },
  { key:'jupiter', eduR:4.4,  realR:19.06, eduOrbit:185, realOrbit:207_574,   period:11.862,
    axisTilt:3.1*DEG, incl:1.30*DEG,
    factory: ()=>makeBandedTexture(Object.assign(
      ['#b69a73','#d6b88a','#8c7656','#e3c79a','#7a6444'],
      { spot:'rgba(190,90,60,0.9)' }), 18) },
  { key:'saturn',  eduR:3.7,  realR:16.06, eduOrbit:260, realOrbit:381_217,   period:29.457,
    axisTilt:26.7*DEG, incl:2.49*DEG, rings:true,
    factory: ()=>makeBandedTexture(['#dcc196','#e8d2ad','#b8a079','#efddb6','#a08762'], 16) },
  { key:'uranus',  eduR:2.2,  realR:6.81,  eduOrbit:355, realOrbit:767_224,   period:84.011,
    axisTilt:97.8*DEG, incl:0.77*DEG,
    factory: ()=>makeBandedTexture(['#a8d5d8','#b8dde0','#92c3c8','#cfe6e7','#7fb1b6'], 10) },
  { key:'neptune', eduR:2.1,  realR:6.60,  eduOrbit:445, realOrbit:1_201_531, period:164.79,
    axisTilt:28.3*DEG, incl:1.77*DEG,
    factory: ()=>makeBandedTexture(['#3859a7','#4769bb','#2b4988','#5a7fc8','#23396f'], 12) }
];

// Major moons of the gas giants — Galilean + Titan + Triton.
// Edu values keep them visibly near their planet; real values use Earth-radii
// distances and sizes (Earth radius = 1.7 units).
export const MOONS = [
  { planet:'jupiter', key:'io',       color:0xddc080,
    eduR:0.18, realR:0.486, eduOrbit:6.0,  realOrbit:112.5, period:1.769 },
  { planet:'jupiter', key:'europa',   color:0xc0a37b,
    eduR:0.16, realR:0.416, eduOrbit:7.6,  realOrbit:179.0, period:3.551 },
  { planet:'jupiter', key:'ganymede', color:0x9a8f7d,
    eduR:0.22, realR:0.702, eduOrbit:9.2,  realOrbit:285.0, period:7.155 },
  { planet:'jupiter', key:'callisto', color:0x6b6055,
    eduR:0.20, realR:0.643, eduOrbit:11.5, realOrbit:502.0, period:16.69 },
  { planet:'saturn',  key:'titan',    color:0xc7a64a,
    eduR:0.22, realR:0.687, eduOrbit:8.0,  realOrbit:326.0, period:15.95 },
  { planet:'neptune', key:'triton',   color:0xa8b5be,
    eduR:0.18, realR:0.361, eduOrbit:4.5,  realOrbit:94.66, period:5.877 }
];

// Build one planet body — returns { group, mesh }
export function buildPlanet(p){
  const group = new THREE.Group();
  group.userData = { key:p.key };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(p.eduR, 48, 32),
    new THREE.MeshStandardMaterial({ map:p.factory(p), roughness:0.92, metalness:0.0 })
  );
  mesh.rotation.z = p.axisTilt;
  group.add(mesh);

  if(p.rings){
    const inner=p.eduR*1.25, outer=p.eduR*2.2;
    const ringGeom=new THREE.RingGeometry(inner,outer,96,1);
    const uv=ringGeom.attributes.uv, pos=ringGeom.attributes.position;
    for(let i=0;i<uv.count;i++){
      const x=pos.getX(i), y=pos.getY(i);
      const r=Math.sqrt(x*x+y*y);
      const u=(r-inner)/(outer-inner);
      uv.setXY(i, u, i%2);
    }
    const ringMat=new THREE.MeshStandardMaterial({
      map:makeRingTexture(), side:THREE.DoubleSide, transparent:true,
      roughness:0.85, metalness:0, depthWrite:false });
    const rings=new THREE.Mesh(ringGeom, ringMat);
    rings.rotation.x = Math.PI/2;
    mesh.add(rings);
  }
  return { group, mesh };
}
