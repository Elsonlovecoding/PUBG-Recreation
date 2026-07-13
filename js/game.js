'use strict';
// PUBG Recreation — zone, minimap, HUD, career stats, match flow, main loop

// ---------------- shrinking zone ----------------
const zone = { cx:0, cz:0, r:1430, tcx:0, tcz:0, tr:1430, scx:0, scz:0, sr:1430, phase:0, state:'wait', t:25 };
const ZONE_PHASES = [
  { wait:40, shrink:40, mul:0.54 },
  { wait:28, shrink:30, mul:0.55 },
  { wait:21, shrink:23, mul:0.54 },
  { wait:16, shrink:17, mul:0.50 },
  { wait:12, shrink:12, mul:0.45 },
  { wait:8,  shrink:9,  mul:0.05 },
];
const zoneWallMat = new THREE.ShaderMaterial({
  transparent:true, side:THREE.DoubleSide, depthWrite:false, fog:false,
  uniforms: { color:{ value:new THREE.Color(0x55b0ff) }, time:{ value:0 } },
  vertexShader: [
    'varying vec2 vUv; varying float vH;',
    'void main(){ vUv = uv; vH = position.y + 0.5;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
  ].join('\n'),
  fragmentShader: [
    'uniform vec3 color; uniform float time;',
    'varying vec2 vUv; varying float vH;',
    'void main(){',
    '  float ground = 1.0 - vH;',
    '  float stripes = smoothstep(0.85, 1.0, fract(vUv.x*220.0 + time*0.03)) * 0.5;',
    '  float pulse = 0.9 + 0.1*sin(time*2.2);',
    '  float a = (0.06 + 0.34*ground*ground + stripes*(0.25+0.75*ground)) * pulse;',
    '  gl_FragColor = vec4(color, a);',
    '}'
  ].join('\n')
});
const zoneWall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 96, 1, true), zoneWallMat);
zoneWall.scale.set(zone.r, 380, zone.r);
zoneWall.position.set(0, 180, 0);
zoneWall.renderOrder = 5;
scene.add(zoneWall);
let zoneTick = 0;
function updateZone(dt){
  zone.t -= dt;
  const P = ZONE_PHASES[Math.min(zone.phase, ZONE_PHASES.length-1)];
  if(zone.state === 'wait'){
    if(zone.t <= 0){
      zone.scx = zone.cx; zone.scz = zone.cz; zone.sr = zone.r;
      const nr = Math.max(12, zone.r * P.mul);
      const a = randRange(0, Math.PI*2), off = randRange(0, (zone.r - nr) * 0.8);
      zone.tcx = clamp(zone.cx + Math.cos(a)*off, -1200, 1200);
      zone.tcz = clamp(zone.cz + Math.sin(a)*off, -1200, 1200);
      zone.tr = nr;
      zone.state = 'shrink'; zone.t = P.shrink;
      SFX.zoneSiren();
    }
  } else {
    const f = 1 - clamp(zone.t / P.shrink, 0, 1);
    zone.cx = lerp(zone.scx, zone.tcx, f);
    zone.cz = lerp(zone.scz, zone.tcz, f);
    zone.r  = lerp(zone.sr,  zone.tr,  f);
    if(zone.t <= 0){
      zone.phase = Math.min(zone.phase+1, ZONE_PHASES.length-1);
      zone.state = 'wait'; zone.t = ZONE_PHASES[Math.min(zone.phase, ZONE_PHASES.length-1)].wait;
    }
  }
  zoneWall.scale.set(zone.r, 380, zone.r);
  zoneWall.position.set(zone.cx, 180, zone.cz);
  zoneWallMat.uniforms.time.value = performance.now()*0.001;

  // zone damage in half-second ticks
  zoneTick += dt;
  if(zoneTick >= 0.5){
    zoneTick = 0;
    const dps = 2 + zone.phase * 2.2;
    if(player.alive && Math.hypot(player.pos.x-zone.cx, player.pos.z-zone.cz) > zone.r){
      damagePlayer(dps*0.5, 'THE ZONE');
      SFX.zoneTick();
    }
    for(const b of bots){
      if(b.alive && b.active && Math.hypot(b.group.position.x-zone.cx, b.group.position.z-zone.cz) > zone.r)
        damageBot(b, dps*0.5, 'THE ZONE');
    }
  }

  // zone HUD line — always a countdown
  const zm = document.getElementById('zonemsg');
  const outside = player.alive && Math.hypot(player.pos.x-zone.cx, player.pos.z-zone.cz) > zone.r;
  if(outside){ zm.textContent = '⚠ RETURN TO THE ZONE'; zm.className = 'warn'; }
  else if(zone.state === 'wait'){
    zm.textContent = 'ZONE CLOSES IN ' + Math.max(0, Math.ceil(zone.t)) + 'S';
    zm.className = zone.t < 10 ? 'warn' : '';
  } else {
    zm.textContent = 'ZONE CLOSING — ' + Math.max(0, Math.ceil(zone.t)) + 'S';
    zm.className = 'warn';
  }
}

