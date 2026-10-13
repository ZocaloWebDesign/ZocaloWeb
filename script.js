(() => {
  const $ = (s, r = document) => r.querySelector(s);

  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // scroll suave con Lenis (solo rueda/trackpad; en táctil queda el scroll nativo)
  let lenis = null;
  if (window.Lenis && !reduceMotion) {
    lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true, wheelMultiplier: 1 });
    const raf = time => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    if (root.classList.contains('loading')) {
      lenis.stop();
      addEventListener('zocalo:start', () => lenis.start(), { once: true });
      setTimeout(() => lenis.start(), 7000); // por si la carga se trabara
    }
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      const target = id.length > 1 && document.querySelector(id);
      if (!target) { if (id === '#inicio') { e.preventDefault(); lenis.scrollTo(0); } return; }
      e.preventDefault();
      lenis.scrollTo(target, { offset: -76, duration: 1.4 });
    });
  }

  // pantalla de carga: el logo se arma, aparece el nombre y viaja hasta el menú
  // (espera a que cargue todo: mínimo 2,1 s, máximo 4,5 s)
  const onReady = fn => (root.dataset.started || !root.classList.contains('loading')) ? fn() : addEventListener('zocalo:start', fn, { once: true });
  const hero = $('.hero');
  if (hero && !reduceMotion) hero.classList.add('is-intro');
  const pre = $('#pre');
  const start = () => { root.dataset.started = '1'; dispatchEvent(new Event('zocalo:start')); };
  if (pre) {
    const lock = $('#preLock');
    const MIN = reduceMotion ? 500 : 2100, MAX = 4500, t0 = performance.now();
    let loaded = false, shown = 0, finished = false;
    const pageLoaded = new Promise(r => document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true }));
    Promise.all([pageLoaded, document.fonts ? document.fonts.ready : Promise.resolve()]).then(() => { loaded = true; });
    const done = () => { root.classList.remove('loading'); pre.remove(); };
    const finish = () => {
      if (finished) return; finished = true;
      setTimeout(() => {
        const brand = $('.nav .brand');
        if (reduceMotion || !brand || !lock.animate) {
          pre.classList.add('is-out'); start();
          setTimeout(done, 500);
          return;
        }
        // el logo y el nombre viajan hasta su lugar en el menú
        const a = lock.getBoundingClientRect(), b = brand.getBoundingClientRect();
        const k = b.width / a.width;
        const dx = b.left - a.left, dy = b.top + b.height / 2 - (a.top + a.height * k / 2);
        pre.classList.add('is-fly');
        const fly = lock.animate(
          [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }],
          { duration: 1000, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' }
        );
        setTimeout(() => pre.classList.add('is-out'), 350);
        setTimeout(start, 450);
        fly.onfinish = done;
        setTimeout(() => { if (document.body.contains(pre)) done(); }, 2200);
      }, 220);
    };
    (function tick(now) {
      const t = now - t0;
      const raw = Math.min(1, t / MIN), eased = 1 - Math.pow(1 - raw, 3);
      const target = loaded ? eased : Math.min(0.88, eased * 0.88);
      shown = Math.max(shown, target);
      if ((loaded && t >= MIN) || t >= MAX) finish(); else requestAnimationFrame(tick);
    })(t0);
  }

  // títulos: cada palabra sube desde abajo (solo transform: casi no cuesta nada)
  const riseSetup = el => {
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    let n = 0;
    const walk = node => [...node.childNodes].forEach(ch => {
      if (ch.nodeType === 3) {
        const frag = document.createDocumentFragment();
        ch.textContent.split(/(\s+)/).forEach(tok => {
          if (!tok) return;
          if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'), s = document.createElement('span');
          w.className = 'w'; s.textContent = tok; s.style.setProperty('--i', n++); s.setAttribute('aria-hidden', 'true');
          w.appendChild(s); frag.appendChild(w);
        });
        ch.replaceWith(frag);
      } else if (ch.nodeType === 1) walk(ch);
    });
    walk(el);
    el.classList.add('rise');
  };
  const canRise = !reduceMotion && 'IntersectionObserver' in window;

  // título del inicio: sube cuando la pantalla de carga termina
  const h1 = $('.hero h1');
  if (h1 && canRise) {
    riseSetup(h1);
    h1.classList.add('ready');
    onReady(() => {
      hero.classList.add('go');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        h1.classList.add('in');
        setTimeout(() => hero.classList.add('typed'), 500);
        setTimeout(() => hero.classList.remove('is-intro', 'go', 'typed'), 2600);
      }));
    });
  } else {
    if (h1) h1.classList.add('ready');
    if (hero) hero.classList.remove('is-intro');
  }

  // títulos de cada sección: ya aparecen junto con su bloque (.reveal); solo el que no está dentro de uno sube como una pieza
  if (canRise) {
    const heads = [...document.querySelectorAll('.sec h2')].filter(el => !el.closest('.reveal'));
    heads.forEach(el => el.classList.add('rise-block'));
    const hio = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return;
      hio.unobserve(en.target);
      en.target.classList.add('in');
    }), { threshold: 0.4 });
    heads.forEach(el => hio.observe(el));
  }

  // las capturas del comparador se decodifican de antemano (en reposo), no al llegar a la sección
  const warm = () => document.querySelectorAll('.ba img').forEach(img => { if (img.decode) img.decode().catch(() => {}); });
  if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 4000 }); else setTimeout(warm, 2500);

  // robot: aparece recién cuando se empieza a scrollear
  const bot = $('#bot');
  if (bot) {
    const showBot = () => {
      const on = window.scrollY > 70;
      bot.classList.toggle('is-on', on);
      bot.toggleAttribute('inert', !on);
    };
    showBot();
    window.addEventListener('scroll', showBot, { passive: true });
  }

  // robot: parpadea y pulsa de vez en cuando (sin animaciones continuas en el SVG)
  const botBody = $('#botBody'), botSign = $('#botSignWrap');
  if (botBody && !reduceMotion) {
    const blink = () => {
      botBody.classList.add('is-blink');
      setTimeout(() => botBody.classList.remove('is-blink'), 140);
      setTimeout(blink, 3500 + Math.random() * 2500);
    };
    setTimeout(blink, 4000);
    const pulse = () => {
      if (bot && bot.classList.contains('is-on')) {
        botSign.classList.add('is-pulse');
        setTimeout(() => botSign.classList.remove('is-pulse'), 950);
      }
      setTimeout(pulse, 9000);
    };
    setTimeout(pulse, 7000);
  }

  // nav: fondo al hacer scroll + menú móvil
  const nav = $('#nav'), burger = $('#burger'), links = $('#navLinks');
  const onScroll = () => nav.classList.toggle('is-stuck', window.scrollY > 20);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const closeMenu = () => {
    links.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  };
  burger.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });
  links.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  // aparición al scrollear
  const items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('in'); io.unobserve(en.target);
          if (en.target.classList.contains('svc')) setTimeout(() => en.target.classList.add('settled'), 1400);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    items.forEach(el => io.observe(el));
  } else {
    items.forEach(el => el.classList.add('in'));
  }

  // comparador antes / después
  const ba = $('#ba');
  if (ba) {
    const range = $('.ba__range', ba);
    const set = v => ba.style.setProperty('--pos', v + '%');
    const say = () => range.setAttribute('aria-valuetext', range.value + '% de la web nueva visible');
    range.addEventListener('input', () => { set(range.value); say(); });
    say();
  }

  // 4 · contadores: los números suben al entrar en pantalla
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window && !reduceMotion) {
    counters.forEach(el => { el.textContent = '0'; });
    const run = el => {
      const end = +el.dataset.count, dec = +(el.dataset.dec || 0), dur = 1600, t0 = performance.now();
      const fmt = v => dec ? v.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : Math.round(v);
      const tick = now => {
        const p = Math.min((now - t0) / dur, 1), e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
        el.textContent = fmt(end * e);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const co = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { run(en.target); co.unobserve(en.target); }
    }), { threshold: 0.6 });
    counters.forEach(el => co.observe(el));
  }

  // pausar las animaciones del inicio cuando ya no está en pantalla
  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => hero.classList.toggle('is-off', !e.isIntersecting)).observe(hero);
  }

  // escena de la compra: solo anima mientras está a la vista
  const scene = $('.scene');
  if (scene && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => scene.classList.toggle('is-play', e.isIntersecting), { threshold: 0.2 }).observe(scene);
  }

  const FRAG_SRC = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec3 u_colors[8];
