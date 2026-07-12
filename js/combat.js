'use strict';
// PUBG Recreation — hitscan raycasting, weapon stats, loot crates

// ---------------- raycasting: bullets vs walls / terrain / actors ----------------
function rayVsAABB(ox,oy,oz, dx,dy,dz, b, maxT){
  let tmin = 0, tmax = maxT;
  const axes = [[ox,dx,b.minX,b.maxX],[oy,dy,b.minY,b.maxY],[oz,dz,b.minZ,b.maxZ]];
  for(const [o,d,mn,mx] of axes){
    if(Math.abs(d) < 1e-8){ if(o < mn || o > mx) return -1; }
    else {
      let t1 = (mn-o)/d, t2 = (mx-o)/d;
      if(t1 > t2){ const tt=t1; t1=t2; t2=tt; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if(tmin > tmax) return -1;
    }
  }
  return tmin;
}
function terrainRayT(ox,oy,oz, dx,dy,dz, maxT){
  const step = 1.6;
  let prev = oy - groundAt(ox,oz);
  for(let t=step; t<=maxT; t+=step){
    const x=ox+dx*t, y=oy+dy*t, z=oz+dz*t;
    const dh = y - groundAt(x,z);
    if(dh < 0){
      const t0 = t-step, f = prev/(prev-dh);        // linear refine
      return t0 + step*f;
    }
    prev = dh;
  }
  return -1;
}
function rayVsCylXZ(ox, oz, dx, dz, cx, cz, r, maxT){
  const a = dx*dx + dz*dz;
  if(a < 1e-9) return -1;
  const fx = ox - cx, fz = oz - cz;
  const b = 2*(fx*dx + fz*dz), c = fx*fx + fz*fz - r*r;
  const disc = b*b - 4*a*c;
  if(disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2*a);
  return (t > 0 && t < maxT) ? t : -1;
}
function raySphere(ox,oy,oz, dx,dy,dz, cx,cy,cz, r, maxT){
  const fx = ox-cx, fy = oy-cy, fz = oz-cz;
  const b = 2*(fx*dx + fy*dy + fz*dz), c = fx*fx + fy*fy + fz*fz - r*r;
  const disc = b*b - 4*c;
  if(disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / 2;
  return (t > 0 && t < maxT) ? t : -1;
}
// castShot: returns nearest hit {t, x,y,z, kind:'terrain'|'wall'|'tree'|'rock'|'bot'|'player', bot}
function castShot(o, d, maxT, ignoreActor){
  let bestT = maxT, kind = 'none', hitBot = null;
  const tt = terrainRayT(o.x,o.y,o.z, d.x,d.y,d.z, maxT);
  if(tt > 0 && tt < bestT){ bestT = tt; kind = 'terrain'; }
  for(const c of colliders){
    const t = rayVsAABB(o.x,o.y,o.z, d.x,d.y,d.z, c, bestT);
    if(t >= 0 && t < bestT){ bestT = t; kind = 'wall'; }
  }
  let hitVeh = null;
  for(const c of solidCyls){
    const t = rayVsCylXZ(o.x, o.z, d.x, d.z, c.x, c.z, c.r, bestT);
    if(t >= 0){
      const y = o.y + d.y * t;
      if(y > c.y0 && y < c.y1){ bestT = t; kind = c.kind; hitBot = null; hitVeh = c.ref || null; }
    }
  }
  for(const bot of bots){
    if(!bot.alive || !bot.active || bot === ignoreActor) continue;
    const p = bot.group.position;
    const box = { minX:p.x-0.45, maxX:p.x+0.45, minY:p.y, maxY:p.y+1.85, minZ:p.z-0.45, maxZ:p.z+0.45 };
    const t = rayVsAABB(o.x,o.y,o.z, d.x,d.y,d.z, box, bestT);
    if(t >= 0 && t < bestT){ bestT = t; kind = 'bot'; hitBot = bot; }
  }
  if(ignoreActor !== 'player' && player.alive){
    const p = player.pos;
    const box = { minX:p.x-0.42, maxX:p.x+0.42, minY:p.y, maxY:p.y+1.78, minZ:p.z-0.42, maxZ:p.z+0.42 };
    const t = rayVsAABB(o.x,o.y,o.z, d.x,d.y,d.z, box, bestT);
    if(t >= 0 && t < bestT){ bestT = t; kind = 'player'; }
  }
  return { t:bestT, x:o.x+d.x*bestT, y:o.y+d.y*bestT, z:o.z+d.z*bestT, kind, bot:hitBot, vehicle:hitVeh };
}
function hasLOS(ax,ay,az, bx,by,bz){
  const dx=bx-ax, dy=by-ay, dz=bz-az;
  const dist = Math.sqrt(dx*dx+dy*dy+dz*dz);
  if(dist < 0.001) return true;
  const d = { x:dx/dist, y:dy/dist, z:dz/dist };
  if(terrainRayT(ax,ay,az, d.x,d.y,d.z, dist-0.6) > 0) return false;
  for(const c of colliders){
    const t = rayVsAABB(ax,ay,az, d.x,d.y,d.z, c, dist-0.4);
    if(t >= 0) return false;
  }
  for(const c of solidCyls){
    const t = rayVsCylXZ(ax, az, d.x, d.z, c.x, c.z, c.r, dist-0.5);
    if(t >= 0){
      const y = ay + d.y*t;
      if(y > c.y0 && y < c.y1) return false;
    }
  }
  for(const f of foliageBalls){
    if(raySphere(ax,ay,az, d.x,d.y,d.z, f.x,f.y,f.z, f.r, dist-0.5) >= 0) return false;
  }
  return true;
}

// ---------------- weapons ----------------
const WEAPONS = {
  rifle:   { name:'RIFLE',   dmg:22, botDmg:13, rpm:520, spread:0.014, pellets:1, mag:30, reload:1.8, auto:true,  kick:0.045, tracer:0xffd27a, range:280 },
  shotgun: { name:'SHOTGUN', dmg:11, botDmg:10, rpm:75,  spread:0.052, pellets:8, mag:6,  reload:2.4, auto:false, kick:0.16,  tracer:0xffb35c, range:70 },
  sniper:  { name:'SNIPER',  dmg:85, botDmg:44, rpm:42,  spread:0.02,  pellets:1, mag:5,  reload:2.7, auto:false, kick:0.24,  tracer:0xaad4ff, range:520 },
};

// ---------------- gun viewmodels ----------------
const GUNMETAL = 0x26282c, WOOD = 0x4e3520, SCOPE = 0x1a1c20;
function gunPart(g, geo, hex, x,y,z, rx,ry,rz){
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color:hex, flatShading:true, roughness:0.85, metalness:0.15 }));
  m.position.set(x,y,z);
  if(rx||ry||rz) m.rotation.set(rx||0, ry||0, rz||0);
  g.add(m); return m;
}
function buildGunModel(type, viewmodel){
  const g = new THREE.Group();
  if(type === 'rifle'){
    gunPart(g, new THREE.BoxGeometry(0.07,0.09,0.52), GUNMETAL, 0,0,-0.20);            // receiver
    gunPart(g, new THREE.CylinderGeometry(0.020,0.020,0.42,7), GUNMETAL, 0,0.012,-0.62, Math.PI/2,0,0); // barrel
    gunPart(g, new THREE.BoxGeometry(0.05,0.05,0.09), GUNMETAL, 0,0.012,-0.85);        // muzzle
    gunPart(g, new THREE.BoxGeometry(0.065,0.16,0.07), GUNMETAL, 0,-0.11,-0.16, 0.28); // magazine
    gunPart(g, new THREE.BoxGeometry(0.055,0.11,0.05), WOOD, 0,-0.09,0.05, 0.15);      // grip
    gunPart(g, new THREE.BoxGeometry(0.06,0.10,0.26), WOOD, 0,-0.02,0.20);             // stock
    gunPart(g, new THREE.BoxGeometry(0.05,0.045,0.20), WOOD, 0,-0.005,-0.48);          // handguard
    gunPart(g, new THREE.BoxGeometry(0.014,0.045,0.02), GUNMETAL, 0,0.065,-0.42);      // front sight
    gunPart(g, new THREE.BoxGeometry(0.04,0.035,0.05), GUNMETAL, 0,0.06,-0.02);        // rear sight
    g.userData.muzzle = new THREE.Vector3(0, 0.012, -0.90);
  } else if(type === 'shotgun'){
    gunPart(g, new THREE.BoxGeometry(0.075,0.095,0.42), GUNMETAL, 0,0,-0.12);
    gunPart(g, new THREE.CylinderGeometry(0.030,0.030,0.55,8), GUNMETAL, 0,0.02,-0.58, Math.PI/2,0,0);
    gunPart(g, new THREE.CylinderGeometry(0.022,0.022,0.50,7), GUNMETAL, 0,-0.028,-0.55, Math.PI/2,0,0); // tube
    gunPart(g, new THREE.BoxGeometry(0.07,0.06,0.16), WOOD, 0,-0.028,-0.44);           // pump
    gunPart(g, new THREE.BoxGeometry(0.06,0.11,0.30), WOOD, 0,-0.03,0.20, 0.1);        // stock
    gunPart(g, new THREE.BoxGeometry(0.014,0.04,0.02), GUNMETAL, 0,0.075,-0.80);
    g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.88);
  } else {
    gunPart(g, new THREE.BoxGeometry(0.07,0.09,0.55), GUNMETAL, 0,0,-0.15);
    gunPart(g, new THREE.CylinderGeometry(0.019,0.019,0.72,7), GUNMETAL, 0,0.012,-0.78, Math.PI/2,0,0);
    gunPart(g, new THREE.BoxGeometry(0.05,0.05,0.10), GUNMETAL, 0,0.012,-1.10);        // brake
    gunPart(g, new THREE.CylinderGeometry(0.035,0.035,0.20,8), SCOPE, 0,0.085,-0.10, Math.PI/2,0,0); // scope
    gunPart(g, new THREE.CylinderGeometry(0.042,0.042,0.03,8), SCOPE, 0,0.085,-0.22, Math.PI/2,0,0);
    gunPart(g, new THREE.BoxGeometry(0.065,0.13,0.07), GUNMETAL, 0,-0.10,-0.05, 0.25); // mag
    gunPart(g, new THREE.BoxGeometry(0.06,0.11,0.30), WOOD, 0,-0.025,0.22, 0.08);      // stock
    g.userData.muzzle = new THREE.Vector3(0, 0.012, -1.16);
  }
  if(viewmodel) g.traverse(o => { o.frustumCulled = false; });
  return g;
}
function makeMedkitModel(){
  const g = new THREE.Group();
  const caseM = new THREE.MeshStandardMaterial({ color:0xf2f2ee, flatShading:true, roughness:0.8 });
  const redM  = new THREE.MeshStandardMaterial({ color:0xd23026, flatShading:true, roughness:0.8 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.30, 0.34), caseM); g.add(box);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.36), redM); g.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.36), redM); g.add(crossH);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.08), redM);
  handle.position.y = 0.19; g.add(handle);
  return g;
}

