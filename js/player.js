'use strict';
// PUBG Recreation — player state, shooting, input, movement

// ---------------- player ----------------
const player = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(),
  yaw: 0, pitch: 0, hp: 100, armor: 0, alive: true, grounded: false,
  bobPhase: 0, bobAmt: 0, kills: 0,
  weapon: 'rifle',
  owned: {
    rifle:   { mag: 30, reserve: 90 },
    shotgun: { mag: 6,  reserve: 18 },
    sniper:  { mag: 5,  reserve: 15 },
  },
  cooldown: 0, reloading: 0, firing: false, fireLatch: false,
  aiming: false, aimBlend: 0,
  items: { medkit: 1, frag: 1, smoke: 1 },
  healing: 0,
  holding: 'gun',            // 'gun' | 'medkit' | 'frag' | 'smoke'
  charging: false,           // sniper: fire on release
  scopeLock: false,          // sniper: double-click latches the scope until right-click
  driving: null,             // vehicle ref while behind the wheel
  dropState: 'none',         // 'none' | 'plane' | 'free' | 'chute'
};
const HEAL_TIME = 4.0, HEAL_AMOUNT = 75;
const ITEM_CAPS = { medkit: 4, frag: 3, smoke: 3 };

const rig = new THREE.Object3D();      // yaw
const head = new THREE.Object3D();     // pitch + eye height + bob
head.position.y = 1.62;
rig.add(head);
scene.add(rig);

function resolveCollisions(p, radius, height){
  for(const c of solidCyls){
    if(p.y > c.y1 || p.y + height < c.y0) continue;
    const dx = p.x - c.x, dz = p.z - c.z, rr = c.r + radius;
    const d2 = dx*dx + dz*dz;
    if(d2 < rr*rr && d2 > 1e-9){
      const d = Math.sqrt(d2), push = (rr - d)/d;
      p.x += dx*push; p.z += dz*push;
    }
  }
  for(const c of colliders){
    if(p.y+height < c.minY || p.y+0.25 > c.maxY) continue;
    const nx = clamp(p.x, c.minX, c.maxX), nz = clamp(p.z, c.minZ, c.maxZ);
    let dx = p.x-nx, dz = p.z-nz;
    let d2 = dx*dx+dz*dz;
    if(d2 < radius*radius){
      if(d2 < 1e-9){                      // center inside the box: push out shortest face
        const pushes = [
          { d: p.x-c.minX+radius, x:-1, z:0 }, { d: c.maxX-p.x+radius, x:1, z:0 },
          { d: p.z-c.minZ+radius, x:0, z:-1 }, { d: c.maxZ-p.z+radius, x:0, z:1 },
        ].sort((a,b)=>a.d-b.d);
        p.x += pushes[0].x*pushes[0].d; p.z += pushes[0].z*pushes[0].d;
      } else {
        const d = Math.sqrt(d2), push = (radius-d)/d;
        p.x += dx*push; p.z += dz*push;
      }
    }
  }
}

const gunRoot = new THREE.Object3D();          // holds current viewmodel, bottom-right of view
camera.add(gunRoot);
const pitchPivot = new THREE.Object3D();       // pitch node — camera orbits it in third person
head.add(pitchPivot);
pitchPivot.add(camera);
const GUN_REST = new THREE.Vector3(0.24, -0.20, -0.42);
const GUN_ADS  = new THREE.Vector3(0, -0.175, -0.36);
gunRoot.position.copy(GUN_REST);
gunRoot.scale.setScalar(0.62);
gunRoot.rotation.y = 0.05;
const gunModels = { rifle: buildGunModel('rifle', true), shotgun: buildGunModel('shotgun', true), sniper: buildGunModel('sniper', true) };
let currentGunMesh = gunModels.rifle;
gunRoot.add(currentGunMesh);
let recoil = 0, recoilRot = 0;

