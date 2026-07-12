'use strict';
// PUBG Recreation — humanoid bots: AI, animation, ragdolls, damage + kills

// ---------------- bots ----------------
const BOT_NAMES = ['ShroudFan42','xX_Sn1per_Xx','PanBandit','ChickenChaser','NoScope99','CamperJoe',
  'FryingPanda','ZoneRunner','LootGoblin','M416Enjoyer','GhillieBoi','RedZoneRick','ProneStar',
  'BushWookie','CircleKing','DinnerSeeker'];
const SHIRT_COLORS = [0x5a7d9c, 0x9c5a5a, 0x6f8f5a, 0x8f7a4a, 0x7a5a8f, 0x4a8f8a, 0xa06a3a, 0x616a72];
const PANTS_COLORS = [0x3a4148, 0x4a4238, 0x39424a, 0x50483c];
const SKIN = 0xd9a066;
const bots = [];
const waypoints = [];
doorSpots.forEach(d => waypoints.push({x:d.x, z:d.z}));
waypoints.push({x:0, z:34});                         // village plaza
for(let i=0;i<26;i++){
  const x = randRange(-160,160), z = randRange(-160,160);
  if(!insideBuilding(x,z,2)) waypoints.push({x,z});
}

function buildBotMesh(shirtHex, pantsHex){
  const g = new THREE.Group();
  const mats = [];
  function M(hex){ const m = new THREE.MeshStandardMaterial({ color:hex, flatShading:true, roughness:1 }); mats.push(m); return m; }
  function part(geo, mat, x,y,z, parent){
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x,y,z); mesh.castShadow = true;
    (parent||g).add(mesh); return mesh;
  }
  const shirt = M(shirtHex), pants = M(pantsHex), skin = M(SKIN), dark = M(0x26282c);
  part(new THREE.BoxGeometry(0.62,0.72,0.34), shirt, 0,1.08,0);                 // torso
  const headM = part(new THREE.BoxGeometry(0.36,0.36,0.36), skin, 0,1.66,0);    // head
  part(new THREE.BoxGeometry(0.40,0.12,0.40), M(PANTS_COLORS[Math.floor(Math.random()*4)]), 0,0.22,0, headM); // cap
  const armL = new THREE.Object3D(); armL.position.set(-0.40,1.38,0); g.add(armL);
  const armR = new THREE.Object3D(); armR.position.set( 0.40,1.38,0); g.add(armR);
  part(new THREE.BoxGeometry(0.17,0.62,0.17), shirt, 0,-0.26,0, armL);
  part(new THREE.BoxGeometry(0.17,0.62,0.17), shirt, 0,-0.26,0, armR);
  part(new THREE.BoxGeometry(0.13,0.14,0.13), skin, 0,-0.60,0, armL);
  part(new THREE.BoxGeometry(0.13,0.14,0.13), skin, 0,-0.60,0, armR);
  const legL = new THREE.Object3D(); legL.position.set(-0.16,0.74,0); g.add(legL);
  const legR = new THREE.Object3D(); legR.position.set( 0.16,0.74,0); g.add(legR);
  part(new THREE.BoxGeometry(0.20,0.74,0.20), pants, 0,-0.37,0, legL);
  part(new THREE.BoxGeometry(0.20,0.74,0.20), pants, 0,-0.37,0, legR);
  part(new THREE.BoxGeometry(0.09,0.11,0.62), dark, 0,-0.55,-0.28, armR);       // held gun
  return { g, armL, armR, legL, legR, mats };
}

