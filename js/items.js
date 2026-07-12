'use strict';
// PUBG Recreation — inventory, held items, throwables, explosions, loot pickup

// ---------------- held item viewmodels ----------------
const medkitVM = makeMedkitModel();
medkitVM.scale.setScalar(1.25);
medkitVM.position.set(-0.02, 0.02, 0.05);
medkitVM.rotation.set(0.18, -0.45, 0.05);
const fragVM = makeGrenadeModel();
fragVM.scale.setScalar(1.6);
fragVM.position.set(0, -0.04, 0.02);
fragVM.rotation.set(0.2, 0.4, 0);
const smokeVM = makeSmokeModel();
smokeVM.scale.setScalar(1.5);
smokeVM.position.set(0, -0.02, 0.02);
smokeVM.rotation.set(0.25, 0.2, 0.1);
const ITEM_VMS = { medkit: medkitVM, frag: fragVM, smoke: smokeVM };
const ITEM_LABELS = { medkit: 'MEDKIT', frag: 'FRAG GRENADE', smoke: 'SMOKE GRENADE' };

function equipItem(type){
  if(player.items[type] <= 0){ showToast('NO ' + ITEM_LABELS[type] + 'S'); return; }
  if(player.holding !== 'gun') holsterItem();
  player.holding = type;
  player.firing = false; player.charging = false; player.aiming = false;
  gunRoot.remove(currentGunMesh);
  gunRoot.add(ITEM_VMS[type]);
  SFX.click();
  showToast(type === 'medkit' ? 'CLICK TO USE MEDKIT' : 'CLICK TO THROW');
  updateAmmoHUD();
}
function holsterItem(){
  if(player.holding === 'gun') return;
  cancelHeal();
  gunRoot.remove(ITEM_VMS[player.holding]);
  player.holding = 'gun';
  gunRoot.add(currentGunMesh);
  updateAmmoHUD();
}

// ---------------- inventory panel (E) ----------------
let inventoryOpen = false;
const invEl = document.getElementById('inventory');
function refreshInventory(){
  for(const t of ['medkit','frag','smoke']){
    const row = invEl.querySelector('[data-item="' + t + '"]');
    row.querySelector('.ct').textContent = '×' + player.items[t];
    row.className = 'invrow' + (player.items[t] > 0 ? '' : ' empty');
  }
}
function openInventory(){
  if(inventoryOpen || !player.alive) return;
  inventoryOpen = true;
  refreshInventory();
  invEl.style.display = 'flex';
  if(document.pointerLockElement) document.exitPointerLock();
}
function closeInventory(relock){
  if(!inventoryOpen) return;
  inventoryOpen = false;
  invEl.style.display = 'none';
  if(relock && matchStarted && !gameState.over && player.alive)
    renderer.domElement.requestPointerLock && renderer.domElement.requestPointerLock();
}
function toggleInventory(){ inventoryOpen ? closeInventory(true) : openInventory(); }
invEl.querySelectorAll('.invrow').forEach(row => {
  row.addEventListener('click', () => {
    const t = row.getAttribute('data-item');
    if(player.items[t] <= 0) return;
    closeInventory(true);
    equipItem(t);
  });
});

