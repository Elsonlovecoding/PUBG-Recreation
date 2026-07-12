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
// castShot: returns nearest hit {t, x,y,z, kind:'terrain'|'wall'|'bot'|'player', bot}
function castShot(o, d, maxT, ignoreActor){
  let bestT = maxT, kind = 'none', hitBot = null;
  const tt = terrainRayT(o.x,o.y,o.z, d.x,d.y,d.z, maxT);
  if(tt > 0 && tt < bestT){ bestT = tt; kind = 'terrain'; }
  for(const c of colliders){
    const t = rayVsAABB(o.x,o.y,o.z, d.x,d.y,d.z, c, bestT);
    if(t >= 0 && t < bestT){ bestT = t; kind = 'wall'; }
  }
  for(const bot of bots){
    if(!bot.alive || bot === ignoreActor) continue;
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
  return { t:bestT, x:o.x+d.x*bestT, y:o.y+d.y*bestT, z:o.z+d.z*bestT, kind, bot:hitBot };
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
  return true;
}

// ---------------- weapons ----------------
const WEAPONS = {
  rifle:   { name:'RIFLE',   dmg:22, botDmg:11, rpm:520, spread:0.014, pellets:1, mag:30, reload:1.8, auto:true,  kick:0.045, tracer:0xffd27a },
  shotgun: { name:'SHOTGUN', dmg:11, botDmg:8,  rpm:75,  spread:0.052, pellets:8, mag:6,  reload:2.4, auto:false, kick:0.16,  tracer:0xffb35c },
  sniper:  { name:'SNIPER',  dmg:85, botDmg:38, rpm:42,  spread:0.02,  pellets:1, mag:5,  reload:2.7, auto:false, kick:0.24,  tracer:0xaad4ff },
};

// ---------------- loot crates ----------------
const crates = [];
const CRATE_LOOT = ['shotgun','medkit','sniper','rifle','medkit','shotgun','medkit','sniper','rifle','medkit'];
const ITEM_COLOR = { rifle:0xf2a900, shotgun:0xd8552a, sniper:0x5ca8e8, medkit:0xe8e8e8 };
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
  const icon = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.3,0.3),
    new THREE.MeshBasicMaterial({ color: ITEM_COLOR[loot] }));
  icon.position.y = 1.35; g.add(icon);
  if(loot === 'medkit'){
    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.34,0.1,0.12), new THREE.MeshBasicMaterial({color:0xd83030}));
    cross1.position.y = 1.35; g.add(cross1);
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.34,0.12), new THREE.MeshBasicMaterial({color:0xd83030}));
    cross2.position.y = 1.35; g.add(cross2);
  }
  const cx = b.x + randRange(-b.w*0.18, b.w*0.18), cz = b.z + randRange(-b.d*0.18, b.d*0.18);
  g.position.set(cx, groundAt(cx,cz), cz);
  g.rotation.y = randRange(0, Math.PI);
  scene.add(g);
  crates.push({ group:g, icon, loot, taken:false });
});
