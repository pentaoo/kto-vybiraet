(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
  const mobileMQ = matchMedia('(max-width: 720px)');
  const $ = (s) => document.querySelector(s);

  /* =========================================================
     Данные
     ========================================================= */

  function cubic(p0, p1, p2, p3, n) {
    const out = [];
    for (let i = 1; i <= n; i++) {
      const t = i / n, m = 1 - t;
      out.push([
        m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0],
        m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1],
      ]);
    }
    return out;
  }

  const START = [140, 440];
  const MEET = [860, 100];
  const PARK_LOOP = cubic([400, 500], [400, 640], [600, 640], [600, 500], 48);

  // Все маршруты проходят по нарисованным улицам и дорожкам.
  const ROUTES = {
    fast:      { title: 'Самый быстрый',        pts: [START, [140, 320], [620, 320], MEET],                         bubble: [500, 320], meta: 'По Большому проспекту · Есть лестница' },
    calm:      { title: 'По тихим улицам',      pts: [START, [140, 100], MEET],                                      bubble: [300, 100], meta: 'Лесной пер. и Тихая ул. · Без лестниц' },
    nostairs:  { title: 'Без лестниц',          pts: [START, [140, 320], [860, 320], MEET],                         bubble: [860, 236], meta: 'По проспекту и Мостовой ул. · Без лестниц' },
    green:     { title: 'Через сквер',          pts: [START, [140, 500], [400, 500], ...PARK_LOOP, [620, 500], [620, 320], MEET], bubble: [500, 605], meta: 'Через сквер Ботаников · Есть лестница' },
    sit:       { title: 'Со скамейкой в сквере', pts: [START, [140, 500], [400, 500], ...PARK_LOOP, [620, 500], [620, 320], MEET], bubble: [500, 605], meta: 'Скамейка у пруда · Есть лестница', note: 'Время без учёта остановки' },
    buildings: { title: 'Мимо Дома с часами',   pts: [START, [140, 320], [380, 320], [380, 100], MEET],             bubble: [700, 100], meta: 'Ул. Мастеров, Дом с часами · Без лестниц' },
    people:    { title: 'Через площадь',        pts: [START, [140, 500], [620, 500], [620, 320], MEET],             bubble: [290, 500], meta: 'Через Рыночную площадь · Есть лестница' },
    coffee:    { title: 'Через кафе',           pts: [START, [140, 500], [380, 500], [380, 320], [620, 320], MEET], bubble: [380, 470], meta: 'Кафе «Зерно» по пути · Есть лестница', note: 'Время без учёта остановки' },
    books:     { title: 'Через книжный',        pts: [START, [140, 320], [620, 320], [620, 100], MEET],             bubble: [620, 160], meta: 'Книжный «Переплёт» по пути · Без лестниц', note: 'Время без учёта остановки' },
  };

  const polyLen = (p) => p.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - p[i][0], q[1] - p[i][1]), 0);
  const PX_PER_MIN = polyLen(ROUTES.fast.pts) / 18; // самый быстрый = 18 минут
  for (const id in ROUTES) {
    const r = ROUTES[id];
    r.len = polyLen(r.pts);
    r.min = Math.round(r.len / PX_PER_MIN);
    r.d = 'M' + r.pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
  }

  const TASKS = [
    { id: 'reach', label: 'Добраться до встречи', partial: 'Хочу добраться до встречи…', wishes: ['fast', 'calm', 'nostairs'] },
    { id: 'walk',  label: 'Прогуляться перед встречей', partial: 'Хочу прогуляться перед встречей…', wishes: ['green', 'buildings', 'people'] },
    { id: 'stop',  label: 'Остановиться где-нибудь по дороге', partial: 'Хочу остановиться где-нибудь по дороге…', wishes: ['coffee', 'sit', 'books'] },
  ];

  const WISHES = {
    fast: {
      label: 'Как можно быстрее', phrase: 'Хочу добраться до встречи как можно быстрее',
      want: 'добраться как можно быстрее', route: 'fast', match: true,
      first: 'В этот раз предложение карты совпало с твоим желанием.',
    },
    calm: {
      label: 'По спокойным улицам', phrase: 'Хочу дойти до встречи по спокойным улицам',
      want: 'дойти по спокойным улицам', route: 'calm', chose: 'дорогу по Тихой улице',
      but: 'идёт по оживлённому проспекту',
      first: 'Этот путь быстрее. Но проходит по оживлённой улице.',
      cmpLabel: 'Спокойнее', cmpWith: 'дорогой по спокойным улицам', cmpSay: 'Дорога по тихим улицам',
      hl: { type: 'seg', pts: [[140, 320], [620, 320]], tag: 'Оживлённый проспект', tagAt: [300, 284] },
    },
    nostairs: {
      label: 'Без лестниц', phrase: 'Хочу дойти до встречи без лестниц',
      want: 'дойти без лестниц', route: 'nostairs', chose: 'дорогу без лестниц',
      but: 'с лестницей на холме',
      first: 'В этом маршруте есть лестница. Твоё условие не было учтено.',
      cmpLabel: 'Без лестниц', cmpWith: 'дорогой без лестниц', cmpSay: 'Дорога без лестниц',
      hl: { type: 'seg', pts: [[704, 243], [800, 155]], tag: 'Лестница', tagAt: [818, 250] },
    },
    green: {
      label: 'Пройти через зелень', phrase: 'Хочу прогуляться через зелень перед встречей',
      want: 'пройти через зелень', route: 'green', chose: 'дорогу через сквер',
      but: 'сквер остаётся в стороне',
      first: 'Место встречи учтено. Желание пройти через зелень — нет.',
      hl: { type: 'place', c: [500, 585], r: 80, tag: 'Сквер', tagAt: [500, 512] },
    },
    buildings: {
      label: 'Посмотреть интересные здания', phrase: 'Хочу прогуляться перед встречей и посмотреть интересные здания',
      want: 'посмотреть интересные здания', route: 'buildings', chose: 'дорогу мимо Дома с часами',
      but: 'Дом с часами остаётся в стороне',
      first: 'Дом с часами — в квартале отсюда. Маршрут к нему не сворачивает.',
      hl: { type: 'place', c: [428, 176], r: 34, tag: 'Дом с часами', tagAt: [428, 130] },
    },
    people: {
      label: 'Побыть среди людей', phrase: 'Хочу прогуляться перед встречей и побыть среди людей',
      want: 'побыть среди людей', route: 'people', chose: 'дорогу через Рыночную площадь',
      but: 'площадь остаётся в стороне',
      first: 'Рыночная площадь рядом. Но маршрут обходит её стороной.',
      hl: { type: 'place', c: [620, 500], r: 58, tag: 'Рыночная площадь', tagAt: [470, 392] },
    },
    coffee: {
      label: 'Выпить кофе', phrase: 'Хочу выпить кофе по дороге на встречу',
      want: 'выпить кофе по дороге', route: 'coffee', chose: 'дорогу через кафе',
      but: 'кафе остаётся в стороне',
      first: 'Кафе рядом. Но маршрут к нему не ведёт.',
      hl: { type: 'place', c: [260, 474], r: 26, tag: 'Кафе', tagAt: [262, 538] },
    },
    sit: {
      label: 'Посидеть в сквере', phrase: 'Хочу посидеть в сквере по дороге на встречу',
      want: 'посидеть в сквере', route: 'sit', chose: 'дорогу со скамейкой в сквере',
      but: 'без остановки в сквере',
      first: 'Сквер в паре кварталов. Остановка в маршрут не попала.',
      hl: { type: 'place', c: [578, 632], r: 26, tag: 'Скамейка', tagAt: [546, 640], anchor: 'end' },
    },
    books: {
      label: 'Зайти в книжный', phrase: 'Хочу зайти в книжный по дороге на встречу',
      want: 'зайти в книжный', route: 'books', chose: 'дорогу через книжный',
      but: 'книжный остаётся в стороне',
      first: 'Книжный в двух шагах от поворота. Но маршрут туда не заходит.',
      hl: { type: 'place', c: [644, 252], r: 26, tag: 'Книжный', tagAt: [598, 252], anchor: 'end' },
    },
  };

  const MIN_FORMS = ['минута', 'минуты', 'минут'];
  const MIN_ACC = ['минуту', 'минуты', 'минут'];
  function plural(n, f) {
    const a = n % 100, b = n % 10;
    if (a >= 11 && a <= 14) return f[2];
    if (b === 1) return f[0];
    if (b >= 2 && b <= 4) return f[1];
    return f[2];
  }
  const minText = (n) => `${n} ${plural(n, MIN_FORMS)}`;
  const minAcc = (n) => `${n} ${plural(n, MIN_ACC)}`;

  /* =========================================================
     Состояние
     ========================================================= */

  const state = {
    task: null,          // выбранная задача
    wish: null,          // выбранное желание
    build: 'idle',       // idle | building | built | rebuilding
    considered: false,   // учтено ли желание (или построена альтернатива)
    compareOpen: false,  // ветка «быстрее»: открыт выбор другого приоритета
    compareWish: null,   // ветка «быстрее»: с каким приоритетом сравниваем
    active: 'fast',      // активная линия сравнения: fast | alt
    accepted: null,      // принятый вариант: fast | alt
    pulse: false,
    token: 0,
  };
  let rafId = 0;
  let timers = [];
  let scrolledToWish = false;

  const altWish = () => (state.wish === 'fast' ? state.compareWish : state.wish);
  const altRoute = () => (altWish() ? ROUTES[WISHES[altWish()].route] : null);
  const isMatch = () => state.wish === 'fast';
  const scrollOpts = () => ({ behavior: reduceMQ.matches ? 'auto' : 'smooth', block: 'start' });

  /* =========================================================
     SVG-хелперы
     ========================================================= */

  const svg = $('#mapSvg');
  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function text(parent, x, y, str, cls, extra) {
    const t = el('text', Object.assign({ x, y, class: cls }, extra || {}), parent);
    t.textContent = str;
    return t;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(20261002);

  const L = {};
  ['land', 'water', 'blocks', 'parks', 'casing', 'roads', 'paths', 'trees', 'labels', 'hlUnder', 'routes', 'pois', 'hlOver', 'bubbles', 'markers']
    .forEach((n) => (L[n] = el('g', { class: 'L-' + n }, svg)));

  /* =========================================================
     Подложка карты
     ========================================================= */

  const STREETS = [
    { pts: [[-200, -60], [950, -60]], w: 18, name: 'Северная ул.', lbl: [700, -60] },
    { pts: [[-200, 100], [950, 100]], w: 12, name: 'Тихая ул.', lbl: [[42, 100], [300, 100]] },
    { pts: [[-200, 320], [1300, 320]], w: 30, major: true, name: 'Большой проспект', lbl: [745, 320] },
    { pts: [[-200, 500], [950, 500]], w: 18, name: 'Садовая ул.', lbl: [790, 500] },
    { pts: [[140, -200], [140, 900]], w: 12, name: 'Лесной пер.', lbl: [140, 590], v: true },
    { pts: [[380, -200], [380, 900]], w: 18, name: 'ул. Мастеров', lbl: [380, 262], v: true },
    { pts: [[620, -200], [620, 900]], w: 12, name: 'Липовая ул.', lbl: [620, 425], v: true },
    { pts: [[860, -200], [860, 900]], w: 18, name: 'Мостовая ул.', lbl: [860, 420], v: true },
    { pts: [[950, -200], [950, 900]], w: 12, name: 'Речная наб.', lbl: [950, 560], v: true },
    { pts: [[380, 210], [620, 210]], w: 7, alley: true, name: 'Часовой пер.', lbl: [560, 210] },
    { pts: [[500, 100], [500, 210]], w: 7, alley: true },
    { pts: [[620, 410], [860, 410]], w: 7, alley: true, name: 'Глухой пер.', lbl: [740, 410] },
    { pts: [[740, 500], [740, 900]], w: 7, alley: true },
    { pts: [[-200, 210], [140, 210]], w: 7, alley: true },
    { pts: [[260, -200], [260, 100]], w: 7, alley: true },
  ];

  function drawBase() {
    el('rect', { x: -300, y: -300, width: 1700, height: 1300, fill: '#f3f1ec' }, L.land);

    // Река
    el('path', { d: 'M985 -300 C 958 -40, 1004 140, 978 300 S 958 560, 986 900 L 1400 900 L 1400 -300 Z', fill: '#a9d4f3' }, L.water);
    text(L.water, 0, 0, 'р. Светлая', 'water-lbl', { transform: 'translate(1040 470) rotate(90)', 'text-anchor': 'middle' });

    // Кварталы и дома
    const xs = [-200, 140, 380, 620, 860, 950];
    const ys = [-200, -60, 100, 320, 500, 900];
    const hw = (v) => ({ '-200': 0, 140: 6, 380: 9, 620: 6, 860: 9, 950: 6, '-60': 9, 100: 6, 320: 15, 500: 9, 900: 0 }[v] || 0);
    const obstacles = STREETS.filter((s) => s.alley).map((s) => {
      const [a, b] = s.pts, pad = 9;
      return [Math.min(a[0], b[0]) - pad, Math.min(a[1], b[1]) - pad, Math.abs(b[0] - a[0]) + pad * 2, Math.abs(b[1] - a[1]) + pad * 2];
    });
    obstacles.push([386, 138, 92, 70]);   // Дом с часами
    obstacles.push([228, 446, 64, 46]);   // кафе
    const hitObstacle = (r) =>
      obstacles.some((o) => r[0] < o[0] + o[2] && r[0] + r[2] > o[0] && r[1] < o[1] + o[3] && r[1] + r[3] > o[1]) ||
      Math.hypot(Math.max(r[0], Math.min(620, r[0] + r[2])) - 620, Math.max(r[1], Math.min(500, r[1] + r[3])) - 500) < 54;

    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < ys.length - 1; j++) {
        const cx0 = xs[i], cx1 = xs[i + 1], cy0 = ys[j], cy1 = ys[j + 1];
        if (cx0 === 380 && cy0 === 500) continue; // сквер
        if (cx0 === 620 && cy0 === 100) continue; // холм
        const x0 = cx0 + hw(cx0) + 6, x1 = cx1 - hw(cx1) - 6;
        const y0 = cy0 + hw(cy0) + 6, y1 = cy1 - hw(cy1) - 6;
        genBlock(x0, y0, x1, y1).forEach((r) => {
          if (hitObstacle(r) || rnd() < 0.05) return;
          el('rect', { x: r[0].toFixed(1), y: r[1].toFixed(1), width: r[2].toFixed(1), height: r[3].toFixed(1), rx: 1.5,
            fill: rnd() < 0.5 ? '#e4e0d9' : '#e9e5de', stroke: '#d8d3ca', 'stroke-width': 0.8 }, L.blocks);
        });
      }
    }

    // Дом с часами — особое здание
    el('path', { d: 'M392 146 h70 v26 h-34 v32 h-36 z', fill: '#e3dcec', stroke: '#cdc3dd', 'stroke-width': 1 }, L.blocks);
    el('circle', { cx: 410, cy: 186, r: 11, fill: '#ddd4ea', stroke: '#cdc3dd' }, L.blocks);
    // Кафе
    el('rect', { x: 232, y: 452, width: 56, height: 36, rx: 2, fill: '#f1e3d3', stroke: '#e3cfb8', 'stroke-width': 1 }, L.blocks);

    // Сквер
    el('rect', { x: 389, y: 509, width: 225, height: 400, rx: 6, fill: '#cfe9c1' }, L.parks);
    el('ellipse', { cx: 500, cy: 550, rx: 46, ry: 19, fill: '#a9d4f3' }, L.parks);
    // Холм с лестницей
    const clip = el('clipPath', { id: 'hillClip' }, el('defs', null, svg));
    el('rect', { x: 626, y: 106, width: 225, height: 199, rx: 4 }, clip);
    el('rect', { x: 626, y: 106, width: 225, height: 199, rx: 4, fill: '#e4ecd8' }, L.parks);
    const contours = el('g', { 'clip-path': 'url(#hillClip)', fill: 'none', stroke: '#d2dcc4', 'stroke-width': 1.2 }, L.parks);
    [[170, 120], [125, 86], [82, 56], [42, 28]].forEach(([rx, ry]) => el('ellipse', { cx: 812, cy: 150, rx, ry }, contours));

    // Улицы
    STREETS.forEach((s) => {
      const d = 'M' + s.pts.map((p) => p.join(' ')).join(' L');
      el('path', { d, fill: 'none', stroke: s.alley ? '#e2ddd3' : '#d9d4ca', 'stroke-width': s.w + 3 }, L.casing);
      el('path', { d, fill: 'none', stroke: s.major ? '#fff5d6' : '#ffffff', 'stroke-width': s.w }, L.roads);
    });
    // разметка проспекта
    el('path', { d: 'M-200 320 L1300 320', stroke: '#f1deaa', 'stroke-width': 1.2, 'stroke-dasharray': '14 10', fill: 'none' }, L.roads);
    // мост
    el('path', { d: 'M972 303 L1060 303 M972 337 L1060 337', stroke: '#b9b3a8', 'stroke-width': 2, fill: 'none' }, L.roads);

    // Дорожки сквера
    const parkPath = 'M' + [[400, 500], ...PARK_LOOP].map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
    [parkPath, 'M389 668 L614 668', 'M500 605 L500 900'].forEach((d) => {
      el('path', { d, fill: 'none', stroke: '#b8d9a6', 'stroke-width': 8, 'stroke-linecap': 'round' }, L.paths);
      el('path', { d, fill: 'none', stroke: '#fbfaf5', 'stroke-width': 5, 'stroke-linecap': 'round' }, L.paths);
    });

    // Лестница на холме
    el('path', { d: 'M620 320 L860 100', fill: 'none', stroke: '#d6d0c5', 'stroke-width': 12, 'stroke-linecap': 'round' }, L.paths);
    el('path', { d: 'M620 320 L860 100', fill: 'none', stroke: '#fbfaf5', 'stroke-width': 9, 'stroke-linecap': 'round' }, L.paths);
    const dir = [240 / 325.6, -220 / 325.6], nrm = [220 / 325.6, 240 / 325.6];
    let hatch = '';
    for (let t = 0.35; t <= 0.751; t += 0.028) {
      const px = 620 + 240 * t, py = 320 - 220 * t;
      hatch += `M${(px - nrm[0] * 6).toFixed(1)} ${(py - nrm[1] * 6).toFixed(1)} L${(px + nrm[0] * 6).toFixed(1)} ${(py + nrm[1] * 6).toFixed(1)} `;
    }
    void dir;
    el('path', { d: hatch, stroke: '#a59e92', 'stroke-width': 1.6, fill: 'none' }, L.paths);

    // Рыночная площадь
    el('circle', { cx: 620, cy: 500, r: 46, fill: '#efebe3', stroke: '#ddd6ca', 'stroke-width': 1.5 }, L.paths);
    el('circle', { cx: 620, cy: 500, r: 30, fill: 'none', stroke: '#e3ddd2', 'stroke-width': 1, 'stroke-dasharray': '3 4' }, L.paths);
    el('circle', { cx: 620, cy: 500, r: 11, fill: '#a9d4f3', stroke: '#fff', 'stroke-width': 2 }, L.paths);

    // Деревья
    const trees = (pts, fill) => pts.forEach(([x, y, r]) => el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: r.toFixed(1), fill }, L.trees));
    const avenueTrees = [];
    for (let x = -20; x <= 945; x += 22) {
      if ([140, 260, 380, 500, 620, 860].some((v) => Math.abs(x - v) < 15)) continue;
      avenueTrees.push([x, 90.5, 3.8], [x + 11, 109.5, 3.8]);
    }
    trees(avenueTrees, '#bddda9');
    const near = (x, y, segs, d) => segs.some(([a, b]) => distSeg([x, y], a, b) < d);
    const parkSegs = [[400, 500], ...PARK_LOOP].slice(1).map((p, i, arr) => [i ? arr[i - 1] : [400, 500], p])
      .concat([[[389, 668], [614, 668]], [[500, 605], [500, 900]]]);
    const parkTrees = [];
    for (let k = 0; k < 140; k++) {
      const x = 396 + rnd() * 212, y = 516 + rnd() * 190;
      if (near(x, y, parkSegs, 13)) continue;
      if (((x - 500) / 58) ** 2 + ((y - 550) / 28) ** 2 < 1) continue;
      if (Math.hypot(x - 578, y - 632) < 20) continue;
      parkTrees.push([x, y, 5 + rnd() * 4]);
    }
    trees(parkTrees, '#b3d99d');
    const hillTrees = [];
    for (let k = 0; k < 70; k++) {
      const x = 632 + rnd() * 214, y = 112 + rnd() * 188;
      if (distSeg([x, y], [620, 320], [860, 100]) < 18) continue;
      if (Math.hypot(x - 644, y - 252) < 22 || Math.hypot(x - 722, y - 170) < 26) continue;
      hillTrees.push([x, y, 4 + rnd() * 4]);
    }
    trees(hillTrees, '#c3dcb0');

    // Подписи
    STREETS.forEach((s) => {
      if (!s.name) return;
      const list = Array.isArray(s.lbl[0]) ? s.lbl : [s.lbl];
      list.forEach(([x, y]) => {
        const cls = 'st-lbl' + (s.major ? ' major' : '') + (s.alley ? ' alley' : '');
        text(L.labels, 0, 0, s.name, cls, {
          transform: `translate(${x} ${y}) rotate(${s.v ? -90 : 0})`,
          'text-anchor': 'middle', 'dominant-baseline': 'central',
        });
      });
    });
    text(L.labels, 470, 657, 'Сквер Ботаников', 'area-lbl', { 'text-anchor': 'middle' });

    // Места
    poi(260, 474, '#ff9500', 'cup', 'Кафе «Зерно»', 'right');
    poi(644, 252, '#a2845e', 'book', 'Книжный «Переплёт»', 'right');
    poi(428, 176, '#8e6ccf', 'landmark', 'Дом с часами', 'right');
    poi(586, 460, '#5e5ce6', 'people', 'Рыночная пл.', 'left');
    poi(722, 170, '#8e8e93', 'stairs', 'Лестница', 'left', 'hide-m');
    poi(578, 632, '#34c759', 'bench', 'Скамейка', 'none');

    // Маркеры начала и встречи
    const s = el('g', { transform: `translate(${START[0]} ${START[1]})` }, L.markers);
    const si = el('g', { class: 'scale-m' }, s);
    el('circle', { r: 24, fill: 'rgba(0,122,255,0.14)' }, si);
    el('circle', { r: 10.5, fill: '#007aff', stroke: '#fff', 'stroke-width': 3.5 }, si);
    text(si, 20, 5, 'Отсюда', 'mk-lbl');

    const m = el('g', { transform: `translate(${MEET[0]} ${MEET[1]})` }, L.markers);
    const mi = el('g', { class: 'scale-m' }, m);
    el('ellipse', { cx: 0, cy: 0, rx: 7, ry: 2.6, fill: 'rgba(0,0,0,0.18)' }, mi);
    el('path', { d: 'M0 0 C -4 -9, -14 -16, -14 -26 A 14 14 0 0 1 14 -26 C 14 -16, 4 -9, 0 0 Z', fill: '#ff3b30', stroke: '#fff', 'stroke-width': 2.5 }, mi);
    el('circle', { cx: 0, cy: -26, r: 5, fill: '#fff' }, mi);
    text(mi, -20, -22, 'Место встречи', 'mk-lbl', { 'text-anchor': 'end' });
  }

  function genBlock(x0, y0, x1, y1) {
    const w = x1 - x0, h = y1 - y0, out = [];
    if (w < 24 || h < 24) return out;
    const d = Math.min(30, w / 2.4, h / 2.4);
    for (const top of [true, false]) {
      let x = x0;
      while (x < x1 - 6) {
        let len = 24 + rnd() * 40;
        if (x + len > x1 - 16) len = x1 - x;
        const dep = d * (0.78 + rnd() * 0.22);
        out.push([x, top ? y0 : y1 - dep, len - 3, dep]);
        x += len;
      }
    }
    if (h > d * 2 + 16) {
      for (const left of [true, false]) {
        let y = y0 + d + 3;
        while (y < y1 - d - 6) {
          let len = 22 + rnd() * 36;
          if (y + len > y1 - d - 14) len = y1 - d - 3 - y;
          const dep = d * (0.78 + rnd() * 0.22);
          if (len > 6) out.push([left ? x0 : x1 - dep, y, dep, len - 3]);
          y += len;
        }
      }
    }
    if (w > 120 && h > 110 && rnd() < 0.7) {
      out.push([x0 + d + 12 + rnd() * 16, y0 + d + 12 + rnd() * 12, 22 + rnd() * 22, 16 + rnd() * 18]);
    }
    return out;
  }

  function distSeg(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }

  const GLYPHS = {
    cup: (g) => {
      el('path', { d: 'M-5.5 -4 h9 v4.5 a4.5 4.5 0 0 1 -4.5 4.5 a4.5 4.5 0 0 1 -4.5 -4.5 z', fill: '#fff' }, g);
      el('path', { d: 'M3.5 -2.5 h1.6 a2.2 2.2 0 0 1 0 4.4 h-1.6', fill: 'none', stroke: '#fff', 'stroke-width': 1.6 }, g);
    },
    book: (g) => el('path', { d: 'M-6.5 -5 h5 q1.5 0 1.5 1.5 v9.5 q0 -1.5 -1.5 -1.5 h-5 z M6.5 -5 h-5 q-1.5 0 -1.5 1.5 v9.5 q0 -1.5 1.5 -1.5 h5 z', fill: '#fff' }, g),
    landmark: (g) => {
      el('path', { d: 'M-5 6.5 v-8 l5 -5 l5 5 v8 z', fill: '#fff' }, g);
      el('circle', { cx: 0, cy: 0, r: 2.2, fill: '#8e6ccf' }, g);
    },
    people: (g) => {
      el('circle', { cx: -3.2, cy: -3, r: 2.4, fill: '#fff' }, g);
      el('circle', { cx: 3.6, cy: -2.2, r: 2.1, fill: '#fff' }, g);
      el('path', { d: 'M-7.2 5.8 a4 4 0 0 1 8 0 z M0.6 5.8 a3.4 3.4 0 0 1 6.8 0 z', fill: '#fff' }, g);
    },
    stairs: (g) => el('path', { d: 'M-6.5 5.5 h3.2 v-3.4 h3.2 v-3.4 h3.2 v-3.4 h3.4', fill: 'none', stroke: '#fff', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g),
    bench: (g) => el('path', { d: 'M-6.5 -1.5 h13 M-6.5 2 h13 M-4.5 2 v4 M4.5 2 v4 M-6.5 -4.5 h13', fill: 'none', stroke: '#fff', 'stroke-width': 1.8, 'stroke-linecap': 'round' }, g),
    tree: (g) => {
      el('circle', { cx: 0, cy: -2, r: 5, fill: '#fff' }, g);
      el('rect', { x: -1, y: 2, width: 2, height: 5, fill: '#fff' }, g);
    },
  };

  function poi(x, y, color, glyph, label, side, extra) {
    const g = el('g', { transform: `translate(${x} ${y})` }, L.pois);
    const i = el('g', { class: 'scale-m' }, g);
    el('circle', { r: 11.5, fill: color, stroke: '#fff', 'stroke-width': 2 }, i);
    GLYPHS[glyph](i);
    if (label && side !== 'none') {
      text(i, side === 'left' ? -17 : 17, 4.5, label, 'poi-lbl' + (extra ? ' ' + extra : ''), { fill: shade(color), 'text-anchor': side === 'left' ? 'end' : 'start' });
    }
  }
  function shade(hex) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.round(v * 0.72).toString(16).padStart(2, '0');
    return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255);
  }

  /* =========================================================
     Маршруты и анимация
     ========================================================= */

  const lines = { fast: null, alt: null };

  function makeRoute(routeId) {
    const g = el('g', { class: 'route' }, L.routes);
    const d = ROUTES[routeId].d;
    el('path', { d, class: 'r-case' }, g);
    el('path', { d, class: 'r-main' }, g);
    return g;
  }

  function later(ms, token) {
    return new Promise((res) => {
      const id = setTimeout(() => res(token === state.token), reduceMQ.matches ? 0 : ms);
      timers.push(id);
    });
  }

  function drawLine(g, token, duration) {
    const paths = [...g.querySelectorAll('path')];
    const len = paths[0].getTotalLength();
    const finish = () => paths.forEach((p) => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; });
    paths.forEach((p) => { p.style.strokeDasharray = `${len} ${len}`; p.style.strokeDashoffset = len; });
    if (reduceMQ.matches) { finish(); return Promise.resolve(true); }
    return new Promise((res) => {
      const t0 = performance.now();
      let done = false;
      const end = (ok) => { if (done) return; done = true; cancelAnimationFrame(rafId); if (ok) finish(); res(ok); };
      const step = (now) => {
        if (done) return;
        if (token !== state.token) return end(false);
        const t = Math.min(1, (now - t0) / duration);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        paths.forEach((p) => (p.style.strokeDashoffset = len * (1 - e)));
        if (t < 1) rafId = requestAnimationFrame(step);
        else end(true);
      };
      rafId = requestAnimationFrame(step);
      // если вкладка в фоне и кадры не приходят — завершаем по таймеру
      timers.push(setTimeout(() => end(token === state.token), duration + 300));
    });
  }

  function cancelAll() {
    state.token++;
    cancelAnimationFrame(rafId);
    timers.forEach(clearTimeout);
    timers = [];
  }

  function resetRoute() {
    cancelAll();
    Object.assign(state, { build: 'idle', considered: false, compareOpen: false, compareWish: null, active: 'fast', accepted: null, pulse: false });
    L.routes.textContent = '';
    lines.fast = lines.alt = null;
  }

  async function buildRoute() {
    if (!state.wish || state.build !== 'idle') return;
    const token = state.token;
    state.build = 'building';
    lines.fast = makeRoute('fast');
    renderAll();
    if (!(await drawLine(lines.fast, token, 1000))) return;
    if (!(await later(120, token))) return;
    state.build = 'built';
    state.pulse = true;
    renderAll();
    state.pulse = false;
  }

  async function considerWish() {
    if (state.build !== 'built' || !altWish()) return;
    const token = state.token;
    state.build = 'rebuilding';
    state.accepted = null;
    state.compareOpen = false;
    if (lines.alt) lines.alt.remove();
    lines.alt = makeRoute(WISHES[altWish()].route);
    lines.fast.classList.add('is-alt');
    renderAll();
    if (!(await drawLine(lines.alt, token, 1100))) return;
    if (!(await later(100, token))) return;
    state.build = 'built';
    state.considered = true;
    state.active = 'alt';
    renderAll();
  }

  function setActive(which) {
    if (!state.considered || state.build !== 'built') return;
    state.active = which;
    state.accepted = null;
    renderAll();
  }

  function accept() {
    if (state.build !== 'built') return;
    state.accepted = state.considered ? state.active : 'fast';
    renderAll();
    later(60, state.token).then((ok) => ok && $('#final').scrollIntoView(scrollOpts()));
  }

  /* =========================================================
     Рендер
     ========================================================= */

  function renderChoices() {
    const tc = $('#taskChoices');
    if (!tc.childElementCount) {
      TASKS.forEach((t) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'choice';
        b.dataset.id = t.id;
        b.textContent = `«${t.label}»`;
        b.addEventListener('click', () => selectTask(t.id));
        tc.appendChild(b);
      });
    }
    tc.querySelectorAll('.choice').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === state.task)));

    const wc = $('#wishChoices');
    const task = TASKS.find((t) => t.id === state.task);
    $('#wishEmpty').hidden = !!task;
    if (wc.dataset.task !== (state.task || '')) {
      wc.textContent = '';
      wc.dataset.task = state.task || '';
      if (task) {
        task.wishes.forEach((id) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'choice fade-in';
          b.dataset.id = id;
          b.textContent = `«${WISHES[id].label}»`;
          b.addEventListener('click', () => selectWish(id));
          wc.appendChild(b);
        });
      }
    }
    wc.querySelectorAll('.choice').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === state.wish)));

    const pw = $('#phraseWrap');
    pw.hidden = !state.wish;
    if (state.wish) $('#phrase').textContent = `«${WISHES[state.wish].phrase}»`;
  }

  function renderIntent() {
    const t = $('#intentText');
    if (state.wish) t.textContent = `«${WISHES[state.wish].phrase}»`;
    else if (state.task) t.innerHTML = `«${TASKS.find((x) => x.id === state.task).partial}» — <a href="#wish">уточнить</a>`;
    else t.innerHTML = 'ещё не выбрано — <a href="#task">выбрать</a>';
  }

  function renderPanel() {
    const b = $('#buildBtn');
    if (!state.wish) { b.disabled = true; b.textContent = 'Сначала выбери желание'; }
    else if (state.build === 'idle') { b.disabled = false; b.textContent = 'Построить маршрут'; }
    else if (state.build === 'building') { b.disabled = true; b.textContent = 'Строим…'; }
    else { b.disabled = true; b.textContent = 'Маршрут построен'; }
  }

  function renderTitle() {
    let t = 'Что предложит карта?';
    if (state.accepted) t = 'Дорога выбрана';
    else if (state.considered || state.build === 'rebuilding') t = 'Две дороги к одной встрече';
    else if (state.build === 'built') t = 'Карта выбрала по времени';
    $('#mapTitle').textContent = t;
  }

  function currentRouteId() {
    if (state.considered && state.active === 'alt') return WISHES[altWish()].route;
    return 'fast';
  }

  function renderCard() {
    const card = $('#routeCard');
    const seg = $('#seg');
    const shown = state.build === 'built' || state.build === 'rebuilding';
    card.classList.toggle('is-empty', !shown);
    if (shown) {
      if (state.build === 'rebuilding') {
        $('#rcTitle').textContent = 'Перестраиваем маршрут…';
        $('#rcMeta').textContent = `Учитываем: ${WISHES[altWish()].label.toLowerCase()}`;
      } else {
        const r = ROUTES[currentRouteId()];
        $('#rcTitle').textContent = `${r.title} · ${minText(r.min)}`;
        $('#rcMeta').textContent = r.meta + (r.note ? ` · ${r.note}` : '');
      }
    }
    seg.hidden = !state.considered;
    const [fb, ab] = seg.querySelectorAll('.seg-btn');
    ab.textContent = isMatch() && state.compareWish ? WISHES[state.compareWish].cmpLabel : 'По моему замыслу';
    fb.setAttribute('aria-checked', String(state.active === 'fast'));
    ab.setAttribute('aria-checked', String(state.active === 'alt'));
    [fb, ab].forEach((b) => {
      b.disabled = !state.considered || state.build !== 'built';
      b.tabIndex = b.getAttribute('aria-checked') === 'true' ? 0 : -1;
    });
  }

  function bubble(routeId, active, sub) {
    const r = ROUTES[routeId];
    const [x, y] = r.bubble;
    const g = el('g', { class: 'bub hl-in' + (active ? ' is-active' : ''), transform: `translate(${x} ${y})` }, L.bubbles);
    const i = el('g', { class: 'scale-m' }, g);
    const inner = el('g', { class: 'bub-i' }, i);
    const rect = el('rect', { rx: 9, ry: 9, height: sub ? 40 : 28 }, inner);
    const h = sub ? 40 : 28;
    el('path', { d: 'M-6 -9.5 L0 -2 L6 -9.5 Z' }, inner);
    const t1 = text(inner, 0, sub ? -h - 10 + 18 : -h - 10 + 19, `${r.min} мин`, '', { 'text-anchor': 'middle' });
    let w = t1.getBBox().width;
    if (sub) {
      const t2 = text(inner, 0, -h - 10 + 33, sub, 'bub-sub', { 'text-anchor': 'middle' });
      w = Math.max(w, t2.getBBox().width);
    }
    w += 22;
    rect.setAttribute('x', -w / 2);
    rect.setAttribute('y', -h - 10);
    rect.setAttribute('width', w);
  }

  function renderOverlays() {
    L.bubbles.textContent = '';
    L.hlUnder.textContent = '';
    L.hlOver.textContent = '';

    // Линии: активная поверх, другая — тонкая пунктирная
    if (lines.fast && state.build !== 'rebuilding') {
      const fastActive = !state.considered || state.active === 'fast';
      lines.fast.classList.toggle('is-alt', !fastActive);
      if (lines.alt) lines.alt.classList.toggle('is-alt', fastActive);
      if (lines.alt) L.routes.appendChild(fastActive ? lines.fast : lines.alt);
    }

    if (state.build !== 'built') return;

    // Подписи времени
    const fastActive = !state.considered || state.active === 'fast';
    if (state.considered) {
      const altId = WISHES[altWish()].route;
      bubble('fast', fastActive, 'Быстрее');
      bubble(altId, !fastActive, isMatch() ? WISHES[state.compareWish].cmpLabel : 'Твой замысел');
      L.bubbles.appendChild(L.bubbles.children[fastActive ? 0 : 1]);
    } else {
      bubble('fast', true, 'Быстрее');
    }

    // Подсветка проигнорированного желания
    const w = WISHES[state.wish];
    if (!w.hl) return;
    const hl = w.hl;
    const ok = state.considered && state.active === 'alt';
    if (hl.type === 'seg') {
      if (ok) return;
      el('path', { d: 'M' + hl.pts.map((p) => p.join(' ')).join(' L'), class: 'hl-seg hl-in' }, L.hlUnder);
      tag(hl.tagAt, hl.tag, 'miss', hl.anchor);
    } else {
      const g = el('g', { class: `hl hl-in ${ok ? 'ok' : 'miss'}${state.pulse ? ' first' : ''}` }, L.hlOver);
      el('circle', { cx: hl.c[0], cy: hl.c[1], r: hl.r, class: 'hl-ring' }, g);
      el('circle', { cx: hl.c[0], cy: hl.c[1], r: hl.r, class: 'hl-pulse' }, g);
      tag(hl.tagAt, `${hl.tag} · ${ok ? 'по пути ✓' : 'не по пути'}`, ok ? 'ok' : 'miss', hl.anchor, g);
    }
  }

  function tag([x, y], str, kind, anchor, parent) {
    const host = parent || el('g', { class: `hl hl-in ${kind}` }, L.hlOver);
    const g = el('g', { class: 'tag', transform: `translate(${x} ${y})` }, host);
    const i = el('g', { class: 'scale-m' }, g);
    const rect = el('rect', { rx: 12, height: 24, y: -12 }, i);
    const t = text(i, 0, 4.6, str, '', { 'text-anchor': 'middle' });
    const w = t.getBBox().width + 20;
    const x0 = anchor === 'end' ? -w : anchor === 'start' ? 0 : -w / 2;
    rect.setAttribute('x', x0);
    rect.setAttribute('width', w);
    t.setAttribute('x', x0 + w / 2);
  }

  function renderExplain() {
    const ex = $('#explain');
    const q = $('#question');
    let s = '', hint = false, question = '';
    const fast = ROUTES.fast;
    if (!state.wish) { s = 'Выбери желание выше — и построй маршрут.'; hint = true; }
    else if (state.build === 'idle') { s = 'Нажми «Построить маршрут» на карте.'; hint = true; }
    else if (state.build === 'built') {
      const w = WISHES[state.wish];
      if (!state.considered) s = w.first;
      else {
        const diff = altRoute().min - fast.min;
        if (isMatch()) {
          const cw = WISHES[state.compareWish];
          s = state.active === 'alt'
            ? `${cw.cmpSay} займёт на ${minAcc(diff)} больше.`
            : `Самый быстрый путь на ${minAcc(diff)} короче — и совпадает с твоим желанием.`;
        } else {
          s = state.active === 'alt'
            ? `Теперь маршрут учитывает, какой дороги ты хотел. Она займёт на ${minAcc(diff)} больше.`
            : `Самый быстрый путь на ${minAcc(diff)} короче, но ${w.but}.`;
        }
        if (!state.accepted) question = 'Этот путь ближе к твоему замыслу?';
      }
    }
    if (ex.textContent !== s) {
      ex.textContent = s;
      ex.classList.remove('fade-in');
      if (s && !hint) { void ex.offsetWidth; ex.classList.add('fade-in'); }
    }
    ex.classList.toggle('is-hint', hint);
    q.textContent = question;
  }

  function button(label, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-tint fade-in';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function renderActions() {
    const box = $('#actions');
    const prevFocus = document.activeElement && box.contains(document.activeElement) ? document.activeElement.textContent : null;
    box.textContent = '';
    if (state.build !== 'built') return;

    if (state.accepted) {
      const r = ROUTES[currentRouteId()];
      const note = document.createElement('p');
      note.className = 'note fade-in';
      note.textContent = `Ты выбрал: ${r.title.toLowerCase()} · ${minText(r.min)}.`;
      box.append(note, button('Посмотреть итог', () => $('#final').scrollIntoView(scrollOpts())));
      if (state.considered) box.append(button('Выбрать другой вариант', () => setActive(state.active === 'fast' ? 'alt' : 'fast')));
      else if (isMatch()) box.append(button('Сравнить с другим приоритетом', () => { state.accepted = null; state.compareOpen = true; renderAll(); }));
      else box.append(button('Учесть моё желание', considerWish));
    } else if (state.considered) {
      box.append(
        button('Оставить этот маршрут', accept),
        button('Выбрать другой вариант', () => setActive(state.active === 'fast' ? 'alt' : 'fast')),
      );
    } else if (isMatch()) {
      if (state.compareOpen) {
        const note = document.createElement('p');
        note.className = 'note fade-in';
        note.textContent = 'С каким приоритетом сравнить?';
        box.append(note);
        ['calm', 'nostairs'].forEach((id) => box.append(button(`«${WISHES[id].label}»`, () => { state.compareWish = id; considerWish(); })));
      } else {
        box.append(
          button('Оставить этот маршрут', accept),
          button('Сравнить с другим приоритетом', () => { state.compareOpen = true; renderAll(); focusFirstAction(); }),
        );
      }
    } else {
      box.append(button('Учесть моё желание', considerWish), button('Оставить этот маршрут', accept));
    }

    if (prevFocus) {
      const same = [...box.querySelectorAll('button')].find((b) => b.textContent === prevFocus);
      (same || box.querySelector('button'))?.focus({ preventScroll: true });
    }
  }
  function focusFirstAction() { $('#actions button')?.focus({ preventScroll: true }); }

  function renderFinal() {
    const box = $('#storyBox');
    box.textContent = '';
    if (state.accepted && state.wish) {
      const w = WISHES[state.wish];
      const steps = [`Ты хотел ${w.want}`, 'карта предложила самый быстрый путь'];
      if (isMatch()) {
        steps.push('это совпало с твоим желанием');
        if (state.considered) {
          steps.push(`ты сравнил его с ${WISHES[state.compareWish].cmpWith}`);
          steps.push(state.accepted === 'alt' ? `выбрал ${WISHES[state.compareWish].chose}` : 'оставил самый быстрый');
        } else steps.push('ты оставил его');
      } else if (state.considered) {
        steps.push('ты попросил учесть своё желание');
        steps.push(state.accepted === 'alt' ? `выбрал ${w.chose}` : 'сравнил и оставил самый быстрый путь');
      } else {
        steps.push('ты оставил его');
      }
      const p = document.createElement('p');
      p.className = 'story fade-in';
      steps.forEach((s, i) => {
        if (i) { const a = document.createElement('span'); a.className = 'arr'; a.textContent = ' → '; p.append(a); }
        p.append(document.createTextNode(s));
      });
      p.append(document.createTextNode('.'));
      const r = ROUTES[currentRouteId()];
      const meta = document.createElement('p');
      meta.className = 'story-meta fade-in';
      meta.textContent = `Твой маршрут: ${r.title.toLowerCase()} · ${minText(r.min)}.`;
      box.append(p, meta);
    } else {
      [
        'Привычная карта спрашивает о двух вещах: откуда и куда. Всё остальное — настроение, свободное время, желание куда-то заглянуть — не помещается в эти поля.',
        'Поэтому первый маршрут строится по критерию, который система считает главным, — по времени. Иногда он совпадает с тем, чего ты хотел. Иногда — нет.',
      ].forEach((s) => {
        const p = document.createElement('p');
        p.className = 'general';
        p.textContent = s;
        box.append(p);
      });
    }

    const triad = $('#triad');
    const want = state.wish ? `«${WISHES[state.wish].phrase}»` : 'Свободный вечер, настроение, место по пути';
    triad.innerHTML = '';
    [['t-want', 'Чего ты хотел', want], ['t-said', 'Что услышал интерфейс', '«Отсюда → Место встречи»'], ['t-crit', 'По какому критерию выбрала карта', 'Самое короткое время']]
      .forEach(([cls, dt, dd]) => {
        const d = document.createElement('div');
        d.className = cls;
        const a = document.createElement('dt'); a.textContent = dt;
        const b = document.createElement('dd'); b.textContent = dd;
        d.append(a, b);
        triad.append(d);
      });
  }

  function renderDesc() {
    let s = 'Условная карта района: начало пути, место встречи, Большой проспект, Тихая улица, сквер, кафе, книжный, Дом с часами, Рыночная площадь и лестница на холме.';
    if (state.build === 'built') {
      const r = ROUTES[currentRouteId()];
      s += ` Активный маршрут: ${r.title}, ${minText(r.min)}, ${r.meta}.`;
      if (state.considered) {
        const o = state.active === 'alt' ? ROUTES.fast : altRoute();
        s += ` Для сравнения показан пунктиром: ${o.title}, ${minText(o.min)}.`;
      }
    }
    $('#mapDesc').textContent = s;
  }

  function renderAll() {
    renderChoices();
    renderIntent();
    renderPanel();
    renderTitle();
    renderCard();
    renderOverlays();
    renderExplain();
    renderActions();
    renderFinal();
    renderDesc();
  }

  /* =========================================================
     Действия
     ========================================================= */

  function selectTask(id) {
    if (state.task === id) return;
    state.task = id;
    state.wish = null;
    resetRoute();
    renderAll();
    if (!scrolledToWish) {
      scrolledToWish = true;
      later(80, state.token).then(() => {
        const rect = $('#wishChoices').getBoundingClientRect();
        if (rect.bottom > innerHeight) $('#wish').scrollIntoView(scrollOpts());
      });
    }
  }

  function selectWish(id) {
    if (state.wish === id) return;
    state.wish = id;
    resetRoute();
    renderAll();
  }

  $('#buildBtn').addEventListener('click', buildRoute);
  $('#seg').addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn');
    if (b && !b.disabled) setActive(b.dataset.route);
  });
  $('#seg').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const next = state.active === 'fast' ? 'alt' : 'fast';
    setActive(next);
    $(`#seg .seg-btn[data-route="${next}"]`).focus();
  });
  $('#againBtn').addEventListener('click', () => {
    if (state.task) {
      state.wish = null;
      resetRoute();
      renderAll();
      $('#wish').scrollIntoView(scrollOpts());
      later(reduceMQ.matches ? 0 : 500, state.token).then(() => $('#wishChoices .choice')?.focus({ preventScroll: true }));
    } else {
      $('#task').scrollIntoView(scrollOpts());
    }
  });

  // Карта: десктопный и мобильный кадр
  function applyViewBox() {
    svg.setAttribute('viewBox', mobileMQ.matches ? '116 50 794 620' : '-20 -70 1120 760');
  }
  mobileMQ.addEventListener('change', () => { applyViewBox(); renderOverlays(); });

  // Мягкое появление типографики
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      }), { rootMargin: '0px 0px -8% 0px' })
    : null;
  document.querySelectorAll('[data-reveal]').forEach((n) => (io ? io.observe(n) : n.classList.add('in')));

  applyViewBox();
  drawBase();
  renderAll();

  // для проверки из консоли
  window.__story = { state, ROUTES, WISHES };
})();
