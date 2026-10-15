/* ==========================================================
   app.js — Gato 3D (GLTF) + OrbitControls + tema + cursor
   Three.js r160 via importmap · GSAP global (CDN no HTML)
   ========================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ----------------------------------------------------------
   CONFIGURAÇÃO — troque pelo caminho do seu modelo
   ---------------------------------------------------------- */

const gsap = window.gsap;
const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canFinePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const rand = (a, b) => a + Math.random() * (b - a);

/* ==========================================================
   1. TEMA (Dark padrão / Light) — paleta e estado
   ========================================================== */
const THEMES = {
  dark: { bg: '#000000', fg: '#ffffff', muted: 'rgba(255,255,255,0.56)', line: 'rgba(255,255,255,0.14)' },
  light: { bg: '#ffffff', fg: '#000000', muted: 'rgba(0,0,0,0.56)', line: 'rgba(0,0,0,0.12)' },
};

const ACCENT_HEX = 0xa9cce8; // Azul-bebê pastel
const CAT_BLACK = new THREE.Color(0x0a0a0a);
const CAT_WHITE = new THREE.Color(0xf7f7f7);

const toggle = document.querySelector('.theme-toggle');
const toggleLabel = toggle.querySelector('.label');
const knob = toggle.querySelector('.knob');

const saved = (() => {
  try { return localStorage.getItem('theme'); } catch { return null; }
})();
let isDark = saved ? saved === 'dark' : true;
const toneState = { t: isDark ? 1 : 0 }; // 0 = preto, 1 = branco

/* ==========================================================
   2. RENDERER, CENA, CÂMERA
   ========================================================== */
const stage = document.getElementById('cat-stage');
const canvas = stage.querySelector('canvas');
const loaderEl = document.getElementById('loader');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
camera.position.set(0, 0.8, 6.5);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.enableZoom = false;       // zoom desligado para não brigar com o scroll da página
controls.minPolarAngle = Math.PI * 0.32;
controls.maxPolarAngle = Math.PI * 0.6;
controls.autoRotate = false;        // a rotação é controlada pelo cursor
controls.target.set(0, 0.4, 0);

/* ==========================================================
   3. ILUMINAÇÃO DE ESTÚDIO
   Ambiente suave + key light com sombras + fill + rim azul-bebê
   ========================================================== */
const ambient = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambient);

const keyLight = new THREE.SpotLight(0xffffff, 60, 25, Math.PI / 6, 0.6, 1.4);
keyLight.position.set(3.5, 6, 4.5);
keyLight.target.position.set(0, 0.2, 0);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.bias = -0.0005;
keyLight.shadow.radius = 6;
scene.add(keyLight, keyLight.target);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
fillLight.position.set(-4, 2, 3);
scene.add(fillLight);

const rimLight = new THREE.PointLight(ACCENT_HEX, 14, 12, 1.6);
rimLight.position.set(-2.5, 2.2, -2.8);
scene.add(rimLight);

// Chão que recebe apenas a sombra (sombra sutil, fundo transparente)
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.ShadowMaterial({ opacity: 0.18 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.25;
floor.receiveShadow = true;
scene.add(floor);

/* ==========================================================
   4. CARREGAMENTO DO MODELO (GLTFLoader + traverse)
   ========================================================== */
const catRoot = new THREE.Group(); // pivô: respiração + olhar para o cursor
scene.add(catRoot);

const catMaterials = [];   // materiais que receberão a troca de cor
const catMeshes = [];      // malhas para raycasting
let headBone = null;       // osso/nó da cabeça, se existir no modelo
let eyeMeshes = [];        // malhas candidatas a olhos (para piscar)
let modelPivot = null;     // grupo com o modelo já centralizado

const loader = new GLTFLoader();

loader.load(
  MODEL_URL,
  (gltf) => {
    const model = gltf.scene;

    // Centraliza e normaliza a escala do modelo
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2.4 / maxDim;

    model.scale.setScalar(scale);
    model.position.sub(center.multiplyScalar(scale));
    model.position.y -= 0.1;

    modelPivot = new THREE.Group();
    modelPivot.add(model);
    catRoot.add(modelPivot);

    // Percorre a hierarquia: sombras, materiais e nós especiais
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        catMeshes.push(child);

        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((mat) => {
          if (!mat || !mat.isMeshStandardMaterial) return;
          // Clona para não afetar outros usos e garante controle independente
          const m = mat.clone();
          m.envMapIntensity = 1.0;
          if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
          catMaterials.push(m);
          if (Array.isArray(child.material)) {
            child.material[child.material.indexOf(mat)] = m;
          } else {
            child.material = m;
          }
        });

        // Heurística de nomes para olhos/cabeça (ajuste conforme seu modelo)
        const n = (child.name || '').toLowerCase();
        if (/eye|olho/.test(n)) eyeMeshes.push(child);
      }

      const nodeName = (child.name || '').toLowerCase();
      if (!headBone && /head|cabeca|cabeça/.test(nodeName)) headBone = child;
    });

    // Materiais iniciais de acordo com o tema
    updateCatTone();

    // Sem IBL externo: ambiente neutro gerado por RoomEnvironment seria opcional.
    // Entrada suave do modelo
    gsap.from(modelPivot.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 1.6, ease: 'expo.out' });
    gsap.from(modelPivot.rotation, { y: -Math.PI * 0.5, duration: 2, ease: 'expo.out' });

    loaderEl.classList.add('is-hidden');
    startIdle();
  },
  (xhr) => {
    if (xhr.total) {
      const pct = Math.round((xhr.loaded / xhr.total) * 100);
      loaderEl.textContent = `carregando modelo ${pct}%`;
    }
  },
  (err) => {
    console.error('Erro ao carregar o modelo 3D:', err);
    loaderEl.textContent = 'erro ao carregar o modelo';
  }
);

