'use strict';
// PUBG Recreation — village/road layout, noise heightfield, per-pixel splat-textured terrain

// ---------------- world layout : buildings & dirt roads ----------------
const WORLD = 4000, HALF = WORLD/2;
// clusters: Oakfield village (center), Riverside hamlet (NW), military depot (SE),
// hilltop farm (NE), Karona City (W) and lone houses scattered around the island
const buildings = [
  // Oakfield
  { x:-20, z:-30, w:12, d:9,  h:4.6, door:'E' },
  { x:-22, z:-8,  w:10, d:8,  h:4.2, door:'E' },
  { x:-19, z:14,  w:13, d:10, h:6.4, door:'E', style:'apartment' },
  { x: 16, z:-32, w:11, d:9,  h:4.4, door:'W' },
  { x: 18, z:-6,  w:9,  d:12, h:4.2, door:'W' },
  { x: 17, z:18,  w:12, d:9,  h:4.6, door:'W' },
  { x: -2, z:44,  w:14, d:11, h:6.6, door:'S', style:'apartment' },
  // Riverside hamlet
  { x:-295, z:163, w:11, d:9,  h:4.4, door:'N' },
  { x:-272, z:161, w:10, d:8,  h:4.2, door:'N' },
  { x:-247, z:164, w:12, d:10, h:4.8, door:'N' },
  { x:-293, z:199, w:10, d:9,  h:4.4, door:'S' },
  { x:-266, z:201, w:13, d:9,  h:6.4, door:'S', style:'apartment' },
  { x:-240, z:198, w:9,  d:8,  h:4.2, door:'S' },
  // military depot (big flat-roof warehouses)
  { x:200, z:-243, w:16, d:12, h:6.5, door:'N', flat:true },
  { x:232, z:-245, w:14, d:11, h:6.0, door:'N', flat:true },
  { x:205, z:-196, w:15, d:11, h:6.2, door:'S', flat:true },
  { x:240, z:-194, w:12, d:10, h:5.5, door:'S', flat:true },
  { x:262, z:-222, w:10, d:9,  h:5.0, door:'W', flat:true },
  // hilltop farm
  { x:232, z:242, w:15, d:10, h:6.6, door:'E', style:'barn' },
  { x:255, z:262, w:10, d:8,  h:4.2, door:'S' },
  { x:222, z:266, w:7,  d:6,  h:3.2, door:'S', style:'shed' },
  // lone houses
  { x:-350, z:-40,  w:11, d:9, h:4.4, door:'E' },
  { x: 350, z:60,   w:10, d:9, h:4.4, door:'W' },
  { x:-60,  z:-300, w:12, d:9, h:4.6, door:'N' },
  { x:-280, z:-180, w:10, d:8, h:4.2, door:'E' },
  { x: 120, z:330,  w:11, d:9, h:4.6, door:'S' },
  { x: 60,  z:-120, w:10, d:8, h:4.2, door:'W' },
  // south farm
  { x:-320, z:-315, w:14, d:10, h:6.6, door:'N', style:'barn' },
  { x:-345, z:-300, w:10, d:8,  h:4.2, door:'E' },
  { x:-300, z:-338, w:8,  d:7,  h:3.6, door:'N' },
  // east row
  { x: 335, z:295,  w:11, d:9,  h:6.2, door:'W', style:'house2' },
  { x: 338, z:322,  w:10, d:8,  h:4.2, door:'W' },
  // far lone houses
  { x: 0,   z:360,  w:11, d:9,  h:4.6, door:'S' },
  { x:-360, z:180,  w:10, d:8,  h:4.2, door:'E' },
  // Northpoint village
  { x:100, z:455, w:12, d:9,  h:6.4, door:'N', style:'apartment' },
  { x:124, z:452, w:10, d:8,  h:4.2, door:'N' },
  { x:148, z:456, w:11, d:9,  h:6.2, door:'N', style:'house2' },
  { x:106, z:486, w:13, d:9,  h:4.6, door:'S' },
  { x:134, z:488, w:8,  d:6,  h:3.2, door:'S', style:'shed' },
  { x:158, z:485, w:10, d:8,  h:4.4, door:'S' },
  // the quarry
  { x:-505, z:-95,  w:16, d:12, h:6.5, door:'E', style:'warehouse', flat:true },
  { x:-478, z:-118, w:9,  d:7,  h:3.4, door:'N', style:'shed' },
  { x:-482, z:-78,  w:8,  d:6,  h:3.2, door:'S', style:'shed' },
  // south ridge farm
  { x:375, z:-465, w:15, d:10, h:6.8, door:'E', style:'barn' },
  { x:402, z:-478, w:10, d:8,  h:4.4, door:'W' },
  // far corners
  { x:500,  z:200,  w:11, d:9, h:4.6, door:'W' },
  { x:-460, z:360,  w:10, d:8, h:4.2, door:'E' },
  { x:-160, z:500,  w:11, d:9, h:6.2, door:'S', style:'house2' },
  { x:520,  z:-140, w:10, d:8, h:4.2, door:'W' },
  { x:-450, z:-420, w:12, d:9, h:5.8, door:'N', style:'barn' },
  // outer ring
  { x:-95,  z:695,  w:11, d:8,  h:4.4, door:'S' },              // north shore camp
  { x:-68,  z:702,  w:8,  d:7,  h:3.4, door:'S', style:'shed' },
  { x:695,  z:105,  w:15, d:10, h:6.6, door:'W', style:'barn' },  // east farm
  { x:702,  z:138,  w:10, d:8,  h:4.4, door:'S' },
  { x:-672, z:-512, w:16, d:12, h:6.5, door:'E', style:'warehouse', flat:true },  // southwest outpost
  { x:-645, z:-535, w:8,  d:7,  h:3.4, door:'N', style:'shed' },
  { x:620,  z:560,  w:11, d:9,  h:6.2, door:'W', style:'house2' },
  { x:-700, z:300,  w:10, d:8,  h:4.2, door:'E' },
  { x:250,  z:-700, w:11, d:9,  h:4.6, door:'N' },
  { x:-350, z:680,  w:10, d:8,  h:4.2, door:'S' },
  { x:720,  z:-420, w:10, d:8,  h:4.4, door:'W' },
  { x:-720, z:-80,  w:11, d:9,  h:4.6, door:'E' },
  // the far coast — new settlements for the 3km island
  { x:1000, z:620,  w:12, d:9,  h:4.6, door:'W' },              // east cape houses
  { x:1004, z:648,  w:10, d:8,  h:4.2, door:'W' },
  { x:975,  z:598,  w:8,  d:7,  h:3.4, door:'N', style:'shed' },
  { x:-1020, z:-780, w:15, d:10, h:6.6, door:'E', style:'barn' }, // southwest cape farm
  { x:-990,  z:-805, w:10, d:8,  h:4.4, door:'N' },
  // Novi Port — a working harbor town on the south shore
  { x:140,  z:-1010, w:14, d:10, h:6.5, door:'N', style:'warehouse', flat:true },
  { x:170,  z:-985,  w:8,  d:7,  h:3.4, door:'W', style:'shed' },
  { x:78,   z:-1012, w:16, d:12, h:6.5, door:'E', style:'warehouse', flat:true },
  { x:108,  z:-968,  w:12, d:9,  h:6.4, door:'S', style:'apartment' },
  { x:196,  z:-1012, w:14, d:11, h:6.0, door:'N', flat:true },
  { x:226,  z:-978,  w:11, d:9,  h:4.6, door:'W' },
  { x:196,  z:-948,  w:12, d:9,  h:6.2, door:'S', style:'house2' },
  { x:236,  z:-1046, w:15, d:13, h:15,  door:'W', style:'tower' },   // harbor control block
  { x:60,   z:-1032, w:10, d:8,  h:4.2, door:'N' },
  { x:124,  z:-943,  w:9,  d:8,  h:4.2, door:'S' },
  // Eastvale — market town on the eastern plain
  { x:905, z:190,  w:14, d:12, h:15,  door:'E', style:'tower' },
  { x:958, z:186,  w:13, d:10, h:6.4, door:'W', style:'apartment' },
  { x:906, z:244,  w:12, d:9,  h:6.2, door:'S', style:'house2' },
  { x:952, z:246,  w:11, d:9,  h:4.6, door:'S' },
  { x:930, z:126,  w:12, d:10, h:6.6, door:'N', style:'barn' },
  { x:978, z:244,  w:10, d:8,  h:4.2, door:'S' },
  { x:874, z:246,  w:10, d:8,  h:4.4, door:'S' },
  { x:-950, z:900,  w:11, d:9,  h:6.2, door:'S', style:'house2' },  // northwest cape
  // outer-ring settlements for the 4km island
  { x:1420,  z:980,   w:12, d:9,  h:4.6, door:'W' },                // northeast shore pair
  { x:1424,  z:1008,  w:8,  d:7,  h:3.4, door:'W', style:'shed' },
  { x:-1462, z:-318,  w:15, d:10, h:6.6, door:'E', style:'barn' },  // far west farm
  { x:-1436, z:-292,  w:10, d:8,  h:4.4, door:'S' },
  { x:-878,  z:1418,  w:11, d:9,  h:6.2, door:'S', style:'house2' },  // north cape pair
  { x:-850,  z:1414,  w:9,  d:8,  h:4.2, door:'S' },
  { x:518,   z:-1462, w:14, d:10, h:6.5, door:'N', style:'warehouse', flat:true },  // south shore depot
  { x:548,   z:-1438, w:8,  d:7,  h:3.4, door:'W', style:'shed' },
  // Karona City — tower blocks on a paved grid
  { x:-415, z:65,   w:15, d:13, h:18, door:'E', style:'tower' },
  { x:-365, z:63,   w:14, d:12, h:21, door:'W', style:'tower' },
  { x:-417, z:117,  w:14, d:12, h:15, door:'E', style:'tower' },
  { x:-363, z:118,  w:15, d:13, h:24, door:'W', style:'tower' },
  { x:-465, z:64,   w:12, d:10, h:6.4, door:'E', style:'apartment' },
  { x:-466, z:116,  w:13, d:9,  h:6.4, door:'E', style:'apartment' },
  { x:-313, z:64,   w:12, d:9,  h:6.2, door:'W', style:'house2' },
  { x:-315, z:118,  w:11, d:9,  h:4.6, door:'W' },
  { x:-440, z:14,   w:14, d:10, h:6.5, door:'N', style:'warehouse', flat:true },
  { x:-390, z:12,   w:12, d:9,  h:4.4, door:'N' },
  { x:-340, z:14,   w:11, d:9,  h:4.6, door:'N' },
  { x:-441, z:166,  w:11, d:9,  h:4.4, door:'S' },
  { x:-390, z:168,  w:12, d:10, h:6.6, door:'S', style:'barn' },
  { x:-338, z:166,  w:10, d:8,  h:4.2, door:'S' },
];
// standalone structures: farm silos + hilltop watchtowers
const silos = [ { x:262, z:236 }, { x:388, z:-448 }, { x:716, z:122 } ];
const towers = [ { x:250, z:60 }, { x:-300, z:-50 }, { x:500, z:400 }, { x:-560, z:-300 } ];
const roads = [
  // Karona City paved grid + connectors
  { ax:-440, az:40,  bx:-440, bz:142, hw:3.2, paved:true },
  { ax:-390, az:38,  bx:-390, bz:144, hw:3.2, paved:true },
  { ax:-340, az:40,  bx:-340, bz:142, hw:3.2, paved:true },
  { ax:-468, az:90,  bx:-312, bz:90,  hw:3.4, paved:true },
  { ax:-466, az:40,  bx:-314, bz:40,  hw:3.2, paved:true },
  { ax:-466, az:142, bx:-314, bz:142, hw:3.2, paved:true },
  { ax:-340, az:142, bx:-300, bz:180, hw:3.0, paved:true },   // to the hamlet
  { ax:-440, az:40,  bx:-370, bz:-28, hw:3.0, paved:true },   // toward the west track
  { ax:-370, az:-28, bx:-350, bz:-30, hw:2.4 },
  { ax:0,    az:-50,  bx:0,    bz:36,   hw:3.2, paved:true },   // Oakfield main street
  { ax:0,    az:30,   bx:-120, bz:100,  hw:3.2, paved:true },   // to Riverside
  { ax:-120, az:100,  bx:-220, bz:180,  hw:3.2, paved:true },
  { ax:-300, az:180,  bx:-220, bz:180,  hw:3.0, paved:true },   // Riverside street
  { ax:0,    az:-40,  bx:110,  bz:-130, hw:3.2, paved:true },   // to the depot
  { ax:110,  az:-130, bx:210,  bz:-218, hw:3.2, paved:true },
  { ax:190,  az:-220, bx:258,  bz:-220, hw:3.2, paved:true },   // depot street
  { ax:0,    az:26,   bx:120,  bz:140,  hw:2.2 },   // to the farm
  { ax:120,  az:140,  bx:244,  bz:252,  hw:2.2 },
  { ax:-300, az:180,  bx:-338, bz:60,   hw:2.0 },   // west coast track
  { ax:-338, az:60,   bx:-350, bz:-30,  hw:2.0 },
  { ax:-350, az:-30,  bx:-285, bz:-172, hw:2.0 },
  { ax:240,  az:-200, bx:330,  bz:-60,  hw:2.0 },   // east coast track
  { ax:330,  az:-60,  bx:348,  bz:50,   hw:2.0 },
  { ax:0,    az:-50,  bx:-52,  bz:-288, hw:2.2 },   // south track
  { ax:244,  az:252,  bx:128,  bz:322,  hw:2.0 },   // farm to north house
  { ax:-52,  az:-288, bx:-300, bz:-310, hw:2.2 },   // to the south farm
  { ax:244,  az:252,  bx:330,  bz:300,  hw:2.0 },   // to the east row
  { ax:0,    az:36,   bx:30,   bz:200,  hw:2.2 },   // north road
  { ax:30,   az:200,  bx:0,    bz:352,  hw:2.2 },
  { ax:-338, az:60,   bx:-358, bz:172,  hw:1.8 },   // west lone link
  { ax:0,    az:352,  bx:90,   bz:468,  hw:2.2 },   // to Northpoint
  { ax:90,   az:470,  bx:165,  bz:470,  hw:2.4 },   // Northpoint street
  { ax:-350, az:-30,  bx:-495, bz:-95,  hw:2.0 },   // to the quarry
  { ax:258,  az:-220, bx:370,  bz:-460, hw:2.0 },   // to south ridge
  { ax:348,  az:50,   bx:495,  bz:195,  hw:1.8 },   // east lone
  { ax:-358, az:172,  bx:-455, bz:352,  hw:1.8 },   // northwest lone
  { ax:0,    az:352,  bx:-155, bz:492,  hw:1.8 },   // north lone
  { ax:330,  az:-60,  bx:512,  bz:-138, hw:1.8 },   // southeast lone
  { ax:-320, az:-315, bx:-445, bz:-412, hw:1.8 },   // far barn
  { ax:0,    az:352,  bx:-85,  bz:688,  hw:2.0 },   // to the north shore
  { ax:348,  az:50,   bx:685,  bz:112,  hw:2.0 },   // to the east farm
  { ax:512,  az:-138, bx:712,  bz:-412, hw:1.8 },
  { ax:-300, az:-310, bx:-662, bz:-515, hw:2.0 },   // to the southwest outpost
  { ax:-455, az:352,  bx:-692, bz:296,  hw:1.8 },
  { ax:244,  az:252,  bx:612,  bz:552,  hw:1.8 },
  { ax:-52,  az:-288, bx:242,  bz:-692, hw:1.8 },
  { ax:-155, az:492,  bx:-342, bz:672,  hw:1.8 },
  { ax:-692, az:296,  bx:-712, bz:-72,  hw:1.8 },
  // long coastal routes to the capes
  { ax:685,  az:112,  bx:995,  bz:612,  hw:1.8 },   // to the east cape
  { ax:-662, az:-515, bx:-1012, bz:-782, hw:1.8 },  // to the southwest cape
  { ax:242,  az:-692, bx:148,  bz:-1002, hw:1.8 },  // to the south dock
  { ax:-342, az:672,  bx:-938, bz:892,  hw:1.8 },   // to the northwest cape
  // outer-ring routes for the 4km island
  { ax:995,  az:612,  bx:1415, bz:975,  hw:1.8 },   // northeast shore
  { ax:-1012, az:-782, bx:-1456, bz:-322, hw:1.8 }, // far west farm
  { ax:-938, az:892,  bx:-872, bz:1410, hw:1.8 },   // north cape
  { ax:240,  az:-1000, bx:512,  bz:-1455, hw:1.8 }, // south shore depot (leaves the quay east of the container yard)
  // Novi Port streets
  { ax:56,  az:-1000, bx:240, bz:-1000, hw:3.2, paved:true },   // quay road
  { ax:150, az:-1000, bx:150, bz:-940,  hw:3.0, paved:true },
  // Eastvale streets + links
  { ax:876, az:214, bx:992, bz:214, hw:3.0, paved:true },
  { ax:930, az:216, bx:930, bz:146, hw:2.6, paved:true },
  { ax:685, az:112, bx:874, bz:212, hw:2.0 },       // from the east farm
  { ax:992, az:214, bx:997, bz:610, hw:1.8 },       // north toward the cape
];
function distToSeg(px, pz, r){
  const dx=r.bx-r.ax, dz=r.bz-r.az, L2=dx*dx+dz*dz;
  let t = L2>0 ? ((px-r.ax)*dx+(pz-r.az)*dz)/L2 : 0; t = clamp(t,0,1);
  const x=r.ax+dx*t, z=r.az+dz*t;
  return { d: Math.hypot(px-x, pz-z), x, z };
}
{
  const arterials = roads.slice();
  for(const b of buildings){
    const dir = b.door==='N' ? [0,1] : b.door==='S' ? [0,-1] : b.door==='E' ? [1,0] : [-1,0];
    const dpx = b.x + dir[0]*(b.w/2 + 2.0), dpz = b.z + dir[1]*(b.d/2 + 2.0);
    let best = null, bd = 1e9;
    for(const r of arterials){
      const s = distToSeg(dpx, dpz, r);
      if(s.d < bd){ bd = s.d; best = s; }
    }
    if(best && bd > 2.5) roads.push({ ax:dpx, az:dpz, bx:best.x, bz:best.z, hw:1.6 });
  }
}
// bounding boxes let every road query reject far segments with four compares —
// this is what keeps the 4km grid generation (and grass streaming) fast
for(const r of roads){
  const m = r.hw + 4.6;
  r.minX = Math.min(r.ax, r.bx) - m; r.maxX = Math.max(r.ax, r.bx) + m;
  r.minZ = Math.min(r.az, r.bz) - m; r.maxZ = Math.max(r.az, r.bz) + m;
}

