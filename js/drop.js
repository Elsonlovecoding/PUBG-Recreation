'use strict';
// PUBG Recreation — the plane drop: cargo plane, freefall, parachutes (bots too)

let dropActive = false, dropEnded = false, planeT = 0, dropWasOver = false;
const PLANE_Y = 280, PLANE_SPEED = 96;
const dropPath = { sx:0, sz:0, ex:0, ez:0, dur: 1 };

const plane = (function(){
  const g = new THREE.Group();
  const fus = new THREE.MeshStandardMaterial({ color:0x5f6d64, flatShading:true, roughness:0.8 });
  const dk  = new THREE.MeshStandardMaterial({ color:0x39413c, flatShading:true, roughness:0.8 });
  function part(geo, mat, x,y,z){
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x,y,z); g.add(m); return m;
  }
  part(new THREE.BoxGeometry(3.2, 3.0, 17), fus, 0, 0, 0);                 // fuselage
  part(new THREE.BoxGeometry(2.6, 1.4, 3), dk, 0, 0.9, 7.6);               // nose/cockpit
  part(new THREE.BoxGeometry(19, 0.35, 3.4), fus, 0, 1.2, 1.5);            // wings
  part(new THREE.BoxGeometry(0.35, 3.0, 2.6), fus, 0, 2.2, -7.6);          // tail fin
  part(new THREE.BoxGeometry(7, 0.3, 2), fus, 0, 1.6, -7.4);               // tailplane
  for(const sx of [-1, 1]){
    part(new THREE.CylinderGeometry(0.5, 0.5, 2.4, 8), dk, sx*5.2, 0.6, 2.2).rotation.x = Math.PI/2;
    part(new THREE.CylinderGeometry(0.5, 0.5, 2.4, 8), dk, sx*9.0, 0.6, 2.0).rotation.x = Math.PI/2;
  }
  g.visible = false;
  scene.add(g);
  return g;
})();

function makeChute(scale, hex){
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(1.7*scale, 1.1*scale, 8),
    new THREE.MeshStandardMaterial({ color: hex, flatShading:true, roughness:1, side:THREE.DoubleSide }));
  cone.castShadow = false;
  return cone;
}
const playerChute = makeChute(1.7, 0xe8683a);
playerChute.visible = false;
rig.add(playerChute);
playerChute.position.set(0, 4.4, 0);

