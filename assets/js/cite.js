/* 사사 문구 복사 버튼. 버튼이 든 .ack 블록의 문단을 클립보드에 넣고 잠깐 '복사됨'을 보인다.
   클립보드를 못 쓰는 브라우저에서는 문단을 선택해 두어 Ctrl+C 로 복사하게 한다. */
(function () {
  'use strict';
  function select(p) {
    var r = document.createRange(), s = window.getSelection();
    r.selectNodeContents(p); s.removeAllRanges(); s.addRange(r);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.ack-copy');
    if (!b) return;
    var p = b.closest('.ack').querySelector('p');
    function done() {
      b.textContent = window.I18N.t('cite.copied');
      setTimeout(function () { b.textContent = window.I18N.t('cite.copy'); }, 1500);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(p.textContent).then(done, function () { select(p); });
    } else select(p);
  });
})();
