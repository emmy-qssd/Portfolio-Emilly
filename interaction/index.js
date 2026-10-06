(() => {
  'use strict';
  const root = document.documentElement;
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    console.warn('GSAP/ScrollTrigger não carregaram. Verifique a conexão.');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  let onThemeChange = null;

  /* ========== TEMA ========== */
  function initTheme() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.setAttribute('aria-pressed', root.dataset.theme === 'dark');
    btn.addEventListener('click', () => {
      const toDark = root.dataset.theme !== 'dark';
      root.dataset.theme = toDark ? 'dark' : 'light';
      btn.setAttribute('aria-pressed', String(toDark));
      try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
      if (onThemeChange) onThemeChange(toDark);
    });
  }

  /* ========== LETRA "O" (orelhas + cauda) ========== */
  function initLetterO() {
    if (!document.querySelector('.o-cat')) return;
    gsap.set('.ear-l', { transformOrigin: '70% 100%' });
    gsap.set('.ear-r', { transformOrigin: '30% 100%' });
      gsap.set('.o-tail', { transformOrigin: '50% 0%' });

    const twitch = (sel, delay, dir) => {
      gsap.timeline({ repeat: -1, repeatDelay: gsap.utils.random(1.5, 3.5), delay })
        .to(sel, { rotation: 14 * dir, duration: 0.08, ease: 'power1.out' })
        .to(sel, { rotation: -6 * dir, duration: 0.1 })
        .to(sel, { rotation: 0, duration: 0.35, ease: 'elastic.out(1,.4)' });
    };
    twitch('.ear-l', 2, -1);
    twitch('.ear-r', 2.6, 1);
    gsap.fromTo('.o-tail', { rotation: -9 }, { rotation: 9, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }

  /* ========== REVELAÇÕES COM SCROLLTRIGGER ========== */
  function initReveals() {
    gsap.from('.nav-wrap', { y: -40, opacity: 0, duration: 0.9, ease: 'power3.out' });
    gsap.from('.title', { y: 40, opacity: 0, duration: 1.2, delay: 0.2, ease: 'power3.out' });
    gsap.from('.role', { x: -20, opacity: 0, duration: 1, delay: 0.7, ease: 'power3.out' });

    gsap.utils.toArray('.sec-title').forEach((el) => {
      gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' } })
        .from(el.querySelectorAll('.line'), { scaleX: 0, transformOrigin: 'left center', duration: 0.9, ease: 'power3.inOut' })
        .from(el.querySelector('.num'), { yPercent: 60, opacity: 0, duration: 0.7, ease: 'power3.out' }, 0.1)
        .from(el.querySelector('h2'), { x: -20, opacity: 0, duration: 0.7, ease: 'power3.out' }, 0.25);
    });

    gsap.utils.toArray('.reveal').forEach((el) => {
      gsap.from(el, { y: 50, opacity: 0, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' } });
    });

    gsap.set('.stagger > *', { autoAlpha: 0, y: 40 });
    ScrollTrigger.batch('.stagger > *', {
      start: 'top 90%',
      onEnter: (b) => gsap.to(b, { autoAlpha: 1, y: 0, stagger: 0.12, duration: 0.8, ease: 'power3.out', overwrite: true }),
      onLeaveBack: (b) => gsap.to(b, { autoAlpha: 0, y: 40, duration: 0.4, overwrite: true }),
    });
  }

  /* ========== GATO 3D ========== */
  function initCat() {
    const canvas = document.getElementById('cat-canvas');
    if (typeof THREE === 'undefined' || !canvas) return;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); }
    catch (e) { console.warn('WebGL indisponível:', e); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.z = 12;

    const M = {
      body: new THREE.MeshStandardMaterial({ color: 0x17151a, roughness: 0.78, metalness: 0 }),
      eye: new THREE.MeshStandardMaterial({ color: 0xfffaf4, roughness: 0.5 }),
      nose: new THREE.MeshStandardMaterial({ color: 0xf4a6b5, roughness: 0.28 }),
      inner: new THREE.MeshStandardMaterial({ color: 0xf2a5b8, roughness: 0.45 }),
      whisk: new THREE.LineBasicMaterial({ color: 0xffffff }),
    };
    scene.add(new THREE.HemisphereLight(0xfff5f0, 0x41354a, 1.2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
    keyLight.position.set(-3, 6, 8); scene.add(keyLight);
    const rimLight = new THREE.PointLight(0xd5c4ff, 3, 18);
    rimLight.position.set(3, 2, -3); scene.add(rimLight);
    const SPH = new THREE.SphereGeometry(1, 32, 24);
    const mesh = (geo, mat, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); return m; };

    // hierarquia: rig (posição/escala) > flip (pulo/cambalhota) > cat (pose)
    const rig = new THREE.Group(), flip = new THREE.Group(), cat = new THREE.Group();
    rig.add(flip); flip.add(cat); scene.add(rig);
    cat.position.x = 0.3;

    const body = mesh(SPH, M.body, 1.7, 0.75, 0.8); body.position.set(-0.2, 0, 0);
    const hips = mesh(SPH, M.body, 0.85, 0.8, 0.8);
    cat.add(body, hips);

    // patas (4): deitado ficam esticadas; em pé caminham
    const legs = [
      { x: 0.95, z: 0.28, f: true, ph: 0 }, { x: 0.7, z: -0.28, f: true, ph: Math.PI },
      { x: -1.15, z: 0.28, f: false, ph: Math.PI }, { x: -0.95, z: -0.28, f: false, ph: 0 },
    ].map((d) => {
      const g = new THREE.Group(); g.position.set(d.x, -0.55, d.z);
      const m = mesh(SPH, M.body, 0.15, 0.46, 0.15); m.position.y = -0.42;
      const paw = mesh(SPH, M.body, 0.23, 0.12, 0.2); paw.position.set(0.06, -0.9, 0);
      g.add(m, paw); cat.add(g); return Object.assign(d, { g });
    });

    // cabeça
    const head = new THREE.Group(); cat.add(head);
    head.add(mesh(SPH, M.body, 0.8, 0.64, 0.62));
    [-1, 1].forEach((s) => { const c = mesh(SPH, M.body, 0.3, 0.22, 0.3); c.position.set(s * 0.5, -0.2, 0.25); head.add(c); });
    const earGeo = new THREE.ConeGeometry(0.31, 0.7, 3), innerGeo = new THREE.ConeGeometry(0.16, 0.42, 3);
    const ears = [-1, 1].map((s) => {
      const p = new THREE.Group(); p.position.set(s * 0.44, 0.42, 0); p.rotation.z = -s * 0.2;
      const e = new THREE.Mesh(earGeo, M.body); e.position.y = 0.26;
      const i = new THREE.Mesh(innerGeo, M.inner); i.position.set(0, 0.2, 0.06);
      p.add(e, i); head.add(p); return p;
    });
    const eyes = [-1, 1].map((s) => { const e = mesh(SPH, M.eye, 0.13, 0.19, 0.05); e.position.set(s * 0.3, 0.1, 0.56); head.add(e); return e; });
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.1, 3), M.nose);
    nose.rotation.z = Math.PI; nose.position.set(0, -0.1, 0.6); head.add(nose);
    [-1, 1].forEach((s) => [-1, 0, 1].forEach((k) => {
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(s * 0.3, -0.16, 0.57), new THREE.Vector3(s * 1.05, -0.14 + k * 0.14, 0.6)]);
      head.add(new THREE.Line(g, M.whisk));
    }));

    // boca + dentinhos
    const smile = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.1, -0.2, 0.615), new THREE.Vector3(0, -0.29, 0.63), new THREE.Vector3(0.1, -0.2, 0.615));
    head.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(smile.getPoints(16)), M.whisk));

    // cauda
    const tailPivot = new THREE.Group(); tailPivot.position.set(-1.55, -0.02, 0); cat.add(tailPivot);
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.55, -0.08, 0),
      new THREE.Vector3(-1.15, -0.02, 0), new THREE.Vector3(-1.45, 0.35, 0),
      new THREE.Vector3(-1.4, 0.78, 0), new THREE.Vector3(-1.05, 0.95, 0)
    ]);
    tailPivot.add(new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 40, 0.105, 10, false), M.body));

    /* ----- pose (GSAP anima, o frame aplica) ----- */
    const pose = { stretch: 0, sleepy: 0, happy: 0, tuck: 0, stand: 0, turn: 0, walk: 0 };
    const face = { dir: 1 }, trav = { n: 0 };
    let phase = 0;

    function applyPose(time, dt) {
      const P = pose, st = P.stretch, tk = P.tuck, sd = P.stand;
      phase += dt * 9 * P.walk;

      const closed = Math.max(P.sleepy, P.happy);
      eyes.forEach((e) => { e.scale.y = 0.19 * (1 - 0.9 * closed); });
      head.rotation.set(0, P.turn * 0.95, Math.sin(time * 9) * 0.07 * P.happy);
      head.position.set(1.55 + 0.45 * st - 0.4 * tk, 0.3 + 0.3 * sd - 0.12 * st - 0.25 * tk, 0);

      body.scale.x = 1.7 * (1 + 0.12 * st - 0.3 * tk);
      body.rotation.z = -0.1 * st + 0.03 * Math.sin(phase * 2) * P.walk;
      hips.position.set(-1.3 + 0.3 * tk, -0.05 + 0.25 * st, 0);
      cat.position.y = 0.82 * sd + Math.abs(Math.sin(phase)) * 0.07 * P.walk;
      cat.scale.set(face.dir, 1 + 0.015 * Math.sin(time * 2), 1);

      legs.forEach((L) => {
        const rest = L.f ? 1.45 - 0.5 * tk : -1.3 + 0.4 * tk;
        L.g.position.x = L.x + (L.f ? 0.55 * st - 0.4 * tk : 0.3 * tk);
        L.g.rotation.z = rest * (1 - sd) + Math.sin(phase + L.ph) * 0.6 * P.walk;
      });

      tailPivot.rotation.z = Math.sin(time * 2.1) * 0.12 - 0.08 * sd;
    }

    // bocejo + espreguiçada em loop
    const yawnTl = gsap.timeline({ repeat: -1, repeatDelay: 5, delay: 2 })
      .to(pose, { sleepy: 1, duration: 0.6, ease: 'sine.inOut' })
      .to(pose, { duration: 0.35 })
      .to(pose, { sleepy: 0, duration: 0.5, ease: 'sine.inOut' });

    /* ----- cores / tema ----- */
    const setColors = (dark, dur, delay = 0) => {
      const to = (mat, hex) => {
        const c = new THREE.Color(hex);
        if (dur) gsap.to(mat.color, { r: c.r, g: c.g, b: c.b, duration: dur, delay, ease: 'power1.inOut' });
        else mat.color.copy(c);
      };
      to(M.body, dark ? 0xffffff : 0x000000);
      to(M.eye, dark ? 0x000000 : 0xffffff);
      to(M.whisk, dark ? 0x000000 : 0xffffff);
    };
    setColors(root.dataset.theme === 'dark', 0);

    /* ----- estados: idle | leaving | away | returning ----- */
    let state = 'idle', walkTl = null;

    // cambalhota fofa: agacha, vira bolinha, rola com pulinho, pousa e pisca feliz
    onThemeChange = (toDark) => {
      setColors(toDark, 0.45);
    };

    // caminhar para a direita ao rolar para baixo
    function walkAway() {
      if (state === 'away' || state === 'leaving') return;
      state = 'leaving'; yawnTl.pause(); if (walkTl) walkTl.kill();
      walkTl = gsap.timeline({ onComplete: () => { state = 'away'; rig.visible = false; } })
        .to(pose, { stretch: 0, sleepy: 0, happy: 0, tuck: 0, duration: 0.3 })
        .to(face, { dir: -1, duration: 0.2 }, 0)
        .to(pose, { stand: 1, duration: 0.7, ease: 'back.out(1.6)' })
        .to(pose, { turn: 1, duration: 0.5, ease: 'power2.out' }, '<0.1')
        .to(pose, { walk: 1, duration: 0.4 }, '>-0.1')
        .to(trav, { n: 1, duration: 3, ease: 'power1.inOut' }, '<');
    }
    // volta andando pela direita, vira para a câmera e deita
    function comeBack() {
      if (state === 'idle' || state === 'returning') return;
      const wasAway = state === 'away';
      state = 'returning'; if (walkTl) walkTl.kill(); rig.visible = true;
      walkTl = gsap.timeline({ onComplete: () => { state = 'idle'; yawnTl.restart(); } })
        .to(pose, { stand: 1, turn: 1, walk: 1, duration: 0.3 }, 0)
        .to(face, { dir: 1, duration: wasAway ? 0.01 : 0.3, ease: 'power2.inOut' }, 0)
        .to(trav, { n: 0, duration: Math.max(0.9, 2.8 * trav.n), ease: 'power1.inOut' }, 0.2)
        .to(face, { dir: 1, duration: 0.4, ease: 'power2.inOut' })
        .to(pose, { walk: 0, duration: 0.3 }, '<')
        .to(pose, { turn: 0, stand: 0, duration: 0.8, ease: 'power2.inOut' }, '<0.15');
    }
    ScrollTrigger.create({ start: 60, end: 'max', onEnter: walkAway, onLeaveBack: comeBack });
    if (window.scrollY > 60) { // página recarregada já rolada
      state = 'away'; trav.n = 1; rig.visible = false; pose.stand = 1; pose.turn = 1; yawnTl.pause();
    }

    /* ----- clique no gato: olhinhos fechados + corações ----- */
    const heartTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d'); x.fillStyle = '#ff5c8a'; x.beginPath(); x.moveTo(64, 114);
      x.bezierCurveTo(6, 72, 14, 14, 64, 40); x.bezierCurveTo(114, 14, 122, 72, 64, 114); x.fill();
      return new THREE.CanvasTexture(c);
    })();
    function spawnHeart() {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthTest: false }));
      const p = head.getWorldPosition(new THREE.Vector3()), s = rig.scale.x, size = s * (0.45 + Math.random() * 0.3);
      sp.position.set(p.x + (Math.random() - 0.5) * 0.8 * s, p.y + 0.7 * s, 1); sp.scale.setScalar(0.01); scene.add(sp);
      gsap.timeline({ onComplete: () => { scene.remove(sp); sp.material.dispose(); } })
        .to(sp.scale, { x: size, y: size, duration: 0.3, ease: 'back.out(2)' })
        .to(sp.position, { y: '+=' + (1.3 * s + Math.random() * 0.6), x: '+=' + (Math.random() - 0.5) * 1.2, duration: 1.5, ease: 'power1.out' }, 0)
        .to(sp.material, { opacity: 0, duration: 0.5 }, 1.0);
    }
    let loving = false;
    function love() {
      if (loving || state !== 'idle') return;
      loving = true;
      for (let i = 0; i < 7; i++) gsap.delayedCall(i * 0.2, spawnHeart);
      gsap.timeline({ onComplete: () => { loving = false; } })
        .to(pose, { happy: 1, duration: 0.15 })
        .to(pose, { happy: 0, duration: 0.3 }, '+=1.5');
    }
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const overCat = (e) => {
      if (state !== 'idle') return false;
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.intersectObject(cat, true).some((h) => h.object.isMesh);
    };
    window.addEventListener('click', (e) => { if (!e.target.closest('a,button') && overCat(e)) love(); });
    window.addEventListener('pointermove', (e) => { root.style.cursor = overCat(e) ? 'pointer' : ''; });

    /* ----- layout responsivo ----- */
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    function place() {
      const vh = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
      const vw = vh * camera.aspect, mobile = window.innerWidth < 800;
      const hero = mobile
        ? { x: 0, y: -vh * 0.2, s: Math.min(1.1, (vw * 0.82) / 5.6) }
        : { x: vw * 0.29, y: -vh * 0.03, s: Math.min(0.9, (vw * 0.34) / 5.6) };
      const out = -vw / 2 - 3.8 * hero.s;
      rig.position.set(hero.x + trav.n * (out - hero.x), hero.y, 0);
      rig.scale.setScalar(hero.s);
    }
    window.addEventListener('resize', resize);
    resize();
    gsap.from(canvas, { opacity: 0, duration: 1.4, ease: 'power2.out' });

    gsap.ticker.add((time, deltaTime) => {
      place();
      applyPose(time, Math.min(deltaTime, 50) / 1000);
      renderer.render(scene, camera);
    });
  }

  /* ========== INÍCIO ========== */
  initTheme();
  initLetterO();
  initReveals();
  try { initCat(); } catch (err) { console.error('Erro ao iniciar o gato 3D:', err); }
})();
