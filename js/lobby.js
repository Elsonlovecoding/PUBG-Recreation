'use strict';
// PUBG Recreation — lobby: avatar customization, weapon-slot settings, play queue

const OUTFIT_KEY = 'pubgrec_outfit', SLOTS_KEY = 'pubgrec_slots';
const AV_SHIRTS = [0x46525c].concat(SHIRT_COLORS);
const AV_PANTS  = [0x2e3338].concat(PANTS_COLORS);
const AV_HEADS  = [
  { key:'hair',    name:'HAIR' },
  { key:'cap',     name:'FIELD CAP' },
  { key:'helmet1', name:'LVL 1 HELMET' },
  { key:'helmet3', name:'LVL 3 HELMET' },
];
const WEAPON_LIST = ['rifle','shotgun','sniper'];

function loadJSON(key, fallback){
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch(e){ return fallback; }
}
function saveJSON(key, v){ try { localStorage.setItem(key, JSON.stringify(v)); } catch(e){} }

let outfitCfg = loadJSON(OUTFIT_KEY, { shirt:0, pants:0, skin:0, head:0 });
let slotConfig = loadJSON(SLOTS_KEY, ['rifle','shotgun','sniper']);
if(!Array.isArray(slotConfig) || slotConfig.length !== 3 ||
   WEAPON_LIST.some(w => slotConfig.indexOf(w) === -1)) slotConfig = ['rifle','shotgun','sniper'];

function applyOutfitCfg(){
  outfitCfg.shirt = (outfitCfg.shirt + AV_SHIRTS.length) % AV_SHIRTS.length;
  outfitCfg.pants = (outfitCfg.pants + AV_PANTS.length) % AV_PANTS.length;
  outfitCfg.skin  = (outfitCfg.skin + SKIN_TONES.length) % SKIN_TONES.length;
  outfitCfg.head  = (outfitCfg.head + AV_HEADS.length) % AV_HEADS.length;
  applyOutfit(AV_SHIRTS[outfitCfg.shirt], AV_PANTS[outfitCfg.pants],
              SKIN_TONES[outfitCfg.skin], AV_HEADS[outfitCfg.head].key);
  saveJSON(OUTFIT_KEY, outfitCfg);
  // refresh panel labels + swatches
  const rows = { shirt: AV_SHIRTS[outfitCfg.shirt], pants: AV_PANTS[outfitCfg.pants], skin: SKIN_TONES[outfitCfg.skin] };
  for(const k in rows){
    const row = document.querySelector('#avatarpanel .cfgrow[data-cfg="' + k + '"]');
    row.querySelector('.swatch').style.background = '#' + ('00000' + rows[k].toString(16)).slice(-6);
    row.querySelector('.val').textContent = '#' + (({shirt:outfitCfg.shirt, pants:outfitCfg.pants, skin:outfitCfg.skin})[k] + 1);
  }
  document.querySelector('#avatarpanel .cfgrow[data-cfg="head"] .val').textContent = AV_HEADS[outfitCfg.head].name;
}
function refreshSlotsPanel(){
  for(let i=0;i<3;i++){
    document.querySelector('#settingspanel .cfgrow[data-slot="' + i + '"] .val').textContent =
      WEAPONS[slotConfig[i]].name;
  }
}
function cycleSlot(i, dir){
  const cur = slotConfig[i];
  const next = WEAPON_LIST[(WEAPON_LIST.indexOf(cur) + dir + 3) % 3];
  const j = slotConfig.indexOf(next);
  slotConfig[j] = cur;                    // swap so every gun keeps exactly one slot
  slotConfig[i] = next;
  saveJSON(SLOTS_KEY, slotConfig);
  refreshSlotsPanel();
}

// ---------------- panels (cards + bottom menu open them) ----------------
const PANELS = {
  custom: document.getElementById('avatarpanel'),
  settings: document.getElementById('settingspanel'),
  controls: document.getElementById('controlspanel'),
  stats: document.getElementById('statspanel'),
};
function openPanel(name){
  const already = !!name && PANELS[name].style.display === 'block';
  for(const k in PANELS) PANELS[k].style.display = 'none';
  if(!already && name){
    if(name === 'stats') fillStats();
    PANELS[name].style.display = 'block';
  }
  SFX.ready && SFX.click();
}
document.getElementById('card-custom').addEventListener('click', () => openPanel('custom'));
document.getElementById('card-settings').addEventListener('click', () => openPanel('settings'));
document.getElementById('card-stats').addEventListener('click', () => openPanel('stats'));
document.getElementById('card-controls').addEventListener('click', () => openPanel('controls'));
PANELS.custom.querySelectorAll('.arrow').forEach(btn => {
  btn.addEventListener('click', () => {
    const row = btn.closest('.cfgrow');
    outfitCfg[row.getAttribute('data-cfg')] += btn.classList.contains('next') ? 1 : -1;
    applyOutfitCfg();
  });
});
PANELS.settings.querySelectorAll('.arrow').forEach(btn => {
  btn.addEventListener('click', () => {
    const i = parseInt(btn.closest('.cfgrow').getAttribute('data-slot'), 10);
    cycleSlot(i, btn.classList.contains('next') ? 1 : -1);
  });
});
function fillStats(){
  const s = loadJSON('pubgrec_stats', {});
  document.getElementById('statslist').innerHTML =
    '<div class="srow"><span>MATCHES</span><b>' + (s.matches||0) + '</b></div>' +
    '<div class="srow"><span>CHICKEN DINNERS</span><b>' + (s.wins||0) + '</b></div>' +
    '<div class="srow"><span>TOTAL KILLS</span><b>' + (s.kills||0) + '</b></div>' +
    '<div class="srow"><span>MOST KILLS IN A MATCH</span><b>' + (s.bestKills||0) + '</b></div>' +
    '<div class="srow"><span>BEST PLACEMENT</span><b>' + (s.bestPlace ? '#' + s.bestPlace : '—') + '</b></div>';
}