function startDrop(){
  dropActive = true; dropEnded = false; planeT = 0; dropWasOver = false;
  const a = randRange(0, Math.PI*2);
  const dx = Math.cos(a), dz = Math.sin(a);
  const off = randRange(-300, 300);
  const cx = -dz*off, cz = dx*off;                     // perpendicular offset through the middle
  dropPath.sx = cx - dx*1900; dropPath.sz = cz - dz*1900;
  dropPath.ex = cx + dx*1900; dropPath.ez = cz + dz*1900;
  dropPath.dur = 3800 / PLANE_SPEED;
  plane.visible = true;
  plane.rotation.y = Math.atan2(dx, dz);
  player.dropState = 'plane';
  player.pitch = -0.42;                          // start looking down at the island
  gunRoot.visible = false;
  document.getElementById('dropmsg').style.display = 'block';
  // bots pick their exit points nearest their preferred landing spots
  for(const b of bots){
    b.active = false;
    b.group.visible = false;
    const px = b.landing.x - dropPath.sx, pz = b.landing.z - dropPath.sz;
    const along = clamp((px*dx + pz*dz) / 3800, 0.08, 0.94);
    b.jumpAt = along * dropPath.dur + randRange(-0.8, 0.8);
    b.dropY = PLANE_Y + randRange(-2, 2);
    b.dropping = false;
  }
}
function planePos(t){
  const f = clamp(t / dropPath.dur, 0, 1);
  return { x: lerp(dropPath.sx, dropPath.ex, f), z: lerp(dropPath.sz, dropPath.ez, f) };
}
function overIsland(pp){ return Math.max(Math.abs(pp.x), Math.abs(pp.z)) < 1100; }
function jumpFromPlane(){
  if(player.dropState !== 'plane') return;
  const pp = planePos(planeT);
  if(!overIsland(pp)) return;                     // not over land yet
  player.pos.set(pp.x, PLANE_Y - 4, pp.z);
  player.vel.set(0, 0, 0);
  player.dropState = 'free';
  thirdPrefBeforeDrop = thirdPerson;
  setThirdPerson(true);                        // PUBG-style: watch yourself dive
  document.getElementById('dropmsg').style.display = 'none';
  showToast('STEER WITH WASD TO PICK YOUR SPOT');
  SFX.click();
}
function finishPlayerLanding(){
  player.dropState = 'none';
  player.vel.set(0, 0, 0);
  playerChute.visible = false;
  setThirdPerson(thirdPrefBeforeDrop);         // back to your preferred view
  dropEnded = true;                       // the zone clock starts now
  SFX.land(); SFX.setFall(0);
  dustPuff(player.pos.x, player.pos.y, player.pos.z);
  showToast('GOOD LUCK OUT THERE');
}
function updateDrop(dt){
  planeT += dt;
  const pp = planePos(planeT);
  const planeDone = planeT >= dropPath.dur;
  if(!planeDone){
    plane.position.set(pp.x, PLANE_Y, pp.z);
    SFX.setPlane(Math.hypot(pp.x - rig.position.x, pp.z - rig.position.z));
  } else if(plane.visible){
    plane.visible = false;
    SFX.setPlane(null);
  }

  // ---- the player ----
  if(player.dropState === 'plane'){
    player.pos.set(pp.x, PLANE_Y - 3, pp.z);
    rig.position.copy(player.pos);
    rig.rotation.y = player.yaw;
    pitchPivot.rotation.x = player.pitch;
    const over = overIsland(pp);
    document.getElementById('dropmsg').innerHTML = over ? 'PRESS <b>F</b> TO JUMP' : 'APPROACHING THE ISLAND…';
    if(over) dropWasOver = true;
    if((dropWasOver && !over) || planeT >= dropPath.dur - 1){
      dropWasOver = true;                          // force the exit at the last chance
      const forced = planePos(Math.min(planeT, dropPath.dur - 1));
      player.pos.set(clamp(forced.x, -1080, 1080), PLANE_Y - 4, clamp(forced.z, -1080, 1080));
      player.vel.set(0, 0, 0);
      player.dropState = 'free';
      thirdPrefBeforeDrop = thirdPerson;
      setThirdPerson(true);
      document.getElementById('dropmsg').style.display = 'none';
    }
  } else if(player.dropState === 'free' || player.dropState === 'chute'){
    const chute = player.dropState === 'chute';
    // steer with WASD relative to the camera
    let ix = 0, iz = 0;
    if(keys.KeyW) iz -= 1;  if(keys.KeyS) iz += 1;
    if(keys.KeyA) ix -= 1;  if(keys.KeyD) ix += 1;
    if(ix || iz){
      const inv = 1/Math.hypot(ix, iz);
      ix *= inv; iz *= inv;
      const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
      const ax = (ix*cos + iz*sin), az = (-ix*sin + iz*cos);
      const ctrl = chute ? 15 : 30;
      const acc = chute ? 26 : 34;
      player.vel.x = clamp(player.vel.x + ax*acc*dt, -ctrl, ctrl);
      player.vel.z = clamp(player.vel.z + az*acc*dt, -ctrl, ctrl);
    } else {
      player.vel.x *= (1 - dt*0.8);
      player.vel.z *= (1 - dt*0.8);
    }
    // lean on the keys to glide (slower fall, real reach), hands off to plummet
    const targetVy = chute ? -6.0 : ((ix || iz) ? -30 : -42);
    player.vel.y = lerp(player.vel.y, targetVy, Math.min(1, dt*(chute ? 3.2 : 1.4)));
    player.pos.x = clamp(player.pos.x + player.vel.x*dt, -1140, 1140);   // stay inside the surf line
    player.pos.z = clamp(player.pos.z + player.vel.z*dt, -1140, 1140);
    player.pos.y += player.vel.y*dt;
    SFX.setFall(Math.abs(player.vel.y) + Math.hypot(player.vel.x, player.vel.z)*0.3);
    const g = groundAt(player.pos.x, player.pos.z, player.pos.y);
    if(!chute && player.pos.y < g + 32){
      player.dropState = 'chute';
      playerChute.visible = true;
      SFX.click();
    }
    if(player.pos.y <= g){
      player.pos.y = g;
      finishPlayerLanding();
    }
    rig.position.copy(player.pos);
    rig.rotation.y = player.yaw;
    pitchPivot.rotation.x = player.pitch;
    camera.rotation.z = Math.sin(performance.now()*0.0016) * (chute ? 0.05 : 0.015);
    playerChute.rotation.z = Math.sin(performance.now()*0.0013) * 0.12;
  }

  // ---- the bots bail out along the flight path ----
  let allLanded = player.dropState === 'none';
  for(const b of bots){
    if(b.active || !b.alive) continue;
    allLanded = false;
    if(!b.dropping){
      if(planeT >= b.jumpAt){
        b.dropping = true;
        b.group.visible = true;
        const jp = planePos(Math.min(b.jumpAt, dropPath.dur));
        b.group.position.set(jp.x, b.dropY, jp.z);
      }
      continue;
    }
    const p = b.group.position;
    const g = groundAt(b.landing.x, b.landing.z);
    const fall = p.y > g + 70 ? 30 : 8;                 // freefall, then canopy
    if(fall === 8 && !b.chute){
      b.chute = makeChute(1.3, SHIRT_COLORS[(Math.random()*8)|0]);
      b.chute.position.y = 3.1;
      b.group.add(b.chute);
    }
    p.y -= fall*dt;
    p.x = lerp(p.x, b.landing.x, Math.min(1, dt*0.55));
    p.z = lerp(p.z, b.landing.z, Math.min(1, dt*0.55));
    if(p.y <= groundAt(p.x, p.z)){
      p.y = groundAt(p.x, p.z);
      if(b.chute){ b.group.remove(b.chute); b.chute = null; }
      b.active = true;
      b.thinkT = randRange(0.3, 1.2);
    }
  }
  if(planeDone && allLanded && player.dropState === 'none') dropActive = false;
}
