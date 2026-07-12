'use strict';
// PUBG Recreation — village/road layout, noise heightfield, vertex-colored terrain chunks

// ---------------- world layout : buildings & dirt roads ----------------
const WORLD = 900, HALF = WORLD/2;
// clusters: Oakfield village (center), Riverside hamlet (NW), military depot (SE),
// hilltop farm (NE) and lone houses scattered around the island
const buildings = [
  // Oakfield
  { x:-20, z:-30, w:12, d:9,  h:4.6, door:'E' },
  { x:-22, z:-8,  w:10, d:8,  h:4.2, door:'E' },
  { x:-19, z:14,  w:13, d:10, h:5.0, door:'E' },
  { x: 16, z:-32, w:11, d:9,  h:4.4, door:'W' },
  { x: 18, z:-6,  w:9,  d:12, h:4.2, door:'W' },
  { x: 17, z:18,  w:12, d:9,  h:4.6, door:'W' },
  { x: -2, z:44,  w:14, d:11, h:5.6, door:'S' },
  // Riverside hamlet
  { x:-295, z:163, w:11, d:9,  h:4.4, door:'N' },
  { x:-272, z:161, w:10, d:8,  h:4.2, door:'N' },
  { x:-247, z:164, w:12, d:10, h:4.8, door:'N' },
  { x:-293, z:199, w:10, d:9,  h:4.4, door:'S' },
  { x:-266, z:201, w:13, d:9,  h:5.0, door:'S' },
  { x:-240, z:198, w:9,  d:8,  h:4.2, door:'S' },
  // military depot (big flat-roof warehouses)
  { x:200, z:-243, w:16, d:12, h:6.5, door:'N', flat:true },
  { x:232, z:-245, w:14, d:11, h:6.0, door:'N', flat:true },
  { x:205, z:-196, w:15, d:11, h:6.2, door:'S', flat:true },
  { x:240, z:-194, w:12, d:10, h:5.5, door:'S', flat:true },
  { x:262, z:-222, w:10, d:9,  h:5.0, door:'W', flat:true },
  // hilltop farm
  { x:232, z:242, w:15, d:10, h:5.8, door:'E' },
  { x:255, z:262, w:10, d:8,  h:4.2, door:'S' },
  { x:222, z:266, w:7,  d:6,  h:3.4, door:'S' },
  // lone houses
  { x:-350, z:-40,  w:11, d:9, h:4.4, door:'E' },
  { x: 350, z:60,   w:10, d:9, h:4.4, door:'W' },
  { x:-60,  z:-300, w:12, d:9, h:4.6, door:'N' },
  { x:-280, z:-180, w:10, d:8, h:4.2, door:'E' },
  { x: 120, z:330,  w:11, d:9, h:4.6, door:'S' },
  { x: 60,  z:-120, w:10, d:8, h:4.2, door:'W' },
];
const roads = [
  { ax:0,    az:-50,  bx:0,    bz:36,   hw:2.8 },   // Oakfield main street
  { ax:0,    az:30,   bx:-120, bz:100,  hw:2.4 },   // to Riverside
  { ax:-120, az:100,  bx:-220, bz:180,  hw:2.4 },
  { ax:-300, az:180,  bx:-220, bz:180,  hw:2.6 },   // Riverside street
  { ax:0,    az:-40,  bx:110,  bz:-130, hw:2.4 },   // to the depot
  { ax:110,  az:-130, bx:210,  bz:-218, hw:2.4 },
  { ax:190,  az:-220, bx:258,  bz:-220, hw:2.6 },   // depot street
  { ax:0,    az:26,   bx:120,  bz:140,  hw:2.2 },   // to the farm
  { ax:120,  az:140,  bx:244,  bz:252,  hw:2.2 },
  { ax:-300, az:180,  bx:-338, bz:60,   hw:2.0 },   // west coast track
  { ax:-338, az:60,   bx:-350, bz:-30,  hw:2.0 },
  { ax:-350, az:-30,  bx:-285, bz:-172, hw:2.0 },
  { ax:240,  az:-200, bx:330,  bz:-60,  hw:2.0 },   // east coast track
  { ax:330,  az:-60,  bx:348,  bz:50,   hw:2.0 },
  { ax:0,    az:-50,  bx:-52,  bz:-288, hw:2.2 },   // south track
  { ax:244,  az:252,  bx:128,  bz:322,  hw:2.0 },   // farm to north house
];
function distToSeg(px, pz, r){
  const dx=r.bx-r.ax, dz=r.bz-r.az, L2=dx*dx+dz*dz;
  let t = L2>0 ? ((px-r.ax)*dx+(pz-r.az)*dz)/L2 : 0; t = clamp(t,0,1);
  const x=r.ax+dx*t, z=r.az+dz*t;
  return { d: Math.hypot(px-x, pz-z), x, z };
}
{
  const arterials = roads.slice();
  for(const b of buildings){
    const dir = b.door==='N' ? [0,1] : b.door==='S' ? [0,-1] : b.door==='E' ? [1,0] : [-1,0];
    const dpx = b.x + dir[0]*(b.w/2 + 2.0), dpz = b.z + dir[1]*(b.d/2 + 2.0);
    let best = null, bd = 1e9;
    for(const r of arterials){
      const s = distToSeg(dpx, dpz, r);
      if(s.d < bd){ bd = s.d; best = s; }
    }
    if(best && bd > 2.5) roads.push({ ax:dpx, az:dpz, bx:best.x, bz:best.z, hw:1.6 });
  }
}

