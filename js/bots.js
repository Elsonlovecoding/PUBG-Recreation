'use strict';
// PUBG Recreation — bots: merged models, AI (hear/hunt/cover/heal/nades), ragdolls, damage

const BOT_NAMES = ['ShroudFan42','xX_Sn1per_Xx','PanBandit','ChickenChaser','NoScope99','CamperJoe',
  'FryingPanda','ZoneRunner','LootGoblin','M416Enjoyer','GhillieBoi','RedZoneRick','ProneStar',
  'BushWookie','CircleKing','DinnerSeeker','PochinkiPete','CrateChaser','Level3Helmet',
  'EnerDrinker','SchoolDropper','GhillieGirl','AFKAndy','BridgeCamper','PanShield','RedDotRandy',
  'CompensatorX','MilBaseMike','FlareGunFred','BoostedBecky','ProneAndAlone','ZigzagZoe',
  'DinnerThief','ScopelessSam','KarKar98','UAZDriver','BuckshotBarb','TheThirdParty','LagSpike'];
const BOT_COUNT = 39;
const SHIRT_COLORS = [0x5a7d9c, 0x9c5a5a, 0x6f8f5a, 0x8f7a4a, 0x7a5a8f, 0x4a8f8a, 0xa06a3a, 0x616a72];
const PANTS_COLORS = [0x3a4148, 0x4a4238, 0x39424a, 0x50483c];
const SKIN_TONES = [0xd9a066, 0xc68a5a, 0x9c6b45, 0xe6b088];
const HAIR_COLORS = [0x2b2118, 0x4a3220, 0x6e5a3a, 0x1c1c1e];
const bots = [];
const waypoints = [];
doorSpots.forEach(d => waypoints.push({x:d.x, z:d.z}));
// cluster plazas + the lake shore
[[0,34],[-260,180],[222,-220],[240,252],[-150,-12],[-320,-318],[336,308],[0,356]].forEach(p => waypoints.push({x:p[0], z:p[1]}));
for(let i=0;i<60;i++){
  const x = randRange(-380,380), z = randRange(-380,380);
  if(!insideBuilding(x,z,2) && heightAt(x,z) > 0) waypoints.push({x,z});
}

