/* 실험별 연구 지도 — d3-geo Natural Earth 투영 + Natural Earth 110m 육지(assets/vendor/world-110m.js).
   데이터: window.SITE_REGIONS[map] (지역 허브), window.PAPERS (논문). 둘 다 data/papers.js.
   - 논문이 2편 이상인 지역 = 허브(점 + 지역명 + 편수). 누르면 논문 가지가 펼쳐진다(마우스는 올리면 미리보기).
   - 논문이 1편인 지역 = 점 하나(위: 주제, 아래: 1저자 et al. 연도 (저널)).
   - 좁은 화면에서는 가지 대신 하단 시트에 목록을 띄운다.
   ?debug 를 붙이면 평상시 라벨끼리 겹치는 곳을 콘솔에 찍는다. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var NARROW = '(max-width: 720px)';
  var LEAF_GAP = 34, LEAF_DX = 104, MAX_PER_SIDE = 10;

  // 16px 상자 중심 기준 도식 아이콘 (선 아이콘, .solid 는 채움)
  var ICONS = {
    drop: '<path class="solid" d="M0 -7C3 -3 5 -.5 5 2A5 5 0 0 1-5 2C-5-.5-3-3 0-7Z"/>',
    cloud: '<path d="M-6.5 3.5H5A3.2 3.2 0 0 0 4.6-2.8 4.3 4.3 0 0 0-3.2-3.4 3.4 3.4 0 0 0-6.5 3.5Z"/>',
    arrow: '<path d="M-6 5C-6-2.5-.5-6 5.5-3.5"/><path d="M2.2-6.4 5.8-3.4 2.6-.4"/>',
    ice: '<path d="M-7.5 4.5-3.8-1.8-1.3 2 2-4.5 7.5 4.5Z"/>',
    heat: '<path d="M-1.8-5.6A1.8 1.8 0 0 1 1.8-5.6V1.2A3.6 3.6 0 1 1-1.8 1.2Z"/><circle class="solid" cx="0" cy="3.6" r="1.6"/>',
    wave: '<path d="M-7-1.5C-5.3-4.3-3.4-4.3-1.7-1.5S2-1.3 3.6-1.5 6-4 7-3"/><path d="M-7 3.5C-5.3.7-3.4.7-1.7 3.5S2 3.7 3.6 3.5 6 1 7 2"/>',
    leaf: '<path d="M-5.5 5.5C-5.5-3 .5-6.5 6-6.5 6-.5 2 5.5-5.5 5.5Z"/><path d="M-5.5 5.5 1.5-1.5"/>',
    fire: '<path d="M0-7C4-3 5.2 0 4.3 3A4.6 4.6 0 0 1-4.3 3C-5.2 0-2.4-2.2-1.2-5 0-3 1-2.2 1.6-1.2"/>',
    wind: '<path d="M-7-3H3A2.4 2.4 0 1 0 .6-5.4"/><path d="M-7 1H5A2.4 2.4 0 1 1 2.6 3.4"/><path d="M-7 5H0"/>',
    globe: '<circle cx="0" cy="0" r="6"/><ellipse cx="0" cy="0" rx="2.6" ry="6"/><path d="M-6 0H6"/>'
  };

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function t(key, vars) { return window.I18N ? window.I18N.t(key, vars) : key; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function kind(p) {
    if (p.status === 'inprep') return 'prep';
    if (p.status === 'submitted') return 'sub';
    return p.coauthor ? 'co' : 'exp';
  }
  function cite(p) {
    var who = p.first_author + ' et al.';
    if (p.status === 'inprep') return who + ' (in prep.)';
    if (p.status === 'submitted') return who + ' (' + (p.journal_abbr ? p.journal_abbr + ', ' : '') + 'submitted)';
    return who + ' ' + p.year + ' (' + p.journal_abbr + ')';
  }
  function href(p) { return p.doi ? 'https://doi.org/' + p.doi : null; }
  function sortPapers(a, b) {
    var order = { co: 0, exp: 1, sub: 2, prep: 3 };
    return (order[kind(a)] - order[kind(b)]) || ((b.year || 9999) - (a.year || 9999)) || a.first_author.localeCompare(b.first_author);
  }

  function icon(parent, name, x, y, cls) {
    if (!ICONS[name]) return null;
    var g = el('g', { 'class': 'ico ' + cls, transform: 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')', 'aria-hidden': 'true' }, parent);
    g.innerHTML = ICONS[name];
    return g;
  }
  function text(parent, cls, x, y, str, anchor) {
    var e = el('text', { 'class': 'lbl ' + cls, x: x, y: y, 'text-anchor': anchor || 'middle' }, parent);
    e.textContent = str;
    return e;
  }

  // ------------------------------------------------------------------ 한 지도
  function MapView(host, key) {
    this.host = host;
    this.key = key;
    this.regions = (window.SITE_REGIONS && window.SITE_REGIONS[key]) || [];
    var papers = (window.PAPERS || []).filter(function (p) { return p.map === key; });
    this.byRegion = {};
    papers.forEach(function (p) { (this.byRegion[p.region] = this.byRegion[p.region] || []).push(p); }, this);
    for (var r in this.byRegion) this.byRegion[r].sort(sortPapers);
    this.pinned = null;
    this.preview = null;
    this.sheet = host.parentNode.querySelector('[data-sheet]');
    this.draw();
  }

  MapView.prototype.draw = function () {
    var d3 = window.d3, topo = window.topojson, world = window.WORLD_LAND_110M;
    var host = this.host;
    host.innerHTML = '';
    if (!d3 || !d3.geoNaturalEarth1 || !topo || !world) {
      var m = document.createElement('p'); m.className = 'map-empty'; m.textContent = t('map.fail'); host.appendChild(m);
      return;
    }
    // 좁은 화면: 지도를 높이에 맞춰 크게 그리고 좌우로 밀어 보게 한다(라벨 크기 유지)
    var narrow = this.narrow();
    var H = Math.max(240, host.clientHeight);
    var W = narrow ? Math.max(host.clientWidth, Math.round(H * 1.9)) : Math.max(320, host.clientWidth);
    this.W = W; this.H = H;
    var outline = d3.geoGraticule().extent([[-180, -64], [180, 84]]).outline();
    var proj = d3.geoNaturalEarth1().fitExtent([[2, 2], [W - 2, H - 2]], outline);
    var path = d3.geoPath(proj);
    this.proj = proj;

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': host.getAttribute('aria-label') || '' }, host);
    if (narrow) { svg.style.width = W + 'px'; svg.style.height = H + 'px'; }
    this.svg = svg;
    var cid = 'clip-' + this.key;
    var defs = el('defs', null, svg);
    el('path', { d: path(outline) }, el('clipPath', { id: cid }, defs));
    var base = el('g', { 'clip-path': 'url(#' + cid + ')' }, svg);
    var sea = el('path', { 'class': 'm-sphere', d: path(outline) }, base);
    el('path', { 'class': 'm-grat', d: path(d3.geoGraticule10()) }, base);
    el('path', { 'class': 'm-land', d: path(topo.feature(world, world.objects.land)) }, base);
    var self = this;
    sea.addEventListener('click', function () { self.setPinned(null); });
    base.addEventListener('click', function (e) { if (e.target !== sea) self.setPinned(null); });

    this.marks = el('g', { 'class': 'marks' }, svg);
    this.top = el('g', { 'class': 'top' }, svg);
    this.hubs = {};
    this.regions.forEach(function (r) {
      var list = this.byRegion[r.id];
      if (!list || !list.length) return;
      if (list.length === 1) this.drawPoint(r, list[0]);
      else this.drawHub(r, list);
    }, this);
    this.sync();
    if (narrow) host.scrollLeft = proj([100, 20])[0] - host.clientWidth / 2;   // 처음에는 아시아 쪽을 보여 준다
    if (/[?&]debug\b/.test(location.search)) this.checkOverlap();
  };

  // 논문 1편 지역: 점 + 주제 + 인용
  MapView.prototype.drawPoint = function (r, p) {
    var xy = this.proj(r.ll), x = xy[0], y = xy[1], k = kind(p);
    var g = el('g', { 'class': 'pt k-' + k }, this.marks);
    var a = href(p) ? el('a', { href: href(p), target: '_blank', rel: 'noopener' }, g) : el('g', null, g);
    if (p.title) el('title', null, a).textContent = p.title;
    if (k === 'exp') el('circle', { 'class': 'pt-dot-exp', cx: x, cy: y, r: 4 }, a);
    else el('circle', { cx: x, cy: y, r: 4.4 }, a);
    var ly = y + (r.ly || 0), lx = x + (r.lx || 0);
    var tp = text(a, 'lbl-topic', lx, ly - 9, p.topic);
    text(a, 'lbl-cite', lx, ly + 17, cite(p));
    this.addIcon(a, p.icon || r.icon, tp, 'k-' + k);
  };

  // 논문 2편 이상 지역: 허브 + 접힌 가지
  MapView.prototype.drawHub = function (r, list) {
    var xy = this.proj(r.ll), x = xy[0], y = xy[1], self = this;
    var g = el('g', { 'class': 'hub', tabindex: '0', role: 'button', 'aria-expanded': 'false',
      'aria-label': r.name + ', ' + t('map.papers', { n: list.length }) }, this.marks);
    // 가지는 맨 위 레이어에 따로 둔다(허브 노드를 옮기면 키보드 초점이 풀리므로 허브는 제자리에 둔다)
    var leaves = el('g', { 'class': 'leaves' }, this.top);
    el('circle', { 'class': 'hub-ring', cx: x, cy: y, r: 9 + Math.min(6, list.length) }, g);
    el('circle', { 'class': 'hub-dot', cx: x, cy: y, r: 5.5 }, g);
    el('circle', { cx: x, cy: y, r: 18, fill: 'transparent' }, g);   // 누르기 쉬운 영역
    var lx = x + (r.lx || 0), ly = y + (r.ly || 0);
    var tp = text(g, 'lbl-topic k-co', lx, ly - 13, r.name);
    text(g, 'lbl-count', lx, ly + 26, t('map.papers', { n: list.length }));
    this.addIcon(g, r.icon, tp, 'k-co');
    this.hubs[r.id] = { g: g, leaves: leaves, r: r, list: list, x: x, y: y, built: false };

    // 마우스: 허브나 가지 위에 있으면 미리보기, 둘 다 벗어나면 잠시 뒤 닫는다
    function enter(e) {
      if (e.pointerType !== 'mouse' || self.narrow()) return;
      clearTimeout(self.closeTimer);
      if (self.preview !== r.id) { self.preview = r.id; self.sync(); }
    }
    function leave(e) {
      if (e.pointerType !== 'mouse' || self.preview !== r.id) return;
      clearTimeout(self.closeTimer);
      self.closeTimer = setTimeout(function () { if (self.preview === r.id) { self.preview = null; self.sync(); } }, 140);
    }
    function click(e) {
      if (e.target.closest && e.target.closest('a')) return;      // 인용 링크는 그대로 이동
      e.stopPropagation();
      self.toggle(r.id);
    }
    [g, leaves].forEach(function (n) {
      n.addEventListener('pointerenter', enter);
      n.addEventListener('pointerleave', leave);
      n.addEventListener('click', click);
    });
    g.addEventListener('keydown', function (e) {
      if (e.target !== g) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); self.toggle(r.id); }
    });
  };

  MapView.prototype.addIcon = function (parent, name, topicEl, cls) {
    if (!name || !ICONS[name]) return;
    var w = topicEl.getComputedTextLength ? topicEl.getComputedTextLength() : 60;
    var x = +topicEl.getAttribute('x'), y = +topicEl.getAttribute('y');
    icon(parent, name, x - w / 2 - 13, y - 4.5, cls);
  };

  // 가지 배치: 허브 옆(기본 오른쪽, 지역 설정 side)으로 세로 기둥, 많으면 양쪽으로 나눈다
  MapView.prototype.buildLeaves = function (h) {
    var leaves = h.leaves, list = h.list, r = h.r, W = this.W, H = this.H;
    leaves.innerHTML = '';
    var side = r.side || (h.x > W * 0.86 ? -1 : 1);
    var cols = list.length > MAX_PER_SIDE ? [side, -side] : [side];
    var groups = cols.map(function () { return []; });
    list.forEach(function (p, i) { groups[i % cols.length].push(p); });
    var gBranch = el('g', null, leaves), gLeaf = el('g', null, leaves);    // 선을 라벨 아래에 깐다

    groups.forEach(function (ps, ci) {
      var s = cols[ci], dx = (r.dx || LEAF_DX) * s;
      var total = (ps.length - 1) * LEAF_GAP;
      var y0 = clamp(h.y + (r.dy || 0) - total / 2, 26, H - 22 - total);
      ps.forEach(function (p, i) {
        var mid = (ps.length - 1) / 2, bend = mid ? Math.abs(i - mid) / mid : 0;
        var x = h.x + dx - s * bend * 14, y = y0 + i * LEAF_GAP, k = kind(p);
        var c1 = h.x + dx * 0.45;
        el('path', { 'class': 'branch', d: 'M' + h.x + ',' + h.y + 'C' + c1 + ',' + h.y + ' ' + c1 + ',' + y + ' ' + (x - s * 4) + ',' + y }, gBranch);
        var lg = el('g', { 'class': 'leaf k-' + k }, gLeaf);
        var bg = el('rect', { 'class': 'leaf-bg', rx: 3 }, lg);
        if (k === 'exp') el('circle', { 'class': 'leaf-dot-exp', cx: x, cy: y, r: 3.2 }, lg);
        else el('circle', { cx: x, cy: y, r: 3.4 }, lg);
        var anchor = s > 0 ? 'start' : 'end', tx = x + s * 8;
        var a = href(p) ? el('a', { href: href(p), target: '_blank', rel: 'noopener' }, lg) : el('g', null, lg);
        if (p.title) el('title', null, a).textContent = p.title;
        text(a, 'lbl-topic', tx, y - 3, p.topic, anchor);
        text(a, 'lbl-cite', tx, y + 11, cite(p), anchor);
        var b = a.getBBox();
        bg.setAttribute('x', b.x - 3); bg.setAttribute('y', b.y - 1);
        bg.setAttribute('width', b.width + 6); bg.setAttribute('height', b.height + 2);
      });
    });
    var bb = leaves.getBBox();
    if (!h.flipped && (bb.x < 0 || bb.x + bb.width > W)) {           // 화면 밖으로 나가면 반대쪽으로 한 번 뒤집는다
      h.flipped = true;
      r = Object.assign({}, r, { side: -side });
      h.r = r;
      this.buildLeaves(h);
      return;
    }
    // 허브에서 가지로 마우스를 옮기는 동안 미리보기가 닫히지 않도록 투명한 영역을 깐다
    var x0 = Math.max(0, Math.min(bb.x, h.x - 20) - 6), y0 = Math.max(0, Math.min(bb.y, h.y - 20) - 6);
    var x1 = Math.min(W, Math.max(bb.x + bb.width, h.x + 20) + 6), y1 = Math.min(H, Math.max(bb.y + bb.height, h.y + 20) + 6);
    leaves.insertBefore(el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: 'transparent' }), leaves.firstChild);
    h.built = true;
  };

  MapView.prototype.narrow = function () { return window.matchMedia && window.matchMedia(NARROW).matches; };
  MapView.prototype.toggle = function (id) {
    if (this.narrow()) { this.openSheet(id); return; }
    this.setPinned(this.pinned === id ? null : id);
  };
  MapView.prototype.setPinned = function (id) { this.pinned = id; this.preview = null; this.sync(); };

  MapView.prototype.sync = function () {
    var open = this.pinned || this.preview;
    for (var id in this.hubs) {
      var h = this.hubs[id], on = id === open;
      if (on && !h.built) this.buildLeaves(h);
      h.g.classList.toggle('is-open', on);
      h.leaves.classList.toggle('is-open', on);
      h.g.setAttribute('aria-expanded', on ? 'true' : 'false');
    }
    this.svg && this.svg.classList.toggle('has-open', !!open);
  };

  MapView.prototype.openSheet = function (id) {
    var h = this.hubs[id], sh = this.sheet;
    if (!h || !sh) return;
    sh.querySelector('h3').textContent = h.r.name;
    var ol = sh.querySelector('ol');
    ol.innerHTML = '';
    h.list.forEach(function (p) {
      var li = document.createElement('li');
      li.className = 'k-' + kind(p);
      var tp = document.createElement('span'); tp.className = 's-topic'; tp.textContent = p.topic;
      var c = document.createElement(href(p) ? 'a' : 'span'); c.className = 's-cite'; c.textContent = cite(p);
      if (href(p)) { c.href = href(p); c.target = '_blank'; c.rel = 'noopener'; }
      li.appendChild(tp); li.appendChild(c); ol.appendChild(li);
    });
    sh.hidden = false;
    sh.querySelector('.sheet-close').focus();
  };

  // 평상시(가지를 접은 상태) 라벨 겹침 검사 — 개발용
  MapView.prototype.checkOverlap = function () {
    var boxes = [];
    this.marks.querySelectorAll('.hub > .lbl, .pt .lbl').forEach(function (n) { boxes.push({ n: n.textContent, b: n.getBBox() }); });
    var hits = 0;
    for (var i = 0; i < boxes.length; i++) for (var j = i + 1; j < boxes.length; j++) {
      var a = boxes[i].b, b = boxes[j].b;
      if (a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height) {
        hits++; console.warn('[map ' + this.key + '] overlap:', boxes[i].n, '×', boxes[j].n);
      }
    }
    console.info('[map ' + this.key + '] label overlaps: ' + hits);
  };

  // ------------------------------------------------------------------ 시작
  function start() {
    var views = [];
    document.querySelectorAll('[data-map-host]').forEach(function (host) {
      views.push(new MapView(host, host.getAttribute('data-map-host')));
    });
    document.querySelectorAll('[data-sheet]').forEach(function (sh) {
      sh.querySelector('.sheet-close').addEventListener('click', function () { sh.hidden = true; });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      views.forEach(function (v) { v.setPinned(null); });
      document.querySelectorAll('[data-sheet]').forEach(function (sh) { sh.hidden = true; });
    });
    var timer = 0, lastW = window.innerWidth, lastH = window.innerHeight;
    window.addEventListener('resize', function () {
      if (Math.abs(window.innerWidth - lastW) < 2 && Math.abs(window.innerHeight - lastH) < 80) return;  // 휴대폰 주소창 접힘은 무시
      lastW = window.innerWidth; lastH = window.innerHeight;
      clearTimeout(timer);
      timer = setTimeout(function () { views.forEach(function (v) { v.draw(); }); }, 150);
    });
    document.addEventListener('langchange', function () { views.forEach(function (v) { v.draw(); }); });

    // 상단 실험 탭: 보이는 지도 표시
    var tabs = document.querySelectorAll('.bar-exp a');
    if ('IntersectionObserver' in window && tabs.length) {
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          if (!en.isIntersecting) return;
          tabs.forEach(function (a) { a.setAttribute('aria-current', a.getAttribute('href') === '#' + en.target.id ? 'true' : 'false'); });
        });
      }, { threshold: 0.5 });
      document.querySelectorAll('.plate').forEach(function (s) { io.observe(s); });
    }
  }
  if (document.readyState !== 'loading') start(); else document.addEventListener('DOMContentLoaded', start);
})();
