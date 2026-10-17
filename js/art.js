/* Bell Forklift — vector art.
   Everything is drawn in "forklift units": the forklift viewBox is 0 0 400 300,
   the ground line is y = 290, and cargo rides on the forks between x = 312 and 404.
   Props drawn in the same units line up with the forklift by construction. */
(function () {
  const RED = '#d3131d';
  const r1 = (n) => +n.toFixed(2);

  function wheel(cls, cx, cy, r) {
    const holes = [0, 72, 144, 216, 288].map((a) => {
      const t = (a * Math.PI) / 180;
      return `<circle cx="${r1(cx + Math.cos(t) * r * 0.37)}" cy="${r1(cy + Math.sin(t) * r * 0.37)}" r="${r1(r * 0.085)}" fill="#2a2c31"/>`;
    }).join('');
    return `<g class="${cls}"><g class="spin">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#101113"/>
      <circle cx="${cx}" cy="${cy}" r="${r - 2.6}" fill="none" stroke="#2b2d32" stroke-width="5.2" stroke-dasharray="3.4 3.4"/>
      <circle cx="${cx}" cy="${cy}" r="${r1(r * 0.6)}" fill="url(#gRim)"/>
      <circle cx="${cx}" cy="${cy}" r="${r1(r * 0.6)}" fill="none" stroke="#0d0e10" stroke-width="1.3"/>
      ${holes}
      <circle cx="${cx}" cy="${cy}" r="${r1(r * 0.21)}" fill="${RED}"/>
      <circle cx="${cx}" cy="${cy}" r="${r1(r * 0.08)}" fill="#f2f2f2"/>
    </g><circle class="gloss" cx="${cx}" cy="${cy}" r="${r - 1}" fill="none" stroke="#ffffff" stroke-opacity=".0" stroke-width="2"/></g>`;
  }

  /* ---------- cargo (all on a pallet whose bottom sits at y=290, x 312..404) ---------- */
  function pallet() {
    return `<g class="pallet">
      <rect x="312" y="273.5" width="92" height="5" rx=".8" fill="url(#gWood)" stroke="#7a5228" stroke-width=".6"/>
      <rect x="313" y="278.5" width="9" height="8.6" fill="#a1703d"/>
      <rect x="353.5" y="278.5" width="9" height="8.6" fill="#a1703d"/>
      <rect x="394" y="278.5" width="9" height="8.6" fill="#a1703d"/>
      <rect x="312" y="287" width="92" height="3" fill="#b07c45"/>
    </g>`;
  }

  function crate(label, sub, o = {}) {
    const h = o.h || 48, top = 274 - h, col = o.col || 'url(#gWood)', dk = o.dark || '#7d5329', ink = o.ink || '#2a190a';
    let planks = '';
    for (let y = top + h / 4; y < 273; y += h / 4) planks += `<rect x="314" y="${r1(y)}" width="88" height="1.1" fill="${dk}" opacity=".35"/>`;
    return pallet() + `<g class="crate">
      <rect x="314" y="${top}" width="88" height="${h}" fill="${col}"/>
      ${planks}
      <path d="M318 ${top + 4} L398 ${273 - 3}" stroke="${dk}" stroke-width="3" opacity=".28"/>
      <rect x="314" y="${top}" width="88" height="${h}" fill="none" stroke="${dk}" stroke-width="2.6"/>
      <rect x="314" y="${top}" width="7" height="${h}" fill="${dk}" opacity=".45"/>
      <rect x="395" y="${top}" width="7" height="${h}" fill="${dk}" opacity=".45"/>
      <text x="358" y="${r1(top + h * 0.56)}" text-anchor="middle" class="stencil-t" font-size="${o.fs || 19}" fill="${ink}">${label}</text>
      <text x="358" y="${r1(top + h * 0.56 + 11)}" text-anchor="middle" class="mono-t" font-size="6.4" fill="${ink}" opacity=".75">${sub}</text>
    </g>`;
  }

  function promoCrate() {
    const h = 70, top = 274 - h;
    return pallet() + `<g class="promo">
      <g class="rays" opacity="0">
        ${Array.from({ length: 11 }, (_, i) => {
          const a = -170 + i * 16;
          return `<path d="M358 ${top} L${r1(358 + Math.cos(a * Math.PI / 180) * 230)} ${r1(top + Math.sin(a * Math.PI / 180) * 230)} L${r1(358 + Math.cos((a + 6) * Math.PI / 180) * 230)} ${r1(top + Math.sin((a + 6) * Math.PI / 180) * 230)} Z" fill="#ffd257" opacity=".16"/>`;
        }).join('')}
        <ellipse cx="358" cy="${top}" rx="80" ry="44" fill="url(#gGlow)"/>
      </g>
      <rect x="314" y="${top}" width="88" height="${h}" fill="url(#gBody)"/>
      <rect x="314" y="${top}" width="88" height="${h}" fill="none" stroke="#6d0910" stroke-width="2.6"/>
      <rect x="314" y="${top + 10}" width="88" height="5" fill="#ffc21a"/>
      <rect x="314" y="${top + h - 15}" width="88" height="5" fill="#ffc21a"/>
      <text x="358" y="${top + 34}" text-anchor="middle" class="stencil-t" font-size="13" fill="#fff">YOUR</text>
      <text x="358" y="${top + 48}" text-anchor="middle" class="stencil-t" font-size="13" fill="#fff">CHOICE</text>
      <g class="lid"><rect x="310" y="${top - 7}" width="96" height="8" rx="1.6" fill="#7d0a11"/><rect x="310" y="${top - 7}" width="96" height="2.4" rx="1" fill="#ff5059"/></g>
    </g>`;
  }

  function cartons(label, tint = '#ffffff') {
    const box = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#gCard)" stroke="#8c6435" stroke-width="1"/><rect x="${x + w / 2 - 3}" y="${y}" width="6" height="${h}" fill="#c9a26a" opacity=".7"/>`;
    return pallet() + `<g class="cartons">
      ${box(314, 240, 43.5, 33.5)}${box(358.5, 240, 43.5, 33.5)}${box(314, 206, 43.5, 33.5)}${box(358.5, 206, 43.5, 33.5)}
      <rect x="313" y="205" width="90" height="69" fill="#fff" opacity=".12"/>
      <path d="M318 210 L330 270" stroke="#fff" stroke-width="5" opacity=".14"/>
      <rect x="322" y="246" width="30" height="18" rx="1.5" fill="${tint}"/>
      <text x="337" y="258" text-anchor="middle" class="stencil-t" font-size="8" fill="#141414">${label}</text>
    </g>`;
  }

  function partsBox() {
    return pallet() + `<g class="parts">
      <rect x="318" y="222" width="80" height="52" fill="#fbfbf9" stroke="#bbb" stroke-width="1"/>
      <rect x="318" y="222" width="80" height="11" fill="${RED}"/>
      <text x="358" y="230.5" text-anchor="middle" class="mono-t" font-size="6.2" fill="#fff">GENUINE</text>
      <text x="358" y="252" text-anchor="middle" class="stencil-t" font-size="13" fill="#141414">PARTS</text>
      <text x="358" y="263" text-anchor="middle" class="mono-t" font-size="5.6" fill="#555">FACTORY CERTIFIED</text>
      <path d="M380 238 l6 -6 l6 6 M386 232 v12" stroke="#141414" stroke-width="1.6" fill="none"/>
    </g>`;
  }

  function drums() {
    const d = (x) => `<g><rect x="${x}" y="216" width="41" height="58" rx="4" fill="url(#gDrum)"/>
      <rect x="${x}" y="233" width="41" height="2.6" fill="#0b2554"/><rect x="${x}" y="254" width="41" height="2.6" fill="#0b2554"/>
      <rect x="${x - 1}" y="214" width="43" height="5" rx="2" fill="#174aa2"/></g>`;
    return pallet() + `<g class="drums">${d(315)}${d(360)}
      <rect x="326" y="238" width="19" height="12" fill="#fff" opacity=".9"/><text x="335.5" y="246.5" text-anchor="middle" class="mono-t" font-size="5" fill="#111">WH-05</text></g>`;
  }

  function trophy() {
    return pallet() + `<g class="trophy">
      <g class="rays" opacity="0">
        ${Array.from({ length: 12 }, (_, i) => {
          const a = i * 30;
          return `<path d="M358 192 L${r1(358 + Math.cos(a * Math.PI / 180) * 150)} ${r1(192 + Math.sin(a * Math.PI / 180) * 150)} L${r1(358 + Math.cos((a + 10) * Math.PI / 180) * 150)} ${r1(192 + Math.sin((a + 10) * Math.PI / 180) * 150)} Z" fill="#ffd257" opacity=".2"/>`;
        }).join('')}
        <circle cx="358" cy="192" r="60" fill="url(#gGlow)" opacity=".8"/>
      </g>
      <rect x="320" y="228" width="76" height="46" rx="2" fill="#141517"/>
      <rect x="320" y="228" width="76" height="4" fill="url(#gGold)"/>
      <rect x="320" y="270" width="76" height="4" fill="url(#gGold)"/>
      <text x="358" y="254" text-anchor="middle" class="mono-t" font-size="6.2" fill="#d6a23a">AWARD</text>
      <circle cx="358" cy="192" r="34" fill="#151618" stroke="url(#gGold)" stroke-width="3"/>
      <image href="assets/logos/asec.webp" x="330" y="171" width="56" height="42" preserveAspectRatio="xMidYMid meet"/>
      <rect x="352" y="224" width="12" height="6" fill="url(#gGold)"/>
    </g>`;
  }

  function outbound() {
    const box = (x, y) => `<rect x="${x}" y="${y}" width="43.5" height="29" fill="url(#gCard)" stroke="#8c6435" stroke-width="1"/>`;
    return pallet() + `<g class="outbound">
      ${box(314, 244.5)}${box(358.5, 244.5)}${box(314, 215)}${box(358.5, 215)}${box(314, 185.5)}${box(358.5, 185.5)}
      <rect x="313" y="184" width="90" height="90" fill="#fff" opacity=".13"/>
      <rect x="313" y="228" width="90" height="5" fill="${RED}"/>
      <rect x="326" y="250" width="40" height="16" fill="#fff"/><text x="346" y="260.5" text-anchor="middle" class="mono-t" font-size="5.6" fill="#111">OUTBOUND</text>
    </g>`;
  }

  const CARGO = {
    promo: { art: promoCrate, lb: 1800 },
    c1: { art: () => crate('1972', 'FOUNDED'), lb: 900 },
    c2: { art: () => crate('50+', 'YEARS FAMILY-OWNED'), lb: 900 },
    c3: { art: () => crate('5', 'MICHIGAN LOCATIONS', { fs: 22 }), lb: 900 },
    e1: { art: () => cartons('NEW'), lb: 1500 },
    e2: { art: () => cartons('USED', '#ffe7a6'), lb: 1400 },
    e3: { art: () => cartons('RENT', '#ffd1d3'), lb: 1450 },
    parts: { art: partsBox, lb: 420 },
    drums: { art: drums, lb: 1650 },
    trophy: { art: trophy, lb: 250 },
    out: { art: outbound, lb: 2200 },
  };

  /* ---------- the forklift ---------- */
  function forklift() {
    const cargo = Object.keys(CARGO).map((k) => `<g class="cg" data-cargo="${k}" style="display:none">${CARGO[k].art()}</g>`).join('');
    return `<svg class="fl" viewBox="0 0 400 300" overflow="visible" aria-hidden="true">
<ellipse class="fl-shadow" cx="212" cy="291" rx="205" ry="10" fill="url(#gShadow)"/>
<ellipse class="fl-spot" cx="575" cy="291.5" rx="54" ry="8" fill="url(#gSpot)" opacity="0"/>
<ellipse class="fl-spot-r" cx="-110" cy="291.5" rx="46" ry="7" fill="url(#gSpot)" opacity="0"/>
<g class="fl-beep" opacity="0">
  <path d="M8 118 q-10 14 0 28" stroke="#ffc21a" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M-4 110 q-16 22 0 44" stroke="#ffc21a" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>
  <path d="M-16 102 q-22 30 0 60" stroke="#ffc21a" stroke-width="3" fill="none" stroke-linecap="round" opacity=".45"/>
</g>
<g class="fl-all">
  <polygon class="fl-beam" points="268,63 268,74 660,291 480,291" fill="url(#gBeam)"/>
  <!-- LPG tank -->
  <rect x="28" y="152" width="96" height="27" rx="13.5" fill="url(#gTank)"/>
  <rect x="47" y="152" width="3.2" height="27" fill="#8a9098"/><rect x="103" y="152" width="3.2" height="27" fill="#8a9098"/>
  <rect x="116" y="145.5" width="8" height="8" rx="1.6" fill="#d6a017"/>
  <!-- counterweight -->
  <path d="M22 258 V212 Q22 179 56 178 H130 V258 Z" fill="url(#gCw)"/>
  <path d="M28 206 Q31 186 57 184 H126" stroke="#7a7e87" stroke-width="2" fill="none" opacity=".55"/>
  <text x="33" y="221" class="decal-t" font-size="17" fill="#fff">BELL</text>
  <rect x="33" y="225" width="44" height="2.4" fill="${RED}"/>
  <!-- frame -->
  <path d="M126 258 V198 H151 L159 188 H258 Q274 188 278 200 L285 258 Z" fill="url(#gBody)"/>
  <rect x="126" y="246" width="159" height="12" fill="#740a10"/>
  <rect x="186" y="238" width="24" height="5" rx="1.5" fill="#202124"/>
  <!-- hood / seat base -->
  <path d="M132 198 Q132 170 160 168 H214 Q228 168 230 182 L232 198 Z" fill="url(#gHood)"/>
  <path d="M140 178 Q146 172 160 172 H212" stroke="#ff7a80" stroke-width="2" fill="none" opacity=".7"/>
  <!-- dash -->
  <path d="M228 198 L234 156 Q236 148 246 148 H257 L263 198 Z" fill="url(#gBody)"/>
  <!-- seat -->
  <path d="M150 168 Q143 140 151 118 Q155 111 164 113 L167 168 Z" fill="#1b1c1f"/>
  <path d="M150 170 H195 Q198 160 190 158 H152 Z" fill="#232428"/>
  <!-- operator -->
  <g class="fl-op">
    <path d="M176 158 L206 156 L214 186" stroke="#253042" stroke-width="11" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="208" y="183" width="17" height="7" rx="2.5" fill="#141414"/>
    <path d="M160 160 Q153 132 164 112 Q170 105 182 105 Q193 107 193 121 L193 160 Z" fill="#c9e43a"/>
    <rect x="157.5" y="133" width="36" height="5" fill="#eef2f4" opacity=".92"/>
    <path d="M185 117 L200 136 L216 124" stroke="#c9e43a" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="217.5" cy="123" r="4.2" fill="#d9a07f"/>
    <rect x="176" y="100" width="7" height="8" fill="#c48a69"/>
    <circle cx="180.5" cy="94" r="10.5" fill="#d9a07f"/>
    <path d="M168 93 Q168 78 181 78 Q194 78 194 93 Z" fill="#ffc21a"/>
    <rect x="165.5" y="91.5" width="32" height="3.6" rx="1.6" fill="#e3a700"/>
  </g>
  <!-- steering -->
  <path d="M241 160 L224 124" stroke="#18191b" stroke-width="5" stroke-linecap="round"/>
  <ellipse cx="222" cy="121" rx="15.5" ry="4" transform="rotate(-28 222 121)" fill="none" stroke="#0f0f10" stroke-width="3.6"/>
  <!-- overhead guard -->
  <path d="M128 183 L136 183 L130 52 L122 52 Z" fill="url(#gSteel)"/>
  <path d="M248 150 L256 150 L262 52 L254 52 Z" fill="url(#gSteel)"/>
  <rect x="114" y="42" width="157" height="11" rx="3" fill="#2c2e33"/>
  <rect x="114" y="42" width="157" height="3" rx="1.5" fill="#666a73"/>
  <!-- beacon -->
  <g class="fl-beacon">
    <circle class="fl-beacon-glow" cx="126" cy="29" r="26" fill="url(#gAmber)"/>
    <rect x="120" y="35" width="12" height="7.5" fill="#1f2023"/>
    <path d="M119 36 Q126 17 133 36 Z" fill="#ffb000"/>
    <path d="M123 33 Q125 24 128 33" stroke="#fff3c4" stroke-width="1.5" fill="none" opacity=".85"/>
  </g>
  <!-- headlamp -->
  <g class="fl-head"><rect x="257" y="61" width="12" height="14" rx="2.6" fill="#26282d"/><circle class="fl-lamp" cx="266" cy="68" r="4.3" fill="#fff6d6"/></g>
  <!-- wheel wells + wheels -->
  <path d="M60 258 A32 32 0 0 1 124 258 Z" fill="#09090a"/>
  <path d="M204 258 A36 36 0 0 1 276 258 Z" fill="#09090a"/>
  ${wheel('fl-wr', 92, 264, 26)}
  ${wheel('fl-wf', 240, 260, 30)}
  <path d="M59 258 A33 33 0 0 1 125 258" stroke="#141518" stroke-width="3.5" fill="none"/>
  <path d="M203 258 A37 37 0 0 1 277 258" stroke="#5c070c" stroke-width="3.5" fill="none"/>
  <!-- mast (tilts around 292,286) -->
  <g class="fl-mast">
    <rect x="277" y="118" width="6" height="168" fill="#aab0b8"/>
    <rect x="283" y="50" width="16" height="238" rx="2" fill="url(#gSteel)"/>
    <rect x="281" y="47" width="20" height="7" rx="2" fill="#1d1f24"/>
    <g class="fl-inner">
      <rect x="287" y="44" width="10" height="230" rx="1.5" fill="#4a4e57"/>
      <rect x="287" y="44" width="2.6" height="230" fill="#7c818a"/>
      <rect x="285" y="40" width="14" height="7" rx="2" fill="#1d1f24"/>
      <circle cx="297" cy="44" r="5" fill="#18191c" stroke="#80858d" stroke-width="1.2"/>
    </g>
    <line class="fl-chain" x1="301" y1="44" x2="303" y2="220" stroke="#0d0d0f" stroke-width="2.4" stroke-dasharray="2.2 1.3"/>
    <rect x="279" y="276" width="22" height="12" rx="3" fill="#1d1f24"/>
    <g class="fl-carriage">
      <rect x="299" y="164" width="7" height="60" fill="#25272c"/>
      <rect x="299" y="164" width="7" height="2.5" fill="#5e626b"/>
      <rect x="296" y="218" width="16" height="64" rx="2" fill="#30333a"/>
      <path d="M306 222 H314 V281 H399 L405.5 284.6 V287 H306 Z" fill="#1b1c20"/>
      <g class="fl-cargo">${cargo}</g>
    </g>
  </g>
</g>
</svg>`;
  }

  /* ---------- freight elevator cage (units: 440 x 310, floor at y=290) ---------- */
  function cageBack() {
    return `<svg viewBox="0 0 440 310" overflow="visible" preserveAspectRatio="none">
      <rect x="10" y="26" width="420" height="264" fill="url(#pMesh)" style="color:rgba(255,255,255,.09)"/>
      <rect x="0" y="16" width="12" height="276" fill="#2b2d32"/><rect x="2" y="16" width="3" height="276" fill="#4d5058"/>
      <rect x="428" y="16" width="12" height="276" fill="#2b2d32"/><rect x="430" y="16" width="3" height="276" fill="#4d5058"/>
      <rect x="0" y="10" width="440" height="18" fill="#1d1e22"/>
      <rect x="0" y="12" width="440" height="7" fill="url(#pHaz)"/>
      <rect x="182" y="-6" width="76" height="17" rx="3" fill="#0b0b0c" stroke="#3a3c42"/>
      <text class="cage-lvl mono-t" x="220" y="7" text-anchor="middle" font-size="11" fill="#ff3b3b">G</text>
      <circle class="cage-led" cx="196" cy="2.5" r="2.5" fill="#3bff7a"/>
      <rect x="-6" y="290" width="452" height="14" fill="#202125"/>
      <rect x="-6" y="290" width="452" height="4" fill="url(#pHaz)"/>
    </svg>`;
  }
  function cageFront() {
    let x = '';
    for (let i = 0; i < 12; i++) x += `<path d="M0 ${30 + i * 22} L20 ${41 + i * 22} L0 ${52 + i * 22}" stroke="#7d8189" stroke-width="2" fill="none"/>`;
    return `<svg viewBox="0 0 440 310" overflow="visible" preserveAspectRatio="none">
      <g class="cage-bar"><rect x="10" y="150" width="420" height="10" rx="2" fill="url(#pHaz)" stroke="#111" stroke-width="1"/></g>
      <g class="cage-gate" transform="translate(414 0)">
        <rect x="0" y="28" width="20" height="262" fill="none"/>
        ${x}
        <rect x="-2" y="26" width="4" height="266" fill="#3a3d43"/><rect x="18" y="26" width="4" height="266" fill="#3a3d43"/>
      </g>
    </svg>`;
  }

  /* ---------- small props ---------- */
  function cone() {
    return `<svg viewBox="0 0 40 60" overflow="visible"><ellipse cx="20" cy="58" rx="22" ry="3" fill="#000" opacity=".25"/>
      <rect x="0" y="52" width="40" height="7" rx="1.5" fill="#d84e00"/>
      <path d="M9 53 L18 3 H22 L31 53 Z" fill="#ff6a00"/>
      <path d="M14.2 24 H25.8 L27 31 H13 Z" fill="#f4f4f4"/><path d="M11.7 38 H28.3 L29.4 44 H10.6 Z" fill="#f4f4f4"/></svg>`;
  }

  window.ART = { RED, CARGO, forklift, cageBack, cageFront, cone, pallet, crate, cartons, drums };
})();