// ---------------- minimap ----------------
const mapCanvas = document.getElementById('minimap');
const mapCtx = mapCanvas.getContext('2d');
const MAP_S = 190;
const MBG = 252;
const mapBg = document.createElement('canvas');
mapBg.width = MBG; mapBg.height = MBG;
{
  const bctx = mapBg.getContext('2d');
  const img = bctx.createImageData(MBG,MBG);
  for(let py=0; py<MBG; py++){
    for(let px=0; px<MBG; px++){
      const x = (px/(MBG-1))*WORLD - HALF, z = (py/(MBG-1))*WORLD - HALF;
      const h = heightAt(x,z);
      const c = colorFor(x, z, h, slopeAt(x,z));
      const shade = 0.82 + clamp(h*0.012, -0.12, 0.18);
      const i = (py*MBG+px)*4;
      img.data[i]   = clamp(c[0]*shade,0,1)*255;
      img.data[i+1] = clamp(c[1]*shade,0,1)*255;
      img.data[i+2] = clamp(c[2]*shade,0,1)*255;
      img.data[i+3] = 255;
    }
  }
  bctx.putImageData(img,0,0);
  bctx.fillStyle = 'rgba(70,70,75,0.95)';
  for(const b of buildings){
    bctx.fillRect((b.x-b.w/2+HALF)/WORLD*MBG, (b.z-b.d/2+HALF)/WORLD*MBG, b.w/WORLD*MBG+1, b.d/WORLD*MBG+1);
  }
}
function W2M(v){ return (v+HALF)/WORLD*MAP_S; }
function drawMinimap(){
  mapCtx.drawImage(mapBg, 0, 0, MAP_S, MAP_S);
  // darken outside current zone
  mapCtx.save();
  mapCtx.beginPath();
  mapCtx.rect(0,0,MAP_S,MAP_S);
  mapCtx.arc(W2M(zone.cx), W2M(zone.cz), zone.r/WORLD*MAP_S, 0, Math.PI*2, true);
  mapCtx.fillStyle = 'rgba(20,40,80,0.38)';
  mapCtx.fill('evenodd');
  mapCtx.restore();
  mapCtx.strokeStyle = 'rgba(90,170,255,0.95)'; mapCtx.lineWidth = 1.6;
  mapCtx.beginPath(); mapCtx.arc(W2M(zone.cx), W2M(zone.cz), zone.r/WORLD*MAP_S, 0, Math.PI*2); mapCtx.stroke();
  if(zone.state === 'shrink' || zone.tr < zone.r){
    mapCtx.strokeStyle = 'rgba(255,255,255,0.9)'; mapCtx.lineWidth = 1.2;
    mapCtx.beginPath(); mapCtx.arc(W2M(zone.tcx), W2M(zone.tcz), zone.tr/WORLD*MAP_S, 0, Math.PI*2); mapCtx.stroke();
  }
  // plane path + plane while the drop is live
  if(dropActive && plane.visible){
    mapCtx.strokeStyle = 'rgba(255,255,255,0.55)';
    mapCtx.setLineDash([4,4]);
    mapCtx.beginPath();
    mapCtx.moveTo(W2M(dropPath.sx), W2M(dropPath.sz));
    mapCtx.lineTo(W2M(dropPath.ex), W2M(dropPath.ez));
    mapCtx.stroke();
    mapCtx.setLineDash([]);
    const pp = planePos(planeT);
    mapCtx.fillStyle = '#fff';
    mapCtx.beginPath(); mapCtx.arc(W2M(pp.x), W2M(pp.z), 3, 0, Math.PI*2); mapCtx.fill();
  }
  // vehicles
  mapCtx.fillStyle = 'rgba(120,200,255,0.9)';
  for(const v of vehicles){
    if(!v.alive) continue;
    mapCtx.fillRect(W2M(v.group.position.x)-2, W2M(v.group.position.z)-2, 4, 4);
  }
  // bots
  mapCtx.fillStyle = '#e33';
  for(const b of bots){
    if(!b.alive || !b.active) continue;
    mapCtx.beginPath();
    mapCtx.arc(W2M(b.group.position.x), W2M(b.group.position.z), 2.1, 0, Math.PI*2);
    mapCtx.fill();
  }
  // player arrow
  if(player.alive){
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    mapCtx.save();
    mapCtx.translate(W2M(player.pos.x), W2M(player.pos.z));
    mapCtx.rotate(Math.atan2(fz, fx));
    mapCtx.fillStyle = '#fff';
    mapCtx.strokeStyle = 'rgba(0,0,0,0.6)';
    mapCtx.beginPath();
    mapCtx.moveTo(5.5,0); mapCtx.lineTo(-3.5,3.2); mapCtx.lineTo(-3.5,-3.2); mapCtx.closePath();
    mapCtx.fill(); mapCtx.stroke();
    mapCtx.restore();
  }
}