const scopeEl = document.getElementById('scope');
const crosshairEl = document.getElementById('crosshair');
let scopeShown = false;
function setScopeUI(on){
  if(on === scopeShown) return;
  scopeShown = on;
  scopeEl.style.display = on ? 'block' : 'none';
  crosshairEl.style.display = on ? 'none' : 'block';
  gunRoot.visible = !on;                       // scope view hides the viewmodel
}

const muzzleLight = new THREE.PointLight(0xffc978, 0, 9, 2);
scene.add(muzzleLight);
const muzzleFlash = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.09,0.16),
  new THREE.MeshBasicMaterial({ color:0xffe0a0, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending, depthWrite:false }));
muzzleFlash.visible = false;
scene.add(muzzleFlash);
let flashTime = 0;

function setWeapon(type){
  if(!player.owned[type]) return;
  if(player.holding !== 'gun') holsterItem();
  player.weapon = type;
  player.scopeLock = false;
  gunRoot.remove(currentGunMesh);
  currentGunMesh = gunModels[type];
  gunRoot.add(currentGunMesh);
  player.reloading = 0;
  cancelHeal();
  document.getElementById('reloadmsg').textContent = '';
  updateAmmoHUD();
}

// ---------------- shooting (player) ----------------
const _fwd = new THREE.Vector3(), _muzzleWorld = new THREE.Vector3();
function playerShoot(){
  const W = WEAPONS[player.weapon];
  const ammo = player.owned[player.weapon];
  if(ammo.mag <= 0){ startReload(); return; }
  ammo.mag--;
  player.cooldown = 60 / W.rpm;
  camera.getWorldDirection(_fwd);
  const origin = new THREE.Vector3(player.pos.x, player.pos.y + 1.62, player.pos.z);
  if(effectiveThird()) avatarMuzzle.getWorldPosition(_muzzleWorld);
  else { _muzzleWorld.copy(currentGunMesh.userData.muzzle); currentGunMesh.localToWorld(_muzzleWorld); }
  const spread = player.aiming ? W.spread * (player.weapon === 'sniper' ? 0.05 : 0.55) : W.spread;
  matchStats.fired += W.pellets;
  for(let i=0;i<W.pellets;i++){
    const d = _fwd.clone();
    d.x += randRange(-spread, spread);
    d.y += randRange(-spread, spread);
    d.z += randRange(-spread, spread);
    d.normalize();
    const hit = castShot(origin, d, W.range, 'player');
    if(hit.kind !== 'none') impactFX(hit);
    spawnTracer(_muzzleWorld.x, _muzzleWorld.y, _muzzleWorld.z, hit.x, hit.y, hit.z, W.tracer);
    if(hit.kind === 'bot'){
      matchStats.hit++; matchStats.damage += W.dmg;
      damageBot(hit.bot, W.dmg, 'You', 'player');
    } else if(hit.kind === 'vehicle' && hit.vehicle){
      matchStats.hit++;
      damageVehicle(hit.vehicle, W.dmg * 0.8, 'You');
    }
  }
  recoil = Math.min(recoil + W.kick, 0.22);
  recoilRot = Math.min(recoilRot + W.kick*1.6, 0.35);
  player.pitch = clamp(player.pitch + W.kick*0.10, -1.55, 1.55);
  muzzleLight.position.copy(_muzzleWorld);
  muzzleLight.intensity = 3.2;
  muzzleFlash.position.copy(_muzzleWorld);
  muzzleFlash.rotation.set(randRange(0,3), randRange(0,3), randRange(0,3));
  muzzleFlash.scale.setScalar(randRange(0.8,1.4));
  muzzleFlash.visible = true;
  flashTime = 0.045;
  for(let i=0;i<3;i++){
    spawnParticle(_muzzleWorld.x, _muzzleWorld.y, _muzzleWorld.z,
      _fwd.x*randRange(2,5)+randRange(-1,1), _fwd.y*3+randRange(0.5,1.5), _fwd.z*randRange(2,5)+randRange(-1,1),
      0xffcf7a, randRange(0.02,0.05), randRange(0.08,0.16), -6, 4);
  }
  SFX.shot(player.weapon, 0, 0);
  reportGunshot(player.pos.x, player.pos.z, 'player');
  updateAmmoHUD();
}
function startHeal(){
  if(!player.alive || player.healing > 0 || player.reloading > 0) return;
  if(player.items.medkit <= 0){ showToast('NO MEDKITS'); return; }
  if(player.hp >= 100){ showToast('HEALTH FULL'); return; }
  player.healing = HEAL_TIME;
  player.firing = false;
  SFX.healStart();
  document.getElementById('healfill').style.width = '0%';
  document.getElementById('healbar').style.display = 'block';
}
function cancelHeal(){
  if(player.healing <= 0) return;
  player.healing = 0;
  document.getElementById('healbar').style.display = 'none';
}
function startReload(){
  const ammo = player.owned[player.weapon];
  const W = WEAPONS[player.weapon];
  if(player.reloading > 0 || player.healing > 0 || player.holding !== 'gun' || player.driving ||
     ammo.mag >= W.mag || ammo.reserve <= 0) return;
  player.reloading = W.reload;
  SFX.reload();
  document.getElementById('reloadmsg').textContent = 'RELOADING…';
}
function finishReload(){
  const ammo = player.owned[player.weapon];
  const W = WEAPONS[player.weapon];
  const need = W.mag - ammo.mag, take = Math.min(need, ammo.reserve);
  ammo.mag += take; ammo.reserve -= take;
  document.getElementById('reloadmsg').textContent = '';
  updateAmmoHUD();
}

