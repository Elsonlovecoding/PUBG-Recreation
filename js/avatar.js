'use strict';
// PUBG Recreation — third-person view: visible player character + orbit camera (V to toggle)

let thirdPerson = false, thirdBlend = 0, thirdPrefBeforeDrop = false;
const avatarMuzzle = new THREE.Object3D();

const avatar = (function(){
  const g = new THREE.Group();
  const M = hex => new THREE.MeshStandardMaterial({ color:hex, flatShading:true, roughness:1 });
  function part(geo, mat, x,y,z, parent){
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x,y,z); m.castShadow = true;
    (parent||g).add(m); return m;
  }
  const shirt = M(0x46525c), pants = M(0x2e3338), skin = M(0xd9a066), dark = M(0x24262a);
  part(new THREE.BoxGeometry(0.62,0.72,0.34), shirt, 0,1.08,0);
  part(new THREE.BoxGeometry(0.64,0.09,0.36), dark, 0,0.76,0);
  const vest = part(new THREE.BoxGeometry(0.68,0.46,0.42), M(0x3a4034), 0,1.16,0);
  part(new THREE.BoxGeometry(0.46,0.52,0.20), M(0x5c4a30), 0,1.16,-0.29);
  const headM = part(new THREE.BoxGeometry(0.36,0.36,0.36), skin, 0,1.66,0);
  const eye = M(0x1e1a16);
  part(new THREE.BoxGeometry(0.055,0.05,0.02), eye, -0.085,0.035,0.18, headM);
  part(new THREE.BoxGeometry(0.055,0.05,0.02), eye,  0.085,0.035,0.18, headM);
  // headgear wardrobe — one visible at a time
  const hairM = M(0x2b2118);
  const hgHair = part(new THREE.BoxGeometry(0.39,0.12,0.39), hairM, 0,0.21,0, headM);
  const capM = M(0x3a4148);
  const hgCap = part(new THREE.BoxGeometry(0.40,0.12,0.40), capM, 0,0.22,0, headM);
  const hgCapBrim = part(new THREE.BoxGeometry(0.38,0.05,0.16), capM, 0,0.17,0.26, headM);
  const hgH1 = part(new THREE.BoxGeometry(0.42,0.20,0.42), M(0xb8bcbe), 0,0.17,0, headM);
  const hgH3 = part(new THREE.BoxGeometry(0.42,0.24,0.42), M(0x2e3438), 0,0.15,0, headM);
  hgCap.visible = hgCapBrim.visible = hgH1.visible = hgH3.visible = false;
  const armL = new THREE.Object3D(); armL.position.set(-0.40,1.38,0); g.add(armL);
  const armR = new THREE.Object3D(); armR.position.set( 0.40,1.38,0); g.add(armR);
  for(const a of [armL, armR]){
    part(new THREE.BoxGeometry(0.18,0.36,0.18), shirt, 0,-0.13,0, a);
    part(new THREE.BoxGeometry(0.15,0.32,0.15), skin, 0,-0.44,0, a);
  }
  const legL = new THREE.Object3D(); legL.position.set(-0.16,0.74,0); g.add(legL);
  const legR = new THREE.Object3D(); legR.position.set( 0.16,0.74,0); g.add(legR);
  for(const l of [legL, legR]){
    part(new THREE.BoxGeometry(0.20,0.60,0.20), pants, 0,-0.30,0, l);
    part(new THREE.BoxGeometry(0.22,0.16,0.24), dark, 0,-0.66,0.01, l);
  }
  // real weapon models in hand, toggled to match the loadout
  const guns = {};
  for(const w of ['rifle','shotgun','sniper']){
    const gun = buildGunModel(w, false);
    gun.rotation.y = Math.PI;
    gun.position.set(-0.02,-0.52,0.22);
    gun.visible = false;
    gun.traverse(o => { if(o.isMesh) o.castShadow = true; });
    armR.add(gun);
    guns[w] = gun;
  }
  const items = {
    medkit: makeMedkitModel(),
    frag: makeGrenadeModel(),
    smoke: makeSmokeModel(),
  };
  for(const k in items){
    items[k].position.set(0,-0.52,0.18);
    items[k].visible = false;
    armR.add(items[k]);
  }
  avatarMuzzle.position.set(0, -0.52, 1.15);
  armR.add(avatarMuzzle);
  g.visible = false;
  scene.add(g);
  return { group:g, armL, armR, legL, legR, vest, guns, items, walkPhase: 0,
           shirtM: shirt, pantsM: pants, skinM: skin, hairM,
           headgear: { hair:[hgHair], cap:[hgCap, hgCapBrim], helmet1:[hgH1], helmet3:[hgH3] } };
})();
const LOBBY_SPOT = { x: -2, z: -40 };
const lobbyPad = (function(){
  const g = new THREE.Group();
  const y = groundAt(LOBBY_SPOT.x, LOBBY_SPOT.z);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.14, 24),
    new THREE.MeshStandardMaterial({ color:0x8d8a84, flatShading:true, roughness:1 }));
  disc.position.set(LOBBY_SPOT.x, y + 0.07, LOBBY_SPOT.z);
  disc.receiveShadow = true;
  g.add(disc);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.62, 2.62, 0.06, 24, 1, true),
    new THREE.MeshStandardMaterial({ color:0xf2a900, flatShading:true, roughness:0.8 }));
  ring.position.set(LOBBY_SPOT.x, y + 0.12, LOBBY_SPOT.z);
  g.add(ring);
  scene.add(g);
  return g;
})();
function applyOutfit(shirtHex, pantsHex, skinHex, headKey){
  avatar.shirtM.color.setHex(shirtHex);
  avatar.pantsM.color.setHex(pantsHex);
  avatar.skinM.color.setHex(skinHex);
  for(const k in avatar.headgear)
    for(const m of avatar.headgear[k]) m.visible = (k === headKey);
}

