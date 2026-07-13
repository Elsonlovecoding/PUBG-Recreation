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

// horizon mountains ring (outside playable map, mostly silhouettes in the fog)
{
  const mg = [];
  for(let i=0;i<36;i++){
    const a = (i/36)*Math.PI*2 + randRange(-0.10,0.10);
    const rad = randRange(2480, 3060);
    const w = randRange(220,380), h = randRange(150,440);
    const mx = Math.cos(a)*rad, mz = Math.sin(a)*rad;
    if(Math.hypot(mx, mz + 2900) < w + 70) continue;          // keep clear of the lobby hangar
    const col = new THREE.Color().setHSL(0.33+randRange(-0.04,0.07), 0.26, 0.33+randRange(-0.05,0.06));
    mg.push(xform(tintGeo(new THREE.ConeGeometry(w, h, 5+Math.floor(Math.random()*3)), col.getHex()),
      mx, h/2-6, mz, randRange(0,Math.PI)));
  }
  const m = new THREE.Mesh(mergeGeoms(mg), MAT_FLAT);
  scene.add(m);
}
// clouds
const clouds = new THREE.Mesh((()=> {
  const cg = [];
  for(let i=0;i<64;i++){
    const cx = randRange(-1930,1930), cz = randRange(-1930,1930), cy = randRange(180,300);
    const puffs = 3+Math.floor(Math.random()*3);
    for(let k=0;k<puffs;k++){
      cg.push(xform(tintGeo(new THREE.IcosahedronGeometry(randRange(10,19),0), 0xffffff),
        cx+randRange(-16,16), cy+randRange(-2,4), cz+randRange(-10,10), randRange(0,Math.PI),
        1.3, 0.55, 1.05));
    }
  }
  return mergeGeoms(cg);
})(), new THREE.MeshBasicMaterial({ vertexColors:true, transparent:true, opacity:0.88 }));
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