// ---------------- profile: name, level, currencies ----------------
const NAME_KEY = 'pubgrec_name';
const nameEl = document.getElementById('playername');
const charName = document.getElementById('charname');
function reflectName(){
  const n = nameEl.textContent.trim() || 'PLAYER';
  charName.textContent = '\u2039 ' + n + ' \u203A';
  if(!currentAvatar()) document.getElementById('pavatar').textContent = n[0].toUpperCase();
}
function loadName(){
  let n = 'PLAYER';
  try { n = localStorage.getItem(NAME_KEY) || 'PLAYER'; } catch(e){}
  nameEl.textContent = n;
  reflectName();
}
nameEl.addEventListener('blur', () => {
  const n = (nameEl.textContent || 'PLAYER').trim().slice(0, 14).toUpperCase() || 'PLAYER';
  nameEl.textContent = n;
  try { localStorage.setItem(NAME_KEY, n); } catch(e){}
  reflectName();
});
nameEl.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); nameEl.blur(); } });
loadName();
{
  const s = loadJSON('pubgrec_stats', {});
  const li = levelInfo(s.points || 0);
  document.getElementById('playerlv').textContent = 'LV ' + li.lv;
  document.getElementById('xpfill').style.width = Math.max(4, li.into / li.need * 100) + '%';
}

// ---------------- profile screen ----------------
const AVATAR_KEY = 'pubgrec_avatar';
const profileEl = document.getElementById('profilescreen');
const bigAvatar = document.getElementById('bigavatar');
const pavEl = document.getElementById('pavatar');
function makeDefaultAvatar(c1, c2, glyph){
  const cv = document.createElement('canvas'); cv.width = cv.height = 96;
  const x = cv.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 96, 96);
  gr.addColorStop(0, c1); gr.addColorStop(1, c2);
  x.fillStyle = gr; x.fillRect(0, 0, 96, 96);
  x.font = '52px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(glyph, 48, 54);
  return cv.toDataURL('image/png');
}
const DEFAULT_AVATARS = [
  ['#f2a900','#7a4a00','\uD83D\uDC14'], ['#5a7d9c','#22303c','\uD83E\uDE96'],
  ['#9c5a5a','#3c2020','\uD83D\uDC80'], ['#6f8f5a','#243418','\uD83C\uDFAF'],
  ['#7a5a8f','#2c1c38','\uD83D\uDC7E'], ['#4a8f8a','#173432','\uD83D\uDC38'],
  ['#a06a3a','#3c2410','\uD83D\uDD25'], ['#616a72','#20262c','\uD83E\uDD47'],
].map(a => makeDefaultAvatar(a[0], a[1], a[2]));
function currentAvatar(){ try { return localStorage.getItem(AVATAR_KEY); } catch(e){ return null; } }
function setAvatar(dataURL){
  try { localStorage.setItem(AVATAR_KEY, dataURL); } catch(e){ showToast('IMAGE TOO LARGE TO SAVE'); }
  applyAvatarEverywhere();
  SFX.ready && SFX.click();
}
function applyAvatarEverywhere(){
  const url = currentAvatar();
  if(url){
    pavEl.style.backgroundImage = 'url(' + url + ')';
    pavEl.textContent = '';
    bigAvatar.src = url;
  } else {
    pavEl.style.backgroundImage = 'none';
    pavEl.textContent = (nameEl.textContent.trim()[0] || 'P').toUpperCase();
    bigAvatar.src = DEFAULT_AVATARS[0];
  }
}
{
  const grid = document.getElementById('avatargrid');
  DEFAULT_AVATARS.forEach(url => {
    const im = document.createElement('img');
    im.src = url;
    im.addEventListener('click', () => setAvatar(url));
    grid.appendChild(im);
  });
}
document.getElementById('avatarupload').addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 96;
      const x = cv.getContext('2d');
      const s = Math.min(img.width, img.height);            // cover-crop to square
      x.drawImage(img, (img.width - s)/2, (img.height - s)/2, s, s, 0, 0, 96, 96);
      setAvatar(cv.toDataURL('image/jpeg', 0.85));
    };
    img.src = rd.result;
  };
  rd.readAsDataURL(f);
});
function openProfile(){
  const s = loadJSON('pubgrec_stats', {});
  const li = levelInfo(s.points || 0);
  document.getElementById('profname').textContent = nameEl.textContent;
  document.getElementById('prof-lv').textContent = 'LV ' + li.lv;
  document.getElementById('prof-lvfill').style.width = (li.into / li.need * 100) + '%';
  document.getElementById('prof-pts').textContent =
    li.into + ' / ' + li.need + ' PTS TO LV ' + (li.lv + 1) + ' \u00B7 TOTAL ' + (s.points || 0) + ' PTS';
  const rows = (s.log || []).map(m => {
    const d = new Date(m.t);
    const date = (d.getMonth() + 1) + '/' + d.getDate();
    return '<div class="brow"><b class="' + (m.place === 1 ? 'win' : '') + '">#' + m.place + '</b>' +
      '<span>' + m.kills + ' kills</span><span>' + m.dmg + ' dmg</span>' +
      '<span class="pts">+' + m.pts + ' pts</span><small>' + date + '</small></div>';
  }).join('');
  document.getElementById('battlelog').innerHTML =
    rows || '<div class="bempty">no matches yet — hit START and earn your first points</div>';
  profileEl.style.display = 'flex';
  SFX.ready && SFX.click();
}
pavEl.addEventListener('click', openProfile);
document.getElementById('profileback').addEventListener('click', () => {
  profileEl.style.display = 'none';
  SFX.ready && SFX.click();
});
applyAvatarEverywhere();
const TIPS = [
  'TIP: SLOT 1 IS DRAWN ON LANDING — SET IT IN LOADOUT',
  'TIP: SMOKE GRENADES BLIND THE BOTS FOR 20 SECONDS',
  'TIP: TREE TRUNKS STOP BULLETS — CANOPIES ONLY HIDE YOU',
  'TIP: BOTS HEAR GUNFIRE FROM 55M AND COME LOOKING',
  'TIP: APARTMENTS HAVE BONUS LOOT ON THE SECOND FLOOR',
  'TIP: HOLD THE SNIPER TRIGGER FROM THE HIP — IT FIRES ON RELEASE',
  'TIP: DOUBLE-CLICK TOGGLES THE SNIPER SCOPE ON AND OFF',
  'TIP: CITY TOWER STAIRS RUN ALL THE WAY TO ROOFTOP LOOT',
  'TIP: STEER YOUR FREEFALL WITH WASD — LEAN IN TO GLIDE FARTHER',
];
document.getElementById('tipline').textContent = TIPS[Math.floor(Math.random()*TIPS.length)];

