'use strict';
// PUBG Recreation — zone, minimap, HUD, match flow, main loop

// ---------------- shrinking zone ----------------
const zone = { cx:0, cz:0, r:430, tcx:0, tcz:0, tr:430, scx:0, scz:0, sr:430, phase:0, state:'wait', t:25 };
const ZONE_PHASES = [
  { wait:25, shrink:26, mul:0.58 },
  { wait:17, shrink:20, mul:0.56 },
  { wait:14, shrink:16, mul:0.54 },
  { wait:11, shrink:13, mul:0.50 },
  { wait:9,  shrink:11, mul:0.45 },
  { wait:8,  shrink:9,  mul:0.05 },
];
const zoneWallMat = new THREE.ShaderMaterial({
  transparent:true, side:THREE.DoubleSide, depthWrite:false, fog:false,
  uniforms: { color:{ value:new THREE.Color(0x55b0ff) }, time:{ value:0 } },
  vertexShader: [
    'varying vec2 vUv; varying float vH;',
    'void main(){ vUv = uv; vH = position.y + 0.5;',   // 0 bottom -> 1 top of unit cylinder
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
  ].join('\n'),
  fragmentShader: [
    'uniform vec3 color; uniform float time;',
    'varying vec2 vUv; varying float vH;',
    'void main(){',
    '  float ground = 1.0 - vH;',                          // dense at the base, fading up
    '  float stripes = smoothstep(0.85, 1.0, fract(vUv.x*220.0 + time*0.03)) * 0.5;',
    '  float pulse = 0.9 + 0.1*sin(time*2.2);',
    '  float a = (0.06 + 0.34*ground*ground + stripes*(0.25+0.75*ground)) * pulse;',
    '  gl_FragColor = vec4(color, a);',
    '}'
  ].join('\n')
});
const zoneWall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 96, 1, true), zoneWallMat);
zoneWall.scale.set(zone.r, 320, zone.r);
zoneWall.position.set(0, 150, 0);
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
      zone.tcx = clamp(zone.cx + Math.cos(a)*off, -320, 320);
      zone.tcz = clamp(zone.cz + Math.sin(a)*off, -320, 320);
      zone.tr = nr;
      zone.state = 'shrink'; zone.t = P.shrink;
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
  zoneWall.scale.set(zone.r, 320, zone.r);
  zoneWall.position.set(zone.cx, 150, zone.cz);
  zoneWallMat.uniforms.time.value = performance.now()*0.001;

  // zone damage in half-second ticks
  zoneTick += dt;
  if(zoneTick >= 0.5){
    zoneTick = 0;
    const dps = 2 + zone.phase * 2.2;
    if(player.alive && Math.hypot(player.pos.x-zone.cx, player.pos.z-zone.cz) > zone.r)
      damagePlayer(dps*0.5, 'THE ZONE');
    for(const b of bots){
      if(b.alive && Math.hypot(b.group.position.x-zone.cx, b.group.position.z-zone.cz) > zone.r)
        damageBot(b, dps*0.5, 'THE ZONE');
    }
  }

  // zone HUD line
  const zm = document.getElementById('zonemsg');
  const outside = player.alive && Math.hypot(player.pos.x-zone.cx, player.pos.z-zone.cz) > zone.r;
  if(outside){ zm.textContent = '⚠ RETURN TO THE ZONE'; zm.className = 'warn'; }
  else if(zone.state === 'wait'){
    zm.textContent = 'ZONE CLOSES IN ' + Math.max(0, Math.ceil(zone.t)) + 'S';
    zm.className = zone.t < 8 ? 'warn' : '';
  } else { zm.textContent = 'ZONE SHRINKING'; zm.className = 'warn'; }
}

