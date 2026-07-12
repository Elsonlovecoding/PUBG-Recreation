'use strict';
// PUBG Recreation — player state, gun viewmodels, shooting, input, movement

// ---------------- player ----------------
const player = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(),
  yaw: 0, pitch: 0, hp: 100, alive: true, grounded: false,
  bobPhase: 0, bobAmt: 0, kills: 0,
  weapon: 'rifle',
  owned: { rifle: { mag: 30, reserve: 90 } },
  cooldown: 0, reloading: 0, firing: false, fireLatch: false,
};
const rig = new THREE.Object3D();      // yaw
const head = new THREE.Object3D();     // pitch + eye height + bob
head.position.y = 1.62;
rig.add(head);
scene.add(rig);

function resolveCollisions(p, radius, height){
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

// ---------------- gun viewmodels ----------------
const GUNMETAL = 0x26282c, WOOD = 0x4e3520, SCOPE = 0x1a1c20;
function gunPart(g, geo, hex, x,y,z, rx,ry,rz){
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color:hex, flatShading:true, roughness:0.85, metalness:0.15 }));
  m.position.set(x,y,z);
  if(rx||ry||rz) m.rotation.set(rx||0, ry||0, rz||0);
  g.add(m); return m;
}
function buildGunModel(type){
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
  g.traverse(o => { o.frustumCulled = false; });
  return g;
}
const gunRoot = new THREE.Object3D();          // holds current viewmodel, bottom-right of view
camera.add(gunRoot);
head.add(camera);
const GUN_REST = new THREE.Vector3(0.24, -0.20, -0.42);
gunRoot.position.copy(GUN_REST);
gunRoot.scale.setScalar(0.62);
gunRoot.rotation.y = 0.05;
const gunModels = { rifle: buildGunModel('rifle'), shotgun: buildGunModel('shotgun'), sniper: buildGunModel('sniper') };
let currentGunMesh = gunModels.rifle;
gunRoot.add(currentGunMesh);
let recoil = 0, recoilRot = 0;

const muzzleLight = new THREE.PointLight(0xffc978, 0, 9, 2);
scene.add(muzzleLight);
const muzzleFlash = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.09,0.16),
  new THREE.MeshBasicMaterial({ color:0xffe0a0, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending, depthWrite:false }));
muzzleFlash.visible = false;
scene.add(muzzleFlash);
let flashTime = 0;

function setWeapon(type){
  if(!player.owned[type]) return;
  player.weapon = type;
  gunRoot.remove(currentGunMesh);
  currentGunMesh = gunModels[type];
  gunRoot.add(currentGunMesh);
  player.reloading = 0;
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
  _muzzleWorld.copy(currentGunMesh.userData.muzzle);
  currentGunMesh.localToWorld(_muzzleWorld);
  for(let i=0;i<W.pellets;i++){
    const d = _fwd.clone();
    d.x += randRange(-W.spread, W.spread);
    d.y += randRange(-W.spread, W.spread);
    d.z += randRange(-W.spread, W.spread);
    d.normalize();
    const hit = castShot(origin, d, 220, 'player');
    if(hit.kind !== 'none') impactFX(hit);
    spawnTracer(_muzzleWorld.x, _muzzleWorld.y, _muzzleWorld.z, hit.x, hit.y, hit.z, W.tracer);
    if(hit.kind === 'bot') damageBot(hit.bot, W.dmg, 'You');
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
  updateAmmoHUD();
}
function startReload(){
  const ammo = player.owned[player.weapon];
  const W = WEAPONS[player.weapon];
  if(player.reloading > 0 || ammo.mag >= W.mag || ammo.reserve <= 0) return;
  player.reloading = W.reload;
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
  if(e.code === 'KeyR') startReload();
  if(e.code === 'Digit1' && player.owned.rifle) setWeapon('rifle');
  if(e.code === 'Digit2' && player.owned.shotgun) setWeapon('shotgun');
  if(e.code === 'Digit3' && player.owned.sniper) setWeapon('sniper');
});
document.addEventListener('keyup', e => { keys[e.code] = false; });
document.addEventListener('mousedown', e => {
  if(!gameState.playing || !player.alive || e.button !== 0) return;
  player.firing = true; player.fireLatch = false;
});
document.addEventListener('mouseup', e => { if(e.button === 0) player.firing = false; });
document.addEventListener('mousemove', e => {
  if(!pointerLocked || !player.alive) return;
  player.yaw   -= e.movementX * 0.0022;
  player.pitch = clamp(player.pitch - e.movementY * 0.0022, -1.55, 1.55);
});