// merged five-mesh bots: body+head, two arms, two legs — one material per bot
function bakeGroupGeoms(group, out){
  group.updateMatrixWorld(true);
  group.traverse(o => {
    if(!o.isMesh) return;
    const g2 = o.geometry.clone();
    g2.applyMatrix4(o.matrixWorld);
    out.push(tintGeo(g2, o.material.color.getHex()));
  });
}
function buildBotMesh(i, weapon){
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ vertexColors:true, flatShading:true, roughness:1 });
  const shirt = SHIRT_COLORS[i % SHIRT_COLORS.length];
  const pants = PANTS_COLORS[i % PANTS_COLORS.length];
  const skin  = SKIN_TONES[i % SKIN_TONES.length];
  const hasVest = i % 3 !== 1, hg = i % 4;
  function B(arr, w,h,d, x,y,z, hex){ arr.push(xform(tintGeo(new THREE.BoxGeometry(w,h,d), hex), x,y,z, 0)); }

  // static body: torso, belt, vest, backpack, head, face, headgear
  const body = [];
  B(body, 0.62,0.72,0.34, 0,1.08,0, shirt);
  B(body, 0.64,0.09,0.36, 0,0.76,0, 0x26282c);
  if(hasVest) B(body, 0.68,0.46,0.42, 0,1.16,0, 0x3a4034);
  if(i % 2 === 0) B(body, 0.46,0.52,0.20, 0,1.16,-0.29, 0x6b5a3a);
  B(body, 0.36,0.36,0.36, 0,1.66,0, skin);
  B(body, 0.055,0.05,0.02, -0.085,1.695,0.18, 0x1e1a16);
  B(body, 0.055,0.05,0.02,  0.085,1.695,0.18, 0x1e1a16);
  if(hg === 0)      B(body, 0.42,0.24,0.42, 0,1.81,0, 0x2e3438);                         // lvl-3 helmet
  else if(hg === 1) B(body, 0.42,0.20,0.42, 0,1.83,0, 0xb8bcbe);                          // lvl-1 helmet
  else if(hg === 2){ B(body, 0.40,0.12,0.40, 0,1.88,0, pants); B(body, 0.38,0.05,0.16, 0,1.83,0.26, pants); }
  else              B(body, 0.39,0.12,0.39, 0,1.87,0, HAIR_COLORS[i % HAIR_COLORS.length]);
  const bodyMesh = new THREE.Mesh(mergeGeoms(body), mat);
  bodyMesh.castShadow = true; g.add(bodyMesh);

  // limbs on animation pivots
  function limb(px, py, boxes){
    const pivot = new THREE.Object3D(); pivot.position.set(px, py, 0); g.add(pivot);
    const mesh = new THREE.Mesh(mergeGeoms(boxes), mat);
    mesh.castShadow = true; pivot.add(mesh);
    return pivot;
  }
  const armGeo = (withGun) => {
    const arr = [];
    B(arr, 0.18,0.36,0.18, 0,-0.13,0, shirt);
    B(arr, 0.15,0.32,0.15, 0,-0.44,0, skin);
    if(withGun){
      const gun = buildGunModel(weapon, false);
      gun.rotation.y = Math.PI;
      gun.position.set(-0.02,-0.52,0.22);
      bakeGroupGeoms(gun, arr);
    }
    return arr;
  };
  const legGeo = () => {
    const arr = [];
    B(arr, 0.20,0.60,0.20, 0,-0.30,0, pants);
    B(arr, 0.22,0.16,0.24, 0,-0.66,0.01, 0x2a2622);
    return arr;
  };
  const armL = limb(-0.40, 1.38, armGeo(false));
  const armR = limb( 0.40, 1.38, armGeo(true));
  const legL = limb(-0.16, 0.74, legGeo());
  const legR = limb( 0.16, 0.74, legGeo());
  g.scale.setScalar(randRange(0.95, 1.06));
  return { g, armL, armR, legL, legR, mats: [mat],
           armor: (hasVest ? 50 : 0) + (hg === 0 ? 40 : hg === 1 ? 25 : 0) };
}

for(let i=0;i<BOT_COUNT;i++){
  const weapon = Math.random() < 0.72 ? 'rifle' : (Math.random() < 0.5 ? 'shotgun' : 'sniper');
  const parts = buildBotMesh(i, weapon);
  const bot = {
    group: parts.g, armL: parts.armL, armR: parts.armR, legL: parts.legL, legR: parts.legR,
    mats: parts.mats,
    name: BOT_NAMES[i], hp: 100, armor: parts.armor, alive: true, active: true,
    weapon,
    medkits: Math.floor(Math.random()*3), frags: (i % 5 === 0) ? 2 : 0, grenCd: randRange(4, 10),
    healT: 0,
    state: 'wander', dest: null, idle: randRange(0,2),
    target: null, thinkT: Math.random()*0.3, burst: 0, burstPause: randRange(0.5,1.5),
    shootT: 0, coverT: 0, walkPhase: Math.random()*6,
    speed: randRange(4.0,5.0), dead: false, deathT: 0, fallAxis: null, yaw: randRange(0,Math.PI*2),
    threat: null, threatT: 0,
    landing: null, dropY: 0, chute: null,     // plane-drop state, driven by drop.js
  };
  // preferred landing spot (used by the plane drop; also the fallback ground spawn)
  let x, z, guard = 0;
  do {
    const a = randRange(0,Math.PI*2), r = randRange(90,430);
    x = Math.cos(a)*r; z = Math.sin(a)*r; guard++;
  } while((insideBuilding(x,z,3) || heightAt(x,z) < 0.3) && guard < 150);
  bot.landing = { x, z };
  bot.group.position.set(x, groundAt(x,z), z);
  scene.add(bot.group);
  bots.push(bot);
}