function setThirdPerson(on){ thirdPerson = !!on; }
function toggleView(){
  setThirdPerson(!thirdPerson);
  showToast(thirdPerson ? 'THIRD PERSON — V TO SWITCH BACK' : 'FIRST PERSON');
}
function effectiveThird(){ return thirdPerson && !scopeShown; }

function updateAvatar(dt){
  const a = avatar;
  if(!matchStarted){
    // lobby: on the staging pad, facing the camera, slot-1 weapon in hand
    const t = performance.now()*0.001;
    lobbyPad.visible = true;
    a.group.visible = true;
    a.group.position.set(LOBBY_SPOT.x, groundAt(LOBBY_SPOT.x, LOBBY_SPOT.z) + 0.14, LOBBY_SPOT.z);
    a.group.rotation.y = Math.atan2(rig.position.x - LOBBY_SPOT.x, rig.position.z - LOBBY_SPOT.z)
                         + Math.sin(t*0.4)*0.10;
    a.vest.visible = false;
    for(const w in a.guns) a.guns[w].visible = (w === slotConfig[0]);
    for(const it in a.items) a.items[it].visible = false;
    a.armL.rotation.set(Math.sin(t*1.3)*0.05, 0, 0.06);
    a.armR.rotation.set(-Math.sin(t*1.3)*0.05, 0, -0.06);
    a.legL.rotation.set(0,0,0); a.legR.rotation.set(0,0,0);
    return;
  }
  lobbyPad.visible = false;
  if(!player.alive || gameState.over){
    a.group.visible = false;
    return;
  }
  a.group.visible = thirdBlend > 0.35;
  a.group.position.copy(player.pos);
  a.group.rotation.y = player.yaw + Math.PI;
  a.vest.visible = player.armor > 0;
  for(const w in a.guns) a.guns[w].visible = player.holding === 'gun' && w === player.weapon;
  for(const it in a.items) a.items[it].visible = player.holding === it;

  const hs = Math.hypot(player.vel.x, player.vel.z);
  if(player.dropState === 'free'){
    a.armL.rotation.set(-0.4, 0, 2.2); a.armR.rotation.set(-0.4, 0, -2.2);   // spread eagle
    a.legL.rotation.set(0.5,0,0.25); a.legR.rotation.set(0.3,0,-0.25);
  } else if(player.dropState === 'chute'){
    a.armL.rotation.set(-2.7, 0, 0.25); a.armR.rotation.set(-2.7, 0, -0.25); // on the risers
    a.legL.rotation.set(0.18,0,0.06); a.legR.rotation.set(-0.08,0,-0.06);
  } else if(player.driving){
    a.group.position.y += 0.42;
    a.armL.rotation.set(-0.95,0,0.1); a.armR.rotation.set(-0.95,0,-0.1);     // hands on the wheel
    a.legL.rotation.set(-1.35,0,0); a.legR.rotation.set(-1.35,0,0);
  } else {
    a.walkPhase += dt * hs * 2.4;
    const s = Math.sin(a.walkPhase);
    const amp = clamp(hs/6, 0, 1) * 0.6;
    a.legL.rotation.set(s*amp, 0, 0); a.legR.rotation.set(-s*amp, 0, 0);
    const combat = player.aiming || player.firing || player.charging || player.holding !== 'gun' || player.healing > 0;
    if(combat){
      a.armR.rotation.set(-1.25 - player.pitch*0.6, 0, 0);
      a.armL.rotation.set(-0.9 - player.pitch*0.4, 0, 0);
    } else {
      a.armL.rotation.set(-s*amp*0.8, 0, 0);
      a.armR.rotation.set(s*amp*0.8, 0, 0);
    }
  }
}

const _camEye = new THREE.Vector3(), _camWant = new THREE.Vector3(), _camDir = new THREE.Vector3();
function updateCameraRig(dt){
  const want = (matchStarted && effectiveThird() && player.alive) ? 1 : 0;
  thirdBlend = lerp(thirdBlend, want, Math.min(1, dt*8));
  if(thirdBlend < 0.01){
    camera.position.set(0, 0, 0);
  } else {
    let dist = 4.6 * thirdBlend * (1 - player.aimBlend*0.45);
    // don't clip through terrain or walls
    head.getWorldPosition(_camEye);
    _camWant.set(0.55*thirdBlend, 0.30*thirdBlend, dist);
    pitchPivot.updateMatrixWorld();
    pitchPivot.localToWorld(_camWant);
    _camDir.copy(_camWant).sub(_camEye);
    const len = _camDir.length();
    if(len > 0.05){
      _camDir.multiplyScalar(1/len);
      const hit = castShot(_camEye, _camDir, len + 0.3, 'player');
      if(hit.kind !== 'none' && hit.t < len) dist *= Math.max(0.12, (hit.t - 0.25) / len);
    }
    camera.position.set(0.55*thirdBlend, 0.30*thirdBlend, dist);
  }
  // the first-person viewmodel exists only in first person, on foot, unscoped
  gunRoot.visible = matchStarted && gameState.playing && player.alive &&
    thirdBlend < 0.35 && !scopeShown && player.dropState === 'none' && !player.driving;
}
