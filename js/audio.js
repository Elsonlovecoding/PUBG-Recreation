'use strict';
// PUBG Recreation — procedural audio: everything synthesized with Web Audio, no files

const SFX = (function(){
  let ctx = null, master = null, noiseBuf = null;
  let windGain = null, engineOsc = null, engineGain = null, engineFilter = null,
      planeGain = null, fallGain = null;
  function unlock(){
    if(ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      noiseBuf = makeNoise();
      // constant wind bed
      const wind = src(noiseBuf, true);
      const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 420;
      windGain = ctx.createGain(); windGain.gain.value = 0.035;
      wind.connect(wf); wf.connect(windGain); windGain.connect(master); wind.start();
      // vehicle engine loop (silent until driving)
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 50;
      engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 500;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master); engineOsc.start();
      // plane drone loop
      const planeOsc = ctx.createOscillator(); planeOsc.type = 'sawtooth'; planeOsc.frequency.value = 38;
      const pf = ctx.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 220;
      planeGain = ctx.createGain(); planeGain.gain.value = 0;
      planeOsc.connect(pf); pf.connect(planeGain); planeGain.connect(master); planeOsc.start();
      // freefall wind loop
      const fall = src(noiseBuf, true);
      const ff = ctx.createBiquadFilter(); ff.type = 'bandpass'; ff.frequency.value = 900; ff.Q.value = 0.6;
      fallGain = ctx.createGain(); fallGain.gain.value = 0;
      fall.connect(ff); ff.connect(fallGain); fallGain.connect(master); fall.start();
    } catch(e){ ctx = null; }
  }
  function makeNoise(){
    const len = Math.floor(ctx.sampleRate * 1.2), buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i = 0; i < len; i++) d[i] = Math.random()*2 - 1;
    return buf;
  }
  function src(buf, loop){ const s = ctx.createBufferSource(); s.buffer = buf; s.loop = !!loop; return s; }
  function env(g, t0, a, peak, dec){
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec);
  }
  function pan(node, p){
    if(!ctx.createStereoPanner || !p) { node.connect(master); return; }
    const sp = ctx.createStereoPanner(); sp.pan.value = clamp(p, -1, 1);
    node.connect(sp); sp.connect(master);
  }
  function burst(o){
    if(!ctx) return;
    const t0 = ctx.currentTime;
    const s = src(noiseBuf);
    const f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.value = o.freq || 1200; f.Q.value = o.q || 1;
    const g = ctx.createGain();
    s.connect(f); f.connect(g); pan(g, o.pn);
    env(g, t0, 0.004, o.peak || 0.3, o.dur || 0.1);
    s.start(t0); s.stop(t0 + (o.dur || 0.1) + 0.1);
  }
  function tone(freq, dur, peak, type, pn, slide){
    if(!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator(); osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if(slide) osc.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    const g = ctx.createGain();
    osc.connect(g); pan(g, pn);
    env(g, t0, 0.005, peak, dur);
    osc.start(t0); osc.stop(t0 + dur + 0.1);
  }
  function att(dist){ return clamp(1 - (dist || 0)/230, 0, 1); }
  return {
    unlock,
    get ready(){ return !!ctx; },
    shot(type, dist, pn){
      if(!ctx) return;
      const a = att(dist); if(a <= 0) return;
      const muffled = dist > 60;                                  // far shots become dull booms
      if(type === 'sniper'){ burst({dur:0.30, peak:0.50*a, freq:muffled?600:2400, pn}); tone(110, 0.28, 0.28*a, 'triangle', pn, 45); }
      else if(type === 'shotgun'){ burst({dur:0.22, peak:0.50*a, freq:muffled?500:1600, pn}); tone(90, 0.20, 0.26*a, 'triangle', pn, 40); }
      else { burst({dur:0.12, peak:0.38*a, freq:muffled?700:2600, pn}); tone(140, 0.10, 0.18*a, 'triangle', pn, 70); }
    },
    explosion(dist, pn){
      if(!ctx) return;
      const a = clamp(1 - (dist || 0)/340, 0.05, 1);
      burst({dur:0.7, peak:0.8*a, freq:300, pn});
      tone(55, 0.8, 0.5*a, 'sine', pn, 28);
    },
    footstep(sprint){ burst({dur:0.05, peak:sprint?0.09:0.055, freq:500 + Math.random()*250}); },
    reload(){ burst({dur:0.05, peak:0.15, freq:2600, type:'highpass'}); setTimeout(() => burst({dur:0.05, peak:0.13, freq:3200, type:'highpass'}), 140); },
    healStart(){ burst({dur:0.25, peak:0.08, freq:1400, type:'bandpass', q:2}); },
    heal(){ tone(620, 0.12, 0.14); setTimeout(() => tone(830, 0.16, 0.14), 110); },
    pickup(){ tone(520, 0.07, 0.15, 'triangle'); setTimeout(() => tone(780, 0.08, 0.13, 'triangle'), 60); },
    hit(){ tone(1900, 0.035, 0.15, 'square'); },
    kill(){ tone(600, 0.09, 0.18, 'square'); setTimeout(() => tone(900, 0.12, 0.18, 'square'), 90); },
    hurt(){ tone(160, 0.16, 0.28, 'triangle', 0, 90); },
    throwPin(){ burst({dur:0.04, peak:0.13, freq:3000, type:'highpass'}); },
    bounce(dist){ burst({dur:0.04, peak:0.10*att(dist), freq:900}); },
    land(){ burst({dur:0.12, peak:0.22, freq:400}); },
    zoneSiren(){ if(!ctx) return; tone(720, 0.5, 0.12, 'square', 0, 480); setTimeout(() => tone(720, 0.5, 0.12, 'square', 0, 480), 700); },
    zoneTick(){ tone(300, 0.08, 0.11, 'square'); },
    click(){ tone(1200, 0.03, 0.1, 'square'); },
    stinger(win){
      if(!ctx) return;
      if(win) [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.35, 0.18, 'triangle'), i*140));
      else tone(220, 0.7, 0.22, 'sawtooth', 0, 110);
    },
    setEngine(on, speed){
      if(!engineGain) return;
      const s = Math.abs(speed || 0);
      engineGain.gain.value = on ? 0.09 + Math.min(s*0.004, 0.05) : 0;
      engineOsc.frequency.value = 45 + s*7;
      engineFilter.frequency.value = 400 + s*60;
    },
    setPlane(dist){ if(planeGain) planeGain.gain.value = dist === null ? 0 : clamp(1 - dist/650, 0, 1)*0.22; },
    setFall(speed){ if(fallGain) fallGain.gain.value = clamp((speed || 0)/40, 0, 1)*0.28; },
  };
})();