uniform vec4 u_scene;      // resolution.xy, time, colour count
uniform vec4 u_shape;      // scale, intensity, paramA, warp
uniform vec4 u_surface;    // detail, contrast, brightness, saturation
uniform vec4 u_finish;     // hue, vignette, blur, grain
uniform vec4 u_transform;  // seed, rotation, drift, OKLab toggle
uniform vec4 u_space;      // offset.xy, pointer.xy
uniform vec4 u_cursor;

#define u_resolution u_scene.xy
#define u_time u_scene.z
#define u_colorCount u_scene.w
#define u_scale u_shape.x
#define u_intensity u_shape.y
#define u_paramA u_shape.z
#define u_warp u_shape.w
#define u_detail u_surface.x
#define u_contrast u_surface.y
#define u_brightness u_surface.z
#define u_saturation u_surface.w
#define u_hue u_finish.x
#define u_vignette u_finish.y
#define u_blur u_finish.z
#define u_grain u_finish.w
#ifdef GL_FRAGMENT_PRECISION_HIGH
#define u_seed u_transform.x
#else
#define u_seed mod(u_transform.x, 31.0)
#endif
#define u_rotate u_transform.y
#define u_drift u_transform.z
#define u_oklab u_transform.w
#define u_offset u_space.xy
#define u_mouse u_space.zw
#define u_cursorPresence u_cursor.x
#define u_cursorEffect u_cursor.y
#define u_cursorStrength u_cursor.z
#define u_cursorRadius u_cursor.w

