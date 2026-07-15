'use strict';
// PUBG Recreation — procedural detail textures, generated once at boot (still zero asset files).
// Every texture is tileable and authored around 0.5 gray (the shaders multiply by 2), so they
// carry per-pixel material detail while the vertex colors keep providing the macro tint.

const DETAIL = (function(){
  // value noise on a wrapped lattice — periodic in both axes, so the textures tile perfectly
  function ph(i, j, px, py, seed){
    i = ((i % px) + px) % px; j = ((j % py) + py) % py;
    const s = Math.sin(i*127.1 + j*311.7 + seed*74.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function pnoise(x, y, px, py, seed){
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf*xf*(3-2*xf), v = yf*yf*(3-2*yf);
    return lerp(lerp(ph(xi,yi,px,py,seed),   ph(xi+1,yi,px,py,seed),   u),
                lerp(ph(xi,yi+1,px,py,seed), ph(xi+1,yi+1,px,py,seed), u), v);
  }
  function pfbm(x, y, px, py, oct, seed){
    let a = 0.5, f = 1, sum = 0, norm = 0;
    for(let o = 0; o < oct; o++){
      sum += pnoise(x*f, y*f, px*f, py*f, seed + o*3.17) * a;
      norm += a; a *= 0.5; f *= 2;
    }
    return sum / norm;
  }
  const S = 256;
  function makeTex(fill){
    const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(S, S);
    for(let y = 0; y < S; y++){
      const ny = y / S;
      for(let x = 0; x < S; x++){
        const c = fill(x / S, ny);                         // rgb around 1.0
        const i = (y*S + x) * 4;
        img.data[i]   = clamp(c[0], 0, 2) * 127.5;
        img.data[i+1] = clamp(c[1], 0, 2) * 127.5;
        img.data[i+2] = clamp(c[2], 0, 2) * 127.5;
        img.data[i+3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // clean grassland: soft low-frequency mottle only — no blade streaks, no scraggle
  const grass = makeTex((nx, ny) => {
    const broad = pfbm(nx*4, ny*4, 4, 4, 3, 5);            // gentle patchiness across the field
    const fine  = pfbm(nx*11, ny*11, 11, 11, 2, 9);        // faint even grain
    const v = 0.90 + (broad - 0.5)*0.16 + (fine - 0.5)*0.07;
    return [v*0.97, v*1.02, v*0.93];
  });
  // packed dirt: granular multi-octave with pebbles and pits
  const dirt = makeTex((nx, ny) => {
    let v = 0.74 + pfbm(nx*24, ny*24, 24, 24, 4, 11)*0.5;
    const g = pnoise(nx*118, ny*118, 118, 118, 3);
    if(g > 0.87) v *= 1.26;                                // pebbles catch the light
    else if(g < 0.09) v *= 0.70;                           // pits
    return [v*1.035, v*0.99, v*0.915];
  });
  // cliff rock: layered strata cut by fractures
  const rock = makeTex((nx, ny) => {
    const warp = pfbm(nx*4, ny*4, 4, 4, 2, 31)*1.6;
    const strata = pfbm(nx*3 + warp, ny*22, 3, 22, 3, 17);
    const frac = pfbm(nx*34, ny*34, 34, 34, 3, 27);
    let v = 0.62 + strata*0.52 + (frac - 0.5)*0.42;
    if(Math.abs(frac - 0.48) < 0.016) v *= 0.66;           // crack lines
    return [v, v*1.002, v*1.015];
  });
  // beach sand: fine grain over low ripple bands
  const sand = makeTex((nx, ny) => {
    const rip = Math.sin((nx*14 + pfbm(nx*5, ny*5, 5, 5, 2, 41)*1.4) * Math.PI*2) * 0.05;
    let v = 0.90 + (pfbm(nx*70, ny*70, 70, 70, 3, 43) - 0.5)*0.28 + rip;
    return [v*1.02, v*0.995, v*0.925];
  });
  // alpine snow: soft undulation with sparse sparkle
  const snow = makeTex((nx, ny) => {
    let v = 0.94 + (pfbm(nx*11, ny*11, 11, 11, 3, 53) - 0.5)*0.16;
    if(pnoise(nx*150, ny*150, 150, 150, 57) > 0.94) v *= 1.22;
    return [v*0.99, v*1.0, v*1.03];
  });
  // asphalt: tight aggregate grain, light stones, faint crack veins
  const asphalt = makeTex((nx, ny) => {
    let v = 0.84 + (pfbm(nx*84, ny*84, 84, 84, 3, 61) - 0.5)*0.34;
    const agg = pnoise(nx*160, ny*160, 160, 160, 67);
    if(agg > 0.885) v *= 1.32;
    else if(agg < 0.08) v *= 0.78;
    const crack = pfbm(nx*7, ny*7, 7, 7, 4, 71);
    if(Math.abs(crack - 0.5) < 0.010) v *= 0.58;
    return [v, v, v*1.045];
  });
  // generic concrete/plaster grain for buildings, rocks and props (triplanar)
  const grain = makeTex((nx, ny) => {
    let v = 0.90 + (pfbm(nx*36, ny*36, 36, 36, 3, 81) - 0.5)*0.26;
    if(pnoise(nx*130, ny*130, 130, 130, 83) > 0.92) v *= 1.14;
    const streak = pfbm(nx*3, ny*30, 3, 30, 2, 87);        // faint weather streaks
    v *= 0.97 + streak*0.06;
    return [v, v, v];
  });

  // soft cumulus puff for the billboard clouds: overlapping radial gradients,
  // denser and brighter toward the top, wispy at the base
  const cloudCv = document.createElement('canvas'); cloudCv.width = 256; cloudCv.height = 128;
  {
    const cc = cloudCv.getContext('2d');
    cc.clearRect(0, 0, 256, 128);
    for(let i = 0; i < 18; i++){
      const t = Math.random();
      const px = 34 + Math.random()*188;
      const py = 42 + t*44;                                  // lower puffs sit deeper
      const pr = 16 + Math.random()*30 * (1.15 - t*0.5);
      const a = (0.34 + Math.random()*0.4) * (1.05 - t*0.45);
      const g2 = cc.createRadialGradient(px, py, pr*0.1, px, py, pr);
      g2.addColorStop(0, 'rgba(255,255,255,' + a.toFixed(2) + ')');
      g2.addColorStop(0.7, 'rgba(248,250,253,' + (a*0.5).toFixed(2) + ')');
      g2.addColorStop(1, 'rgba(255,255,255,0)');
      cc.fillStyle = g2;
      cc.fillRect(0, 0, 256, 128);
    }
  }
  const cloud = new THREE.CanvasTexture(cloudCv);

  return { grass, dirt, rock, sand, snow, asphalt, grain, cloud };
})();
