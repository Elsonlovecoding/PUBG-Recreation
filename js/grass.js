'use strict';
// PUBG Recreation — dense instanced grass in a sliding ring around the player.
// One InstancedMesh of crossed alpha-tested quads; cells refill as you move, wind in the shader.

const GRASS = (function(){
  const CELL = 12, RING = 4, SIDE = RING*2;          // 8x8 cells of 12m → 96m square around you
  const PER_CELL = 170;
  const COUNT = SIDE*SIDE*PER_CELL;

  const mat = new THREE.MeshStandardMaterial({
    map: DETAIL.blade, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 1, metalness: 0,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    mat.userData.shader = shader;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', [
        '#include <begin_vertex>',
        '#ifdef USE_INSTANCING',
        '  float wph = instanceMatrix[3][0]*0.53 + instanceMatrix[3][2]*0.71;',   // phase by world pos
        '  transformed.x += sin(uTime*1.9 + wph) * position.y * 0.45;',           // sway the blade tips
        '  transformed.z += cos(uTime*1.5 + wph*1.3) * position.y * 0.28;',
        // sink smoothly into the ground toward the ring edge instead of popping
        '  float gDist = distance(vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]), cameraPosition);',
        '  transformed.y *= 1.0 - smoothstep(34.0, 47.0, gDist);',
        '#endif'].join('\n'));
  };

  // crossed-quad clump (two planes at 90°), roots at y=0
  const geo = (() => {
    const w = 1.05, h = 0.58, hw = w/2;
    const pos = [], nor = [], uv = [], idx = [];
    let vi = 0;
    const quad = (ax, az, bx, bz) => {
      pos.push(ax,0,az,  bx,0,bz,  bx,h,bz,  ax,h,az);
      for(let k=0;k<4;k++) nor.push(0,1,0);            // up-normals: grass lit like the ground
      uv.push(0,0, 1,0, 1,1, 0,1);
      idx.push(vi, vi+1, vi+2, vi, vi+2, vi+3);
      vi += 4;
    };
    quad(-hw, 0, hw, 0);
    quad(0, -hw, 0, hw);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal',   new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv',       new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  })();

  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);

  const dummy = new THREE.Object3D();
  const tcol = new THREE.Color();
  const cellKeys = new Array(SIDE*SIDE).fill(null);
  function rng(seed){
    let s = (seed|0) || 1;
    return () => { s = (s*1103515245 + 12345) & 0x7fffffff; return s/0x7fffffff; };
  }
  function fillCell(slot, cx, cz){
    const rand = rng(cx*73856093 ^ cz*19349663);
    const base = slot*PER_CELL;
    for(let k=0;k<PER_CELL;k++){
      const idx2 = base + k;
      const x = (cx + rand())*CELL, z = (cz + rand())*CELL;
      let ok = Math.max(Math.abs(x), Math.abs(z)) < 1430;
      const h = ok ? heightAt(x, z) : 0;
      if(ok && (h < 0.25 || h > 72)) ok = false;                    // no grass on sand, water, high rock
      if(ok && slopeAt(x, z) > 0.85) ok = false;
      let rfv = 0, rpv = 0;
      if(ok){
        rfv = roadFactorGen(x, z); rpv = pavedFactorGen(x, z);
        if(rfv > 0.12 || rpv > 0.06) ok = false;                    // keep the roads clean
      }
      if(ok && insideBuilding(x, z, 0.8)) ok = false;
      if(!ok){
        dummy.position.set(0, -60, 0); dummy.scale.setScalar(0.001); dummy.rotation.y = 0;
        dummy.updateMatrix();
        mesh.setMatrixAt(idx2, dummy.matrix);
        continue;
      }
      dummy.position.set(x, h, z);
      dummy.scale.setScalar(0.68 + rand()*0.62);
      dummy.rotation.y = rand()*Math.PI*2;
      dummy.updateMatrix();
      mesh.setMatrixAt(idx2, dummy.matrix);
      const c = colorFor(x, z, h, 0, rfv, rpv);                     // tint blades like the ground below
      tcol.setRGB(Math.min(1.3, c[0]*1.5), Math.min(1.3, c[1]*1.44), Math.min(1.3, c[2]*1.4));
      mesh.setColorAt(idx2, tcol);
    }
  }
  const mod = (v, m) => ((v % m) + m) % m;
  function updateGrass(dt){
    const ccx = Math.floor(rig.position.x/CELL), ccz = Math.floor(rig.position.z/CELL);
    // count stale cells: after a teleport/landing fill the whole ring at once,
    // while normal walking streams a few cells per frame
    let stale = 0;
    for(let dj=-RING; dj<RING; dj++) for(let di=-RING; di<RING; di++){
      const cx = ccx+di, cz = ccz+dj;
      if(cellKeys[mod(cx, SIDE) + mod(cz, SIDE)*SIDE] !== cx*200003 + cz) stale++;
    }
    let budget = stale > 20 ? SIDE*SIDE : 4;
    if(stale > 0){
      for(let dj=-RING; dj<RING && budget>0; dj++){
        for(let di=-RING; di<RING && budget>0; di++){
          const cx = ccx+di, cz = ccz+dj;
          const slot = mod(cx, SIDE) + mod(cz, SIDE)*SIDE;   // toroidal slot: stable per world cell
          const key = cx*200003 + cz;
          if(cellKeys[slot] === key) continue;
          cellKeys[slot] = key;
          fillCell(slot, cx, cz);
          budget--;
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      if(mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    if(mat.userData.shader) mat.userData.shader.uniforms.uTime.value += dt;
  }
  return { mesh, updateGrass };
})();
const updateGrass = GRASS.updateGrass;