// ---------------- matchmaking banner ----------------
const queueBanner = document.getElementById('queuebanner');
const queueCount = document.getElementById('queuecount');
const queueTitle = document.getElementById('queuetitle');
const startBtn = document.getElementById('playbtn');
let queueTimer = null;
function openQueue(){
  if(queueTimer || matchStarted) return;
  openPanel(null);
  queueBanner.style.display = 'flex';
  queueTitle.textContent = 'MATCHMAKING';
  startBtn.classList.add('queueing');
  startBtn.textContent = 'IN QUEUE…';
  let n = 1;
  queueCount.textContent = '1 / 40';
  SFX.unlock();
  queueTimer = setInterval(() => {
    n = Math.min(40, n + 2 + Math.floor(Math.random()*6));
    queueCount.textContent = n + ' / 40';
    if(n >= 40){
      clearInterval(queueTimer); queueTimer = null;
      queueTitle.textContent = 'MATCH FOUND';
      queueCount.textContent = 'DEPLOYING…';
      SFX.kill();
      setTimeout(() => {
        queueBanner.style.display = 'none';
        startMatch();
        document.getElementById('lockhint').style.display = 'block';
      }, 800);
    }
  }, 240);
}
function cancelQueue(){
  if(queueTimer){ clearInterval(queueTimer); queueTimer = null; }
  queueBanner.style.display = 'none';
  startBtn.classList.remove('queueing');
  startBtn.textContent = 'START';
}
startBtn.addEventListener('click', openQueue);
document.getElementById('cancelqueue').addEventListener('click', cancelQueue);
// grab the mouse on the first click after deploying (browsers demand a gesture)
document.addEventListener('click', () => {
  if(matchStarted && !gameState.over && !inventoryOpen && !pointerLocked){
    document.getElementById('lockhint').style.display = 'none';
    canvasEl.requestPointerLock && canvasEl.requestPointerLock();
  }
});
document.getElementById('againbtn').addEventListener('click', () => {
  try { sessionStorage.setItem('pubgrec_autoqueue', '1'); } catch(e){}
  location.reload();
});
// PLAY AGAIN drops you straight back into a queue after the reload
try {
  if(sessionStorage.getItem('pubgrec_autoqueue')){
    sessionStorage.removeItem('pubgrec_autoqueue');
    setTimeout(openQueue, 500);
  }
} catch(e){}

applyOutfitCfg();
refreshSlotsPanel();
updateHealthHUD(); updateArmorHUD(); updateAmmoHUD(); updateAliveHUD(); updateItemsHUD(); updateKillsHUD();
animate();
