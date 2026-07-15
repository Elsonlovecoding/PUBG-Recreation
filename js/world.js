'use strict';
// PUBG Recreation — water, mountains, clouds, trees/rocks/grass, buildings + colliders

// ---------------- animated water (sea + lake share one shader plane) ----------------
const waterMat = new THREE.ShaderMaterial({
  transparent:true, fog:false,
  uniforms: {
    time:     { value: 0 },
    sunDir:   { value: sunDirection.clone() },
    deep:     { value: new THREE.Color(0x1d4a63) },
    shallow:  { value: new THREE.Color(0x2f6f8d) },
    fogColor: { value: new THREE.Color(SKY_HORIZON) },
    fogNear:  { value: 140 }, fogFar: { value: 1180 },
  },
  vertexShader: [
    'uniform float time;',
    'varying vec3 vW; varying float vDist;',
    'void main(){',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  wp.y += sin(wp.x*0.06 + time*1.1)*0.12 + cos(wp.z*0.05 + time*0.8)*0.12;',  // gentle swell
    '  vW = wp.xyz;',
    '  vec4 mv = viewMatrix * wp;',
    '  vDist = -mv.z;',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n'),
  fragmentShader: [
    'uniform vec3 sunDir, deep, shallow, fogColor; uniform float time, fogNear, fogFar;',
    'varying vec3 vW; varying float vDist;',
    'void main(){',
    '  vec3 nrm = normalize(vec3(',
    '    sin(vW.x*0.11 + time*1.4)*0.10 + sin(vW.x*0.023 - time*0.6)*0.06,',
    '    1.0,',
    '    cos(vW.z*0.09 + time*1.1)*0.10 + cos(vW.z*0.031 + time*0.5)*0.06));',
    '  vec3 viewDir = normalize(cameraPosition - vW);',
    '  float fres = pow(1.0 - max(dot(viewDir, nrm), 0.0), 2.0);',
    '  vec3 col = mix(deep, shallow, 0.35 + 0.30*sin(vW.x*0.01 + vW.z*0.013 + time*0.2));',
    '  col = mix(col, fogColor*0.95, fres*0.55);',                                // sky tint at grazing angles
    '  vec3 h = normalize(viewDir + normalize(sunDir));',
    '  col += vec3(1.0, 0.95, 0.85) * pow(max(dot(nrm, h), 0.0), 90.0) * 0.9;',   // sun glints
    '  float fAmt = smoothstep(fogNear, fogFar, vDist);',                          // warm aerial haze
    '  vec3 fCol = fogColor * mix(vec3(1.0), vec3(1.10, 1.015, 0.88), pow(max(dot(-viewDir, normalize(sunDir)), 0.0), 5.0));',
    '  col = mix(col, fCol, fAmt);',
    '  gl_FragColor = vec4(col, 0.94);',
    '}'
  ].join('\n')
});
const water = new THREE.Mesh(new THREE.PlaneGeometry(12600, 12600, 96, 96), waterMat);
water.rotation.x = -Math.PI/2; water.position.y = -2.3;
scene.add(water);

// merge helpers: everything static is vertex-colored + merged into few draw calls
function tintGeo(g, hex, shade){
  if(g.index) g = g.toNonIndexed();
  const c = new THREE.Color(hex);
  if(shade!==undefined) c.multiplyScalar(shade);
  const n = g.attributes.position.count, arr = new Float32Array(n*3);
  for(let i=0;i<n;i++){ arr[i*3]=c.r; arr[i*3+1]=c.g; arr[i*3+2]=c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr,3));
  return g;
}
function mergeGeoms(list){
  let vc=0; for(const g of list) vc += g.attributes.position.count;
  const pos=new Float32Array(vc*3), nor=new Float32Array(vc*3), col=new Float32Array(vc*3);
  let o=0;
  for(const g of list){
    pos.set(g.attributes.position.array, o*3);
    nor.set(g.attributes.normal.array, o*3);
    col.set(g.attributes.color.array, o*3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos,3));
  out.setAttribute('normal',   new THREE.BufferAttribute(nor,3));
  out.setAttribute('color',    new THREE.BufferAttribute(col,3));
  return out;
}
const MAT_FLAT = new THREE.MeshStandardMaterial({ vertexColors:true, flatShading:true, roughness:1, metalness:0 });
// every prop shares this material — give it aerial-perspective fog + a subtle triplanar
// surface grain so walls, rocks and trunks stop reading as perfectly flat paint
MAT_FLAT.onBeforeCompile = (shader) => {
  injectAerialFog(shader);
  shader.uniforms.tGrain = { value: DETAIL.grain };
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform sampler2D tGrain;')
    .replace('#include <lights_physical_fragment>', [
      '{',
      '  vec3 gN = abs(inverseTransformDirection(normal, viewMatrix));',
      '  gN /= (gN.x + gN.y + gN.z + 0.0001);',
      '  float g1 = texture2D(tGrain, vAWPos.zy*0.41).r;',
      '  float g2 = texture2D(tGrain, vAWPos.xz*0.41).r;',
      '  float g3 = texture2D(tGrain, vAWPos.xy*0.41).r;',
      '  float gr = (g1*gN.x + g2*gN.y + g3*gN.z) * 2.0;',
      '  diffuseColor.rgb *= 0.82 + gr*0.20;',
      '}',
      '#include <lights_physical_fragment>'].join('\n'));
};
// per-vertex color jitter breaks up flat tints so foliage and stone read organic
function jitterColors(geo, amt){
  const c = geo.attributes.color, p = geo.attributes.position;
  for(let i=0;i<c.count;i++){
    const j = 1 + Noise.noise2(p.getX(i)*1.9 + p.getY(i)*1.1, p.getZ(i)*1.9)*amt;
    c.setXYZ(i, c.getX(i)*j, c.getY(i)*j, c.getZ(i)*j);
  }
  return geo;
}
// fake global illumination baked into vertex colors: darken downward faces and a
// contact band near the ground so props sit IN the world instead of on top of it
function bakeAO(geo, band, downMul){
  const p = geo.attributes.position, n = geo.attributes.normal, c = geo.attributes.color;
  for(let i=0;i<p.count;i++){
    let f = 1;
    if(n.getY(i) < -0.25) f *= downMul;
    const above = p.getY(i) - heightAt(p.getX(i), p.getZ(i));
    f *= 0.76 + 0.24 * clamp(above / band, 0, 1);
    if(f < 0.999) c.setXYZ(i, c.getX(i)*f, c.getY(i)*f, c.getZ(i)*f);
  }
  return geo;
}
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
function xform(g, x,y,z, ry, sx,sy,sz){
  tmpM.compose(new THREE.Vector3(x,y,z), tmpQ.setFromEuler(tmpE.set(0,ry||0,0)),
    new THREE.Vector3(sx||1, sy||sx||1, sz||sx||1));
  g.applyMatrix4(tmpM); return g;
}
// solid triangular prism for gable ends (base w, apex h, thickness t along z)
function gablePrism(w, h, t, x, y, z, hex){
  const hw = w/2, ht = t/2;
  const pos = [
    -hw,0,ht,  hw,0,ht,  0,h,ht,                       // front
    hw,0,-ht, -hw,0,-ht, 0,h,-ht,                      // back
    -hw,0,-ht, -hw,0,ht, 0,h,ht,   -hw,0,-ht, 0,h,ht, 0,h,-ht,   // left slope
    hw,0,ht, hw,0,-ht, 0,h,-ht,    hw,0,ht, 0,h,-ht, 0,h,ht,     // right slope
    -hw,0,-ht, hw,0,-ht, hw,0,ht,  -hw,0,-ht, hw,0,ht, -hw,0,ht, // bottom
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  g.translate(x, y, z);
  return tintGeo(g, hex);
}

// (no fake horizon cones — the open sea, fog and sky gradient carry the horizon cleanly)
// clouds: layered soft billboard sprites (procedural puff texture) instead of solid blobs
const clouds = new THREE.Group();
{
  const cmats = [0.42, 0.58, 0.74].map(o => new THREE.SpriteMaterial({
    map: DETAIL.cloud, transparent: true, opacity: o, depthWrite: false, fog: true }));
  for(let i=0;i<52;i++){
    const cx = randRange(-1930,1930), cz = randRange(-1930,1930), cy = randRange(190,330);
    const n = 2 + Math.floor(Math.random()*2);
    for(let k=0;k<n;k++){
      const sp = new THREE.Sprite(cmats[Math.floor(Math.random()*cmats.length)]);
      const w = randRange(110, 260);
      sp.scale.set(w, w*randRange(0.34, 0.46), 1);
      sp.position.set(cx + randRange(-70,70), cy + randRange(-10,12), cz + randRange(-50,50));
      clouds.add(sp);
    }
  }
}
scene.add(clouds);

// ---------------- collision registries ----------------
const colliders = [];       // axis-aligned wall boxes for movement + bullets
const doorSpots = [];       // outside-the-door waypoints for bots
const coverSpots = [];      // building corners / boulders / thick trees
const solidCyls = [];       // tree trunks + boulders: cylinders that block movement, bullets, LOS
const foliageBalls = [];    // tree canopies: block line of sight only

// ---------------- scatter placement helpers ----------------
function insideBuilding(x, z, pad){
  for(const b of buildings){
    if(Math.abs(x-b.x) < b.w/2+pad && Math.abs(z-b.z) < b.d/2+pad) return true;
  }
  return false;
}
function slopeAt(x,z){
  const e=1.2;
  return Math.hypot(heightAt(x+e,z)-heightAt(x-e,z), heightAt(x,z+e)-heightAt(x,z-e))/(2*e);
}
function goodScatterSpot(x, z, roadPad, bldPad){
  if(Math.max(Math.abs(x),Math.abs(z)) > 1930) return false;
  if(insideBuilding(x, z, bldPad)) return false;
  if(roadFactorGen(x,z) > roadPad) return false;
  return true;
}

// ---------------- trees (3800, conifer + deciduous), rocks (800 smooth boulders) ----------------
const treeSpots = [];
{
  const tg = [];
  // deciduous canopies: subdivided icospheres with smooth noise lumps
  function leafBlob(r, seed){
    const g = new THREE.IcosahedronGeometry(r, 1);
    const p = g.attributes.position;
    for(let i=0;i<p.count;i++){
      const vx=p.getX(i), vy=p.getY(i), vz=p.getZ(i);
      const f = 1 + Noise.noise2(vx*1.4 + seed, vz*1.4 + vy*0.8 - seed)*0.16;
      p.setXYZ(i, vx*f, vy*f*0.88, vz*f);
    }
    return g;
  }
  let placed = 0, guard = 0;
  while(placed < 3800 && guard++ < 240000){
    const x = randRange(-1930,1930), z = randRange(-1930,1930);
    if(!goodScatterSpot(x,z,0.03,4.5) || slopeAt(x,z) > 0.62) continue;
    const y = heightAt(x,z);
    if(y < -0.6 || y > 76) continue;                          // no beach/lake trees, none above the treeline
    const s = randRange(0.85,1.65), ry = randRange(0,Math.PI*2);
    const conifer = placed % 9 < 5;                           // ~55/45 mixed forest
    const leaf = new THREE.Color().setHSL(
      (conifer ? 0.31 : 0.26) + randRange(-0.035,0.045),
      0.40 + randRange(-0.06,0.06),
      (conifer ? 0.30 : 0.34) + randRange(-0.05,0.05));
    if(conifer){
      tg.push(xform(tintGeo(new THREE.CylinderGeometry(0.15,0.32,1.6,7), 0x6b4a2f), x, y+0.8*s, z, ry, s));
      tg.push(xform(tintGeo(new THREE.ConeGeometry(1.85,2.1,8), leaf.getHex()),       x, y+(1.5+0.95)*s, z, ry, s));
      tg.push(xform(tintGeo(new THREE.ConeGeometry(1.42,2.0,8), leaf.getHex(), 1.07), x, y+(1.5+2.05)*s, z, ry+0.4, s));
      tg.push(xform(tintGeo(new THREE.ConeGeometry(0.95,1.9,8), leaf.getHex(), 1.15), x, y+(1.5+3.15)*s, z, ry+0.9, s));
      foliageBalls.push({ x, y: y + 3.6*s, z, r: 1.5*s });
      solidCyls.push({ x, z, r: 0.32*s + 0.06, y0: y - 0.5, y1: y + 1.8*s, kind:'tree' });
    } else {
      tg.push(xform(tintGeo(new THREE.CylinderGeometry(0.14,0.28,2.4,7), 0x715038), x, y+1.2*s, z, ry, s));
      tg.push(xform(tintGeo(leafBlob(1.5, x), leaf.getHex()),        x, y+3.35*s, z, ry, 1.12*s, 0.9*s, 1.12*s));
      tg.push(xform(tintGeo(leafBlob(0.95, z), leaf.getHex(), 1.14), x+0.85*s, y+2.9*s, z+0.4*s, ry, s));
      foliageBalls.push({ x, y: y + 3.3*s, z, r: 1.6*s });
      solidCyls.push({ x, z, r: 0.28*s + 0.06, y0: y - 0.5, y1: y + 2.4*s, kind:'tree' });
    }
    treeSpots.push({x,z,r:0.55*s});
    if(placed % 5 === 0){
      const ca = randRange(0, Math.PI*2);
      coverSpots.push({ x: x + Math.cos(ca)*1.7, z: z + Math.sin(ca)*1.7 });
    }
    placed++;
  }
  const trees = new THREE.Mesh(jitterColors(bakeAO(mergeGeoms(tg), 2.2, 0.80), 0.10), MAT_FLAT);
  trees.castShadow = true; trees.receiveShadow = true;
  scene.add(trees);
}
{
  const rg = [];
  let placed = 0, guard = 0;
  while(placed < 800 && guard++ < 90000){
    const x = randRange(-1930,1930), z = randRange(-1930,1930);
    if(!goodScatterSpot(x,z,0.05,3)) continue;
    const y = heightAt(x,z), r = randRange(0.5,2.1);
    // smooth lumpy boulder: subdivided icosphere displaced by low-frequency noise, squashed
    const g = new THREE.IcosahedronGeometry(r, 1);
    const p = g.attributes.position;
    for(let i=0;i<p.count;i++){
      const vx=p.getX(i), vy=p.getY(i), vz=p.getZ(i);
      const f = 1 + Noise.fbm(vx*0.9/r + x*0.11, (vz*0.9 + vy*0.6)/r + z*0.11, 2, 2.0, 0.5)*0.30;
      p.setXYZ(i, vx*f, vy*f*0.70, vz*f);
    }
    const grey = new THREE.Color().setHSL(0.09+randRange(0,0.04), 0.05+randRange(0,0.04), 0.42+randRange(-0.06,0.08));
    rg.push(xform(tintGeo(g, grey.getHex()), x, y+r*0.34, z, randRange(0,Math.PI*2)));
    solidCyls.push({ x, z, r: Math.max(0.45, r*0.85), y0: y - 1.0, y1: y + r*0.72, kind:'rock' });  // every rock blocks
    if(r > 1.3) coverSpots.push({ x: x + randRange(-2.2,2.2), z: z + randRange(-2.2,2.2) });
    placed++;
  }
  const rocks = new THREE.Mesh(jitterColors(bakeAO(mergeGeoms(rg), 1.3, 0.85), 0.13), MAT_FLAT);
  rocks.castShadow = true; rocks.receiveShadow = true;
  scene.add(rocks);
}

// ---------------- buildings: style-aware builder (houses, apartments, barns, sheds, warehouses) ----------------
const PALETTES = [
  { wall:0xcfc3a8, trim:0x8d8069, roof:0x8a4438 },
  { wall:0xb06a4a, trim:0x7d4a35, roof:0x5c5852 },
  { wall:0x9aa08c, trim:0x6f755f, roof:0x6b4a38 },
  { wall:0x8f7355, trim:0x66513a, roof:0x525a62 },
  { wall:0xd9d2c4, trim:0x7d6c58, roof:0x5a6570 },
  { wall:0x6e5a44, trim:0x4a3c2c, roof:0x74564a },
  // concrete high-rises — used only by the 'tower' style
  { wall:0x8f949a, trim:0x686e74, roof:0x565b61 },
  { wall:0xa39d92, trim:0x746e64, roof:0x5a5f66 },
];
const HOUSE_PALETTES = 6;   // regular buildings cycle the first six
const bldGeoms = [];
function bBox(w,h,d, x,y,z, color, collide){
  bldGeoms.push(xform(tintGeo(new THREE.BoxGeometry(w,h,d), color), x, y, z, 0));
  if(collide) colliders.push({ minX:x-w/2, maxX:x+w/2, minY:y-h/2, maxY:y+h/2, minZ:z-d/2, maxZ:z+d/2 });
}
function bGeo(geo, color){ bldGeoms.push(tintGeo(geo, color)); }
function wallWithDoor(side, fy, H, t, P, doorW, doorH){
  // wall running along side.ax with a doorway cut into it
  const seg = (side.len - doorW)/2;
  if(side.ax === 'x'){
    bBox(seg, H, t, side.cx-(doorW/2+seg/2), fy+H/2, side.cz, P.wall, true);
    bBox(seg, H, t, side.cx+(doorW/2+seg/2), fy+H/2, side.cz, P.wall, true);
    bBox(doorW, H-doorH, t, side.cx, fy+doorH+(H-doorH)/2, side.cz, P.wall, true);
    bBox(doorW+0.5, 0.18, t+0.16, side.cx, fy+doorH+0.02, side.cz, P.trim, false);
    bBox(0.2, doorH, t+0.16, side.cx-doorW/2-0.08, fy+doorH/2, side.cz, P.trim, false);
    bBox(0.2, doorH, t+0.16, side.cx+doorW/2+0.08, fy+doorH/2, side.cz, P.trim, false);
  } else {
    bBox(t, H, seg, side.cx, fy+H/2, side.cz-(doorW/2+seg/2), P.wall, true);
    bBox(t, H, seg, side.cx, fy+H/2, side.cz+(doorW/2+seg/2), P.wall, true);
    bBox(t, H-doorH, doorW, side.cx, fy+doorH+(H-doorH)/2, side.cz, P.wall, true);
    bBox(t+0.16, 0.18, doorW+0.5, side.cx, fy+doorH+0.02, side.cz, P.trim, false);
    bBox(t+0.16, doorH, 0.2, side.cx, fy+doorH/2, side.cz-doorW/2-0.08, P.trim, false);
    bBox(t+0.16, doorH, 0.2, side.cx, fy+doorH/2, side.cz+doorW/2+0.08, P.trim, false);
  }
}
function windowsOn(side, t, P, wy, count){
  for(let wi=0; wi<count; wi++){
    const off = count===1 ? 0 : count===2 ? (wi===0?-1:1)*side.len*0.22 : (wi-1)*side.len*0.28;
    if(side.ax === 'x'){
      bBox(1.7, 1.5, t+0.14, side.cx+off, wy, side.cz, P.trim, false);
      bBox(1.4, 1.2, t+0.22, side.cx+off, wy, side.cz, 0x27343f, false);
    } else {
      bBox(t+0.14, 1.5, 1.7, side.cx, wy, side.cz+off, P.trim, false);
      bBox(t+0.22, 1.2, 1.4, side.cx, wy, side.cz+off, 0x27343f, false);
    }
  }
}
function makeBuilding(b, idx){
  const style = b.style || (b.flat || idx % 3 === 2 ? 'flat' : (idx % 4 === 1 ? 'gable' : 'house'));
  const aptInterior = style === 'apartment' && idx % 2 === 0;   // half the walk-ups use an inside staircase
  const P = style === 'tower' ? PALETTES[HOUSE_PALETTES + idx % 2] : PALETTES[idx % HOUSE_PALETTES];
  const y0 = b.baseH, t = 0.36, H = b.h;
  const twoRows = style === 'house2' || style === 'apartment';
  const doorW = style === 'barn' ? 3.4 : (style === 'warehouse' || style === 'flat' || style === 'tower') ? 2.4 : 1.8;
  const doorH = style === 'barn' ? 3.2 : 2.55;

  bBox(b.w+1.6, 0.34, b.d+1.6, b.x, y0+0.17, b.z, 0xb3ada6, false);
  floors.push({ minX:b.x-(b.w+1.6)/2, maxX:b.x+(b.w+1.6)/2, minZ:b.z-(b.d+1.6)/2, maxZ:b.z+(b.d+1.6)/2, top:y0+0.34 });
  const fy = y0 + 0.34;

  const sides = [
    { s:'N', len:b.w, cx:b.x, cz:b.z+b.d/2, ax:'x', dir:[0,1] },
    { s:'S', len:b.w, cx:b.x, cz:b.z-b.d/2, ax:'x', dir:[0,-1] },
    { s:'E', len:b.d, cx:b.x+b.w/2, cz:b.z, ax:'z', dir:[1,0] },
    { s:'W', len:b.d, cx:b.x-b.w/2, cz:b.z, ax:'z', dir:[-1,0] },
  ];
  const sideOrder = ['N','E','S','W'];
  const stairSide = sideOrder[(sideOrder.indexOf(b.door) + 1) % 4];   // apartments: stairs one wall over

  for(const side of sides){
    if(side.s === b.door){
      wallWithDoor(side, fy, H, t, P, doorW, doorH);
      if(style === 'warehouse' || (style === 'flat' && b.w >= 14)){
        // painted roll-door beside the person door
        const off = side.len*0.24;
        if(side.ax === 'x') bBox(Math.min(4.5, side.len*0.32), 3.4, t+0.12, side.cx+off, fy+1.7, side.cz, 0x3c444c, false);
        else bBox(t+0.12, 3.4, Math.min(4.5, side.len*0.32), side.cx, fy+1.7, side.cz+off, 0x3c444c, false);
      }
      if(style === 'tower'){
        // window rows continue above the entrance for the full height
        const nWin = side.len >= 13 ? 3 : 2;
        for(let wy = fy + doorH + 2.1; wy < fy + H - 1.1; wy += 3.0) windowsOn(side, t, P, wy, nWin);
      }
      const dir = side.dir;
      doorSpots.push({ x: side.cx + dir[0]*2.6, z: side.cz + dir[1]*2.6 });
    } else if(style === 'apartment' && !aptInterior && side.s === stairSide){
      // ground wall solid to 3m, upper wall has the balcony doorway
      const lowH = 3.0;
      if(side.ax === 'x') bBox(side.len, lowH, t, side.cx, fy+lowH/2, side.cz, P.wall, true);
      else bBox(t, lowH, side.len, side.cx, fy+lowH/2, side.cz, P.wall, true);
      const upSide = { s:side.s, len:side.len, cx:side.cx, cz:side.cz, ax:side.ax };
      wallWithDoor(upSide, fy+lowH, H-lowH, t, P, 1.7, 2.2);
      windowsOn(side, t, P, fy + 1.65, 1);
    } else {
      if(side.ax === 'x') bBox(side.len, H, t, side.cx, fy+H/2, side.cz, P.wall, true);
      else bBox(t, H, side.len, side.cx, fy+H/2, side.cz, P.wall, true);
      if(style === 'tower'){
        // stacked window rows every storey, all the way up
        const nWin = side.len >= 13 ? 3 : 2;
        for(let wy = fy + 1.85; wy < fy + H - 1.1; wy += 3.0) windowsOn(side, t, P, wy, nWin);
      } else {
        const nWin = style === 'barn' || style === 'shed' ? 1 : (side.len >= 9 ? 2 : 1);
        windowsOn(side, t, P, fy + 1.65, nWin);
        if(twoRows) windowsOn(side, t, P, fy + 4.55, nWin);
      }
    }
  }
  if(style === 'house2') {
    // mid trim band between the two visual storeys
    bBox(b.w+0.2, 0.22, b.d+0.2, b.x, fy+3.05, b.z, P.trim, false);
  }
  if(style === 'apartment' && aptInterior){
    // real second storey with an INSIDE staircase: slab has a stairwell opening,
    // a solid flight climbs the wall opposite the door
    const slabY = fy + 3.0;
    const wi = b.w - 0.8, di = b.d - 0.8;
    const chW2 = 1.25, run2 = Math.min(5.4, wi - 2.0), stepN2 = 8;
    const backSz = b.door === 'N' ? -1 : 1;
    const zw = backSz*(di/2 - chW2/2);
    const x0 = -run2/2;
    for(let i=0;i<stepN2;i++){
      const ty = fy + (i+1)*3.0/stepN2;
      const sxc = x0 + (i+0.5)*run2/stepN2;
      const hgt = ty - fy + 0.02;
      bBox(run2/stepN2 + 0.08, hgt, chW2, b.x + sxc, ty - hgt/2, b.z + zw, 0x8a8171, false);
      bBox(run2/stepN2 + 0.10, 0.8, 0.09, b.x + sxc, ty + 0.4, b.z + zw - backSz*(chW2/2 + 0.05), P.trim, true);
      floors.push({ minX: b.x+sxc-run2/stepN2/2-0.04, maxX: b.x+sxc+run2/stepN2/2+0.04,
                    minZ: b.z+zw-chW2/2, maxZ: b.z+zw+chW2/2, top: ty });
    }
    const o1 = run2/2 + 0.45, strip2 = chW2 + 0.3;
    const put2 = (px0, px1, pz0, pz1) => {
      if(px1-px0 < 0.05 || pz1-pz0 < 0.05) return;
      bBox(px1-px0, 0.22, pz1-pz0, b.x+(px0+px1)/2, slabY, b.z+(pz0+pz1)/2, 0x9a8f7c, false);
      floors.push({ minX:b.x+px0, maxX:b.x+px1, minZ:b.z+pz0, maxZ:b.z+pz1, top:slabY+0.11 });
    };
    put2(-wi/2, wi/2, backSz>0 ? -di/2 : -di/2+strip2, backSz>0 ? di/2-strip2 : di/2);
    put2(-wi/2, 0,  backSz>0 ? di/2-strip2 : -di/2, backSz>0 ? di/2 : -di/2+strip2);
    put2(o1, wi/2,  backSz>0 ? di/2-strip2 : -di/2, backSz>0 ? di/2 : -di/2+strip2);
  } else if(style === 'apartment'){
    // real second storey: interior slab + solid outside staircase to the balcony door
    const slabY = fy + 3.0;
    bBox(b.w-0.5, 0.22, b.d-0.5, b.x, slabY, b.z, 0x9a8f7c, false);
    floors.push({ minX:b.x-(b.w-0.5)/2, maxX:b.x+(b.w-0.5)/2, minZ:b.z-(b.d-0.5)/2, maxZ:b.z+(b.d-0.5)/2, top:slabY+0.11 });
    const ss = sides.find(s => s.s === stairSide);
    const out = ss.dir;
    // balcony landing outside the upper door
    const bw = 2.2, bd = 1.7;
    const bx = ss.cx + out[0]*(bd/2 + 0.1), bz = ss.cz + out[1]*(bd/2 + 0.1);
    const balW = ss.ax === 'x' ? bw : bd, balD = ss.ax === 'x' ? bd : bw;
    bBox(balW, 0.2, balD, bx, slabY, bz, 0x6e5b41, false);
    bBox(balW, 0.16, 0.14, bx, slabY + 0.55, bz + (ss.ax === 'x' ? out[1]*balD/2 : 0), 0x5c4d38, false);  // balcony rail
    floors.push({ minX:bx-balW/2, maxX:bx+balW/2, minZ:bz-balD/2, maxZ:bz+balD/2, top:slabY+0.10 });
    // solid straight staircase running along the wall
    const alongDir = ss.ax === 'x' ? [1,0] : [0,1];
    const steps = 8;
    for(let i=0;i<steps;i++){
      const frac = (i+1)/steps;
      const sy = fy + 0.34 + (slabY - fy - 0.4) * (1 - frac) + 0.2;
      const sx = bx + alongDir[0]*(bw/2 + 0.35 + i*0.62);
      const sz = bz + alongDir[1]*(bw/2 + 0.35 + i*0.62);
      const stw = ss.ax === 'x' ? 0.72 : 1.3, std = ss.ax === 'x' ? 1.3 : 0.72;
      const hgt = sy + 0.09 - fy;                            // risers reach the ground: a solid stair
      bBox(stw, hgt, std, sx, fy + hgt/2, sz, 0x6e5b41, false);
      floors.push({ minX:sx-stw/2, maxX:sx+stw/2, minZ:sz-std/2, maxZ:sz+std/2, top:sy+0.09 });
    }
  }
  const post = style === 'tower' ? 0.72 : 0.5;
  for(const sx of [-1,1]) for(const sz of [-1,1]){
    bBox(post, H, post, b.x+sx*b.w/2, fy+H/2, b.z+sz*b.d/2, P.trim, false);
    coverSpots.push({ x:b.x+sx*(b.w/2+1.3), z:b.z+sz*(b.d/2+1.3) });
  }
  // roofs
  if(style === 'flat' || style === 'warehouse' || style === 'tower'){
    const pH = style === 'tower' ? 1.0 : 0.55;   // tower parapets are solid rails: walk into them and
    const pc = style === 'tower';                // you stop — you have to JUMP to go over the edge
    if(style !== 'tower')                        // tower roof is built with its stairwell opening below
      bBox(b.w+1.3, 0.3, b.d+1.3, b.x, fy+H+0.15, b.z, P.roof, false);
    bBox(b.w+1.3, pH, 0.3, b.x, fy+H+0.3+pH/2, b.z-(b.d+1.0)/2, P.roof, pc);
    bBox(b.w+1.3, pH, 0.3, b.x, fy+H+0.3+pH/2, b.z+(b.d+1.0)/2, P.roof, pc);
    bBox(0.3, pH, b.d+1.3, b.x-(b.w+1.0)/2, fy+H+0.3+pH/2, b.z, P.roof, pc);
    bBox(0.3, pH, b.d+1.3, b.x+(b.w+1.0)/2, fy+H+0.3+pH/2, b.z, P.roof, pc);
    if(style === 'tower'){
      bBox(1.5, 1.0, 1.5, b.x + b.w*0.26, fy+H+0.8, b.z - b.d*0.22, P.roof, false);   // rooftop service unit
    }
  } else if(style === 'shed'){
    const ang = Math.atan2(1.1, b.d);
    const g = new THREE.BoxGeometry(b.w+1.7, 0.22, (b.d+1.9)/Math.cos(ang));
    g.rotateX(ang);
    g.translate(b.x, fy+H+0.45, b.z);
    bGeo(g, P.roof);
  } else if(style === 'gable'){
    // real pitched gable roof: two sloped slabs meeting at a ridge, triangular end walls,
    // a chimney and a little porch canopy over the door
    const roofH = 2.0 + b.w*0.17;
    const sl = Math.hypot(b.w/2 + 0.9, roofH) + 0.25;
    const tilt = Math.atan2(roofH, b.w/2 + 0.9);
    for(const sxs of [-1, 1]){
      const g = new THREE.BoxGeometry(sl, 0.17, b.d + 1.9);
      g.rotateZ(sxs * tilt);
      g.translate(b.x - sxs*(b.w/2 + 0.9)/2, fy + H + roofH/2 + 0.02, b.z);
      bGeo(g, P.roof);
    }
    bldGeoms.push(gablePrism(b.w + 0.18, roofH - 0.06, 0.3, b.x, fy + H, b.z + b.d/2 - 0.16, P.wall));
    bldGeoms.push(gablePrism(b.w + 0.18, roofH - 0.06, 0.3, b.x, fy + H, b.z - b.d/2 + 0.16, P.wall));
    bBox(0.72, roofH + 1.0, 0.72, b.x + b.w*0.24, fy + H + (roofH + 1.0)/2 - 0.3, b.z - b.d*0.16, P.trim, false);
    const ds = sides.find(s => s.s === b.door);
    if(ds){
      const px = ds.cx + ds.dir[0]*1.05, pz = ds.cz + ds.dir[1]*1.05;
      if(ds.ax === 'x'){
        bBox(3.0, 0.14, 2.0, px, fy + doorH + 0.5, pz, P.roof, false);
        bBox(0.15, doorH + 0.36, 0.15, px - 1.25, fy + (doorH + 0.36)/2, pz + ds.dir[1]*0.8, P.trim, false);
        bBox(0.15, doorH + 0.36, 0.15, px + 1.25, fy + (doorH + 0.36)/2, pz + ds.dir[1]*0.8, P.trim, false);
      } else {
        bBox(2.0, 0.14, 3.0, px, fy + doorH + 0.5, pz, P.roof, false);
        bBox(0.15, doorH + 0.36, 0.15, px + ds.dir[0]*0.8, fy + (doorH + 0.36)/2, pz - 1.25, P.trim, false);
        bBox(0.15, doorH + 0.36, 0.15, px + ds.dir[0]*0.8, fy + (doorH + 0.36)/2, pz + 1.25, P.trim, false);
      }
    }
  } else {
    const roofH = (style === 'barn' ? 3.2 + b.w*0.11 : 2.1 + b.w*0.09);
    const cone = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
    cone.rotateY(Math.PI/4);
    cone.scale(b.w+1.9, roofH, b.d+1.9);
    bldGeoms.push(xform(tintGeo(cone, P.roof), b.x, fy+H+roofH/2, b.z, 0));
    if(style !== 'barn') bBox(0.7, 1.5, 0.7, b.x+b.w*0.28, fy+H+roofH*0.55, b.z, P.trim, false);
  }
  if(style === 'tower'){
    // real interior: a concrete storey every 3m, scissor stairs along the N/S walls, all the way to the roof
    const S = 3.0, nF = Math.round(H / S);
    const wi = b.w - 0.9, di = b.d - 0.9;                          // interior extents inside the walls
    const xe = wi/2 - 1.35, run = 5.6, chW = 1.3, stepN = 8, strip = chW + 0.3;
    const slabTop = (x0, x1, z0, z1, cy, th, col) => {             // slab piece + matching walkable floor
      if(x1 - x0 < 0.05 || z1 - z0 < 0.05) return;
      bBox(x1 - x0, th, z1 - z0, b.x + (x0 + x1)/2, cy, b.z + (z0 + z1)/2, col, false);
      floors.push({ minX: b.x + x0, maxX: b.x + x1, minZ: b.z + z0, maxZ: b.z + z1, top: cy + th/2 });
    };
    for(let k = 1; k <= nF; k++){
      const toRoof = k === nF;                                     // the last flight climbs out onto the roof
      const yLo = fy + (k - 1)*S;
      const yHi = toRoof ? fy + H + 0.3 : fy + k*S;
      const sz = (k % 2) ? 1 : -1, xd = (k % 2) ? 1 : -1;          // which wall the flight hugs + run direction
      const zc = sz*(di/2 - chW/2);
      for(let i = 0; i < stepN; i++){
        const ty = yLo + (i + 1)*(yHi - yLo)/stepN;
        const sx2 = xd*(xe - run + (i + 0.5)*run/stepN);
        const hgt = ty - yLo + 0.02;                         // solid risers — no floating slabs, no gaps
        bBox(0.80, hgt, chW, b.x + sx2, ty - hgt/2, b.z + zc, 0x6f757c, false);
        // stepped balustrade on the open side of the flight
        bBox(0.82, 0.85, 0.09, b.x + sx2, ty + 0.42, b.z + zc - sz*(chW/2 + 0.05), 0x82888e, true);
        floors.push({ minX: b.x + sx2 - 0.40, maxX: b.x + sx2 + 0.40,
                      minZ: b.z + zc - chW/2, maxZ: b.z + zc + chW/2, top: ty });
      }
      const o0 = xd > 0 ? xe - 4.0 : -xe - 0.4;                    // stairwell opening in the floor above
      const o1 = xd > 0 ? xe + 0.4 : -xe + 4.0;
      if(toRoof){
        const xR = (b.w + 1.3)/2, zR = (b.d + 1.3)/2;
        const zs0 = sz > 0 ? di/2 - strip : -zR, zs1 = sz > 0 ? zR : -di/2 + strip;
        slabTop(-xR, xR, sz > 0 ? -zR : zs1, sz > 0 ? zs0 : zR, fy + H + 0.15, 0.3, P.roof);
        slabTop(-xR, o0, zs0, zs1, fy + H + 0.15, 0.3, P.roof);
        slabTop(o1, xR, zs0, zs1, fy + H + 0.15, 0.3, P.roof);
        // stairhouse sealing the roof exit, open toward the roof
        const shX = (o0 + o1)/2, shW = o1 - o0 + 0.6;
        bBox(shW, 0.2, 2.9, b.x + shX, yHi + 2.18, b.z + zc + sz*0.30, P.trim, false);
        bBox(shW, 2.1, 0.22, b.x + shX, yHi + 1.05, b.z + zc - sz*(strip/2 + 0.24), P.trim, true);
        bBox(shW, 2.1, 0.22, b.x + shX, yHi + 1.05, b.z + sz*(zR - 0.12), P.trim, true);
        bBox(0.22, 2.1, strip + 0.7, b.x + (xd > 0 ? o1 + 0.2 : o0 - 0.2), yHi + 1.05, b.z + zc, P.trim, true);
      } else {
        slabTop(-wi/2, wi/2, sz > 0 ? -di/2 : -di/2 + strip, sz > 0 ? di/2 - strip : di/2, yHi - 0.11, 0.22, 0x90959b);
        slabTop(-wi/2, o0, sz > 0 ? di/2 - strip : -di/2, sz > 0 ? di/2 : -di/2 + strip, yHi - 0.11, 0.22, 0x90959b);
        slabTop(o1, wi/2, sz > 0 ? di/2 - strip : -di/2, sz > 0 ? di/2 : -di/2 + strip, yHi - 0.11, 0.22, 0x90959b);
      }
    }
  }
}
buildings.forEach((b,i) => makeBuilding(b,i));

// farm silos
for(const s of silos){
  const y = baseHeight(s.x, s.z);
  const body = new THREE.CylinderGeometry(2.2, 2.2, 7, 10);
  body.translate(s.x, y+3.5, s.z);
  bGeo(body, 0xb9bdc2);
  const cap = new THREE.ConeGeometry(2.35, 1.6, 10);
  cap.translate(s.x, y+7.8, s.z);
  bGeo(cap, 0x8a4438);
  bBox(0.3, 6.4, 0.16, s.x+2.25, y+3.2, s.z, 0x6f755f, false);   // ladder rail
  solidCyls.push({ x:s.x, z:s.z, r:2.3, y0:y-0.5, y1:y+7.2, kind:'wall' });
  coverSpots.push({ x:s.x+3.2, z:s.z }, { x:s.x-3.2, z:s.z });
}
// hilltop watchtowers
for(const tw of towers){
  const y = baseHeight(tw.x, tw.z);
  for(const sx of [-1,1]) for(const sz of [-1,1]){
    bBox(0.32, 5.6, 0.32, tw.x+sx*1.3, y+2.8, tw.z+sz*1.3, 0x5c4a36, true);
  }
  bBox(3.6, 0.28, 3.6, tw.x, y+5.6, tw.z, 0x6e5b41, true);        // platform
  for(const [ox, oz, w, d] of [[0,1.7,3.6,0.14],[0,-1.7,3.6,0.14],[1.7,0,0.14,3.6],[-1.7,0,0.14,3.6]]){
    bBox(w, 0.85, d, tw.x+ox, y+6.15, tw.z+oz, 0x5c4a36, false);  // railings
  }
  const cone = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
  cone.rotateY(Math.PI/4);
  cone.scale(4.4, 1.7, 4.4);
  bldGeoms.push(xform(tintGeo(cone, 0x525a62), tw.x, y+8.1, tw.z, 0));
  coverSpots.push({ x:tw.x+2.4, z:tw.z+2.4 });
}
// ---------------- landmarks: lighthouse, radio mast, wind farm, fuel station, farm props ----------------
const windRotors = [];
{
  // lighthouse on the southeast cape — red/white bands, gallery and lamp room
  const lx = 1585, lz = -1230, ly = heightAt(lx, lz);
  for(let k = 0; k < 5; k++){
    const r = 2.15 - k*0.14;
    const seg = new THREE.CylinderGeometry(r - 0.07, r, 3.2, 12);
    seg.translate(lx, ly + 1.2 + k*3.2 + 1.6, lz);
    bGeo(seg, k % 2 ? 0xb43a30 : 0xe8e4da);
  }
  bGeo(new THREE.CylinderGeometry(2.1, 2.1, 0.3, 12).translate(lx, ly + 17.5, lz), 0x3a3f45);   // gallery
  bBox(2.2, 1.7, 2.2, lx, ly + 18.5, lz, 0x27343f, false);                                       // lamp room
  bGeo(new THREE.ConeGeometry(1.8, 1.3, 10).translate(lx, ly + 20.0, lz), 0xb43a30);
  bGeo(new THREE.CylinderGeometry(2.9, 3.3, 1.4, 12).translate(lx, ly + 0.5, lz), 0x9a948a);     // plinth
  solidCyls.push({ x: lx, z: lz, r: 2.5, y0: ly - 1, y1: ly + 17, kind: 'wall' });
  coverSpots.push({ x: lx + 3.6, z: lz }, { x: lx - 3.6, z: lz });

  // radio mast high on the eastern massif — red/white segments, dishes, guy blocks
  const mx = 1120, mzz = -240, my = heightAt(mx, mzz);
  for(let k = 0; k < 5; k++){
    bBox(0.62 - k*0.09, 6.0, 0.62 - k*0.09, mx, my + k*6 + 3, mzz, k % 2 ? 0xc7423a : 0xe6e2d8, false);
    if(k < 4) bBox(1.5 - k*0.2, 0.14, 1.5 - k*0.2, mx, my + k*6 + 6, mzz, 0x4a5057, false);     // platforms
  }
  bGeo(new THREE.CylinderGeometry(0.9, 0.9, 0.35, 10).rotateX(Math.PI/2).translate(mx + 0.9, my + 21, mzz), 0xd8dcdf);
  bGeo(new THREE.CylinderGeometry(0.7, 0.7, 0.3, 10).rotateZ(Math.PI/2).translate(mx - 0.8, my + 15, mzz), 0xd8dcdf);
  bBox(2.6, 2.2, 2.2, mx + 2.4, my + 1.1, mzz + 1.8, 0x757a70, true);                            // equipment hut
  solidCyls.push({ x: mx, z: mzz, r: 0.9, y0: my - 1, y1: my + 30, kind: 'wall' });

  // wind farm on the open northern hills — towers merged, rotors spin in the game loop
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe9ecef, flatShading: true, roughness: 0.5 });
  for(const [tx, tz] of [[-140, 840], [-40, 905], [60, 850]]){
    const ty = heightAt(tx, tz), hub = 22;
    const tower = new THREE.CylinderGeometry(0.55, 1.05, hub, 10);
    tower.translate(tx, ty + hub/2, tz);
    bGeo(tower, 0xe3e6e9);
    bBox(1.5, 1.3, 2.4, tx, ty + hub + 0.2, tz, 0xd6dade, false);                                // nacelle
    const yaw = randRange(0, Math.PI*2);
    const rotor = new THREE.Object3D();
    rotor.position.set(tx + Math.sin(yaw)*1.5, ty + hub + 0.2, tz + Math.cos(yaw)*1.5);
    rotor.rotation.y = yaw;
    const spin = new THREE.Object3D();
    const blades = [];
    for(let bi = 0; bi < 3; bi++){
      const bl = new THREE.BoxGeometry(0.34, 8.2, 0.10);
      bl.translate(0, 4.1, 0);
      bl.rotateZ(bi * Math.PI*2/3);
      blades.push(tintGeo(bl, 0xffffff));
    }
    const bladeMesh = new THREE.Mesh(mergeGeoms(blades), new THREE.MeshStandardMaterial({ vertexColors:true, flatShading:true, roughness:0.5 }));
    bladeMesh.castShadow = true;
    spin.add(bladeMesh);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 8), bladeMat);
    nose.rotation.x = Math.PI/2; nose.position.z = 0.5;
    spin.add(nose);
    rotor.add(spin);
    scene.add(rotor);
    windRotors.push(spin);
    spin.rotation.z = randRange(0, Math.PI*2);
    solidCyls.push({ x: tx, z: tz, r: 1.1, y0: ty - 1, y1: ty + hub, kind: 'wall' });
    coverSpots.push({ x: tx + 2.2, z: tz + 2.2 });
  }

  // fuel station on Oakfield main street — canopy on posts, two pumps, kiosk
  const fx = 15, fz = -14, fyy = heightAt(fx, fz);
  bBox(7.5, 0.32, 5.6, fx, fyy + 3.6, fz, 0xd8d3c8, false);                                      // canopy
  bBox(7.7, 0.5, 5.8, fx, fyy + 3.95, fz, 0xb43a30, false);                                      // fascia band
  for(const [px2, pz2] of [[fx - 2.6, fz - 1.6], [fx - 2.6, fz + 1.6], [fx + 2.6, fz - 1.6], [fx + 2.6, fz + 1.6]]){
    bBox(0.22, 3.5, 0.22, px2, fyy + 1.75, pz2, 0x8b8578, true);
  }
  for(const pz2 of [fz - 1.1, fz + 1.1]){
    bBox(0.55, 1.15, 0.42, fx, fyy + 0.58, pz2, 0xc7423a, false);
    bBox(0.45, 0.35, 0.34, fx, fyy + 1.32, pz2, 0x2c3036, false);
    solidCyls.push({ x: fx, z: pz2, r: 0.45, y0: fyy - 0.5, y1: fyy + 1.4, kind: 'wall' });
  }
  bBox(3.2, 2.6, 2.6, fx + 5.6, fyy + 1.3, fz + 0.4, 0xbdb7aa, true);                            // kiosk
  bBox(3.4, 0.3, 2.8, fx + 5.6, fyy + 2.75, fz + 0.4, 0x5a6570, false);
  coverSpots.push({ x: fx - 4.5, z: fz }, { x: fx + 7.8, z: fz });

  // hay bales at the farms
  for(const [hx, hz] of [[247, 240], [-312, -308], [703, 128], [-1448, -318], [232, 258], [-1456, -298]]){
    const hy = heightAt(hx, hz);
    const bale = new THREE.CylinderGeometry(0.85, 0.85, 1.5, 10);
    bale.rotateZ(Math.PI/2);
    bale.rotateY(randRange(0, Math.PI));
    bale.translate(hx, hy + 0.85, hz);
    bGeo(bale, 0xc9a955);
    solidCyls.push({ x: hx, z: hz, r: 0.95, y0: hy - 0.5, y1: hy + 1.6, kind: 'rock' });
    coverSpots.push({ x: hx + 1.8, z: hz + 1.4 });
  }

  // power poles along the two main paved routes out of Oakfield
  const poleRuns = [
    [[0, 30], [-120, 100]], [[-120, 100], [-220, 180]],
    [[0, -40], [110, -130]], [[110, -130], [210, -218]],
  ];
  for(const [[ax2, az2], [bx2, bz2]] of poleRuns){
    const len = Math.hypot(bx2 - ax2, bz2 - az2), n = Math.floor(len/36);
    const nx2 = (bz2 - az2)/len, nz2 = -(bx2 - ax2)/len;                 // road normal: poles on the shoulder
    for(let k = 1; k <= n; k++){
      const t = k/(n + 1);
      const px2 = lerp(ax2, bx2, t) + nx2*5.6, pz2 = lerp(az2, bz2, t) + nz2*5.6;
      const py2 = heightAt(px2, pz2);
      bGeo(new THREE.CylinderGeometry(0.09, 0.12, 7.2, 6).translate(px2, py2 + 3.6, pz2), 0x4d4136);
      bBox(1.7, 0.12, 0.12, px2, py2 + 6.6, pz2, 0x4d4136, false);
      solidCyls.push({ x: px2, z: pz2, r: 0.16, y0: py2 - 0.5, y1: py2 + 7.0, kind: 'tree' });
    }
  }

  // wooden fences around the farm paddocks (low — you can vault them)
  const fences = [
    [218, 232, 262, 232], [264, 232, 264, 272],           // hilltop farm
    [-336, -326, -296, -326],                             // south farm
    [-1470, -332, -1424, -332],                           // west farm
  ];
  for(const [x1, z1, x2, z2] of fences){
    const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
    const len = alongX ? x2 - x1 : z2 - z1;
    const n = Math.floor(Math.abs(len)/2.4);
    for(let k = 0; k <= n; k++){
      const t = n ? k/n : 0;
      const px2 = alongX ? x1 + len*t : x1, pz2 = alongX ? z1 : z1 + len*t;
      bBox(0.14, 1.15, 0.14, px2, heightAt(px2, pz2) + 0.57, pz2, 0x6a563e, false);
    }
    const mx2 = (x1 + x2)/2, mz2 = (z1 + z2)/2, my2 = heightAt(mx2, mz2);
    for(const ry of [0.45, 0.95]){
      if(alongX) bBox(Math.abs(len), 0.09, 0.07, mx2, my2 + ry, mz2, 0x7a6448, false);
      else bBox(0.07, 0.09, Math.abs(len), mx2, my2 + ry, mz2, 0x7a6448, false);
    }
    if(alongX) colliders.push({ minX: Math.min(x1,x2), maxX: Math.max(x1,x2), minY: my2 - 0.5, maxY: my2 + 1.05, minZ: mz2 - 0.1, maxZ: mz2 + 0.1 });
    else colliders.push({ minX: mx2 - 0.1, maxX: mx2 + 0.1, minY: my2 - 0.5, maxY: my2 + 1.05, minZ: Math.min(z1,z2), maxZ: Math.max(z1,z2) });
  }

  // Novi Port container yard — stacked shipping containers make a cover maze on the quay
  const CBOX = [0xb5432f, 0x2f6cb5, 0x3f8f4a, 0xc9a12e, 0x8a4f9e, 0x9aa0a5];
  const yard = [
    [122, -1034, 0, 0],    [131, -1034, 0, 0.05], [148, -1036, 0, 1.5708], [163, -1030, 0, 0],
    [172, -1030, 0, -0.06],[140, -1046, 0, 1.5708],[180, -1044, 0, 0],     [189, -1044, 0, 0.04],
    [126, -1034, 1, 0.02], [167, -1030, 1, -0.03], [184, -1044, 1, 0.01],
  ];
  let ci2 = 0;
  for(const [cx2, cz2, lvl, ryc] of yard){
    const gy = heightAt(cx2, cz2);
    const cgeo = new THREE.BoxGeometry(6.0, 2.6, 2.55);
    cgeo.rotateY(ryc);
    cgeo.translate(cx2, gy + 1.32 + lvl*2.62, cz2);
    bldGeoms.push(tintGeo(cgeo, CBOX[ci2++ % CBOX.length]));
    const alongX = Math.abs(Math.cos(ryc)) > 0.7;
    const hx2 = alongX ? 3.0 : 1.3, hz2 = alongX ? 1.3 : 3.0;
    // stacked containers block bullets and sight too, not just the ground row
    colliders.push({ minX: cx2-hx2, maxX: cx2+hx2, minY: gy - 0.5 + lvl*3.1, maxY: gy + 2.6 + lvl*2.62,
                     minZ: cz2-hz2, maxZ: cz2+hz2 });
    if(lvl === 0) coverSpots.push({ x: cx2 + (alongX ? 0 : 2.4), z: cz2 + (alongX ? 2.4 : 0) });
  }

  // firing range beside the military depot — backstop, three lanes, range hut
  const rxx = 300, rzz = -180, ry2 = heightAt(rxx, rzz);
  bBox(0.3, 2.2, 14, rxx + 12, ry2 + 1.1, rzz, 0x6a563e, true);
  for(const oz of [-5, 0, 5]){
    bBox(0.18, 1.6, 1.1, rxx + 11.6, ry2 + 1.5, rzz + oz, 0xe6e2d8, false);
    bBox(0.22, 0.5, 0.5, rxx + 11.5, ry2 + 1.5, rzz + oz, 0xb43a30, false);
    bBox(0.5, 1.05, 0.5, rxx - 6, ry2 + 0.52, rzz + oz, 0x6a563e, true);
  }
  bBox(3.0, 2.4, 2.4, rxx - 10, ry2 + 1.2, rzz + 8, 0x757a70, true);
  bBox(3.2, 0.3, 2.6, rxx - 10, ry2 + 2.7, rzz + 8, 0x5a6570, false);
  coverSpots.push({ x: rxx - 8, z: rzz }, { x: rxx + 13.5, z: rzz + 8 });
}
{
  const bmesh = new THREE.Mesh(bakeAO(mergeGeoms(bldGeoms), 2.6, 0.80), MAT_FLAT);
  bmesh.castShadow = true; bmesh.receiveShadow = true;
  scene.add(bmesh);
}