for(let i=0;i<15;i++){
  const parts = buildBotMesh(
    SHIRT_COLORS[i % SHIRT_COLORS.length],
    PANTS_COLORS[i % PANTS_COLORS.length]);
  const bot = {
    group: parts.g, armL: parts.armL, armR: parts.armR, legL: parts.legL, legR: parts.legR,
    mats: parts.mats,
    name: BOT_NAMES[i], hp: 100, alive: true,
    weapon: Math.random() < 0.72 ? 'rifle' : (Math.random() < 0.5 ? 'shotgun' : 'sniper'),
    state: 'wander', dest: null, idle: randRange(0,2),
    target: null, thinkT: Math.random()*0.3, burst: 0, burstPause: randRange(0.5,1.5),
    shootT: 0, coverT: 0, walkPhase: Math.random()*6,
    speed: randRange(3.8,4.6), dead: false, deathT: 0, fallAxis: null, yaw: randRange(0,Math.PI*2),
  };
  // spawn scattered, away from player spawn & buildings
  let x, z, guard = 0;
  do {
    const a = randRange(0,Math.PI*2), r = randRange(50,190);
    x = Math.cos(a)*r; z = Math.sin(a)*r; guard++;
  } while(insideBuilding(x,z,3) && guard < 60);
  bot.group.position.set(x, groundAt(x,z), z);
  scene.add(bot.group);
  bots.push(bot);
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
    if(d2 > 70*70) return;
    if(hasLOS(e.x,e.y,e.z, px,py+1.3,pz)) out.push({ ref, d2 });
  };
  if(player.alive && gameState.playing) consider(player.pos.x, player.pos.y, player.pos.z, 'player');
  for(const o of bots) if(o !== b && o.alive) consider(o.group.position.x, o.group.position.y, o.group.position.z, o);
  out.sort((a,bb) => a.d2 - bb.d2);
  return out;
}
function botThink(b){
  const enemies = visibleEnemies(b);
  // zone pressure overrides everything
  const p = b.group.position;
  const zdx = p.x - zone.cx, zdz = p.z - zone.cz;
  const outsideZone = Math.hypot(zdx,zdz) > zone.r - 4;
  if(outsideZone){
    const a = Math.atan2(zone.cz - p.z, zone.cx - p.x) + randRange(-0.4,0.4);
    const runTo = Math.max(10, zone.r * 0.55);
    b.dest = { x: zone.cx - Math.cos(a)*randRange(0,runTo), z: zone.cz - Math.sin(a)*randRange(0,runTo) };
    b.state = 'wander';
    b.target = enemies.length ? enemies[0].ref : null;   // may still shoot while running
    return;
  }
  if(enemies.length){
    b.target = enemies[0].ref;
    if(b.hp < 32 && b.state !== 'cover'){
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
      if(best){ b.state = 'cover'; b.coverT = randRange(3,5); b.dest = { x:best.x, z:best.z }; return; }
    }
    if(b.state !== 'cover'){
      b.state = 'engage';
      const tp = b.target === 'player' ? player.pos : b.target.group.position;
      const d = Math.hypot(tp.x-p.x, tp.z-p.z);
      if(d > 38) b.dest = { x: tp.x + randRange(-6,6), z: tp.z + randRange(-6,6) };
      else if(d < 9) b.dest = { x: p.x + (p.x-tp.x)*0.8 + randRange(-3,3), z: p.z + (p.z-tp.z)*0.8 + randRange(-3,3) };
      else if(Math.random() < 0.4) b.dest = { x: p.x + randRange(-7,7), z: p.z + randRange(-7,7) };  // strafe
      else b.dest = null;                                                                            // stand & shoot
    }
  } else {
    b.target = null;
    if(b.state === 'engage') b.state = 'wander';
    if(b.state === 'wander' && !b.dest && b.idle <= 0) pickWaypoint(b);
  }
}
function botShoot(b){
  const W = WEAPONS[b.weapon];
  const e = botEye(b);
  const tp = b.target === 'player'
    ? { x:player.pos.x, y:player.pos.y+1.25, z:player.pos.z }
    : { x:b.target.group.position.x, y:b.target.group.position.y+1.2, z:b.target.group.position.z };
  const dx=tp.x-e.x, dy=tp.y-e.y, dz=tp.z-e.z;
  const dist = Math.sqrt(dx*dx+dy*dy+dz*dz);
  const spread = 0.035 + dist*0.00045 + (b.dest ? 0.02 : 0);
  const d = new THREE.Vector3(dx/dist + randRange(-spread,spread), dy/dist + randRange(-spread,spread), dz/dist + randRange(-spread,spread)).normalize();
  const muzzle = { x: e.x + d.x*0.6, y: e.y - 0.25, z: e.z + d.z*0.6 };
  const hit = castShot(new THREE.Vector3(muzzle.x, muzzle.y, muzzle.z), d, 130, b);
  spawnTracer(muzzle.x, muzzle.y, muzzle.z, hit.x, hit.y, hit.z, 0xff8a5c);
  if(hit.kind !== 'none') impactFX(hit);
  burstSparks(muzzle.x, muzzle.y, muzzle.z, 0xffd27a, 2, 2);
  if(hit.kind === 'player') damagePlayer(W.botDmg + randRange(-2,2), b.name);
  else if(hit.kind === 'bot') damageBot(hit.bot, W.botDmg + randRange(-2,3), b.name);
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
  b.thinkT -= dt;
  if(b.thinkT <= 0){ botThink(b); b.thinkT = 0.28 + Math.random()*0.1; }

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
    if(b.state === 'cover'){ b.coverT -= dt; if(b.coverT <= 0) b.state = 'wander'; }
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
        b.shootT = b.weapon === 'rifle' ? 0.14 : (b.weapon === 'shotgun' ? 0.8 : 1.3);
      } else {
        b.burstPause -= dt;
        if(b.burstPause <= 0){
          b.burst = b.weapon === 'rifle' ? 3 + Math.floor(Math.random()*3) : 1;
          b.burstPause = randRange(1.3, 2.6);
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
function damageBot(bot, dmg, killerName){
  if(!bot.alive) return;
  bot.hp -= dmg;
  if(killerName === 'You') showHitmarker();
  const p = bot.group.position;
  burstSparks(p.x, p.y+1.2, p.z, 0xffca7a, 4, 3);
  if(bot.hp <= 0){
    bot.alive = false; bot.dead = true; bot.deathT = 0;
    const a = randRange(0, Math.PI*2);
    bot.fallAxis = { x: Math.cos(a)*0.9, z: Math.sin(a)*0.9,
      f1: randRange(-1.5,1.5), f2: randRange(-1.5,1.5), f3: randRange(-0.8,0.8), f4: randRange(-0.8,0.8) };
    if(killerName === 'You') player.kills++;
    addKillFeed(killerName, bot.name);
    updateAliveHUD();
    checkVictory();
  }
}
function damagePlayer(dmg, killerName){
  if(!player.alive || !gameState.playing) return;
  player.hp -= dmg;
  flashVignette();
  updateHealthHUD();
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
