'use strict';
// PUBG Recreation — math helpers + seeded simplex noise

// ---------------- math helpers ----------------
function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function lerp(a,b,t){ return a+(b-a)*t; }
function smoothstep(a,b,x){ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }
function randRange(a,b){ return a+Math.random()*(b-a); }
function mix3(a,b,t){ return [lerp(a[0],b[0],t), lerp(a[1],b[1],t), lerp(a[2],b[2],t)]; }

// ---------------- seeded simplex noise ----------------
const Noise = (function(){
  const grad = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
  let seed = 9271;
  function rand(){ seed = (seed*16807) % 2147483647; return seed/2147483647; }
  const perm = []; for(let i=0;i<256;i++) perm[i]=i;
  for(let i=255;i>0;i--){ const j=Math.floor(rand()*(i+1)); const t=perm[i]; perm[i]=perm[j]; perm[j]=t; }
  const p = new Uint8Array(512); for(let i=0;i<512;i++) p[i]=perm[i&255];
  const F2 = 0.5*(Math.sqrt(3)-1), G2 = (3-Math.sqrt(3))/6;
  function noise2(xin,yin){
    let n0=0,n1=0,n2=0;
    const s=(xin+yin)*F2, i=Math.floor(xin+s), j=Math.floor(yin+s);
    const t=(i+j)*G2, x0=xin-(i-t), y0=yin-(j-t);
    let i1,j1; if(x0>y0){i1=1;j1=0;} else {i1=0;j1=1;}
    const x1=x0-i1+G2, y1=y0-j1+G2, x2=x0-1+2*G2, y2=y0-1+2*G2;
    const ii=i&255, jj=j&255;
    let t0=0.5-x0*x0-y0*y0;
    if(t0>0){ t0*=t0; const g=grad[p[ii+p[jj]]&7]; n0=t0*t0*(g[0]*x0+g[1]*y0); }
    let t1=0.5-x1*x1-y1*y1;
    if(t1>0){ t1*=t1; const g=grad[p[ii+i1+p[jj+j1]]&7]; n1=t1*t1*(g[0]*x1+g[1]*y1); }
    let t2=0.5-x2*x2-y2*y2;
    if(t2>0){ t2*=t2; const g=grad[p[ii+1+p[jj+1]]&7]; n2=t2*t2*(g[0]*x2+g[1]*y2); }
    return 70*(n0+n1+n2);
  }
  function fbm(x,y,oct,lac,gain){
    let a=1,f=1,s=0,norm=0;
    for(let o=0;o<oct;o++){ s+=a*noise2(x*f,y*f); norm+=a; a*=gain; f*=lac; }
    return s/norm;
  }
  return { noise2, fbm };
})();