// ---------------- minimap ----------------
const mapCanvas = document.getElementById('minimap');
const mapCtx = mapCanvas.getContext('2d');
const MAP_S = 190;
const MBG = 176;
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
  // current zone (blue) + next zone (white)
  mapCtx.strokeStyle = 'rgba(90,170,255,0.95)'; mapCtx.lineWidth = 1.6;
  mapCtx.beginPath(); mapCtx.arc(W2M(zone.cx), W2M(zone.cz), zone.r/WORLD*MAP_S, 0, Math.PI*2); mapCtx.stroke();
  if(zone.state === 'shrink' || zone.tr < zone.r){
    mapCtx.strokeStyle = 'rgba(255,255,255,0.9)'; mapCtx.lineWidth = 1.2;
    mapCtx.beginPath(); mapCtx.arc(W2M(zone.tcx), W2M(zone.tcz), zone.tr/WORLD*MAP_S, 0, Math.PI*2); mapCtx.stroke();
  }
  // bots
  mapCtx.fillStyle = '#e33';
  for(const b of bots){
    if(!b.alive) continue;
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
function updateAmmoHUD(){
  const holdingMed = player.holding === 'medkit';
  if(holdingMed){
    document.getElementById('weaponname').textContent = 'MEDKIT';
    document.getElementById('ammotext').innerHTML = player.medkits + ' <small>/ ' + MEDKIT_CAP + '</small>';
  } else {
    const a = player.owned[player.weapon];
    document.getElementById('weaponname').textContent = WEAPONS[player.weapon].name;
    document.getElementById('ammotext').innerHTML = a.mag + ' <small>/ ' + a.reserve + '</small>';
  }
  let slots = '';
  const keysMap = { rifle:'1', shotgun:'2', sniper:'3' };
  for(const w of ['rifle','shotgun','sniper']){
    if(!player.owned[w]) continue;
    const active = !holdingMed && w === player.weapon;
    slots += (active ? ' <b>['+keysMap[w]+'] '+WEAPONS[w].name+'</b>' : ' ['+keysMap[w]+'] '+WEAPONS[w].name);
  }
  slots += holdingMed ? ' <b>[4] MEDKIT</b>' : ' [4] MEDKIT';
  document.getElementById('slots').innerHTML = slots;
}
function updateMedkitHUD(){
  const m = document.getElementById('medkits');
  m.textContent = '\u271A ' + player.medkits;
  m.className = player.medkits > 0 ? '' : 'empty';
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
function showHitmarker(){ hitmarkerOp = 1; }
function flashVignette(op){ vignetteOp = Math.max(vignetteOp, op === undefined ? 0.85 : op); }

// ---------------- match flow ----------------
let matchStarted = false, paused = false;
const canvasEl = renderer.domElement;
function startMatch(){
  if(matchStarted) return;
  matchStarted = true;
  gameState.playing = true;
  document.getElementById('startscreen').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  gunRoot.visible = true;
  // spawn on the map rim, on open ground
  let sx, sz, guard = 0;
  do {
    const a = randRange(0, Math.PI*2), r = randRange(210, 330);
    sx = Math.cos(a)*r; sz = Math.sin(a)*r; guard++;
  } while((insideBuilding(sx,sz,4) || heightAt(sx,sz) < 0.5) && guard < 200);
  player.pos.set(sx, groundAt(sx,sz), sz);
  player.yaw = Math.atan2(sx, sz) + Math.PI;   // face map centre... roughly
  player.vel.set(0,0,0);
  updateHealthHUD(); updateAmmoHUD(); updateAliveHUD(); updateMedkitHUD();
}
window.__start = startMatch;   // dev hook: start match without pointer lock
window.__dev = {               // dev/test hooks
  bots, player, heightAt, solidCyls, crates,
  tp(x, z, yaw, pitch){ player.pos.set(x, groundAt(x,z), z); player.yaw = yaw||0; player.pitch = pitch||0; },
};
function endGame(win, killerName){
  if(gameState.over) return;
  gameState.over = true; gameState.playing = false;
  player.firing = false;
  player.aiming = false;
  setScopeUI(false);
  cancelHeal();
  const end = document.getElementById('endscreen');
  const title = document.getElementById('endtitle');
  const stats = document.getElementById('endstats');
  if(win){
    end.className = 'screen win';
    title.textContent = 'WINNER WINNER CHICKEN DINNER!';
    stats.textContent = '#1 of 24   ·   ' + player.kills + ' kills';
  } else {
    end.className = 'screen';
    title.textContent = 'YOU DIED';
    stats.textContent = 'Placed #' + (aliveBotCount()+1) + ' of 24   ·   ' + player.kills +
      ' kills   ·   eliminated by ' + killerName;
  }
  setTimeout(() => {
    end.style.display = 'flex';
    if(document.pointerLockElement) document.exitPointerLock();
  }, win ? 900 : 1300);
}
document.getElementById('deploybtn').addEventListener('click', () => {
  startMatch();
  canvasEl.requestPointerLock && canvasEl.requestPointerLock();
});
document.getElementById('resumebtn').addEventListener('click', () => {
  canvasEl.requestPointerLock && canvasEl.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvasEl;
  if(matchStarted && !gameState.over && player.alive){
    if(!pointerLocked){ paused = true; document.getElementById('pausescreen').style.display = 'flex'; }
    else { paused = false; document.getElementById('pausescreen').style.display = 'none'; }
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
    // menu: slow orbit over the village
    const a = t * 0.05;
    const ox = Math.sin(a)*72, oz = 8 + Math.cos(a)*72;
    rig.position.set(ox, Math.max(heightAt(ox,oz), heightAt(0,8)) + 17, oz);
    player.yaw = a + Math.PI; player.pitch = -0.18;
    rig.rotation.y = player.yaw; camera.rotation.x = player.pitch;
    gunRoot.visible = false;
  } else if(dt > 0){
    if(player.alive && gameState.playing) updatePlayer(dt);
    for(const b of bots) if(!b.gone) updateBot(b, dt);
    updateZone(dt);
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
  vignetteOp = Math.max(0, vignetteOp - dt*1.8);
  document.getElementById('vignette').style.opacity = vignetteOp;
  hitmarkerOp = Math.max(0, hitmarkerOp - dt*6);
  document.getElementById('hitmarker').style.opacity = hitmarkerOp;

  // sun + sky follow the view so shadows stay crisp anywhere on the map
  const anchor = matchStarted ? player.pos : rig.position;
  sun.position.set(anchor.x + sunDirection.x*170, anchor.y + sunDirection.y*170, anchor.z + sunDirection.z*170);
  sun.target.position.set(anchor.x, anchor.y, anchor.z);
  sun.target.updateMatrixWorld();
  sky.position.set(anchor.x, 0, anchor.z);
  clouds.position.x = Math.sin(t*0.008)*24;
  clouds.position.z = Math.cos(t*0.006)*18;
  waterMat.uniforms.time.value = t;
  if(terrainMat.userData.shader) terrainMat.userData.shader.uniforms.uTime.value = t;

  if(matchStarted) drawMinimap();
  renderer.render(scene, camera);
}
updateHealthHUD(); updateAmmoHUD(); updateAliveHUD(); updateMedkitHUD();
animate();