// nearby bots hear gunfire and come to investigate
function reportGunshot(x, z, shooter){
  for(const b of bots){
    if(!b.alive || !b.active || b === shooter) continue;
    const d = Math.hypot(b.group.position.x - x, b.group.position.z - z);
    if(d < 55 && d > 4 && !b.target && Math.random() < 0.75){
      b.threat = { x, z };
      b.threatT = 6;
    }
  }
  // the player "hears" via SFX distance attenuation already
}

function botEye(b){ return { x:b.group.position.x, y:b.group.position.y+1.62, z:b.group.position.z }; }
function pickWaypoint(b){
  const w = waypoints[Math.floor(Math.random()*waypoints.length)];
  b.dest = { x: w.x + randRange(-2,2), z: w.z + randRange(-2,2) };
}
function visibleEnemies(b){
  const out = [], e = botEye(b);
  const consider = (px,py,pz, ref) => {
    const dx=px-e.x, dz=pz-e.z, d2=dx*dx+dz*dz;
    if(d2 > 80*80) return;
    if(hasLOS(e.x,e.y,e.z, px,py+1.3,pz)) out.push({ ref, d2 });
  };
  if(player.alive && gameState.playing && player.dropState === 'none') consider(player.pos.x, player.pos.y, player.pos.z, 'player');
  for(const o of bots) if(o !== b && o.alive && o.active) consider(o.group.position.x, o.group.position.y, o.group.position.z, o);
  out.sort((a,bb) => a.d2 - bb.d2);
  return out;
}
function zoneSafeSpot(){
  // aim inside whichever circle is coming next
  return zone.state === 'shrink' ? { cx: zone.tcx, cz: zone.tcz, r: zone.tr }
                                 : { cx: zone.cx,  cz: zone.cz,  r: zone.r };
}
function botThink(b){
  const enemies = visibleEnemies(b);
  const p = b.group.position;
  // zone pressure — pathing predicts the NEXT circle, not just the current one
  const zs = zoneSafeSpot();
  const outsideZone = Math.hypot(p.x - zs.cx, p.z - zs.cz) > zs.r - 6;
  if(outsideZone){
    const a = Math.atan2(zs.cz - p.z, zs.cx - p.x) + randRange(-0.4,0.4);
    const runTo = Math.max(10, zs.r * 0.55);
    b.dest = { x: zs.cx - Math.cos(a)*randRange(0,runTo), z: zs.cz - Math.sin(a)*randRange(0,runTo) };
    b.state = 'wander';
    b.target = enemies.length ? enemies[0].ref : null;
    return;
  }
  // opportunistic crate grab
  for(const c of crates){
    if(c.taken) continue;
    const d = Math.hypot(c.group.position.x - p.x, c.group.position.z - p.z);
    if(d < 2.4){
      if(c.loot === 'medkit' && b.medkits < 2){ b.medkits++; c.taken = true; scene.remove(c.group); }
      else if(c.loot === 'armor' && b.armor < 60){ b.armor = Math.min(100, b.armor + 60); c.taken = true; scene.remove(c.group); }
      else if(c.loot === 'frag' && b.frags < 2){ b.frags++; c.taken = true; scene.remove(c.group); }
    }
  }
  if(enemies.length){
    b.target = enemies[0].ref;
    if(b.hp < 45 && b.state !== 'cover'){
      // fall back to nearest cover corner away from the threat
      const tp = b.target === 'player' ? player.pos : b.target.group.position;
      let best = null, bestScore = -1e9;
      for(const c of coverSpots){
        const dSelf = Math.hypot(c.x-p.x, c.z-p.z);
        if(dSelf > 55) continue;
        const dThreat = Math.hypot(c.x-tp.x, c.z-tp.z);
        const score = dThreat - dSelf*1.4;
        if(score > bestScore){ bestScore = score; best = c; }
      }
      if(best){ b.state = 'cover'; b.coverT = randRange(3.5,6); b.dest = { x:best.x, z:best.z }; return; }
    }
    if(b.state !== 'cover'){
      b.state = 'engage';
      const tp = b.target === 'player' ? player.pos : b.target.group.position;
      const d = Math.hypot(tp.x-p.x, tp.z-p.z);
      if(d > 45) b.dest = { x: tp.x + randRange(-6,6), z: tp.z + randRange(-6,6) };
      else if(d < 9) b.dest = { x: p.x + (p.x-tp.x)*0.8 + randRange(-3,3), z: p.z + (p.z-tp.z)*0.8 + randRange(-3,3) };
      else if(Math.random() < 0.4) b.dest = { x: p.x + randRange(-7,7), z: p.z + randRange(-7,7) };  // strafe
      else b.dest = null;                                                                            // stand & shoot
    }
  } else {
    b.target = null;
    if(b.state === 'engage') b.state = 'wander';
    if(b.threatT > 0){
      // someone we can't see is shooting — grenade the spot or push it
      const d = Math.hypot(b.threat.x - p.x, b.threat.z - p.z);
      if(b.frags > 0 && b.grenCd <= 0 && d > 10 && d < 32){
        botThrowGrenade(b, b.threat.x, b.threat.z);
      } else if(!b.dest){
        b.dest = { x: b.threat.x + randRange(-6,6), z: b.threat.z + randRange(-6,6) };
        b.state = 'wander';
      }
    }
    if(b.state === 'wander' && !b.dest && b.idle <= 0) pickWaypoint(b);
  }
}
function botThrowGrenade(b, tx, tz){
  b.frags--; b.grenCd = 14;
  const e = botEye(b);
  spawnGrenadeArc(e.x, e.y, e.z, tx, tz, 'frag', b.name);
}
function botShoot(b){
  const W = WEAPONS[b.weapon];
  const e = botEye(b);
  const tp = b.target === 'player'
    ? { x:player.pos.x, y:player.pos.y+1.25, z:player.pos.z }
    : { x:b.target.group.position.x, y:b.target.group.position.y+1.2, z:b.target.group.position.z };
  const dx=tp.x-e.x, dy=tp.y-e.y, dz=tp.z-e.z;
  const dist = Math.sqrt(dx*dx+dy*dy+dz*dz);
  const spread = 0.024 + dist*0.00038 + (b.dest ? 0.016 : 0);
  const d = new THREE.Vector3(dx/dist + randRange(-spread,spread), dy/dist + randRange(-spread,spread), dz/dist + randRange(-spread,spread)).normalize();
  const muzzle = { x: e.x + d.x*0.6, y: e.y - 0.25, z: e.z + d.z*0.6 };
  const hit = castShot(new THREE.Vector3(muzzle.x, muzzle.y, muzzle.z), d, 160, b);
  spawnTracer(muzzle.x, muzzle.y, muzzle.z, hit.x, hit.y, hit.z, 0xff8a5c);
  if(hit.kind !== 'none') impactFX(hit);
  burstSparks(muzzle.x, muzzle.y, muzzle.z, 0xffd27a, 2, 2);
  // player hears the shot, panned by direction
  const pdx = muzzle.x - player.pos.x, pdz = muzzle.z - player.pos.z;
  const pd = Math.hypot(pdx, pdz);
  const fwdx = -Math.sin(player.yaw), fwdz = -Math.cos(player.yaw);
  const panv = pd > 1 ? (pdx*fwdz - pdz*fwdx) / pd : 0;   // cross product = left/right
  SFX.shot(b.weapon, pd, panv);
  reportGunshot(muzzle.x, muzzle.z, b);
  if(hit.kind === 'player') damagePlayer(W.botDmg + randRange(-2,2), b.name);
  else if(hit.kind === 'bot') damageBot(hit.bot, W.botDmg + randRange(-2,3), b.name, b);
  else if(hit.kind === 'vehicle' && hit.vehicle) damageVehicle(hit.vehicle, W.botDmg, b.name);
}
function updateBot(b, dt){
  const p = b.group.position;
  if(b.dead){
    b.deathT += dt;
    const fall = Math.min(1, b.deathT / 0.55);
    const ease = 1 - (1-fall)*(1-fall);
    b.group.rotation.x = b.fallAxis.x * ease * Math.PI/2;
    b.group.rotation.z = b.fallAxis.z * ease * Math.PI/2;
    b.group.position.y = groundAt(p.x,p.z) + 0.28*ease;
    b.armL.rotation.x = ease * b.fallAxis.f1; b.armR.rotation.x = ease * b.fallAxis.f2;
    b.legL.rotation.x = ease * b.fallAxis.f3; b.legR.rotation.x = ease * b.fallAxis.f4;
    if(b.deathT > 1.1){
      const o = Math.max(0, 1 - (b.deathT-1.1)/1.5);
      for(const m of b.mats){ m.transparent = true; m.opacity = o; }
      if(o <= 0){ scene.remove(b.group); b.gone = true; }
    }
    return;
  }
  if(!b.active) return;                       // still riding or descending from the plane
  b.thinkT -= dt;
  b.threatT -= dt;
  b.grenCd -= dt;
  if(b.thinkT <= 0){ botThink(b); b.thinkT = 0.20 + Math.random()*0.08; }

  // movement
  let moveSpeed = 0;
  if(b.dest){
    const dx = b.dest.x - p.x, dz = b.dest.z - p.z;
    const d = Math.hypot(dx,dz);
    if(d < 1.2){
      b.dest = null;
      b.idle = b.state === 'cover' ? b.coverT : randRange(0.8,2.8);
    } else {
      const desiredYaw = Math.atan2(dx,dz);
      let dy2 = desiredYaw - b.yaw;
      while(dy2 > Math.PI) dy2 -= Math.PI*2; while(dy2 < -Math.PI) dy2 += Math.PI*2;
      b.yaw += clamp(dy2, -3.2*dt, 3.2*dt);
      moveSpeed = b.state === 'engage' ? b.speed*0.85 : b.speed;
      p.x += Math.sin(b.yaw) * moveSpeed * dt;
      p.z += Math.cos(b.yaw) * moveSpeed * dt;
      resolveCollisions(p, 0.42, 1.5);
      p.x = clamp(p.x, -HALF+4, HALF-4); p.z = clamp(p.z, -HALF+4, HALF-4);
      p.y = groundAt(p.x, p.z);
    }
  } else {
    b.idle -= dt;
    if(b.state === 'cover'){
      b.coverT -= dt;
      // patch up with a medkit behind cover
      if(!b.target && b.hp < 60 && b.medkits > 0){
        b.healT += dt;
        if(b.healT > 3.5){ b.healT = 0; b.medkits--; b.hp = Math.min(100, b.hp + 70); }
      } else if(b.target) b.healT = 0;
      if(b.coverT <= 0) b.state = 'wander';
    }
    p.y = groundAt(p.x, p.z);
  }

  // face target while engaging
  if(b.target && (b.target === 'player' ? player.alive : b.target.alive)){
    const tp = b.target === 'player' ? player.pos : b.target.group.position;
    const desiredYaw = Math.atan2(tp.x-p.x, tp.z-p.z);
    let dy2 = desiredYaw - b.yaw;
    while(dy2 > Math.PI) dy2 -= Math.PI*2; while(dy2 < -Math.PI) dy2 += Math.PI*2;
    b.yaw += clamp(dy2, -5*dt, 5*dt);
    // burst fire
    b.shootT -= dt;
    if(Math.abs(dy2) < 0.25 && b.shootT <= 0){
      if(b.burst > 0){
        const e = botEye(b);
        const tpp = b.target === 'player' ? player.pos : b.target.group.position;
        if(hasLOS(e.x,e.y,e.z, tpp.x, tpp.y+1.3, tpp.z)) botShoot(b);
        b.burst--;
        b.shootT = b.weapon === 'rifle' ? 0.13 : (b.weapon === 'shotgun' ? 0.75 : 1.2);
      } else {
        b.burstPause -= dt;
        if(b.burstPause <= 0){
          b.burst = b.weapon === 'rifle' ? 4 + Math.floor(Math.random()*3) : 1;
          b.burstPause = randRange(1.0, 2.1);
        }
      }
    }
  } else if(b.target) b.target = null;
  b.group.rotation.y = b.yaw;

  // walk animation
  if(moveSpeed > 0.1){
    b.walkPhase += dt * moveSpeed * 2.4;
    const s = Math.sin(b.walkPhase);
    b.legL.rotation.x = s * 0.62; b.legR.rotation.x = -s * 0.62;
    if(b.target){ b.armR.rotation.x = -1.25; b.armL.rotation.x = -0.9 + s*0.1; }
    else { b.armL.rotation.x = -s * 0.5; b.armR.rotation.x = s * 0.5; }
    b.group.position.y += Math.abs(Math.sin(b.walkPhase)) * 0.05;
  } else {
    const t0 = performance.now()*0.001 + b.walkPhase;
    b.legL.rotation.x = lerp(b.legL.rotation.x, 0, dt*8);
    b.legR.rotation.x = lerp(b.legR.rotation.x, 0, dt*8);
    if(b.target){ b.armR.rotation.x = -1.25; b.armL.rotation.x = -0.9; }
    else { b.armL.rotation.x = Math.sin(t0*1.4)*0.06; b.armR.rotation.x = -Math.sin(t0*1.4)*0.06; }
  }
}

