// Texture factories — procedural canvases + real-image loaders.

import * as THREE from 'three';

const TAU = Math.PI * 2;

function makeCanvas(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }
export function canvasTexture(c, anisotropy=8){
  const tx=new THREE.CanvasTexture(c);
  tx.colorSpace=THREE.SRGBColorSpace; tx.anisotropy=anisotropy;
  return tx;
}

// Soft radial sprite (used for the Sun glow and the star points)
export function makeGlowTexture(stops){
  const S=128,c=makeCanvas(S,S),x=c.getContext('2d');
  const g=x.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);
  stops.forEach(s=>g.addColorStop(s[0],s[1]));
  x.fillStyle=g;x.fillRect(0,0,S,S);
  return canvasTexture(c);
}

// Sun surface — warm radial gradient with subtle noise
export function makeSunTexture(){
  const S=512,c=makeCanvas(S,S),x=c.getContext('2d');
  const g=x.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);
  g.addColorStop(0,'#fff6d8');g.addColorStop(.6,'#ffd166');g.addColorStop(1,'#f08a2a');
  x.fillStyle=g;x.fillRect(0,0,S,S);
  for(let i=0;i<700;i++){
    x.fillStyle=Math.random()<.5?'rgba(255,240,180,.4)':'rgba(220,110,30,.35)';
    x.beginPath();x.arc(Math.random()*S,Math.random()*S,2+Math.random()*14,0,TAU);x.fill();
  }
  return canvasTexture(c);
}

// Generic banded planet (Jupiter / Saturn / Neptune flavour)
export function makeBandedTexture(palette, bandCount=14){
  const W=1024,H=512,c=makeCanvas(W,H),x=c.getContext('2d');
  // base
  x.fillStyle=palette[0]; x.fillRect(0,0,W,H);
  // horizontal bands
  for(let i=0;i<bandCount;i++){
    const y=Math.random()*H, h=8+Math.random()*46;
    x.fillStyle=palette[1+(Math.random()*(palette.length-1)|0)];
    x.fillRect(0,y,W,h);
  }
  // soft scratches to break the banding
  for(let i=0;i<160;i++){
    const y=Math.random()*H, h=2+Math.random()*8;
    x.fillStyle=`rgba(255,255,255,${0.04+Math.random()*0.08})`;
    x.fillRect(0,y,W,h);
  }
  // optional storm spot (Jupiter)
  if(palette.spot){
    const cx=Math.random()*W*0.8+W*0.1, cy=H*0.55+Math.random()*H*0.1, r=24+Math.random()*18;
    const g=x.createRadialGradient(cx,cy,0,cx,cy,r);
    g.addColorStop(0,palette.spot);g.addColorStop(1,'rgba(0,0,0,0)');
    x.fillStyle=g; x.beginPath(); x.ellipse(cx,cy,r*1.8,r,0,0,TAU); x.fill();
  }
  return canvasTexture(c);
}

// Solid planet with subtle noise (Mercury, Mars, Venus, Uranus, Neptune)
export function makeRockyTexture(base, dark, light, craters=0){
  const W=1024,H=512,c=makeCanvas(W,H),x=c.getContext('2d');
  x.fillStyle=base; x.fillRect(0,0,W,H);
  for(let i=0;i<240;i++){
    const r=20+Math.random()*120;
    x.fillStyle=Math.random()<.5?dark:light;
    x.globalAlpha=0.10+Math.random()*0.18;
    x.beginPath();x.arc(Math.random()*W,Math.random()*H,r,0,TAU);x.fill();
  }
  x.globalAlpha=1;
  for(let i=0;i<craters;i++){
    const px=Math.random()*W,py=Math.random()*H,r=3+Math.random()*16;
    x.fillStyle='rgba(0,0,0,.35)';x.beginPath();x.arc(px,py,r,0,TAU);x.fill();
    x.strokeStyle='rgba(255,255,255,.25)';x.lineWidth=Math.max(1,r*0.18);
    x.beginPath();x.arc(px-r*.15,py-r*.15,r*0.85,0,TAU);x.stroke();
  }
  return canvasTexture(c);
}

// Saturn-style ring band — concentric stripes on a thin strip
export function makeRingTexture(){
  const W=512,H=64,c=makeCanvas(W,H),x=c.getContext('2d');
  // base translucent tan
  x.fillStyle='rgba(0,0,0,0)'; x.fillRect(0,0,W,H);
  const cy=H/2;
  for(let i=0;i<W;i++){
    const r=i/W;
    // density falls off near inner & outer edges; one Cassini gap
    let a = Math.sin(r*Math.PI) * (0.55 + 0.35*Math.sin(r*36)) ;
    if(r>0.62 && r<0.66) a *= 0.05;       // Cassini-like gap
    if(r<0.05 || r>0.97) a = 0;
    const tint = 200 + Math.sin(r*48)*30;
    x.fillStyle = `rgba(${tint|0}, ${(tint*0.92)|0}, ${(tint*0.72)|0}, ${Math.max(0,a).toFixed(3)})`;
    x.fillRect(i,0,1,H);
  }
  return canvasTexture(c);
}

// --- Real-image loaders. Textures are bundled in /public/textures/ — same origin, no CORS. ---
const TEX_BASE = './textures/';

function loadTex(file){
  const tex = new THREE.TextureLoader().load(TEX_BASE+file);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
export function loadEarthTexture()       { return loadTex('earth_atmos_2048.jpg'); }
export function loadEarthCloudsTexture() { return loadTex('earth_clouds_1024.png'); }
export function loadMoonTexture()        { return loadTex('moon_1024.jpg'); }