// ---------------- HUD ----------------
let vignetteOp = 0, hitmarkerOp = 0, toastTimer = null;
function updateHealthHUD(){
  const f = document.getElementById('healthfill');
  f.style.width = clamp(player.hp,0,100) + '%';
  f.className = player.hp < 35 ? 'low' : '';
  document.getElementById('hptext').textContent = Math.ceil(player.hp);
}
function updateArmorHUD(){
  // bar = total damage reduction from gear (maxes at 35% with three lvl-3 pieces)
  document.getElementById('armorfill').style.width = (gearReduction(player.gear) / 0.35 * 100) + '%';
}
function updateAmmoHUD(){
  const holdingItem = player.holding !== 'gun';
  if(holdingItem){
    document.getElementById('weaponname').textContent = ITEM_LABELS[player.holding];
    document.getElementById('ammotext').innerHTML = player.items[player.holding] + ' <small>/ ' + ITEM_CAPS[player.holding] + '</small>';
  } else {
    const a = player.owned[player.weapon];
    document.getElementById('weaponname').textContent = WEAPONS[player.weapon].name;
    document.getElementById('ammotext').innerHTML = a.mag + ' <small>/ ' + a.reserve + '</small>';
  }
  let slots = '';
  for(let i=0;i<3;i++){
    const w = slotConfig[i];
    if(!player.owned[w]) continue;
    const active = !holdingItem && w === player.weapon;
    slots += (active ? ' <b>['+(i+1)+'] '+WEAPONS[w].name+'</b>' : ' ['+(i+1)+'] '+WEAPONS[w].name);
  }
  slots += holdingItem ? ' <b>[E] ITEMS</b>' : ' [E] ITEMS';
  document.getElementById('slots').innerHTML = slots;
}
function updateItemsHUD(){
  for(const t of ['medkit','frag','smoke']){
    const card = document.getElementById(t + 'card');
    card.querySelector('.count').textContent = '×' + player.items[t];
    card.className = 'itemcard' + (player.items[t] > 0 ? '' : ' empty');
  }
}
function updateKillsHUD(){
  document.getElementById('kills').innerHTML = player.kills + '<small>KILLS</small>';
}
function updateAliveHUD(){
  const n = aliveBotCount() + (player.alive ? 1 : 0);
  document.getElementById('alive').innerHTML = n + '<small>ALIVE</small>';
}
function addKillFeed(killer, victim){
  const feed = document.getElementById('killfeed');
  const div = document.createElement('div');
  const involvesYou = killer === 'You' || victim === 'You';
  if(involvesYou) div.className = 'you';
  div.textContent = killer + '  ⚔  ' + victim;
  feed.prepend(div);
  while(feed.children.length > 6) feed.removeChild(feed.lastChild);
  setTimeout(() => { if(div.parentNode) div.parentNode.removeChild(div); }, 6000);
}
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.opacity = 1;
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.opacity = 0; }, 1900);
}
function showHitmarker(){ hitmarkerOp = 1; SFX.hit(); }
function flashVignette(op){ vignetteOp = Math.max(vignetteOp, op === undefined ? 0.85 : op); }

// ---------------- career stats ----------------
const matchStats = { fired: 0, hit: 0, damage: 0, t0: 0 };
function loadCareer(){
  try { return JSON.parse(localStorage.getItem('pubgrec_stats')) || {}; }
  catch(e){ return {}; }
}
function saveCareer(c){
  try { localStorage.setItem('pubgrec_stats', JSON.stringify(c)); } catch(e){}
}
function levelInfo(points){
  // level n -> n+1 costs 100 + (n-1)*50 points, so the grind grows each level
  let lv = 1, need = 100, p = Math.max(0, points || 0);
  while(p >= need && lv < 999){ p -= need; lv++; need = 100 + (lv - 1) * 50; }
  return { lv, into: Math.round(p), need };
}
function careerLine(){
  const c = loadCareer();
  if(!c.matches) return 'first drop — good luck';
  return 'career — ' + c.matches + ' matches · ' + (c.wins||0) + ' wins · ' + (c.kills||0) +
         ' kills · best #' + (c.bestPlace || '-');
}

