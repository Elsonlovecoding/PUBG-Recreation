'use strict';
// PUBG Recreation — drivable buggies

const vehicles = [];
const VEHICLE_SPOTS = [
  { x: 8,    z: -54,  hex: 0xb0684a },
  { x: -228, z: 172,  hex: 0x5a7d9c },
  { x: 228,  z: -212, hex: 0x6f8f5a },
  { x: 252,  z: 240,  hex: 0x8f7a4a },
  { x: -316, z: -298, hex: 0x7a5a8f },
];
function makeBuggy(hex){
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color:hex, flatShading:true, roughness:0.7, metalness:0.1 });
  const dark  = new THREE.MeshStandardMaterial({ color:0x24262a, flatShading:true, roughness:0.9 });
  const glass = new THREE.MeshStandardMaterial({ color:0x27343f, flatShading:true, roughness:0.4 });
  const mats = [paint, dark, glass];
  function part(geo, mat, x,y,z, rz){
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x,y,z);
    if(rz) m.rotation.z = rz;
    m.castShadow = true;
    g.add(m); return m;
  }
  part(new THREE.BoxGeometry(1.9, 0.5, 3.4), paint, 0, 0.75, 0);                 // chassis
  part(new THREE.BoxGeometry(1.7, 0.35, 1.1), paint, 0, 1.05, -1.0);             // hood... rear deck
  part(new THREE.BoxGeometry(1.6, 0.45, 1.2), glass, 0, 1.25, 0.55);             // windshield block
  part(new THREE.BoxGeometry(0.12, 0.65, 0.12), dark, -0.8, 1.35, -0.4);         // rollcage
  part(new THREE.BoxGeometry(0.12, 0.65, 0.12), dark,  0.8, 1.35, -0.4);
  part(new THREE.BoxGeometry(1.72, 0.12, 0.12), dark,  0, 1.72, -0.4);
  part(new THREE.BoxGeometry(0.9, 0.25, 0.7), dark, 0, 1.0, -0.2);               // seat
  const wheels = [];
  for(const [wx, wz] of [[-0.95, 1.15],[0.95, 1.15],[-0.95, -1.15],[0.95, -1.15]]){
    const w = part(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), dark, wx, 0.42, wz, Math.PI/2);
    wheels.push(w);
  }
  return { g, wheels, mats };
}
for(const s of VEHICLE_SPOTS){
  const { g, wheels, mats } = makeBuggy(s.hex);
  const y = groundAt(s.x, s.z);
  g.position.set(s.x, y, s.z);
  g.rotation.y = randRange(0, Math.PI*2);
  scene.add(g);
  const cyl = { x: s.x, z: s.z, r: 1.8, y0: y - 0.5, y1: y + 1.8, kind: 'vehicle', ref: null };
  const v = { group: g, wheels, mats, yaw: g.rotation.y, speed: 0, steer: 0,
              hp: 100, alive: true, cyl, runoverCd: 0 };
  cyl.ref = v;
  solidCyls.push(cyl);
  vehicles.push(v);
}
function tryVehicleToggle(){
  if(player.driving){
    // hop out on the left side
    const v = player.driving;
    const ox = v.group.position.x + Math.cos(v.yaw)* -2.4;
    const oz = v.group.position.z + Math.sin(v.yaw)* 2.4;
    player.pos.set(ox, groundAt(ox, oz), oz);
    player.vel.set(0,0,0);
    player.driving = null;
    gunRoot.visible = true;
    SFX.setEngine(false, 0);
    showToast('EXITED VEHICLE');
    return;
  }
  let best = null, bd = 4.2;
  for(const v of vehicles){
    if(!v.alive) continue;
    const d = Math.hypot(v.group.position.x - player.pos.x, v.group.position.z - player.pos.z);
    if(d < bd){ bd = d; best = v; }
  }
  if(best){
    player.driving = best;
    player.firing = false; player.aiming = false; player.charging = false;
    cancelHeal();
    if(player.holding !== 'gun') holsterItem();
    gunRoot.visible = false;
    setScopeUI(false);
    showToast('W/S DRIVE · A/D STEER · F EXIT');
  }
}
function damageVehicle(v, dmg, killer){
  if(!v.alive) return;
  v.hp -= dmg;
  const p = v.group.position;
  burstSparks(p.x, p.y + 1, p.z, 0xffd080, 4, 3.5);
  if(v.hp < 40){
    spawnParticle(p.x, p.y+1.3, p.z, randRange(-0.5,0.5), randRange(1.5,3), randRange(-0.5,0.5),
      0x333333, randRange(0.3,0.6), randRange(0.7,1.2), 0.2, 1);
  }
  if(v.hp <= 0){
    v.alive = false;
    if(player.driving === v){ player.driving = null; gunRoot.visible = true; SFX.setEngine(false, 0); }
    explodeAt(p.x, p.y + 0.8, p.z, 7, 110, killer || 'THE ZONE');
    for(const m of v.mats) m.color.multiplyScalar(0.25);   // charred wreck
    v.speed = 0;
  }
}
function updateVehicles(dt){
  for(const v of vehicles){
    const p = v.group.position;
    if(player.driving === v && v.alive){
      // driving input
      let accel = 0;
      if(keys.KeyW) accel = 11;
      else if(keys.KeyS) accel = v.speed > 0.5 ? -14 : -6;
      let steer = 0;
      if(keys.KeyA) steer = 1;
      if(keys.KeyD) steer = -1;
      v.steer = lerp(v.steer, steer, Math.min(1, dt*7));
      v.speed += accel*dt;
      v.speed -= v.speed * 0.5 * dt;                             // drag
      v.speed = clamp(v.speed, -6, 16);
      if(Math.abs(v.speed) < 0.05 && !accel) v.speed = 0;
      v.yaw += v.steer * dt * 1.5 * clamp(v.speed/7, -1, 1);
      const nx = p.x + Math.sin(v.yaw)*v.speed*dt;
      const nz = p.z + Math.cos(v.yaw)*v.speed*dt;
      // hit something solid?
      let blocked = false;
      for(const c of colliders){
        if(nx > c.minX-1.4 && nx < c.maxX+1.4 && nz > c.minZ-1.4 && nz < c.maxZ+1.4 &&
           p.y+1 > c.minY && p.y < c.maxY){ blocked = true; break; }
      }
      if(!blocked) for(const c of solidCyls){
        if(c.ref === v || c.kind === 'vehicle' && !c.ref.alive) continue;
        const d = Math.hypot(nx-c.x, nz-c.z);
        if(d < c.r + 1.5 && p.y < c.y1 && p.y+1.5 > c.y0){ blocked = true; break; }
      }
      if(blocked){
        if(Math.abs(v.speed) > 8) damageVehicle(v, 15, 'a crash');
        v.speed *= -0.25;
      } else {
        p.x = clamp(nx, -HALF+6, HALF-6);
        p.z = clamp(nz, -HALF+6, HALF-6);
      }
      const g = groundAt(p.x, p.z);
      p.y = g;
      if(g < -1.9) v.speed *= (1 - dt*2);                        // wading slows you down
      // align to the slope
      const e = 1.6;
      const pitch = Math.atan2(groundAt(p.x - Math.sin(v.yaw)*e, p.z - Math.cos(v.yaw)*e) -
                               groundAt(p.x + Math.sin(v.yaw)*e, p.z + Math.cos(v.yaw)*e), e*2);
      const roll  = Math.atan2(groundAt(p.x + Math.cos(v.yaw)*e, p.z - Math.sin(v.yaw)*e) -
                               groundAt(p.x - Math.cos(v.yaw)*e, p.z + Math.sin(v.yaw)*e), e*2);
      v.group.rotation.set(pitch, v.yaw, roll);
      // wheels
      for(let i=0;i<4;i++){
        v.wheels[i].rotation.x += v.speed*dt*2.4;
        if(i < 2) v.wheels[i].rotation.y = v.steer*0.4;          // front pair steers
      }
      // run over bots
      v.runoverCd -= dt;
      if(Math.abs(v.speed) > 6 && v.runoverCd <= 0){
        for(const b of bots){
          if(!b.alive || !b.active) continue;
          const bp = b.group.position;
          if(Math.hypot(bp.x-p.x, bp.z-p.z) < 2.1){
            damageBot(b, 120, 'You', 'player');
            v.runoverCd = 0.4;
            v.speed *= 0.8;
          }
        }
      }
      // the player rides along
      player.pos.set(p.x, p.y + 0.6, p.z);
      rig.position.copy(player.pos);
      rig.position.y += 0.9;
      rig.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;
      SFX.setEngine(true, v.speed);
      // zone still hurts drivers — handled by updateZone via player.pos
    } else if(v.alive){
      v.speed = 0;
    }
    // keep the shared collision cylinder in sync
    v.cyl.x = p.x; v.cyl.z = p.z;
    v.cyl.y0 = p.y - 0.5; v.cyl.y1 = p.y + 1.8;
  }
}