// ---------------- throwables ----------------
const grenades = [];
function throwHeld(){
  const type = player.holding;
  if(type !== 'frag' && type !== 'smoke') return;
  if(player.items[type] <= 0){ holsterItem(); return; }
  player.items[type]--;
  camera.getWorldDirection(_fwd);
  const o = { x: player.pos.x + _fwd.x*0.6, y: player.pos.y + 1.55, z: player.pos.z + _fwd.z*0.6 };
  spawnGrenade(o.x, o.y, o.z,
    _fwd.x*17 + player.vel.x*0.5, _fwd.y*17 + 4.5, _fwd.z*17 + player.vel.z*0.5,
    type, 'You');
  SFX.throwPin();
  updateItemsHUD(); updateAmmoHUD();
  if(player.items[type] <= 0) holsterItem();
}
function spawnGrenade(x,y,z, vx,vy,vz, type, owner){
  const mesh = (type === 'frag' ? makeGrenadeModel() : makeSmokeModel());
  mesh.position.set(x,y,z);
  scene.add(mesh);
  grenades.push({ mesh, vx, vy, vz, type, owner, fuse: type === 'frag' ? 2.6 : 1.9, rest: false });
}
function spawnGrenadeArc(x,y,z, tx,tz, type, owner){
  // simple ballistic lob to a ground target in ~1.5s
  const t = 1.5, g = 20;
  const ty = groundAt(tx,tz) + 0.5;
  spawnGrenade(x, y, z, (tx-x)/t, (ty-y)/t + 0.5*g*t, (tz-z)/t, type, owner);
}
function updateThrowables(dt, t){
  for(let i=grenades.length-1; i>=0; i--){
    const n = grenades[i];
    n.fuse -= dt;
    if(!n.rest){
      n.vy -= 20*dt;
      const m = n.mesh.position;
      m.x += n.vx*dt; m.y += n.vy*dt; m.z += n.vz*dt;
      n.mesh.rotation.x += dt*7; n.mesh.rotation.z += dt*5;
      const g = groundAt(m.x, m.z);
      if(m.y < g + 0.12){
        m.y = g + 0.12;
        if(Math.abs(n.vy) > 1.6){
          n.vy *= -0.42; n.vx *= 0.55; n.vz *= 0.55;
          SFX.bounce(Math.hypot(m.x-player.pos.x, m.z-player.pos.z));
        } else { n.vx = 0; n.vy = 0; n.vz = 0; n.rest = true; }
      }
    }
    if(n.fuse <= 0){
      const m = n.mesh.position;
      if(n.type === 'frag') explodeAt(m.x, m.y, m.z, 6.5, 105, n.owner);
      else smokeCloud(m.x, m.y, m.z, t);
      scene.remove(n.mesh);
      grenades.splice(i, 1);
    }
  }
  // expire smoke LOS blockers
  for(let i=foliageBalls.length-1; i>=0; i--){
    if(foliageBalls[i].expire && foliageBalls[i].expire < t) foliageBalls.splice(i, 1);
  }
}
const blastLight = new THREE.PointLight(0xffaa55, 0, 30, 2);
scene.add(blastLight);
let blastT = 0;
function explodeAt(x, y, z, radius, maxDmg, owner){
  // fireball + smoke + dirt
  for(let i=0;i<22;i++){
    const a = randRange(0, Math.PI*2), up = randRange(0.2, 1);
    const s = randRange(4, 11);
    spawnParticle(x, y+0.2, z, Math.cos(a)*s, up*s, Math.sin(a)*s,
      i%3 ? 0xff9a3c : 0xffd27a, randRange(0.10, 0.30), randRange(0.3, 0.7), -12, 2);
  }
  for(let i=0;i<10;i++){
    spawnParticle(x+randRange(-1,1), y+randRange(0,1.5), z+randRange(-1,1),
      randRange(-2,2), randRange(2,5), randRange(-2,2),
      0x4a4440, randRange(0.35, 0.8), randRange(0.8, 1.6), -1.5, 1.5);
  }
  blastLight.position.set(x, y+1, z);
  blastLight.intensity = 6;
  blastT = 0.25;
  const pd = Math.hypot(x-player.pos.x, z-player.pos.z);
  SFX.explosion(pd);
  // damage with light cover check
  function blast(px, py, pz){
    const d = Math.hypot(px-x, py-y, pz-z);
    if(d > radius) return 0;
    let dmg = maxDmg * (1 - d/radius*0.85);
    if(!hasLOS(x, y+0.5, z, px, py+1.0, pz)) dmg *= 0.35;   // walls soak most of it
    return dmg;
  }
  if(player.alive && player.dropState === 'none'){
    const dmg = blast(player.pos.x, player.pos.y, player.pos.z);
    if(dmg > 1){
      damagePlayer(dmg, owner === 'You' ? 'their own grenade' : owner);
      recoil = Math.min(recoil + 0.15, 0.3); flashVignette(0.9);
    }
  }
  for(const b of bots){
    if(!b.alive || !b.active) continue;
    const bp = b.group.position;
    const dmg = blast(bp.x, bp.y, bp.z);
    if(dmg > 1) damageBot(b, dmg, owner, null);
  }
  for(const v of vehicles){
    if(!v.alive) continue;
    const d = Math.hypot(v.group.position.x-x, v.group.position.z-z);
    if(d < radius + 2) damageVehicle(v, 65, owner);
  }
}
function smokeCloud(x, y, z, t){
  for(let i=0;i<16;i++){
    spawnParticle(x+randRange(-1.5,1.5), y+randRange(0.2,2.5), z+randRange(-1.5,1.5),
      randRange(-0.5,0.5), randRange(0.2,0.9), randRange(-0.5,0.5),
      0x9aa0a4, randRange(1.6, 3.2), randRange(8, 13), 0.05, 0.8);
  }
  foliageBalls.push({ x, y: y+1.6, z, r: 5.5, expire: t + 13 });   // blocks bot sight
  SFX.bounce(Math.hypot(x-player.pos.x, z-player.pos.z));
}

// ---------------- loot pickup (player) ----------------
function tryPickup(c){
  if(c.loot === 'medkit' || c.loot === 'frag' || c.loot === 'smoke'){
    if(player.items[c.loot] >= ITEM_CAPS[c.loot]) return;          // leave the crate
    player.items[c.loot]++;
    showToast('PICKED UP ' + ITEM_LABELS[c.loot] + ' (' + player.items[c.loot] + '/' + ITEM_CAPS[c.loot] + ')');
    updateItemsHUD(); updateAmmoHUD();
  } else if(c.loot === 'armor'){
    if(player.armor >= 100) return;
    player.armor = Math.min(100, player.armor + 60);
    showToast('ARMOR EQUIPPED (' + Math.round(player.armor) + ')');
    updateArmorHUD();
  } else {
    const W = WEAPONS[c.loot];
    player.owned[c.loot].reserve += W.mag * 2;
    showToast('PICKED UP ' + W.name + ' AMMO');
    updateAmmoHUD();
  }
  SFX.pickup();
  c.taken = true;
  scene.remove(c.group);
}
