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
// the lobby is its own hangar room, floating far off the south coast
const LOBBY_SPOT = { x: 0, z: -2900 };
const LOBBY_FLOOR = 40.2;
const lobbyRoom = (function(){
  const g = new THREE.Group();
  const M = (hex, rough) => new THREE.MeshStandardMaterial({ color:hex, flatShading:true, roughness:rough === undefined ? 1 : rough });
  function box(w,h,d, x,y,z, mat){
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
    m.position.set(x, y, z);
    g.add(m); return m;
  }
  const cx = LOBBY_SPOT.x, cz = LOBBY_SPOT.z, fy = LOBBY_FLOOR;
  const wall = M(0x454c53), dark = M(0x2c3238), floor = M(0x3a3d42, 0.95),
        gold = M(0xb8860b, 0.7), steel = M(0x373d44);
  // fully enclosed hangar so nothing bleeds through the edges
  box(17, 0.4, 13, cx, fy - 0.2, cz - 1);                   // floor
  box(17, 0.4, 13, cx, fy + 5.3, cz - 1);                   // ceiling
  box(17, 5.6, 0.4, cx, fy + 2.6, cz + 3.6, wall);          // back
  box(17, 5.6, 0.4, cx, fy + 2.6, cz - 7.4, wall);          // front (behind camera)
  box(0.4, 5.6, 13, cx - 8.4, fy + 2.6, cz - 1, wall);      // sides
  box(0.4, 5.6, 13, cx + 8.4, fy + 2.6, cz - 1, wall);
  // back-wall dressing: recessed panel, gold pinstripes, girders
  box(11.5, 3.6, 0.14, cx, fy + 2.1, cz + 3.36, dark);
  box(0.16, 3.6, 0.18, cx - 3.6, fy + 2.1, cz + 3.3, gold);
  box(0.16, 3.6, 0.18, cx + 3.6, fy + 2.1, cz + 3.3, gold);
  box(11.5, 0.16, 0.18, cx, fy + 4.0, cz + 3.3, gold);
  for(const gx of [-6, -2, 2, 6]) box(0.5, 5.2, 0.5, cx + gx*1.35, fy + 2.6, cz + 3.1, steel);
  // ceiling light strip above the pad
  const strip = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 0.6), new THREE.MeshBasicMaterial({ color:0xf6f2e8 }));
  strip.position.set(cx, fy + 5.08, cz - 0.6);
  g.add(strip);
  // props: crate stack screen-right (-x), locker + rack rifle screen-left (+x)
  const c1 = new THREE.Mesh(crateBaseGeo, MAT_FLAT); c1.position.set(cx - 4.3, fy, cz + 1.9); c1.rotation.y = 0.4; g.add(c1);
  const c2 = new THREE.Mesh(crateBaseGeo, MAT_FLAT); c2.position.set(cx - 4.15, fy + 0.86, cz + 2.0); c2.rotation.y = -0.2; g.add(c2);
  const med = makeMedkitModel(); med.position.set(cx - 4.15, fy + 1.9, cz + 2.0); med.rotation.y = 0.7; g.add(med);
  box(1.1, 3.2, 0.7, cx + 4.6, fy + 1.6, cz + 3.0, M(0x262c33));
  const rack = buildGunModel('rifle', false);
  rack.position.set(cx + 3.7, fy + 0.62, cz + 3.25);
  rack.rotation.set(0, Math.PI, -0.28);
  g.add(rack);
  // spawn pad
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.1, 24), M(0x51565c, 0.9));
  disc.position.set(cx, fy + 0.05, cz + 0.3);
  g.add(disc);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.68, 1.68, 0.05, 24, 1, true), M(0xf2a900, 0.7));
  ring.position.set(cx, fy + 0.08, cz + 0.3);
  g.add(ring);
  // interior lighting (visible = lobby only, so it never taxes the match)
  const key = new THREE.PointLight(0xfff0dc, 1.35, 24);
  key.position.set(cx, fy + 4.6, cz - 0.8);
  g.add(key);
  const fill = new THREE.PointLight(0x9fc0e8, 0.6, 20);
  fill.position.set(cx - 3.2, fy + 2.2, cz - 3.6);
  g.add(fill);
  const rim = new THREE.PointLight(0xffd9a0, 0.45, 16);
  rim.position.set(cx + 3.4, fy + 3.2, cz + 1.6);
  g.add(rim);
  scene.add(g);
  return g;
})();
function applyOutfit(shirtHex, pantsHex, skinHex, headKey){
  avatar.shirtM.color.setHex(shirtHex);
  avatar.pantsM.color.setHex(pantsHex);
  avatar.skinM.color.setHex(skinHex);
  avatar.currentHead = headKey;
  avatar.shownHead = headKey;
  for(const k of Object.keys(avatar.headgear))
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
    // lobby: in the hangar, facing the camera, slot-1 weapon in hand
    const t = performance.now()*0.001;
    lobbyRoom.visible = true;
    a.group.visible = true;
    a.group.position.set(LOBBY_SPOT.x, LOBBY_FLOOR + 0.1, LOBBY_SPOT.z + 0.3);
    a.group.rotation.y = Math.atan2(rig.position.x - LOBBY_SPOT.x, rig.position.z - (LOBBY_SPOT.z + 0.3))
                         + Math.sin(t*0.4)*0.08;
    a.vest.visible = false;
    for(const w in a.guns) a.guns[w].visible = (w === slotConfig[0]);
    for(const it in a.items) a.items[it].visible = false;
    a.armL.rotation.set(Math.sin(t*1.3)*0.05, 0, 0.06);
    a.armR.rotation.set(-Math.sin(t*1.3)*0.05, 0, -0.06);
    a.legL.rotation.set(0,0,0); a.legR.rotation.set(0,0,0);
    return;
  }
  lobbyRoom.visible = false;
  if(!player.alive || gameState.over){
    a.group.visible = false;
    return;
  }
  a.group.visible = thirdBlend > 0.35;
  a.group.position.copy(player.pos);
  a.group.rotation.y = player.yaw + Math.PI;
  a.vest.visible = player.gear.vest > 0;
  // an equipped helmet overrides your chosen headgear
  const hlv = player.gear.helmet;
  const wantHead = hlv >= 3 ? 'helmet3' : hlv >= 1 ? 'helmet1' : (a.currentHead || 'hair');
  if(a.shownHead !== wantHead){
    a.shownHead = wantHead;
    for(const k in a.headgear) for(const m of a.headgear[k]) m.visible = (k === wantHead);
  }
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
