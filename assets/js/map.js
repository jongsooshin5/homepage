/* 실험별 연구 지도 — d3-geo Natural Earth 투영 + Natural Earth 110m 육지(assets/vendor/world-110m.js).
   데이터: window.SITE_REGIONS[map] (지역 허브), window.PAPERS (논문). 둘 다 data/papers.js.
   - 지역 표지는 현상별 색 배지에 담은 도식 아이콘(강수=물방울, 순환=화살표 …)이다.
   - 배지 바깥 고리는 논문 상태색이다: 공저/비공저/투고/준비 비율 호.
   - 모든 지역 = 허브(아이콘 + 지역명 + 편수, 논문 1편이어도 같음). 아이콘을 누르면 논문 가지가 펼쳐진다(마우스는 올리면 미리보기).
     가지 끝은 주제 + 1저자 et al. 연도 (저널) 이고 DOI 링크다. 가지는 이웃 표지를 덜 덮는 쪽으로 펼친다.
   - 지도는 고정 설계 폭(DESIGN_MIN~MAX 단위)으로 그리고 SVG 를 그림처럼 늘리고 줄인다. 그래서 브라우저 확대·축소나
     큰 모니터에서 지도 속 라벨도 다른 글자와 같은 비율로 움직인다. 표시 폭은 담는 상자 폭과 '실험 제목 아래 남은 화면 높이에 들어가는 폭' 중 작은 값.
   - 지도 상자가 COMPACT_W 보다 좁으면(휴대폰·좁은 창) 작은 지역 이름과 편수 숫자만 두고, 누르면 하단 시트에 목록을 띄운다.
   ?debug 를 붙이면 평상시 라벨끼리 겹치는 곳을 콘솔에 찍는다. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var DESIGN_MIN = 1150, DESIGN_MAX = 1280, COMPACT_W = 900;   // 설계 폭 범위(좌표 단위), 아이콘만 쓰는 상자 폭(px)
  var LEAF_GAP = 34, LEAF_DX = 112, MAX_PER_SIDE = 10;
  var R_HUB = 17, R_PT = 14;          // 아이콘 배지 반지름(px)
  var KINDS = ['co', 'exp', 'sub', 'prep'];
  // 지도 남쪽 끝 위도. 기본은 남극까지 포함한 전구(-90), window.MAP_SOUTH = -64 처럼 주면 그 위도에서 자른다.
  var SOUTH = typeof window.MAP_SOUTH === 'number' ? window.MAP_SOUTH : -90;

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
  function hit(a, b) { return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height; }

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
    return (KINDS.indexOf(kind(a)) - KINDS.indexOf(kind(b))) || ((b.year || 9999) - (a.year || 9999)) || a.first_author.localeCompare(b.first_author);
  }

  // 현상별 색 배지 + 도식 아이콘 (색은 style.css 의 .cat-<아이콘>)
  function badge(parent, name, x, y, r) {
    if (!ICONS[name]) name = 'globe';
    var g = el('g', { 'class': 'badge cat-' + name, transform: 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')' }, parent);
    el('circle', { 'class': 'badge-bg', r: r }, g);
    var ic = el('g', { 'class': 'ico', transform: 'scale(' + (r / 11).toFixed(2) + ')', 'aria-hidden': 'true' }, g);
    ic.innerHTML = ICONS[name];
    return g;
  }
  // 허브 바깥 고리: 상태별 논문 수 비율만큼 호를 나눠 그린다(12시 방향부터 시계방향)
  function statusArcs(parent, list, x, y, rr) {
    var n = {}, C = 2 * Math.PI * rr, off = 0;
    list.forEach(function (p) { n[kind(p)] = (n[kind(p)] || 0) + 1; });
    var gap = KINDS.filter(function (k) { return n[k]; }).length > 1 ? 2 : 0;
    KINDS.forEach(function (k) {
      if (!n[k]) return;
      var len = C * n[k] / list.length;
      el('circle', { 'class': 'stat-arc k-' + k, cx: x, cy: y, r: rr, transform: 'rotate(-90 ' + x + ' ' + y + ')',
        'stroke-dasharray': Math.max(0.1, len - gap) + ' ' + (C - len + gap), 'stroke-dashoffset': -off }, parent);
      off += len;
    });
  }
  function text(parent, cls, x, y, str, anchor) {
    var e = el('text', { 'class': 'lbl ' + cls, x: x, y: y, 'text-anchor': anchor || 'middle' }, parent);
    e.textContent = str;
    return e;
  }
  // 위아래 두 줄 라벨. 지도 위 끝에 붙은 표지(북극 등)는 위 줄이 지도 밖으로 나가므로 오른쪽에 두 줄로 붙인다.
  function labels(parent, x, y, r, top, bottom, topCls, botCls) {
    if (y - r - 22 < 0) {
      text(parent, topCls, x + r + 8, y - 4, top, 'start');
      text(parent, botCls, x + r + 8, y + 13, bottom, 'start');
    } else {
      text(parent, topCls, x, y - r - 8, top);
      text(parent, botCls, x, y + r + 16, bottom);
    }
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
    if (this.sheet) this.sheet.querySelector('h3').id = 'sheet-' + key;
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
    var plate = host.closest('.plate') || host.parentNode;
    var boxW = host.clientWidth, narrow = this.compact = boxW < COMPACT_W;
    plate.classList.toggle('is-compact', narrow);
    var outline = SOUTH <= -89 ? { type: 'Sphere' } : d3.geoGraticule().extent([[-180, SOUTH], [180, 84]]).outline();
    // 좌표계 폭 W: 넓은 상자는 고정 설계 폭(라벨이 지도와 함께 커지고 작아짐), 좁은 상자는 실제 픽셀 폭.
    var W = narrow ? Math.max(200, boxW) : clamp(boxW, DESIGN_MIN, DESIGN_MAX);
    var nb = d3.geoPath(d3.geoNaturalEarth1().fitWidth(W - 4, outline)).bounds(outline);
    var H = Math.ceil(nb[1][1] - nb[0][1]) + 4;
    var dispW = boxW;
    if (!narrow) {                                                    // 실험 제목과 지도가 한 화면에 들어가도록 표시 폭을 제한
      var barEl = document.querySelector('.bar'), bar = barEl ? barEl.offsetHeight : 60;
      var above = host.getBoundingClientRect().top - plate.getBoundingClientRect().top;
      dispW = Math.min(boxW, Math.max(COMPACT_W, (window.innerHeight - bar - above - 16) * W / H));
    }
    var dispH = Math.round(dispW * H / W);
    host.style.height = dispH + 'px';
    this.W = W; this.H = H;
    this.rHub = narrow ? clamp(W / 90, 9, 12) : R_HUB;
    this.rPt = narrow ? clamp(W / 100, 8, 10) : R_PT;
    var proj = d3.geoNaturalEarth1().fitExtent([[2, 2], [W - 2, H - 2]], outline);
    var path = d3.geoPath(proj);
    this.proj = proj;

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': host.getAttribute('aria-label') || '',
      'class': narrow ? 'is-narrow' : null }, host);
    svg.style.width = dispW + 'px'; svg.style.height = dispH + 'px';
    this.svg = svg;
    var cid = 'clip-' + this.key;
    var defs = el('defs', null, svg);
    el('path', { d: path(outline) }, el('clipPath', { id: cid }, defs));
    var base = el('g', { 'clip-path': 'url(#' + cid + ')' }, svg);
    el('path', { 'class': 'm-sphere', d: path(outline) }, base);
    el('path', { 'class': 'm-grat', d: path(d3.geoGraticule10()) }, base);
    el('path', { 'class': 'm-land', d: path(topo.feature(world, world.objects.land)) }, base);
    el('path', { 'class': 'm-rim', d: path(outline) }, svg);
    var self = this;
    base.addEventListener('click', function () { self.setPinned(null); });

    this.marks = el('g', { 'class': 'marks' }, svg);
    this.top = el('g', { 'class': 'top' }, svg);
    this.hubs = {};
    this.regions.forEach(function (r) {
      var list = this.byRegion[r.id];
      if (list && list.length) this.drawHub(r, list);
    }, this);
    if (narrow) this.placeCompactLabels();
    this.sync();
    if (/[?&]debug\b/.test(location.search)) this.checkOverlap();
  };

  // 지역 허브 + 접힌 가지 (논문 1편이어도 같은 방식)
  MapView.prototype.drawHub = function (r, list) {
    var xy = this.proj(r.ll), x = xy[0], y = xy[1], self = this;
    var count = t(list.length === 1 ? 'map.paper' : 'map.papers', { n: list.length });
    var g = el('g', { 'class': 'hub', tabindex: '0', role: 'button', 'aria-expanded': 'false',
      'aria-label': r.name + ', ' + count }, this.marks);
    // 가지는 맨 위 레이어에 따로 둔다(허브 노드를 옮기면 키보드 초점이 풀리므로 허브는 제자리에 둔다)
    var leaves = el('g', { 'class': 'leaves' }, this.top);
    var R = this.rHub, narrow = this.narrow();
    statusArcs(g, list, x, y, R + (narrow ? 3 : 4.5));
    el('circle', { 'class': 'focus-ring', cx: x, cy: y, r: R + (narrow ? 6 : 9) }, g);
    badge(g, r.icon, x, y, R);
    el('circle', { cx: x, cy: y, r: R + (narrow ? 9 : 6), fill: 'transparent' }, g);   // 누르기 쉬운 영역
    if (narrow) {                                                     // 좁은 화면: 편수 숫자 방울 (지역 이름은 placeCompactLabels 가 배치)
      var bx = x + R * 0.85, by = y - R * 0.85;
      el('circle', { 'class': 'n-bubble', cx: bx, cy: by, r: 6 }, g);
      el('text', { 'class': 'n-text', x: bx, y: by + 3, 'text-anchor': 'middle' }, g).textContent = list.length;
    } else {
      labels(g, x + (r.lx || 0), y + (r.ly || 0), R + 3, r.name, count, 'lbl-hub', 'lbl-count');
    }
    var h = this.hubs[r.id] = { g: g, leaves: leaves, r: r, list: list, x: x, y: y, built: false };

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
      self.toggle(r.id, g);
    }
    [g, leaves].forEach(function (n) {
      n.addEventListener('pointerenter', enter);
      n.addEventListener('pointerleave', leave);
      n.addEventListener('click', click);
    });
    // 키보드: Enter/Space 로 펼치면 첫 논문 링크로 초점을 옮기고, 가지 끝에서 Tab/Shift+Tab 은 허브로 돌아온다
    g.addEventListener('keydown', function (e) {
      if (e.target !== g || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      self.toggle(r.id, g);
      if (self.pinned === r.id) { var a = leaves.querySelector('a'); if (a) a.focus(); }
    });
    leaves.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var links = leaves.querySelectorAll('a');
      if (!links.length) return;
      if ((!e.shiftKey && e.target === links[links.length - 1]) || (e.shiftKey && e.target === links[0])) {
        e.preventDefault();
        g.focus();
      }
    });
    return h;
  };

  // 좁은 화면의 지역 이름: 작은 글씨로 아이콘 아래·위·오른쪽·왼쪽 중 다른 아이콘·이름과 겹치지 않고 지도 안에 드는 첫 자리에 둔다.
  // 아주 좁으면(600px 미만) 줄임 이름(short)을 쓴다. 논문이 많은 지역부터 자리를 잡는다.
  MapView.prototype.placeCompactLabels = function () {
    var W = this.W, H = this.H, R = this.rHub, fs = W < 600 ? 9.5 : 11, useShort = W < 600;
    var hubs = [], obs = [];
    for (var id in this.hubs) hubs.push(this.hubs[id]);
    hubs.forEach(function (h) { obs.push({ x: h.x - R - 4, y: h.y - R - 7, width: 2 * R + 11, height: 2 * R + 11 }); });
    hubs.sort(function (a, b) { return b.list.length - a.list.length; });
    hubs.forEach(function (h) {
      var name = (useShort && h.r.short) || h.r.name, best = null;
      var cands = [[h.x, h.y + R + 3 + fs, 'middle'], [h.x, h.y - R - 9, 'middle'], [h.x + R + 4, h.y + fs * .35, 'start'], [h.x - R - 4, h.y + fs * .35, 'end']];
      for (var i = 0; i < cands.length; i++) {
        var tx = el('text', { 'class': 'lbl lbl-hub lbl-compact', x: cands[i][0], y: cands[i][1], 'text-anchor': cands[i][2] }, h.g);
        tx.style.fontSize = fs + 'px';
        tx.textContent = name;
        var b = tx.getBBox(), cost = (b.x < 1 || b.y < 1 || b.x + b.width > W - 1 || b.y + b.height > H - 1) ? 100 : 0;
        obs.forEach(function (o) { if (hit(b, o)) cost++; });
        if (!best || cost < best.cost) { if (best) best.el.remove(); best = { el: tx, b: b, cost: cost }; } else tx.remove();
        if (cost === 0) break;
      }
      obs.push(best.b);
    });
  };

  // 표지(다른 허브·지점) 상자: 가지가 덜 덮는 쪽을 고를 때 쓴다
  MapView.prototype.obstacles = function (except) {
    var out = [];
    this.marks.querySelectorAll('.hub, .pt').forEach(function (n) { if (n !== except) out.push(n.getBBox()); });
    return out;
  };

  // 가지 배치: 허브 옆으로 세로 기둥. 양쪽을 다 놓아 보고 화면 밖으로 덜 나가고 이웃 표지를 덜 덮는 쪽을 고른다.
  MapView.prototype.buildLeaves = function (h) {
    var self = this, r = h.r, W = this.W;
    var pref = r.side || (h.x > W * 0.86 ? -1 : 1);
    if (h.list.length > MAX_PER_SIDE) { this.layoutLeaves(h, [pref, -pref]); }
    else {
      var obs = this.obstacles(h.g), best = null;
      [pref, -pref].forEach(function (s) {
        self.layoutLeaves(h, [s]);
        var bb = h.leaves.getBBox(), cost = (bb.x < 0 || bb.x + bb.width > W) ? 1000 : 0;
        h.leaves.querySelectorAll('.leaf-bg').forEach(function (bg) {
          var b = bg.getBBox();
          obs.forEach(function (o) { if (hit(b, o)) cost++; });
        });
        if (!best || cost < best.cost) best = { s: s, cost: cost };
      });
      this.layoutLeaves(h, [best.s]);
    }
    // 허브에서 가지로 마우스를 옮기는 동안 미리보기가 닫히지 않도록 투명한 영역을 깐다(고정했을 때는 이웃 표지를 막지 않게 끈다)
    var bb = h.leaves.getBBox(), H = this.H;
    var x0 = Math.max(0, Math.min(bb.x, h.x - 20) - 6), y0 = Math.max(0, Math.min(bb.y, h.y - 20) - 6);
    var x1 = Math.min(W, Math.max(bb.x + bb.width, h.x + 20) + 6), y1 = Math.min(H, Math.max(bb.y + bb.height, h.y + 20) + 6);
    h.leaves.insertBefore(el('rect', { 'class': 'hover-pad', x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: 'transparent' }), h.leaves.firstChild);
    h.built = true;
  };

  MapView.prototype.layoutLeaves = function (h, cols) {
    var leaves = h.leaves, list = h.list, r = h.r, H = this.H;
    leaves.innerHTML = '';
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
        var x0 = h.x + s * (R_HUB + 6), c1 = h.x + dx * 0.5;             // 상태 고리 바깥에서 출발
        el('path', { 'class': 'branch k-' + k, d: 'M' + x0 + ',' + h.y + 'C' + c1 + ',' + h.y + ' ' + c1 + ',' + y + ' ' + (x - s * 4) + ',' + y }, gBranch);
        var lg = el('g', { 'class': 'leaf k-' + k }, gLeaf);
        var bg = el('rect', { 'class': 'leaf-bg', rx: 3 }, lg);
        if (k === 'exp') el('circle', { 'class': 'leaf-dot-exp', cx: x, cy: y, r: 3.4 }, lg);
        else el('circle', { cx: x, cy: y, r: 3.6 }, lg);
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
  };

  MapView.prototype.narrow = function () { return !!this.compact; };
  MapView.prototype.toggle = function (id, opener) {
    if (this.narrow()) { var h = this.hubs[id]; if (h) this.openSheet(h.r, h.list, opener || h.g); return; }
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
      h.leaves.classList.toggle('is-pinned', on && this.pinned === id);
      h.g.setAttribute('aria-expanded', on ? 'true' : 'false');
    }
    this.svg && this.svg.classList.toggle('has-open', !!open);
  };

  // 하단 목록 시트: 지역 이름 + 논문(주제, 인용 링크)
  MapView.prototype.openSheet = function (r, list, opener) {
    var sh = this.sheet;
    if (!sh) return;
    closeSheets();                                                    // 다른 지도의 시트가 열려 있으면 닫는다
    sh.querySelector('h3').textContent = r.name;
    var ol = sh.querySelector('ol');
    ol.innerHTML = '';
    list.forEach(function (p) {
      var li = document.createElement('li');
      li.className = 'k-' + kind(p);
      var tp = document.createElement('span'); tp.className = 's-topic'; tp.textContent = p.topic;
      var c = document.createElement(href(p) ? 'a' : 'span'); c.className = 's-cite'; c.textContent = cite(p);
      if (href(p)) { c.href = href(p); c.target = '_blank'; c.rel = 'noopener'; }
      li.appendChild(tp); li.appendChild(c); ol.appendChild(li);
    });
    sh._opener = opener;
    sh.hidden = false;
    sh.querySelector('.sheet-close').focus();
  };

  function closeSheets(restore) {
    document.querySelectorAll('[data-sheet]').forEach(function (sh) {
      if (sh.hidden) return;
      sh.hidden = true;
      if (restore && sh._opener) sh._opener.focus();
    });
  }

  // 평상시(가지를 접은 상태) 라벨·배지 겹침 검사 — 개발용
  MapView.prototype.checkOverlap = function () {
    var boxes = [];
    this.marks.querySelectorAll('.hub > .lbl, .pt .lbl, .badge').forEach(function (n) {
      var b = n.getBBox(), m = n.transform && n.transform.baseVal.consolidate();   // 배지는 translate 를 반영
      if (m) b = { x: b.x + m.matrix.e, y: b.y + m.matrix.f, width: b.width, height: b.height };
      boxes.push({ n: n.textContent || n.getAttribute('class'), b: b });
    });
    var hits = 0, W = this.W;
    for (var i = 0; i < boxes.length; i++) {
      var a = boxes[i].b;
      if (a.y < 0 || a.x < 0 || a.x + a.width > W) { hits++; console.warn('[map ' + this.key + '] outside map:', boxes[i].n); }
      for (var j = i + 1; j < boxes.length; j++) {
        if (hit(a, boxes[j].b)) { hits++; console.warn('[map ' + this.key + '] overlap:', boxes[i].n, '×', boxes[j].n); }
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
      sh.querySelector('.sheet-close').addEventListener('click', function () { closeSheets(true); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var act = document.activeElement, back = null;
      views.forEach(function (v) {
        for (var id in v.hubs) if (v.hubs[id].leaves.contains(act)) back = v.hubs[id].g;   // 가지 안에서 Esc → 그 허브로
        v.setPinned(null);
      });
      closeSheets(true);
      if (back) back.focus();
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
          tabs.forEach(function (a) {
            if (a.getAttribute('href') === '#' + en.target.id) a.setAttribute('aria-current', 'location');
            else a.removeAttribute('aria-current');
          });
        });
      }, { threshold: 0.5 });
      document.querySelectorAll('.plate').forEach(function (s) { io.observe(s); });
    }
  }
  if (document.readyState !== 'loading') start(); else document.addEventListener('DOMContentLoaded', start);
})();
