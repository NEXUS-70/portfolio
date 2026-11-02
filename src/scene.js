import { WebGLRenderer, Scene, OrthographicCamera, PerspectiveCamera, Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3, TextureLoader, SRGBColorSpace, IcosahedronGeometry, Raycaster, Group, TorusGeometry, MeshBasicMaterial, ExtrudeGeometry, Shape, CanvasTexture } from 'three';
import photos from './photos.js';

const clamp = (x, a = 0, b = 1) => Math.min(Math.max(x, a), b);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---- background: halftone dust + black hole (gate / hero) ----
const bgVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const bgFrag = `
precision highp float;
varying vec2 vUv;
uniform float uTime, uP, uBH, uR; uniform vec2 uRes, uMouse; uniform vec3 uCol, uGlow; uniform float uGA;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec2 asp = uRes / min(uRes.x, uRes.y);
  vec2 uv = vUv * asp;
  vec2 c = asp * mix(vec2(.5, .68), vec2(.7, .5), step(1., asp.x));
  vec2 d = uv - c; float r = length(d);
  vec2 uvl = uv + normalize(d + 1e-5) * (uR*uR*.9) / (r + .08) * uBH;   // gravitational pull on the dust
  vec2 g = uvl * mix(46., 26., uP);
  vec2 id = floor(g), f = fract(g) - .5;
  float t = uTime * .15;
  float v = n(id*.08 + vec2(t, -t*.7)) * .65 + n(id*.2 - vec2(t*.5, t)) * .35;
  v += smoothstep(.45, 0., length(uv - uMouse * asp)) * .5;
  v = clamp(v - .25 + uP * .1, 0., 1.);
  float a = smoothstep(v*.46, v*.46 - .08, length(f)) * (.14 + .5*v);
  vec3 col = uCol;
  float ring = exp(-pow((r - uR*1.35) / (uR*.18), 2.)) * (.55 + .45*cos(atan(d.y, d.x) - .6)) * uBH;
  col = mix(col, vec3(.486, .698, .773), clamp(ring, 0., 1.)); a = max(a, ring);
  float disc = smoothstep(uR, uR*.96, r) * uBH;
  col = mix(col, vec3(0.), disc); a = max(a, disc);
  float ga = (1. - smoothstep(0., .85, length((vUv - vec2(.5, .45)) * vec2(1.25, 1.)))) * uGA * .32;   // colour bleed from the nearest photo
  float oa = a + ga * (1. - a);
  gl_FragColor = vec4((col * a + uGlow * ga * (1. - a)) / max(oa, .001), oa);
}`;

// ---- photo planes: dots that resolve into the picture as you approach ----
const phFrag = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex; uniform float uOp, uReveal, uAsp, uHover, uTime, uDither, uSplit;
float bayer(vec2 p){ float a = mod(p.x, 2.), b = mod(floor(p.x / 2.), 2.), c = mod(p.y, 2.), d = mod(floor(p.y / 2.), 2.);
  return (abs(a - c) * 8. + c * 4. + abs(b - d) * 2. + d) / 16.; }