// ---------------- terrain height field (generation-time, analytic) ----------------
function baseHeight(x,z){
  const n = Noise.fbm(x*0.0019, z*0.0019, 4, 2.1, 0.5);         // big rolling hills
  let h = 1.2 + Math.pow(clamp(n*0.5+0.5, 0, 1), 1.25) * 26;
  const n2 = Noise.fbm(x*0.006-4.7, z*0.006+9.2, 3, 2.0, 0.5);  // mid hills
  h += Math.pow(clamp(n2*0.5+0.5, 0, 1), 1.1) * 9;
  h += Noise.fbm(x*0.013+7.3, z*0.013-3.1, 3, 2.0, 0.5) * 2.8;  // small detail
  const lake = 1 - smoothstep(12, 62, Math.hypot(x+150, z+60)); // shallow lake basin
  h = lerp(h, -3.4, Math.min(1, lake*1.5));
  const edge = smoothstep(340, 438, Math.max(Math.abs(x), Math.abs(z)));
  h = h*(1-edge*0.92) - edge*5.0;                               // beach slopes at map rim
  return h;
}
for(const b of buildings) b.baseH = baseHeight(b.x, b.z);

function terrainHeightGen(x,z){
  let h = baseHeight(x,z);
  for(const r of roads){
    const s = distToSeg(x,z,r);
    const f = 1 - smoothstep(r.hw, r.hw+4.5, s.d);
    if(f>0) h = h*(1-f) + baseHeight(s.x, s.z)*f;               // flatten across road width
  }
  for(const b of buildings){
    const dx = Math.max(Math.abs(x-b.x)-b.w/2, 0);
    const dz = Math.max(Math.abs(z-b.z)-b.d/2, 0);
    const f = 1 - smoothstep(0, 8.5, Math.hypot(dx,dz));
    if(f>0) h = h*(1-f) + b.baseH*f;                            // building pads
  }
  return h;
}
function roadFactorGen(x,z){
  let rf = 0;
  for(const r of roads){
    const s = distToSeg(x,z,r);
    rf = Math.max(rf, 1 - smoothstep(r.hw*0.75, r.hw+1.3, s.d));
  }
  return rf;
}

// ---------------- terrain vertex colors ----------------
const C_GRASS_A=[0.412,0.588,0.290], C_GRASS_B=[0.290,0.463,0.216], C_DIRT=[0.553,0.443,0.302],
      C_ROCK=[0.512,0.502,0.473], C_SAND=[0.851,0.773,0.561], C_ROAD=[0.478,0.384,0.271];
const C_DRY=[0.588,0.557,0.306];
function colorFor(x, z, h, slope){
  const n = Noise.fbm(x*0.02+11, z*0.02-7, 2, 2.0, 0.5)*0.5 + 0.5;   // grass patchiness
  let c = mix3(C_GRASS_A, C_GRASS_B, n);
  const dry = smoothstep(0.55, 0.95, Noise.fbm(x*0.008+31, z*0.008+17, 2, 2.0, 0.5)*0.5+0.5);
  c = mix3(c, C_DRY, dry*0.65);                                      // sun-dried patches
  const jitter = Noise.noise2(x*0.7, z*0.7)*0.045;
  c = [c[0]+jitter, c[1]+jitter, c[2]+jitter];
  c = mix3(c, C_DIRT, smoothstep(0.32, 0.78, slope));                 // dirt on slopes
  c = mix3(c, C_ROCK, smoothstep(0.85, 1.30, slope));                 // rock on cliffs
  const sandF = Math.max(
    smoothstep(340, 428, Math.max(Math.abs(x), Math.abs(z))),         // sand near map edges
    1 - smoothstep(-1.2, 0.6, h));                                    // sand in low basins
  c = mix3(c, C_SAND, sandF);
  const rf = roadFactorGen(x,z);
  if(rf>0){
    const rc = [C_ROAD[0]*(0.9+0.2*n), C_ROAD[1]*(0.9+0.2*n), C_ROAD[2]*(0.9+0.2*n)];
    c = mix3(c, rc, rf*0.92);                                         // packed dirt roads
  }
  return c;
}