// ---------------- damage / kills ----------------
const gameState = { playing:false, over:false, startedAt:0 };
function aliveBotCount(){ let n=0; for(const b of bots) if(b.alive) n++; return n; }
function absorb(dmg, wearer){
  // armor soaks 70% of incoming damage while it lasts
  if(wearer.armor > 0){
    const soaked = Math.min(wearer.armor, dmg * 0.7);
    wearer.armor -= soaked;
    return dmg - soaked;
  }
  return dmg;
}
function damageBot(bot, dmg, killerName, attacker){
  if(!bot.alive || !bot.active) return;
  bot.hp -= absorb(dmg, bot);
  if(killerName === 'You') showHitmarker();
  if(attacker){
    const ap = attacker === 'player' ? player.pos : attacker.group.position;
    bot.threat = { x: ap.x, z: ap.z };
    bot.threatT = 7;
  }
  const p = bot.group.position;
  burstSparks(p.x, p.y+1.2, p.z, 0xffca7a, 4, 3);
  if(bot.hp <= 0){
    bot.alive = false; bot.dead = true; bot.deathT = 0;
    const a = randRange(0, Math.PI*2);
    bot.fallAxis = { x: Math.cos(a)*0.9, z: Math.sin(a)*0.9,
      f1: randRange(-1.5,1.5), f2: randRange(-1.5,1.5), f3: randRange(-0.8,0.8), f4: randRange(-0.8,0.8) };
    if(killerName === 'You'){ player.kills++; updateKillsHUD(); SFX.kill(); }
    addKillFeed(killerName, bot.name);
    updateAliveHUD();
    checkVictory();
  }
}
function damagePlayer(dmg, killerName){
  if(!player.alive || !gameState.playing) return;
  player.hp -= absorb(dmg, player);
  flashVignette();
  SFX.hurt();
  updateHealthHUD(); updateArmorHUD();
  if(player.hp <= 0){
    player.hp = 0; player.alive = false;
    addKillFeed(killerName, 'You');
    endGame(false, killerName);
  }
}
function checkVictory(){
  if(gameState.over) return;
  if(player.alive && aliveBotCount() === 0) endGame(true, null);
}
