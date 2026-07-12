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

// ---------------- tabs + panels ----------------
const avatarPanel = document.getElementById('avatarpanel');
const settingsPanel = document.getElementById('settingspanel');
const TABS = { play: null, custom: avatarPanel, settings: settingsPanel };
function setTab(name){
  for(const t of ['play','custom','settings']){
    document.getElementById('tab-' + t).classList.toggle('active', t === name);
    if(TABS[t]) TABS[t].style.display = (t === name) ? 'block' : 'none';
  }
  SFX.ready && SFX.click();
}
document.getElementById('tab-play').addEventListener('click', () => setTab('play'));
document.getElementById('tab-custom').addEventListener('click', () => setTab('custom'));
document.getElementById('tab-settings').addEventListener('click', () => setTab('settings'));
avatarPanel.querySelectorAll('.arrow').forEach(btn => {
  btn.addEventListener('click', () => {
    const row = btn.closest('.cfgrow');
    const k = row.getAttribute('data-cfg');
    outfitCfg[k] += btn.classList.contains('next') ? 1 : -1;
    applyOutfitCfg();
  });
});
settingsPanel.querySelectorAll('.arrow').forEach(btn => {
  btn.addEventListener('click', () => {
    const i = parseInt(btn.closest('.cfgrow').getAttribute('data-slot'), 10);
    cycleSlot(i, btn.classList.contains('next') ? 1 : -1);
  });
});

// ---------------- player name ----------------
const NAME_KEY = 'pubgrec_name';
const nameEl = document.getElementById('playername');
const plateEl = document.getElementById('nameplate');
function loadName(){
  let n = 'PLAYER';
  try { n = localStorage.getItem(NAME_KEY) || 'PLAYER'; } catch(e){}
  nameEl.textContent = n; plateEl.textContent = n;
}
nameEl.addEventListener('blur', () => {
  const n = (nameEl.textContent || 'PLAYER').trim().slice(0, 14).toUpperCase() || 'PLAYER';
  nameEl.textContent = n; plateEl.textContent = n;
  try { localStorage.setItem(NAME_KEY, n); } catch(e){}
});
nameEl.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); nameEl.blur(); } });
loadName();
{
  const c = loadJSON('pubgrec_stats', {});
  document.getElementById('playerlv').textContent = 'LV ' + (1 + (c.matches || 0));
}

// ---------------- matchmaking banner ----------------
const queueBanner = document.getElementById('queuebanner');
const queueCount = document.getElementById('queuecount');
const queueTitle = document.getElementById('queuetitle');
const startBtn = document.getElementById('playbtn');
let queueTimer = null;
function openQueue(){
  if(queueTimer || matchStarted) return;
  setTab('play');
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
