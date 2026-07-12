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
    fogNear:  { value: 95 }, fogFar: { value: 560 },
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
    '  col = mix(col, fogColor, smoothstep(fogNear, fogFar, vDist));',
    '  gl_FragColor = vec4(col, 0.94);',
    '}'
  ].join('\n')
});
const water = new THREE.Mesh(new THREE.PlaneGeometry(3600, 3600, 96, 96), waterMat);
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
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
function xform(g, x,y,z, ry, sx,sy,sz){
  tmpM.compose(new THREE.Vector3(x,y,z), tmpQ.setFromEuler(tmpE.set(0,ry||0,0)),
    new THREE.Vector3(sx||1, sy||sx||1, sz||sx||1));
  g.applyMatrix4(tmpM); return g;
}

// horizon mountains ring (outside playable map, mostly silhouettes in the fog)
{
  const mg = [];
  for(let i=0;i<24;i++){
    const a = (i/24)*Math.PI*2 + randRange(-0.10,0.10);
    const rad = randRange(640, 820);
    const w = randRange(70,140), h = randRange(60,170);
    const col = new THREE.Color().setHSL(0.33+randRange(-0.04,0.07), 0.26, 0.33+randRange(-0.05,0.06));
    mg.push(xform(tintGeo(new THREE.ConeGeometry(w, h, 5+Math.floor(Math.random()*3)), col.getHex()),
      Math.cos(a)*rad, h/2-6, Math.sin(a)*rad, randRange(0,Math.PI)));
  }
  const m = new THREE.Mesh(mergeGeoms(mg), MAT_FLAT);
  scene.add(m);
}
// clouds
const clouds = new THREE.Mesh((()=> {
  const cg = [];
  for(let i=0;i<20;i++){
    const cx = randRange(-480,480), cz = randRange(-480,480), cy = randRange(140,210);
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
  if(Math.max(Math.abs(x),Math.abs(z)) > 465) return false;
  if(insideBuilding(x, z, bldPad)) return false;
  if(roadFactorGen(x,z) > roadPad) return false;
  return true;
}

// ---------------- trees (140), rocks (50), grass tufts (650) ----------------
const treeSpots = [];
{
  const tg = [];
  let placed = 0, guard = 0;
  while(placed < 560 && guard++ < 24000){
    const x = randRange(-465,465), z = randRange(-465,465);
    if(!goodScatterSpot(x,z,0.03,4.5) || slopeAt(x,z) > 0.62) continue;
    if(heightAt(x,z) < -0.6) continue;                        // not on beaches or in the lake
    const y = heightAt(x,z), s = randRange(0.85,1.7), ry = randRange(0,Math.PI*2);
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
  const trees = new THREE.Mesh(mergeGeoms(tg), MAT_FLAT);
  trees.castShadow = true; trees.receiveShadow = true;
  scene.add(trees);
}
{
  const rg = [];
  let placed = 0, guard = 0;
  while(placed < 140 && guard++ < 12000){
    const x = randRange(-465,465), z = randRange(-465,465);
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
  const rocks = new THREE.Mesh(mergeGeoms(rg), MAT_FLAT);
  rocks.castShadow = true; rocks.receiveShadow = true;
  scene.add(rocks);
}
{
  const gg = [];
  let placed = 0, guard = 0;
  while(placed < 2000 && guard++ < 30000){
    const x = randRange(-465,465), z = randRange(-465,465);
    if(!goodScatterSpot(x,z,0.04,2) || heightAt(x,z) < -0.4) continue;
    const y = heightAt(x,z);
    const gcol = new THREE.Color().setHSL(0.21+randRange(-0.03,0.05), 0.46, 0.40+randRange(-0.05,0.07));
    const s = randRange(0.7,1.5);
    gg.push(xform(tintGeo(new THREE.ConeGeometry(0.30,0.6,4), gcol.getHex()), x, y+0.28*s, z, randRange(0,Math.PI), s));
    placed++;
  }
  scene.add(new THREE.Mesh(mergeGeoms(gg), MAT_FLAT));  // tufts don't cast shadows (perf)
}

// ---------------- buildings: composed boxes, walkable doors, windows, roofs ----------------
const PALETTES = [
  { wall:0xcfc3a8, trim:0x8d8069, roof:0x8a4438 },
  { wall:0xb06a4a, trim:0x7d4a35, roof:0x5c5852 },
  { wall:0x9aa08c, trim:0x6f755f, roof:0x6b4a38 },
  { wall:0x8f7355, trim:0x66513a, roof:0x525a62 },
];
const bldGeoms = [];
function bBox(w,h,d, x,y,z, color, collide){
  bldGeoms.push(xform(tintGeo(new THREE.BoxGeometry(w,h,d), color), x, y, z, 0));
  if(collide) colliders.push({ minX:x-w/2, maxX:x+w/2, minY:y-h/2, maxY:y+h/2, minZ:z-d/2, maxZ:z+d/2 });
}
function makeBuilding(b, idx){
  const P = PALETTES[idx % PALETTES.length];
  const y0 = b.baseH, t = 0.36, H = b.h;
  const doorW = 1.8, doorH = 2.55;

  // foundation pad + interior floor
  bBox(b.w+1.6, 0.34, b.d+1.6, b.x, y0+0.17, b.z, 0xb3ada0, false);
  floors.push({ minX:b.x-(b.w+1.6)/2, maxX:b.x+(b.w+1.6)/2, minZ:b.z-(b.d+1.6)/2, maxZ:b.z+(b.d+1.6)/2, top:y0+0.34 });
  const fy = y0 + 0.34;           // floor top
  const wy = fy + H/2;            // wall center height

  // walls: door wall gets split segments, others get windows
  const sides = [
    { s:'N', len:b.w, cx:b.x, cz:b.z+b.d/2, ax:'x' },
    { s:'S', len:b.w, cx:b.x, cz:b.z-b.d/2, ax:'x' },
    { s:'E', len:b.d, cx:b.x+b.w/2, cz:b.z, ax:'z' },
    { s:'W', len:b.d, cx:b.x-b.w/2, cz:b.z, ax:'z' },
  ];
  for(const side of sides){
    const isDoor = side.s === b.door;
    const along = side.ax;                 // axis the wall runs along
    if(isDoor){
      const seg = (side.len - doorW)/2;
      if(along==='x'){
        bBox(seg, H, t, side.cx-(doorW/2+seg/2), wy, side.cz, P.wall, true);
        bBox(seg, H, t, side.cx+(doorW/2+seg/2), wy, side.cz, P.wall, true);
        bBox(doorW, H-doorH, t, side.cx, fy+doorH+(H-doorH)/2, side.cz, P.wall, true);
        bBox(doorW+0.5, 0.18, t+0.16, side.cx, fy+doorH+0.02, side.cz, P.trim, false);
        bBox(0.2, doorH, t+0.16, side.cx-doorW/2-0.08, fy+doorH/2, side.cz, P.trim, false);
        bBox(0.2, doorH, t+0.16, side.cx+doorW/2+0.08, fy+doorH/2, side.cz, P.trim, false);
      } else {
        bBox(t, H, seg, side.cx, wy, side.cz-(doorW/2+seg/2), P.wall, true);
        bBox(t, H, seg, side.cx, wy, side.cz+(doorW/2+seg/2), P.wall, true);
        bBox(t, H-doorH, doorW, side.cx, fy+doorH+(H-doorH)/2, side.cz, P.wall, true);
        bBox(t+0.16, 0.18, doorW+0.5, side.cx, fy+doorH+0.02, side.cz, P.trim, false);
        bBox(t+0.16, doorH, 0.2, side.cx, fy+doorH/2, side.cz-doorW/2-0.08, P.trim, false);
        bBox(t+0.16, doorH, 0.2, side.cx, fy+doorH/2, side.cz+doorW/2+0.08, P.trim, false);
      }
      const dir = side.s==='N'?[0,1] : side.s==='S'?[0,-1] : side.s==='E'?[1,0] : [-1,0];
      doorSpots.push({ x: side.cx + dir[0]*2.6, z: side.cz + dir[1]*2.6 });
    } else {
      if(along==='x') bBox(side.len, H, t, side.cx, wy, side.cz, P.wall, true);
      else            bBox(t, H, side.len, side.cx, wy, side.cz, P.wall, true);
      // windows: frame + dark glass poking through both faces
      const nWin = side.len >= 9 ? 2 : 1;
      for(let wi=0; wi<nWin; wi++){
        const off = nWin===1 ? 0 : (wi===0?-1:1)*side.len*0.22;
        const wyy = fy + 1.65;
        if(along==='x'){
          bBox(1.7, 1.5, t+0.14, side.cx+off, wyy, side.cz, P.trim, false);
          bBox(1.4, 1.2, t+0.22, side.cx+off, wyy, side.cz, 0x27343f, false);
        } else {
          bBox(t+0.14, 1.5, 1.7, side.cx, wyy, side.cz+off, P.trim, false);
          bBox(t+0.22, 1.2, 1.4, side.cx, wyy, side.cz+off, 0x27343f, false);
        }
      }
    }
  }
  // corner posts
  for(const sx of [-1,1]) for(const sz of [-1,1]){
    bBox(0.5, H, 0.5, b.x+sx*b.w/2, wy, b.z+sz*b.d/2, P.trim, false);
    coverSpots.push({ x:b.x+sx*(b.w/2+1.3), z:b.z+sz*(b.d/2+1.3) });
  }
  // roof: pyramid hip roof or flat parapet roof for variety
  if(b.flat || idx % 3 === 2){
    bBox(b.w+1.3, 0.3, b.d+1.3, b.x, fy+H+0.15, b.z, P.roof, false);
    bBox(b.w+1.3, 0.55, 0.3, b.x, fy+H+0.55, b.z-(b.d+1.0)/2, P.roof, false);
    bBox(b.w+1.3, 0.55, 0.3, b.x, fy+H+0.55, b.z+(b.d+1.0)/2, P.roof, false);
    bBox(0.3, 0.55, b.d+1.3, b.x-(b.w+1.0)/2, fy+H+0.55, b.z, P.roof, false);
    bBox(0.3, 0.55, b.d+1.3, b.x+(b.w+1.0)/2, fy+H+0.55, b.z, P.roof, false);
  } else {
    const roofH = 2.1 + b.w*0.09;
    const cone = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
    cone.rotateY(Math.PI/4);
    cone.scale(b.w+1.9, roofH, b.d+1.9);
    bldGeoms.push(xform(tintGeo(cone, P.roof), b.x, fy+H+roofH/2, b.z, 0));
    bBox(0.7, 1.5, 0.7, b.x+b.w*0.28, fy+H+roofH*0.55, b.z, P.trim, false);   // chimney
  }
}
buildings.forEach((b,i) => makeBuilding(b,i));
{
  const bmesh = new THREE.Mesh(mergeGeoms(bldGeoms), MAT_FLAT);
  bmesh.castShadow = true; bmesh.receiveShadow = true;
  scene.add(bmesh);
}
