'use strict';
// PUBG Recreation — drivable buggies

const vehicles = [];
const VEHICLE_SPOTS = [
  { x: 8,    z: -54,  hex: 0xb0684a },
  { x: -228, z: 172,  hex: 0x5a7d9c },
  { x: 228,  z: -212, hex: 0x6f8f5a },
  { x: 252,  z: 240,  hex: 0x8f7a4a },
  { x: -316, z: -298, hex: 0x7a5a8f },
  { x: 120,  z: 462,  hex: 0x4a8f8a },
  { x: -492, z: -90,  hex: 0x616a72 },
  { x: 388,  z: -462, hex: 0xa06a3a },
  { x: -85,  z: 680,  hex: 0x9c5a5a },
  { x: 690,  z: 112,  hex: 0x5a7d9c },
  { x: -655, z: -510, hex: 0x6f8f5a },
  { x: -390, z: 95,   hex: 0xb9bdc2 },   // Karona City avenue
  { x: -412, z: 8,    hex: 0xa06a3a },   // city south approach
  { x: 1408, z: 966,  hex: 0x6f8f5a },   // northeast shore
  { x: -1444, z: -308, hex: 0x8f7a4a },  // far west farm
];
// park each buggy on the shoulder of the nearest road
function snapToRoad(sp){
  let best = null, bestR = null, bd = 1e9;
  for(const r of roads){
    const s = distToSeg(sp.x, sp.z, r);
    if(s.d < bd){ bd = s.d; best = s; bestR = r; }
  }
  if(!best) return sp;
  const dx = bestR.bx - bestR.ax, dz = bestR.bz - bestR.az;
  const L = Math.hypot(dx, dz) || 1;
  const px = -dz/L, pz = dx/L;
  return { x: best.x + px*(bestR.hw + 2.4), z: best.z + pz*(bestR.hw + 2.4), hex: sp.hex,
           yaw: Math.atan2(dx, dz) };
}
function makeBuggy(hex){
  const g = new THREE.Group();
  // vertex-colored merged hull: one draw call for ~30 parts (wreck tint via material.color)
  const hullMat  = new THREE.MeshStandardMaterial({ vertexColors:true, flatShading:true, roughness:0.55, metalness:0.20 });
  const glassMat = new THREE.MeshStandardMaterial({ color:0x2b3d4c, flatShading:true, roughness:0.15, metalness:0.3 });
  const wheelMat = new THREE.MeshStandardMaterial({ vertexColors:true, flatShading:true, roughness:0.85 });
  const mats = [hullMat, glassMat, wheelMat];
  const DK = 0x24262a, ST = 0x394048, LAMP = 0xfff8d8, MUD = 0x4a4034;
  const hull = [];
  function hp2(geo, hexc, x,y,z, rx,ry,rz){
    if(rx) geo.rotateX(rx); if(ry) geo.rotateY(ry); if(rz) geo.rotateZ(rz);
    geo.translate(x,y,z);
    hull.push(tintGeo(geo, hexc));
  }
  const B = (w,h,d) => new THREE.BoxGeometry(w,h,d);
  // hull: tub, sloped hood, grille + bumpers, rear deck, door panels, mud skirts
  hp2(B(1.9, 0.44, 3.6), hex, 0, 0.80, 0);
  hp2(B(1.78, 0.24, 1.15), hex, 0, 1.06, 1.30, -0.10);
  hp2(B(1.66, 0.32, 0.14), ST, 0, 0.88, 1.84);
  hp2(B(1.94, 0.15, 0.22), DK, 0, 0.60, 1.92);
  hp2(B(1.94, 0.15, 0.22), DK, 0, 0.60, -1.88);
  hp2(B(1.76, 0.26, 0.95), hex, 0, 1.02, -1.28);
  hp2(B(0.07, 0.42, 1.35), hex, -0.965, 1.10, -0.10);
  hp2(B(0.07, 0.42, 1.35), hex,  0.965, 1.10, -0.10);
  hp2(B(0.05, 0.06, 0.34), ST, -1.00, 1.18, 0.10);           // door handles
  hp2(B(0.05, 0.06, 0.34), ST,  1.00, 1.18, 0.10);
  hp2(B(0.06, 0.26, 3.30), MUD, -0.99, 0.52, 0);
  hp2(B(0.06, 0.26, 3.30), MUD,  0.99, 0.52, 0);
  // headlights + windshield base
  hp2(B(0.28, 0.16, 0.08), LAMP, -0.58, 1.02, 1.90);
  hp2(B(0.28, 0.16, 0.08), LAMP,  0.58, 1.02, 1.90);
  hp2(B(1.60, 0.07, 0.10), ST, 0, 1.20, 0.80);
  // roll cage: posts, roof rails, cross bars
  hp2(B(0.09, 0.62, 0.09), DK, -0.78, 1.48, 0.52, 0.18);
  hp2(B(0.09, 0.62, 0.09), DK,  0.78, 1.48, 0.52, 0.18);
  hp2(B(0.09, 0.74, 0.09), DK, -0.78, 1.50, -0.92);
  hp2(B(0.09, 0.74, 0.09), DK,  0.78, 1.50, -0.92);
  hp2(B(0.09, 0.09, 1.52), DK, -0.79, 1.83, -0.19);
  hp2(B(0.09, 0.09, 1.52), DK,  0.79, 1.83, -0.19);
  hp2(B(1.66, 0.09, 0.09), DK, 0, 1.83, 0.50);
  hp2(B(1.66, 0.09, 0.09), DK, 0, 1.83, -0.90);
  // cockpit: two seats + steering wheel + column
  for(const sx of [-0.42, 0.42]){
    hp2(B(0.60, 0.16, 0.60), DK, sx, 1.06, -0.26);
    hp2(B(0.60, 0.55, 0.13), DK, sx, 1.38, -0.56, 0.14);
  }
  hp2(new THREE.TorusGeometry(0.17, 0.032, 6, 12), DK, -0.42, 1.34, 0.36, -0.62);
  hp2(B(0.06, 0.30, 0.06), ST, -0.42, 1.22, 0.44, -0.62);
  // spare wheel + exhaust
  hp2(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 10), DK, 0, 1.18, -1.90, Math.PI/2);
  hp2(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 6), ST, 0.52, 0.55, -1.78, Math.PI/2);
  const hullMesh = new THREE.Mesh(mergeGeoms(hull), hullMat);
  hullMesh.castShadow = true;
  g.add(hullMesh);
  const wind = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.55, 0.06), glassMat);
  wind.position.set(0, 1.44, 0.74); wind.rotation.x = -0.32; wind.castShadow = true;
  g.add(wind);
  // wheels: tire + bright hub, one merged mesh per wheel in a spin group
  const wheelGeo = (() => {
    const tire = tintGeo(new THREE.CylinderGeometry(0.46, 0.46, 0.34, 12).rotateZ(Math.PI/2), DK);
    const hub  = tintGeo(new THREE.CylinderGeometry(0.21, 0.21, 0.36, 8).rotateZ(Math.PI/2), 0x8a9098);
    return mergeGeoms([tire, hub]);
  })();
  const wheels = [];
  for(const [wx, wz] of [[-1.00, 1.22],[1.00, 1.22],[-1.00, -1.22],[1.00, -1.22]]){
    const wm = new THREE.Mesh(wheelGeo, wheelMat);
    wm.castShadow = true;
    const wg = new THREE.Group();
    wg.position.set(wx, 0.46, wz);
    wg.add(wm);
    g.add(wg);
    wheels.push(wg);
  }
  return { g, wheels, mats };
}
for(const raw of VEHICLE_SPOTS){
  const s = snapToRoad(raw);
  const { g, wheels, mats } = makeBuggy(s.hex);
  const y = groundAt(s.x, s.z);
  g.position.set(s.x, y, s.z);
  g.rotation.y = s.yaw !== undefined ? s.yaw : randRange(0, Math.PI*2);
  scene.add(g);
  const cyl = { x: s.x, z: s.z, r: 1.8, y0: y - 0.5, y1: y + 1.8, kind: 'vehicle', ref: null };
  const v = { group: g, wheels, mats, yaw: g.rotation.y, speed: 0, steer: 0,
              hp: 100, alive: true, cyl, runoverCd: 0 };
  cyl.ref = v;
  solidCyls.push(cyl);
  vehicles.push(v);
}
const interactEl = document.getElementById('interact');
function nearestVehicle(maxD){
  let best = null, bd = maxD;
  for(const v of vehicles){
    if(!v.alive) continue;
    const d = Math.hypot(v.group.position.x - player.pos.x, v.group.position.z - player.pos.z);
    if(d < bd){ bd = d; best = v; }
  }
  return best;
}
function updateInteractPrompt(){
  const show = matchStarted && gameState.playing && player.alive && !player.driving &&
               player.dropState === 'none' && !inventoryOpen && nearestVehicle(4.2);
  interactEl.style.display = show ? 'block' : 'none';
}
function tryVehicleToggle(){
  if(player.driving){
    // hop out on the left side
    const v = player.driving;
    const ox = v.group.position.x + Math.cos(v.yaw)* -2.4;
    const oz = v.group.position.z + Math.sin(v.yaw)* 2.4;
    player.pos.set(ox, groundAt(ox, oz, v.group.position.y + 0.5), oz);
    player.vel.set(0,0,0);
    player.driving = null;
    gunRoot.visible = true;
    SFX.setEngine(false, 0);
    showToast('EXITED VEHICLE');
    return;
  }
  const best = nearestVehicle(4.2);
  if(best){
    player.driving = best;
    player.firing = false; player.aiming = false; player.charging = false; player.scopeLock = false;
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
      const g = groundAt(p.x, p.z, p.y + 0.4);
      p.y = g;
      if(g < -1.9) v.speed *= (1 - dt*2);                        // wading slows you down
      // align to the slope
      const e = 1.6;
      const pitch = Math.atan2(groundAt(p.x - Math.sin(v.yaw)*e, p.z - Math.cos(v.yaw)*e, p.y + 0.4) -
                               groundAt(p.x + Math.sin(v.yaw)*e, p.z + Math.cos(v.yaw)*e, p.y + 0.4), e*2);
      const roll  = Math.atan2(groundAt(p.x + Math.cos(v.yaw)*e, p.z - Math.sin(v.yaw)*e, p.y + 0.4) -
                               groundAt(p.x - Math.cos(v.yaw)*e, p.z + Math.sin(v.yaw)*e, p.y + 0.4), e*2);
      v.group.rotation.set(pitch, v.yaw, roll);
      // wheels
      for(let i=0;i<4;i++){
        v.wheels[i].rotation.x += v.speed*dt*2.4;
        if(i < 2) v.wheels[i].rotation.y = v.steer*0.4;          // front pair steers
      }
      // run over bots — getting hit by a vehicle is lethal or close to it
      v.runoverCd -= dt;
      if(Math.abs(v.speed) > 4.5 && v.runoverCd <= 0){
        for(const b of bots){
          if(!b.alive || !b.active) continue;
          const bp = b.group.position;
          if(Math.hypot(bp.x-p.x, bp.z-p.z) < 2.1){
            // overwhelms armor: even a max-geared bot dies above ~7 m/s, and a slow
            // bump still takes almost all of their health
            damageBot(b, 150 + Math.abs(v.speed)*9, 'You', 'player');
            v.runoverCd = 0.4;
            v.speed *= 0.82;
          }
        }
      }
      // the player rides along
      player.pos.set(p.x, p.y + 0.6, p.z);
      rig.position.copy(player.pos);
      rig.position.y += 0.9;
      rig.rotation.y = player.yaw;
      pitchPivot.rotation.x = player.pitch;
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