void main(){
  vec2 cells = vec2(70. * uAsp, 70.);
  vec2 g = vUv * cells, f = fract(g) - .5;
  vec3 cc = texture2D(uTex, (floor(g) + .5) / cells).rgb;
  float l = dot(cc, vec3(.299, .587, .114));
  float dm = 1. - smoothstep(.12 + .42 * sqrt(l) - .08, .12 + .42 * sqrt(l), length(f));
  vec2 q = vUv + vec2(sin(vUv.y * 18. + uTime * 3.) * .004 * uHover, 0.);            // hover ripple
  float ab = .012 * uHover * (.4 + length(vUv - .5)) + uSplit * .012;                 // RGB split
  vec3 full = vec3(texture2D(uTex, q + vec2(ab, 0.)).r, texture2D(uTex, q).g, texture2D(uTex, q - vec2(ab, 0.)).b);
  vec3 col = mix(cc * 1.25, full, uReveal); float a = mix(dm, 1., uReveal);
  if (uDither > .5) {                                                                  // 1-bit Bayer dither mode
    float lum = dot(full, vec3(.299, .587, .114));
    col = mix(vec3(.02, .04, .06), vec3(.99, 1., 1.), step(bayer(floor(vUv * vec2(110. * uAsp, 110.))), lum * 1.1)); a = 1.;
  }
  vec2 hb = vec2(uAsp, 1.) * .5 - .035, pq = abs((vUv - .5) * vec2(uAsp, 1.)) - hb;   // SDF rounded corners
  float sd = length(max(pq, 0.)) + min(max(pq.x, pq.y), 0.) - .035;
  float inside = 1. - smoothstep(-.003, .001, sd);
  float hl = smoothstep(-.014, -.003, sd) * (1. - smoothstep(-.003, .001, sd));        // 1px edge light
  float sh = pow(max(0., sin((vUv.x - vUv.y) * 4. + uTime * .3)), 14.) * .12;           // paper sheen
  col += (hl * .3 + sh) * uReveal;
  gl_FragColor = vec4(col, a * uOp * inside);
  #include <colorspace_fragment>
}`;
const phVert = `uniform float uVel; varying vec2 vUv;
void main(){ vUv = uv; vec3 p = position; p.z += sin(uv.x * 3.14159) * uVel;   // planes flex with scroll speed
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`;

const WALL = `
uniform vec2 uRes; uniform sampler2D uText; uniform vec3 uRip[8]; uniform vec3 uPal[20]; uniform float uPhase; uniform vec2 uMouse; uniform float uGl, uFlash;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 palMix(int j){                                                                 // colours sampled from the reference screenshots
  float ph = mod(uPhase, 4.); int i0 = int(floor(ph)); int i1 = i0 == 3 ? 0 : i0 + 1;
  return mix(uPal[i0 * 5 + j], uPal[i1 * 5 + j], smoothstep(.55, 1., fract(ph)));
}
vec2 ripple(vec2 uv, float t){                                                         // cursor water ripples
  vec2 asp = uRes / min(uRes.x, uRes.y), d = vec2(0.);
  for (int i = 0; i < 8; i++) {
    vec3 r = uRip[i];
    float age = t - r.z;
    if (age > 0. && age < 2.5) {
      vec2 v = (uv - r.xy) * asp; float L = length(v);
      d += normalize(v + 1e-5) * sin(L * 30. - age * 9.) * exp(-L * 4.) * exp(-age * 1.6) * .016;
    }
  }
  return uv + d;
}
vec3 wall(vec2 uv, float t){
  uv = ripple(uv, t);
  uv += (uMouse - .5) * .014;                                                          // wall shifts a little with the cursor (depth)
  vec2 asp = uRes / min(uRes.x, uRes.y);
  float band = floor(uv.y * 30.), tk = floor(t * 5.);
  uv.x += step(.96 - .5 * uGl, h21(vec2(band, tk))) * (h21(vec2(band, tk + 7.)) - .5) * (.06 + .12 * uGl);      // glitch slices
  vec2 p = (uv - .5) * asp;
  p += p * dot(p, p) * .25;                                                            // curved wall
  vec2 g = p * 6. + vec2(t * .03, 0.);
  vec2 id = floor(g), f = fract(g);
  float r = h21(id), r2 = fract(r + floor(t * .25) * .31);
  float stripe = smoothstep(-.05, .2, sin((p.x * 1.1 + p.y * 1.9) * 3. + t * .35));   // big diagonal bands
  float k = stripe * (.35 + .65 * h21(id + floor(t * .7))) * (.5 + .5 * step(.25, r));
  vec3 tA = palMix(0), tB = palMix(1), tC = palMix(2);
  vec3 tc = r2 < .4 ? tA : (r2 < .7 ? tB : (r2 < .9 ? tC : vec3(.11, .11, .13)));
  vec3 col = vec3(.004, .005, .008) + tc * k * (.85 + .35 * sin(t + r * 20.));
  vec2 e = abs(f - .5);
  float line = smoothstep(.46, .5, max(e.x, e.y));
  vec2 e2 = abs(fract(g * 4.) - .5);
  float fine = smoothstep(.46, .5, max(e2.x, e2.y));
  col += (line * .22 + fine * .07) * mix(vec3(.7), tA * 2., .35);
  vec2 cm = min(f, 1. - f);
  col += (step(cm.x, .006) * step(cm.y, .08) + step(cm.y, .006) * step(cm.x, .08)) * step(.8, r) * .55;   // + marks
  col *= .88 + .12 * sin(uv.y * uRes.y * 1.3);
  col *= 1. - .55 * dot(p * .6, p * .6);
  float hu = (.8 * uRes.x / 2.) / uRes.y;
  vec2 tuv = vec2((uv.x - .1 + (uMouse.x - .5) * .03) / .8, (uv.y - .5) / hu + .5);
  float inside = step(0., tuv.x) * step(tuv.x, 1.) * step(0., tuv.y) * step(tuv.y, 1.);
  vec2 g2 = (tuv - .5) * .4 + .5 + vec2((uMouse.x - .5) * -.04, 0.);                   // giant faint ghost of the wordmark, deeper in the wall
  float gi = step(0., g2.x) * step(g2.x, 1.) * step(0., g2.y) * step(g2.y, 1.);
  col += texture2D(uText, g2).a * gi * .07 + uFlash;
  return mix(col, vec3(1.), texture2D(uText, tuv).a * inside);                         // white wordmark
}`;

// ---- About: a breathing 3D shape with an orange rim ----
const blVert = `uniform float uTime; varying vec3 vN, vV;
void main(){ vec3 p = position;
  p += normal * sin(p.x*2.6 + uTime*.9) * sin(p.y*2.4 - uTime*.7) * sin(p.z*2.8 + uTime*.5) * .32;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv; }`;
const blFrag = `uniform float uOp; varying vec3 vN, vV;
void main(){ float f = pow(1. - clamp(dot(normalize(vN), normalize(vV)), 0., 1.), 2.2);
  gl_FragColor = vec4(mix(vec3(.02, .05, .08), vec3(.486, .698, .773), f), (.35 + .65*f) * uOp); }`;

const GAP = 7, Z0 = 30;

export function createScene(canvas) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  const lowEnd = innerWidth < 700 || (navigator.deviceMemory || 8) <= 2;   // phones / weak machines get a lighter intro
  renderer.autoClear = false;

  const bg = new Scene(), fg = new Scene();
  const ortho = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const cam = new PerspectiveCamera(55, 1, .1, 80);
  const u = { uTime: { value: 0 }, uP: { value: 0 }, uBH: { value: 1 }, uR: { value: .3 }, uRes: { value: new Vector2(1, 1) }, uMouse: { value: new Vector2(.5, .5) }, uCol: { value: new Vector3(.99, 1., 1.) }, uGlow: { value: new Vector3() }, uGA: { value: 0 } };
  bg.add(new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({ vertexShader: bgVert, fragmentShader: bgFrag, uniforms: u, transparent: true, depthTest: false })));

  // photo planes, golden-angle spiral along -z; load in background, never blocks boot
  const loader = new TextureLoader(), uVelU = { value: 0 }, ray = new Raycaster(), ndc = new Vector2(), uDitherU = { value: 0 }, uSplitU = { value: 0 };
  let bend = 1;
  const planes = photos.map((p, i) => {
    const asp = p.a, w = asp >= 1 ? 4.2 : 3.8 * asp, hgt = asp >= 1 ? 4.2 / asp : 3.8;
    const mat = new ShaderMaterial({ vertexShader: phVert, fragmentShader: phFrag, transparent: true, depthWrite: false, uniforms: { uTex: { value: null }, uOp: { value: 0 }, uReveal: { value: 0 }, uAsp: { value: asp }, uVel: uVelU, uHover: { value: 0 }, uTime: u.uTime, uDither: uDitherU, uSplit: uSplitU } });
    const m = new Mesh(new PlaneGeometry(w, hgt), mat);
    const ang = i * 2.39996, rad = 3.6 + 1.1 * ((i * 7) % 5) / 4;
    m.position.set(Math.cos(ang) * rad, Math.sin(ang) * rad * .7, -i * GAP);
    m.rotation.set(0, -Math.sign(m.position.x) * .22, (i % 3 - 1) * .04);
    m.visible = false; fg.add(m);
    loader.load(`/photos/${p.f}`, (tex) => { tex.colorSpace = SRGBColorSpace; mat.uniforms.uTex.value = tex; m.userData.ok = true; });
    return m;
  });
  const zEnd = -(planes.length - 1) * GAP + 3;

  const glowT = new Vector3();

  const ob = new Scene(), cam2 = new PerspectiveCamera(40, 1, .1, 20); cam2.position.z = 6;
  const bu = { uTime: { value: 0 }, uOp: { value: 0 } };
  const blob = new Mesh(new IcosahedronGeometry(1.5, 24), new ShaderMaterial({ vertexShader: blVert, fragmentShader: blFrag, uniforms: bu, transparent: true }));
  const rig = new Group(), ringMat = new MeshBasicMaterial({ color: 0x7cb2c5, transparent: true, opacity: 0 });
  const ring = new Mesh(new TorusGeometry(2.15, .014, 8, 160), ringMat);
  rig.add(blob, ring); ob.add(rig);

  // intro: glitchy tile wall + white wordmark, with an ice-glass "A" in front that bends and splits the light
  const tcv = document.createElement('canvas'); tcv.width = 2048; tcv.height = 1024;
  const tx = tcv.getContext('2d'), word = 'ASHRAFEE', SY = 2.6; let fs = 340;   // SY stretches the letters tall
  tx.font = `900 ${fs}px "Inter Tight Variable", "Helvetica Neue", Arial, sans-serif`;
  while (tx.measureText(word).width > 1960 && fs > 100) { fs -= 10; tx.font = `900 ${fs}px "Inter Tight Variable", "Helvetica Neue", Arial, sans-serif`; }
  tx.setTransform(1, 0, 0, SY, 0, 0);
  tx.fillStyle = '#fff'; tx.textAlign = 'center'; tx.textBaseline = 'alphabetic'; tx.fillText(word, 1024, 512 / SY + fs * .36);
  const wordTex = new CanvasTexture(tcv);
  const hex = (h) => new Vector3(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255);
  // per palette: tile A, tile B, tile C, glass colour 1, glass colour 2 (all measured from the reference screenshots)
  const uPalU = { value: [
    [0x26378A, 0x1C2658, 0x572956, 0x3D5AE4, 0x572956],   // blue + magenta
    [0x8F4142, 0x723A61, 0x4B2628, 0xC7614E, 0x723A61],   // coral, mauve, violet
    [0x575453, 0x3B393A, 0x201F21, 0xBBC0B9, 0x8A8474],   // chrome, black and white
    [0x305469, 0x173544, 0x2C3C58, 0x305469, 0x2C3C58],   // teal and blue
  ].flat().map(hex) }, uPhU = { value: 0 };
  const uGlU = { value: 1 }, uFlU = { value: 0 };
  const uRipU = { value: Array.from({ length: 8 }, () => new Vector3(0, 0, -1000)) };
  const ws = new Scene(), wu = { uTime: u.uTime, uRes: u.uRes, uText: { value: wordTex }, uRip: uRipU, uPal: uPalU, uPhase: uPhU, uMouse: u.uMouse, uGl: uGlU, uFlash: uFlU, uOp: { value: 1 } };
  ws.add(new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({ uniforms: wu, transparent: true, depthTest: false, vertexShader: bgVert,
    fragmentShader: `precision highp float; varying vec2 vUv; uniform float uTime, uOp;\n` + WALL + `\nvoid main(){ gl_FragColor = vec4(wall(vUv, uTime), uOp); }` })));

  const au = { uTime: u.uTime, uRes: u.uRes, uText: wu.uText, uRip: uRipU, uPal: uPalU, uPhase: uPhU, uMouse: u.uMouse, uGl: uGlU, uFlash: uFlU, uBuf: { value: new Vector2(1, 1) }, uOp: { value: 1 }, uBoost: { value: 0 }, uLow: { value: lowEnd ? 1 : 0 } };
  const aMat = new ShaderMaterial({ uniforms: au, transparent: true,
    vertexShader: `varying vec3 vN, vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime, uOp, uBoost, uLow; uniform vec2 uBuf; varying vec3 vN, vV;\n` + WALL + `
      void main(){
        vec2 suv = gl_FragCoord.xy / uBuf;
        vec2 bc = floor(gl_FragCoord.xy / 5.);
        vec3 n = normalize(normalize(vN) + .22 * vec3(sin(suv.y * 20. + uTime * 1.5), cos(suv.x * 16. - uTime * 1.2), 0.) + .12 * vec3(vec2(h21(bc), h21(bc + 9.)) - .5, 0.));   // rippled, frosted surface
        float f = pow(1. - clamp(dot(n, normalize(vV)), 0., 1.), 2.);
        vec2 off = n.xy * (.032 + .045 * f + uBoost * .02);
        vec2 cell = floor(gl_FragCoord.xy / 7.);
        float nz = step(.84, h21(cell + floor(uTime * 8.))) * f;                       // blocky digital frost
        off += (vec2(h21(cell), h21(cell + 3.)) - .5) * .045 * nz;
        vec3 col = vec3(wall(suv + off * .9, uTime).r, wall(suv + off, uTime).g, wall(suv + off * 1.12, uTime).b);   // RGB dispersion
        float spec = pow(max(dot(n, normalize(vec3(-.5, .6, .65))), 0.), 10.);
        float glint = smoothstep(.43, .5, abs(fract(suv.x * 3. - suv.y * 1.5 + uTime * .05) - .5));
        if (uLow < .5) { vec3 refl = wall(suv + reflect(vec3(0., 0., -1.), n).xy * .22, uTime); col = mix(col, refl, .15 + .4 * f); }
        vec3 film = .5 + .5 * cos(6.2831 * (vec3(0., .33, .67) + f * 1.4 + n.x * .8 + uTime * .05));   // thin-film rainbow
        vec3 g1 = palMix(3), g2 = palMix(4);
        vec3 tintc = mix(g2, g1, clamp(suv.y * .8 + n.y * .3 + .1, 0., 1.));              // colour gradient across the glass
        float mono = 1. - clamp(length(g1 - vec3(dot(g1, vec3(.3333)))) * 4., 0., 1.);
        col = col * .55 + tintc * (1.1 + 1.2 * f) + spec * .6 + pow(f, 3.) * .9 + glint * .14 * (.3 + f);
        col = mix(col, film, clamp(f * 1.5 + glint * .25, 0., .7) * (.25 + .75 * mono));
        col += (h21(gl_FragCoord.xy + uTime) - .5) * .14 * (f + .2);
        col = pow(max(col, 0.), vec3(.88)) * 1.12;
        gl_FragColor = vec4(col, uOp);
      }` });
  const quad = (pts) => { const sh = new Shape(); sh.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach((p) => sh.lineTo(p[0], p[1])); sh.closePath(); return sh; };
  const aRig = new Group();
  [[[-1.55, -1.6], [-.95, -1.6], [.3, 1.6], [-.3, 1.6]], [[1.55, -1.6], [.95, -1.6], [-.3, 1.6], [.3, 1.6]], [[-.9, -.85], [.9, -.85], [.9, -.35], [-.9, -.35]]].forEach((pts) => {
    const mesh = new Mesh(new ExtrudeGeometry(quad(pts), { depth: .5, bevelEnabled: true, bevelThickness: .07, bevelSize: .06, bevelSegments: 3 }), aMat);
    mesh.position.z = -.25; aRig.add(mesh);
  });
  aRig.position.x = 0; aRig.scale.setScalar(.001); ob.add(aRig);
  let introT = 0, exitT = -1, exitDur = .6; const prevM = new Vector2(.5, .5); const lastRip = new Vector2(-1, -1); let ripI = 0, landed = false, burst = 0;
  // where the floating object lives in each section: [x, y (-1..1 of screen), scale, opacity]
  const FLOATS = { boot: [.8, .45, .6, 0], top: [.8, .45, .6, 1], flight: [.88, .6, .28, .55], about: [.54, 0, 1, 1], services: [.62, -.2, .55, 1], work: [.82, .5, .4, 1], contact: [.55, 0, .9, 1], statement: [0, 0, 1.25, 1], story: [.7, -.1, .7, 1], recognition: [.78, .3, .5, 1] };
  let spT = 0, spv = 0, fkey = 'boot'; const fcur = { x: 0, y: 0, s: .01, o: 0 };

  const target = new Vector2(.5, .5), look = new Vector3();
  let fp = 0, mode = 'auto', ent = 0, entering = false, camZ = Z0;
  let prCap = lowEnd ? 1 : 1.5, accDt = 0, nDt = 0;
  const resize = () => {
    renderer.setPixelRatio(Math.min(devicePixelRatio, prCap));
    renderer.setSize(innerWidth, innerHeight, false);
    u.uRes.value.set(innerWidth, innerHeight);
    au.uBuf.value.set(canvas.width, canvas.height);
    cam.aspect = cam2.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); cam2.updateProjectionMatrix();
  };
  resize();
  addEventListener('resize', resize);
  addEventListener('pointermove', (e) => target.set(e.clientX / innerWidth, 1 - e.clientY / innerHeight), { passive: true });

  let raf = 0, last = performance.now();
  const frame = (now) => {
    const dt = Math.min((now - last) / 1000, .1); last = now;
    u.uTime.value += dt;
    if (nDt < 60 && introT > .6) { accDt += dt; if (++nDt === 60) { const avg = accDt / 60; if (avg > .026 && prCap > 1) { prCap = 1; resize(); } else if (avg > .034 && prCap > .75) { prCap = .75; resize(); } } }
    u.uMouse.value.lerp(target, .06);
    if (entering && ent < 1) ent = Math.min(1, ent + dt / 2.4);
    const ea = Math.min(ent / .35, 1), eb = Math.max((ent - .35) / .65, 0);   // ENTER: fall in, then emerge
    u.uR.value = ent < .35 ? .3 + 1.3 * ea * ea : 1.6 - 1.43 * (1 - Math.pow(1 - eb, 3));
    u.uBH.value = 1 - clamp(scrollY / innerHeight);              // hole fades as you leave the hero

    const tz = Z0 + (zEnd - Z0) * fp;
    uVelU.value += (clamp((tz - camZ) * -.06, -1, 1) * .9 * bend - uVelU.value) * .15;
    camZ += (tz - camZ) * .08;
    const gc = photos[Math.round(fp * (photos.length - 1))].g;
    glowT.set(gc[0] / 255, gc[1] / 255, gc[2] / 255); u.uGlow.value.lerp(glowT, .04);
    u.uGA.value = sstep(0, .03, fp) * (1 - sstep(.95, 1, fp));
    cam.position.set(cam.position.x + ((target.x - .5) * 1.6 - cam.position.x) * .05, cam.position.y + ((target.y - .5) * 1.0 - cam.position.y) * .05, camZ);
    cam.lookAt(look.set(cam.position.x * .3, cam.position.y * .3, camZ - 10));
    const gOp = 1 - sstep(.94, 1, fp), vis = [];
    for (const m of planes) {
      const dz = camZ - m.position.z, op = m.userData.ok ? sstep(26, 16, dz) * sstep(.5, 3, dz) * gOp : 0;
      m.visible = op > .01;
      if (m.visible) { vis.push(m); const un = m.material.uniforms; un.uOp.value = op; un.uReveal.value = mode === 'dots' ? 0 : mode === 'full' ? 1 : sstep(15, 8, dz); }
    }
    ray.setFromCamera(ndc.set(target.x * 2 - 1, target.y * 2 - 1), cam);
    const hit = fp > 0 && fp < 1 && !document.querySelector('dialog[open]') ? ray.intersectObjects(vis, false)[0]?.object : null;
    for (const m of vis) { const un = m.material.uniforms; un.uHover.value += ((m === hit ? 1 : 0) - un.uHover.value) * .12; }
    const F = FLOATS[fkey] || FLOATS.top, wide = innerWidth > innerHeight, hh = 2.18, hw = hh * cam2.aspect, t = u.uTime.value;
    const mob = !wide && fkey !== 'statement', tx = mob ? F[0] * hw * .4 : F[0] * hw, ty = mob ? .8 * hh : F[1] * hh, ts = wide ? F[2] : mob ? F[2] * .6 : .65;
    spv += (spT - spv) * .1;
    fcur.x += (tx - fcur.x) * .05; fcur.y += (ty - fcur.y) * .05; fcur.s += (ts - fcur.s) * .05; fcur.o += (F[3] - fcur.o) * .05;
    rig.position.set(fcur.x + Math.sin(t * .6) * .12, fcur.y + Math.sin(t * .9) * .15, 0);   // always gently floating
    rig.scale.setScalar(fcur.s); rig.visible = fcur.o > .01;
    bu.uTime.value = t; bu.uOp.value = fcur.o; ringMat.opacity = fcur.o * .9;
    blob.rotation.set((target.y - .5) * .8 + t * .1 + spv * 3.14, t * .2 + (target.x - .5) + spv * 6.28, 0);
    ring.rotation.set(1.2 + Math.sin(t * .3) * .2, t * .25, .3 + spv * 3.14);
    introT += dt; if (exitT >= 0) exitT += dt;
    uPhU.value = introT / .85;   // colour palette changes every ~0.85s
    burst = Math.max(0, burst - dt * 2.5);
    uGlU.value = Math.max(1 - clamp(introT / .8), burst);                         // heavy glitch as it starts, spikes on bursts
    uFlU.value = exitT >= 0 ? Math.max(0, 1 - exitT / .22) * .55 : 0;             // white flash as the A flies out
    const bx = Math.min(introT / .75, 1) - 1, bk = 1 + 2.70158 * bx * bx * bx + 1.70158 * bx * bx;   // overshoot "pop"
    const ei = 1 - Math.pow(1 - clamp(introT / .75), 3), xo = exitT < 0 ? 0 : clamp(exitT / exitDur), xe = xo * xo * xo;
    aRig.visible = xo < 1;
    aRig.scale.setScalar((.001 + 1.3 * bk) * (1 + xe * 22));
    aRig.rotation.set((target.y - .5) * .7 + Math.sin(introT * .8) * .15, (1 - ei) * 6.28 + (target.x - .5) * 1.2 + introT * .25, xe * .6);
    au.uOp.value = 1 - sstep(.55, 1, xo); wu.uOp.value = 1 - sstep(.3, .95, xo);
    if (wu.uOp.value > .01 && Math.hypot(target.x - lastRip.x, target.y - lastRip.y) > .025) { lastRip.copy(target); ripI = (ripI + 1) % 8; uRipU.value[ripI].set(target.x, target.y, u.uTime.value); }
    if (introT > .75 && !landed) { landed = true; ripI = (ripI + 1) % 8; uRipU.value[ripI].set(.5, .5, u.uTime.value); }   // ring when the A lands
    if (wu.uOp.value > .01 && introT > .8 && Math.random() < dt * .9) { au.uBoost.value += 1.6; burst = .8; ripI = (ripI + 1) % 8; uRipU.value[ripI].set(.3 + Math.random() * .4, .3 + Math.random() * .4, u.uTime.value); }   // glitch burst
    au.uBoost.value += (u.uMouse.value.distanceTo(prevM) * 40 - au.uBoost.value) * .1; prevM.copy(u.uMouse.value);
    renderer.clear();
    renderer.render(bg, ortho);
    if (wu.uOp.value > .01) renderer.render(ws, ortho);
    renderer.render(fg, cam);
    renderer.clearDepth();
    renderer.render(ob, cam2);
    raf = requestAnimationFrame(frame);
  };
  const run = () => { if (!raf && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else run(); });
  run();
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(raf); raf = 0; });
  canvas.addEventListener('webglcontextrestored', () => run());

  return {
    setProgress(p, fg3) { u.uP.value = p; u.uCol.value.set(fg3[0] / 255, fg3[1] / 255, fg3[2] / 255); },
    setFlight(v) { fp = clamp(v); },
    setMode(m) { mode = m; uDitherU.value = m === 'dither' ? 1 : 0; },
    setFx(o) { bend = o.bend; uSplitU.value = o.split; },
    setFloat(k) { fkey = k; },
    setSp(v) { spT = clamp(v); },
    reveal(fast) { exitT = 0; exitDur = fast ? .4 : .6; entering = true; fkey = 'top'; if (fast) introT = 3; },
  };
}
