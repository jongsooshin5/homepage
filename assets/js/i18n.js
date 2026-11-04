/* EN/KO 전환. 기본은 영문이고 ?lang=ko 또는 이전 선택(localStorage)이 있으면 그 언어를 쓴다.
   [data-i18n="key"] 요소의 글자를 바꾸고, 지도는 'langchange' 이벤트를 받아 다시 그린다.
   논문 인용과 지도 주제 라벨은 두 언어 모두 영문 그대로 둔다. */
(function () {
  'use strict';
  var D = {
    en: {
      'brand.affil': 'Research Assistant Professor · School of Earth and Environmental Sciences, Seoul National University',
      'role': 'Research Assistant Professor', 'affil': 'School of Earth and Environmental Sciences, Seoul National University',
      'intro.more': 'More about me', 'ri.title': 'Research Interests',
      'cesm1.no': 'Experiment I', 'cesm1.meta': '· run by Jongsoo Shin',
      'cesm2.no': 'Experiment II', 'cesm2.meta': '· Yonsei University',
      'path.rest': 'restoring', 'path.emis': 'CO₂ emissions',
      'ri.f1.x': 'CO₂ concentration', 'ri.f1.y': 'Climate response', 'ri.f1.gap': 'irreversible',
      'ri.f2.atm': 'Atmosphere', 'ri.f2.ocn': '1-D ocean columns (MCOM)',
      'ri.f3.heat': 'Heatwaves', 'ri.f3.rain': 'Extreme rain', 'ri.f3.dry': 'Drought',
      'nav.about': 'About', 'nav.pubs': 'Publications', 'nav.cv': 'CV', 'nav.maps': 'Research maps',
      'exp.cesm1': 'CESM1-CDR', 'exp.cesm2': 'CESM2 Net-Zero / Net-Negative',
      'cesm1.kicker': 'Experiment I · run by Jongsoo Shin',
      'cesm1.title': 'CESM1-CDR Experiment',
      'cesm1.sub': 'To understand the irreversibility and hysteresis of the climate system in response to ramp-up and ramp-down CO₂ concentrations.',
      'cesm2.kicker': 'Experiment II · Yonsei University',
      'cesm2.title': 'CESM2 Net-Zero and Net-Negative Experiments',
      'cesm2.sub': 'Climate responses and extremes under net-zero and net-negative CO₂ emission pathways.',
      'lg.co': 'Co-authored (published)', 'lg.exp': 'Used the experiment (not co-authored)',
      'lg.sub': 'Submitted / under review', 'lg.prep': 'In preparation',
      'map.hint': 'Click an icon to open its papers. Click a citation to read the paper.',
      'map.hint.touch': 'Tap an icon to list its papers. The number shows how many papers a region has.',
      'map.papers': '{n} papers', 'map.close': 'Close',
      'map.fail': 'The map could not be drawn in this browser.',
      'path.up': 'ramp-up', 'path.down': 'ramp-down',
      'path.nz': 'net zero', 'path.nn': 'net negative',
      'foot.updated': 'Last updated'
    },
    ko: {
      'brand.affil': '연구조교수 · 서울대학교 지구환경과학부',
      'role': '연구조교수', 'affil': '서울대학교 지구환경과학부',
      'intro.more': '자세한 소개', 'ri.title': '연구 분야',
      'cesm1.no': '실험 I', 'cesm1.meta': '· 신종수 수행',
      'cesm2.no': '실험 II', 'cesm2.meta': '· 연세대학교',
      'path.rest': '복원', 'path.emis': 'CO₂ 배출량',
      'ri.f1.x': 'CO₂ 농도', 'ri.f1.y': '기후 반응', 'ri.f1.gap': '비가역 변화',
      'ri.f2.atm': '대기', 'ri.f2.ocn': '1차원 해양 기둥 (MCOM)',
      'ri.f3.heat': '폭염', 'ri.f3.rain': '극한 강수', 'ri.f3.dry': '가뭄',
      'nav.about': '소개', 'nav.pubs': '논문', 'nav.cv': 'CV', 'nav.maps': '연구 지도',
      'exp.cesm1': 'CESM1-CDR', 'exp.cesm2': 'CESM2 탄소중립·순배출음수',
      'cesm1.kicker': '실험 I · 신종수 수행',
      'cesm1.title': 'CESM1-CDR 실험',
      'cesm1.sub': 'CO₂ 농도 증가(ramp-up)와 감소(ramp-down)에 대한 기후시스템의 비가역성과 이력현상을 이해하기 위한 실험',
      'cesm2.kicker': '실험 II · 연세대학교',
      'cesm2.title': 'CESM2 탄소중립·순배출음수 실험',
      'cesm2.sub': '탄소중립(net-zero)과 순배출음수(net-negative) CO₂ 배출 경로에서의 기후 반응과 극한현상',
      'lg.co': '공저 논문 (게재)', 'lg.exp': '실험 사용 논문 (비공저)',
      'lg.sub': '투고·심사 중', 'lg.prep': '준비 중',
      'map.hint': '아이콘을 누르면 논문이 펼쳐집니다. 인용을 누르면 논문으로 이동합니다.',
      'map.hint.touch': '아이콘을 누르면 논문 목록이 열립니다. 숫자는 그 지역의 논문 수입니다.',
      'map.papers': '논문 {n}편', 'map.close': '닫기',
      'map.fail': '이 브라우저에서는 지도를 그릴 수 없습니다.',
      'path.up': '증가', 'path.down': '감소',
      'path.nz': '탄소중립', 'path.nn': '순배출음수',
      'foot.updated': '최종 수정'
    }
  };

  function initial() {
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (q === 'ko' || q === 'en') return q;
    } catch (e) { /* ignore */ }
    try {
      var s = localStorage.getItem('lang');
      if (s === 'ko' || s === 'en') return s;
    } catch (e) { /* ignore */ }
    return 'en';
  }

  var lang = initial();
  function t(key, vars) {
    var s = (D[lang] && D[lang][key]) || D.en[key] || key;
    if (vars) for (var k in vars) s = s.replace('{' + k + '}', vars[k]);
    return s;
  }
  function apply() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-lang-toggle]').forEach(function (b) {
      b.textContent = lang === 'en' ? '한국어' : 'English';
      b.setAttribute('lang', lang === 'en' ? 'ko' : 'en');
    });
    document.querySelectorAll('[data-lang]').forEach(function (el) { el.hidden = el.getAttribute('data-lang') !== lang; });
  }
  function set(next) {
    lang = next === 'ko' ? 'ko' : 'en';
    try { localStorage.setItem('lang', lang); } catch (e) { /* ignore */ }
    apply();
    document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  }

  window.I18N = { t: t, get lang() { return lang; }, set: set };
  function ready() {
    apply();
    document.querySelectorAll('[data-lang-toggle]').forEach(function (b) {
      b.addEventListener('click', function () { set(lang === 'en' ? 'ko' : 'en'); });
    });
  }
  if (document.readyState !== 'loading') ready(); else document.addEventListener('DOMContentLoaded', ready);
})();