// ---------------- trees (4400), rocks (800), grass tufts (8200) ----------------
const treeSpots = [];
{
  const tg = [];
  let placed = 0, guard = 0;
  while(placed < 4400 && guard++ < 240000){
    const x = randRange(-1930,1930), z = randRange(-1930,1930);
    if(!goodScatterSpot(x,z,0.03,4.5) || slopeAt(x,z) > 0.62) continue;
    const y = heightAt(x,z);
    if(y < -0.6 || y > 76) continue;                          // no beach/lake trees, none above the treeline
    const s = randRange(0.85,1.7), ry = randRange(0,Math.PI*2);
    const leaf = new THREE.Color().setHSL(0.29+randRange(-0.035,0.045), 0.42+randRange(-0.06,0.06), 0.32+randRange(-0.05,0.05));
    tg.push(xform(tintGeo(new THREE.CylinderGeometry(0.16,0.30,1.7,6), 0x6b4a2f), x, y+0.85*s, z, ry, s));
    tg.push(xform(tintGeo(new THREE.ConeGeometry(1.55,2.9,7), leaf.getHex()), x, y+(1.7+1.3)*s, z, ry, s));
    tg.push(xform(tintGeo(new THREE.ConeGeometry(1.12,2.2,7), leaf.getHex(), 1.12), x, y+(1.7+2.6)*s, z, ry, s));
    treeSpots.push({x,z,r:0.55*s});
    solidCyls.push({ x, z, r: 0.30*s + 0.06, y0: y - 0.5, y1: y + 1.9*s, kind:'tree' });
    foliageBalls.push({ x, y: y + 3.5*s, z, r: 1.35*s });
    if(placed % 5 === 0){
      const ca = randRange(0, Math.PI*2);
      coverSpots.push({ x: x + Math.cos(ca)*1.7, z: z + Math.sin(ca)*1.7 });
    }
    placed++;
  }
  const trees = new THREE.Mesh(bakeAO(mergeGeoms(tg), 2.2, 0.80), MAT_FLAT);
  trees.castShadow = true; trees.receiveShadow = true;
  scene.add(trees);
}
{
  const rg = [];
  let placed = 0, guard = 0;
  while(placed < 800 && guard++ < 90000){
    const x = randRange(-1930,1930), z = randRange(-1930,1930);
    if(!goodScatterSpot(x,z,0.05,3)) continue;
    const y = heightAt(x,z), r = randRange(0.5,1.9);
    const g = new THREE.IcosahedronGeometry(r, 0);
    const p = g.attributes.position;
    for(let i=0;i<p.count;i++){                                // deform for irregular boulders
      p.setXYZ(i, p.getX(i)*randRange(0.78,1.28), p.getY(i)*randRange(0.62,1.15), p.getZ(i)*randRange(0.78,1.28));
    }
    const grey = new THREE.Color().setHSL(0.08+randRange(0,0.04), 0.06, 0.42+randRange(-0.06,0.08));
    rg.push(xform(tintGeo(g, grey.getHex()), x, y+r*0.28, z, randRange(0,Math.PI*2)));
    if(r > 0.7) solidCyls.push({ x, z, r: r*0.8, y0: y - 1.0, y1: y + r*0.9, kind:'rock' });
    if(r > 1.3) coverSpots.push({ x: x + randRange(-2.2,2.2), z: z + randRange(-2.2,2.2) });
    placed++;
  }
  const rocks = new THREE.Mesh(bakeAO(mergeGeoms(rg), 1.3, 0.85), MAT_FLAT);
  rocks.castShadow = true; rocks.receiveShadow = true;
  scene.add(rocks);
}
{
  const gg = [];
  let placed = 0, guard = 0;
  while(placed < 8200 && guard++ < 170000){
    const x = randRange(-1930,1930), z = randRange(-1930,1930);
    if(!goodScatterSpot(x,z,0.04,2)) continue;
    const y = heightAt(x,z);
    if(y < -0.4 || y > 70) continue;                          // no tufts on beaches or the high slopes
    const gcol = new THREE.Color().setHSL(0.21+randRange(-0.03,0.05), 0.46, 0.40+randRange(-0.05,0.07));
    const s = randRange(0.7,1.5);
    gg.push(xform(tintGeo(new THREE.ConeGeometry(0.30,0.6,4), gcol.getHex()), x, y+0.28*s, z, randRange(0,Math.PI), s));
    placed++;
  }
  scene.add(new THREE.Mesh(mergeGeoms(gg), MAT_FLAT));  // tufts don't cast shadows (perf)
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
  const style = b.style || (b.flat || idx % 3 === 2 ? 'flat' : 'house');
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
    } else if(style === 'apartment' && side.s === stairSide){
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
  if(style === 'apartment'){
    // real second storey: interior slab + outside staircase to the balcony door
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
    floors.push({ minX:bx-balW/2, maxX:bx+balW/2, minZ:bz-balD/2, maxZ:bz+balD/2, top:slabY+0.10 });
    // straight staircase running along the wall
    const alongDir = ss.ax === 'x' ? [1,0] : [0,1];
    const steps = 8;
    for(let i=0;i<steps;i++){
      const frac = (i+1)/steps;
      const sy = fy + 0.34 + (slabY - fy - 0.4) * (1 - frac) + 0.2;
      const sx = bx + alongDir[0]*(bw/2 + 0.35 + i*0.62);
      const sz = bz + alongDir[1]*(bw/2 + 0.35 + i*0.62);
      const stw = ss.ax === 'x' ? 0.72 : 1.3, std = ss.ax === 'x' ? 1.3 : 0.72;
      bBox(stw, 0.18, std, sx, sy, sz, 0x6e5b41, false);
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
    const pH = style === 'tower' ? 0.9 : 0.55;                    // towers get a taller parapet
    if(style !== 'tower')                                         // tower roof is built with its stairwell opening below
      bBox(b.w+1.3, 0.3, b.d+1.3, b.x, fy+H+0.15, b.z, P.roof, false);
    bBox(b.w+1.3, pH, 0.3, b.x, fy+H+0.3+pH/2, b.z-(b.d+1.0)/2, P.roof, false);
    bBox(b.w+1.3, pH, 0.3, b.x, fy+H+0.3+pH/2, b.z+(b.d+1.0)/2, P.roof, false);
    bBox(0.3, pH, b.d+1.3, b.x-(b.w+1.0)/2, fy+H+0.3+pH/2, b.z, P.roof, false);
    bBox(0.3, pH, b.d+1.3, b.x+(b.w+1.0)/2, fy+H+0.3+pH/2, b.z, P.roof, false);
    if(style === 'tower'){
      bBox(1.5, 1.0, 1.5, b.x + b.w*0.26, fy+H+0.8, b.z - b.d*0.22, P.roof, false);   // rooftop service unit
    }
  } else if(style === 'shed'){
    const ang = Math.atan2(1.1, b.d);
    const g = new THREE.BoxGeometry(b.w+1.7, 0.22, (b.d+1.9)/Math.cos(ang));
    g.rotateX(ang);
    g.translate(b.x, fy+H+0.45, b.z);
    bGeo(g, P.roof);
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
        bBox(0.80, 0.15, chW, b.x + sx2, ty - 0.075, b.z + zc, 0x6f757c, false);
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
{
  const bmesh = new THREE.Mesh(bakeAO(mergeGeoms(bldGeoms), 2.6, 0.80), MAT_FLAT);
  bmesh.castShadow = true; bmesh.receiveShadow = true;
  scene.add(bmesh);
}