// ---------------- input ----------------
const keys = {};
let pointerLocked = false;
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if(!gameState.playing) return;
  if(e.code === 'KeyE' && player.alive && player.dropState === 'none' && !player.driving) toggleInventory();
  if(e.code === 'KeyF'){
    if(player.dropState === 'plane') jumpFromPlane();
    else if(player.alive && player.dropState === 'none' && !inventoryOpen) tryVehicleToggle();
  }
  if(e.code === 'KeyV' && player.alive && player.dropState !== 'plane') toggleView();
  if(inventoryOpen || player.driving || player.dropState !== 'none') return;
  if(e.code === 'KeyR') startReload();
  if(e.code === 'Digit1') setWeapon(slotConfig[0]);
  if(e.code === 'Digit2') setWeapon(slotConfig[1]);
  if(e.code === 'Digit3') setWeapon(slotConfig[2]);
});
document.addEventListener('keyup', e => { keys[e.code] = false; });
document.addEventListener('mousedown', e => {
  if(!gameState.playing || !player.alive || inventoryOpen || player.driving || player.dropState !== 'none') return;
  if(e.button === 0){
    if(player.holding === 'medkit'){ startHeal(); return; }
    if(player.holding === 'frag' || player.holding === 'smoke'){ throwHeld(); return; }
    if(player.healing > 0) cancelHeal();
    if(player.weapon === 'sniper'){
      if(scopeShown){                                       // scoped: fire the moment you click
        if(player.cooldown <= 0 && player.reloading <= 0 && player.healing <= 0) playerShoot();
      } else player.charging = true;                        // hip: hold, release to fire
      return;
    }
    player.firing = true; player.fireLatch = false;
  }
  else if(e.button === 2 && player.holding === 'gun'){
    if(player.scopeLock){ player.scopeLock = false; player.aiming = false; return; }   // right-click drops the latch
    player.aiming = true;
  }
});
document.addEventListener('dblclick', () => {
  if(!gameState.playing || !player.alive || inventoryOpen || player.driving || player.dropState !== 'none') return;
  if(player.weapon === 'sniper' && player.holding === 'gun') player.scopeLock = true;   // stay scoped
});
document.addEventListener('mouseup', e => {
  if(e.button === 0){
    player.firing = false;
    if(player.charging){
      player.charging = false;
      if(gameState.playing && player.alive && player.holding === 'gun' && player.weapon === 'sniper' &&
         !player.driving && player.dropState === 'none' &&
         player.cooldown <= 0 && player.reloading <= 0 && player.healing <= 0) playerShoot();
    }
  }
  else if(e.button === 2) player.aiming = false;
});
document.addEventListener('contextmenu', e => { if(matchStarted && !gameState.over) e.preventDefault(); });
document.addEventListener('mousemove', e => {
  if(!pointerLocked || !player.alive) return;
  const sens = 0.0022 * Math.max(camera.fov / 75, 0.2);   // slower look when zoomed in
  player.yaw   -= e.movementX * sens;
  player.pitch = clamp(player.pitch - e.movementY * sens, -1.55, 1.55);
});