function makeGrenadeModel(){
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color:0x3d4a35, flatShading:true, roughness:0.9 });
  const metal = new THREE.MeshStandardMaterial({ color:0x8a8f94, flatShading:true, roughness:0.6 });
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), body); g.add(m);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 6), metal);
  top.position.y = 0.18; g.add(top);
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.16, 0.05), metal);
  lever.position.set(0.05, 0.12, 0); lever.rotation.z = -0.35; g.add(lever);
  return g;
}
function makeSmokeModel(){
  const g = new THREE.Group();
  const can = new THREE.MeshStandardMaterial({ color:0x707a80, flatShading:true, roughness:0.7 });
  const band = new THREE.MeshStandardMaterial({ color:0xd8d8d8, flatShading:true, roughness:0.7 });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.34, 8), can); g.add(m);
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.06, 8), band);
  b.position.y = 0.09; g.add(b);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 6), band);
  top.position.y = 0.20; g.add(top);
  return g;
}
function makeArmorModel(){
  const g = new THREE.Group();
  const kevlar = new THREE.MeshStandardMaterial({ color:0x39414a, flatShading:true, roughness:0.9 });
  const strap = new THREE.MeshStandardMaterial({ color:0x23282e, flatShading:true, roughness:0.9 });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.16), kevlar); g.add(plate);
  for(const sx of [-1, 1]){
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.16, 0.20), strap);
    s.position.set(sx*0.14, 0.32, 0); g.add(s);
  }
  const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.16, 0.06), strap);
  pouch.position.set(0, -0.08, 0.11); g.add(pouch);
  return g;
}