// ---------------- match flow ----------------
let matchStarted = false, paused = false;
const canvasEl = renderer.domElement;
function startMatch(){
  if(matchStarted) return;
  matchStarted = true;
  gameState.playing = true;
  setWeapon(slotConfig[0]);                       // your configured slot-1 gun
  SFX.unlock(); SFX.click();
  matchStats.t0 = clock.elapsedTime;
  document.getElementById('startscreen').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  startDrop();
  updateHealthHUD(); updateArmorHUD(); updateAmmoHUD(); updateAliveHUD(); updateItemsHUD(); updateKillsHUD();
}
window.__start = startMatch;   // dev hook: start match without pointer lock
window.__dev = {               // dev/test hooks
  bots, player, heightAt, solidCyls, crates, vehicles, zone, setThirdPerson,
  tp(x, z, yaw, pitch){ player.pos.set(x, groundAt(x,z), z); player.yaw = yaw||0; player.pitch = pitch||0; },
  skipDrop(x, z){
    for(const b of bots){
      if(b.chute){ b.group.remove(b.chute); b.chute = null; }
      b.group.visible = true; b.active = true; b.dropping = false;
      b.group.position.set(b.landing.x, groundAt(b.landing.x, b.landing.z), b.landing.z);
    }
    plane.visible = false;
    if(SFX.ready){ SFX.setPlane(null); SFX.setFall(0); }
    playerChute.visible = false;
    dropActive = false; dropEnded = true;
    player.dropState = 'none';
    gunRoot.visible = true;
    document.getElementById('dropmsg').style.display = 'none';
    const sx = x === undefined ? 120 : x, sz = z === undefined ? 120 : z;
    player.pos.set(sx, groundAt(sx, sz), sz);
  },
};
function endGame(win, killerName){
  if(gameState.over) return;
  gameState.over = true; gameState.playing = false;
  player.firing = false;
  player.aiming = false;
  player.scopeLock = false;
  setScopeUI(false);
  cancelHeal();
  closeInventory(false);
  if(player.driving){ player.driving = null; SFX.setEngine(false, 0); }
  SFX.stinger(win);
  const end = document.getElementById('endscreen');
  const title = document.getElementById('endtitle');
  const stats = document.getElementById('endstats');
  const place = win ? 1 : aliveBotCount() + 1;
  const acc = matchStats.fired ? Math.round(matchStats.hit / matchStats.fired * 100) : 0;
  const mins = Math.max(0, clock.elapsedTime - matchStats.t0);
  const timeStr = Math.floor(mins/60) + ':' + ('0' + Math.floor(mins%60)).slice(-2);
  document.getElementById('placebanner').innerHTML = '#' + place + ' <span>/ 40</span>';
  document.getElementById('st-kills').textContent = player.kills;
  document.getElementById('st-dmg').textContent = Math.round(matchStats.damage);
  document.getElementById('st-acc').textContent = acc + '%';
  document.getElementById('st-time').textContent = timeStr;
  if(win){
    end.className = 'screen win';
    title.textContent = 'WINNER WINNER CHICKEN DINNER!';
    stats.innerHTML = '';
  } else {
    end.className = 'screen';
    title.textContent = 'YOU DIED';
    stats.innerHTML = 'eliminated by ' + killerName;
  }
  // career
  const c = loadCareer();
  c.matches = (c.matches||0) + 1;
  c.wins = (c.wins||0) + (win ? 1 : 0);
  c.kills = (c.kills||0) + player.kills;
  c.bestKills = Math.max(c.bestKills||0, player.kills);
  c.bestPlace = Math.min(c.bestPlace||99, place);
  // match points: participation + kills + damage + placement bonus
  const pts = Math.max(5, Math.round(10 + player.kills*20 + matchStats.damage*0.1 +
    (place === 1 ? 100 : place <= 5 ? 50 : place <= 10 ? 25 : 0)));
  c.points = (c.points || 0) + pts;
  c.log = c.log || [];
  c.log.unshift({ t: Date.now(), place, kills: player.kills, dmg: Math.round(matchStats.damage), pts });
  c.log = c.log.slice(0, 12);
  saveCareer(c);
  const li = levelInfo(c.points);
  stats.innerHTML += '<br><span class="career">+' + pts + ' PTS &middot; LV ' + li.lv +
    ' — ' + li.into + ' / ' + li.need + '</span>' +
    '<br><span class="career">' + careerLine() + '</span>';
  setTimeout(() => {
    end.style.display = 'flex';
    if(document.pointerLockElement) document.exitPointerLock();
  }, win ? 900 : 1300);
}
document.getElementById('resumebtn').addEventListener('click', () => {
  canvasEl.requestPointerLock && canvasEl.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvasEl;
  if(matchStarted && !gameState.over && player.alive && !inventoryOpen){
    if(!pointerLocked){ paused = true; document.getElementById('pausescreen').style.display = 'flex'; }
    else { paused = false; document.getElementById('pausescreen').style.display = 'none'; }
  } else if(pointerLocked){
    paused = false; document.getElementById('pausescreen').style.display = 'none';
  }
});