// ---------------- player update ----------------
let footstepTimer = 0;
function updatePlayer(dt){
  if(!player.alive || player.driving || player.dropState !== 'none') return;
  rig.rotation.y = player.yaw;
  pitchPivot.rotation.x = player.pitch;

  if(player.scopeLock){
    if(player.weapon === 'sniper' && player.holding === 'gun') player.aiming = true;    // latch holds the scope
    else player.scopeLock = false;
  }

  const sprint = keys.ShiftLeft || keys.ShiftRight;
  let ix = 0, iz = 0;
  if(keys.KeyW) iz -= 1;  if(keys.KeyS) iz += 1;
  if(keys.KeyA) ix -= 1;  if(keys.KeyD) ix += 1;
  const moving = ix !== 0 || iz !== 0;
  let speed = sprint && iz < 0 ? 9.2 : 5.6;
  if(player.aiming) speed *= 0.55;
  if(player.healing > 0) speed *= 0.5;
  if(moving){
    const inv = 1/Math.hypot(ix,iz);
    ix *= inv; iz *= inv;
    const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
    const wx = ix*cos + iz*sin, wz = -ix*sin + iz*cos;
    player.vel.x = lerp(player.vel.x, wx*speed, Math.min(1, dt*10));
    player.vel.z = lerp(player.vel.z, wz*speed, Math.min(1, dt*10));
  } else {
    player.vel.x = lerp(player.vel.x, 0, Math.min(1, dt*12));
    player.vel.z = lerp(player.vel.z, 0, Math.min(1, dt*12));
  }
  player.vel.y -= 21 * dt;
  if(player.grounded && keys.Space){ player.vel.y = 7.6; player.grounded = false; cancelHeal(); }

  player.pos.x += player.vel.x * dt;
  player.pos.z += player.vel.z * dt;
  player.pos.y += player.vel.y * dt;
  player.pos.x = clamp(player.pos.x, -HALF+4, HALF-4);
  player.pos.z = clamp(player.pos.z, -HALF+4, HALF-4);
  resolveCollisions(player.pos, 0.45, 1.6);
  const g = groundAt(player.pos.x, player.pos.z, player.pos.y + 0.1);
  if(player.pos.y <= g){ player.pos.y = g; player.vel.y = 0; player.grounded = true; }
  else if(player.pos.y - g > 0.02) player.grounded = false;

  rig.position.copy(player.pos);

  // camera bob + aim blend + fov + footsteps
  const horizSpeed = Math.hypot(player.vel.x, player.vel.z);
  if(player.grounded && horizSpeed > 0.6){
    player.bobPhase += dt * (3.6 + horizSpeed * 0.9);
    player.bobAmt = lerp(player.bobAmt, 1, dt*6);
  } else {
    player.bobAmt = lerp(player.bobAmt, 0, dt*7);
  }
  player.aimBlend = lerp(player.aimBlend, player.aiming ? 1 : 0, Math.min(1, dt*10));
  const ab = player.aimBlend;
  const bobA = player.bobAmt * (1 - ab*0.7);              // steadier while aiming
  const steady = player.charging ? 0.3 : 1;               // held breath before the shot
  head.position.y = 1.62 + Math.sin(player.bobPhase*2) * 0.038 * bobA;
  head.position.x = Math.sin(player.bobPhase) * 0.022 * bobA;
  head.rotation.y = Math.sin(performance.now()*0.0009) * 0.0014 * ab * steady;
  camera.rotation.z = Math.sin(player.bobPhase) * 0.006 * bobA;
  pitchPivot.rotation.x += Math.sin(performance.now()*0.0013) * 0.0012 * ab * steady;   // breathing sway
  const scoped = player.aiming && player.weapon === 'sniper' && player.holding === 'gun';
  let targetFov = 75;
  if(player.aiming && player.holding === 'gun') targetFov = scoped ? 18 : 62;
  else if(sprint && horizSpeed > 6.5) targetFov = 82;
  if(Math.abs(camera.fov - targetFov) > 0.05){
    camera.fov = lerp(camera.fov, targetFov, Math.min(1, dt*9));
    camera.updateProjectionMatrix();
  }
  setScopeUI(scoped && camera.fov < 45);
  footstepTimer -= dt;
  if(player.grounded && horizSpeed > 2 && footstepTimer <= 0){
    SFX.footstep(horizSpeed > 6.5);
    if(horizSpeed > 6.5) dustPuff(player.pos.x - player.vel.x*0.06, g, player.pos.z - player.vel.z*0.06);
    footstepTimer = horizSpeed > 6.5 ? 0.26 : 0.42;
  }

  // medkit cast
  if(player.healing > 0){
    player.healing -= dt;
    document.getElementById('healfill').style.width = ((1 - Math.max(player.healing,0)/HEAL_TIME) * 100) + '%';
    if(player.healing <= 0){
      player.healing = 0;
      player.items.medkit--;
      player.hp = Math.min(100, player.hp + HEAL_AMOUNT);
      document.getElementById('healbar').style.display = 'none';
      updateHealthHUD(); updateItemsHUD();
      SFX.heal();
      showToast('+' + HEAL_AMOUNT + ' HP');
      if(player.items.medkit <= 0) holsterItem(); else updateAmmoHUD();
    }
  }

  // firing / reload / recoil recovery
  player.cooldown -= dt;
  if(player.reloading > 0){
    player.reloading -= dt;
    if(player.reloading <= 0) finishReload();
  } else if(player.firing && player.cooldown <= 0 && player.healing <= 0 && player.holding === 'gun'){
    const W = WEAPONS[player.weapon];
    if(W.auto || !player.fireLatch){ playerShoot(); player.fireLatch = true; }
  }
  recoil = lerp(recoil, 0, Math.min(1, dt*10));
  recoilRot = lerp(recoilRot, 0, Math.min(1, dt*9));
  gunRoot.position.set(
    lerp(GUN_REST.x, GUN_ADS.x, ab) + Math.sin(player.bobPhase) * 0.008 * bobA,
    lerp(GUN_REST.y, GUN_ADS.y, ab) + Math.abs(Math.sin(player.bobPhase*2)) * 0.010 * bobA - ((player.reloading>0 || player.healing>0) ? 0.12 : 0),
    lerp(GUN_REST.z, GUN_ADS.z, ab) + recoil);
  gunRoot.rotation.x = recoilRot * 0.55 + ((player.reloading>0 || player.healing>0) ? -0.4 : 0);
  gunRoot.rotation.y = 0.05 * (1 - ab);

  // loot pickup
  for(const c of crates){
    if(c.taken) continue;
    const dx = c.group.position.x - player.pos.x, dz = c.group.position.z - player.pos.z;
    if(dx*dx + dz*dz < 2.6 && Math.abs(c.group.position.y - player.pos.y) < 2.2) tryPickup(c);
  }
}