/* ==========================================================
   5. TROCA DE COR DO GATO (GSAP tweena o toneState)
   Claro → preto · Escuro → branco (com leve tint azul-bebê)
   ========================================================== */
const tmpColor = new THREE.Color();
const tmpEmissive = new THREE.Color();

function updateCatTone() {
  tmpColor.lerpColors(CAT_BLACK, CAT_WHITE, toneState.t);
  tmpEmissive.copy(new THREE.Color(ACCENT_HEX)).multiplyScalar(0.06 * toneState.t);
  catMaterials.forEach((m) => {
    m.color.copy(tmpColor);
    m.emissive.copy(tmpEmissive);
    m.roughness = THREE.MathUtils.lerp(0.55, 0.32, toneState.t);
  });
}

/* ==========================================================
   6. TEMA: transição de CSS e do modelo via GSAP
   ========================================================== */
function applyTheme(dark, instant = false) {
  isDark = dark;
  const t = THEMES[dark ? 'dark' : 'light'];
  const d = instant ? 0 : 0.9;

  gsap.to(root, {
    '--bg': t.bg,
    '--fg': t.fg,
    '--muted': t.muted,
    '--line': t.line,
    duration: d,
    ease: 'power2.inOut',
    overwrite: 'auto',
  });

  if (instant) {
    toneState.t = dark ? 1 : 0;
    updateCatTone();
  } else {
    gsap.to(toneState, {
      t: dark ? 1 : 0,
      duration: d,
      ease: 'power2.inOut',
      onUpdate: updateCatTone,
      overwrite: 'auto',
    });
  }

  gsap.to(knob, { x: dark ? 22 : 0, duration: d, ease: 'power3.inOut' });
  toggle.setAttribute('aria-pressed', String(dark));
  toggleLabel.textContent = dark ? 'Escuro' : 'Claro';
  root.dataset.theme = dark ? 'dark' : 'light';
  floor.material.opacity = dark ? 0.35 : 0.18;
}

toggle.addEventListener('click', () => {
  const next = !isDark;
  applyTheme(next);
  try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch { /* ignora */ }
});

/* ==========================================================
   7. RAYCASTING + CORAÇÕES (partículas) + micro-interação
   ========================================================== */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hoverCat = false;

function setPointerFromEvent(e) {
  const r = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}

function hitCat() {
  if (!modelPivot) return false;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObject(modelPivot, true).length > 0;
}

canvas.addEventListener('pointermove', (e) => {
  setPointerFromEvent(e);
  const over = hitCat();
  if (over !== hoverCat) {
    hoverCat = over;
    setCursorMode(over ? 'cat' : 'default');
  }
});

canvas.addEventListener('pointerleave', () => {
  hoverCat = false;
  setCursorMode('default');
});

canvas.addEventListener('pointerdown', (e) => {
  setPointerFromEvent(e);
  if (hitCat()) petCat();
});

