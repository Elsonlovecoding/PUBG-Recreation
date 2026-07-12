'use strict';
// PUBG Recreation — particles, tracers, impact FX

// ---------------- particles / tracers / FX pools ----------------
const particleGeo = new THREE.BoxGeometry(1,1,1);
const particleMats = {};
function pMat(hex){
  if(!particleMats[hex]) particleMats[hex] = new THREE.MeshBasicMaterial({ color:hex });
  return particleMats[hex];
}
const particles = [];
function spawnParticle(x,y,z, vx,vy,vz, hex, size, life, gravity, drag){
  const m = new THREE.Mesh(particleGeo, pMat(hex));
  m.position.set(x,y,z);
  m.scale.setScalar(size);
  scene.add(m);
  particles.push({ m, vx, vy, vz, life, maxLife:life, size, gravity, drag });
}
function burstSparks(x,y,z, hex, n, speed){
  for(let i=0;i<n;i++){
    const a = randRange(0,Math.PI*2), b2 = randRange(-1,1);
    const s = randRange(speed*0.4, speed);
    spawnParticle(x,y,z, Math.cos(a)*s*Math.sqrt(1-b2*b2), Math.abs(b2)*s+1.5, Math.sin(a)*s*Math.sqrt(1-b2*b2),
      hex, randRange(0.03,0.08), randRange(0.18,0.4), -14, 2);
  }
}
function dustPuff(x,y,z){
  for(let i=0;i<3;i++){
    spawnParticle(x+randRange(-0.2,0.2), y+0.08, z+randRange(-0.2,0.2),
      randRange(-0.5,0.5), randRange(0.6,1.4), randRange(-0.5,0.5),
      0xb5a488, randRange(0.10,0.22), randRange(0.35,0.6), 1.2, 3);
  }
}
function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.life -= dt;
    if(p.life <= 0){ scene.remove(p.m); particles.splice(i,1); continue; }
    const dr = Math.max(0, 1 - p.drag*dt);
    p.vx *= dr; p.vz *= dr; p.vy += p.gravity*dt;
    p.m.position.x += p.vx*dt; p.m.position.y += p.vy*dt; p.m.position.z += p.vz*dt;
    p.m.scale.setScalar(Math.max(0.001, p.size * (p.life/p.maxLife)));
  }
}
// tracers
const tracers = [];
const tracerMats = {};
function tMat(hex){
  if(!tracerMats[hex]) tracerMats[hex] = new THREE.MeshBasicMaterial({
    color:hex, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false });
  return tracerMats[hex];
}
const tracerGeo = new THREE.BoxGeometry(0.035, 0.035, 1);
function spawnTracer(ax,ay,az, bx,by,bz, hex){
  const m = new THREE.Mesh(tracerGeo, tMat(hex));
  const len = Math.hypot(bx-ax, by-ay, bz-az);
  m.position.set((ax+bx)/2, (ay+by)/2, (az+bz)/2);
  m.lookAt(bx,by,bz);
  m.scale.z = len;
  scene.add(m);
  tracers.push({ m, life: 0.075 });
}
function updateTracers(dt){
  for(let i=tracers.length-1;i>=0;i--){
    tracers[i].life -= dt;
    if(tracers[i].life <= 0){ scene.remove(tracers[i].m); tracers.splice(i,1); }
  }
}
// impact FX by surface
function impactFX(hit){
  if(hit.kind==='terrain') burstSparks(hit.x, hit.y+0.05, hit.z, 0x9a8a6a, 5, 3.2);
  else if(hit.kind==='wall') burstSparks(hit.x, hit.y, hit.z, 0xd8d0b8, 5, 3.2);
  else if(hit.kind==='bot' || hit.kind==='player') burstSparks(hit.x, hit.y, hit.z, 0xffca7a, 7, 3.8);
}
