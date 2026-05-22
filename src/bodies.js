// Planets data + factory. Sizes/distances are educational — not to scale.

import * as THREE from 'three';
import { makeBandedTexture, makeRockyTexture, makeRingTexture } from './textures.js';

const DEG = Math.PI/180;

// Visual sizes (radius) and orbit radii — chosen so everything is recognisable
// at once, not realistic. Periods are real (Earth-years).
export const PLANETS = [
  { key:'mercury', radius:0.55, orbit:36,  period:0.2408, axisTilt:0.03,
    factory: m=>makeRockyTexture('#8e8276','#5e554c','#bba89a',60) },
  { key:'venus',   radius:1.45, orbit:55,  period:0.6152, axisTilt:177*DEG,
    factory: m=>makeRockyTexture('#d8b787','#9a7a4d','#f3d7a1',0) },
  // Earth lives at orbit 78 — handled in main.js
  { key:'mars',    radius:0.95, orbit:108, period:1.881,  axisTilt:25.2*DEG,
    factory: m=>makeRockyTexture('#b85a3a','#7d3a23','#dc8f6b',30) },
  { key:'jupiter', radius:4.4,  orbit:185, period:11.862, axisTilt:3.1*DEG,
    factory: m=>makeBandedTexture(Object.assign(
      ['#b69a73','#d6b88a','#8c7656','#e3c79a','#7a6444'],
      { spot:'rgba(190,90,60,0.9)' }), 18) },
  { key:'saturn',  radius:3.7,  orbit:260, period:29.457, axisTilt:26.7*DEG, rings:true,
    factory: m=>makeBandedTexture(['#dcc196','#e8d2ad','#b8a079','#efddb6','#a08762'], 16) },
  { key:'uranus',  radius:2.2,  orbit:355, period:84.011, axisTilt:97.8*DEG,
    factory: m=>makeBandedTexture(['#a8d5d8','#b8dde0','#92c3c8','#cfe6e7','#7fb1b6'], 10) },
  { key:'neptune', radius:2.1,  orbit:445, period:164.79, axisTilt:28.3*DEG,
    factory: m=>makeBandedTexture(['#3859a7','#4769bb','#2b4988','#5a7fc8','#23396f'], 12) }
];

// Build one planet — returns { group, mesh, period, phase }
export function buildPlanet(p){
  const group = new THREE.Group();
  group.userData = { key:p.key, orbit:p.orbit, period:p.period, phase:Math.random()*Math.PI*2 };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(p.radius, 48, 32),
    new THREE.MeshStandardMaterial({ map:p.factory(p), roughness:0.92, metalness:0.0 })
  );
  mesh.rotation.z = p.axisTilt;
  group.add(mesh);

  if(p.rings){
    const inner=p.radius*1.25, outer=p.radius*2.2;
    const ringGeom=new THREE.RingGeometry(inner,outer,96,1);
    // remap UVs so the ring texture goes radially across the strip
    const uv=ringGeom.attributes.uv;
    const pos=ringGeom.attributes.position;
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
    rings.rotation.x = Math.PI/2;       // ring plane along the equator
    mesh.add(rings);
  }
  return { group, mesh };
}