// ---------------- terrain height field (generation-time, analytic) ----------------
function baseHeight(x,z){
  const wx = Noise.fbm(x*0.0011+3.1, z*0.0011-7.7, 2, 2.0, 0.5) * 140;   // domain warp
  const wz = Noise.fbm(x*0.0011-9.4, z*0.0011+5.2, 2, 2.0, 0.5) * 140;
  const n = Noise.fbm((x+wx)*0.0017, (z+wz)*0.0017, 4, 2.1, 0.5);        // big rolling hills
  let h = 1.2 + Math.pow(clamp(n*0.5+0.5, 0, 1), 1.25) * 27;
  const n2 = Noise.fbm(x*0.006-4.7, z*0.006+9.2, 3, 2.0, 0.5);  // mid hills
  h += Math.pow(clamp(n2*0.5+0.5, 0, 1), 1.1) * 9;
  h += Noise.fbm(x*0.013+7.3, z*0.013-3.1, 3, 2.0, 0.5) * 2.8;  // small detail
  // climbable mountain massifs — ridged noise gives real crests, spurs and gullies
  const MTS = [ [-1250, 775, 560, 145], [1010, -905, 500, 125], [575, 1250, 440, 105],
                [-505, -1145, 420, 92], [1290, -185, 400, 96] ];
  for(let i=0;i<MTS.length;i++){
    const m = MTS[i];
    const d = Math.hypot(x - m[0], z - m[1]);
    if(d < m[2]){
      const f = Math.pow(1 - d/m[2], 1.35);
      const rn = clamp(1 - Math.abs(Noise.fbm((x+wx*0.3)*0.0062 + i*13.7, (z+wz*0.3)*0.0062 - i*7.1, 4, 2.05, 0.5)), 0, 1);
      h += m[3] * f * (0.40 + 0.64 * Math.pow(rn, 1.55));
    }
  }
  const lake = 1 - smoothstep(15, 75, Math.hypot(x+150, z+60)); // shallow lake basin
  h = lerp(h, -3.4, Math.min(1, lake*1.5));
  const edge = smoothstep(1650, 1950, Math.max(Math.abs(x), Math.abs(z)));
  h = h*(1-edge*0.92) - edge*5.0;                               // beach slopes at map rim
  return h;
}
for(const b of buildings) b.baseH = baseHeight(b.x, b.z);