// ---------------- main loop ----------------
const clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  let dt = Math.min(clock.getDelta(), 0.083);   // keep real-time pacing down to ~12fps
  if(paused) dt = 0;
  const t = clock.elapsedTime;

  if(!matchStarted){
    // lobby hero shot: full-height character in the hangar
    // (rig carries a +1.62 head offset, so subtract it to put the eye at chest height)
    const camX = LOBBY_SPOT.x, camZ = LOBBY_SPOT.z + 0.3 - 2.9;
    rig.position.set(camX, LOBBY_FLOOR + 1.05 - 1.62 + Math.sin(t*0.5)*0.015, camZ);
    player.yaw = Math.atan2(camX - LOBBY_SPOT.x, camZ - (LOBBY_SPOT.z + 0.3));
    player.pitch = 0.0;
    rig.rotation.y = player.yaw; pitchPivot.rotation.x = player.pitch;
    camera.position.set(0,0,0);
    gunRoot.visible = false;
    updateAvatar(dt);
  } else if(dt > 0){
    if(dropActive) updateDrop(dt);
    if(player.alive && gameState.playing) updatePlayer(dt);
    for(const b of bots) if(!b.gone) updateBot(b, dt);
    updateVehicles(dt);
    updateThrowables(dt, t);
    updateSmokes(dt, t);
    updateAvatar(dt);
    updateCameraRig(dt);
    updateInteractPrompt();
    if(dropEnded) updateZone(dt);
    else document.getElementById('zonemsg').textContent = 'ZONE STARTS WHEN YOU LAND';
  }

  // crate icons bob & spin
  for(let i=0;i<crates.length;i++){
    const c = crates[i];
    if(c.taken) continue;
    c.icon.rotation.y = t*1.6 + i;
    c.icon.position.y = 1.35 + Math.sin(t*2.2 + i)*0.08;
  }
  // FX decay
  updateParticles(dt); updateTracers(dt);
  if(flashTime > 0){ flashTime -= dt; if(flashTime <= 0) muzzleFlash.visible = false; }
  muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt*40);
  if(blastT > 0){ blastT -= dt; blastLight.intensity = Math.max(0, blastLight.intensity - dt*24); }
  vignetteOp = Math.max(0, vignetteOp - dt*1.8);
  document.getElementById('vignette').style.opacity = vignetteOp;
  hitmarkerOp = Math.max(0, hitmarkerOp - dt*6);
  document.getElementById('hitmarker').style.opacity = hitmarkerOp;

  // both suns + sky follow the view so shadows stay crisp anywhere on the map
  const anchor = matchStarted ? player.pos : rig.position;
  sun.position.set(anchor.x + sunDirection.x*170, anchor.y + sunDirection.y*170, anchor.z + sunDirection.z*170);
  sun.target.position.set(anchor.x, anchor.y, anchor.z);
  sun.target.updateMatrixWorld();
  sunFar.position.set(anchor.x + sunDirection.x*380, anchor.y + sunDirection.y*380, anchor.z + sunDirection.z*380);
  sunFar.target.position.set(anchor.x, anchor.y, anchor.z);
  sunFar.target.updateMatrixWorld();
  updateGrass(dt);
  sky.position.set(anchor.x, 0, anchor.z);
  clouds.position.x = Math.sin(t*0.008)*24;
  clouds.position.z = Math.cos(t*0.006)*18;
  waterMat.uniforms.time.value = t;
  if(terrainMat.userData.shader) terrainMat.userData.shader.uniforms.uTime.value = t;

  if(matchStarted) drawMinimap();
  renderer.render(scene, camera);
}
// HUD boot + render loop start live in lobby.js (it owns slotConfig)