// ---------------- loot crates ----------------
const crates = [];
const CRATE_LOOT = ['shotgun','medkit','armor','sniper','frag','rifle','medkit','smoke','armor','medkit','frag','sniper','armor','medkit','rifle','smoke'];
buildings.forEach((b, i) => {
  const loot = CRATE_LOOT[i % CRATE_LOOT.length];
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color:0x8a5c34, flatShading:true, roughness:1 });
  const dark = new THREE.MeshStandardMaterial({ color:0x5e3d22, flatShading:true, roughness:1 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.95,0.8,0.95), wood);
  box.position.y = 0.4; box.castShadow = true;
  g.add(box);
  for(const [ex,ez] of [[-0.44,0],[0.44,0],[0,-0.44],[0,0.44]]){
    const strip = new THREE.Mesh(new THREE.BoxGeometry(ex?0.1:1.0, 0.84, ez?0.1:1.0), dark);
    strip.position.set(ex, 0.4, ez); g.add(strip);
  }
  let icon;
  if(loot === 'medkit') icon = makeMedkitModel();
  else if(loot === 'frag'){ icon = makeGrenadeModel(); icon.scale.setScalar(1.6); }
  else if(loot === 'smoke'){ icon = makeSmokeModel(); icon.scale.setScalar(1.5); }
  else if(loot === 'armor') icon = makeArmorModel();
  else { icon = buildGunModel(loot, false); icon.scale.setScalar(0.85); }   // miniature of the weapon
  icon.position.y = 1.35; g.add(icon);
  const cx = b.x + randRange(-b.w*0.18, b.w*0.18), cz = b.z + randRange(-b.d*0.18, b.d*0.18);
  g.position.set(cx, groundAt(cx,cz), cz);
  g.rotation.y = randRange(0, Math.PI);
  scene.add(g);
  crates.push({ group:g, icon, loot, taken:false });
});