function terrainHeightGen(x,z){
  let h = baseHeight(x,z);
  for(const r of roads){
    const s = distToSeg(x,z,r);
    const f = 1 - smoothstep(r.hw, r.hw+4.5, s.d);
    if(f>0) h = h*(1-f) + baseHeight(s.x, s.z)*f;               // flatten across road width
  }
  for(const b of buildings){
    const dx = Math.max(Math.abs(x-b.x)-b.w/2, 0);
    const dz = Math.max(Math.abs(z-b.z)-b.d/2, 0);
    const f = 1 - smoothstep(0, 8.5, Math.hypot(dx,dz));
    if(f>0) h = h*(1-f) + b.baseH*f;                            // building pads
  }
  return h;
}
function roadFactorGen(x,z){
  let rf = 0;
  for(const r of roads){
    if(r.paved) continue;
    if(x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ) continue;
    const s = distToSeg(x,z,r);
    rf = Math.max(rf, 1 - smoothstep(r.hw*0.9, r.hw+0.7, s.d));   // hard shoulder
  }
  return rf;
}
function pavedFactorGen(x,z){
  let rf = 0;
  for(const r of roads){
    if(!r.paved) continue;
    if(x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ) continue;
    const s = distToSeg(x,z,r);
    rf = Math.max(rf, 1 - smoothstep(r.hw*0.82, r.hw+1.6, s.d));
  }
  return rf;
}

