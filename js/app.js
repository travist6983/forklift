/* Bell Forklift — scroll engine.
   One forklift ("the rig") is fixed to the viewport. Every level is a sticky stage; while a stage is
   stuck its floor line sits exactly under the rig, and the forklift's state is a pure function of
   scroll progress through that level (keyframes sampled every frame — fully reversible).
   Between levels the forklift waits in a freight-elevator cage while the page scrolls past it,
   so it reads as riding down through the building. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const ART = window.ART;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const E = {
    lin: (t) => t,
    i: (t) => t * t,
    o: (t) => 1 - (1 - t) * (1 - t),
    io: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    o3: (t) => 1 - Math.pow(1 - t, 3),
    io3: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    i3: (t) => t * t * t,
    back: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    bounce: (t) => {
      const n = 7.5625, d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
      if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
      return n * (t -= 2.625 / d) * t + 0.984375;
    },
  };
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const G = {};
  const INTRO = { dx: -4000, L: 0 };
  let lenis = null;

  /* ======================================================================
     Keyframe scripts
     ====================================================================== */
  function script(init) {
    const keys = [{ t: 0, s: { ...init }, e: 'io' }];
    const marks = {};
    let cur = 0, st = { ...init };
    const api = {
      to(d, ch = {}, e = 'io') { cur += d; st = { ...st, ...ch }; keys.push({ t: cur, s: { ...st }, e }); return api; },
      set(ch) { st = { ...st, ...ch }; keys.push({ t: cur, s: { ...st }, e: 'lin' }); return api; },
      hold(d) { return api.to(d, {}, 'lin'); },
      mark(n) { marks[n] = cur; return api; },
      get state() { return st; },
      done() { const T = cur || 1; keys.forEach((k) => (k.t /= T)); for (const k in marks) marks[k] /= T; return { keys, marks }; },
    };
    return api;
  }
  function sample(keys, t) {
    let i = 0;
    const n = keys.length;
    while (i + 1 < n && keys[i + 1].t <= t) i++;
    const a = keys[i];
    if (i + 1 >= n) return { ...a.s };
    const b = keys[i + 1];
    const e = (E[b.e] || E.io)(clamp((t - a.t) / (b.t - a.t)));
    const o = {};
    for (const k in a.s) {
      const va = a.s[k], vb = b.s[k];
      o[k] = typeof va === 'number' && typeof vb === 'number' ? va + (vb - va) * e : va;
    }
    return o;
  }
  const BASE = () => ({ x: G.elevX, L: 0, tilt: 0, flip: 1, gate: 0, drop: 1, tr: 0, jack: 0, rock: 0, tw: 0, gloss: 0, spark: 0, conf: 0, glow: 0, tagV: 0, tag: '', lights: 1, weave: 0 });
  const S0 = (init) => script(Object.assign(BASE(), init));
  const D = (S, x, k = 1) => (0.7 + (Math.abs(x - S.state.x) / G.w) * 1.15) * k;

  /* common forklift moves */
  const M = {
    out: (S) => S.to(1.4, { gate: 1 }),
    home: (S) => S.to(D(S, G.elevX), { x: G.elevX, L: 0, tilt: 0 }).to(1.3, { gate: 0 }).hold(0.5),
    pick(S, X, id, h = 0) {
      if (Math.abs(S.state.x - (X - 0.24 * G.w)) > 2 || S.state.L !== h) S.to(D(S, X - 0.24 * G.w), { x: X - 0.24 * G.w, L: h });
      S.to(1.1, { x: X }).set({ ['_' + id]: 'held' }).to(0.9, { L: h + 10, tilt: -3 });
      return S;
    },
    place(S, X, id, where, h = 0) {
      S.to(D(S, X - 0.2 * G.w), { x: X - 0.2 * G.w, L: h + 10 });
      S.to(1, { x: X, tilt: 0 }).to(0.8, { L: h }).set({ ['_' + id]: where }).to(1.1, { x: X - 0.26 * G.w });
      return S;
    },
  };

  /* ======================================================================
     World-space SVG helpers (forklift units → px)
     ====================================================================== */
  function worldSVG(container, inner, x0, y0, wu, hu, cls = 'prop') {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `${x0} ${y0} ${wu} ${hu}`);
    svg.setAttribute('class', cls);
    svg.setAttribute('overflow', 'visible');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = inner;
    svg._b = { x0, y0, wu, hu };
    container.appendChild(svg);
    return svg;
  }
  function placeAt(svg, X, dy = 0) {
    const { x0, y0, wu, hu } = svg._b, s = G.s;
    svg._X = X;
    svg.style.width = wu * s + 'px';
    svg.style.height = hu * s + 'px';
    svg.style.transform = `translate3d(${X + x0 * s}px, ${G.rigTop + y0 * s + dy}px, 0)`;
    return svg;
  }
  function vis(el, on) { if (el._v !== on) { el._v = on; el.style.visibility = on ? 'visible' : 'hidden'; } }
  function item(lv, id, places, container) {
    const it = { id, els: {} };
    for (const p in places) {
      const el = worldSVG(container || lv.props, ART.CARGO[id].art(), 300, 0, 112, 296);
      placeAt(el, places[p].X, -(places[p].L || 0) * G.s);
      el.style.visibility = 'hidden';
      it.els[p] = el;
    }
    lv.items.push(it);
    return it;
  }
  function applyItems(lv, st) {
    for (const it of lv.items) {
      const v = st['_' + it.id];
      for (const p in it.els) vis(it.els[p], v === p);
    }
  }

  /* ---------- scenery art (forklift units) ---------- */
  function rackArt(Hs, o = {}) {
    const top = 290 - 2 * Hs - 36;
    const post = (x) => `<rect x="${x}" y="${top}" width="6" height="${296 - top}" fill="${o.post || 'url(#gRack)'}"/>`;
    const lace = (x1, x2) => {
      let d = `M${x1 + 6} 290`;
      let up = true;
      for (let y = 290 - 30; y > top + 8; y -= 30) { d += ` L${up ? x2 : x1 + 6} ${y}`; up = !up; }
      return `<path d="${d}" stroke="${o.lace || '#2a5cb4'}" stroke-width="2.2" fill="none" opacity=".9"/>`;
    };
    const beam = (x, h) => `<rect x="${x - 2}" y="${290 - h}" width="10" height="9" rx="1" fill="${o.beam || '#ff7a1a'}"/>`;
    const frame = (x) => post(x) + post(x + 100) + lace(x, x + 100) + beam(x, Hs) + beam(x + 100, Hs) + beam(x, 2 * Hs) + beam(x + 100, 2 * Hs) +
      `<rect x="${x - 3}" y="288" width="12" height="4" fill="#111"/><rect x="${x + 97}" y="288" width="12" height="4" fill="#111"/>`;
    let s = frame(303);
    if (o.back !== false) s += frame(423);
    if (o.decor !== false) {
      s += `<g transform="translate(0 ${-2 * Hs})">${ART.cartons(o.l1 || 'A-12')}</g>`;
      if (o.back !== false) {
        s += `<g transform="translate(120 0)">${ART.drums()}</g>`;
        s += `<g transform="translate(120 ${-Hs})">${ART.cartons(o.l2 || 'B-07', '#ffe7a6')}</g>`;
        s += `<g transform="translate(120 ${-2 * Hs})">${ART.cartons(o.l3 || 'C-21')}</g>`;
      }
      if (o.front !== false) s += ART.cartons(o.l4 || 'A-01', '#d9ecff');
    }
    return s;
  }
  function coneSVG(container, cls) {
    const d = document.createElement('div');
    d.className = cls;
    d.innerHTML = ART.cone();
    d.style.position = 'absolute';
    d.style.left = '0';
    d.style.top = '0';
    d.style.transformOrigin = '50% 100%';
    container.appendChild(d);
    return d;
  }

  /* ======================================================================
     Rig (forklift + elevator cage)
     ====================================================================== */
  const rigEl = $('#rig'), flWrap = $('#flWrap'), cageBackEl = $('#cageBack'), cageFrontEl = $('#cageFront'), fxEl = $('#fx'), tagEl = $('#flTag');
  const cab1 = $('#cab1'), cab2 = $('#cab2');
  flWrap.innerHTML = ART.forklift();
  cageBackEl.innerHTML = ART.cageBack();
  cageFrontEl.innerHTML = ART.cageFront();
  flWrap.style.transformOrigin = '50% 96.67%';
  const FL = {
    all: $('.fl-all', flWrap), mast: $('.fl-mast', flWrap), inner: $('.fl-inner', flWrap), carriage: $('.fl-carriage', flWrap), chain: $('.fl-chain', flWrap),
    wr: $('.fl-wr .spin', flWrap), wf: $('.fl-wf', flWrap), wfSpin: $('.fl-wf .spin', flWrap), gloss: $('.fl-wf .gloss', flWrap),
    spot: $('.fl-spot', flWrap), spotR: $('.fl-spot-r', flWrap), beep: $('.fl-beep', flWrap), cargo: {}, held: '',
  };
  $$('.cg', flWrap).forEach((g) => (FL.cargo[g.dataset.cargo] = g));
  const CG = { lvl: $('.cage-lvl', cageBackEl), bar: $('.cage-bar', cageFrontEl), gate: $('.cage-gate', cageFrontEl), led: $('.cage-led', cageBackEl) };
  const rigCones = document.createElement('div');
  rigCones.className = 'rig-cones';
  rigCones.style.visibility = 'hidden';
  rigEl.insertBefore(rigCones, cageFrontEl);
  // particles
  const sparkBox = document.createElement('div');
  sparkBox.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0';
  for (let i = 0; i < 20; i++) {
    const sp = document.createElement('i');
    sp.className = 'spark';
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
    const d = 30 + Math.random() * 70;
    sp.style.setProperty('--dx', Math.cos(a) * d + 'px');
    sp.style.setProperty('--dy', Math.sin(a) * d + 30 + 'px');
    sp.style.setProperty('--dur', 0.35 + Math.random() * 0.45 + 's');
    sp.style.setProperty('--del', -Math.random() + 's');
    sparkBox.appendChild(sp);
  }
  const confBox = document.createElement('div');
  confBox.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0';
  const CONF = ['#d3131d', '#ffc21a', '#ffffff', '#2f86ff', '#ff7a1a'];
  for (let i = 0; i < 54; i++) {
    const c = document.createElement('i');
    c.className = 'conf';
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    const d = 120 + Math.random() * 260;
    c.style.background = CONF[i % CONF.length];
    c.style.setProperty('--dx', Math.cos(a) * d + 'px');
    c.style.setProperty('--dy', Math.sin(a) * d + 180 + Math.random() * 120 + 'px');
    c.style.setProperty('--rot', (Math.random() - 0.5) * 900 + 'deg');
    c.style.setProperty('--dur', 1.4 + Math.random() * 1.2 + 's');
    c.style.setProperty('--del', -Math.random() * 2 + 's');
    confBox.appendChild(c);
  }
  fxEl.append(sparkBox, confBox);
  const TAGS = { diag: 'Diagnostics · pass', tires: 'New tires installed', cert: 'Operator certified', ship: 'Outbound · on schedule' };

  const hud = { el: $('#hud'), lvl: $('#hudLvl'), lift: $('#hudLift'), load: $('#hudLoad'), spd: $('#hudSpd') };
  const panelBtns = $$('#panel button');
  let lastOdo = null, vel = 0, spd = 0, hudCache = {};

  function setTxt(el, key, v) { if (hudCache[key] !== v) { hudCache[key] = v; el.textContent = v; } }

  function renderRig(st, Y, dt, labelLv, riding) {
    const s = G.s, w = G.w;
    const show = Y > -60 && Y < G.H + 320 * s;
    if (rigEl._show !== show) { rigEl._show = show; rigEl.style.visibility = show ? 'visible' : 'hidden'; }
    const flip = st.flip < 0 ? -1 : 1;
    let sx = st.flip;
    if (Math.abs(sx) < 0.03) sx = 0.03 * flip;
    const ws = st.weaveS || 1;
    const yOff = -(st.jack || 0) * s + (st.weaveY || 0) + (riding ? Math.sin(performance.now() / 45) * 0.6 : 0);
    flWrap.style.transform = `translate3d(${st.x}px, ${Y - 290 * s + yOff}px, 0) scale(${sx * ws}, ${ws})`;

    const L = Math.max(0, st.L || 0), iDY = Math.max(0, L - 70);
    FL.carriage.setAttribute('transform', `translate(0 ${-L})`);
    FL.inner.setAttribute('transform', `translate(0 ${-iDY})`);
    FL.chain.setAttribute('y1', 44 - iDY);
    FL.chain.setAttribute('y2', 220 - L);
    FL.mast.setAttribute('transform', `rotate(${st.tilt || 0} 292 286)`);
    FL.all.setAttribute('transform', `rotate(${st.rock || 0} 92 290)`);

    const odo = st.x - (st.tr || 0);
    FL.wr.setAttribute('transform', `rotate(${((flip * odo) / (26 * s)) * 57.2958 % 360} 92 264)`);
    let tdx = 0;
    const tw = st.tw || 0;
    if (tw > 0 && tw < 1) tdx = (tw < 0.5 ? E.i(tw * 2) : 1 - E.o3((tw - 0.5) * 2)) * 900;
    FL.wf.setAttribute('transform', `translate(${tdx} 0)`);
    FL.wfSpin.setAttribute('transform', `rotate(${(((flip * odo) / s + tdx) / 30) * 57.2958 % 360} 240 260)`);
    FL.gloss.setAttribute('stroke-opacity', (st.gloss || 0) * 0.55);

    let held = '';
    for (const k in st) if (k.charCodeAt(0) === 95 && st[k] === 'held') { held = k.slice(1); break; }
    if (held !== FL.held) {
      if (FL.held && FL.cargo[FL.held]) FL.cargo[FL.held].style.display = 'none';
      if (held && FL.cargo[held]) FL.cargo[held].style.display = '';
      FL.held = held;
    }

    // velocity-driven lights: blue spot ahead when driving forward, behind + beeper when reversing
    const v = lastOdo == null ? 0 : (odo - lastOdo) / Math.max(dt, 0.001);
    lastOdo = odo;
    vel = lerp(vel, clamp(v, -6000, 6000), 0.18);
    const fwd = vel * flip;
    const kFwd = clamp((fwd - w * 0.12) / (w * 0.5)), kRev = clamp((-fwd - w * 0.12) / (w * 0.5));
    FL.spot.setAttribute('opacity', kFwd.toFixed(3));
    FL.spotR.setAttribute('opacity', kRev.toFixed(3));
    FL.beep.setAttribute('opacity', kRev > 0.25 ? 1 : 0);

    // cage
    const cx = G.cx0 + (st.tr || 0);
    const drop = st.drop == null ? 1 : st.drop;
    const cy = Y - 290 * s - (1 - drop) * (Y + 60) + (riding ? Math.sin(performance.now() / 45) * 0.6 : 0);
    const ct = `translate3d(${cx}px, ${cy}px, 0)`;
    cageBackEl.style.transform = ct;
    cageFrontEl.style.transform = ct;
    const g = clamp(st.gate || 0);
    CG.bar.setAttribute('transform', `translate(0 ${-g * 128})`);
    CG.gate.setAttribute('transform', `translate(414 28) scale(1 ${1 - g * 0.9}) translate(0 -28)`);
    const ctop = cy + 10 * s;
    for (const [ln, ux] of [[cab1, 110], [cab2, 330]]) {
      ln.setAttribute('x1', cx + ux * s); ln.setAttribute('x2', cx + ux * s);
      ln.setAttribute('y1', -10); ln.setAttribute('y2', Math.max(-10, ctop));
    }
    const cabO = riding || drop < 0.999 ? '1' : '0.28';
    if (rigEl._cab !== cabO) { rigEl._cab = cabO; cab1.parentNode.style.opacity = cabO; }
    const code = labelLv ? labelLv.code : 'G';
    const lbl = riding ? '▼ ' + code : code;
    if (CG.lvl._t !== lbl) { CG.lvl._t = lbl; CG.lvl.textContent = lbl; }
    CG.led.setAttribute('fill', riding ? '#ffb000' : g > 0.5 ? '#3bff7a' : '#ff3b3b');

    // tag above the forklift
    const tv = st.tagV || 0;
    if (tv > 0.01) {
      if (tagEl._t !== st.tag) { tagEl._t = st.tag; tagEl.firstElementChild.textContent = TAGS[st.tag] || ''; }
      tagEl.style.opacity = tv;
      tagEl.style.transform = `translate3d(${st.x + w * 0.5}px, ${Y - 305 * s - 34 + yOff - (1 - tv) * 14}px, 0)`;
    } else if (tagEl.style.opacity !== '0') tagEl.style.opacity = '0';

    // particles
    const sparking = (st.spark || 0) > 0.5, confetti = (st.conf || 0) > 0.5;
    fxEl.classList.toggle('sparking', sparking);
    fxEl.classList.toggle('confetti', confetti);
    if (sparking) sparkBox.style.transform = `translate3d(${st.x + 214 * s}px, ${Y - 112 * s + yOff}px, 0)`;
    if (confetti) confBox.style.transform = `translate3d(${st.x + 358 * s}px, ${Y - (L + 110) * s}px, 0)`;
    rigEl.classList.toggle('lights-off', (st.lights == null ? 1 : st.lights) < 0.5);

    // HUD
    const mph = clamp(((Math.abs(st.hudV != null ? st.hudV : vel) * 3.5) / w) * 2.237, 0, st.hudV != null ? 65 : 11.9);
    spd = lerp(spd, mph, 0.12);
    setTxt(hud.lvl, 'l', code);
    setTxt(hud.lift, 'h', String(Math.round(L * 8.7)).padStart(4, '0'));
    setTxt(hud.load, 'w', held ? ART.CARGO[held].lb.toLocaleString() : '0');
    setTxt(hud.spd, 's', spd.toFixed(1));
  }

  /* ======================================================================
     Levels
     ====================================================================== */
  const LEVELS = {};

  /* ---------- G · hero ---------- */
  const heroMedia = $('#heroMedia'), heroCeil = $('#heroCeil'), scrollCue = $('#scrollCue'), heroMeta = $('.hero-meta');
  LEVELS.dock = {
    build(lv) {
      const Xh = G.A + (G.mob ? 0.1 : 0.2) * (G.B - G.A);
      lv.Xh = Xh;
      const S = S0({ x: Xh, gate: 1, drop: 0 });
      S.hold(0.8).to(3, { drop: 1 }, 'o3').hold(0.3).to(D(S, G.elevX) * 1.4, { x: G.elevX }).to(1.3, { gate: 0 }).hold(1);
      return S.done();
    },
    apply(lv, st, t) {
      const e = E.io(clamp(t / 0.75));
      heroMedia.style.transform = `scale(${1 - 0.075 * e})`;
      heroMedia.style.borderRadius = `${e * 30}px`;
      heroCeil.style.transform = `translate3d(0, ${-t * 110}px, 0)`;
      heroCeil.style.opacity = 1 - clamp((t - 0.12) / 0.45);
      scrollCue.style.opacity = 1 - clamp(t * 7);
      heroMeta.style.opacity = 1 - clamp(t * 4);
    },
  };

  /* ---------- 1 · Your Choice (high-lift reveal) ---------- */
  const bgGlow = $('.lv-offers .bg-glow');
  LEVELS.offers = {
    build(lv) {
      const Xp = G.A + (G.mob ? 0.5 : 0.36) * (G.B - G.A);
      const LH = G.mob ? 150 : 178;
      item(lv, 'promo', { floor: { X: Xp, L: 0 } });
      lv.lids = $$('.lid', lv.props).concat($$('.lid', FL.cargo.promo));
      lv.rays = $$('.rays', lv.props).concat($$('.rays', FL.cargo.promo));
      const S = S0({ lid: 0, burst: 0, _promo: 'floor' });
      M.out(S);
      M.pick(S, Xp, 'promo');
      S.to(1.2, { x: Xp - 0.1 * G.w });
      S.to(3.2, { L: LH, tilt: 0 }).to(1.6, { lid: 1, glow: 1 }, 'back').to(3.4, { burst: 1 }, 'o').hold(6);
      S.to(1, { glow: 0.35 }).to(2.6, { L: 10 }).to(1, { x: Xp }).to(0.8, { L: 0 }).set({ _promo: 'floor' }).to(1.1, { x: Xp - 0.26 * G.w });
      M.home(S);
      // fly-out vectors for the offer cards (from the crate mouth to their resting place)
      const cX = Xp - 0.1 * G.w + 358 * G.s, cY = G.F - (LH + 70) * G.s;
      const sr = lv.stage.getBoundingClientRect();
      lv.bursts = $$('[data-burst]', lv.stage).map((el) => {
        el.style.transform = 'none';
        const r = el.getBoundingClientRect();
        return { el, i: +el.dataset.burst, dx: cX - (r.left + r.width / 2 - sr.left), dy: cY - (r.top + r.height / 2 - sr.top) };
      });
      lv.counts = $$('.count', lv.stage);
      bgGlow.style.setProperty('--gx', ((cX / G.W) * 100).toFixed(1) + '%');
      return S.done();
    },
    apply(lv, st) {
      applyItems(lv, st);
      const lid = `rotate(${-st.lid * 122} 310 200)`;
      for (const l of lv.lids) l.setAttribute('transform', lid);
      for (const r of lv.rays) r.setAttribute('opacity', st.glow.toFixed(3));
      bgGlow.style.opacity = st.glow * 0.9;
      for (const b of lv.bursts) {
        const p = clamp((st.burst - b.i * 0.13) / 0.6), e = E.o3(p);
        b.el.style.opacity = clamp(p * 2.4);
        b.el.style.transform = p >= 1 ? 'none' : `translate3d(${b.dx * (1 - e)}px, ${b.dy * (1 - e)}px, 0) scale(${0.1 + 0.9 * e}) rotate(${(1 - e) * (b.i % 2 ? 16 : -16)}deg)`;
      }
      const k = clamp((st.burst - 0.2) / 0.6);
      for (const c of lv.counts) writeCount(c, +c.dataset.to * E.o3(k));
    },
  };

  /* ---------- 2 · Since 1972 (block stacking) ---------- */
  const statEls = $$('#stats li'), yearGhost = $('.year-ghost');
  LEVELS.about = {
    build(lv) {
      const span = G.B - G.A;
      const Xs = Math.max(G.A + 0.3 * G.w, G.A + 0.12 * span);
      const Xt = Math.min(G.B, Xs + Math.max(0.62 * G.w, 0.34 * span));
      const CH = 64, DROP = 300;
      lv.DROP = DROP;
      item(lv, 'c1', { drop: { X: Xs }, src: { X: Xs }, stack: { X: Xt, L: 0 } });
      item(lv, 'c2', { drop: { X: Xs }, src: { X: Xs }, stack: { X: Xt, L: CH } });
      item(lv, 'c3', { drop: { X: Xs }, src: { X: Xs }, stack: { X: Xt, L: 2 * CH } });
      lv.hook = placeAt(worldSVG(lv.props, `
        <defs><linearGradient id="gCableFade" gradientUnits="userSpaceOnUse" x1="0" y1="-160" x2="0" y2="40"><stop offset="0" stop-color="#2b2b2e" stop-opacity="0"/><stop offset="1" stop-color="#2b2b2e"/></linearGradient></defs>
        <line class="hk-cable" x1="358" y1="-160" x2="358" y2="212" stroke="url(#gCableFade)" stroke-width="2.4"/>
        <g class="hk"><rect x="346" y="204" width="24" height="9" rx="2" fill="#ffc21a"/><rect x="346" y="204" width="24" height="3" fill="#141414"/>
        <path d="M352 213 L340 226 M364 213 L376 226" stroke="#3a3a3e" stroke-width="2"/></g>`, 330, -170, 60, 420), Xs);
      lv.hookCable = $('.hk-cable', lv.hook);
      lv.hookG = $('.hk', lv.hook);
      const S = S0({ hook: 0, _c1: 'none', _c2: 'none', _c3: 'none' });
      const deliver = (id) => S.set({ ['_' + id]: 'drop', hook: 0 }).to(2.4, { hook: 1 }, 'o3').set({ ['_' + id]: 'src' }).to(1.1, { hook: 0 }, 'i');
      M.out(S);
      S.to(D(S, Xs - 0.26 * G.w), { x: Xs - 0.26 * G.w });
      ['c1', 'c2', 'c3'].forEach((id, k) => {
        deliver(id);
        M.pick(S, Xs, id);
        M.place(S, Xt, id, 'stack', k * CH);
        S.mark('s' + (k + 1)).hold(1.4);
        if (k < 2) S.to(D(S, Xs - 0.26 * G.w), { x: Xs - 0.26 * G.w, L: 0 });
      });
      S.to(1.2, { L: 0 }).mark('s4').hold(2);
      M.home(S);
      return S.done();
    },
    apply(lv, st, t) {
      applyItems(lv, st);
      const s = G.s, hk = st.hook || 0;
      const dropU = (1 - hk) * lv.DROP;
      for (const it of lv.items) {
        const el = it.els.drop;
        if (el._v) { el.style.transform = `translate3d(${el._X + 300 * s}px, ${G.rigTop - dropU * s}px, 0)`; el.style.opacity = clamp(hk * 4); }
      }
      const showHook = hk > 0.002;
      vis(lv.hook, showHook);
      if (showHook) {
        lv.hookG.setAttribute('transform', `translate(0 ${-dropU})`);
        lv.hookCable.setAttribute('y2', 212 - dropU);
      }
      const m = lv.marks;
      statEls.forEach((li, i) => {
        const on = t >= m['s' + (i + 1)] - 0.002;
        if (li._on !== on) {
          li._on = on;
          li.classList.toggle('on', on);
          const c = $('.count', li);
          if (on) countUp(c); else writeCount(c, 0);
        }
      });
      yearGhost.style.transform = `translate3d(0, ${-t * 80}px, 0)`;
    },
  };

  /* ---------- 3 · Equipment (horizontal aisle, rack put-away) ---------- */
  const track = $('#track'), trackProps = $('.track-props'), bays = $$('.bay'), equipIdx = $('#equipIdx'), equipBar = $('#equipBar'), aisle = $('.aisle-lights');
  LEVELS.equipment = {
    build(lv) {
      trackProps.innerHTML = '';
      const wide = G.W >= 980;
      const PW = wide ? Math.min(G.W * 0.56, 860) : G.W * 0.86;
      const GAPB = wide ? G.W * 0.16 : G.W * 0.22;
      const target = wide ? G.W * 0.36 : G.W * 0.07;
      const Xd = G.A + (G.mob ? 0.02 : 0.05) * (G.B - G.A);
      const C0 = 0.87 * G.w + target;
      const head = $('.equip-head', lv.stage);
      const sr = lv.stage.getBoundingClientRect(), hr = head.getBoundingClientRect();
      const top = hr.bottom - sr.top + (G.mob ? 14 : 24);
      const bottom = G.F - 330 * G.s - 14;
      const cardH = Math.max(150, bottom - top);
      const Hs = 110;
      lv.cards = [];
      const R = [], P = [];
      bays.forEach((b, k) => {
        const C = C0 + k * (PW + GAPB);
        Object.assign(b.style, { left: C + 'px', top: top + 'px', width: PW + 'px', height: cardH + 'px' });
        lv.cards.push({ C, img: $('img', b) });
        R[k] = C - target + Xd;
        P[k] = R[k] - 0.42 * G.w;
        placeAt(worldSVG(trackProps, rackArt(Hs, { l1: ['N-01', 'U-14', 'R-22'][k] }), 296, 0, 240, 300), R[k]);
        item(lv, 'e' + (k + 1), { floor: { X: P[k], L: 0 }, rack: { X: R[k], L: Hs } }, trackProps);
      });
      track.style.width = C0 + 3 * (PW + GAPB) + 'px';
      lv.PW = PW;
      const S = S0({ _e1: 'floor', _e2: 'floor', _e3: 'floor' });
      M.out(S);
      S.to(D(S, Xd), { x: Xd });
      const trD = (to) => 0.7 + (Math.abs(to - S.state.tr) / G.w) * 0.9;
      for (let k = 0; k < 3; k++) {
        const id = 'e' + (k + 1);
        let to = Xd - P[k] + 0.24 * G.w;
        S.to(trD(to), { tr: to });
        S.to(1.1, { tr: Xd - P[k] }).set({ ['_' + id]: 'held' }).to(0.9, { L: 10, tilt: -3 });
        to = Xd - R[k] + 0.2 * G.w;
        S.to(trD(to) + 1, { tr: to, L: Hs + 10 });
        S.to(1, { tr: Xd - R[k], tilt: 0 }).to(0.8, { L: Hs }).set({ ['_' + id]: 'rack' });
        S.to(1.1, { tr: Xd - R[k] + 0.26 * G.w }).to(1.1, { L: 0 }).mark('b' + k).hold(2.2);
      }
      S.to(3.4, { tr: 0 }, 'io3').mark('rew');
      M.home(S);
      return S.done();
    },
    apply(lv, st, t) {
      applyItems(lv, st);
      track.style.transform = `translate3d(${st.tr}px, 0, 0)`;
      aisle.style.transform = `translate3d(${(st.tr * 0.35) % (G.W * 0.25)}px, 0, 0)`;
      const m = lv.marks;
      const idx = t < m.b0 ? 0 : t < m.b1 ? 1 : 2;
      setTxt(equipIdx, 'eq', '0' + (idx + 1));
      equipBar.style.width = clamp(t / m.rew) * 100 + '%';
      for (const c of lv.cards) {
        const center = c.C + st.tr + lv.PW / 2;
        c.img.style.transform = `translate3d(${(center - G.W / 2) * -0.06}px, 0, 0) scale(1.14)`;
      }
    },
  };

  /* ---------- 4 · Services (jack, parts, tire swap, cone course, racking) ---------- */
  const svcLis = $$('#svcList li'), svcImgs = $$('.svc-imgs img'), svcDesc = $$('#svcDesc p');
  LEVELS.services = {
    build(lv) {
      rigCones.innerHTML = '';
      const span = G.B - G.A, w = G.w, s = G.s;
      const Xj = G.A + (G.mob ? 0.08 : 0.14) * span;
      const Xpp = Xj + 0.5 * w;
      const Xsh = Math.min(G.B, Xpp + Math.max(0.56 * w, 0.24 * span));
      const Xt = Xj + 0.2 * w;
      const Xw = Math.min(Xj + 0.4 * w, G.B - 0.3 * w);
      const Hs = 120;
      // scissor-lift
      lv.jack = placeAt(worldSVG(lv.props, `
        <line class="ja1" x1="72" y1="296" x2="262" y2="296" stroke="#ffc21a" stroke-width="7"/>
        <line class="ja2" x1="72" y1="296" x2="262" y2="296" stroke="#e0a800" stroke-width="7"/>
        <g class="jp"><rect x="44" y="290" width="244" height="7" rx="1.5" fill="#26282c"/><rect x="44" y="290" width="244" height="2.6" fill="url(#pHaz)"/></g>`, 40, 200, 260, 100), Xj);
      lv.ja1 = $('.ja1', lv.jack); lv.ja2 = $('.ja2', lv.jack); lv.jp = $('.jp', lv.jack);
      // parts shelf
      lv.shelf = placeAt(worldSVG(lv.props, rackArt(100, { back: false, decor: false, post: '#8b9099', lace: '#6f747d', beam: '#d3131d' }), 296, 0, 130, 300), Xsh);
      lv.shelf.style.transformOrigin = '50% 100%';
      item(lv, 'parts', { floor: { X: Xpp, L: 0 }, shelf: { X: Xsh, L: 100 } });
      // warehouse rack
      lv.rack = placeAt(worldSVG(lv.props, rackArt(Hs, { front: false, l1: 'W-01' }), 296, 0, 240, 300), G.B);
      item(lv, 'drums', { floor: { X: Xw, L: 0 }, rack: { X: G.B, L: Hs } });
      // cones
      const c0 = Xt + 1.2 * w, c1 = G.B + 0.85 * w;
      const n = clamp(Math.floor((c1 - c0) / (0.55 * w)) + 1, 3, 7);
      const sp = (c1 - c0) / (n - 1);
      lv.cones = [];
      for (let i = 0; i < n; i++) {
        const front = i % 2 === 0;
        const el = coneSVG(front ? rigCones : lv.props, 'cone');
        const cw = 40 * s * 1.15, ch = 60 * s * 1.15;
        Object.assign(el.style, { width: cw + 'px', height: ch + 'px' });
        el._x = c0 + i * sp - cw / 2; el._y = G.F - ch + 3 * s * (front ? 1 : -1);
        lv.cones.push(el);
      }
      lv.coneC0 = c0; lv.coneSp = sp;
      const S = S0({ jv: 0, pv: 0, shelfV: 0, cones: 0, rackB: 0, dv: 0, _parts: 'none', _drums: 'none' });
      // a) service
      S.to(1.4, { gate: 1, jv: 1 }).to(D(S, Xj), { x: Xj }).to(2, { jack: 46 }).set({ tag: 'diag' }).to(1, { spark: 1, tagV: 1 }).hold(3.2).to(0.8, { spark: 0, tagV: 0 }).to(1.8, { jack: 0 }).mark('m1');
      // b) parts
      S.set({ _parts: 'floor' }).to(1.2, { pv: 1, shelfV: 1 });
      M.pick(S, Xpp, 'parts');
      S.to(0.6, { jv: 0 });
      M.place(S, Xsh, 'parts', 'shelf', 100);
      S.to(1.1, { L: 0 }).hold(1).mark('m2');
      // c) tires
      S.to(D(S, Xt), { x: Xt }).to(1.2, { rock: -4.5 }).to(2.4, { tw: 0.5 }, 'lin').to(2.4, { tw: 1, gloss: 1 }, 'lin')
        .set({ tag: 'tires' }).to(1, { rock: 0, tagV: 1 }).hold(1.8).to(0.8, { tagV: 0 }).mark('m3');
      // d) training
      S.to(1.2, { cones: 1, shelfV: 0, pv: 0, gloss: 0 }).to(D(S, G.B, 2.2), { x: G.B, weave: 1 }, 'io').set({ tag: 'cert' })
        .to(1, { tagV: 1 }).hold(1.6).to(1, { cones: 0, tagV: 0, weave: 0 }).mark('m4');
      // e) warehouse solutions
      S.to(D(S, Xw - 0.26 * w), { x: Xw - 0.26 * w }).set({ _drums: 'floor' }).to(1.4, { dv: 1, rackB: 1 });
      M.pick(S, Xw, 'drums');
      M.place(S, G.B, 'drums', 'rack', Hs);
      S.to(1.1, { L: 0 }).hold(1.6);
      M.home(S);
      return S.done();
    },
    apply(lv, st, t, active) {
      applyItems(lv, st);
      const s = G.s;
      // jack
      const jh = st.jack || 0;
      vis(lv.jack, st.jv > 0.01);
      lv.jack.style.opacity = st.jv;
      lv.jp.setAttribute('transform', `translate(0 ${-jh})`);
      lv.ja1.setAttribute('y2', 296 - jh);
      lv.ja2.setAttribute('y1', 296 - jh);
      // pop-in props
      const pop = (el, v) => { vis(el, v > 0.01); if (v > 0.01) { el.style.opacity = clamp(v * 1.6); } };
      pop(lv.shelf, st.shelfV);
      const pe = lv.items[0].els;
      pe.floor.style.opacity = clamp(st.pv * 1.6);
      pe.shelf.style.opacity = clamp(st.shelfV * 1.6);
      vis(lv.rack, st.rackB > 0.01);
      lv.rack.style.opacity = st.rackB;
      lv.rack.style.clipPath = `inset(${(1 - E.o3(st.rackB)) * 100}% 0 0 0)`;
      lv.items[1].els.floor.style.opacity = clamp(st.dv * 1.6);
      // cones (alternate front/back of the forklift so it reads as weaving)
      const cv = st.cones || 0;
      rigCones.style.visibility = active && cv > 0.01 ? 'visible' : 'hidden';
      lv.cones.forEach((c, i) => {
        const k = E.back(clamp(cv * 1.3 - i * 0.05));
        c.style.transform = `translate3d(${c._x}px, ${c._y}px, 0) scale(${Math.max(0.001, k)})`;
        c.style.visibility = cv > 0.01 ? 'visible' : 'hidden';
      });
      if (st.weave > 0.001) {
        const fc = st.x + G.w * 0.5;
        const ph = Math.cos((Math.PI * (fc - lv.coneC0)) / lv.coneSp);
        st.weaveY = -ph * 14 * s * st.weave;
        st.weaveS = 1 - ph * 0.035 * st.weave;
      }
      // copy
      const m = lv.marks;
      const idx = t < m.m1 ? 0 : t < m.m2 ? 1 : t < m.m3 ? 2 : t < m.m4 ? 3 : 4;
      if (lv._idx !== idx) {
        lv._idx = idx;
        svcLis.forEach((li, i) => li.classList.toggle('on', i === idx));
        svcImgs.forEach((im, i) => im.classList.toggle('on', i === idx));
        svcDesc.forEach((p, i) => p.classList.toggle('on', i === idx));
      }
    },
  };

  /* ---------- 5 · Brands (dock: load a curtain-side trailer, truck departs) ---------- */
  const marqueeRow = $('.marquee-row'), marquee = $('.marquee');
  LEVELS.brands = {
    build(lv) {
      const w = G.w, s = G.s;
      const Dx = Math.max(G.A + 1.32 * w, G.W * (G.mob ? 0.6 : 0.6));
      const Xo = G.A + 0.26 * w;
      const Xin = Dx - 0.45 * w;
      const CWu = Math.max(560, ((G.W - Dx) / s) * 0.62);
      const Lt = 1500;
      lv.Dx = Dx;
      item(lv, 'out', { floor: { X: Xo, L: 0 } });
      const slotU = (Xin - Dx) / s;
      let ribs = '';
      for (let x = 34; x < CWu; x += 44) ribs += `<rect x="${x}" y="-300" width="3" height="300" fill="#1f2128"/>`;
      let pleats = '';
      for (let x = 0; x < CWu; x += 26) pleats += `<rect x="${x}" y="-300" width="11" height="300" fill="#000" opacity=".045"/>`;
      const livery = (x0, x1) => `
        <rect x="${x0}" y="-300" width="${x1 - x0}" height="300" fill="#f2f1ec"/>
        <path d="M${x0} -96 H${x1} V-58 H${x0} Z" fill="#d3131d"/><path d="M${x0} -52 H${x1} V-44 H${x0} Z" fill="#141414"/>
        <text x="${x0 + 40}" y="-140" class="stencil-t" font-size="120" fill="#d3131d" letter-spacing="8">BELL</text>
        <text x="${x0 + 44}" y="-114" class="mono-t" font-size="17" fill="#141414">FORKLIFT, INC. · SALES · SERVICE · PARTS · RENTALS · TRAINING</text>
        <text x="${x0 + 44}" y="-20" class="mono-t" font-size="22" fill="#141414">1-888-404-2575</text>`;
      lv.trailer = worldSVG(lv.props, `
        <defs><clipPath id="trClip"><rect class="tc" x="${CWu}" y="-306" width="0" height="312"/></clipPath></defs>
        <rect x="0" y="-300" width="${CWu}" height="300" fill="#111216"/>${ribs}
        <rect x="0" y="-300" width="${CWu}" height="40" fill="#000" opacity=".35"/>
        <g transform="translate(${CWu * 0.7 - 312} -290)">${ART.cartons('OUT-2')}</g>
        <g transform="translate(${CWu * 0.7 - 312 + 96} -290)">${ART.cartons('OUT-3', '#ffe7a6')}</g>
        <g transform="translate(${CWu * 0.7 - 312} -374)">${ART.cartons('OUT-4')}</g>
        <g class="tr-slot" transform="translate(${slotU} -290)" style="display:none">${ART.CARGO.out.art()}</g>
        ${livery(CWu, Lt)}
        <g clip-path="url(#trClip)">${livery(0, CWu)}${pleats}</g>
        <rect x="-8" y="-314" width="${Lt + 8}" height="15" rx="3" fill="#d4d3cd"/>
        <rect x="-12" y="-314" width="16" height="328" fill="#30333a"/>
        <rect x="-10" y="-280" width="5" height="260" fill="url(#pHaz)" opacity=".9"/>
        <rect x="-8" y="0" width="${Lt + 8}" height="13" fill="#26272c"/>
        <rect x="0" y="13" width="${Lt}" height="9" fill="#18191c"/>
        <rect x="16" y="22" width="56" height="10" fill="#d3131d"/><rect x="38" y="22" width="12" height="38" fill="#222"/>
        ${[150, 238].map((x) => `<g class="tw"><circle cx="${x}" cy="56" r="34" fill="#101113"/><circle cx="${x}" cy="56" r="18" fill="url(#gRim)"/><circle cx="${x}" cy="56" r="6" fill="#d3131d"/><rect x="${x - 2}" y="25" width="4" height="10" fill="#3a3c41"/></g>`).join('')}
        <rect x="102" y="22" width="12" height="44" fill="#141414"/>
        <rect x="1290" y="22" width="12" height="58" fill="#3a3c41"/>
        <path d="M${Lt + 18} 30 V-210 Q${Lt + 18} -246 ${Lt + 60} -250 H${Lt + 210} Q${Lt + 268} -246 ${Lt + 290} -170 L${Lt + 322} -110 V30 Z" fill="url(#gBody)"/>
        <path d="M${Lt + 205} -232 H${Lt + 250} L${Lt + 282} -160 H${Lt + 205} Z" fill="#20252c"/>
        <text x="${Lt + 64}" y="-90" class="stencil-t" font-size="42" fill="#fff">BELL</text>
        <rect x="${Lt + 18}" y="20" width="304" height="12" fill="#141414"/>
        ${[Lt + 90, Lt + 250].map((x) => `<g class="tw"><circle cx="${x}" cy="56" r="34" fill="#101113"/><circle cx="${x}" cy="56" r="18" fill="url(#gRim)"/><circle cx="${x}" cy="56" r="6" fill="#d3131d"/><rect x="${x - 2}" y="25" width="4" height="10" fill="#3a3c41"/></g>`).join('')}
      `, -14, -320, Lt + 360, 420);
      lv.trailer.style.zIndex = 5;
      lv.trailer._b.y0 = -320;
      lv.trailer.style.width = (Lt + 360) * s + 'px';
      lv.trailer.style.height = 420 * s + 'px';
      lv.trX = Dx - 14 * s;
      lv.trY = G.F - 320 * s;
      lv.tc = $('.tc', lv.trailer);
      lv.slot = $('.tr-slot', lv.trailer);
      lv.tws = $$('.tw', lv.trailer);
      lv.CWu = CWu;
      lv.depart = G.W - Dx + 60 * s;
      lv.departFull = lv.depart + (Lt + 360) * s;
      // dock bumper on the slab face
      lv.props.insertAdjacentHTML('beforeend', `<div class="dock-bumper" style="position:absolute;left:${Dx - 16 * s}px;top:${G.F + 4}px;width:${16 * s}px;height:${Math.min(G.gap - 10, 60 * s)}px;background:#0d0d0f;border-radius:2px;z-index:6"></div>`);
      // marquee sits between the heading and the trailer roof
      const sr = lv.stage.getBoundingClientRect(), hr = $('.brands-head', lv.stage).getBoundingClientRect();
      const mTop = hr.bottom - sr.top + (G.mob ? 18 : 26);
      marquee.style.top = Math.min(mTop, G.F - 330 * s - marquee.offsetHeight - 10) + 'px';

      const S = S0({ curtain: 0, truck: 0, _out: 'floor' });
      M.out(S);
      M.pick(S, Xo, 'out');
      S.to(D(S, Xin), { x: Xin }).to(0.7, { tilt: 0 }).to(0.7, { L: 0 }).set({ _out: 'trailer' }).to(D(S, Dx - 1.25 * w), { x: Dx - 1.25 * w });
      S.to(2.2, { curtain: 1 }).set({ tag: 'ship' }).to(0.8, { tagV: 1 }).to(4.2, { truck: 1, tagV: 0 }, 'i3').mark('gone').hold(1);
      M.home(S);
      return S.done();
    },
    apply(lv, st, t, active) {
      applyItems(lv, st);
      const s = G.s;
      lv.slot.style.display = st._out === 'trailer' ? '' : 'none';
      const c = clamp(st.curtain);
      lv.tc.setAttribute('x', lv.CWu * (1 - c));
      lv.tc.setAttribute('width', lv.CWu * c);
      const tx = st.truck * lv.departFull;
      lv.trailer.style.transform = `translate3d(${lv.trX + tx}px, ${lv.trY}px, 0)`;
      const rot = (tx / (34 * s)) * 57.2958;
      lv.tws.forEach((g) => { const cxv = +g.firstElementChild.getAttribute('cx'); g.setAttribute('transform', `rotate(${rot % 360} ${cxv} 56)`); });
      if (active && st.truck > 0.001 && st.truck < 0.999) {
        const prev = lv._tx == null ? tx : lv._tx;
        st.hudV = (tx - prev) * 60;
      }
      lv._tx = tx;
    },
  };

  /* ---------- 6 · Value (award lift) ---------- */
  LEVELS.value = {
    build(lv) {
      const Xp = G.A + (G.mob ? 0.4 : 0.26) * (G.B - G.A);
      item(lv, 'trophy', { floor: { X: Xp, L: 0 } });
      lv.rays = $$('.rays', lv.props).concat($$('.rays', FL.cargo.trophy));
      const S = S0({ _trophy: 'floor' });
      M.out(S);
      M.pick(S, Xp, 'trophy');
      S.to(3, { L: G.mob ? 170 : 210, tilt: 0 }).to(1.2, { glow: 1, conf: 1 }).hold(5.5).to(1, { glow: 0, conf: 0 }).to(2.4, { L: 10 }).to(0.8, { L: 0 }).set({ _trophy: 'floor' }).to(1.1, { x: Xp - 0.26 * G.w });
      M.home(S);
      return S.done();
    },
    apply(lv, st) {
      applyItems(lv, st);
      for (const r of lv.rays) r.setAttribute('opacity', st.glow.toFixed(3));
    },
  };

  /* ---------- B · End of shift (park + charge) ---------- */
  LEVELS.shift = {
    build(lv) {
      const Xc = G.A + (G.mob ? 0.25 : 0.3) * (G.B - G.A);
      lv.charger = placeAt(worldSVG(lv.props, `
        <rect x="-78" y="104" width="76" height="104" rx="8" fill="#1d1f24" stroke="#33363d"/>
        <rect x="-70" y="114" width="60" height="36" rx="4" fill="#06120a"/>
        ${[0, 1, 2, 3, 4].map((i) => `<rect class="cb" x="${-64 + i * 10.5}" y="122" width="8" height="18" rx="1" fill="#1e3b26"/>`).join('')}
        <text class="cpct mono-t" x="-40" y="164" text-anchor="middle" font-size="10" fill="#3bff7a">0%</text>
        <rect x="-70" y="176" width="60" height="5" rx="2" fill="#d3131d"/>
        <text x="-40" y="198" text-anchor="middle" class="mono-t" font-size="6.5" fill="#8b8d93">BELL CHARGE</text>
        <path class="ccable" d="M-40 208 C -40 262, 6 268, 24 232" stroke="#111" stroke-width="5" fill="none" stroke-linecap="round"/>
        <rect class="cplug" x="18" y="224" width="12" height="10" rx="2" fill="#ffc21a"/>`, -90, 90, 130, 210), Xc);
      lv.cbars = $$('.cb', lv.charger);
      lv.cpct = $('.cpct', lv.charger);
      lv.ccable = $('.ccable', lv.charger);
      lv.cplug = $('.cplug', lv.charger);
      lv.clen = lv.ccable.getTotalLength ? lv.ccable.getTotalLength() : 120;
      lv.ccable.style.strokeDasharray = lv.clen;
      const S = S0({ plug: 0, charge: 0 });
      M.out(S);
      S.to(D(S, Xc, 1.2), { x: Xc }).to(1.4, { plug: 1 }).to(3.2, { charge: 1 }, 'lin').to(1.2, { lights: 0 }).hold(1.2);
      return S.done();
    },
    apply(lv, st) {
      lv.ccable.style.strokeDashoffset = lv.clen * (1 - st.plug);
      lv.cplug.style.opacity = st.plug > 0.95 ? 1 : 0;
      const pct = Math.round(st.charge * 100);
      if (lv._p !== pct) {
        lv._p = pct;
        lv.cpct.textContent = pct + '%';
        lv.cbars.forEach((b, i) => b.setAttribute('fill', pct >= (i + 1) * 20 ? '#3bff7a' : '#1e3b26'));
      }
    },
  };

  const LV = $$('.level').map((el, i) => {
    el.style.setProperty('--len', el.dataset.len);
    const stage = $('.stage', el);
    return { el, i, stage, props: $(':scope > .props', stage), code: el.dataset.code, def: LEVELS[el.id], items: [], keys: [], marks: {} };
  });

  /* ======================================================================
     Layout
     ====================================================================== */
  function layout() {
    const W = root.clientWidth;
    const H = LV[0].stage.offsetHeight || innerHeight;
    const w = Math.round(clamp(Math.min(W * (W < 720 ? 0.27 : 0.17), H * 0.35), 96, 290));
    const s = w / 400;
    const gap = Math.round(clamp(H * 0.085, 44, 84));
    const F = H - gap;
    const cx0 = W < 700 ? 6 : 18;
    const cw = 440 * s;
    Object.assign(G, { W, H, w, s, gap, F, cx0, cw, mob: W < 720, rigTop: F - 290 * s, elevX: cx0 + 6 * s, A: cx0 + cw - 18 * s, B: W - (W < 700 ? 8 : 34) - 406 * s });
    if (G.B < G.A + w) G.B = G.A + w;
    G.zone = Math.round(430 * s);
    root.style.setProperty('--gap', gap + 'px');
    root.style.setProperty('--zone', G.zone + 'px');
    flWrap.style.width = w + 'px';
    flWrap.style.height = 300 * s + 'px';
    for (const c of [cageBackEl, cageFrontEl]) { c.style.width = cw + 'px'; c.style.height = 310 * s + 'px'; }
    void document.body.offsetHeight;
    for (const l of LV) {
      const r = l.el.getBoundingClientRect();
      l.top = r.top + scrollY;
      l.len = Math.max(1, l.el.offsetHeight - H);
    }
    for (const l of LV) {
      l.props.innerHTML = '';
      l.items = [];
      const out = l.def.build(l);
      l.keys = out.keys;
      l.marks = out.marks || {};
    }
    lastOdo = null;
  }

  /* ======================================================================
     Frame loop
     ====================================================================== */
  let lastNow = performance.now(), lastY = 0, scrollV = 0, mqX = 0;
  function frame(now) {
    const dt = Math.min(0.1, Math.max(0.001, (now - lastNow) / 1000));
    lastNow = now;
    const y = window.scrollY;
    scrollV = lerp(scrollV, (y - lastY) / dt, 0.1);
    lastY = y;
    let st = null, Y = G.F, active = null, riding = false, label = null;
    for (const l of LV) l.tr = (y - l.top) / l.len;
    for (const l of LV) if (l.tr >= 0 && l.tr <= 1) { active = l; break; }
    if (active) {
      st = sample(active.keys, active.tr);
      label = active;
    } else {
      let prev = null, next = null;
      for (const l of LV) { if (l.tr > 1) prev = l; else if (l.tr < 0 && !next) next = l; }
      if (!prev) { active = LV[0]; st = sample(LV[0].keys, 0); label = LV[0]; }
      else {
        st = sample(prev.keys, 1);
        riding = true;
        label = next || prev;
        if (next && prev.el.nextElementSibling !== next.el) {
          const d1 = y - (prev.top + prev.len), d2 = next.top - y;
          Y = d1 < d2 ? G.F - d1 : G.F + d2;
          if (d1 < d2) label = prev;
        }
      }
    }
    for (const l of LV) {
      if (!(y + G.H > l.top - 4 && y < l.top + l.len + G.H + 4)) continue;
      const t = clamp(l.tr);
      l.def.apply(l, l === active ? st : sample(l.keys, t), t, l === active);
    }
    if (active === LV[0]) { st.x += INTRO.dx; st.L += INTRO.L; }
    if (!active || active.el.id !== 'services') rigCones.style.visibility = 'hidden';
    renderRig(st, Y, dt, label, riding);

    // chrome: panel + hud theme
    const pi = label ? label.i : 0;
    panelBtns.forEach((b, i) => { const on = i === pi; if (b._on !== on) { b._on = on; b.classList.toggle('on', on); } });
    const bl = LV.find((l) => y + G.H - G.gap / 2 >= l.top && y + G.H - G.gap / 2 < l.top + l.len + G.H);
    const light = !!(bl && bl.el.classList.contains('light'));
    hud.el.classList.toggle('on-light', light);
    hud.el.classList.toggle('hide', !bl || bl.el.id === 'shift');

    // marquee
    if (marqueeRow._half) {
      mqX -= (60 + Math.min(900, Math.abs(scrollV) * 0.25)) * dt;
      if (-mqX > marqueeRow._half) mqX += marqueeRow._half;
      marqueeRow.style.transform = `translate3d(${mqX}px, 0, 0)`;
    }
  }

  /* ======================================================================
     UI
     ====================================================================== */
  function fmt(v, el) {
    const dec = +(el.dataset.dec || 0);
    let s = dec ? v.toFixed(dec) : Math.round(v).toString();
    if (el.dataset.fmt === 'comma') s = Math.round(v).toLocaleString();
    return (el.dataset.pre || '') + s + (el.dataset.post || '');
  }
  function writeCount(el, v) { if (!el) return; const s = fmt(v, el); if (el._s !== s) { el._s = s; el.textContent = s; } }
  function countUp(el) {
    if (!el) return;
    const to = +el.dataset.to, o = { v: el.dataset.plain != null ? to * 0.97 : 0 };
    window.gsap.to(o, { v: to, duration: 1.4, ease: 'power3.out', onUpdate: () => writeCount(el, o.v) });
  }

  function splitText() {
    $$('.split').forEach((el) => {
      let i = 0;
      const words = el.textContent.trim().split(/\s+/);
      el.innerHTML = words.map((wd) => `<span class="w"><span class="c" style="--i:${i++}">${wd}</span></span>`).join(' ');
    });
  }

  function reveals() {
    const io = new IntersectionObserver((ents) => {
      for (const e of ents) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { threshold: 0.18 });
    $$('.stage, .contact').forEach((el) => { if (el !== LV[0].stage) io.observe(el); });
    $$('.contact .reveal').forEach((el) => io.observe(el));
  }

  function jumpTo(target, sub) {
    let y = 0;
    if (target === 'contact') y = $('#contact').getBoundingClientRect().top + scrollY;
    else {
      const l = LV[+target];
      if (!l) return;
      y = l.top + l.len * 0.04;
      if (sub != null) {
        const mk = l.el.id === 'services' ? ['m1', 'm1', 'm2', 'm3', 'm4'][+sub] : l.el.id === 'equipment' ? ['b0', 'b0', 'b1'][+sub] : null;
        if (mk && +sub > 0) y = l.top + l.len * (l.marks[mk] + 0.01);
      }
    }
    closeMenu();
    const d = Math.abs(y - scrollY);
    if (lenis) lenis.scrollTo(y, { duration: clamp(d / 4000, 0.9, 2.6), easing: E.io3 });
    else window.scrollTo(0, y);
  }

  const menuEl = $('#menu'), burger = $('#burger');
  function closeMenu() { document.body.classList.remove('menu-open'); burger.setAttribute('aria-expanded', 'false'); menuEl.setAttribute('aria-hidden', 'true'); }
  burger.addEventListener('click', () => {
    const open = !document.body.classList.contains('menu-open');
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    menuEl.setAttribute('aria-hidden', String(!open));
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-jump]');
    if (!a) return;
    e.preventDefault();
    jumpTo(a.dataset.jump, a.dataset.sub);
  });

  // magnetic buttons + cursor
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !RM) {
    $$('.magnetic').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.22}px, ${(e.clientY - r.top - r.height / 2) * 0.32}px)`;
      });
      el.addEventListener('mouseleave', () => (el.style.transform = ''));
    });
    const cur = $('#cursor');
    let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
    addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; cur.classList.toggle('hover', !!e.target.closest('a, button, label, input, textarea')); }, { passive: true });
    (function loop() { cx = lerp(cx, tx, 0.2); cy = lerp(cy, ty, 0.2); cur.style.transform = `translate3d(${cx}px, ${cy}px, 0)`; requestAnimationFrame(loop); })();
  }

  // video modal
  const modal = $('#videoModal'), mVid = $('#modalVideo');
  function openModal() {
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('open'));
    if (lenis) lenis.stop();
    mVid.currentTime = 0;
    mVid.play().catch(() => {});
  }
  function closeModal() {
    modal.classList.remove('open');
    mVid.pause();
    if (lenis) lenis.start();
    setTimeout(() => (modal.hidden = true), 400);
  }
  $('#watchBtn').addEventListener('click', openModal);
  $('#modalClose').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!modal.hidden) closeModal(); closeMenu(); } });

  // form (concept demo — validates, does not send)
  const form = $('#form'), ok = $('#formOk');
  $('#woNum').textContent = 'WO-' + String(Math.floor(10000 + Math.random() * 89999));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let bad = false;
    $$('[required]', form).forEach((f) => {
      const b = !f.value.trim() || (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(f.value));
      f.classList.toggle('bad', b);
      bad = bad || b;
    });
    if (bad) { ok.style.color = '#ff6b6b'; ok.textContent = 'Please fill in the highlighted fields.'; return; }
    ok.style.color = '';
    const name = form.name.value.trim().split(' ')[0];
    ok.textContent = `✓ Thanks ${name} — work order logged. A Bell specialist will reach out shortly. (Concept demo: not sent)`;
    form.reset();
  });

  /* ======================================================================
     Boot
     ====================================================================== */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  splitText();
  // duplicate marquee content for a seamless loop
  marqueeRow.innerHTML += marqueeRow.innerHTML;
  const measureMarquee = () => { marqueeRow._half = marqueeRow.scrollWidth / 2 + 7; };

  layout();
  measureMarquee();
  reveals();

  if (!RM && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: true });
    lenis.stop();
  }
  function raf(now) {
    if (lenis) lenis.raf(now);
    frame(now);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  let rT;
  addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(() => { layout(); measureMarquee(); }, 160);
  });

  // preloader → roll-up door → forklift drives in
  const body = document.body;
  body.classList.add('loading');
  window.scrollTo(0, 0);
  const counter = $('#loaderCount'), bar = $('#loaderBar'), loader = $('#loader');
  const ready = Promise.race([
    Promise.all([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      new Promise((r) => { const v = $('#heroVideo'); if (v.readyState >= 2) r(); else { v.addEventListener('loadeddata', r, { once: true }); v.addEventListener('error', r, { once: true }); } }),
    ]),
    new Promise((r) => setTimeout(r, 3500)),
  ]);
  const prog = { p: 0 };
  const gsap = window.gsap;
  const intro = () => {
    layout();
    measureMarquee();
    INTRO.dx = -(LV[0].Xh + G.w * 1.4);
    gsap.to(loader.querySelector('.loader-inner'), { opacity: 0, y: -20, duration: 0.4, ease: 'power2.in' });
    gsap.to(loader.querySelector('.loader-door'), { yPercent: -100, duration: 1.15, ease: 'power3.inOut', delay: 0.25, onComplete: () => loader.remove() });
    setTimeout(() => {
      body.classList.remove('loading');
      LV[0].stage.classList.add('in');
      if (lenis) lenis.start();
    }, 700);
    gsap.to(INTRO, { dx: 0, duration: 2.6, delay: 0.55, ease: 'power3.out' });
    gsap.to(INTRO, { L: 34, duration: 0.45, delay: 2.85, ease: 'power2.out', yoyo: true, repeat: 3 });
    const hash = location.hash && location.hash.slice(1);
    if (hash) {
      const idx = LV.findIndex((l) => l.el.id === hash);
      setTimeout(() => jumpTo(hash === 'contact' ? 'contact' : idx), 1200);
    }
  };
  if (RM) {
    loader.remove();
    body.classList.remove('loading');
    LV[0].stage.classList.add('in');
    INTRO.dx = 0;
  } else {
    gsap.to(prog, {
      p: 0.85, duration: 1.2, ease: 'power1.inOut',
      onUpdate: () => { counter.textContent = String(Math.round(prog.p * 100)).padStart(3, '0'); bar.style.width = prog.p * 100 + '%'; },
    });
    ready.then(() => {
      gsap.to(prog, {
        p: 1, duration: 0.5, delay: 0.9, ease: 'power2.out',
        onUpdate: () => { counter.textContent = String(Math.round(prog.p * 100)).padStart(3, '0'); bar.style.width = prog.p * 100 + '%'; },
        onComplete: intro,
      });
    });
  }
})();