/* --- Corações: sprites com textura de canvas (leves e nítidos) --- */
function makeHeartTexture(fill) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.translate(64, 64);
  g.scale(1, 1);
  g.beginPath();
  g.moveTo(0, 34);
  g.bezierCurveTo(-60, -8, -36, -54, 0, -26);
  g.bezierCurveTo(36, -54, 60, -8, 0, 34);
  g.closePath();
  g.fillStyle = fill;
  g.shadowColor = fill;
  g.shadowBlur = 12;
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const heartTextures = [
  makeHeartTexture('#a9cce8'), // azul-bebê
  makeHeartTexture('#ffffff'), // branco
  makeHeartTexture('#cfe4f5'), // azul-bebê claro
];

const HEART_POOL = 16;
const hearts = Array.from({ length: HEART_POOL }, (_, i) => {
  const mat = new THREE.SpriteMaterial({
    map: heartTextures[i % heartTextures.length],
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.visible = false;
  scene.add(sprite);
  return { sprite, busy: false };
});

function emitHearts() {
  const free = hearts.filter((h) => !h.busy).slice(0, 8);
  const center = new THREE.Vector3(0, 0.6, 0);

  free.forEach((h, i) => {
    const s = h.sprite;
    h.busy = true;
    s.visible = true;
    s.material.opacity = 0;

    const side = i % 2 === 0 ? 1 : -1;
    const startX = center.x + rand(-0.9, 0.9);
    const startY = center.y + rand(-0.5, 0.2);
    const startZ = center.z + rand(-0.4, 0.4);
    s.position.set(startX, startY, startZ);
    const base = rand(0.22, 0.34);
    s.scale.setScalar(base * 0.2);

    const driftX = side * rand(0.25, 0.8);
    const riseY = rand(1.8, 2.8);
    const life = rand(1.8, 2.6);
    const delay = i * 0.12 + rand(0, 0.08);

    gsap
      .timeline({
        delay,
        onComplete() {
          s.visible = false;
          h.busy = false;
        },
      })
      .to(s.scale, { x: base, y: base, z: base, duration: 0.5, ease: 'back.out(2)' }, 0)
      .to(s.material, { opacity: 0.95, duration: 0.35, ease: 'power1.out' }, 0)
      .to(
        s.position,
        {
          x: startX + driftX,
          y: startY + riseY,
          duration: life,
          ease: 'sine.out',
        },
        0
      )
      .to(
        s.position,
        {
          x: `+=${Math.sin(i) * 0.25}`, // balanço lateral sutil
          duration: life,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: 1,
        },
        0
      )
      .to(s.material, { opacity: 0, duration: 0.7, ease: 'power1.in' }, life - 0.7)
      .to(s.scale, { x: base * 0.6, y: base * 0.6, z: base * 0.6, duration: 0.7, ease: 'power1.in' }, life - 0.7);
  });
}

/* --- Micro-interação: vibração de felicidade + piscar, sem pular --- */
function petCat() {
  emitHearts();

  if (!modelPivot) return;

  gsap.killTweensOf(modelPivot.scale);
  const base = modelPivot.scale.x; // escala atual (pós-intro)
  const tl = gsap.timeline();

  // Micro "pulsação" de felicidade (sem alterar a posição)
  tl.to(modelPivot.scale, { x: base * 1.02, y: base * 1.02, z: base * 1.02, duration: 0.12, ease: 'power2.out' })
    .to(modelPivot.scale, { x: base, y: base, z: base, duration: 0.6, ease: 'elastic.out(1, 0.5)' });

  // Pequena vibração rotacional (quase imperceptível)
  gsap.fromTo(
    modelPivot.rotation,
    { z: 0 },
    { z: 0.025, duration: 0.08, yoyo: true, repeat: 3, ease: 'sine.inOut', overwrite: 'auto' }
  );

  // Piscar rápido e feliz (se houver malhas de olhos)
  if (eyeMeshes.length) {
    const scales = eyeMeshes.map((e) => e.scale);
    gsap.to(scales, { y: 0.1, duration: 0.09, yoyo: true, repeat: 1, ease: 'power1.inOut', overwrite: 'auto' });
  }
}

/* ==========================================================
   8. ANIMAÇÃO CONTÍNUA (respiração + olhar para o cursor)
   ========================================================== */
function startIdle() {
  if (reduceMotion || !modelPivot) return;

  // Respiração: escala sutil e orgânica
  gsap.to(modelPivot.scale, {
    y: `*=1.012`,
    x: `*=1.006`,
    z: `*=1.006`,
    duration: 2.6,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
  });

  // Flutuação vertical lenta do pivô
  gsap.to(catRoot.position, { y: 0.06, duration: 3, ease: 'sine.inOut', yoyo: true, repeat: -1 });
}

// Olhar suave para o cursor (rotação em X/Y) — quickTo para performance
const yawTo = gsap.quickTo(catRoot.rotation, 'y', { duration: 1.2, ease: 'power3.out' });
const pitchTo = gsap.quickTo(catRoot.rotation, 'x', { duration: 1.2, ease: 'power3.out' });

window.addEventListener('pointermove', (e) => {
  const nx = (e.clientX / window.innerWidth) * 2 - 1;
  const ny = (e.clientY / window.innerHeight) * 2 - 1;
  yawTo(nx * 0.22);
  pitchTo(ny * 0.08);
});

/* ==========================================================
   9. CURSOR PERSONALIZADO (patinha) — GSAP quickTo
   ========================================================== */
const cursorEl = document.querySelector('.cursor');
const cursorInner = cursorEl.querySelector('.cursor-inner');
const INTERACTIVE = 'a, button, [data-cursor="hover"]';

let cursorVisible = false;
let hoverScale = 1;
let hoverRot = 0;
let pressed = false;

function refreshCursor() {
  gsap.to(cursorInner, {
    scale: pressed ? 0.75 : hoverScale,
    rotation: hoverRot,
    duration: 0.4,
    ease: 'back.out(2)',
    overwrite: 'auto',
  });
}

function setCursorMode(mode) {
  const modes = {
    default: [1, 0],
    link: [1.9, -12],
    cat: [1.4, 0],
  };
  [hoverScale, hoverRot] = modes[mode] || modes.default;
  refreshCursor();
}

if (canFinePointer) {
  root.classList.add('has-custom-cursor');
  gsap.set(cursorEl, { xPercent: -50, yPercent: -50 });

  const cx = gsap.quickTo(cursorEl, 'x', { duration: 0.5, ease: 'power3' });
  const cy = gsap.quickTo(cursorEl, 'y', { duration: 0.5, ease: 'power3' });

  window.addEventListener('pointermove', (e) => {
    cx(e.clientX);
    cy(e.clientY);
    if (!cursorVisible) {
      cursorVisible = true;
      gsap.to(cursorEl, { opacity: 1, duration: 0.3 });
    }
  });

  document.addEventListener('mouseleave', () => {
    cursorVisible = false;
    gsap.to(cursorEl, { opacity: 0, duration: 0.2 });
  });

  window.addEventListener('pointerdown', () => { pressed = true; refreshCursor(); });
  window.addEventListener('pointerup', () => { pressed = false; refreshCursor(); });

  document.addEventListener('pointerover', (e) => {
    if (e.target.closest(INTERACTIVE)) setCursorMode('link');
  });

  document.addEventListener('pointerout', (e) => {
    if (!e.target.closest(INTERACTIVE)) return;
    const next = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(INTERACTIVE);
    if (!next) setCursorMode(hoverCat ? 'cat' : 'default');
  });
}

/* ==========================================================
   10. ANIMAÇÕES DE ENTRADA E REVELAÇÃO AO ROLAR
   ========================================================== */
function intro() {
  gsap.from('.topbar', { y: -20, opacity: 0, duration: 0.9, ease: 'power3.out' });
  gsap.from('[data-reveal]', {
    y: 36,
    opacity: 0,
    duration: 1,
    ease: 'power3.out',
    stagger: 0.12,
    delay: 0.15,
  });
}

const revealIO = new IntersectionObserver(
  (entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      gsap.to(en.target, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' });
      revealIO.unobserve(en.target);
    });
  },
  { threshold: 0.15 }
);

document.querySelectorAll('[data-scroll]').forEach((el) => {
  gsap.set(el, { opacity: 0, y: 40 });
  revealIO.observe(el);
});

/* ==========================================================
   11. RESIZE + LOOP DE RENDER (pausa fora da tela)
   ========================================================== */
function resize() {
  const { width, height } = stage.getBoundingClientRect();
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.position.z = camera.aspect < 0.85 ? 9 : 6.5;
  camera.updateProjectionMatrix();
}

new ResizeObserver(resize).observe(stage);
resize();

function renderLoop() {
  controls.update();
  renderer.render(scene, camera);
}

const visibilityIO = new IntersectionObserver(([entry]) => {
  renderer.setAnimationLoop(entry.isIntersecting ? renderLoop : null);
});
visibilityIO.observe(stage);

/* ==========================================================
   12. INICIALIZAÇÃO
   ========================================================== */
applyTheme(isDark, true);
intro();