// ---------------- terrain vertex colors (macro tint — detail lives in the shader) ----------------
const C_GRASS_A=[0.412,0.588,0.290], C_GRASS_B=[0.290,0.463,0.216], C_DIRT=[0.553,0.443,0.302],
      C_ROCK=[0.512,0.502,0.473], C_SAND=[0.851,0.773,0.561], C_ROAD=[0.408,0.318,0.208];
const C_DRY=[0.588,0.557,0.306];
function colorFor(x, z, h, slope, rfOverride, rpOverride){
  const n = Noise.fbm(x*0.02+11, z*0.02-7, 2, 2.0, 0.5)*0.5 + 0.5;   // grass patchiness
  let c = mix3(C_GRASS_A, C_GRASS_B, n);
  const dry = smoothstep(0.55, 0.95, Noise.fbm(x*0.008+31, z*0.008+17, 2, 2.0, 0.5)*0.5+0.5);
  c = mix3(c, C_DRY, dry*0.65);                                      // sun-dried patches
  const jitter = Noise.noise2(x*0.7, z*0.7)*0.045;
  c = [c[0]+jitter, c[1]+jitter, c[2]+jitter];
  c = mix3(c, C_DIRT, smoothstep(0.32, 0.78, slope));                 // dirt on slopes
  c = mix3(c, C_ROCK, smoothstep(0.85, 1.30, slope));                 // rock on cliffs
  const sandF = Math.max(
    smoothstep(1650, 1930, Math.max(Math.abs(x), Math.abs(z))),       // sand near map edges
    1 - smoothstep(-1.2, 0.6, h));                                    // sand in low basins
  c = mix3(c, C_SAND, sandF);
  // snowcaps on the high peaks
  const snowF = smoothstep(82, 108, h) * (1 - smoothstep(1.3, 1.9, slope));
  if(snowF > 0) c = mix3(c, [0.90, 0.92, 0.95], snowF);
  const rf = rfOverride !== undefined ? rfOverride : roadFactorGen(x,z);
  if(rf>0){
    const rc = [C_ROAD[0]*(0.9+0.2*n), C_ROAD[1]*(0.9+0.2*n), C_ROAD[2]*(0.9+0.2*n)];
    c = mix3(c, rc, Math.min(1, rf*1.25));                            // packed dirt roads
  }
  const rp = rpOverride !== undefined ? rpOverride : pavedFactorGen(x,z);
  if(rp > 0.02){
    c = mix3(c, [0.42, 0.36, 0.27], Math.min(1, rp*1.9) * 0.55);      // worn shoulder
    const asph = 0.155 + n*0.03;
    c = mix3(c, [asph, asph, asph*1.08], smoothstep(0.38, 0.82, rp)); // asphalt
  }
  return c;
}