// ---------------- player update ----------------
let footstepTimer = 0;
function updatePlayer(dt){
  if(!player.alive) return;
  rig.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;

  const sprint = keys.ShiftLeft || keys.ShiftRight;
  let ix = 0, iz = 0;
  if(keys.KeyW) iz -= 1;  if(keys.KeyS) iz += 1;
  if(keys.KeyA) ix -= 1;  if(keys.KeyD) ix += 1;
  const moving = ix !== 0 || iz !== 0;
  const speed = sprint && iz < 0 ? 9.2 : 5.6;
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
  if(player.grounded && keys.Space){ player.vel.y = 7.6; player.grounded = false; }

  player.pos.x += player.vel.x * dt;
  player.pos.z += player.vel.z * dt;
  player.pos.y += player.vel.y * dt;
  player.pos.x = clamp(player.pos.x, -HALF+4, HALF-4);
  player.pos.z = clamp(player.pos.z, -HALF+4, HALF-4);
  resolveCollisions(player.pos, 0.45, 1.6);
  const g = groundAt(player.pos.x, player.pos.z);
  if(player.pos.y <= g){ player.pos.y = g; player.vel.y = 0; player.grounded = true; }
  else if(player.pos.y - g > 0.02) player.grounded = false;

  rig.position.copy(player.pos);

  // camera bob + sprint fov + footstep dust
  const horizSpeed = Math.hypot(player.vel.x, player.vel.z);
  if(player.grounded && horizSpeed > 0.6){
    player.bobPhase += dt * (3.6 + horizSpeed * 0.9);
    player.bobAmt = lerp(player.bobAmt, 1, dt*6);
  } else {
    player.bobAmt = lerp(player.bobAmt, 0, dt*7);
  }
  head.position.y = 1.62 + Math.sin(player.bobPhase*2) * 0.038 * player.bobAmt;
  head.position.x = Math.sin(player.bobPhase) * 0.022 * player.bobAmt;
  camera.rotation.z = Math.sin(player.bobPhase) * 0.006 * player.bobAmt;
  const targetFov = (sprint && horizSpeed > 6.5) ? 82 : 75;
  if(Math.abs(camera.fov - targetFov) > 0.1){
    camera.fov = lerp(camera.fov, targetFov, dt*6);
    camera.updateProjectionMatrix();
  }
  footstepTimer -= dt;
  if(player.grounded && horizSpeed > 6.5 && footstepTimer <= 0){
    dustPuff(player.pos.x - player.vel.x*0.06, g, player.pos.z - player.vel.z*0.06);
    footstepTimer = 0.26;
  }

  // firing / reload / recoil recovery
  player.cooldown -= dt;
  if(player.reloading > 0){
    player.reloading -= dt;
    if(player.reloading <= 0) finishReload();
  } else if(player.firing && player.cooldown <= 0){
    const W = WEAPONS[player.weapon];
    if(W.auto || !player.fireLatch){ playerShoot(); player.fireLatch = true; }
  }
  recoil = lerp(recoil, 0, Math.min(1, dt*10));
  recoilRot = lerp(recoilRot, 0, Math.min(1, dt*9));
  gunRoot.position.set(
    GUN_REST.x + Math.sin(player.bobPhase) * 0.008 * player.bobAmt,
    GUN_REST.y + Math.abs(Math.sin(player.bobPhase*2)) * 0.010 * player.bobAmt - (player.reloading>0 ? 0.12 : 0),
    GUN_REST.z + recoil);
  gunRoot.rotation.x = recoilRot * 0.55 + (player.reloading>0 ? -0.4 : 0);

  // loot pickup
  for(const c of crates){
    if(c.taken) continue;
    const dx = c.group.position.x - player.pos.x, dz = c.group.position.z - player.pos.z;
    if(dx*dx + dz*dz < 2.6) tryPickup(c);
  }
  // zone damage handled in updateZone
}
function tryPickup(c){
  if(c.loot === 'medkit'){
    if(player.hp >= 100) return;
    player.hp = Math.min(100, player.hp + 60);
    showToast('USED MEDKIT  +HP');
    updateHealthHUD();
  } else {
    const W = WEAPONS[c.loot];
    if(player.owned[c.loot]){
      player.owned[c.loot].reserve += W.mag * 2;
      showToast('PICKED UP ' + W.name + ' AMMO');
    } else {
      player.owned[c.loot] = { mag: W.mag, reserve: W.mag * 3 };
      setWeapon(c.loot);
      showToast('PICKED UP ' + W.name);
    }
    updateAmmoHUD();
  }
  c.taken = true;
  scene.remove(c.group);
}