float hash21(vec2 p) {
#ifndef GL_FRAGMENT_PRECISION_HIGH
  p = mod(p, 31.0);
#endif
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float grainHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.0, 9.2);
    a *= 0.5;
  }
  return v;
}

vec3 hueRotate(vec3 col, float a) {
  const mat3 toYIQ = mat3(0.299, 0.596, 0.211,
                          0.587, -0.274, -0.523,
                          0.114, -0.322, 0.312);
  const mat3 toRGB = mat3(1.0, 1.0, 1.0,
                          0.956, -0.272, -1.106,
                          0.621, -0.647, 1.703);
  vec3 yiq = toYIQ * col;
  float ca = cos(a), sa = sin(a);
  yiq = vec3(yiq.x, yiq.y * ca - yiq.z * sa, yiq.y * sa + yiq.z * ca);
  return toRGB * yiq;
}

vec3 shade(vec2 uv, vec2 p, float t) {
  vec3 acc = u_colors[0] * 0.15;
  float total = 0.15;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= u_colorCount) break;
    float fi = float(i);
    vec2 c = vec2(
      sin(t * (0.21 + fi * 0.071) + fi * 2.4 + u_seed),
      cos(t * (0.17 + fi * 0.093) + fi * 1.7)) * (0.45 + u_intensity * 0.35);
    float w = exp(-dot(p - c, p - c) * 6.0);
    acc += u_colors[i] * w;
    total += w;
  }
  return acc / total;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 screenUv = uv;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy)
    / min(u_resolution.x, u_resolution.y);

  uv = p * min(u_resolution.x, u_resolution.y) / u_resolution.xy + 0.5;
  p *= u_scale;
  if (abs(u_rotate) > 0.0001) {
    float cr = cos(u_rotate), sr = sin(u_rotate);
    p = mat2(cr, -sr, sr, cr) * p;
  }
  p += u_offset;
  if (u_drift > 0.0001)
    p += u_drift * vec2(sin(u_time * 0.31), cos(u_time * 0.23));
  if (u_warp > 0.0) {
    p += u_warp * (vec2(
      fbm(p * u_detail + u_seed),
      fbm(p * u_detail + vec2(5.2, 1.3))) - 0.5);
  }
  vec3 col = shade(uv, p, u_time);
  if (abs(u_contrast - 1.0) > 0.0001)
    col = (col - 0.5) * u_contrast + 0.5;
  if (abs(u_saturation - 1.0) > 0.0001) {
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(luma), col, u_saturation);
  }
  if (abs(u_hue) > 0.0001)
    col = hueRotate(col, u_hue);
  if (abs(u_brightness) > 0.0001)
    col += u_brightness;
  if (u_vignette > 0.0001) {
    float vd = length(screenUv - 0.5) * 1.41421356;
    col *= 1.0 - u_vignette * smoothstep(0.35, 1.0, vd);
  }
  if (u_grain > 0.0001)
    col += (grainHash(
      gl_FragCoord.xy + vec2(u_seed * 17.0, u_seed * 31.0)) - 0.5) * u_grain;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
  // fondo de la home: gradiente "mesh" con shader WebGL (colores de Zócalo)
  // Costo acotado: resolución reducida, 30 cuadros por segundo, pausa cuando no se ve y sin efecto de cursor.
  // Si WebGL no está disponible se queda el fondo de siempre. Para compararlo: agregar ?noshader a la dirección.
  const initHeroShader = () => {
    const canvas = $('#heroShader');
    if (!canvas || !hero || /[?&]noshader/.test(location.search)) return;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return;
    const compile = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, 'attribute vec2 a_position;void main(){gl_Position=vec4(a_position,0.0,1.0);}');
    const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(prog, n);
    // paleta Zócalo: negro azulado → índigo profundo → violeta #6C3BFF → celeste #00D4FF
    const colors = [[0.030, 0.030, 0.055], [0.085, 0.045, 0.320], [0.424, 0.231, 1.0], [0.0, 0.831, 1.0]];
    const flat = []; for (let i = 0; i < 8; i++) flat.push(...colors[Math.min(i, 3)]);
    gl.uniform3fv(U('u_colors'), new Float32Array(flat));
    gl.uniform4f(U('u_shape'), 1.15, 0.85, 0.67, 0.192);
    gl.uniform4f(U('u_surface'), 2.016, 1.04, 0.0, 1.15);
    gl.uniform4f(U('u_finish'), 0, 0.38, 0, 0.045);
    gl.uniform4f(U('u_transform'), 5069, 2.7227, 0.148, 0);
    gl.uniform4f(U('u_space'), 0.09, 0.15, 0, 0);
    gl.uniform4f(U('u_cursor'), 0, 0, 0, 0);
    const uScene = U('u_scene');
    const BUDGET = 650000, SPEED = -0.9;
    let w = 0, h = 0, raf = 0, inView = true, lastDraw = 0, shown = false;
    const t0 = performance.now();
    const fit = () => {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      const raw = Math.max(1, r.width * dpr * r.height * dpr), k = Math.min(1, Math.sqrt(BUDGET / raw));
      const nw = Math.max(1, Math.round(r.width * dpr * k)), nh = Math.max(1, Math.round(r.height * dpr * k));
      if (nw !== w || nh !== h) { w = canvas.width = nw; h = canvas.height = nh; gl.viewport(0, 0, w, h); }
    };
    const draw = now => {
      gl.uniform4f(uScene, w, h, ((now - t0) / 1000) * SPEED, 4);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!shown) { shown = true; hero.classList.add('has-shader'); }
    };
    const loop = now => {
      raf = 0;
      if (!inView || document.hidden) return;
      raf = requestAnimationFrame(loop);
      if (now - lastDraw < 32) return;        // 30 cuadros por segundo alcanzan: el movimiento es muy lento
      lastDraw = now; draw(now);
    };
    const kick = () => { fit(); if (reduceMotion) { draw(t0 + 4000); return; } if (!raf) raf = requestAnimationFrame(loop); };
    new ResizeObserver(() => { fit(); if (reduceMotion) draw(t0 + 4000); }).observe(canvas);
    new IntersectionObserver(([e]) => { inView = e.intersectionRatio > 0.2; if (inView) kick(); else if (raf) { cancelAnimationFrame(raf); raf = 0; } }, { threshold: [0, 0.2, 0.4] }).observe(canvas);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); hero.classList.remove('has-shader'); }, false);
    kick();
  };
  // arranca después de la pantalla de carga para no competir con su animación
  onReady(() => setTimeout(initHeroShader, 500));

  // logo de la home: tres bloques extruidos que giran, dibujados en un canvas 2D
  // (un solo elemento y ningún contexto 3D del navegador: sale igual de suave en cualquier equipo)
  const stage = $('#logo3d'), cv = $('#logoCanvas');
  if (stage && cv && cv.getContext) {
    const ctx = cv.getContext('2d');
    const rawStroke = (pts, w) => {
      const h = w / 2, n = pts.length, nrm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [-dy / l, dx / l]; };
      const L = [], R = [];
      for (let i = 0; i < n; i++) {
        let nx, ny, k = h;
        if (i === 0) [nx, ny] = nrm(pts[0], pts[1]);
        else if (i === n - 1) [nx, ny] = nrm(pts[n - 2], pts[n - 1]);
        else { const a = nrm(pts[i - 1], pts[i]), b = nrm(pts[i], pts[i + 1]); let mx = a[0] + b[0], my = a[1] + b[1]; const ml = Math.hypot(mx, my); mx /= ml; my /= ml; k = h / (mx * a[0] + my * a[1]); nx = mx; ny = my; }
        L.push([pts[i][0] + nx * k, pts[i][1] + ny * k]); R.push([pts[i][0] - nx * k, pts[i][1] - ny * k]);
      }
      return L.concat(R.reverse());
    };
    const CX = 569, CY = 555, D = 170, HD = D / 2;
    const CYAN = [0, 212, 255], VIOLET = [108, 59, 255], SHADOW = [38, 44, 150];
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
    const pieces = [
      { poly: rawStroke([[450, 90], [75, 480], [365, 775]], 100), T: 5.2, ph: 0 },
      { poly: [[512, 22], [625, 2], [690, 1085], [572, 1105]], T: 6.4, ph: 2.1 },
      { poly: rawStroke([[795, 365], [1065, 630], [725, 990]], 100), T: 5.8, ph: 3.6 }
    ].map(p => {
      p.poly = p.poly.map(([x, y]) => [x - CX, y - CY]);
      let area = 0;
      for (let i = 0; i < p.poly.length; i++) { const a = p.poly[i], b = p.poly[(i + 1) % p.poly.length]; area += a[0] * b[1] - b[0] * a[1]; }
      p.sign = area > 0 ? 1 : -1;       // sentido del recorrido, para sacar las normales hacia afuera
      return p;
    });

    let size = 0, dpr = 1, theta = -0.5, last = 0, running = false, visible = true;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = stage.getBoundingClientRect();
      size = r.width;
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    };
    new ResizeObserver(resize).observe(stage);
    resize();

    const TILT = -9 * Math.PI / 180, cT = Math.cos(TILT), sT = Math.sin(TILT);
    const PERSP = 3600, LIGHT = (() => { const l = [-0.45, -0.55, 0.7], m = Math.hypot(...l); return l.map(v => v / m); })();

    const draw = (time) => {
      const k = (size * 0.7 / 1138) * dpr, mid = size * dpr / 2;
      const cosA = Math.cos(theta), sinA = Math.sin(theta);
      ctx.clearRect(0, 0, cv.width, cv.height);
      const xf = (x, y, z) => {                       // rotación en Y + inclinación + perspectiva
        const x1 = x * cosA + z * sinA, z1 = -x * sinA + z * cosA;
        const y2 = y * cT - z1 * sT, z2 = y * sT + z1 * cT;
        const s = PERSP / (PERSP - z2);
        return [mid + x1 * s * k, mid + y2 * s * k, z2, x1, y2];
      };
      const rotN = (nx, ny, nz) => {
        const x1 = nx * cosA + nz * sinA, z1 = -nx * sinA + nz * cosA;
        return [x1, ny * cT - z1 * sT, ny * sT + z1 * cT];
      };
      const items = pieces.map(p => {
        const dy = -13 * (1 - Math.cos(2 * Math.PI * (time / 1000 + p.ph) / p.T));   // flotación suave
        const front = p.poly.map(([x, y]) => xf(x, y + dy, HD)), back = p.poly.map(([x, y]) => xf(x, y + dy, -HD));
        const faces = [];
        faces.push({ pts: front, n: [0, 0, 1], t: 'f' }); faces.push({ pts: back, n: [0, 0, -1], t: 'b' });
        const n = p.poly.length;
        for (let i = 0; i < n; i++) {
          const a = p.poly[i], b = p.poly[(i + 1) % n], ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey);
          const nx = p.sign * ey / l, ny = -p.sign * ex / l;
          faces.push({ pts: [front[i], front[(i + 1) % n], back[(i + 1) % n], back[i]], n: [nx, ny, 0], t: 's', pos: ((a[0] + b[0]) / 2 + CX) / 1138 * 0.6 + ((a[1] + b[1]) / 2 + CY) / 1111 * 0.4 });
        }
        let zsum = 0; faces.forEach(f => { f.z = f.pts.reduce((s, q) => s + q[2], 0) / f.pts.length; zsum += f.z; });
        return { faces, z: zsum / faces.length };
      }).sort((a, b) => a.z - b.z);

      items.forEach(it => {
        it.faces.sort((a, b) => a.z - b.z).forEach(f => {
          const nc = rotN(...f.n);
          const cx = f.pts.reduce((s, q) => s + q[3], 0) / f.pts.length, cy = f.pts.reduce((s, q) => s + q[4], 0) / f.pts.length;
          if (nc[0] * (0 - cx) + nc[1] * (0 - cy) + nc[2] * (PERSP - f.z) <= 0) return;    // cara de espaldas: no se dibuja
          const lit = Math.max(0, nc[0] * LIGHT[0] + nc[1] * LIGHT[1] + nc[2] * LIGHT[2]);
          const tone = 0.42 + 0.58 * lit;
          let fill;
          if (f.t === 's') fill = rgb(mix(SHADOW, mix(CYAN, VIOLET, f.pos), tone));
          else {
            const a = f.pts[0], b = f.pts[Math.floor(f.pts.length / 2)];
            const g = ctx.createLinearGradient(mid - 569 * k, mid - 555 * k, mid + 569 * k, mid + 555 * k);
            const base = f.t === 'f' ? 1 : 0.78;
            g.addColorStop(0, rgb(mix(SHADOW, [25, 196, 255], tone * base)));
            g.addColorStop(0.55, rgb(mix(SHADOW, [79, 107, 255], tone * base)));
            g.addColorStop(1, rgb(mix(SHADOW, [116, 72, 255], tone * base)));
            fill = g;
          }
          ctx.beginPath();
          f.pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]));
          ctx.closePath();
          ctx.fillStyle = fill; ctx.fill();
          ctx.lineWidth = Math.max(1, dpr * 0.8); ctx.lineJoin = 'round';
          ctx.strokeStyle = typeof fill === 'string' ? fill : rgb(mix(SHADOW, [79, 107, 255], tone)); ctx.stroke();   // contorno del mismo color: sin rendijas entre caras
        });
      });
    };

    const frame = now => {
      if (!running) return;
      if (!visible || document.hidden) { running = false; return; }
      requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      theta += dt * (2 * Math.PI / 11);
      draw(now);
    };
    const start = () => { if (running) return; running = true; last = performance.now(); requestAnimationFrame(frame); };
    draw(0);
    if (reduceMotion) { theta = -0.5; draw(0); }
    else {
      new IntersectionObserver(([e]) => { visible = e.intersectionRatio > 0.15; if (visible) start(); }, { threshold: [0, 0.15, 0.4] }).observe(stage);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
      start();
    }
  }

  const yr = $('#yr');
  if (yr) yr.textContent = new Date().getFullYear();
})();