// ---------------- build terrain (12x12 chunk meshes) + runtime height grid ----------------
const SEG = 960, STEP = WORLD/SEG, CHUNKS = 12, CSEG = SEG/CHUNKS;
const heightGrid = new Float32Array((SEG+1)*(SEG+1));
const roadGrid = new Float32Array((SEG+1)*(SEG+1));
const pavedGrid = new Float32Array((SEG+1)*(SEG+1));
const weightBytes = new Uint8Array((SEG+1)*(SEG+1)*4);   // r=dirt road, g=paved, b=contact AO
{
  const N = SEG+1;
  for(let row=0; row<N; row++){
    for(let col=0; col<N; col++){
      const x = col*STEP-HALF, z = row*STEP-HALF;
      let h = baseHeight(x,z), rf = 0, rp = 0, ao = 1;
      for(let ri=0; ri<roads.length; ri++){
        const r = roads[ri];
        if(x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ) continue;
        const s = distToSeg(x,z,r);
        if(s.d < r.hw + 4.5){
          const f = 1 - smoothstep(r.hw, r.hw+4.5, s.d);
          h = h*(1-f) + baseHeight(s.x, s.z)*f;                // flatten across road width
        }
        if(r.paved){ const v = 1 - smoothstep(r.hw*0.82, r.hw+1.6, s.d); if(v>rp) rp = v; }
        else       { const v = 1 - smoothstep(r.hw*0.9,  r.hw+0.7, s.d); if(v>rf) rf = v; }
      }
      for(let bi=0; bi<buildings.length; bi++){
        const b = buildings[bi];
        const bdx = Math.abs(x-b.x) - b.w/2, bdz = Math.abs(z-b.z) - b.d/2;
        if(bdx > 8.5 || bdz > 8.5) continue;
        const dd = Math.hypot(Math.max(bdx, 0), Math.max(bdz, 0));
        if(dd < 8.5){
          const f = 1 - smoothstep(0, 8.5, dd);
          h = h*(1-f) + b.baseH*f;                             // building pads
        }
        if(dd < 3.4) ao = Math.min(ao, 0.68 + 0.32*smoothstep(0, 3.4, dd));   // contact shadow
      }
      const gi = row*N+col;
      heightGrid[gi] = h; roadGrid[gi] = rf; pavedGrid[gi] = rp;
      weightBytes[gi*4] = rf*255; weightBytes[gi*4+1] = rp*255;
      weightBytes[gi*4+2] = ao*255; weightBytes[gi*4+3] = 255;
    }
  }
}
const weightsTex = new THREE.DataTexture(weightBytes, SEG+1, SEG+1, THREE.RGBAFormat, THREE.UnsignedByteType);
weightsTex.wrapS = weightsTex.wrapT = THREE.ClampToEdgeWrapping;
weightsTex.magFilter = THREE.LinearFilter; weightsTex.minFilter = THREE.LinearFilter;
weightsTex.generateMipmaps = false; weightsTex.flipY = false;
weightsTex.needsUpdate = true;

