/* 360 View Film Crew: hero 360 viewer shared by every page.
   Each page sets window.HERO = {shots:[...], start:'id', slugs:{...}} before loading this file.
   A shot can have: yaw (start angle), fov (zoom factor), pitch (look up/down), lite (small first-load image), dock:false (hide from thumbnails). */
(() => {
const $ = s => document.querySelector(s);
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CFG = window.HERO || {};
const SHOTS = CFG.shots || [];
if (!SHOTS.length || !$('#pano')) return;
const PITCHED = SHOTS.some(s => s.pitch != null);
const GRADE = {e:.96, k:1.16, s:.92, t:[1.04,.99,.95], v:.55};   // the "Cinematic" look picked in the lab
const S = {shot: CFG.start && SHOTS.find(x=>x.id===CFG.start) ? CFG.start : SHOTS[0].id};
let reelPage = 0, activeBar = null;
const dockList = () => SHOTS.filter(o => o.dock!==false);

/* ───── thumbnails ───── */
const ICON_PAUSE = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="1.5" width="2.6" height="9" rx=".8" fill="currentColor"/><rect x="7.4" y="1.5" width="2.6" height="9" rx=".8" fill="currentColor"/></svg>';
const ICON_PLAY = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4c0 .5.5.8.9.5l6.4-4.2c.4-.2.4-.8 0-1L3.9 1.3c-.4-.3-.9 0-.9.5z" fill="currentColor"/></svg>';
function renderScenes(){
  const list = dockList(), box = $('#scenes'); box.textContent='';
  list.forEach(o => {
    const b = document.createElement('button');
    b.type='button'; b.className='scene'; b.dataset.id=o.id;
    b.setAttribute('aria-label', `View ${o.name} in 360`);
    b.innerHTML = `<span class="th" style="background-image:url('${o.thumb}')"><span class="bar"></span></span><span class="nm">${o.name}</span>`;
    b.addEventListener('click', () => switchTo(o.id, true));
    box.append(b);
  });
  const dots = $('#reel-dots'); dots.textContent='';
  const pages = Math.max(1, Math.ceil(list.length/5));
  for (let k=0; k<pages; k++){
    const d = document.createElement('button'); d.type='button'; d.className='dot'; d.setAttribute('aria-label', `Show scenes ${k*5+1} to ${Math.min(list.length,k*5+5)}`);
    d.addEventListener('click', () => goPage(k)); dots.append(d);
  }
  dots.hidden = pages < 2; $('#reel-prev').hidden = $('#reel-next').hidden = pages < 2;
  syncReel();
}
function setPage(k){
  const pages = Math.max(1, Math.ceil(dockList().length/5));
  reelPage = ((k % pages) + pages) % pages;
  $('#scenes').style.setProperty('--page', reelPage);
  document.querySelectorAll('#reel-dots .dot').forEach((d,i) => d.setAttribute('aria-current', i===reelPage));
}
function goPage(k){
  const list = dockList(), pages = Math.max(1, Math.ceil(list.length/5));
  const p = ((k % pages) + pages) % pages;
  setPage(p);
  if (list[p*5]) switchTo(list[p*5].id, true);   // hero jumps to the group's first scene, autoplay carries on from there
}
function syncReel(){
  const list = dockList(), idx = list.findIndex(o=>o.id===S.shot);
  document.querySelectorAll('.scene').forEach(b => b.setAttribute('aria-pressed', S.shot===b.dataset.id));
  activeBar = document.querySelector('.scene[aria-pressed="true"] .bar');
  document.querySelectorAll('.scene .bar').forEach(b => { if (b!==activeBar) b.style.setProperty('--p', 0); });
  const pad = n => String(n).padStart(2,'0');
  $('#reel-count').textContent = idx>=0 ? `${pad(idx+1)} / ${pad(list.length)}` : `— / ${pad(list.length)}`;
  if (idx >= 0) setPage(Math.floor(idx/5));
}
function apply(){
  syncReel();
  viewer.setGrade(GRADE);
  viewer.setCap(getComputedStyle(root).getPropertyValue('--ink'), getComputedStyle(root).getPropertyValue('--accent-solid'));
}

function loadImg(src){ return new Promise((res,rej)=>{ const i=new Image(); i.decoding='async'; i.onload=()=>res(i); i.onerror=rej; i.src=src; }); }

/* ───── WebGL panorama viewer ───── */
const viewer = (() => {
  const cv = $('#pano');
  const gl = cv.getContext('webgl2', {antialias:false, alpha:false, powerPreference:'high-performance'});
  const api = {ok:!!gl, setGrade(){}, setCap(){}, upload(){}, setOff(){}, setFade(){}, draw(){}};
  if (!gl) return api;

  const vs = `#version 300 es
  in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
  const fs = `#version 300 es
  precision highp float;
  uniform sampler2D tex0; uniform sampler2D tex1; uniform float off0, off1, fade; uniform sampler2D logo; uniform float hasLogo; uniform vec2 res; uniform float yaw, pitch, scale, dist, cap, has;
  uniform vec3 grade, tint, capCol, ringCol; uniform float vig;
  out vec4 o;
  void main(){
    vec2 p = (gl_FragCoord.xy*2.0 - res) / res.y;
    vec3 v = normalize(vec3(p*scale, 1.0));
    float b = dist*v.z;
    float t = b + sqrt(max(b*b - dist*dist + 1.0, 0.0));
    vec3 h = vec3(0.0, 0.0, -dist) + t*v;
    float cp = cos(pitch), sp = sin(pitch);
    h = vec3(h.x, h.y*cp + h.z*sp, -h.y*sp + h.z*cp);
    float cy = cos(yaw), sy = sin(yaw);
    h = normalize(vec3(h.x*cy + h.z*sy, h.y, -h.x*sy + h.z*cy));
    float lon = atan(h.x, h.z), lat = asin(clamp(h.y, -1.0, 1.0));
    vec2 uv = vec2(lon/6.28318531 + 0.5, 0.5 - lat/3.14159265);
    vec2 dx = dFdx(uv), dy = dFdy(uv);
    vec2 uw = vec2(fract(uv.x + 0.5), uv.y);
    vec2 dx2 = dFdx(uw), dy2 = dFdy(uw);
    if (dot(dx2,dx2) + dot(dy2,dy2) < dot(dx,dx) + dot(dy,dy)) { dx = dx2; dy = dy2; }
    vec2 uv0 = vec2(uv.x + off0/6.28318531, uv.y), uv1 = vec2(uv.x + off1/6.28318531, uv.y);
    vec3 c;
    if (fade < 0.001) c = textureGrad(tex0, uv0, dx, dy).rgb;
    else if (fade > 0.999) c = textureGrad(tex1, uv1, dx, dy).rgb;
    else c = mix(textureGrad(tex0, uv0, dx, dy).rgb, textureGrad(tex1, uv1, dx, dy).rgb, fade);
    c = mix(capCol + vec3(0.05)*(1.0+h.y), c, has);
    c *= grade.x;
    c = (c - 0.5)*grade.y + 0.5;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, grade.z) * tint;
    // nadir cap: hides the vehicle roof, signs the capture
    float aa = max(fwidth(lat), 1e-4);
    float m = 1.0 - smoothstep(cap - aa, cap + aa, lat);
    float ring = 1.0 - smoothstep(0.0, aa*1.5 + 0.002, abs(lat - (cap - 0.022)));
    float ring2 = 1.0 - smoothstep(0.0, aa*1.5 + 0.001, abs(lat - (cap - 0.075)));
    vec3 capC = capCol * (0.85 + 0.15*smoothstep(-1.5708, cap, lat));
    capC = mix(capC, ringCol, ring*0.95);
    capC = mix(capC, ringCol, ring2*0.35*(1.0-hasLogo));
    vec2 fl = h.xz / max(-h.y, 1e-3);
    fl = vec2(fl.x*cy - fl.y*sy, fl.x*sy + fl.y*cy);
    float R = tan(1.5707963 + cap) * 0.84;
    vec2 luv = vec2(0.5 + fl.x/(2.0*R), 0.5 - fl.y/(2.0*R));
    float la = texture(logo, clamp(luv, 0.0, 1.0)).a * hasLogo * step(abs(luv.x-0.5), 0.5) * step(abs(luv.y-0.5), 0.5);
    capC = mix(capC, vec3(0.97), la*0.95);
    c = mix(c, capC, m);
    c *= 1.0 - vig*smoothstep(0.55, 1.9, length(p*vec2(res.y/res.x*1.25, 1.0)));
    o = vec4(clamp(c, 0.0, 1.0), 1.0);
  }`;
  const sh = (type, src) => { const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(s); return s; };
  const prog = gl.createProgram();
  try { gl.attachShader(prog, sh(gl.VERTEX_SHADER,vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(prog); }
  catch(e){ console.error(e); api.ok=false; return api; }
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog,'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  const U = {}; ['tex0','tex1','off0','off1','fade','logo','hasLogo','res','yaw','pitch','scale','dist','cap','has','grade','tint','capCol','ringCol','vig'].forEach(n => U[n]=gl.getUniformLocation(prog,n));
  const UNITS = [0, 2];
  const T = UNITS.map(u => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0+u); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,1,1,0,gl.RGB,gl.UNSIGNED_BYTE,new Uint8Array([11,15,23])); return t; });
  const tex = T[0];
  const ltex = gl.createTexture(); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, ltex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(U.logo,1); gl.uniform1f(U.hasLogo,0);
  loadImg('/img/logo.png').then(img => {
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, ltex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.useProgram(prog); gl.uniform1f(U.hasLogo,1);
  }).catch(()=>{});
  gl.uniform1i(U.tex0,0); gl.uniform1i(U.tex1,2); gl.uniform1f(U.fade,0); gl.uniform1f(U.off0,0); gl.uniform1f(U.off1,0); gl.uniform1f(U.has,0); gl.uniform1f(U.cap, -73*Math.PI/180);
  const maxTex = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 8192);
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');

  const hex = s => { s=s.trim().replace('#',''); if(s.length===3) s=s.split('').map(c=>c+c).join(''); const n=parseInt(s,16); return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]; };
  api.setGrade = g => { gl.useProgram(prog); gl.uniform3f(U.grade,g.e,g.k,g.s); gl.uniform3fv(U.tint,g.t); gl.uniform1f(U.vig,g.v); api.dirty=true; };
  api.setCap = (ink, acc) => { gl.uniform3fv(U.capCol,hex(ink)); gl.uniform3fv(U.ringCol,hex(acc)); api.dirty=true; };
  api.setFade = f => { gl.useProgram(prog); gl.uniform1f(U.fade, f); };
  api.setOff = (slot, r) => { gl.useProgram(prog); gl.uniform1f(slot ? U.off1 : U.off0, r); };
  api.upload = (slot, img) => {
    let src = img;
    const w = Math.min(img.naturalWidth, maxTex, 4096);
    if (img.naturalWidth > w || img.naturalWidth/img.naturalHeight !== 2) {
      const c = document.createElement('canvas'); c.width = w; c.height = w/2;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); src = c;
    }
    gl.activeTexture(gl.TEXTURE0 + UNITS[slot]); gl.bindTexture(gl.TEXTURE_2D, T[slot]);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    gl.activeTexture(gl.TEXTURE0);
    gl.useProgram(prog); gl.uniform1f(U.has,1);
  };
  api.draw = (cam) => {
    const dpr = Math.min(devicePixelRatio||1, 2);
    const w = Math.round(cv.clientWidth*dpr), h = Math.round(cv.clientHeight*dpr);
    if (cv.width!==w || cv.height!==h){ cv.width=w; cv.height=h; }
    gl.viewport(0,0,w,h);
    gl.uniform2f(U.res,w,h); gl.uniform1f(U.yaw,cam.yaw); gl.uniform1f(U.pitch,cam.pitch);
    gl.uniform1f(U.scale,cam.scale); gl.uniform1f(U.dist,cam.dist);
    gl.drawArrays(gl.TRIANGLES,0,3);
  };
  return api;
})();

/* ───── camera, intro, interaction ───── */
const D = Math.PI/180;
const ease = t => t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
const cam = {yaw:0, pitch:0, scale:1, dist:0};
let view = {yaw:-20*D, pitch:-2*D};       // immersive look direction
let mix = 1, mixFrom = 1, mixTo = 1, mixT0 = 0, mixDur = 1;   // 0 planet · 1 walk-in
let planetSpin = 0;
let vel = 0, velP = 0, lastInteract = -1e9, dragging = false, hintGone = false;

function fovV(){ const a = innerWidth/innerHeight; return (a < .8 ? 100 : a < 1.3 ? 84 : 72) * D; }
function go(to, dur){ mixFrom = mix; mixTo = to; mixT0 = performance.now(); mixDur = dur; setModeButtons(); }
function setModeButtons(){}

function intro(){
  if (reduce){ mix = mixTo = 1; setModeButtons(); return; }
  mix = mixFrom = 0; mixTo = 0; planetSpin = -150*D; setModeButtons();
  setTimeout(() => go(1, 3000), 700);
}

const cv = $('#pano');
let px=0, py=0, pid=null;
cv.addEventListener('pointerdown', e => { pid=e.pointerId; px=e.clientX; py=e.clientY; dragging=true; vel=velP=0; cv.classList.add('dragging'); cv.setPointerCapture(pid); lastInteract=performance.now(); hideHint(); });
cv.addEventListener('pointermove', e => {
  if (!dragging || e.pointerId!==pid) return;
  const k = 2*cam.scale/cv.clientHeight * (mix<1 ? .6 : 1);
  const dx = (e.clientX-px)*k, dy = (e.clientY-py)*k; px=e.clientX; py=e.clientY;
  view.yaw -= dx; vel = -dx;
  if (e.pointerType==='mouse' && mix>.98){ view.pitch = Math.max(-80*D, Math.min(80*D, view.pitch + dy)); velP = dy; }
  lastInteract = performance.now();
});
const end = e => { if (e.pointerId!==pid) return; dragging=false; cv.classList.remove('dragging'); };
cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
function hideHint(){ if (!hintGone){ hintGone=true; $('#hint').classList.add('gone'); $('#mhint').classList.add('gone'); } }
setTimeout(hideHint, 9000);

let tPrev = performance.now();
function frame(now){
  const rdt = Math.min(1, (now-tPrev)/1000), dt = Math.min(.05, rdt); tPrev = now;
  // scene transition: pull back toward planet, crossfade, dive back in
  if (trans){
    const pr = Math.min(1, (now-trans.t0)/trans.dur), lo = .08;
    mix = pr < .42 ? 1 - (1-lo)*ease(pr/.42) : lo + (1-lo)*ease((pr-.42)/.58);
    const f = pr < .28 ? 0 : pr > .62 ? 1 : (pr-.28)/.34;
    viewer.setFade(trans.from + (trans.to-trans.from)*(f*f*(3-2*f)));
    if (pr >= 1){ trans = null; mix = mixFrom = mixTo = 1; }
  } else if (mix !== mixTo){ const k = Math.min(1,(now-mixT0)/mixDur); mix = mixFrom + (mixTo-mixFrom)*ease(k); if (k>=1) mix = mixTo; }
  // autoplay
  const playing = !userPaused && heroVisible && !trans && mix===1 && mixTo===1 && !dragging && now-lastInteract > 3000 && ready;
  if (playing) elapsed += rdt*1000;
  if (ready && !trans){
    const list = dockList(), i = list.findIndex(o=>o.id===S.shot), nxt = list[(i+1) % list.length];
    if (nxt && elapsed > 1500 && preloaded !== nxt.id){ preloaded = nxt.id; getImg(nxt).catch(()=>{}); }
    if (nxt && list.length > 1 && elapsed >= DWELL){ elapsed = 0; switchTo(nxt.id); }
  }
  if (activeBar) activeBar.style.setProperty('--p', Math.max(0, Math.min(1, elapsed/DWELL)).toFixed(3));
  // motion
  if (!dragging){
    vel *= Math.pow(.0025, dt); velP *= Math.pow(.0025, dt);
    view.yaw += vel*dt*60*.5; view.pitch = Math.max(-80*D, Math.min(80*D, view.pitch + velP*dt*60*.5));
    const idle = now - lastInteract > 2600;
    if (idle && !reduce){ view.yaw += (mix<1 ? .16 : .032)*dt*(mix<1?1:1); const tp = (((SHOTS.find(x=>x.id===S.shot)||{}).pitch) ?? -2)*D; view.pitch += (tp - view.pitch)*Math.min(1,dt*(PITCHED ? 1.2 : .6)); }
  }
  const e = mix;
  const zf = (SHOTS.find(x=>x.id===S.shot)||{}).fov || 1;
  const sPlanet = Math.log(3.1), sWalk = Math.log(Math.tan(Math.min(fovV()*zf, 152*D)/2));
  cam.yaw = view.yaw + planetSpin*(1-e);
  cam.pitch = (-90*D)*(1-e) + view.pitch*e;
  cam.scale = Math.exp(sPlanet*(1-e) + sWalk*e);
  cam.dist = 1 - (e<.15 ? 0 : ease(Math.min(1,(e-.15)/.85)));
  if (viewer.ok && heroVisible) viewer.draw(cam);
  requestAnimationFrame(frame);
}

/* ───── shots, transitions, autoplay ───── */
const DWELL = 5000;
let curSlot = 0, trans = null, elapsed = 0, ready = false, preloaded = null, switchTok = 0;
let userPaused = reduce, heroVisible = true;
const imgCache = new Map();
function getImg(sh){
  if (sh.img) return Promise.resolve(sh.img);
  if (!imgCache.has(sh.id)) imgCache.set(sh.id, loadImg(sh.src).then(async im => { try { await im.decode(); } catch(e){} return im; }).catch(e => { imgCache.delete(sh.id); throw e; }));
  return imgCache.get(sh.id);
}
function markLoading(id, on){ document.querySelectorAll(`.scene[data-id="${id}"]`).forEach(b => b.classList.toggle('loading', on)); }
async function loadShot(){
  const sh = SHOTS.find(x=>x.id===S.shot);
  if (!viewer.ok){ const fb=$('#fallback'); fb.hidden=false; fb.style.backgroundImage=`url("${sh.lite || sh.src}")`; $('#loading').hidden=true; return; }
  try {
    const first = sh.lite ? await loadImg(sh.lite).then(async im => { try { await im.decode(); } catch(e){} return im; }) : await getImg(sh);
    viewer.upload(0, first); viewer.setOff(0, 0); viewer.setFade(0); curSlot = 0; ready = true; $('#loading').hidden = true;
    if (sh.lite) getImg(sh).then(full => { if (S.shot === sh.id && !trans && curSlot === 0) viewer.upload(0, full); }).catch(()=>{});
  }
  catch(e){ $('#loading').textContent = 'This panorama could not be loaded.'; }
}
async function switchTo(id, byUser){
  if (S.shot === id) return;
  S.shot = id; apply();
  const sh = SHOTS.find(x=>x.id===id), tok = ++switchTok;
  if (!viewer.ok){ const fb=$('#fallback'); fb.hidden=false; fb.style.backgroundImage=`url("${sh.src}")`; return; }
  elapsed = 0;
  markLoading(id, true);
  let img; try { img = await getImg(sh); } catch(e){ markLoading(id, false); return; }
  markLoading(id, false);
  if (tok !== switchTok) return;
  if (trans){ viewer.setFade(trans.to); trans = null; mix = mixFrom = mixTo = 1; }
  const next = 1 - curSlot;
  viewer.upload(next, img); viewer.setOff(next, sh.yaw*D - view.yaw); if (PITCHED) view.pitch = (sh.pitch ?? -2)*D; ready = true;
  if (reduce){ viewer.setFade(next); curSlot = next; return; }
  planetSpin = -50*D; mixTo = 1; setModeButtons();
  trans = {t0: performance.now(), dur: 2600, from: curSlot, to: next};
  curSlot = next;
}
const heroEl = $('.hero');
if ('IntersectionObserver' in window) new IntersectionObserver(es => { heroVisible = es[0].isIntersecting; }, {threshold: .12}).observe(heroEl);
$('#reel-play').addEventListener('click', e => {
  userPaused = !userPaused; const b = e.currentTarget;
  b.setAttribute('aria-pressed', !userPaused); b.setAttribute('aria-label', userPaused ? 'Play the tour' : 'Pause the tour');
  b.innerHTML = userPaused ? ICON_PLAY : ICON_PAUSE;
});
$('#reel-prev').addEventListener('click', () => goPage(reelPage - 1));
$('#reel-next').addEventListener('click', () => goPage(reelPage + 1));

/* ───── page bits ───── */
document.querySelectorAll('.tier').forEach(t => t.addEventListener('pointerdown', () => {
  document.querySelectorAll('.tier.sel').forEach(o => o.classList.remove('sel'));
  t.classList.add('sel');
}));
document.querySelectorAll('.rv .more').forEach(b=>b.addEventListener('click',()=>{const f=b.closest('.rv');const o=f.classList.toggle('open');b.textContent=o?'Show less':'Read more';b.setAttribute('aria-expanded',o);}));
const BOOKING_URL = 'https://calendar.app.google/eQEj3reuLJ5Dr1bd8';                          // Google Calendar booking page. Empty = scroll to the contact form.
const SOCIAL = { facebook: 'https://www.facebook.com/people/360-View-Film-Crew/61564586767416/', google: 'https://share.google/5Hr2AAEuKY0ThZEBi' };     // Facebook page and Google Business Profile links
document.querySelectorAll('[data-book]').forEach(a => {
  if (BOOKING_URL){ a.href = BOOKING_URL; a.target = '_blank'; a.rel = 'noopener'; }
});
Object.entries(SOCIAL).forEach(([k,u]) => { const a = document.querySelector(`[data-social="${k}"]`); if (a && u){ a.href = u; a.hidden = false; } });

/* ───── links to text prospects, e.g. gogeolocal.com/#gyms opens on the gym tour ───── */
const SLUGS = CFG.slugs || {};
const slug = decodeURIComponent(location.hash.slice(1)).toLowerCase();
if (SLUGS[slug] && SHOTS.find(x=>x.id===SLUGS[slug])) S.shot = SLUGS[slug];

renderScenes(); apply();
view.yaw = (SHOTS.find(x=>x.id===S.shot).yaw)*D;
if (viewer.ok) { intro(); requestAnimationFrame(frame); }
loadShot();
})();