// ---------------- build terrain (6x6 chunk meshes) + runtime height grid ----------------
const SEG = 300, STEP = WORLD/SEG, CHUNKS = 10, CSEG = SEG/CHUNKS;
const heightGrid = new Float32Array((SEG+1)*(SEG+1));
{
  const e = 1.1;
  for(let row=0; row<=SEG; row++){
    for(let col=0; col<=SEG; col++){
      heightGrid[row*(SEG+1)+col] = terrainHeightGen(col*STEP-HALF, row*STEP-HALF);
    }
  }
}
const terrain = new THREE.Group();
const terrainMat = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:1, metalness:0 });
terrainMat.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = { value: 0 };
  terrainMat.userData.shader = shader;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(position,1.0)).xyz;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', ['#include <common>',
      'varying vec3 vWPos; uniform float uTime;',
      'float thash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }',
      'float tnoise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);',
      '  return mix(mix(thash(i),thash(i+vec2(1,0)),f.x), mix(thash(i+vec2(0,1)),thash(i+vec2(1,1)),f.x), f.y); }'].join('\n'))
    .replace('#include <color_fragment>', ['#include <color_fragment>',
      '{ float micro = tnoise(vWPos.xz*2.1)*0.5 + tnoise(vWPos.xz*7.3)*0.5;',   // ground grain
      '  diffuseColor.rgb *= 0.90 + micro*0.18;',
      '  float cl = tnoise(vWPos.xz*0.0045 + vec2(uTime*0.009, uTime*0.006));', // cloud shadows
      '  cl = smoothstep(0.38, 0.78, cl);',
      '  diffuseColor.rgb *= 1.0 - cl*0.16; }'].join('\n'));
};
{
  const e = 1.1;
  const gridH = (col,row) => heightGrid[clamp(row,0,SEG)*(SEG+1)+clamp(col,0,SEG)];
  for(let cj=0; cj<CHUNKS; cj++){
    for(let ci=0; ci<CHUNKS; ci++){
      const size = WORLD/CHUNKS;
      const g = new THREE.PlaneGeometry(size, size, CSEG, CSEG);
      g.rotateX(-Math.PI/2);
      g.translate((ci+0.5)*size - HALF, 0, (cj+0.5)*size - HALF);
      const pos = g.attributes.position;
      const cols = new Float32Array(pos.count*3);
      for(let i=0;i<pos.count;i++){
        const x = pos.getX(i), z = pos.getZ(i);
        const col = Math.round((x+HALF)/STEP), row = Math.round((z+HALF)/STEP);
        const h = gridH(col,row);
        pos.setY(i, h);
        const sx = (gridH(col+1,row)-gridH(col-1,row))/(2*STEP);
        const sz = (gridH(col,row+1)-gridH(col,row-1))/(2*STEP);
        const c = colorFor(x, z, h, Math.hypot(sx,sz));
        cols[i*3]=c[0]; cols[i*3+1]=c[1]; cols[i*3+2]=c[2];
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols,3));
      const flat = g.toNonIndexed();               // per-face normals, no shader derivatives
      flat.computeVertexNormals();
      const m = new THREE.Mesh(flat, terrainMat);
      m.receiveShadow = true;
      terrain.add(m);
    }
  }
}
scene.add(terrain);

// fast bilinear height lookup used by all gameplay code
function heightAt(x,z){
  x = clamp(x, -HALF+0.01, HALF-0.01); z = clamp(z, -HALF+0.01, HALF-0.01);
  const fx = (x+HALF)/STEP, fz = (z+HALF)/STEP;
  const ix = Math.floor(fx), iz = Math.floor(fz);
  const tx = fx-ix, tz = fz-iz, N = SEG+1;
  const h00 = heightGrid[iz*N+ix],     h10 = heightGrid[iz*N+ix+1];
  const h01 = heightGrid[(iz+1)*N+ix], h11 = heightGrid[(iz+1)*N+ix+1];
  return lerp(lerp(h00,h10,tx), lerp(h01,h11,tx), tz);
}
const floors = [];   // building pads: {minX,maxX,minZ,maxZ,top}
function groundAt(x,z){
  let g = heightAt(x,z);
  for(const f of floors){
    if(x>f.minX && x<f.maxX && z>f.minZ && z<f.maxZ && f.top>g) g = f.top;
  }
  return g;
}