const terrain = new THREE.Group();
const terrainMat = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:1, metalness:0 });
terrainMat.onBeforeCompile = (shader) => {
  injectAerialFog(shader);                                   // shared distance-haze (adds vAWPos)
  shader.uniforms.uTime    = { value: 0 };
  shader.uniforms.tGrass   = { value: DETAIL.grass };
  shader.uniforms.tDirt    = { value: DETAIL.dirt };
  shader.uniforms.tRock    = { value: DETAIL.rock };
  shader.uniforms.tSand    = { value: DETAIL.sand };
  shader.uniforms.tSnow    = { value: DETAIL.snow };
  shader.uniforms.tAsph    = { value: DETAIL.asphalt };
  shader.uniforms.tWeights = { value: weightsTex };
  // world xz -> weights-texture uv (texel centers on the height grid)
  shader.uniforms.uWMap = { value: new THREE.Vector2(1/(STEP*(SEG+1)), (HALF/STEP + 0.5)/(SEG+1)) };
  terrainMat.userData.shader = shader;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vNrmW;')
    .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvNrmW = objectNormal;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', ['#include <common>',
      'varying vec3 vNrmW; uniform float uTime;',
      'uniform sampler2D tGrass, tDirt, tRock, tSand, tSnow, tAsph, tWeights;',
      'uniform vec2 uWMap;',
      'float thash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }',
      'float tnoise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);',
      '  return mix(mix(thash(i),thash(i+vec2(1,0)),f.x), mix(thash(i+vec2(0,1)),thash(i+vec2(1,1)),f.x), f.y); }'].join('\n'))
    .replace('#include <color_fragment>', ['#include <color_fragment>',
      '{',
      '  vec3 nrm = normalize(vNrmW);',
      '  float slope = length(nrm.xz) / max(nrm.y, 0.04);',
      '  vec2 wuv = vAWPos.xz;',
      // detail layers, each sampled at two scales to hide the tiling
      '  vec3 dGrass = mix(texture2D(tGrass, wuv*0.31).rgb, texture2D(tGrass, wuv*0.047).rgb, 0.38) * 2.0;',
      '  vec3 dDirt  = mix(texture2D(tDirt,  wuv*0.27).rgb, texture2D(tDirt,  wuv*0.041).rgb, 0.34) * 2.0;',
      '  vec3 dRock  = mix(texture2D(tRock,  wuv*0.115).rgb, texture2D(tRock, wuv*0.023).rgb, 0.44) * 2.0;',
      '  vec3 dSand  = texture2D(tSand, wuv*0.35).rgb * 2.0;',
      '  vec3 dSnow  = texture2D(tSnow, wuv*0.22).rgb * 2.0;',
      '  vec3 dAsph  = texture2D(tAsph, wuv*0.42).rgb * 2.0;',
      '  vec4 wts = texture2D(tWeights, vAWPos.xz*uWMap.x + vec2(uWMap.y));',
      // choose the detail material per pixel, mirroring the macro color rules
      '  float dirtW = clamp(smoothstep(0.30, 0.74, slope)*1.15, 0.0, 1.0);',
      '  float rockW = smoothstep(0.80, 1.25, slope);',
      '  float sandW = max(smoothstep(1650.0, 1930.0, max(abs(vAWPos.x), abs(vAWPos.z))), 1.0 - smoothstep(-1.2, 0.6, vAWPos.y));',
      '  float snowW = smoothstep(82.0, 105.0, vAWPos.y) * (1.0 - smoothstep(1.3, 1.9, slope));',
      '  vec3 det = dGrass;',
      '  det = mix(det, dDirt, dirtW);',
      '  det = mix(det, dRock, rockW);',
      '  det = mix(det, dSand, sandW);',
      '  det = mix(det, dSnow, snowW);',
      '  diffuseColor.rgb *= det;',
      // crisp per-pixel roads — vertex colors stay clean landscape, roads are painted here
      '  float rNz = tnoise(wuv*0.9);',
      '  float dirtRoad = smoothstep(0.30, 0.62, wts.r);',
      '  vec3 dirtRoadCol = vec3(0.408, 0.318, 0.208) * (0.88 + 0.24*rNz) * dDirt;',
      '  diffuseColor.rgb = mix(diffuseColor.rgb, dirtRoadCol, dirtRoad*0.92);',
      '  float shoulder = smoothstep(0.06, 0.40, wts.g) * (1.0 - smoothstep(0.40, 0.60, wts.g));',
      '  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.40, 0.345, 0.26)*dDirt, shoulder*0.6);',
      '  float paved = smoothstep(0.42, 0.58, wts.g);',
      '  vec3 asphCol = vec3(0.175, 0.175, 0.19) * (0.92 + 0.16*tnoise(wuv*0.23)) * dAsph;',
      '  diffuseColor.rgb = mix(diffuseColor.rgb, asphCol, paved);',
      '  diffuseColor.rgb *= wts.b;',                                     // building contact AO
      '  float cl = tnoise(vAWPos.xz*0.0045 + vec2(uTime*0.009, uTime*0.006));', // cloud shadows
      '  cl = smoothstep(0.38, 0.78, cl);',
      '  diffuseColor.rgb *= 1.0 - cl*0.16;',
      '}'].join('\n'));
};
{
  const gridH = (col,row) => heightGrid[clamp(row,0,SEG)*(SEG+1)+clamp(col,0,SEG)];
  for(let cj=0; cj<CHUNKS; cj++){
    for(let ci=0; ci<CHUNKS; ci++){
      const size = WORLD/CHUNKS;
      const g = new THREE.PlaneGeometry(size, size, CSEG, CSEG);
      g.rotateX(-Math.PI/2);
      g.translate((ci+0.5)*size - HALF, 0, (cj+0.5)*size - HALF);
      const pos = g.attributes.position;
      const cols = new Float32Array(pos.count*3);
      const nors = new Float32Array(pos.count*3);
      for(let i=0;i<pos.count;i++){
        const x = pos.getX(i), z = pos.getZ(i);
        const col = Math.round((x+HALF)/STEP), row = Math.round((z+HALF)/STEP);
        const h = gridH(col,row);
        pos.setY(i, h);
        const sx = (gridH(col+1,row)-gridH(col-1,row))/(2*STEP);
        const sz = (gridH(col,row+1)-gridH(col,row-1))/(2*STEP);
        // smooth analytic normal from the height grid (no facets, no shader derivatives)
        const inv = 1/Math.sqrt(sx*sx + 1 + sz*sz);
        nors[i*3] = -sx*inv; nors[i*3+1] = inv; nors[i*3+2] = -sz*inv;
        const gi = clamp(row,0,SEG)*(SEG+1)+clamp(col,0,SEG);
        const c = colorFor(x, z, h, Math.hypot(sx,sz), 0, 0);   // roads painted per-pixel instead
        cols[i*3]=c[0]; cols[i*3+1]=c[1]; cols[i*3+2]=c[2];
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols,3));
      g.setAttribute('normal', new THREE.BufferAttribute(nors,3));
      const m = new THREE.Mesh(g, terrainMat);
      m.receiveShadow = true;
      terrain.add(m);
    }
  }
}
scene.add(terrain);

// fast bilinear height lookup used by all gameplay code
function heightAt(x,z){
  x = clamp(x, -HALF+0.01, HALF-0.01); z = clamp(z, -HALF+0.01, HALF-0.01);
  const fx = (x+HALF)/STEP, fz = (z+HALF)/STEP;
  const ix = Math.floor(fx), iz = Math.floor(fz);
  const tx = fx-ix, tz = fz-iz, N = SEG+1;
  const h00 = heightGrid[iz*N+ix],     h10 = heightGrid[iz*N+ix+1];
  const h01 = heightGrid[(iz+1)*N+ix], h11 = heightGrid[(iz+1)*N+ix+1];
  return lerp(lerp(h00,h10,tx), lerp(h01,h11,tx), tz);
}
const floors = [];   // walkable slabs: {minX,maxX,minZ,maxZ,top} — pads, upper storeys, stairs
function groundAt(x, z, refY){
  let g = heightAt(x,z);
  const maxTop = refY === undefined ? Infinity : refY + 0.75;    // can step ~0.75m up
  for(const f of floors){
    if(x>f.minX && x<f.maxX && z>f.minZ && z<f.maxZ && f.top>g && f.top<=maxTop) g = f.top;
  }
  return g;
}
